# HANDOFF — Vesta
**Last updated:** 2026-07-03
**Updated by:** Claude — Session 5: v1 Build Complete + Vercel Deploy
**Project type:** Web (PWA, mobile-first, multi-household)

---

## CURRENT STATE
**Phase:** v1 COMPLETE
**Deployed:** Vercel (auto-deploy from GitHub)
**Repo:** https://github.com/2127bilbo/vesta

---

## COMPLETED THIS SESSION
- Built Calendar module (month/agenda/day views, recurring events, color coding, edit/delete)
- Built Lists module (grocery/home lists, realtime sync, check-off)
- Built Recipes module (recipe storage, cook mode, URL import via Edge Function, grocery integration)
- Built The Decider module (random choice picker, recipe integration)
- Built Vacation module (trip ideas, savings tracking, contributions)
- Built Settings module (profile editor, household invites, sign out)
- Built Home dashboard (today's events, upcoming events, list counts, settings access)
- Moved Settings to gear icon on Home (nav bar now has 6 tabs)
- Deployed to Vercel
- Fixed calendar mobile overflow issue

## PRIOR SESSIONS
- S4: Git init, Supabase schema, module map, notification architecture
- S3: Phase 1 signed off, Supabase decision, Phase 2 skeleton
- S2: Identity locked — Vesta, metallic palette, fonts, icon pack
- S1: Concept, scope, name brainstorm

---

## NEXT STEPS
1. Push notifications (Edge Functions + Web Push) — activity alerts + reminders
2. Custom domain (optional) — vestaAIO.com
3. Polish/bug fixes based on phone testing

---

## BLOCKED / PENDING DECISIONS
- [ ] vestaAIO.com not yet registered (Bob: Cloudflare Registrar)
- [ ] Push notification implementation — Phase 2 priority

---

## KNOWN BUGS / TECH DEBT
| ID | Description | Priority | Module | Notes |
|----|-------------|----------|--------|-------|
| — | None currently reported | — | — | Testing on mobile |

---

## MODULES COMPLETED

| Module | Features | Status |
|--------|----------|--------|
| **Home** | Today's events, upcoming 7 days, unchecked list count, settings gear | Done |
| **Calendar** | Month/agenda/day views, add/edit/delete events, recurring (daily/weekly/etc), color categories, reminders | Done |
| **Lists** | Multiple lists (Grocery, Home), add/check/delete items, realtime sync | Done |
| **Recipes** | Recipe cards, detail view, cook mode, URL import, paste import, add to grocery list | Done |
| **Decider** | Decision lists, emoji icons, spin to pick, recipe integration ("What to Eat") | Done |
| **Vacation** | Trip ideas, set active goal, budget tracking, add funds, contribution history | Done |
| **Settings** | Profile name/color, household invite codes, sign out | Done |

---

## DATABASE TABLES (all with RLS)

```
households          — container for household data
profiles            — user profiles (display_name, color, household_id)
events              — calendar events (recurrence, color, reminder_minutes)
lists               — list containers (Grocery, Home, etc.)
list_items          — checklist items
invites             — household invite codes
recipes             — recipe storage (ingredients JSONB, instructions TEXT[])
decider_lists       — decision categories (emoji, name)
decider_items       — options within lists (text, recipe_id)
vacation_ideas      — trip destinations (budget, saved_amount, is_active)
vacation_contributions — savings contributions
```

---

## EDGE FUNCTIONS

| Function | Purpose | Status |
|----------|---------|--------|
| `extract-recipe` | Fetch URL, parse JSON-LD recipe schema | Deployed |
| `send-push` | Send Web Push notifications | Not built |
| `check-reminders` | Cron job for calendar reminders | Not built |

---

## NAV BAR TABS (6)
1. Home
2. Calendar
3. Lists
4. Recipes
5. Decider
6. Vacation

Settings accessible via gear icon on Home screen.

---

## DECISION LOG

### 2026-07-03 — Settings moved to Home screen
- **Decided:** Remove Settings from nav bar, add gear icon to Home header
- **Why:** Too many tabs (was 7), Settings rarely accessed

### 2026-07-03 — Recipe import via Edge Function
- **Decided:** Use Supabase Edge Function to fetch/parse recipe URLs
- **Why:** Avoids CORS issues; parses JSON-LD Recipe schema
- **Fallback:** "Paste Recipe" mode for sites that block bots (AllRecipes, etc.)

### 2026-07-03 — Vercel deployment
- **Decided:** Deploy on Vercel with GitHub auto-deploy
- **Why:** Zero config for Vite, free tier sufficient, instant deploys

---

## ENVIRONMENT & CONFIG
- **GitHub:** https://github.com/2127bilbo/vesta
- **Vercel:** Auto-deploy from master branch
- **Supabase:** ogiyhazpgqrglanvhpdj.supabase.co
- **Env vars:** VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

---

## SESSION CHANGELOG

### Session 5 — 2026-07-03
- Built all v1 modules (Calendar, Lists, Recipes, Decider, Vacation, Settings, Home)
- Deployed to Vercel
- Recipe URL import with Edge Function
- Fixed mobile calendar overflow

### Session 4 — 2026-07-03
- Git init + initial commit
- Supabase project created, schema applied
- Module map + dependency map documented
- Notification architecture decided

### Session 3 — 2026-07-03
- Phase 1 signed off, Supabase locked, Phase 2 skeleton generated

### Session 2 — 2026-07-02
- Identity: boards v1/v2, tuning panel, color lock, icon pack

### Session 1 — 2026-07-01
- Concept, scope, backend options, name brainstorm → Vesta
