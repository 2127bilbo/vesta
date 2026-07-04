// MODULE: vacation — vacation planning with ideas and optional funding. Isolated; imports only from shared/.
import { useState, useEffect } from 'react';
import { Plus, Plane, MapPin, DollarSign, Check, Trash2, ChevronRight, Star, X } from 'lucide-react';
import { supabase } from '../../shared/supabase';
import { useAuth } from '../../shared/auth.jsx';

export default function Vacation() {
  const { profile } = useAuth();
  const [ideas, setIdeas] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [showAddIdea, setShowAddIdea] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.household_id) return;

    async function fetchData() {
      // Fetch all vacation ideas
      const { data: ideasData } = await supabase
        .from('vacation_ideas')
        .select('*')
        .eq('household_id', profile.household_id)
        .order('created_at', { ascending: false });

      const allIdeas = ideasData || [];

      // Find the active trip (if any)
      const active = allIdeas.find(i => i.is_active);
      setActiveTrip(active || null);
      setIdeas(allIdeas.filter(i => !i.is_active));
      setLoading(false);
    }

    fetchData();

    const channel = supabase
      .channel('vacation-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vacation_ideas' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vacation_contributions' }, () => fetchData())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [profile?.household_id]);

  if (loading) {
    return <div style={styles.loading}><p>Loading...</p></div>;
  }

  // Viewing a specific idea
  if (selectedIdea) {
    return (
      <IdeaDetail
        idea={selectedIdea}
        profile={profile}
        onBack={() => setSelectedIdea(null)}
        onUpdate={(updated) => {
          if (updated.is_active) {
            setActiveTrip(updated);
            setIdeas(ideas.filter(i => i.id !== updated.id));
          } else {
            setIdeas(ideas.map(i => i.id === updated.id ? updated : i));
          }
          setSelectedIdea(updated);
        }}
        onDelete={() => {
          setIdeas(ideas.filter(i => i.id !== selectedIdea.id));
          setSelectedIdea(null);
        }}
      />
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Vacation</h1>
        <button onClick={() => setShowAddIdea(true)} style={styles.addBtn}>
          <Plus size={20} />
        </button>
      </div>

      {/* Active Trip */}
      {activeTrip && (
        <section style={styles.activeTripSection}>
          <button
            onClick={() => setSelectedIdea(activeTrip)}
            style={styles.activeTripCard}
            className="sheen"
          >
            <div style={styles.activeTripHeader}>
              <Plane size={20} />
              <span style={styles.activeTripLabel}>Current Goal</span>
            </div>
            <h2 style={styles.activeTripName}>{activeTrip.destination}</h2>
            {activeTrip.target_date && (
              <p style={styles.activeTripDate}>
                {new Date(activeTrip.target_date).toLocaleDateString([], {
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            )}
            {activeTrip.budget > 0 && (
              <FundingProgress
                current={activeTrip.saved_amount || 0}
                goal={activeTrip.budget}
              />
            )}
            <ChevronRight size={20} style={styles.activeTripArrow} />
          </button>
        </section>
      )}

      {/* Ideas List */}
      <section style={styles.ideasSection}>
        <h3 style={styles.sectionTitle}>
          {activeTrip ? 'Other Ideas' : 'Trip Ideas'}
        </h3>

        {ideas.length > 0 ? (
          <div style={styles.ideaList}>
            {ideas.map(idea => (
              <button
                key={idea.id}
                onClick={() => setSelectedIdea(idea)}
                style={styles.ideaCard}
              >
                <div style={styles.ideaInfo}>
                  <MapPin size={16} color="var(--gold)" />
                  <span style={styles.ideaName}>{idea.destination}</span>
                </div>
                {idea.notes && (
                  <p style={styles.ideaNotes}>{idea.notes}</p>
                )}
                <ChevronRight size={18} color="var(--text-dim)" />
              </button>
            ))}
          </div>
        ) : !activeTrip ? (
          <div style={styles.empty}>
            <Plane size={40} color="var(--text-dim)" />
            <p>No vacation ideas yet</p>
            <button onClick={() => setShowAddIdea(true)} style={styles.emptyBtn}>
              Add your first destination
            </button>
          </div>
        ) : (
          <p style={styles.noMoreIdeas}>
            Add more ideas for future trips!
          </p>
        )}
      </section>

      {/* Add Idea Modal */}
      {showAddIdea && (
        <AddIdeaModal
          profile={profile}
          onClose={() => setShowAddIdea(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FUNDING PROGRESS BAR
// ─────────────────────────────────────────────────────────────
function FundingProgress({ current, goal }) {
  const percent = Math.min((current / goal) * 100, 100);

  return (
    <div style={styles.fundingSection}>
      <div style={styles.fundingBar}>
        <div style={{ ...styles.fundingFill, width: `${percent}%` }} />
      </div>
      <div style={styles.fundingText}>
        <span>${current.toLocaleString()}</span>
        <span style={styles.fundingGoal}>/ ${goal.toLocaleString()}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// IDEA DETAIL VIEW
// ─────────────────────────────────────────────────────────────
function IdeaDetail({ idea, profile, onBack, onUpdate, onDelete }) {
  const [contributions, setContributions] = useState([]);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!idea.is_active || !idea.budget) return;

    async function fetchContributions() {
      const { data } = await supabase
        .from('vacation_contributions')
        .select('*, profile:profiles(display_name)')
        .eq('vacation_id', idea.id)
        .order('created_at', { ascending: false });

      setContributions(data || []);
    }

    fetchContributions();
  }, [idea.id, idea.is_active, idea.budget]);

  async function setAsActive() {
    // Deactivate any current active trip
    await supabase
      .from('vacation_ideas')
      .update({ is_active: false })
      .eq('household_id', profile.household_id)
      .eq('is_active', true);

    // Activate this one
    const { data } = await supabase
      .from('vacation_ideas')
      .update({ is_active: true })
      .eq('id', idea.id)
      .select()
      .single();

    if (data) onUpdate(data);
  }

  async function handleDelete() {
    if (!confirm('Delete this vacation idea?')) return;
    await supabase.from('vacation_ideas').delete().eq('id', idea.id);
    onDelete();
  }

  async function addContribution(amount, note) {
    const { data: contrib } = await supabase
      .from('vacation_contributions')
      .insert({
        vacation_id: idea.id,
        amount,
        note,
        contributed_by: profile.id,
      })
      .select('*, profile:profiles(display_name)')
      .single();

    if (contrib) {
      setContributions([contrib, ...contributions]);

      // Update saved amount
      const newSaved = (idea.saved_amount || 0) + amount;
      const { data: updated } = await supabase
        .from('vacation_ideas')
        .update({ saved_amount: newSaved })
        .eq('id', idea.id)
        .select()
        .single();

      if (updated) onUpdate(updated);
    }
  }

  const savedAmount = idea.saved_amount || 0;
  const hasBudget = idea.budget > 0;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.detailHeader}>
        <button onClick={onBack} style={styles.backBtn}>
          <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} />
          <span>Back</span>
        </button>
        <div style={styles.detailActions}>
          <button onClick={() => setEditing(true)} style={styles.iconBtn}>
            Edit
          </button>
          <button onClick={handleDelete} style={styles.iconBtn}>
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Destination */}
      <div style={styles.destinationHeader}>
        {idea.is_active && (
          <span style={styles.activeLabel}>
            <Star size={14} /> Current Goal
          </span>
        )}
        <h1 style={styles.destinationName}>{idea.destination}</h1>
        {idea.target_date && (
          <p style={styles.targetDate}>
            Target: {new Date(idea.target_date).toLocaleDateString([], {
              month: 'long',
              year: 'numeric'
            })}
          </p>
        )}
      </div>

      {/* Notes */}
      {idea.notes && (
        <div style={styles.notesBox}>
          <p style={styles.notesText}>{idea.notes}</p>
        </div>
      )}

      {/* Make Active Button */}
      {!idea.is_active && (
        <button onClick={setAsActive} style={styles.makeActiveBtn}>
          <Star size={18} />
          Set as Current Goal
        </button>
      )}

      {/* Budget & Funding */}
      {hasBudget && (
        <section style={styles.budgetSection}>
          <h3 style={styles.sectionTitle}>
            <DollarSign size={18} />
            Trip Fund
          </h3>

          <div style={styles.budgetCard}>
            <FundingProgress current={savedAmount} goal={idea.budget} />

            <div style={styles.budgetStats}>
              <div style={styles.budgetStat}>
                <span style={styles.budgetLabel}>Saved</span>
                <span style={styles.budgetValue}>${savedAmount.toLocaleString()}</span>
              </div>
              <div style={styles.budgetStat}>
                <span style={styles.budgetLabel}>Remaining</span>
                <span style={styles.budgetValue}>
                  ${Math.max(0, idea.budget - savedAmount).toLocaleString()}
                </span>
              </div>
              <div style={styles.budgetStat}>
                <span style={styles.budgetLabel}>Goal</span>
                <span style={styles.budgetValue}>${idea.budget.toLocaleString()}</span>
              </div>
            </div>

            {idea.is_active && (
              <button
                onClick={() => setShowAddFunds(true)}
                style={styles.addFundsBtn}
              >
                <Plus size={18} />
                Add Funds
              </button>
            )}
          </div>

          {/* Contribution History */}
          {contributions.length > 0 && (
            <div style={styles.contributionsList}>
              <h4 style={styles.contributionsTitle}>Recent Contributions</h4>
              {contributions.slice(0, 5).map(c => (
                <div key={c.id} style={styles.contributionRow}>
                  <div style={styles.contributionInfo}>
                    <span style={styles.contributionAmount}>
                      +${c.amount.toLocaleString()}
                    </span>
                    {c.note && (
                      <span style={styles.contributionNote}>{c.note}</span>
                    )}
                  </div>
                  <span style={styles.contributionMeta}>
                    {c.profile?.display_name} · {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* No budget yet */}
      {!hasBudget && idea.is_active && (
        <div style={styles.noBudgetBox}>
          <p>Want to track savings for this trip?</p>
          <button onClick={() => setEditing(true)} style={styles.addBudgetBtn}>
            Add a Budget
          </button>
        </div>
      )}

      {/* Add Funds Modal */}
      {showAddFunds && (
        <AddFundsModal
          onClose={() => setShowAddFunds(false)}
          onAdd={(amount, note) => {
            addContribution(amount, note);
            setShowAddFunds(false);
          }}
        />
      )}

      {/* Edit Modal */}
      {editing && (
        <EditIdeaModal
          idea={idea}
          onClose={() => setEditing(false)}
          onSave={(updated) => {
            onUpdate(updated);
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADD IDEA MODAL
// ─────────────────────────────────────────────────────────────
function AddIdeaModal({ profile, onClose }) {
  const [destination, setDestination] = useState('');
  const [notes, setNotes] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [budget, setBudget] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!destination.trim()) return;

    setSaving(true);
    setError('');

    const { error: insertError } = await supabase.from('vacation_ideas').insert({
      household_id: profile.household_id,
      destination: destination.trim(),
      notes: notes.trim() || null,
      target_date: targetDate || null,
      budget: budget ? parseFloat(budget) : null,
      saved_amount: 0,
    });

    setSaving(false);

    if (insertError) {
      console.error('Vacation save error:', insertError);
      setError(insertError.message);
      return;
    }

    onClose();
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <h3 style={styles.modalTitle}>New Trip Idea</h3>
          <button
            onClick={handleSubmit}
            disabled={!destination.trim() || saving}
            style={{ ...styles.saveBtn, opacity: destination.trim() && !saving ? 1 : 0.5 }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div style={styles.modalBody}>
          <input
            type="text"
            placeholder="Where to? (e.g., Hawaii, Paris)"
            value={destination}
            onChange={e => setDestination(e.target.value)}
            style={styles.input}
            autoFocus
          />

          <textarea
            placeholder="Notes, ideas, things to do... (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{ ...styles.input, minHeight: 80 }}
          />

          <input
            type="month"
            placeholder="Target date"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            style={styles.input}
          />

          <div style={styles.budgetInput}>
            <DollarSign size={18} color="var(--text-dim)" />
            <input
              type="number"
              placeholder="Estimated budget (optional)"
              value={budget}
              onChange={e => setBudget(e.target.value)}
              style={{ ...styles.input, paddingLeft: 36 }}
            />
          </div>

          {error && (
            <p style={{ color: '#FF3B30', fontSize: 13, marginTop: 8 }}>{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EDIT IDEA MODAL
// ─────────────────────────────────────────────────────────────
function EditIdeaModal({ idea, onClose, onSave }) {
  const [destination, setDestination] = useState(idea.destination);
  const [notes, setNotes] = useState(idea.notes || '');
  const [targetDate, setTargetDate] = useState(idea.target_date || '');
  const [budget, setBudget] = useState(idea.budget || '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!destination.trim()) return;

    setSaving(true);
    const { data } = await supabase
      .from('vacation_ideas')
      .update({
        destination: destination.trim(),
        notes: notes.trim() || null,
        target_date: targetDate || null,
        budget: budget ? parseFloat(budget) : null,
      })
      .eq('id', idea.id)
      .select()
      .single();

    if (data) onSave(data);
    setSaving(false);
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <h3 style={styles.modalTitle}>Edit Trip</h3>
          <button
            onClick={handleSubmit}
            disabled={!destination.trim() || saving}
            style={{ ...styles.saveBtn, opacity: destination.trim() && !saving ? 1 : 0.5 }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div style={styles.modalBody}>
          <input
            type="text"
            placeholder="Destination"
            value={destination}
            onChange={e => setDestination(e.target.value)}
            style={styles.input}
            autoFocus
          />

          <textarea
            placeholder="Notes (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{ ...styles.input, minHeight: 80 }}
          />

          <input
            type="month"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            style={styles.input}
          />

          <div style={styles.budgetInput}>
            <DollarSign size={18} color="var(--text-dim)" />
            <input
              type="number"
              placeholder="Budget"
              value={budget}
              onChange={e => setBudget(e.target.value)}
              style={{ ...styles.input, paddingLeft: 36 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADD FUNDS MODAL
// ─────────────────────────────────────────────────────────────
function AddFundsModal({ onClose, onAdd }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
    onAdd(parseFloat(amount), note.trim() || null);
  }

  const quickAmounts = [50, 100, 200, 500];

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <h3 style={styles.modalTitle}>Add Funds</h3>
          <button
            onClick={handleSubmit}
            disabled={!amount || parseFloat(amount) <= 0}
            style={{ ...styles.saveBtn, opacity: amount && parseFloat(amount) > 0 ? 1 : 0.5 }}
          >
            Add
          </button>
        </div>

        <div style={styles.modalBody}>
          <div style={styles.quickAmounts}>
            {quickAmounts.map(amt => (
              <button
                key={amt}
                onClick={() => setAmount(amt.toString())}
                style={{
                  ...styles.quickAmountBtn,
                  background: parseFloat(amount) === amt ? 'var(--m-gold)' : 'var(--surface)',
                }}
              >
                ${amt}
              </button>
            ))}
          </div>

          <div style={styles.budgetInput}>
            <DollarSign size={18} color="var(--text-dim)" />
            <input
              type="number"
              placeholder="Amount"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ ...styles.input, paddingLeft: 36 }}
              autoFocus
            />
          </div>

          <input
            type="text"
            placeholder="Note (optional, e.g., 'Birthday money')"
            value={note}
            onChange={e => setNote(e.target.value)}
            style={styles.input}
          />
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

  // Active trip
  activeTripSection: {
    marginBottom: 'var(--sp-4)',
  },
  activeTripCard: {
    width: '100%',
    padding: 'var(--sp-3)',
    background: 'var(--m-gold)',
    border: 'none',
    borderRadius: 16,
    textAlign: 'left',
    cursor: 'pointer',
    position: 'relative',
  },
  activeTripHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    color: 'var(--text)',
    opacity: 0.8,
  },
  activeTripLabel: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeTripName: {
    fontFamily: 'var(--font-display)',
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
    marginBottom: 4,
  },
  activeTripDate: {
    fontSize: 14,
    color: 'var(--text)',
    opacity: 0.8,
    marginBottom: 'var(--sp-2)',
  },
  activeTripArrow: {
    position: 'absolute',
    top: '50%',
    right: 16,
    transform: 'translateY(-50%)',
    color: 'var(--text)',
    opacity: 0.5,
  },

  // Funding progress
  fundingSection: {
    marginTop: 'var(--sp-2)',
  },
  fundingBar: {
    height: 8,
    background: 'rgba(0,0,0,0.15)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  fundingFill: {
    height: '100%',
    background: 'var(--text)',
    borderRadius: 4,
    transition: 'width 0.3s ease',
  },
  fundingText: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
  },
  fundingGoal: {
    opacity: 0.6,
  },

  // Ideas section
  ideasSection: {
    marginTop: 'var(--sp-2)',
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'var(--font-display)',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-dim)',
    marginBottom: 'var(--sp-2)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ideaList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  ideaCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: 'var(--sp-3)',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    textAlign: 'left',
    cursor: 'pointer',
  },
  ideaInfo: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  ideaName: {
    fontFamily: 'var(--font-display)',
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text)',
  },
  ideaNotes: {
    fontSize: 12,
    color: 'var(--text-dim)',
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 120,
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
  noMoreIdeas: {
    textAlign: 'center',
    color: 'var(--text-dim)',
    fontSize: 14,
    padding: 'var(--sp-3)',
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
    gap: 12,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    cursor: 'pointer',
    padding: 4,
  },
  destinationHeader: {
    marginBottom: 'var(--sp-3)',
  },
  activeLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    background: 'var(--m-gold)',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: 8,
  },
  destinationName: {
    fontFamily: 'var(--font-display)',
    fontSize: 28,
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
  },
  targetDate: {
    fontSize: 14,
    color: 'var(--text-dim)',
    marginTop: 4,
  },
  notesBox: {
    padding: 'var(--sp-3)',
    background: 'var(--surface)',
    borderRadius: 12,
    marginBottom: 'var(--sp-3)',
  },
  notesText: {
    fontSize: 14,
    color: 'var(--text)',
    lineHeight: 1.6,
    margin: 0,
  },
  makeActiveBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    padding: '14px',
    background: 'var(--m-gold)',
    border: 'none',
    borderRadius: 10,
    color: 'var(--text)',
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: 'var(--sp-3)',
  },

  // Budget section
  budgetSection: {
    marginTop: 'var(--sp-2)',
  },
  budgetCard: {
    padding: 'var(--sp-3)',
    background: 'var(--surface)',
    borderRadius: 12,
    border: '1px solid var(--border)',
  },
  budgetStats: {
    display: 'flex',
    gap: 'var(--sp-2)',
    marginTop: 'var(--sp-3)',
    marginBottom: 'var(--sp-3)',
  },
  budgetStat: {
    flex: 1,
    textAlign: 'center',
  },
  budgetLabel: {
    display: 'block',
    fontSize: 11,
    color: 'var(--text-dim)',
    marginBottom: 4,
  },
  budgetValue: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text)',
  },
  addFundsBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    padding: '12px',
    background: 'var(--m-gold)',
    border: 'none',
    borderRadius: 8,
    color: 'var(--text)',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  contributionsList: {
    marginTop: 'var(--sp-3)',
    paddingTop: 'var(--sp-3)',
    borderTop: '1px solid var(--border)',
  },
  contributionsTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-dim)',
    marginBottom: 'var(--sp-2)',
  },
  contributionRow: {
    padding: '10px 0',
    borderBottom: '1px solid var(--border)',
  },
  contributionInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  contributionAmount: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--green, #34C759)',
  },
  contributionNote: {
    fontSize: 13,
    color: 'var(--text)',
  },
  contributionMeta: {
    fontSize: 12,
    color: 'var(--text-dim)',
  },
  noBudgetBox: {
    textAlign: 'center',
    padding: 'var(--sp-4)',
    background: 'var(--surface)',
    borderRadius: 12,
    color: 'var(--text-dim)',
  },
  addBudgetBtn: {
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
    maxHeight: '85vh',
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
  budgetInput: {
    position: 'relative',
  },
  quickAmounts: {
    display: 'flex',
    gap: 8,
    marginBottom: 'var(--sp-2)',
  },
  quickAmountBtn: {
    flex: 1,
    padding: '10px',
    border: '1px solid var(--border)',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
    cursor: 'pointer',
  },
};
