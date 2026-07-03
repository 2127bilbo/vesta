# HANDOFF — Vesta
**Last updated:** 2026-07-03
**Updated by:** Claude — Session 4: Phase 3 Architecture (schema + module map + notifications)
**Project type:** Web (PWA, mobile-first, multi-household)

---

## CURRENT STATE
**Phase:** 3 in progress (Architecture)
**Current focus:** Schema applied to Supabase; module map + notification architecture next

---

## COMPLETED THIS SESSION
- Git initialized, initial commit made (8795788)
- Supabase project created with RLS enabled
- `.env` configured with project URL + anon key
- Full v1 schema applied: households, profiles, events, lists, list_items, invites
- Auto-profile trigger on user signup
- Realtime enabled on events, lists, list_items
- Invite system added for self-service household joining

## PRIOR SESSIONS
- S3: Phase 1 signed off, Supabase decision, Phase 2 skeleton generated
- S2: Identity locked — Vesta, metallic palette, fonts, icon pack
- S1: Concept, scope, name brainstorm

---

## NEXT STEPS — THIS SESSION
1. ~~Design Supabase schema~~ DONE
2. Document module map + dependency map — IN PROGRESS
3. Decide notification architecture
4. Create user accounts + household in Supabase
5. Update CLAUDE.md with Phase 3 changes

---

## BLOCKED / PENDING DECISIONS
- [x] ~~Supabase project not yet created~~ DONE
- [ ] vestaAIO.com not yet registered (Bob: Cloudflare Registrar)
- [ ] Deployment target (Vercel vs Cloudflare Pages) — decide Phase 9, leaning Vercel
- [ ] Logo re-prompt to Grok — optional polish

---

## KNOWN BUGS / TECH DEBT
| ID | Description | Priority | Module | Notes |
|----|-------------|----------|--------|-------|
| TD-001 | Inline styles in app.jsx shell | Low | shell | Move to CSS in Phase 6 |

---

## MASTER CHECKLIST STATUS
- [x] Phase 0 — Session Protocol
- [x] Phase 1 — Identity (SIGNED OFF 2026-07-03 — do not change)
- [x] Phase 2 — Project Setup
- [ ] Phase 3 — Architecture (IN PROGRESS)
- [ ] Phase 4 — Design
- [ ] Phase 5 — Security
- [ ] Phase 6 — Build
- [ ] Phase 7 — Module Documentation
- [ ] Phase 8 — Testing
- [ ] Phase 9 — Release

---

## MODULE MAP

