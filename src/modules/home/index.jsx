// MODULE: home — today-at-a-glance dashboard. Isolated; imports only from shared/.
import React from 'react';

export default function Home() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 34, fontStyle: 'italic' }}>Vesta</h1>
      <p style={{ color: 'var(--text-dim)', marginTop: 4 }}>where all things come together</p>
    </div>
  );
}
