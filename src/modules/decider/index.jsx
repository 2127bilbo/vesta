// MODULE: decider — random decision picker with recipe integration. Isolated; imports only from shared/.
import { useState, useEffect, useRef } from 'react';
import { Plus, Shuffle, Trash2, ChevronLeft, UtensilsCrossed, X, RotateCcw } from 'lucide-react';
import { supabase } from '../../shared/supabase';
import { useAuth } from '../../shared/auth.jsx';

export default function Decider() {
  const { profile } = useAuth();
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [showAddList, setShowAddList] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.household_id) return;

    async function fetchLists() {
      const { data } = await supabase
        .from('decider_lists')
        .select('*, items:decider_items(*)')
        .eq('household_id', profile.household_id)
        .order('name');

      setLists(data || []);
      setLoading(false);
    }

    fetchLists();

    const channel = supabase
      .channel('decider-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'decider_lists' }, () => fetchLists())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'decider_items' }, () => fetchLists())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [profile?.household_id]);

  if (loading) {
    return <div style={styles.loading}><p>Loading...</p></div>;
  }

  // Spinner view
  if (selectedList) {
    return (
      <SpinnerView
        list={selectedList}
        profile={profile}
        onBack={() => setSelectedList(null)}
        onUpdate={(updated) => {
          setLists(lists.map(l => l.id === updated.id ? updated : l));
          setSelectedList(updated);
        }}
      />
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>The Decider</h1>
        <button onClick={() => setShowAddList(true)} style={styles.addBtn}>
          <Plus size={20} />
        </button>
      </div>

      <p style={styles.subtitle}>Can't decide? Let fate choose for you.</p>

      {lists.length > 0 ? (
        <div style={styles.listGrid}>
          {lists.map(list => (
            <button
              key={list.id}
              onClick={() => setSelectedList(list)}
              style={styles.listCard}
            >
              <span style={styles.listEmoji}>{list.emoji || '🎲'}</span>
              <span style={styles.listName}>{list.name}</span>
              <span style={styles.listCount}>
                {list.items?.length || 0} option{list.items?.length === 1 ? '' : 's'}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div style={styles.empty}>
          <p>No decision lists yet</p>
          <button onClick={() => setShowAddList(true)} style={styles.emptyBtn}>
            Create your first list
          </button>
        </div>
      )}

      {/* Suggestions */}
      {lists.length === 0 && (
        <div style={styles.suggestions}>
          <p style={styles.suggestionsTitle}>Quick start ideas:</p>
          <div style={styles.suggestionChips}>
            {[
              { name: 'What to Eat', emoji: '🍽️' },
              { name: 'Date Night', emoji: '💑' },
              { name: 'Movie Night', emoji: '🎬' },
              { name: 'Weekend Activity', emoji: '🎯' },
            ].map(s => (
              <button
                key={s.name}
                onClick={async () => {
                  await supabase.from('decider_lists').insert({
                    household_id: profile.household_id,
                    name: s.name,
                    emoji: s.emoji,
                  });
                }}
                style={styles.suggestionChip}
              >
                {s.emoji} {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add List Modal */}
      {showAddList && (
        <AddListModal
          profile={profile}
          onClose={() => setShowAddList(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SPINNER VIEW
// ─────────────────────────────────────────────────────────────
function SpinnerView({ list, profile, onBack, onUpdate }) {
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showRecipes, setShowRecipes] = useState(false);
  const [rotation, setRotation] = useState(0);
  const items = list.items || [];

  async function spin() {
    if (items.length === 0) return;

    setSpinning(true);
    setResult(null);

    // Spin animation
    const spins = 5 + Math.random() * 5; // 5-10 full rotations
    const finalRotation = rotation + (spins * 360);
    setRotation(finalRotation);

    // Pick random item
    const winner = items[Math.floor(Math.random() * items.length)];

    // Wait for animation
    setTimeout(() => {
      setResult(winner);
      setSpinning(false);
    }, 3000);
  }

  async function deleteItem(itemId) {
    await supabase.from('decider_items').delete().eq('id', itemId);
    onUpdate({
      ...list,
      items: items.filter(i => i.id !== itemId),
    });
  }

  async function deleteList() {
    if (!confirm('Delete this list and all its options?')) return;
    await supabase.from('decider_lists').delete().eq('id', list.id);
    onBack();
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.spinnerHeader}>
        <button onClick={onBack} style={styles.backBtn}>
          <ChevronLeft size={20} />
          <span>Back</span>
        </button>
        <button onClick={deleteList} style={styles.deleteListBtn}>
          <Trash2 size={18} />
        </button>
      </div>

      {/* Title */}
      <div style={styles.spinnerTitle}>
        <span style={styles.bigEmoji}>{list.emoji || '🎲'}</span>
        <h1 style={styles.listTitleBig}>{list.name}</h1>
      </div>

      {/* Spinner */}
      <div style={styles.spinnerArea}>
        {result ? (
          <div style={styles.resultBox}>
            <p style={styles.resultLabel}>The decision is...</p>
            <p style={styles.resultText}>{result.text}</p>
            <button onClick={() => { setResult(null); spin(); }} style={styles.spinAgainBtn}>
              <RotateCcw size={18} />
              Spin Again
            </button>
          </div>
        ) : (
          <div style={styles.wheelContainer}>
            <div
              style={{
                ...styles.wheel,
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? 'transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
              }}
            >
              <Shuffle size={60} />
            </div>
            <button
              onClick={spin}
              disabled={spinning || items.length === 0}
              style={{
                ...styles.spinBtn,
                opacity: spinning || items.length === 0 ? 0.5 : 1,
              }}
            >
              {spinning ? 'Spinning...' : 'SPIN'}
            </button>
          </div>
        )}
      </div>

      {/* Options list */}
      <div style={styles.optionsSection}>
        <div style={styles.optionsHeader}>
          <h3 style={styles.optionsTitle}>Options ({items.length})</h3>
          <div style={styles.optionsActions}>
            {(list.name.toLowerCase().includes('eat') ||
              list.name.toLowerCase().includes('food') ||
              list.name.toLowerCase().includes('dinner') ||
              list.name.toLowerCase().includes('lunch') ||
              list.name.toLowerCase().includes('recipe') ||
              ['🍽️', '🍴', '🍕', '🍔', '🌮', '🍜', '🍲', '🥘', '🍳'].includes(list.emoji)) && (
              <button onClick={() => setShowRecipes(true)} style={styles.addFromBtn}>
                <UtensilsCrossed size={16} />
                From Recipes
              </button>
            )}
            <button onClick={() => setShowAddItem(true)} style={styles.addItemBtn}>
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>

        {items.length > 0 ? (
          <div style={styles.optionsList}>
            {items.map(item => (
              <div key={item.id} style={styles.optionRow}>
                <span style={styles.optionText}>{item.text}</span>
                <button onClick={() => deleteItem(item.id)} style={styles.optionDelete}>
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={styles.noOptions}>Add some options to spin!</p>
        )}
      </div>

      {/* Add Item Modal */}
      {showAddItem && (
        <AddItemModal
          listId={list.id}
          onClose={() => setShowAddItem(false)}
          onAdded={(item) => {
            onUpdate({ ...list, items: [...items, item] });
            setShowAddItem(false);
          }}
        />
      )}

      {/* Recipe Picker */}
      {showRecipes && (
        <RecipePicker
          profile={profile}
          existingItems={items}
          onClose={() => setShowRecipes(false)}
          onAdd={async (recipes) => {
            const newItems = recipes.map(r => ({
              list_id: list.id,
              text: r.title,
              recipe_id: r.id,
            }));
            const { data } = await supabase.from('decider_items').insert(newItems).select();
            if (data) {
              onUpdate({ ...list, items: [...items, ...data] });
            }
            setShowRecipes(false);
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADD LIST MODAL
// ─────────────────────────────────────────────────────────────
function AddListModal({ profile, onClose }) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🎲');
  const [saving, setSaving] = useState(false);

  const emojis = ['🎲', '🍽️', '🎬', '💑', '🎯', '🎮', '🏃', '📚', '🎵', '✈️', '🛒', '🎁'];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    await supabase.from('decider_lists').insert({
      household_id: profile.household_id,
      name: name.trim(),
      emoji,
    });
    setSaving(false);
    onClose();
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <h3 style={styles.modalTitle}>New List</h3>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || saving}
            style={{ ...styles.saveBtn, opacity: name.trim() && !saving ? 1 : 0.5 }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div style={styles.modalBody}>
          <input
            type="text"
            placeholder="List name (e.g., What to Eat)"
            value={name}
            onChange={e => setName(e.target.value)}
            style={styles.input}
            autoFocus
          />

          <p style={styles.emojiLabel}>Choose an icon:</p>
          <div style={styles.emojiGrid}>
            {emojis.map(e => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                style={{
                  ...styles.emojiBtn,
                  background: emoji === e ? 'var(--m-gold)' : 'var(--surface)',
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADD ITEM MODAL
// ─────────────────────────────────────────────────────────────
function AddItemModal({ listId, onClose, onAdded }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;

    setSaving(true);
    const { data } = await supabase
      .from('decider_items')
      .insert({ list_id: listId, text: text.trim() })
      .select()
      .single();

    if (data) {
      onAdded(data);
    }
    setSaving(false);
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <h3 style={styles.modalTitle}>Add Option</h3>
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || saving}
            style={{ ...styles.saveBtn, opacity: text.trim() && !saving ? 1 : 0.5 }}
          >
            {saving ? 'Adding...' : 'Add'}
          </button>
        </div>

        <div style={styles.modalBody}>
          <input
            type="text"
            placeholder="Enter an option..."
            value={text}
            onChange={e => setText(e.target.value)}
            style={styles.input}
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RECIPE PICKER
// ─────────────────────────────────────────────────────────────
function RecipePicker({ profile, existingItems, onClose, onAdd }) {
  const [recipes, setRecipes] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);

  const existingRecipeIds = existingItems
    .filter(i => i.recipe_id)
    .map(i => i.recipe_id);

  useEffect(() => {
    async function fetchRecipes() {
      const { data } = await supabase
        .from('recipes')
        .select('id, title')
        .eq('household_id', profile.household_id)
        .order('title');

      // Filter out recipes already in the list
      const available = (data || []).filter(r => !existingRecipeIds.includes(r.id));
      setRecipes(available);
      setLoading(false);
    }
    fetchRecipes();
  }, [profile.household_id]);

  function toggleRecipe(recipe) {
    if (selected.find(r => r.id === recipe.id)) {
      setSelected(selected.filter(r => r.id !== recipe.id));
    } else {
      setSelected([...selected, recipe]);
    }
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <h3 style={styles.modalTitle}>Add from Recipes</h3>
          <button
            onClick={() => onAdd(selected)}
            disabled={selected.length === 0}
            style={{ ...styles.saveBtn, opacity: selected.length > 0 ? 1 : 0.5 }}
          >
            Add ({selected.length})
          </button>
        </div>

        <div style={styles.modalBody}>
          {loading ? (
            <p style={styles.loadingText}>Loading recipes...</p>
          ) : recipes.length > 0 ? (
            <div style={styles.recipeList}>
              {recipes.map(recipe => (
                <button
                  key={recipe.id}
                  onClick={() => toggleRecipe(recipe)}
                  style={{
                    ...styles.recipeRow,
                    background: selected.find(r => r.id === recipe.id)
                      ? 'var(--m-gold)'
                      : 'var(--surface)',
                  }}
                >
                  <span>{recipe.title}</span>
                  {selected.find(r => r.id === recipe.id) && (
                    <span style={styles.checkmark}>✓</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p style={styles.noRecipes}>
              {existingRecipeIds.length > 0
                ? 'All your recipes are already in this list!'
                : 'No recipes yet. Add some in the Recipes tab first.'}
            </p>
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
    marginBottom: 8,
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--text-dim)',
    marginBottom: 'var(--sp-4)',
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
  listGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 'var(--sp-2)',
  },
  listCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    padding: 'var(--sp-3)',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    cursor: 'pointer',
  },
  listEmoji: {
    fontSize: 32,
  },
  listName: {
    fontFamily: 'var(--font-display)',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
    textAlign: 'center',
  },
  listCount: {
    fontSize: 12,
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
  suggestions: {
    marginTop: 'var(--sp-4)',
  },
  suggestionsTitle: {
    fontSize: 13,
    color: 'var(--text-dim)',
    marginBottom: 'var(--sp-2)',
  },
  suggestionChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    padding: '8px 14px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    fontSize: 13,
    color: 'var(--text)',
    cursor: 'pointer',
  },

  // Spinner view
  spinnerHeader: {
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
  deleteListBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-dim)',
    cursor: 'pointer',
    padding: 4,
  },
  spinnerTitle: {
    textAlign: 'center',
    marginBottom: 'var(--sp-4)',
  },
  bigEmoji: {
    fontSize: 48,
    display: 'block',
    marginBottom: 8,
  },
  listTitleBig: {
    fontFamily: 'var(--font-display)',
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
  },
  spinnerArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    marginBottom: 'var(--sp-4)',
  },
  wheelContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--sp-3)',
  },
  wheel: {
    width: 120,
    height: 120,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--m-gold)',
    borderRadius: '50%',
    color: 'var(--text)',
  },
  spinBtn: {
    padding: '14px 48px',
    background: 'var(--m-gold)',
    border: 'none',
    borderRadius: 30,
    color: 'var(--text)',
    fontFamily: 'var(--font-display)',
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 2,
    cursor: 'pointer',
  },
  resultBox: {
    textAlign: 'center',
    padding: 'var(--sp-4)',
    background: 'var(--m-gold)',
    borderRadius: 16,
    width: '100%',
    maxWidth: 300,
  },
  resultLabel: {
    fontSize: 14,
    color: 'var(--text)',
    opacity: 0.8,
    marginBottom: 8,
  },
  resultText: {
    fontFamily: 'var(--font-display)',
    fontSize: 28,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 'var(--sp-3)',
  },
  spinAgainBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 20px',
    background: 'rgba(0,0,0,0.15)',
    border: 'none',
    borderRadius: 20,
    color: 'var(--text)',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  optionsSection: {
    background: 'var(--surface)',
    borderRadius: 12,
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  optionsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--sp-2) var(--sp-3)',
    borderBottom: '1px solid var(--border)',
  },
  optionsTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
  },
  optionsActions: {
    display: 'flex',
    gap: 8,
  },
  addFromBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 10px',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text-dim)',
    fontSize: 12,
    cursor: 'pointer',
  },
  addItemBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 10px',
    background: 'var(--m-gold)',
    border: 'none',
    borderRadius: 6,
    color: 'var(--text)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  optionsList: {
    maxHeight: 250,
    overflowY: 'auto',
  },
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--sp-2) var(--sp-3)',
    borderBottom: '1px solid var(--border)',
  },
  optionText: {
    fontSize: 14,
    color: 'var(--text)',
  },
  optionDelete: {
    background: 'none',
    border: 'none',
    color: 'var(--text-dim)',
    cursor: 'pointer',
    padding: 4,
  },
  noOptions: {
    padding: 'var(--sp-3)',
    textAlign: 'center',
    color: 'var(--text-dim)',
    fontSize: 14,
  },

  // Modals
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
    maxHeight: '80vh',
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
    paddingBottom: 'calc(var(--sp-3) + env(safe-area-inset-bottom))',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box',
  },
  emojiLabel: {
    fontSize: 13,
    color: 'var(--text-dim)',
    marginTop: 'var(--sp-3)',
    marginBottom: 'var(--sp-2)',
  },
  emojiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: 8,
  },
  emojiBtn: {
    aspectRatio: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border)',
    borderRadius: 8,
    fontSize: 20,
    cursor: 'pointer',
  },
  loadingText: {
    textAlign: 'center',
    color: 'var(--text-dim)',
  },
  recipeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  recipeRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    fontSize: 14,
    cursor: 'pointer',
    textAlign: 'left',
  },
  checkmark: {
    color: 'var(--text)',
    fontWeight: 700,
  },
  noRecipes: {
    textAlign: 'center',
    color: 'var(--text-dim)',
    padding: 'var(--sp-3)',
  },
};
