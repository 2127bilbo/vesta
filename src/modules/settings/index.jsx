// MODULE: settings — profile, household, sign out. Isolated; imports only from shared/.
import { useState, useEffect } from 'react';
import { User, Home, Copy, Check, LogOut, RefreshCw, ChevronLeft } from 'lucide-react';
import { supabase } from '../../shared/supabase';
import { useAuth } from '../../shared/auth.jsx';
import { signOut, createInvite } from '../../shared/auth.jsx';

export default function Settings({ onBack }) {
  const { profile, refreshProfile } = useAuth();
  const [household, setHousehold] = useState(null);
  const [inviteCode, setInviteCode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch household info
  useEffect(() => {
    if (!profile?.household_id) {
      setLoading(false);
      return;
    }

    async function fetchHousehold() {
      const { data, error } = await supabase
        .from('households')
        .select('*')
        .eq('id', profile.household_id)
        .single();

      if (!error && data) {
        setHousehold(data);
      }
      setLoading(false);
    }

    fetchHousehold();
  }, [profile?.household_id]);

  async function handleGenerateInvite() {
    const code = await createInvite();
    if (code) {
      setInviteCode(code);
    }
  }

  async function handleCopyCode() {
    if (inviteCode) {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleSignOut() {
    await signOut();
  }

  if (loading) {
    return (
      <div style={styles.loading}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        {onBack && (
          <button onClick={onBack} style={styles.backBtn}>
            <ChevronLeft size={20} />
            <span>Home</span>
          </button>
        )}
        <h1 style={styles.title}>Settings</h1>
      </div>

      {/* Profile Section */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>
          <User size={18} />
          Profile
        </h2>
        <ProfileEditor profile={profile} onUpdate={refreshProfile} />
      </section>

      {/* Household Section */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>
          <Home size={18} />
          Household
        </h2>
        <div style={styles.card}>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Name</span>
            <span style={styles.infoValue}>{household?.name || 'Home'}</span>
          </div>

          <div style={styles.divider} />

          <div style={styles.inviteSection}>
            <p style={styles.inviteText}>
              Invite someone to join your household
            </p>

            {inviteCode ? (
              <div style={styles.codeBox}>
                <span style={styles.code}>{inviteCode}</span>
                <button onClick={handleCopyCode} style={styles.copyBtn}>
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
            ) : (
              <button onClick={handleGenerateInvite} style={styles.generateBtn} className="sheen">
                <RefreshCw size={16} />
                Generate Invite Code
              </button>
            )}

            {inviteCode && (
              <p style={styles.codeHint}>
                Code expires in 7 days. Share it with your partner.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Sign Out */}
      <section style={styles.section}>
        <button onClick={handleSignOut} style={styles.signOutBtn}>
          <LogOut size={18} />
          Sign Out
        </button>
      </section>

      {/* App Info */}
      <footer style={styles.footer}>
        <p style={styles.footerText}>Vesta</p>
        <p style={styles.footerVersion}>v0.1.0</p>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PROFILE EDITOR
// ─────────────────────────────────────────────────────────────
function ProfileEditor({ profile, onUpdate }) {
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [color, setColor] = useState(profile?.color || 'bob');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const hasChanges = displayName !== profile?.display_name || color !== profile?.color;

  async function handleSave() {
    if (!hasChanges || saving) return;

    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        color: color,
      })
      .eq('id', profile.id);

    setSaving(false);

    if (error) {
      console.error('Error updating profile:', error);
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onUpdate?.();
  }

  return (
    <div style={styles.card}>
      {/* Display Name */}
      <div style={styles.fieldGroup}>
        <label style={styles.fieldLabel}>Display Name</label>
        <input
          type="text"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          style={styles.input}
          placeholder="Your name"
        />
      </div>

      {/* Color */}
      <div style={styles.fieldGroup}>
        <label style={styles.fieldLabel}>Your Color</label>
        <div style={styles.colorOptions}>
          <button
            onClick={() => setColor('bob')}
            style={{
              ...styles.colorOption,
              background: 'var(--m-bob)',
              border: color === 'bob' ? '3px solid var(--text)' : '3px solid transparent',
            }}
          >
            {color === 'bob' && <Check size={20} color="var(--text)" />}
          </button>
          <button
            onClick={() => setColor('chassidy')}
            style={{
              ...styles.colorOption,
              background: 'var(--m-chassidy)',
              border: color === 'chassidy' ? '3px solid var(--text)' : '3px solid transparent',
            }}
          >
            {color === 'chassidy' && <Check size={20} color="var(--text)" />}
          </button>
        </div>
      </div>

      {/* Save Button */}
      {hasChanges && (
        <button
          onClick={handleSave}
          disabled={saving || !displayName.trim()}
          style={{
            ...styles.saveBtn,
            opacity: saving || !displayName.trim() ? 0.5 : 1,
          }}
          className="sheen"
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      )}
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
    marginBottom: 'var(--sp-4)',
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
    marginBottom: 8,
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
  },
  section: {
    marginBottom: 'var(--sp-4)',
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
    letterSpacing: '0.5px',
  },
  card: {
    background: 'var(--surface)',
    borderRadius: 12,
    padding: 'var(--sp-3)',
    border: '1px solid var(--border)',
  },
  fieldGroup: {
    marginBottom: 'var(--sp-3)',
  },
  fieldLabel: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-dim)',
    marginBottom: 8,
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
  },
  colorOptions: {
    display: 'flex',
    gap: 'var(--sp-2)',
  },
  colorOption: {
    width: 56,
    height: 56,
    borderRadius: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
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
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 0',
  },
  infoLabel: {
    fontSize: 14,
    color: 'var(--text-dim)',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
  },
  divider: {
    height: 1,
    background: 'var(--border)',
    margin: 'var(--sp-2) 0',
  },
  inviteSection: {
    paddingTop: 'var(--sp-2)',
  },
  inviteText: {
    fontSize: 13,
    color: 'var(--text-dim)',
    marginBottom: 'var(--sp-2)',
  },
  generateBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
  codeBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'var(--surface-2)',
    borderRadius: 8,
    padding: '12px 16px',
    border: '1px solid var(--border)',
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--gold)',
    letterSpacing: '2px',
  },
  copyBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-dim)',
    cursor: 'pointer',
    padding: 4,
  },
  codeHint: {
    fontSize: 12,
    color: 'var(--text-dim)',
    marginTop: 'var(--sp-2)',
    textAlign: 'center',
  },
  signOutBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    padding: '14px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  footer: {
    textAlign: 'center',
    marginTop: 'var(--sp-5)',
    paddingTop: 'var(--sp-3)',
    borderTop: '1px solid var(--border)',
  },
  footerText: {
    fontFamily: 'var(--font-display)',
    fontStyle: 'italic',
    fontSize: 16,
    color: 'var(--text-dim)',
  },
  footerVersion: {
    fontSize: 11,
    color: 'var(--text-dim)',
    opacity: 0.6,
    marginTop: 4,
  },
};
