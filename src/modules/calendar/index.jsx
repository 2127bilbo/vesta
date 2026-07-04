// MODULE: calendar — Cozi+AnyList hybrid: agenda, month grid, day hourly view.
// Isolated; imports only from shared/.
import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Clock, Trash2, Pencil, Calendar as CalIcon, List, LayoutGrid } from 'lucide-react';
import { supabase } from '../../shared/supabase';
import { useAuth } from '../../shared/auth.jsx';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Hours for day view (6 AM to 10 PM)
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);

// Event color categories (Cozi-style)
const EVENT_COLORS = [
  { id: 'gold', label: 'Default', color: 'var(--gold)' },
  { id: 'blue', label: 'Work', color: '#4A90D9' },
  { id: 'green', label: 'Health', color: '#34C759' },
  { id: 'purple', label: 'Personal', color: '#AF52DE' },
  { id: 'orange', label: 'Kids', color: '#FF9500' },
  { id: 'red', label: 'Important', color: '#FF3B30' },
  { id: 'teal', label: 'School', color: '#5AC8FA' },
  { id: 'pink', label: 'Social', color: '#FF2D92' },
];

function getEventColor(event) {
  // If event has a custom color, use it
  if (event.color && event.color !== 'gold') {
    const found = EVENT_COLORS.find(c => c.id === event.color);
    return found ? found.color : 'var(--gold)';
  }
  // Otherwise fall back to owner's color
  return `var(--${event.owner?.color || 'gold'})`;
}