### Shell Layer
| File | Responsibility | Depends On |
|------|----------------|------------|
| `src/main.jsx` | Entry point, mounts App | React, app.jsx |
| `src/app.jsx` | Tab nav shell, route switching | shared/, modules/*/index.jsx |

### Shared Layer (src/shared/)
| File | Responsibility | Used By |
|------|----------------|---------|
| `supabase.js` | Supabase client singleton | All modules |
| `auth.js` | signIn, signUp, signOut, useSession hook | All modules |
| `notify.js` | Push subscription, send helpers | calendar, lists |
| `components/` | Reusable UI (Button, Card, Modal, etc.) | All modules |
| `hooks/` | Custom React hooks | All modules |

### Feature Modules (src/modules/)
| Module | Responsibility | Phase | Tables Used |
|--------|----------------|-------|-------------|
| `home/` | Dashboard: today's events, list summary, quick actions | v1 | events, lists, list_items |
| `calendar/` | Monthly/weekly view, event CRUD, reminders | v1 | events |
| `lists/` | Grocery/Home lists, check-off, realtime sync | v1 | lists, list_items |
| `settings/` | Profile, household, invite partner, notifications | v1 | profiles, households, invites |
| `recipes/` | Recipe storage, cook mode, add to grocery | post-v1 | recipes (future) |
| `fund/` | Vacation fund tracker, contributions | post-v1 | fund_transactions (future) |
| `decider/` | The Decider port | post-v1 | decisions (future) |

### Styles Layer
| File | Responsibility | Notes |
|------|----------------|-------|
| `tokens.css` | Design tokens (colors, fonts, spacing) | LOCKED — do not edit without Decision Log entry |
| `base.css` | Reset, metallic sheen system, utilities | |

---

## DEPENDENCY MAP

```
                    ┌─────────────┐
                    │   main.jsx  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   app.jsx   │ (shell)
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌─────────┐       ┌──────────┐       ┌──────────┐
   │  home/  │       │ calendar/│       │  lists/  │  ... other modules
   └────┬────┘       └────┬─────┘       └────┬─────┘
        │                 │                  │
        └─────────────────┼──────────────────┘
                          │
                   ┌──────▼──────┐
                   │   shared/   │
                   │ supabase.js │
                   │   auth.js   │
                   │  notify.js  │
                   │ components/ │
                   └─────────────┘
                          │
                   ┌──────▼──────┐
                   │  Supabase   │
                   │  (cloud)    │
                   └─────────────┘
```

**Isolation Rule:** Modules import from `shared/` ONLY, never from each other.

---

## NOTIFICATION ARCHITECTURE

### Decision: Web Push via Supabase Edge Functions

**Two notification types:**

1. **Activity Notifications** ("Chassidy bought milk")
   - Trigger: Realtime subscription detects `list_items` update with `checked = true`
   - If app is open: in-app toast
   - If app is closed: Edge Function sends Web Push to partner's device

2. **Reminder Notifications** ("Dentist tomorrow at 5:15")
   - Trigger: pg_cron job runs every minute, queries events where `reminder_minutes` matches
   - Edge Function sends Web Push to all household members

**Implementation (Phase 6):**
- `src/shared/notify.js` — registers service worker, subscribes to push, stores subscription in `push_subscriptions` table
- Edge Function `send-push` — receives payload, sends via Web Push API
- Edge Function `check-reminders` — cron-triggered, queries upcoming reminders

**Why this approach:**
- Native to Supabase, no third-party (OneSignal, FCM)
- Free tier covers our scale
- Can upgrade to FCM later if deliverability becomes an issue

---

## DATABASE SCHEMA (v1)

```
households
  id UUID PK
  name TEXT
  created_at TIMESTAMPTZ

profiles
  id UUID PK (refs auth.users)
  household_id UUID FK
  display_name TEXT
  color TEXT (bob | chassidy)
  created_at TIMESTAMPTZ

events
  id UUID PK
  household_id UUID FK
  owner_id UUID FK
  title TEXT
  description TEXT
  start_at TIMESTAMPTZ
  end_at TIMESTAMPTZ
  all_day BOOLEAN
  reminder_minutes INTEGER
  created_at, updated_at TIMESTAMPTZ

lists
  id UUID PK
  household_id UUID FK
  name TEXT
  icon TEXT
  sort_order INTEGER
  created_at TIMESTAMPTZ

list_items
  id UUID PK
  list_id UUID FK
  text TEXT
  checked BOOLEAN
  checked_by UUID FK
  checked_at TIMESTAMPTZ
  added_by UUID FK
  sort_order INTEGER
  created_at TIMESTAMPTZ

invites
  id UUID PK
  household_id UUID FK
  code TEXT UNIQUE
  created_by UUID FK
  used_by UUID FK
  used_at TIMESTAMPTZ
  expires_at TIMESTAMPTZ
  created_at TIMESTAMPTZ
```

**RLS:** All tables locked to household via `get_my_household_id()` function.
**Realtime:** Enabled on events, lists, list_items.

---

## DECISION LOG

### 2026-07-03 — Invite system for multi-household support
- **Decided:** Add `invites` table, build self-service invite flow
- **Why:** Bob asked about friends/family using app; need self-service onboarding
- **Consequence:** Settings module needed for v1; invite code flow in UI

### 2026-07-03 — Notification architecture: Supabase Edge Functions + Web Push
- **Decided:** Use native Supabase stack (Edge Functions + pg_cron) over third-party
- **Why:** Zero additional dependencies; free tier sufficient; upgrade path exists
- **Rejected:** OneSignal/FCM — overkill for two users, adds complexity

### 2026-07-03 — Backend: Supabase
- **Decided:** Supabase (managed Postgres + realtime + auth) over Pi/FastAPI self-host
- **Why:** realtime sync built in; zero maintenance; Bob has prior experience
- **Tradeoffs:** third-party dependency; mitigated by Postgres export path

### 2026-07-02 — Metallic palette locked via tuning panel
- **Decided:** darkness 50%, highlight +14, shimmer 16%, speed 5.5s
- **Consequence:** light text on metallic fills, never dark

### 2026-07-01 — Module isolation architecture
- **Decided:** feature-folder isolation; shell + shared only common code
- **Why:** Bob's requirement — fixing calendar must never break lists

### 2026-07-01 — v1 scope
- **Decided:** v1 = calendar + lists + sync + notifications + settings (invite flow)

---

## ENVIRONMENT & CONFIG REFERENCE
- **Supabase:** Project URL + anon key in `.env` (never committed)
- **Ports:** Vite dev 5173
- **Fonts:** Google Fonts CDN (Fraunces italic axis needed)
- **Icons:** public/icons/ — regenerate from SVG masters

---

## SESSION CHANGELOG

### Session 4 — 2026-07-03
- Git init + initial commit
- Supabase project created, schema applied (households, profiles, events, lists, list_items, invites)
- Module map + dependency map documented
- Notification architecture decided (Edge Functions + Web Push)

### Session 3 — 2026-07-03
- Phase 1 signed off, Supabase locked, Phase 2 skeleton generated

### Session 2 — 2026-07-02
- Identity: boards v1/v2, tuning panel, color lock, icon pack

### Session 1 — 2026-07-01
- Concept, scope, backend options, name brainstorm → Vesta
