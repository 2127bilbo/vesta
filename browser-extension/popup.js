// Vesta Recipe Importer - Popup Script

const STORAGE_KEY = 'vestaUrl';
const DEFAULT_URL = 'https://vesta-aio.vercel.app'; // Update with actual URL

// Load saved URL on popup open
document.addEventListener('DOMContentLoaded', async () => {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const urlInput = document.getElementById('vestaUrl');
  urlInput.value = stored[STORAGE_KEY] || DEFAULT_URL;

  // Save URL when changed
  urlInput.addEventListener('change', () => {
    chrome.storage.local.set({ [STORAGE_KEY]: urlInput.value });
  });
});

// Extract recipe script - will be injected into the page
function extractRecipeScript() {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  let recipe = null;

  for (const script of scripts) {
    try {
      let data = JSON.parse(script.textContent);

      // Handle arrays of schema objects
      if (Array.isArray(data)) {
        data = data.find(item => item['@type'] === 'Recipe');
      }

      // Handle @graph structure
      if (data && data['@graph']) {
        data = data['@graph'].find(item => item['@type'] === 'Recipe');
      }

      if (data && data['@type'] === 'Recipe') {
        recipe = data;
        break;
      }
    } catch (e) {
      // Invalid JSON, skip
    }
  }

  if (!recipe) {
    return { error: 'No recipe found on this page' };
  }

  // Parse times (ISO 8601 duration to minutes)
  function parseTime(duration) {
    if (!duration) return null;
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return null;
    const hours = parseInt(match[1] || 0);
    const mins = parseInt(match[2] || 0);
    return hours * 60 + mins || null;
  }

  // Parse servings
  function parseServings(yield_) {
    if (!yield_) return null;
    if (typeof yield_ === 'number') return yield_;
    const match = String(yield_).match(/\d+/);
    return match ? parseInt(match[0]) : null;
  }

  // Parse instructions
  function parseInstructions(instructions) {
    if (!instructions) return [];
    if (typeof instructions === 'string') return [instructions];
    return instructions.map(step => {
      if (typeof step === 'string') return step;
      return step.text || step.name || '';
    }).filter(Boolean);
  }

  // Build recipe data
  const data = {
    title: recipe.name || '',
    description: recipe.description || '',
    prepTime: parseTime(recipe.prepTime),
    cookTime: parseTime(recipe.cookTime),
    servings: parseServings(recipe.recipeYield),
    ingredients: (recipe.recipeIngredient || []).map(i => ({ amount: '', item: i })),
    instructions: parseInstructions(recipe.recipeInstructions),
    tags: [].concat(recipe.recipeCategory || [], recipe.recipeCuisine || []).filter(Boolean),
    url: window.location.href,
  };

  return { recipe: data };
}

// Handle import button click
document.getElementById('importBtn').addEventListener('click', async () => {
  const status = document.getElementById('status');
  const preview = document.getElementById('preview');
  const button = document.getElementById('importBtn');
  const urlInput = document.getElementById('vestaUrl');

  button.disabled = true;
  status.textContent = 'Extracting recipe...';
  status.className = 'status';
  preview.style.display = 'none';

  try {
    // Get the current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Inject and execute the extraction script
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractRecipeScript,
    });

    const result = results[0]?.result;

    if (result?.error) {
      status.textContent = result.error;
      status.className = 'status error';
      button.disabled = false;
      return;
    }

    const recipe = result.recipe;

    // Show preview
    document.getElementById('previewTitle').textContent = recipe.title;
    document.getElementById('previewMeta').textContent =
      `${recipe.ingredients.length} ingredients, ${recipe.instructions.length} steps`;
    preview.style.display = 'block';

    // Encode and redirect
    const encoded = btoa(encodeURIComponent(JSON.stringify(recipe)));
    const vestaUrl = urlInput.value.replace(/\/$/, ''); // Remove trailing slash
    const importUrl = `${vestaUrl}#import=${encoded}`;

    status.textContent = 'Opening Vesta...';
    status.className = 'status success';

    // Open Vesta with the recipe
    chrome.tabs.create({ url: importUrl });

  } catch (err) {
    status.textContent = 'Error: ' + err.message;
    status.className = 'status error';
    button.disabled = false;
  }
});
