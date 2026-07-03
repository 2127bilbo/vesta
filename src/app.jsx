// SHELL ONLY — navigation + module mounting. No business logic lives here, ever.
import React, { useState } from 'react';
import { Home as HomeIcon, Calendar, ListChecks } from 'lucide-react';
import Home from './modules/home/index.jsx';

const TABS = [
  { id: 'home', label: 'Home', icon: HomeIcon, component: Home },
  { id: 'calendar', label: 'Calendar', icon: Calendar, component: null }, // Phase 6
  { id: 'lists', label: 'Lists', icon: ListChecks, component: null },     // Phase 6
  // Reserved slots: recipes, fund, decider — added as isolated modules post-v1
];

export default function App() {
  const [active, setActive] = useState('home');
  const tab = TABS.find(t => t.id === active);
  const Active = tab?.component;
  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 76 }}>
      {Active ? <Active /> : <p style={{ padding: 24 }}>Coming in build phase.</p>}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex',
        background: 'var(--surface)', borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActive(id)} style={{
            flex: 1, padding: '10px 0 8px', background: 'none', border: 'none',
            color: active === id ? 'var(--text)' : 'var(--text-dim)',
            fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700
          }}>
            <Icon size={22} strokeWidth={active === id ? 2.5 : 2} style={{ display: 'block', margin: '0 auto 2px' }} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
