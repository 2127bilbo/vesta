// MODULE: home — today-at-a-glance dashboard. Isolated; imports only from shared/.
import { useAuth } from '../../shared/auth';

export default function Home() {
  const { profile } = useAuth();

  return (
    <div style={{ padding: 'var(--sp-3)' }}>
      {/* Header */}
      <header style={{ marginBottom: 'var(--sp-4)' }}>
        <p style={{
          fontSize: 13,
          color: 'var(--text-dim)',
          marginBottom: 4,
        }}>
          Good {getGreeting()}
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          fontWeight: 700,
          color: 'var(--text)',
        }}>
          {profile?.display_name || 'Friend'}
        </h1>
      </header>

      {/* Today's summary cards */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
        <SummaryCard
          title="Calendar"
          subtitle="No events today"
          color="var(--m-gold)"
          icon="calendar"
        />
        <SummaryCard
          title="Lists"
          subtitle="0 items to check off"
          color={profile?.color === 'chassidy' ? 'var(--m-chassidy)' : 'var(--m-bob)'}
          icon="list"
        />
      </section>

      {/* Household info */}
      <section style={{
        marginTop: 'var(--sp-4)',
        padding: 'var(--sp-3)',
        background: 'var(--surface)',
        borderRadius: 12,
        border: '1px solid var(--border)',
      }}>
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 14,
          color: 'var(--text-dim)',
          marginBottom: 'var(--sp-2)',
        }}>
          Household
        </h3>
        <p style={{ fontSize: 15, color: 'var(--text)' }}>
          {profile?.households?.name || 'Home'}
        </p>
      </section>
    </div>
  );
}

function SummaryCard({ title, subtitle, color, icon }) {
  return (
    <div
      className="sheen"
      style={{
        padding: 'var(--sp-3)',
        background: color,
        borderRadius: 12,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <h3 style={{
        fontFamily: 'var(--font-body)',
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--text)',
        opacity: 0.9,
        marginBottom: 4,
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: 15,
        color: 'var(--text)',
        fontWeight: 600,
      }}>
        {subtitle}
      </p>
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
