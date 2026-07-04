// Supabase Edge Function: extract-recipe
// Fetches a URL and extracts recipe data from JSON-LD or HTML

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RecipeData {
  title: string;
  description?: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  ingredients: { amount: string; item: string }[];
  instructions: string[];
  tags?: string[];
  imageUrl?: string;
}

// Parse ISO 8601 duration (PT30M, PT1H30M, etc.) to minutes
function parseDuration(duration: string): number | null {
  if (!duration) return null;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return null;
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  return hours * 60 + minutes;
}

// Parse ingredient string into amount and item
function parseIngredient(text: string): { amount: string; item: string } {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  // Try to match amount at start (numbers, fractions, units)
  const match = cleaned.match(/^([\d\/\.\s]+(?:cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|l|liters?|cloves?|slices?|pieces?|cans?|packages?|bunch|head)?\.?\s*)/i);
  if (match && match[1].length < cleaned.length) {
    return {
      amount: match[1].trim(),
      item: cleaned.slice(match[1].length).trim(),
    };
  }
  return { amount: '', item: cleaned };
}

// Extract recipe from JSON-LD
function extractFromJsonLd(jsonLd: any): RecipeData | null {
  // Handle @graph structure
  if (jsonLd['@graph']) {
    for (const item of jsonLd['@graph']) {
      if (item['@type'] === 'Recipe') {
        return extractFromJsonLd(item);
      }
    }
  }

  // Handle array of items
  if (Array.isArray(jsonLd)) {
    for (const item of jsonLd) {
      const result = extractFromJsonLd(item);
      if (result) return result;
    }
  }

  // Check if this is a Recipe
  const type = jsonLd['@type'];
  const isRecipe = type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'));
  if (!isRecipe) return null;

  // Extract data
  const title = jsonLd.name || '';
  const description = jsonLd.description || '';
  const prepTime = parseDuration(jsonLd.prepTime);
  const cookTime = parseDuration(jsonLd.cookTime);

  // Servings can be a number or a string like "4 servings"
  let servings: number | undefined;
  if (jsonLd.recipeYield) {
    const yieldVal = Array.isArray(jsonLd.recipeYield) ? jsonLd.recipeYield[0] : jsonLd.recipeYield;
    const yieldMatch = String(yieldVal).match(/\d+/);
    servings = yieldMatch ? parseInt(yieldMatch[0]) : undefined;
  }

  // Ingredients
  const rawIngredients = jsonLd.recipeIngredient || [];
  const ingredients = rawIngredients.map((ing: string) => parseIngredient(ing));

  // Instructions
  let instructions: string[] = [];
  const rawInstructions = jsonLd.recipeInstructions || [];

  if (typeof rawInstructions === 'string') {
    // Single string - split by periods or newlines
    instructions = rawInstructions.split(/\.\s+|\n+/).filter((s: string) => s.trim());
  } else if (Array.isArray(rawInstructions)) {
    for (const step of rawInstructions) {
      if (typeof step === 'string') {
        instructions.push(step.trim());
      } else if (step['@type'] === 'HowToStep') {
        instructions.push(step.text?.trim() || step.name?.trim() || '');
      } else if (step['@type'] === 'HowToSection') {
        // Nested sections
        for (const subStep of step.itemListElement || []) {
          instructions.push(subStep.text?.trim() || subStep.name?.trim() || '');
        }
      }
    }
  }
  instructions = instructions.filter(s => s);

  // Tags/keywords
  let tags: string[] = [];
  if (jsonLd.keywords) {
    tags = typeof jsonLd.keywords === 'string'
      ? jsonLd.keywords.split(',').map((t: string) => t.trim().toLowerCase())
      : jsonLd.keywords.map((t: string) => t.toLowerCase());
  }
  if (jsonLd.recipeCategory) {
    const categories = Array.isArray(jsonLd.recipeCategory)
      ? jsonLd.recipeCategory
      : [jsonLd.recipeCategory];
    tags = [...tags, ...categories.map((c: string) => c.toLowerCase())];
  }
  tags = [...new Set(tags)].slice(0, 5); // Dedupe and limit

  // Image
  let imageUrl: string | undefined;
  if (jsonLd.image) {
    if (typeof jsonLd.image === 'string') {
      imageUrl = jsonLd.image;
    } else if (Array.isArray(jsonLd.image)) {
      imageUrl = jsonLd.image[0];
    } else if (jsonLd.image.url) {
      imageUrl = jsonLd.image.url;
    }
  }

  return {
    title,
    description,
    prepTime: prepTime || undefined,
    cookTime: cookTime || undefined,
    servings,
    ingredients,
    instructions,
    tags: tags.length > 0 ? tags : undefined,
    imageUrl,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the page with browser-like headers
    console.log('Fetching URL:', url);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
      },
    });
    console.log('Response status:', response.status);

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();

    // Find JSON-LD scripts
    const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

    let jsonLdCount = 0;
    for (const match of jsonLdMatches) {
      jsonLdCount++;
      try {
        console.log('Found JSON-LD block', jsonLdCount);
        const jsonLd = JSON.parse(match[1]);
        const recipe = extractFromJsonLd(jsonLd);
        if (recipe && recipe.title) {
          console.log('Successfully extracted recipe:', recipe.title);
          return new Response(
            JSON.stringify(recipe),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (e) {
        console.log('Error parsing JSON-LD block', jsonLdCount, ':', e.message);
        // Continue to next JSON-LD block
      }
    }
    console.log('Total JSON-LD blocks found:', jsonLdCount);

    // No JSON-LD found - return error
    return new Response(
      JSON.stringify({ error: 'No recipe found on this page. Try a direct recipe URL.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to extract recipe' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
