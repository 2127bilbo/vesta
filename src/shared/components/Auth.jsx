// Auth screens — login, signup, join household
import { useState } from 'react';
import { signIn, signUp, joinHouseholdByCode, createHousehold } from '../auth.jsx';

export default function Auth({ onSuccess }) {
  const [mode, setMode] = useState('login'); // login | signup | setup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signUp(email, password, { display_name: displayName });
      setMode('setup');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinHousehold(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await joinHouseholdByCode(inviteCode);
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateHousehold() {
    setError('');
    setLoading(true);
    try {
      await createHousehold('Home');
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.logo}>Vesta</h1>
        <p style={styles.tagline}>where all things come together</p>
      </div>

      <div style={styles.card}>
        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            <h2 style={styles.title}>Welcome back</h2>

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={styles.input}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={styles.input}
              required
            />

            {error && <p style={styles.error}>{error}</p>}

            <button type="submit" disabled={loading} style={styles.button} className="sheen">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <p style={styles.switch}>
              New here?{' '}
              <button type="button" onClick={() => { setMode('signup'); setError(''); }} style={styles.link}>
                Create account
              </button>
            </p>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignup}>
            <h2 style={styles.title}>Create account</h2>

            <input
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              style={styles.input}
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={styles.input}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={styles.input}
              minLength={6}
              required
            />

            {error && <p style={styles.error}>{error}</p>}

            <button type="submit" disabled={loading} style={styles.button} className="sheen">
              {loading ? 'Creating...' : 'Create Account'}
            </button>

            <p style={styles.switch}>
              Already have an account?{' '}
              <button type="button" onClick={() => { setMode('login'); setError(''); }} style={styles.link}>
                Sign in
              </button>
            </p>
          </form>
        )}

        {mode === 'setup' && (
          <div>
            <h2 style={styles.title}>Join a household</h2>
            <p style={styles.subtitle}>
              Enter an invite code from your partner, or start a new household.
            </p>

            <form onSubmit={handleJoinHousehold}>
              <input
                type="text"
                placeholder="Invite code (e.g. ab12cd34)"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value)}
                style={styles.input}
              />

              {error && <p style={styles.error}>{error}</p>}

              <button
                type="submit"
                disabled={loading || !inviteCode.trim()}
                style={{
                  ...styles.button,
                  opacity: inviteCode.trim() ? 1 : 0.5,
                }}
                className="sheen"
              >
                {loading ? 'Joining...' : 'Join Household'}
              </button>
            </form>

            <div style={styles.divider}>
              <span style={styles.dividerText}>or</span>
            </div>

            <button
              type="button"
              onClick={handleCreateHousehold}
              disabled={loading}
              style={styles.secondaryButton}
            >
              Start a new household
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--sp-3)',
    background: 'var(--bg)',
  },
  header: {
    textAlign: 'center',
    marginBottom: 'var(--sp-4)',
  },
  logo: {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(42px, 12vw, 64px)',
    fontWeight: 900,
    fontStyle: 'italic',
    background: 'var(--m-gold)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    margin: 0,
  },
  tagline: {
    fontFamily: 'var(--font-display)',
    fontStyle: 'italic',
    fontSize: 14,
    color: 'var(--text-dim)',
    marginTop: 4,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    background: 'var(--surface)',
    borderRadius: 12,
    padding: 'var(--sp-4)',
    border: '1px solid var(--border)',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 22,
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: 'var(--sp-3)',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: 'var(--text-dim)',
    marginBottom: 'var(--sp-3)',
    textAlign: 'center',
    lineHeight: 1.5,
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    marginBottom: 'var(--sp-2)',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    fontFamily: 'var(--font-body)',
    fontSize: 16,
    outline: 'none',
  },
  button: {
    width: '100%',
    padding: '14px',
    marginTop: 'var(--sp-2)',
    background: 'var(--m-gold)',
    border: 'none',
    borderRadius: 8,
    color: 'var(--text)',
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryButton: {
    width: '100%',
    padding: '14px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    cursor: 'pointer',
  },
  error: {
    color: 'var(--error)',
    fontSize: 13,
    marginTop: 'var(--sp-2)',
    textAlign: 'center',
  },
  switch: {
    marginTop: 'var(--sp-3)',
    fontSize: 13,
    color: 'var(--text-dim)',
    textAlign: 'center',
  },
  link: {
    background: 'none',
    border: 'none',
    color: 'var(--gold)',
    fontFamily: 'var(--font-body)',
    fontSize: 13,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    margin: 'var(--sp-3) 0',
  },
  dividerText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: 'var(--text-dim)',
    position: 'relative',
  },
};
