// MODULE: lists — check-off lists with realtime sync. Isolated; imports only from shared/.
import { useState, useEffect } from 'react';
import { Plus, Check, Trash2, ShoppingCart, Home as HomeIcon } from 'lucide-react';
import { supabase } from '../../shared/supabase';
import { useAuth } from '../../shared/auth.jsx';

const DEFAULT_LISTS = [
  { name: 'Grocery', icon: 'shopping-cart' },
  { name: 'Home', icon: 'home' },
];

const ICONS = {
  'shopping-cart': ShoppingCart,
  'home': HomeIcon,
};

export default function Lists() {
  const { profile } = useAuth();
  const [lists, setLists] = useState([]);
  const [activeList, setActiveList] = useState(null);
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch lists
  useEffect(() => {
    if (!profile?.household_id) return;

    async function fetchLists() {
      const { data, error } = await supabase
        .from('lists')
        .select('*')
        .eq('household_id', profile.household_id)
        .order('sort_order');

      if (error) {
        console.error('Error fetching lists:', error);
        return;
      }

      // Create default lists if none exist
      if (data.length === 0) {
        await createDefaultLists();
      } else {
        setLists(data);
        if (!activeList && data.length > 0) {
          setActiveList(data[0]);
        }
      }
      setLoading(false);
    }

    fetchLists();
  }, [profile?.household_id]);

  // Fetch items when active list changes
  useEffect(() => {
    if (!activeList) return;

    async function fetchItems() {
      const { data, error } = await supabase
        .from('list_items')
        .select('*, checked_by_profile:profiles!list_items_checked_by_fkey(display_name, color)')
        .eq('list_id', activeList.id)
        .order('checked')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching items:', error);
        return;
      }
      setItems(data || []);
    }

    fetchItems();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`list_items:${activeList.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'list_items',
          filter: `list_id=eq.${activeList.id}`,
        },
        () => {
          fetchItems(); // Refetch on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeList?.id]);

  async function createDefaultLists() {
    const listsToCreate = DEFAULT_LISTS.map((list, i) => ({
      household_id: profile.household_id,
      name: list.name,
      icon: list.icon,
      sort_order: i,
    }));

    const { data, error } = await supabase
      .from('lists')
      .insert(listsToCreate)
      .select();

    if (error) {
      console.error('Error creating default lists:', error);
      return;
    }

    setLists(data);
    if (data.length > 0) {
      setActiveList(data[0]);
    }
  }

  async function addItem(e) {
    e.preventDefault();
    if (!newItem.trim() || !activeList) return;

    const tempId = `temp-${Date.now()}`;
    const newItemObj = {
      id: tempId,
      list_id: activeList.id,
      text: newItem.trim(),
      checked: false,
      added_by: profile.id,
      created_at: new Date().toISOString(),
    };

    // Optimistic update
    setItems(prev => [newItemObj, ...prev]);
    setNewItem('');

    const { data, error } = await supabase
      .from('list_items')
      .insert({
        list_id: activeList.id,
        text: newItemObj.text,
        added_by: profile.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding item:', error);
      // Remove optimistic item on error
      setItems(prev => prev.filter(i => i.id !== tempId));
      return;
    }

    // Replace temp item with real one
    setItems(prev => prev.map(i => i.id === tempId ? data : i));
  }

  async function toggleItem(item) {
    const newChecked = !item.checked;

    // Optimistic update
    setItems(prev => prev.map(i =>
      i.id === item.id
        ? {
            ...i,
            checked: newChecked,
            checked_by: newChecked ? profile.id : null,
            checked_at: newChecked ? new Date().toISOString() : null,
            checked_by_profile: newChecked
              ? { display_name: profile.display_name, color: profile.color }
              : null,
          }
        : i
    ));

    const { error } = await supabase
      .from('list_items')
      .update({
        checked: newChecked,
        checked_by: newChecked ? profile.id : null,
        checked_at: newChecked ? new Date().toISOString() : null,
      })
      .eq('id', item.id);

    if (error) {
      console.error('Error toggling item:', error);
    }
  }

  async function deleteItem(item) {
    // Optimistic update
    setItems(prev => prev.filter(i => i.id !== item.id));

    const { error } = await supabase
      .from('list_items')
      .delete()
      .eq('id', item.id);

    if (error) {
      console.error('Error deleting item:', error);
      // Revert on error
      setItems(prev => [...prev, item]);
    }
  }

  async function clearChecked() {
    // Optimistic update
    const checkedIds = items.filter(i => i.checked).map(i => i.id);
    setItems(prev => prev.filter(i => !i.checked));

    const { error } = await supabase
      .from('list_items')
      .delete()
      .eq('list_id', activeList.id)
      .eq('checked', true);

    if (error) {
      console.error('Error clearing checked items:', error);
      // Would need to refetch to revert properly
    }
  }

  if (loading) {
    return (
      <div style={styles.loading}>
        <p>Loading lists...</p>
      </div>
    );
  }

  const uncheckedItems = items.filter(i => !i.checked);
  const checkedItems = items.filter(i => i.checked);

  return (
    <div style={styles.container}>
      {/* List tabs */}
      <div style={styles.tabs}>
        {lists.map(list => {
          const Icon = ICONS[list.icon] || ShoppingCart;
          const isActive = activeList?.id === list.id;
          return (
            <button
              key={list.id}
              onClick={() => setActiveList(list)}
              style={{
                ...styles.tab,
                background: isActive ? 'var(--surface-2)' : 'transparent',
                color: isActive ? 'var(--text)' : 'var(--text-dim)',
              }}
            >
              <Icon size={16} />
              <span>{list.name}</span>
            </button>
          );
        })}
      </div>

      {/* Add item form */}
      <form onSubmit={addItem} style={styles.form}>
        <input
          type="text"
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          placeholder={`Add to ${activeList?.name || 'list'}...`}
          style={styles.input}
        />
        <button
          type="submit"
          disabled={!newItem.trim()}
          style={{
            ...styles.addButton,
            opacity: newItem.trim() ? 1 : 0.5,
          }}
          className="sheen"
        >
          <Plus size={20} />
        </button>
      </form>

      {/* Items */}
      <div style={styles.itemsContainer}>
        {uncheckedItems.length === 0 && checkedItems.length === 0 && (
          <p style={styles.empty}>No items yet. Add something above!</p>
        )}

        {uncheckedItems.map(item => (
          <ListItem
            key={item.id}
            item={item}
            onToggle={() => toggleItem(item)}
            onDelete={() => deleteItem(item)}
            userColor={profile?.color}
          />
        ))}

        {checkedItems.length > 0 && (
          <>
            <div style={styles.checkedHeader}>
              <span style={styles.checkedLabel}>
                Checked ({checkedItems.length})
              </span>
              <button onClick={clearChecked} style={styles.clearButton}>
                Clear all
              </button>
            </div>

            {checkedItems.map(item => (
              <ListItem
                key={item.id}
                item={item}
                onToggle={() => toggleItem(item)}
                onDelete={() => deleteItem(item)}
                userColor={profile?.color}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function ListItem({ item, onToggle, onDelete, userColor }) {
  const checkedByName = item.checked_by_profile?.display_name;
  const checkedByColor = item.checked_by_profile?.color || userColor;

  return (
    <div
      style={{
        ...styles.item,
        opacity: item.checked ? 0.6 : 1,
      }}
    >
      <button
        onClick={onToggle}
        style={{
          ...styles.checkbox,
          background: item.checked
            ? `var(--${checkedByColor || 'bob'})`
            : 'transparent',
          borderColor: item.checked
            ? `var(--${checkedByColor || 'bob'})`
            : 'var(--border)',
        }}
      >
        {item.checked && <Check size={14} color="var(--text)" />}
      </button>

      <div style={styles.itemContent}>
        <span
          style={{
            ...styles.itemText,
            textDecoration: item.checked ? 'line-through' : 'none',
          }}
        >
          {item.text}
        </span>
        {item.checked && checkedByName && (
          <span style={styles.checkedBy}>by {checkedByName}</span>
        )}
      </div>

      <button onClick={onDelete} style={styles.deleteButton}>
        <Trash2 size={16} />
      </button>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: 'var(--sp-3)',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-dim)',
  },
  tabs: {
    display: 'flex',
    gap: 'var(--sp-2)',
    marginBottom: 'var(--sp-3)',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    border: '1px solid var(--border)',
    borderRadius: 8,
    fontFamily: 'var(--font-body)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  form: {
    display: 'flex',
    gap: 'var(--sp-2)',
    marginBottom: 'var(--sp-3)',
  },
  input: {
    flex: 1,
    padding: '12px 14px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    outline: 'none',
  },
  addButton: {
    width: 48,
    height: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--m-gold)',
    border: 'none',
    borderRadius: 8,
    color: 'var(--text)',
    cursor: 'pointer',
  },
  itemsContainer: {
    flex: 1,
    overflowY: 'auto',
  },
  empty: {
    textAlign: 'center',
    color: 'var(--text-dim)',
    marginTop: 'var(--sp-4)',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-2)',
    padding: 'var(--sp-2) 0',
    borderBottom: '1px solid var(--border)',
  },
  checkbox: {
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid',
    borderRadius: 6,
    cursor: 'pointer',
    flexShrink: 0,
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
  },
  itemText: {
    fontSize: 15,
    color: 'var(--text)',
    display: 'block',
  },
  checkedBy: {
    fontSize: 11,
    color: 'var(--text-dim)',
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
    background: 'none',
    border: 'none',
    color: 'var(--text-dim)',
    cursor: 'pointer',
    opacity: 0.5,
  },
  checkedHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'var(--sp-3)',
    marginBottom: 'var(--sp-2)',
  },
  checkedLabel: {
    fontSize: 12,
    color: 'var(--text-dim)',
    fontWeight: 600,
  },
  clearButton: {
    padding: '4px 10px',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-body)',
    fontSize: 11,
    cursor: 'pointer',
  },
};
