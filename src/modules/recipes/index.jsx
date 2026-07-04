// MODULE: recipes — recipe collection with cook mode. Isolated; imports only from shared/.
import { useState, useEffect } from 'react';
import { Plus, Search, Clock, Users, ChevronLeft, ChevronRight, ShoppingCart, X, Pencil, Trash2, Link2 } from 'lucide-react';
import { supabase } from '../../shared/supabase';
import { useAuth } from '../../shared/auth.jsx';

export default function Recipes() {
  const { profile } = useAuth();
  const [recipes, setRecipes] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [cookMode, setCookMode] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check for bookmarklet import data in URL hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#import=')) {
      try {
        const encoded = hash.slice(8);
        const json = decodeURIComponent(atob(encoded));
        const data = JSON.parse(json);

        // Clear the hash
        window.history.replaceState(null, '', window.location.pathname);

        // Create recipe object and open in edit mode
        const recipe = {
          title: data.title || 'Imported Recipe',
          description: data.description || '',
          prep_time: data.prepTime || null,
          cook_time: data.cookTime || null,
          servings: data.servings || null,
          ingredients: data.ingredients || [],
          instructions: data.instructions || [],
          tags: data.tags || [],
          source_url: data.url || null,
        };
        setEditingRecipe(recipe);
      } catch (e) {
        console.error('Failed to parse bookmarklet data:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (!profile?.household_id) return;

    async function fetchRecipes() {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('household_id', profile.household_id)
        .order('title');

      if (error) {
        console.error('Error fetching recipes:', error);
        return;
      }

      setRecipes(data || []);
      setLoading(false);
    }

    fetchRecipes();

    const channel = supabase
      .channel('recipes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recipes' }, () => fetchRecipes())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [profile?.household_id]);

  const filteredRecipes = recipes.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) {
    return <div style={styles.loading}><p>Loading recipes...</p></div>;
  }

  // Cook mode view
  if (cookMode && selectedRecipe) {
    return (
      <CookMode
        recipe={selectedRecipe}
        onExit={() => setCookMode(false)}
      />
    );
  }

  // Recipe detail view
  if (selectedRecipe) {
    return (
      <RecipeDetail
        recipe={selectedRecipe}
        profile={profile}
        onBack={() => setSelectedRecipe(null)}
        onCookMode={() => setCookMode(true)}
        onEdit={() => {
          setEditingRecipe(selectedRecipe);
          setSelectedRecipe(null);
        }}
        onDelete={async () => {
          await supabase.from('recipes').delete().eq('id', selectedRecipe.id);
          setSelectedRecipe(null);
        }}
      />
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Recipes</h1>
        <div style={styles.headerActions}>
          <button onClick={() => setShowImportModal(true)} style={styles.importBtn}>
            <Link2 size={18} />
          </button>
          <button onClick={() => setShowAddModal(true)} style={styles.addBtn}>
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={styles.searchBox}>
        <Search size={18} color="var(--text-dim)" />
        <input
          type="text"
          placeholder="Search recipes..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {/* Recipe grid */}
      {filteredRecipes.length > 0 ? (
        <div style={styles.grid}>
          {filteredRecipes.map(recipe => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onClick={() => setSelectedRecipe(recipe)}
            />
          ))}
        </div>
      ) : (
        <div style={styles.empty}>
          <p>No recipes yet</p>
          <button onClick={() => setShowAddModal(true)} style={styles.emptyBtn}>
            Add your first recipe
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingRecipe) && (
        <RecipeModal
          recipe={editingRecipe}
          profile={profile}
          onClose={() => {
            setShowAddModal(false);
            setEditingRecipe(null);
          }}
          onSave={() => {
            setShowAddModal(false);
            setEditingRecipe(null);
          }}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportModal
          profile={profile}
          onClose={() => setShowImportModal(false)}
          onImported={(recipe) => {
            setShowImportModal(false);
            setEditingRecipe(recipe); // Open in edit mode to review/adjust
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RECIPE CARD
// ─────────────────────────────────────────────────────────────
function RecipeCard({ recipe, onClick }) {
  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);

  return (
    <button onClick={onClick} style={styles.card}>
      <div style={styles.cardContent}>
        <h3 style={styles.cardTitle}>{recipe.title}</h3>
        {recipe.description && (
          <p style={styles.cardDesc}>{recipe.description}</p>
        )}
        <div style={styles.cardMeta}>
          {totalTime > 0 && (
            <span style={styles.cardMetaItem}>
              <Clock size={12} /> {totalTime} min
            </span>
          )}
          {recipe.servings && (
            <span style={styles.cardMetaItem}>
              <Users size={12} /> {recipe.servings}
            </span>
          )}
        </div>
        {recipe.tags?.length > 0 && (
          <div style={styles.tags}>
            {recipe.tags.slice(0, 3).map(tag => (
              <span key={tag} style={styles.tag}>{tag}</span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// RECIPE DETAIL
// ─────────────────────────────────────────────────────────────
function RecipeDetail({ recipe, profile, onBack, onCookMode, onEdit, onDelete }) {
  const [addingToList, setAddingToList] = useState(false);

  async function addIngredientsToList() {
    setAddingToList(true);

    // Get the Grocery list (or first list)
    const { data: lists } = await supabase
      .from('lists')
      .select('id')
      .eq('household_id', profile.household_id)
      .eq('name', 'Grocery')
      .limit(1);

    let listId = lists?.[0]?.id;

    // If no Grocery list, get any list
    if (!listId) {
      const { data: anyList } = await supabase
        .from('lists')
        .select('id')
        .eq('household_id', profile.household_id)
        .limit(1);
      listId = anyList?.[0]?.id;
    }

    if (!listId || !recipe.ingredients?.length) {
      setAddingToList(false);
      return;
    }

    // Add each ingredient as a list item
    const items = recipe.ingredients.map(ing => ({
      list_id: listId,
      text: ing.amount ? `${ing.amount} ${ing.item}` : ing.item,
      added_by: profile.id,
    }));

    await supabase.from('list_items').insert(items);
    setAddingToList(false);
    alert('Ingredients added to Grocery list!');
  }

  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.detailHeader}>
        <button onClick={onBack} style={styles.backBtn}>
          <ChevronLeft size={20} />
          <span>Back</span>
        </button>
        <div style={styles.detailActions}>
          <button onClick={onEdit} style={styles.iconBtn}>
            <Pencil size={18} />
          </button>
          <button onClick={onDelete} style={styles.iconBtn}>
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Title */}
      <h1 style={styles.detailTitle}>{recipe.title}</h1>
      {recipe.description && (
        <p style={styles.detailDesc}>{recipe.description}</p>
      )}

      {/* Meta */}
      <div style={styles.detailMeta}>
        {recipe.prep_time > 0 && (
          <div style={styles.metaBox}>
            <span style={styles.metaLabel}>Prep</span>
            <span style={styles.metaValue}>{recipe.prep_time} min</span>
          </div>
        )}
        {recipe.cook_time > 0 && (
          <div style={styles.metaBox}>
            <span style={styles.metaLabel}>Cook</span>
            <span style={styles.metaValue}>{recipe.cook_time} min</span>
          </div>
        )}
        {recipe.servings && (
          <div style={styles.metaBox}>
            <span style={styles.metaLabel}>Servings</span>
            <span style={styles.metaValue}>{recipe.servings}</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={styles.actionButtons}>
        <button onClick={onCookMode} style={styles.primaryBtn} className="sheen">
          Start Cooking
        </button>
        <button
          onClick={addIngredientsToList}
          disabled={addingToList || !recipe.ingredients?.length}
          style={styles.secondaryBtn}
        >
          <ShoppingCart size={16} />
          {addingToList ? 'Adding...' : 'Add to Grocery List'}
        </button>
      </div>

      {/* Ingredients */}
      {recipe.ingredients?.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Ingredients</h2>
          <ul style={styles.ingredientList}>
            {recipe.ingredients.map((ing, i) => (
              <li key={i} style={styles.ingredient}>
                {ing.amount && <span style={styles.amount}>{ing.amount}</span>}
                <span>{ing.item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Instructions */}
      {recipe.instructions?.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Instructions</h2>
          <ol style={styles.instructionList}>
            {recipe.instructions.map((step, i) => (
              <li key={i} style={styles.instruction}>{step}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COOK MODE - Large text, step by step
// ─────────────────────────────────────────────────────────────
function CookMode({ recipe, onExit }) {
  const [step, setStep] = useState(0);
  const steps = recipe.instructions || [];
  const totalSteps = steps.length;

  function prevStep() {
    if (step > 0) setStep(step - 1);
  }

  function nextStep() {
    if (step < totalSteps - 1) setStep(step + 1);
  }

  return (
    <div style={styles.cookMode}>
      {/* Header */}
      <div style={styles.cookHeader}>
        <button onClick={onExit} style={styles.exitBtn}>
          <X size={24} />
        </button>
        <span style={styles.cookTitle}>{recipe.title}</span>
        <span style={styles.stepCount}>
          {step + 1} / {totalSteps}
        </span>
      </div>

      {/* Step content */}
      <div style={styles.cookContent}>
        <p style={styles.cookStep}>{steps[step]}</p>
      </div>

      {/* Navigation */}
      <div style={styles.cookNav}>
        <button
          onClick={prevStep}
          disabled={step === 0}
          style={{
            ...styles.cookNavBtn,
            opacity: step === 0 ? 0.3 : 1,
          }}
        >
          <ChevronLeft size={32} />
          <span>Previous</span>
        </button>

        {step === totalSteps - 1 ? (
          <button onClick={onExit} style={styles.cookDoneBtn}>
            Done!
          </button>
        ) : (
          <button onClick={nextStep} style={styles.cookNavBtn}>
            <span>Next</span>
            <ChevronRight size={32} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADD/EDIT MODAL
// ─────────────────────────────────────────────────────────────
function RecipeModal({ recipe, profile, onClose, onSave }) {
  const [title, setTitle] = useState(recipe?.title || '');
  const [description, setDescription] = useState(recipe?.description || '');
  const [prepTime, setPrepTime] = useState(recipe?.prep_time || '');
  const [cookTime, setCookTime] = useState(recipe?.cook_time || '');
  const [servings, setServings] = useState(recipe?.servings || '');
  const [ingredients, setIngredients] = useState(
    recipe?.ingredients?.map(i => `${i.amount ? i.amount + ' ' : ''}${i.item}`).join('\n') || ''
  );
  const [instructions, setInstructions] = useState(
    recipe?.instructions?.join('\n\n') || ''
  );
  const [tags, setTags] = useState(recipe?.tags?.join(', ') || '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);

    // Parse ingredients (each line is an ingredient)
    const parsedIngredients = ingredients
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        // Try to split amount from item (e.g., "2 cups flour")
        const match = line.match(/^([\d\/\s]+(?:cups?|tbsp|tsp|oz|lbs?|g|kg|ml|l)?)\s+(.+)$/i);
        if (match) {
          return { amount: match[1].trim(), item: match[2].trim() };
        }
        return { amount: '', item: line.trim() };
      });

    // Parse instructions (split by double newline or number prefix)
    const parsedInstructions = instructions
      .split(/\n\n+|\n(?=\d+\.)/)
      .map(s => s.replace(/^\d+\.\s*/, '').trim())
      .filter(s => s);

    // Parse tags
    const parsedTags = tags
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t);

    const data = {
      household_id: profile.household_id,
      title: title.trim(),
      description: description.trim() || null,
      prep_time: prepTime ? parseInt(prepTime) : null,
      cook_time: cookTime ? parseInt(cookTime) : null,
      servings: servings ? parseInt(servings) : null,
      ingredients: parsedIngredients,
      instructions: parsedInstructions,
      tags: parsedTags,
      source_url: recipe?.source_url || null,
      created_by: recipe?.created_by || profile.id,
    };

    let error;
    if (recipe?.id) {
      // Existing recipe - update
      const result = await supabase.from('recipes').update(data).eq('id', recipe.id);
      error = result.error;
    } else {
      // New recipe (manual or imported)
      const result = await supabase.from('recipes').insert(data);
      error = result.error;
    }

    setSaving(false);

    if (error) {
      console.error('Save error:', error);
      setSaveError(error.message || 'Failed to save recipe');
      return;
    }

    onSave();
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <h3 style={styles.modalTitle}>{recipe ? 'Edit Recipe' : 'New Recipe'}</h3>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || saving}
            style={{ ...styles.saveBtn, opacity: title.trim() && !saving ? 1 : 0.5 }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div style={styles.modalBody}>
          <input
            type="text"
            placeholder="Recipe title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={styles.input}
          />

          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{ ...styles.input, minHeight: 60 }}
          />

          <div style={styles.row}>
            <input
              type="number"
              placeholder="Prep (min)"
              value={prepTime}
              onChange={e => setPrepTime(e.target.value)}
              style={{ ...styles.input, flex: 1 }}
            />
            <input
              type="number"
              placeholder="Cook (min)"
              value={cookTime}
              onChange={e => setCookTime(e.target.value)}
              style={{ ...styles.input, flex: 1 }}
            />
            <input
              type="number"
              placeholder="Servings"
              value={servings}
              onChange={e => setServings(e.target.value)}
              style={{ ...styles.input, flex: 1 }}
            />
          </div>

          <textarea
            placeholder="Ingredients (one per line, e.g. '2 cups flour')"
            value={ingredients}
            onChange={e => setIngredients(e.target.value)}
            style={{ ...styles.input, minHeight: 120 }}
          />

          <textarea
            placeholder="Instructions (separate steps with blank lines)"
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            style={{ ...styles.input, minHeight: 150 }}
          />

          <input
            type="text"
            placeholder="Tags (comma separated, e.g. dinner, quick, chicken)"
            value={tags}
            onChange={e => setTags(e.target.value)}
            style={styles.input}
          />

          {saveError && (
            <p style={styles.errorText}>{saveError}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// IMPORT FROM URL MODAL
// ─────────────────────────────────────────────────────────────
function ImportModal({ profile, onClose, onImported }) {
  const [mode, setMode] = useState('url'); // 'url', 'paste', or 'bookmarklet'
  const [url, setUrl] = useState('');
  const [pastedContent, setPastedContent] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Get the base URL for the bookmarklet redirect
  const baseUrl = window.location.origin;

  // The bookmarklet code - extracts JSON-LD recipe data and redirects to Vesta
  const bookmarkletCode = `javascript:(function(){try{var s=document.querySelectorAll('script[type="application/ld+json"]');var r=null;for(var i=0;i<s.length;i++){try{var d=JSON.parse(s[i].textContent);if(Array.isArray(d))d=d.find(function(x){return x['@type']==='Recipe';});if(d&&d['@type']==='Recipe'){r=d;break;}}catch(e){}}if(!r){alert('No recipe found on this page');return;}var data={title:r.name||'',description:r.description||'',prepTime:r.prepTime?parseInt(r.prepTime.match(/\\d+/)||0):null,cookTime:r.cookTime?parseInt(r.cookTime.match(/\\d+/)||0):null,servings:r.recipeYield?parseInt(r.recipeYield)||null:null,ingredients:(r.recipeIngredient||[]).map(function(i){return{amount:'',item:i};}),instructions:(r.recipeInstructions||[]).map(function(s){return typeof s==='string'?s:s.text||'';}),tags:(r.recipeCategory||[]).concat(r.recipeCuisine||[]),url:window.location.href};var encoded=btoa(encodeURIComponent(JSON.stringify(data)));window.location.href='${baseUrl}#import='+encoded;}catch(e){alert('Error: '+e.message);}})();`;

  function copyBookmarklet() {
    navigator.clipboard.writeText(bookmarkletCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleUrlImport(e) {
    e.preventDefault();
    if (!url.trim()) return;

    setImporting(true);
    setError('');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('extract-recipe', {
        body: { url: url.trim() },
      });

      if (fnError) throw fnError;
      if (!data || !data.title) {
        throw new Error('Could not extract recipe from this URL');
      }

      const recipe = {
        title: data.title,
        description: data.description || '',
        prep_time: data.prepTime || null,
        cook_time: data.cookTime || null,
        servings: data.servings || null,
        ingredients: data.ingredients || [],
        instructions: data.instructions || [],
        tags: data.tags || [],
        source_url: url.trim(),
      };

      onImported(recipe);
    } catch (err) {
      console.error('Import error:', err);
      setError('This site blocks automatic import. Try "Paste Recipe" instead.');
    } finally {
      setImporting(false);
    }
  }

  function handlePasteImport() {
    if (!pastedContent.trim()) return;

    // Parse pasted content - look for common patterns
    const lines = pastedContent.split('\n').map(l => l.trim()).filter(l => l);

    // First non-empty line is usually the title
    const title = lines[0] || 'Imported Recipe';

    // Find ingredients section (look for measurement patterns)
    const ingredientPatterns = /^\d|^[\u00BC-\u00BE\u2150-\u215E]|^(one|two|three|four|five|six|half|quarter)/i;
    const ingredients = [];
    const instructions = [];

    let inIngredients = false;
    let inInstructions = false;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const lowerLine = line.toLowerCase();

      // Section headers
      if (lowerLine.includes('ingredient')) {
        inIngredients = true;
        inInstructions = false;
        continue;
      }
      if (lowerLine.includes('instruction') || lowerLine.includes('direction') || lowerLine.includes('method') || lowerLine.includes('steps')) {
        inIngredients = false;
        inInstructions = true;
        continue;
      }

      // Auto-detect based on content
      if (!inIngredients && !inInstructions) {
        if (ingredientPatterns.test(line)) {
          inIngredients = true;
        }
      }

      if (inIngredients && ingredientPatterns.test(line)) {
        // Parse ingredient
        const match = line.match(/^([\d\/\.\s\u00BC-\u00BE\u2150-\u215E]+(?:\s*(?:cups?|tbsp|tsp|oz|lbs?|g|kg|ml|cloves?|cans?|packages?|bunch|pieces?|slices?))?)\s*(.+)/i);
        if (match) {
          ingredients.push({ amount: match[1].trim(), item: match[2].trim() });
        } else {
          ingredients.push({ amount: '', item: line });
        }
      } else if (inInstructions || /^\d+[\.\)]/.test(line)) {
        // Numbered step or in instructions section
        const step = line.replace(/^\d+[\.\)]\s*/, '');
        if (step.length > 10) {
          instructions.push(step);
          inInstructions = true;
        }
      } else if (line.length > 50 && !inIngredients) {
        // Long lines are probably instructions
        instructions.push(line);
        inInstructions = true;
      }
    }

    const recipe = {
      title,
      description: '',
      prep_time: null,
      cook_time: null,
      servings: null,
      ingredients: ingredients.length > 0 ? ingredients : [{ amount: '', item: 'Add ingredients' }],
      instructions: instructions.length > 0 ? instructions : ['Add instructions'],
      tags: [],
      source_url: url.trim() || null,
    };

    onImported(recipe);
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <h3 style={styles.modalTitle}>Import Recipe</h3>
          <div style={{ width: 50 }} />
        </div>

        <div style={styles.modalBody}>
          {/* Mode toggle */}
          <div style={styles.modeToggle}>
            <button
              onClick={() => setMode('url')}
              style={{
                ...styles.modeBtn,
                background: mode === 'url' ? 'var(--m-gold)' : 'transparent',
              }}
            >
              URL
            </button>
            <button
              onClick={() => setMode('paste')}
              style={{
                ...styles.modeBtn,
                background: mode === 'paste' ? 'var(--m-gold)' : 'transparent',
              }}
            >
              Paste
            </button>
            <button
              onClick={() => setMode('bookmarklet')}
              style={{
                ...styles.modeBtn,
                background: mode === 'bookmarklet' ? 'var(--m-gold)' : 'transparent',
              }}
            >
              Bookmarklet
            </button>
          </div>

          {mode === 'url' ? (
            <>
              <p style={styles.importHint}>
                Paste a recipe URL. Works with many food blogs and recipe sites.
              </p>

              <input
                type="url"
                placeholder="https://example.com/recipe/..."
                value={url}
                onChange={e => setUrl(e.target.value)}
                style={styles.input}
                autoFocus
              />

              {error && (
                <p style={styles.errorText}>{error}</p>
              )}

              <button
                onClick={handleUrlImport}
                disabled={!url.trim() || importing}
                style={{
                  ...styles.primaryBtn,
                  opacity: url.trim() && !importing ? 1 : 0.5,
                  marginTop: 'var(--sp-2)',
                }}
              >
                {importing ? 'Importing...' : 'Import'}
              </button>
            </>
          ) : (
            <>
              <p style={styles.importHint}>
                Copy the recipe from the website and paste it here. Include title, ingredients, and instructions.
              </p>

              <textarea
                placeholder="Paste recipe content here...

Example:
Chocolate Chip Cookies

Ingredients:
2 cups flour
1 cup sugar
...

Instructions:
1. Preheat oven to 350°F
2. Mix dry ingredients
..."
                value={pastedContent}
                onChange={e => setPastedContent(e.target.value)}
                style={{ ...styles.input, minHeight: 200 }}
                autoFocus
              />

              <input
                type="url"
                placeholder="Source URL (optional)"
                value={url}
                onChange={e => setUrl(e.target.value)}
                style={{ ...styles.input, marginTop: 'var(--sp-2)' }}
              />

              <button
                onClick={handlePasteImport}
                disabled={!pastedContent.trim()}
                style={{
                  ...styles.primaryBtn,
                  opacity: pastedContent.trim() ? 1 : 0.5,
                  marginTop: 'var(--sp-2)',
                }}
              >
                Parse & Import
              </button>
            </>
          ) : (
            <>
              <p style={styles.importHint}>
                Some sites block automatic import. Use a bookmarklet to import recipes from any page.
              </p>

              <div style={styles.bookmarkletSteps}>
                <div style={styles.step}>
                  <span style={styles.stepNum}>1</span>
                  <span>Copy the bookmarklet code below</span>
                </div>
                <div style={styles.step}>
                  <span style={styles.stepNum}>2</span>
                  <span>Create a new bookmark in your browser</span>
                </div>
                <div style={styles.step}>
                  <span style={styles.stepNum}>3</span>
                  <span>Paste the code as the bookmark URL</span>
                </div>
                <div style={styles.step}>
                  <span style={styles.stepNum}>4</span>
                  <span>Click the bookmark on any recipe page</span>
                </div>
              </div>

              <div style={styles.bookmarkletBox}>
                <code style={styles.bookmarkletCode}>
                  {bookmarkletCode.slice(0, 60)}...
                </code>
              </div>

              <button
                onClick={copyBookmarklet}
                style={{
                  ...styles.primaryBtn,
                  marginTop: 'var(--sp-2)',
                }}
              >
                {copied ? 'Copied!' : 'Copy Bookmarklet Code'}
              </button>

              <p style={styles.bookmarkletNote}>
                On desktop, you can also drag this link to your bookmarks bar:{' '}
                <a
                  href={bookmarkletCode}
                  onClick={(e) => e.preventDefault()}
                  style={styles.bookmarkletLink}
                >
                  Import to Vesta
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const styles = {
  container: {
    padding: 'var(--sp-3)',
    paddingBottom: 100,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '50vh',
    color: 'var(--text-dim)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 'var(--sp-3)',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
  },
  headerActions: {
    display: 'flex',
    gap: 8,
  },
  importBtn: {
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    color: 'var(--text-dim)',
    cursor: 'pointer',
  },
  addBtn: {
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--m-gold)',
    border: 'none',
    borderRadius: 10,
    color: 'var(--text)',
    cursor: 'pointer',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    marginBottom: 'var(--sp-3)',
  },
  searchInput: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: 'var(--text)',
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    outline: 'none',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 'var(--sp-2)',
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 'var(--sp-3)',
    textAlign: 'left',
    cursor: 'pointer',
    width: '100%',
  },
  cardContent: {},
  cardTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    color: 'var(--text-dim)',
    marginBottom: 8,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  cardMeta: {
    display: 'flex',
    gap: 10,
    marginBottom: 8,
  },
  cardMetaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    color: 'var(--text-dim)',
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
  },
  tag: {
    padding: '2px 8px',
    background: 'var(--surface-2)',
    borderRadius: 10,
    fontSize: 10,
    color: 'var(--text-dim)',
  },
  empty: {
    textAlign: 'center',
    padding: 'var(--sp-5)',
    color: 'var(--text-dim)',
  },
  emptyBtn: {
    marginTop: 'var(--sp-2)',
    padding: '10px 20px',
    background: 'var(--m-gold)',
    border: 'none',
    borderRadius: 8,
    color: 'var(--text)',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },

  // Detail view
  detailHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 'var(--sp-3)',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'none',
    border: 'none',
    color: 'var(--gold)',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    cursor: 'pointer',
    padding: 0,
  },
  detailActions: {
    display: 'flex',
    gap: 8,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-dim)',
    cursor: 'pointer',
    padding: 4,
  },
  detailTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 26,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 8,
  },
  detailDesc: {
    fontSize: 14,
    color: 'var(--text-dim)',
    lineHeight: 1.5,
    marginBottom: 'var(--sp-3)',
  },
  detailMeta: {
    display: 'flex',
    gap: 'var(--sp-2)',
    marginBottom: 'var(--sp-3)',
  },
  metaBox: {
    flex: 1,
    padding: 'var(--sp-2)',
    background: 'var(--surface)',
    borderRadius: 8,
    textAlign: 'center',
  },
  metaLabel: {
    display: 'block',
    fontSize: 11,
    color: 'var(--text-dim)',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text)',
  },
  actionButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--sp-2)',
    marginBottom: 'var(--sp-4)',
  },
  primaryBtn: {
    padding: '14px',
    background: 'var(--m-gold)',
    border: 'none',
    borderRadius: 10,
    color: 'var(--text)',
    fontFamily: 'var(--font-body)',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 10,
    color: 'var(--text)',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    cursor: 'pointer',
  },
  section: {
    marginBottom: 'var(--sp-4)',
  },
  sectionTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: 'var(--sp-2)',
  },
  ingredientList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  ingredient: {
    padding: '8px 0',
    borderBottom: '1px solid var(--border)',
    fontSize: 14,
    color: 'var(--text)',
  },
  amount: {
    fontWeight: 600,
    marginRight: 6,
  },
  instructionList: {
    paddingLeft: 20,
    margin: 0,
  },
  instruction: {
    padding: '8px 0',
    fontSize: 14,
    color: 'var(--text)',
    lineHeight: 1.6,
  },

  // Cook mode
  cookMode: {
    position: 'fixed',
    inset: 0,
    background: 'var(--bg)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 200,
  },
  cookHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--sp-3)',
    borderBottom: '1px solid var(--border)',
  },
  exitBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-dim)',
    cursor: 'pointer',
    padding: 4,
  },
  cookTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text)',
  },
  stepCount: {
    fontSize: 14,
    color: 'var(--text-dim)',
    fontWeight: 600,
  },
  cookContent: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--sp-4)',
  },
  cookStep: {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(20px, 6vw, 32px)',
    fontWeight: 500,
    color: 'var(--text)',
    textAlign: 'center',
    lineHeight: 1.5,
  },
  cookNav: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: 'var(--sp-3)',
    paddingBottom: 'calc(var(--sp-3) + env(safe-area-inset-bottom))',
    borderTop: '1px solid var(--border)',
  },
  cookNavBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'none',
    border: 'none',
    color: 'var(--gold)',
    fontFamily: 'var(--font-body)',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },
  cookDoneBtn: {
    padding: '12px 32px',
    background: 'var(--m-gold)',
    border: 'none',
    borderRadius: 10,
    color: 'var(--text)',
    fontFamily: 'var(--font-body)',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
  },

  // Modal
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '90vh',
    background: 'var(--surface)',
    borderRadius: '16px 16px 0 0',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--sp-3)',
    borderBottom: '1px solid var(--border)',
  },
  modalTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 17,
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
  },
  cancelBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    cursor: 'pointer',
  },
  saveBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--gold)',
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  modalBody: {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--sp-3)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--sp-2)',
    paddingBottom: 'calc(var(--sp-3) + env(safe-area-inset-bottom))',
  },
  input: {
    padding: '12px 14px',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    outline: 'none',
    resize: 'vertical',
  },
  row: {
    display: 'flex',
    gap: 'var(--sp-2)',
  },
  importHint: {
    fontSize: 14,
    color: 'var(--text-dim)',
    lineHeight: 1.5,
    marginBottom: 'var(--sp-2)',
  },
  errorText: {
    fontSize: 13,
    color: '#FF3B30',
    marginTop: 4,
  },
  importNote: {
    fontSize: 12,
    color: 'var(--text-dim)',
    textAlign: 'center',
    marginTop: 'var(--sp-3)',
  },
  modeToggle: {
    display: 'flex',
    gap: 8,
    marginBottom: 'var(--sp-3)',
  },
  modeBtn: {
    flex: 1,
    padding: '10px',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },

  // Bookmarklet styles
  bookmarkletSteps: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 'var(--sp-3)',
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 14,
    color: 'var(--text)',
  },
  stepNum: {
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--m-gold)',
    borderRadius: '50%',
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  bookmarkletBox: {
    padding: 12,
    background: 'var(--surface-2)',
    borderRadius: 8,
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  bookmarkletCode: {
    fontSize: 11,
    color: 'var(--text-dim)',
    wordBreak: 'break-all',
    fontFamily: 'monospace',
  },
  bookmarkletNote: {
    fontSize: 12,
    color: 'var(--text-dim)',
    textAlign: 'center',
    marginTop: 'var(--sp-3)',
    lineHeight: 1.5,
  },
  bookmarkletLink: {
    color: 'var(--gold)',
    textDecoration: 'none',
    fontWeight: 600,
  },
};
