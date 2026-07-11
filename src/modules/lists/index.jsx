// MODULE: lists — check-off lists with realtime sync. Isolated; imports only from shared/.
import { useState, useEffect } from 'react';
import { Plus, Check, Trash2, ShoppingCart, Home as HomeIcon, ListTodo, Briefcase, Heart, Star, X, MoreVertical, GripVertical } from 'lucide-react';
import { supabase } from '../../shared/supabase';
import { useAuth } from '../../shared/auth.jsx';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const DEFAULT_LISTS = [
  { name: 'Grocery', icon: 'shopping-cart' },
  { name: 'Home', icon: 'home' },
];

const ICONS = {
  'shopping-cart': ShoppingCart,
  'home': HomeIcon,
  'list': ListTodo,
  'work': Briefcase,
  'heart': Heart,
  'star': Star,
};

const ICON_OPTIONS = [
  { id: 'shopping-cart', icon: ShoppingCart, label: 'Shopping' },
  { id: 'home', icon: HomeIcon, label: 'Home' },
  { id: 'list', icon: ListTodo, label: 'Todo' },
  { id: 'work', icon: Briefcase, label: 'Work' },
  { id: 'heart', icon: Heart, label: 'Health' },
  { id: 'star', icon: Star, label: 'Important' },
];