export default function Calendar() {
  const { profile } = useAuth();
  const [view, setView] = useState('month'); // month | agenda | day
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [loading, setLoading] = useState(true);

  async function handleDeleteEvent(eventId) {
    await supabase.from('events').delete().eq('id', eventId);
    setDeleteConfirm(null);
  }

  async function handleDeleteSeries(groupId) {
    await supabase.from('events').delete().eq('recurrence_group_id', groupId);
    setDeleteConfirm(null);
  }

  function handleDeleteClick(event) {
    if (event.recurrence_group_id) {
      setDeleteConfirm(event);
    } else {
      handleDeleteEvent(event.id);
    }
  }

  // Fetch events for a wide range (current month +/- 1 month for smooth scrolling)
  useEffect(() => {
    if (!profile?.household_id) return;

    async function fetchEvents() {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0, 23, 59, 59);

      const { data, error } = await supabase
        .from('events')
        .select('*, owner:profiles!events_owner_id_fkey(display_name, color)')
        .eq('household_id', profile.household_id)
        .gte('start_at', start.toISOString())
        .lte('start_at', end.toISOString())
        .order('start_at');

      if (error) {
        console.error('Error fetching events:', error);
        return;
      }

      setEvents(data || []);
      setLoading(false);
    }

    fetchEvents();

    const channel = supabase
      .channel('events-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => fetchEvents())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [profile?.household_id, currentDate.getMonth(), currentDate.getFullYear()]);

  function handleDaySelect(date) {
    setSelectedDate(date);
    setView('day');
  }

  function navigateMonth(delta) {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1));
  }

  function goToToday() {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  }

  if (loading) {
    return (
      <div style={styles.loading}>
        <p>Loading calendar...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header with view toggle */}
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <h1 style={styles.title}>Calendar</h1>
          <ViewToggle view={view} setView={setView} />
        </div>

        {/* Month navigation - shown in month and agenda views */}
        {view !== 'day' && (
          <div style={styles.monthNav}>
            <button onClick={() => navigateMonth(-1)} style={styles.navBtn}>
              <ChevronLeft size={20} />
            </button>
            <button onClick={goToToday} style={styles.monthLabel}>
              {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </button>
            <button onClick={() => navigateMonth(1)} style={styles.navBtn}>
              <ChevronRight size={20} />
            </button>
          </div>
        )}

        {/* Day view header */}
        {view === 'day' && (
          <DayHeader
            date={selectedDate}
            onBack={() => setView('agenda')}
            onPrev={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - 1))}
            onNext={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1))}
          />
        )}
      </div>

      {/* Views */}
      {view === 'agenda' && (
        <AgendaView
          events={events}
          currentDate={currentDate}
          onDaySelect={handleDaySelect}
          onEditEvent={setEditingEvent}
          onDeleteEvent={handleDeleteClick}
        />
      )}

      {view === 'month' && (
        <MonthView
          events={events}
          currentDate={currentDate}
          selectedDate={selectedDate}
          onDaySelect={handleDaySelect}
        />
      )}

      {view === 'day' && (
        <DayView
          events={events}
          date={selectedDate}
          profile={profile}
          onEditEvent={setEditingEvent}
          onDeleteEvent={handleDeleteClick}
        />
      )}

      {/* Floating add button */}
      <button
        onClick={() => setShowAddModal(true)}
        style={styles.fab}
        className="sheen"
      >
        <Plus size={24} />
      </button>

      {/* Add event modal */}
      {showAddModal && (
        <AddEventModal
          date={selectedDate}
          profile={profile}
          onClose={() => setShowAddModal(false)}
          onSave={() => setShowAddModal(false)}
        />
      )}

      {/* Edit event modal */}
      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          profile={profile}
          onClose={() => setEditingEvent(null)}
          onSave={() => setEditingEvent(null)}
        />
      )}

      {/* Delete confirmation for recurring events */}
      {deleteConfirm && (
        <div style={styles.modalOverlay} onClick={() => setDeleteConfirm(null)}>
          <div style={styles.deleteModal} onClick={e => e.stopPropagation()}>
            <h3 style={styles.deleteModalTitle}>Delete Recurring Event</h3>
            <p style={styles.deleteModalText}>
              "{deleteConfirm.title}" is part of a recurring series.
            </p>
            <div style={styles.deleteModalButtons}>
              <button
                onClick={() => handleDeleteEvent(deleteConfirm.id)}
                style={styles.deleteModalBtn}
              >
                Delete This Only
              </button>
              <button
                onClick={() => handleDeleteSeries(deleteConfirm.recurrence_group_id)}
                style={styles.deleteModalBtnDanger}
              >
                Delete All in Series
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={styles.deleteModalBtnCancel}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// VIEW TOGGLE
// ─────────────────────────────────────────────────────────────
function ViewToggle({ view, setView }) {
  return (
    <div style={styles.viewToggle}>
      <button
        onClick={() => setView('agenda')}
        style={{
          ...styles.viewBtn,
          background: view === 'agenda' ? 'var(--surface-2)' : 'transparent',
          color: view === 'agenda' ? 'var(--text)' : 'var(--text-dim)',
        }}
      >
        <List size={16} />
      </button>
      <button
        onClick={() => setView('month')}
        style={{
          ...styles.viewBtn,
          background: view === 'month' ? 'var(--surface-2)' : 'transparent',
          color: view === 'month' ? 'var(--text)' : 'var(--text-dim)',
        }}
      >
        <LayoutGrid size={16} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DAY HEADER (for day view)
// ─────────────────────────────────────────────────────────────
function DayHeader({ date, onBack, onPrev, onNext }) {
  const isToday = isSameDay(date, new Date());
  const dayLabel = isToday ? 'Today' : DAYS_FULL[date.getDay()];

  return (
    <div style={styles.dayHeader}>
      <button onClick={onBack} style={styles.backBtn}>
        <ChevronLeft size={20} />
        <span>Back</span>
      </button>
      <div style={styles.dayHeaderCenter}>
        <button onClick={onPrev} style={styles.navBtn}>
          <ChevronLeft size={18} />
        </button>
        <div style={styles.dayHeaderText}>
          <span style={styles.dayHeaderDay}>{dayLabel}</span>
          <span style={styles.dayHeaderDate}>
            {MONTHS[date.getMonth()]} {date.getDate()}, {date.getFullYear()}
          </span>
        </div>
        <button onClick={onNext} style={styles.navBtn}>
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AGENDA VIEW - Scrolling list of days with events
// ─────────────────────────────────────────────────────────────
function AgendaView({ events, currentDate, onDaySelect, onEditEvent, onDeleteEvent }) {
  const today = new Date();

  // Generate days for current month
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) =>
    new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1)
  );

  function getEventsForDay(date) {
    return events.filter(e => isSameDay(new Date(e.start_at), date));
  }

  function getDayLabel(date) {
    if (isSameDay(date, today)) return 'Today';
    if (isSameDay(date, new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1))) return 'Tomorrow';
    return `${DAYS_FULL[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
  }

  return (
    <div style={styles.agendaContainer}>
      {days.map(date => {
        const dayEvents = getEventsForDay(date);
        const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());

        return (
          <div
            key={date.toISOString()}
            style={{
              ...styles.agendaDay,
              opacity: isPast ? 0.5 : 1,
            }}
          >
            <button
              onClick={() => onDaySelect(date)}
              style={styles.agendaDayHeader}
            >
              <div style={styles.agendaDayInfo}>
                <span style={{
                  ...styles.agendaDayNumber,
                  background: isSameDay(date, today) ? 'var(--gold)' : 'transparent',
                  color: isSameDay(date, today) ? 'var(--bg)' : 'var(--text)',
                }}>
                  {date.getDate()}
                </span>
                <span style={styles.agendaDayLabel}>{getDayLabel(date)}</span>
              </div>
              <ChevronRight size={16} color="var(--text-dim)" />
            </button>

            {dayEvents.length > 0 ? (
              <div style={styles.agendaEvents}>
                {dayEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    compact
                    onEdit={() => onEditEvent(event)}
                    onDelete={() => onDeleteEvent(event)}
                  />
                ))}
              </div>
            ) : (
              <div style={styles.noEvents}>No events</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MONTH VIEW - Calendar grid with event bars (Cozi-style)
// ─────────────────────────────────────────────────────────────
function MonthView({ events, currentDate, selectedDate, onDaySelect }) {
  const today = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  function getEventsForDay(day) {
    if (!day) return [];
    const date = new Date(year, month, day);
    return events.filter(e => isSameDay(new Date(e.start_at), date));
  }

  return (
    <div style={styles.monthContainer}>
      {/* Day labels */}
      <div style={styles.monthDayLabels}>
        {DAYS.map(day => (
          <div key={day} style={styles.monthDayLabel}>{day}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={styles.monthGrid}>
        {calendarDays.map((day, idx) => {
          const dayEvents = getEventsForDay(day);
          const date = day ? new Date(year, month, day) : null;
          const isToday = day && isSameDay(date, today);
          const isSelected = day && isSameDay(date, selectedDate);

          return (
            <button
              key={idx}
              onClick={() => day && onDaySelect(new Date(year, month, day))}
              disabled={!day}
              style={{
                ...styles.monthDay,
                ...(isToday ? styles.monthDayToday : {}),
                ...(isSelected ? styles.monthDaySelected : {}),
              }}
            >
              {day && (
                <>
                  <span style={styles.monthDayNumber}>{day}</span>
                  <div style={styles.monthEventBars}>
                    {dayEvents.slice(0, 3).map(event => (
                      <div
                        key={event.id}
                        style={{
                          ...styles.monthEventBar,
                          background: getEventColor(event),
                        }}
                      >
                        <span style={styles.monthEventBarText}>{event.title}</span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <span style={styles.monthMoreEvents}>+{dayEvents.length - 3} more</span>
                    )}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day events */}
      <div style={styles.monthSelectedEvents}>
        <h3 style={styles.monthSelectedTitle}>
          {selectedDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
        </h3>
        {getEventsForDay(selectedDate.getDate()).length > 0 ? (
          getEventsForDay(selectedDate.getDate()).map(event => (
            <EventCard key={event.id} event={event} />
          ))
        ) : (
          <p style={styles.noEventsText}>No events this day</p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DAY VIEW - Hourly timeline breakdown
// ─────────────────────────────────────────────────────────────
function DayView({ events, date, profile, onEditEvent, onDeleteEvent }) {
  const dayEvents = events.filter(e => isSameDay(new Date(e.start_at), date));
  const allDayEvents = dayEvents.filter(e => e.all_day);
  const timedEvents = dayEvents.filter(e => !e.all_day);

  // Position events on the timeline
  function getEventStyle(event) {
    const eventDate = new Date(event.start_at);
    const hours = eventDate.getHours();
    const minutes = eventDate.getMinutes();

    // Calculate top position (each hour = 60px)
    const startHour = 6; // Our timeline starts at 6 AM
    const top = (hours - startHour) * 60 + minutes;

    // Default duration 1 hour if no end time
    const duration = event.end_at
      ? (new Date(event.end_at) - eventDate) / (1000 * 60)
      : 60;

    return {
      top: Math.max(0, top),
      height: Math.max(30, duration),
    };
  }

  return (
    <div style={styles.dayContainer}>
      {/* All day events */}
      {allDayEvents.length > 0 && (
        <div style={styles.allDaySection}>
          <span style={styles.allDayLabel}>All Day</span>
          <div style={styles.allDayEvents}>
            {allDayEvents.map(event => (
              <div
                key={event.id}
                style={{
                  ...styles.allDayEvent,
                  borderLeftColor: getEventColor(event),
                }}
              >
                <span>{event.title}</span>
                <div style={styles.eventActions}>
                  <button onClick={() => onEditEvent(event)} style={styles.editBtn}>
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => onDeleteEvent(event)} style={styles.deleteBtn}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hourly timeline */}
      <div style={styles.timeline}>
        {HOURS.map(hour => (
          <div key={hour} style={styles.timeSlot}>
            <span style={styles.timeLabel}>
              {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
            </span>
            <div style={styles.timeSlotLine} />
          </div>
        ))}

        {/* Timed events positioned on timeline */}
        <div style={styles.eventsLayer}>
          {timedEvents.map(event => {
            const pos = getEventStyle(event);
            return (
              <div
                key={event.id}
                style={{
                  ...styles.timelineEvent,
                  top: pos.top,
                  height: pos.height,
                  borderLeftColor: getEventColor(event),
                }}
              >
                <div style={styles.timelineEventContent}>
                  <span style={styles.timelineEventTitle}>{event.title}</span>
                  <span style={styles.timelineEventTime}>
                    {new Date(event.start_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
                <div style={styles.eventActions}>
                  <button onClick={() => onEditEvent(event)} style={styles.editBtn}>
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => onDeleteEvent(event)} style={styles.deleteBtn}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EVENT CARD - Reusable event display
// ─────────────────────────────────────────────────────────────
function EventCard({ event, compact, onEdit, onDelete }) {
  const time = event.all_day
    ? 'All day'
    : new Date(event.start_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <div style={{
      ...styles.eventCard,
      padding: compact ? '8px 12px' : '12px 14px',
    }}>
      <div
        style={{
          ...styles.eventStripe,
          background: getEventColor(event),
        }}
      />
      <div style={styles.eventContent}>
        <span style={styles.eventTitle}>{event.title}</span>
        <div style={styles.eventMeta}>
          <span style={styles.eventTime}>{time}</span>
          {event.owner?.display_name && (
            <span style={styles.eventOwner}>· {event.owner.display_name}</span>
          )}
        </div>
      </div>
      {(onEdit || onDelete) && (
        <div style={styles.eventCardActions}>
          {onEdit && (
            <button onClick={onEdit} style={styles.eventCardBtn}>
              <Pencil size={14} />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} style={styles.eventCardBtn}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADD EVENT MODAL - iPhone-style with all options
// ─────────────────────────────────────────────────────────────
const REMINDER_OPTIONS = [
  { value: null, label: 'None' },
  { value: 0, label: 'At time of event' },
  { value: 5, label: '5 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
  { value: 2880, label: '2 days before' },
  { value: 10080, label: '1 week before' },
];

const REPEAT_OPTIONS = [
  { value: 'none', label: 'Never' },
  { value: 'daily', label: 'Every Day' },
  { value: 'weekdays', label: 'Weekdays (Mon-Fri)' },
  { value: 'weekly', label: 'Every Week' },
  { value: 'biweekly', label: 'Every 2 Weeks' },
  { value: 'monthly', label: 'Every Month' },
  { value: 'yearly', label: 'Every Year' },
];

// Generate dates for recurring events
function generateRecurringDates(startDate, recurrence, count = 90) {
  const dates = [];
  const start = new Date(startDate);

  for (let i = 0; i < count; i++) {
    let nextDate;

    switch (recurrence) {
      case 'daily':
        nextDate = new Date(start);
        nextDate.setDate(start.getDate() + i);
        dates.push(nextDate);
        break;

      case 'weekdays':
        nextDate = new Date(start);
        nextDate.setDate(start.getDate() + i);
        // Only add Mon-Fri (1-5)
        if (nextDate.getDay() >= 1 && nextDate.getDay() <= 5) {
          dates.push(nextDate);
        }
        break;

      case 'weekly':
        nextDate = new Date(start);
        nextDate.setDate(start.getDate() + (i * 7));
        dates.push(nextDate);
        break;

      case 'biweekly':
        nextDate = new Date(start);
        nextDate.setDate(start.getDate() + (i * 14));
        dates.push(nextDate);
        break;

      case 'monthly':
        nextDate = new Date(start);
        nextDate.setMonth(start.getMonth() + i);
        dates.push(nextDate);
        break;

      case 'yearly':
        nextDate = new Date(start);
        nextDate.setFullYear(start.getFullYear() + i);
        dates.push(nextDate);
        break;

      default:
        return [start];
    }
  }

  // For daily/weekdays, limit to ~3 months of events
  // For weekly, ~1 year. For monthly/yearly, keep the count.
  if (recurrence === 'daily' || recurrence === 'weekdays') {
    return dates.slice(0, 90);
  } else if (recurrence === 'weekly') {
    return dates.slice(0, 52);
  } else if (recurrence === 'biweekly') {
    return dates.slice(0, 26);
  } else if (recurrence === 'monthly') {
    return dates.slice(0, 12);
  } else if (recurrence === 'yearly') {
    return dates.slice(0, 5);
  }

  return dates;
}

function AddEventModal({ date, profile, onClose, onSave }) {
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(formatDateInput(date));
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [eventColor, setEventColor] = useState('gold'); // Default to gold (uses owner color)
  const [reminder, setReminder] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(30);
  const [repeat, setRepeat] = useState('none');
  const [saving, setSaving] = useState(false);

  // Auto-adjust end time when start time changes
  function handleStartTimeChange(newStart) {
    setStartTime(newStart);
    // Set end time to 1 hour after start
    const [h, m] = newStart.split(':').map(Number);
    const endH = (h + 1) % 24;
    setEndTime(`${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);

    const [year, month, day] = eventDate.split('-').map(Number);
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const baseStartAt = new Date(year, month - 1, day, startH, startM, 0, 0);

    // Calculate duration in milliseconds
    const baseEndAt = new Date(year, month - 1, day, endH, endM, 0, 0);
    if (baseEndAt <= baseStartAt) {
      baseEndAt.setDate(baseEndAt.getDate() + 1);
    }
    const duration = baseEndAt - baseStartAt;

    // Generate recurring dates or just use the single date
    const dates = repeat !== 'none'
      ? generateRecurringDates(baseStartAt, repeat)
      : [baseStartAt];

    // Generate a group ID for recurring events so we can delete them all at once
    const groupId = repeat !== 'none' ? crypto.randomUUID() : null;

    // Create event objects for all dates
    const eventsToInsert = dates.map(date => {
      const eventStart = new Date(date);
      eventStart.setHours(startH, startM, 0, 0);

      const eventEnd = new Date(eventStart.getTime() + duration);

      return {
        household_id: profile.household_id,
        owner_id: profile.id,
        title: title.trim(),
        start_at: eventStart.toISOString(),
        end_at: allDay ? null : eventEnd.toISOString(),
        all_day: allDay,
        color: eventColor,
        reminder_minutes: reminder ? reminderMinutes : null,
        recurrence: repeat,
        recurrence_group_id: groupId,
      };
    });

    const { error } = await supabase.from('events').insert(eventsToInsert);

    setSaving(false);

    if (error) {
      console.error('Error creating events:', error);
      return;
    }

    onSave();
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalLarge} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <h3 style={styles.modalTitle}>New Event</h3>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || saving}
            style={{
              ...styles.addBtn,
              opacity: title.trim() && !saving ? 1 : 0.5,
            }}
          >
            {saving ? 'Adding...' : 'Add'}
          </button>
        </div>

        <div style={styles.modalBody}>
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Event title"
            style={styles.inputLarge}
            autoFocus
          />

          {/* All Day Toggle */}
          <div style={styles.optionRow}>
            <span style={styles.optionLabel}>All-day</span>
            <label style={styles.toggle}>
              <input
                type="checkbox"
                checked={allDay}
                onChange={e => setAllDay(e.target.checked)}
                style={styles.toggleInput}
              />
              <span style={{
                ...styles.toggleSlider,
                background: allDay ? 'var(--gold)' : 'var(--border)',
              }}>
                <span style={{
                  ...styles.toggleKnob,
                  transform: allDay ? 'translateX(20px)' : 'translateX(0)',
                }} />
              </span>
            </label>
          </div>

          {/* Date */}
          <div style={styles.optionRow}>
            <span style={styles.optionLabel}>Date</span>
            <input
              type="date"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
              style={styles.optionInput}
            />
          </div>

          {/* Start Time */}
          {!allDay && (
            <div style={styles.optionRow}>
              <span style={styles.optionLabel}>Starts</span>
              <input
                type="time"
                value={startTime}
                onChange={e => handleStartTimeChange(e.target.value)}
                style={styles.optionInput}
              />
            </div>
          )}

          {/* End Time */}
          {!allDay && (
            <div style={styles.optionRow}>
              <span style={styles.optionLabel}>Ends</span>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                style={styles.optionInput}
              />
            </div>
          )}

          <div style={styles.divider} />

          {/* Color */}
          <div style={styles.optionRow}>
            <span style={styles.optionLabel}>Color</span>
          </div>
          <div style={styles.colorPicker}>
            {EVENT_COLORS.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setEventColor(c.id)}
                style={{
                  ...styles.colorOption,
                  background: c.color,
                  border: eventColor === c.id ? '3px solid var(--text)' : '3px solid transparent',
                }}
                title={c.label}
              />
            ))}
          </div>

          <div style={styles.divider} />

          {/* Repeat */}
          <div style={styles.optionRow}>
            <span style={styles.optionLabel}>Repeat</span>
            <select
              value={repeat}
              onChange={e => setRepeat(e.target.value)}
              style={styles.optionSelect}
            >
              {REPEAT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div style={styles.divider} />

          {/* Reminder Toggle */}
          <div style={styles.optionRow}>
            <span style={styles.optionLabel}>Reminder</span>
            <label style={styles.toggle}>
              <input
                type="checkbox"
                checked={reminder}
                onChange={e => setReminder(e.target.checked)}
                style={styles.toggleInput}
              />
              <span style={{
                ...styles.toggleSlider,
                background: reminder ? 'var(--gold)' : 'var(--border)',
              }}>
                <span style={{
                  ...styles.toggleKnob,
                  transform: reminder ? 'translateX(20px)' : 'translateX(0)',
                }} />
              </span>
            </label>
          </div>

          {/* Reminder Options */}
          {reminder && (
            <div style={styles.optionRow}>
              <span style={styles.optionLabel}>Alert</span>
              <select
                value={reminderMinutes}
                onChange={e => setReminderMinutes(Number(e.target.value))}
                style={styles.optionSelect}
              >
                {REMINDER_OPTIONS.filter(o => o.value !== null).map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EDIT EVENT MODAL
// ─────────────────────────────────────────────────────────────
function EditEventModal({ event, profile, onClose, onSave }) {
  const eventStart = new Date(event.start_at);
  const eventEnd = event.end_at ? new Date(event.end_at) : null;

  const [title, setTitle] = useState(event.title);
  const [eventDate, setEventDate] = useState(formatDateInput(eventStart));
  const [allDay, setAllDay] = useState(event.all_day || false);
  const [startTime, setStartTime] = useState(
    `${String(eventStart.getHours()).padStart(2, '0')}:${String(eventStart.getMinutes()).padStart(2, '0')}`
  );
  const [endTime, setEndTime] = useState(
    eventEnd
      ? `${String(eventEnd.getHours()).padStart(2, '0')}:${String(eventEnd.getMinutes()).padStart(2, '0')}`
      : `${String((eventStart.getHours() + 1) % 24).padStart(2, '0')}:${String(eventStart.getMinutes()).padStart(2, '0')}`
  );
  const [eventColor, setEventColor] = useState(event.color || 'gold');
  const [reminder, setReminder] = useState(event.reminder_minutes != null);
  const [reminderMinutes, setReminderMinutes] = useState(event.reminder_minutes || 30);
  const [repeat, setRepeat] = useState(event.recurrence || 'none');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);

    const [year, month, day] = eventDate.split('-').map(Number);
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const startAt = new Date(year, month - 1, day, startH, startM, 0, 0);
    const endAt = new Date(year, month - 1, day, endH, endM, 0, 0);

    if (endAt <= startAt) {
      endAt.setDate(endAt.getDate() + 1);
    }

    const { error } = await supabase
      .from('events')
      .update({
        title: title.trim(),
        start_at: startAt.toISOString(),
        end_at: allDay ? null : endAt.toISOString(),
        all_day: allDay,
        color: eventColor,
        reminder_minutes: reminder ? reminderMinutes : null,
        recurrence: repeat,
      })
      .eq('id', event.id);

    setSaving(false);

    if (error) {
      console.error('Error updating event:', error);
      return;
    }

    onSave();
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalLarge} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <h3 style={styles.modalTitle}>Edit Event</h3>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || saving}
            style={{
              ...styles.addBtn,
              opacity: title.trim() && !saving ? 1 : 0.5,
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div style={styles.modalBody}>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Event title"
            style={styles.inputLarge}
            autoFocus
          />

          <div style={styles.optionRow}>
            <span style={styles.optionLabel}>All-day</span>
            <label style={styles.toggle}>
              <input
                type="checkbox"
                checked={allDay}
                onChange={e => setAllDay(e.target.checked)}
                style={styles.toggleInput}
              />
              <span style={{
                ...styles.toggleSlider,
                background: allDay ? 'var(--gold)' : 'var(--border)',
              }}>
                <span style={{
                  ...styles.toggleKnob,
                  transform: allDay ? 'translateX(20px)' : 'translateX(0)',
                }} />
              </span>
            </label>
          </div>

          <div style={styles.optionRow}>
            <span style={styles.optionLabel}>Date</span>
            <input
              type="date"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
              style={styles.optionInput}
            />
          </div>

          {!allDay && (
            <>
              <div style={styles.optionRow}>
                <span style={styles.optionLabel}>Starts</span>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  style={styles.optionInput}
                />
              </div>
              <div style={styles.optionRow}>
                <span style={styles.optionLabel}>Ends</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  style={styles.optionInput}
                />
              </div>
            </>
          )}

          <div style={styles.divider} />

          <div style={styles.optionRow}>
            <span style={styles.optionLabel}>Color</span>
          </div>
          <div style={styles.colorPicker}>
            {EVENT_COLORS.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setEventColor(c.id)}
                style={{
                  ...styles.colorOption,
                  background: c.color,
                  border: eventColor === c.id ? '3px solid var(--text)' : '3px solid transparent',
                }}
                title={c.label}
              />
            ))}
          </div>

          <div style={styles.divider} />

          <div style={styles.optionRow}>
            <span style={styles.optionLabel}>Repeat</span>
            <select
              value={repeat}
              onChange={e => setRepeat(e.target.value)}
              style={styles.optionSelect}
            >
              {REPEAT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div style={styles.divider} />

          <div style={styles.optionRow}>
            <span style={styles.optionLabel}>Reminder</span>
            <label style={styles.toggle}>
              <input
                type="checkbox"
                checked={reminder}
                onChange={e => setReminder(e.target.checked)}
                style={styles.toggleInput}
              />
              <span style={{
                ...styles.toggleSlider,
                background: reminder ? 'var(--gold)' : 'var(--border)',
              }}>
                <span style={{
                  ...styles.toggleKnob,
                  transform: reminder ? 'translateX(20px)' : 'translateX(0)',
                }} />
              </span>
            </label>
          </div>

          {reminder && (
            <div style={styles.optionRow}>
              <span style={styles.optionLabel}>Alert</span>
              <select
                value={reminderMinutes}
                onChange={e => setReminderMinutes(Number(e.target.value))}
                style={styles.optionSelect}
              >
                {REMINDER_OPTIONS.filter(o => o.value !== null).map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100dvh - 76px)',
    background: 'var(--bg)',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-dim)',
  },

  // Header
  header: {
    padding: 'var(--sp-3)',
    paddingBottom: 0,
    background: 'var(--bg)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  headerTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 'var(--sp-2)',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
  },
  viewToggle: {
    display: 'flex',
    gap: 4,
    background: 'var(--surface)',
    borderRadius: 8,
    padding: 4,
  },
  viewBtn: {
    padding: '6px 12px',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  monthNav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--sp-2)',
    paddingBottom: 'var(--sp-2)',
  },
  navBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-dim)',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
  },
  monthLabel: {
    background: 'none',
    border: 'none',
    fontFamily: 'var(--font-display)',
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text)',
    cursor: 'pointer',
  },

  // Day header
  dayHeader: {
    display: 'flex',
    alignItems: 'center',
    paddingBottom: 'var(--sp-2)',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--gold)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 14,
    fontFamily: 'var(--font-body)',
  },
  dayHeaderCenter: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--sp-2)',
  },
  dayHeaderText: {
    textAlign: 'center',
  },
  dayHeaderDay: {
    display: 'block',
    fontFamily: 'var(--font-display)',
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--text)',
  },
  dayHeaderDate: {
    display: 'block',
    fontSize: 12,
    color: 'var(--text-dim)',
  },

  // Agenda view
  agendaContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--sp-3)',
    paddingTop: 'var(--sp-2)',
  },
  agendaDay: {
    marginBottom: 'var(--sp-3)',
  },
  agendaDayHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    background: 'none',
    border: 'none',
    padding: '8px 0',
    cursor: 'pointer',
    borderBottom: '1px solid var(--border)',
  },
  agendaDayInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-2)',
  },
  agendaDayNumber: {
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    fontWeight: 700,
    fontSize: 14,
  },
  agendaDayLabel: {
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
  },
  agendaEvents: {
    marginTop: 'var(--sp-2)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--sp-1)',
  },
  noEvents: {
    fontSize: 13,
    color: 'var(--text-dim)',
    padding: '8px 0',
    paddingLeft: 44,
  },

  // Month view
  monthContainer: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: 'var(--sp-3)',
    paddingTop: 0,
    width: '100%',
    boxSizing: 'border-box',
  },
  monthDayLabels: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    marginBottom: 'var(--sp-1)',
  },
  monthDayLabel: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-dim)',
    padding: '4px 0',
  },
  monthGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 2,
    width: '100%',
    overflow: 'hidden',
  },
  monthDay: {
    aspectRatio: '1',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 4,
    borderRadius: 8,
    background: 'var(--surface)',
    border: '2px solid transparent',
    cursor: 'pointer',
    overflow: 'hidden',
  },
  monthDayToday: {
    borderColor: 'var(--gold)',
  },
  monthDaySelected: {
    background: 'var(--surface-2)',
  },
  monthDayNumber: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: 2,
  },
  monthEventBars: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    width: '100%',
    overflow: 'hidden',
  },
  monthEventBar: {
    width: '100%',
    padding: '1px 3px',
    borderRadius: 2,
    overflow: 'hidden',
  },
  monthEventBarText: {
    fontSize: 8,
    fontWeight: 600,
    color: 'white',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'block',
    textShadow: '0 0 2px rgba(0,0,0,0.3)',
  },
  monthMoreEvents: {
    fontSize: 7,
    color: 'var(--text-dim)',
    textAlign: 'center',
    marginTop: 1,
  },
  monthSelectedEvents: {
    marginTop: 'var(--sp-3)',
    padding: 'var(--sp-2)',
    background: 'var(--surface)',
    borderRadius: 12,
  },
  monthSelectedTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 14,
    color: 'var(--text)',
    marginBottom: 'var(--sp-2)',
  },
  noEventsText: {
    fontSize: 13,
    color: 'var(--text-dim)',
  },

  // Day view
  dayContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--sp-3)',
  },
  allDaySection: {
    display: 'flex',
    gap: 'var(--sp-2)',
    marginBottom: 'var(--sp-3)',
    paddingBottom: 'var(--sp-2)',
    borderBottom: '1px solid var(--border)',
  },
  allDayLabel: {
    fontSize: 12,
    color: 'var(--text-dim)',
    width: 50,
    flexShrink: 0,
  },
  allDayEvents: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--sp-1)',
  },
  allDayEvent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    background: 'var(--surface)',
    borderRadius: 6,
    borderLeft: '4px solid',
    fontSize: 14,
    color: 'var(--text)',
  },
  timeline: {
    position: 'relative',
    minHeight: HOURS.length * 60,
  },
  timeSlot: {
    display: 'flex',
    height: 60,
    borderTop: '1px solid var(--border)',
  },
  timeLabel: {
    width: 50,
    fontSize: 11,
    color: 'var(--text-dim)',
    textAlign: 'right',
    paddingRight: 8,
    transform: 'translateY(-6px)',
  },
  timeSlotLine: {
    flex: 1,
  },
  eventsLayer: {
    position: 'absolute',
    top: 0,
    left: 58,
    right: 0,
  },
  timelineEvent: {
    position: 'absolute',
    left: 0,
    right: 0,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '6px 10px',
    background: 'var(--surface)',
    borderRadius: 6,
    borderLeft: '4px solid',
    marginBottom: 2,
  },
  timelineEventContent: {
    flex: 1,
  },
  timelineEventTitle: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text)',
  },
  timelineEventTime: {
    fontSize: 11,
    color: 'var(--text-dim)',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-dim)',
    cursor: 'pointer',
    padding: 4,
    opacity: 0.6,
  },
  editBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-dim)',
    cursor: 'pointer',
    padding: 4,
    opacity: 0.6,
  },
  eventActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },

  // Delete confirmation modal
  deleteModal: {
    width: '90%',
    maxWidth: 320,
    background: 'var(--surface)',
    borderRadius: 16,
    padding: 'var(--sp-3)',
    margin: 'auto',
  },
  deleteModalTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: 8,
    textAlign: 'center',
  },
  deleteModalText: {
    fontSize: 14,
    color: 'var(--text-dim)',
    textAlign: 'center',
    marginBottom: 'var(--sp-3)',
    lineHeight: 1.4,
  },
  deleteModalButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  deleteModalBtn: {
    padding: '12px',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  deleteModalBtnDanger: {
    padding: '12px',
    background: '#FF3B30',
    border: 'none',
    borderRadius: 8,
    color: 'white',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  deleteModalBtnCancel: {
    padding: '12px',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    cursor: 'pointer',
  },

  // Event card
  eventCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-2)',
    background: 'var(--surface)',
    borderRadius: 8,
  },
  eventStripe: {
    width: 4,
    height: '100%',
    minHeight: 36,
    borderRadius: 2,
    flexShrink: 0,
  },
  eventContent: {
    flex: 1,
    minWidth: 0,
  },
  eventTitle: {
    display: 'block',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  eventMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  eventTime: {
    fontSize: 12,
    color: 'var(--text-dim)',
  },
  eventOwner: {
    fontSize: 12,
    color: 'var(--text-dim)',
  },
  eventCardActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    marginLeft: 'auto',
  },
  eventCardBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-dim)',
    cursor: 'pointer',
    padding: 6,
    opacity: 0.6,
  },

  // FAB
  fab: {
    position: 'fixed',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: 'var(--m-gold)',
    border: 'none',
    color: 'var(--text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    zIndex: 50,
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
  modalLarge: {
    width: '100%',
    maxWidth: 400,
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
    padding: 0,
  },
  addBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--gold)',
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
  },
  modalBody: {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--sp-3)',
    paddingBottom: 'calc(var(--sp-3) + env(safe-area-inset-bottom))',
  },
  inputLarge: {
    width: '100%',
    padding: '14px 16px',
    marginBottom: 'var(--sp-3)',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    color: 'var(--text)',
    fontFamily: 'var(--font-body)',
    fontSize: 17,
    outline: 'none',
  },
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 0',
  },
  optionLabel: {
    fontSize: 15,
    color: 'var(--text)',
  },
  optionInput: {
    padding: '8px 12px',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    textAlign: 'right',
  },
  optionSelect: {
    padding: '8px 12px',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    minWidth: 140,
  },
  colorPicker: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 8,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 8,
    cursor: 'pointer',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    background: 'var(--border)',
    margin: '8px 0',
  },
  toggle: {
    position: 'relative',
    cursor: 'pointer',
  },
  toggleInput: {
    position: 'absolute',
    opacity: 0,
    width: 0,
    height: 0,
  },
  toggleSlider: {
    display: 'block',
    width: 44,
    height: 24,
    borderRadius: 12,
    transition: 'background 0.2s',
    position: 'relative',
  },
  toggleKnob: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: 'white',
    transition: 'transform 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
};
