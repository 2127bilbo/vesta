// MODULE: home — today-at-a-glance dashboard. Isolated; imports only from shared/.
import { useState, useEffect } from 'react';
import { Calendar, ListChecks, Settings } from 'lucide-react';
import { supabase } from '../../shared/supabase';
import { useAuth } from '../../shared/auth.jsx';

export default function Home({ onOpenSettings, onNavigate }) {
  const { profile } = useAuth();
  const [todayEvents, setTodayEvents] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [listCounts, setListCounts] = useState([]); // [{name, count}]
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.household_id) return;

    async function fetchData() {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);

      // Fetch today's events
      const { data: todayData } = await supabase
        .from('events')
        .select('*, owner:profiles!events_owner_id_fkey(display_name, color)')
        .eq('household_id', profile.household_id)
        .gte('start_at', todayStart.toISOString())
        .lte('start_at', todayEnd.toISOString())
        .order('start_at')
        .limit(5);

      setTodayEvents(todayData || []);

      // Fetch upcoming events (next 7 days, excluding today)
      const { data: upcomingData } = await supabase
        .from('events')
        .select('*, owner:profiles!events_owner_id_fkey(display_name, color)')
        .eq('household_id', profile.household_id)
        .gt('start_at', todayEnd.toISOString())
        .lte('start_at', weekEnd.toISOString())
        .order('start_at')
        .limit(5);

      setUpcomingEvents(upcomingData || []);

      // Fetch unchecked list items count for each list (up to 3)
      const { data: lists } = await supabase
        .from('lists')
        .select('id, name')
        .eq('household_id', profile.household_id)
        .order('sort_order')
        .limit(3);

      if (lists && lists.length > 0) {
        const counts = [];
        for (const list of lists) {
          const { count } = await supabase
            .from('list_items')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', list.id)
            .eq('checked', false);
          counts.push({ name: list.name, count: count || 0 });
        }
        setListCounts(counts);
      }

      setLoading(false);
    }

    fetchData();

    // Subscribe to realtime changes
    const eventsChannel = supabase
      .channel('home-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => fetchData())
      .subscribe();

    const itemsChannel = supabase
      .channel('home-items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_items' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(itemsChannel);
    };
  }, [profile?.household_id]);

  if (loading) {
    return (
      <div style={styles.loading}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <p style={styles.greeting}>Good {getGreeting()}</p>
          <h1 style={styles.name}>{profile?.display_name || 'Friend'}</h1>
        </div>
        {onOpenSettings && (
          <button onClick={onOpenSettings} style={styles.settingsBtn}>
            <Settings size={22} />
          </button>
        )}
      </header>

      {/* Today's Events Card */}
      <button
        style={styles.card}
        onClick={() => onNavigate && onNavigate('calendar')}
      >
        <div style={styles.cardHeader}>
          <div style={styles.cardIcon}>
            <Calendar size={18} />
          </div>
          <h2 style={styles.cardTitle}>Today</h2>
        </div>

        {todayEvents.length > 0 ? (
          <div style={styles.eventsList}>
            {todayEvents.map(event => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <p style={styles.emptyText}>No events today</p>
        )}
      </button>

      {/* Lists Card */}
      <button
        style={{
          ...styles.card,
          background: profile?.color === 'chassidy' ? 'var(--m-chassidy)' : 'var(--m-bob)',
        }}
        onClick={() => onNavigate && onNavigate('lists')}
      >
        <div style={styles.cardHeader}>
          <div style={styles.cardIcon}>
            <ListChecks size={18} />
          </div>
          <h2 style={styles.cardTitle}>Lists</h2>
        </div>

        {listCounts.every(l => l.count === 0) ? (
          <p style={styles.listCount}>All caught up!</p>
        ) : (
          <div style={styles.listCounts}>
            {listCounts.filter(l => l.count > 0).map(l => (
              <span key={l.name} style={styles.listCountItem}>{l.name}: {l.count}</span>
            ))}
          </div>
        )}
      </button>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <section style={styles.upcomingSection}>
          <h3 style={styles.sectionTitle}>Coming Up</h3>
          <div style={styles.upcomingList}>
            {upcomingEvents.map(event => (
              <UpcomingEventRow key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      {/* Household */}
      <section style={styles.householdSection}>
        <h3 style={styles.sectionTitle}>Household</h3>
        <p style={styles.householdName}>{profile?.households?.name || 'Home'}</p>
      </section>
    </div>
  );
}

function EventRow({ event }) {
  const time = event.all_day
    ? 'All day'
    : new Date(event.start_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const color = event.color && event.color !== 'gold'
    ? getColorValue(event.color)
    : `var(--${event.owner?.color || 'gold'})`;

  return (
    <div style={styles.eventRow}>
      <div style={{ ...styles.eventDot, background: color }} />
      <span style={styles.eventTime}>{time}</span>
      <span style={styles.eventTitle}>{event.title}</span>
    </div>
  );
}

function UpcomingEventRow({ event }) {
  const date = new Date(event.start_at);
  const dayName = date.toLocaleDateString([], { weekday: 'short' });
  const time = event.all_day
    ? 'All day'
    : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const color = event.color && event.color !== 'gold'
    ? getColorValue(event.color)
    : `var(--${event.owner?.color || 'gold'})`;

  return (
    <div style={styles.upcomingRow}>
      <div style={{ ...styles.eventDot, background: color }} />
      <div style={styles.upcomingInfo}>
        <span style={styles.upcomingTitle}>{event.title}</span>
        <span style={styles.upcomingMeta}>{dayName} · {time}</span>
      </div>
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function getColorValue(colorId) {
  const colors = {
    gold: 'var(--gold)',
    blue: '#4A90D9',
    green: '#34C759',
    purple: '#AF52DE',
    orange: '#FF9500',
    red: '#FF3B30',
    teal: '#5AC8FA',
    pink: '#FF2D92',
  };
  return colors[colorId] || 'var(--gold)';
}

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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 'var(--sp-4)',
  },
  settingsBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-dim)',
    padding: 8,
    cursor: 'pointer',
  },
  greeting: {
    fontSize: 13,
    color: 'var(--text-dim)',
    marginBottom: 4,
  },
  name: {
    fontFamily: 'var(--font-display)',
    fontSize: 28,
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
  },
  card: {
    display: 'block',
    width: '100%',
    background: 'var(--m-gold)',
    borderRadius: 16,
    padding: 'var(--sp-3)',
    marginBottom: 'var(--sp-2)',
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 'var(--sp-2)',
  },
  cardIcon: {
    opacity: 0.8,
    color: 'var(--text)',
  },
  cardTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
    opacity: 0.9,
    margin: 0,
  },
  eventsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  eventRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  eventTime: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text)',
    opacity: 0.7,
    minWidth: 60,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  emptyText: {
    fontSize: 14,
    color: 'var(--text)',
    opacity: 0.7,
  },
  listCount: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
  },
  listCounts: {
    display: 'flex',
    gap: 16,
  },
  listCountItem: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text)',
  },
  upcomingSection: {
    marginTop: 'var(--sp-3)',
  },
  sectionTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-dim)',
    marginBottom: 'var(--sp-2)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  upcomingList: {
    background: 'var(--surface)',
    borderRadius: 12,
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  upcomingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 'var(--sp-2) var(--sp-3)',
    borderBottom: '1px solid var(--border)',
  },
  upcomingInfo: {
    flex: 1,
  },
  upcomingTitle: {
    display: 'block',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
  },
  upcomingMeta: {
    fontSize: 12,
    color: 'var(--text-dim)',
  },
  householdSection: {
    marginTop: 'var(--sp-4)',
    padding: 'var(--sp-3)',
    background: 'var(--surface)',
    borderRadius: 12,
    border: '1px solid var(--border)',
  },
  householdName: {
    fontSize: 15,
    color: 'var(--text)',
    margin: 0,
  },
};
