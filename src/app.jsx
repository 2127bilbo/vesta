// SHELL ONLY — navigation + module mounting. No business logic lives here, ever.
// Vesta v1.0
import { useState } from 'react';
import { Home as HomeIcon, Calendar, ListChecks, UtensilsCrossed, Dices, Plane, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from './shared/auth.jsx';
import Auth from './shared/components/Auth.jsx';
import Home from './modules/home/index.jsx';
import Lists from './modules/lists/index.jsx';
import CalendarModule from './modules/calendar/index.jsx';
import Settings from './modules/settings/index.jsx';
import Recipes from './modules/recipes/index.jsx';
import Decider from './modules/decider/index.jsx';
import Vacation from './modules/vacation/index.jsx';

const TABS = [
  { id: 'home', label: 'Home', icon: HomeIcon, component: Home },
  { id: 'calendar', label: 'Calendar', icon: Calendar, component: CalendarModule },
  { id: 'lists', label: 'Lists', icon: ListChecks, component: Lists },
  { id: 'recipes', label: 'Recipes', icon: UtensilsCrossed, component: Recipes },
  { id: 'decider', label: 'Decider', icon: Dices, component: Decider },
  { id: 'vacation', label: 'Vacation', icon: Plane, component: Vacation },
];

function Loading() {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 28,
        fontStyle: 'italic',
        color: 'var(--text-dim)',
      }}>
        Vesta
      </div>
    </div>
  );
}

function NeedsHousehold() {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--sp-3)',
      textAlign: 'center',
    }}>
      <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 'var(--sp-2)' }}>
        No Household Yet
      </h2>
      <p style={{ color: 'var(--text-dim)', maxWidth: 280, lineHeight: 1.6 }}>
        Go to Settings to join a household with an invite code, or create a new one.
      </p>
    </div>
  );
}

export default function App() {
  const { session, profile, loading, refreshProfile } = useAuth();
  const [active, setActive] = useState('home');

  // Still loading auth state
  if (loading) {
    return <Loading />;
  }

  // Not logged in
  if (!session) {
    return <Auth onSuccess={refreshProfile} />;
  }

  // Logged in but no household
  const hasHousehold = profile?.household_id;

  const tab = TABS.find(t => t.id === active);
  const ActiveComponent = tab?.component;

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 76 }}>
      {!hasHousehold && active !== 'settings' ? (
        <NeedsHousehold />
      ) : active === 'settings' ? (
        <Settings onBack={() => setActive('home')} />
      ) : active === 'home' ? (
        <Home onOpenSettings={() => setActive('settings')} />
      ) : ActiveComponent ? (
        <ActiveComponent />
      ) : (
        <Placeholder tab={active} />
      )}

      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            style={{
              flex: 1,
              padding: '10px 0 8px',
              background: 'none',
              border: 'none',
              color: active === id ? 'var(--text)' : 'var(--text-dim)',
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Icon
              size={22}
              strokeWidth={active === id ? 2.5 : 2}
              style={{ display: 'block', margin: '0 auto 2px' }}
            />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Placeholder({ tab }) {
  return (
    <div style={{
      padding: 'var(--sp-4)',
      textAlign: 'center',
      color: 'var(--text-dim)',
    }}>
      <p style={{ marginTop: 100 }}>
        {tab.charAt(0).toUpperCase() + tab.slice(1)} — building next
      </p>
    </div>
  );
}