export default function Lists() {
  const { profile } = useAuth();
  const [lists, setLists] = useState([]);
  const [activeList, setActiveList] = useState(null);
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddList, setShowAddList] = useState(false);
  const [showListMenu, setShowListMenu] = useState(false);

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
        .order('sort_order', { ascending: true });

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

    // Calculate sort_order for new item (put at top)
    const unchecked = items.filter(i => !i.checked);
    const minSortOrder = unchecked.length > 0
      ? Math.min(...unchecked.map(i => i.sort_order ?? 0))
      : 0;
    const newSortOrder = minSortOrder - 1;

    const tempId = `temp-${Date.now()}`;
    const newItemObj = {
      id: tempId,
      list_id: activeList.id,
      text: newItem.trim(),
      checked: false,
      added_by: profile.id,
      sort_order: newSortOrder,
      created_at: new Date().toISOString(),
    };

    // Optimistic update
    setItems(prev => [newItemObj, ...prev.filter(i => !i.checked), ...prev.filter(i => i.checked)]);
    setNewItem('');

    const { data, error } = await supabase
      .from('list_items')
      .insert({
        list_id: activeList.id,
        text: newItemObj.text,
        added_by: profile.id,
        sort_order: newSortOrder,
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

  async function createList(name, icon) {
    const { data, error } = await supabase
      .from('lists')
      .insert({
        household_id: profile.household_id,
        name: name.trim(),
        icon: icon,
        sort_order: lists.length,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating list:', error);
      return;
    }

    setLists(prev => [...prev, data]);
    setActiveList(data);
    setShowAddList(false);
  }

  async function deleteList(listToDelete) {
    if (lists.length <= 1) {
      alert("You need at least one list!");
      return;
    }

    // Delete all items in the list first
    await supabase
      .from('list_items')
      .delete()
      .eq('list_id', listToDelete.id);

    // Delete the list
    const { error } = await supabase
      .from('lists')
      .delete()
      .eq('id', listToDelete.id);

    if (error) {
      console.error('Error deleting list:', error);
      return;
    }

    const newLists = lists.filter(l => l.id !== listToDelete.id);
    setLists(newLists);

    // Switch to first list if we deleted the active one
    if (activeList?.id === listToDelete.id) {
      setActiveList(newLists[0] || null);
    }
    setShowListMenu(false);
  }

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const uncheckedItems = items.filter(i => !i.checked);
  const checkedItems = items.filter(i => i.checked);

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = uncheckedItems.findIndex(i => i.id === active.id);
    const newIndex = uncheckedItems.findIndex(i => i.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder the unchecked items
    const reorderedUnchecked = arrayMove(uncheckedItems, oldIndex, newIndex);

    // Update local state optimistically
    setItems([...reorderedUnchecked, ...checkedItems]);

    // Update sort_order in database
    const updates = reorderedUnchecked.map((item, index) => ({
      id: item.id,
      sort_order: index,
    }));

    // Batch update all sort_orders
    for (const update of updates) {
      const { error } = await supabase
        .from('list_items')
        .update({ sort_order: update.sort_order })
        .eq('id', update.id);

      if (error) {
        console.error('Error updating sort order:', error);
      }
    }
  }

  if (loading) {
    return (
      <div style={styles.loading}>
        <p>Loading lists...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* List tabs */}
      <div style={styles.tabsRow}>
        <div style={styles.tabs}>
          {lists.map(list => {
            const Icon = ICONS[list.icon] || ListTodo;
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
          <button
            onClick={() => setShowAddList(true)}
            style={styles.addListBtn}
          >
            <Plus size={16} />
          </button>
        </div>
        {activeList && (
          <button
            onClick={() => setShowListMenu(!showListMenu)}
            style={styles.menuBtn}
          >
            <MoreVertical size={18} />
          </button>
        )}
      </div>

      {/* List menu */}
      {showListMenu && activeList && (
        <div style={styles.listMenu}>
          <button
            onClick={() => deleteList(activeList)}
            style={styles.deleteListBtn}
          >
            <Trash2 size={14} />
            Delete "{activeList.name}"
          </button>
        </div>
      )}

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

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={uncheckedItems.map(i => i.id)}
            strategy={verticalListSortingStrategy}
          >
            {uncheckedItems.map(item => (
              <SortableListItem
                key={item.id}
                item={item}
                onToggle={() => toggleItem(item)}
                onDelete={() => deleteItem(item)}
                userColor={profile?.color}
              />
            ))}
          </SortableContext>
        </DndContext>

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

      {/* Add List Modal */}
      {showAddList && (
        <AddListModal
          onClose={() => setShowAddList(false)}
          onCreate={createList}
        />
      )}
    </div>
  );
}

function AddListModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('list');

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name, icon);
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <button onClick={onClose} style={styles.modalCancel}>Cancel</button>
          <h3 style={styles.modalTitle}>New List</h3>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            style={{
              ...styles.modalSave,
              opacity: name.trim() ? 1 : 0.5,
            }}
          >
            Create
          </button>
        </div>

        <div style={styles.modalBody}>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="List name"
            style={styles.modalInput}
            autoFocus
          />

          <p style={styles.iconLabel}>Icon</p>
          <div style={styles.iconGrid}>
            {ICON_OPTIONS.map(opt => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setIcon(opt.id)}
                  style={{
                    ...styles.iconOption,
                    background: icon === opt.id ? 'var(--gold)' : 'var(--surface-2)',
                    color: icon === opt.id ? 'var(--bg)' : 'var(--text)',
                  }}
                >
                  <Icon size={20} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SortableListItem({ item, onToggle, onDelete, userColor }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ListItem
        item={item}
        onToggle={onToggle}
        onDelete={onDelete}
        userColor={userColor}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function ListItem({ item, onToggle, onDelete, userColor, dragHandleProps }) {
  const checkedByName = item.checked_by_profile?.display_name;
  const checkedByColor = item.checked_by_profile?.color || userColor;

  return (
    <div
      style={{
        ...styles.item,
        opacity: item.checked ? 0.6 : 1,
      }}
    >
      {dragHandleProps && (
        <button {...dragHandleProps} style={styles.dragHandle}>
          <GripVertical size={16} />
        </button>
      )}

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
  tabsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 'var(--sp-3)',
  },
  tabs: {
    display: 'flex',
    gap: 'var(--sp-2)',
    flex: 1,
    overflowX: 'auto',
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
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  addListBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    border: '1px dashed var(--border)',
    borderRadius: 8,
    background: 'transparent',
    color: 'var(--text-dim)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  menuBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    background: 'none',
    border: 'none',
    color: 'var(--text-dim)',
    cursor: 'pointer',
  },
  listMenu: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 4,
    marginBottom: 'var(--sp-2)',
  },
  deleteListBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '10px 12px',
    background: 'none',
    border: 'none',
    borderRadius: 6,
    color: '#FF3B30',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    cursor: 'pointer',
    textAlign: 'left',
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
    background: 'var(--surface)',
  },
  dragHandle: {
    padding: 4,
    background: 'none',
    border: 'none',
    color: 'var(--text-dim)',
    cursor: 'grab',
    touchAction: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
    maxWidth: 400,
    background: 'var(--surface)',
    borderRadius: '16px 16px 0 0',
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
  modalCancel: {
    background: 'none',
    border: 'none',
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    cursor: 'pointer',
  },
  modalSave: {
    background: 'none',
    border: 'none',
    color: 'var(--gold)',
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  modalBody: {
    padding: 'var(--sp-3)',
    paddingBottom: 'calc(var(--sp-3) + env(safe-area-inset-bottom))',
  },
  modalInput: {
    width: '100%',
    padding: '14px 16px',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    color: 'var(--text)',
    fontFamily: 'var(--font-body)',
    fontSize: 17,
    outline: 'none',
    marginBottom: 'var(--sp-3)',
  },
  iconLabel: {
    fontSize: 14,
    color: 'var(--text-dim)',
    marginBottom: 'var(--sp-2)',
  },
  iconGrid: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  iconOption: {
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    border: 'none',
    cursor: 'pointer',
  },
};
