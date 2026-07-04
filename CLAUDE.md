# CLAUDE — Vesta Context File
**Generated:** 2026-07-03
**Project type:** Web (PWA, mobile-first, multi-household)
**AI platform:** Claude

## Project Summary
Vesta ("where all things come together") is a household PWA for couples: shared calendar with per-person metallic colors and recurring events, synced check-off lists (grocery/home), recipes with cook-mode and one-tap ingredients-to-grocery-list, vacation planner with savings tracking, and The Decider for random choices. React 18 + Vite PWA frontend, Supabase backend (auth, Postgres, realtime), deployed on Vercel, installed to phones via Add to Home Screen.

## Project Structure
```
vesta/
├── index.html              # manifest, icons, brand fonts
├── package.json            # pinned deps
├── vite.config.js          # PWA plugin
├── .env                    # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (never committed)
├── public/
│   ├── manifest.webmanifest
│   └── icons/              # from SVG-master icon pack
├── src/
│   ├── main.jsx            # entry only
│   ├── app.jsx             # SHELL ONLY — tab nav (6 tabs) + module mounting
│   ├── styles/
│   │   ├── tokens.css      # LOCKED palette — edit requires Decision Log entry
│   │   └── base.css        # reset + .sheen metallic sweep system
│   ├── shared/
│   │   ├── supabase.js     # single client, sole DB entry point
│   │   ├── auth.jsx        # AuthProvider, useAuth, signIn, signUp, signOut, createInvite
│   │   └── components/     # shared UI (Auth.jsx)
│   └── modules/            # ISOLATED features — never import each other
│       ├── home/           # dashboard with today's events, lists summary, settings access
│       ├── calendar/       # month/agenda/day views, recurring events, color coding
│       ├── lists/          # grocery/home lists with realtime sync
│       ├── recipes/        # recipe storage, cook mode, URL import, grocery integration
│       ├── decider/        # random choice picker with recipe integration
│       ├── vacation/       # trip ideas, savings tracking, contributions
│       └── settings/       # profile editor, household invites, sign out
└── supabase/
    ├── schema.sql          # v1 schema (applied to Supabase)
    └── functions/
        └── extract-recipe/ # Edge Function for recipe URL import
```

## Current Status
**v1 COMPLETE** — All modules built and deployed to Vercel.

**Remaining:**
- Push notifications (Edge Functions + Web Push)
- Custom domain (optional)

## Database Tables
- `households` — household container
- `profiles` — user profiles linked to households
- `events` — calendar events with recurrence support
- `lists` — list containers (Grocery, Home, etc.)
- `list_items` — individual checklist items
- `invites` — household invite codes
- `recipes` — recipe storage with ingredients/instructions
- `decider_lists` — decision categories
- `decider_items` — options within decision lists
- `vacation_ideas` — trip destinations with budgets
- `vacation_contributions` — savings contributions

## Key Rules for This Project
- Read HANDOFF.md before any session; update it at session end — no exceptions
- Modules import from src/shared/ ONLY, never from each other
- Never edit a file without seeing it in full first
- Identity is signed off — name, tagline, palette, fonts do not change
- Core hexes for text/small elements; metallic gradients (--m-*) for fills; light text on metallic, never dark
- Naming: files kebab-case, components PascalCase, functions/vars camelCase
- Lucide icons only

## Important Decisions Made
- Supabase over self-hosted Pi (realtime + zero maintenance; export path preserved)
- Module isolation is the load-bearing architectural principle
- Settings accessible via gear icon on Home screen (not in nav bar)
- Recipe import via Edge Function (handles CORS, parses JSON-LD schema)
- Deployed on Vercel with auto-deploy from GitHub

## Do Not Touch Without Explicit Instruction
- src/styles/tokens.css (locked palette)
- public/icons/ (generated from SVG masters)

## Environment Notes
- .env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (never committed)
- Vercel env vars configured for production
- Dev port 5173
- GitHub: https://github.com/2127bilbo/vesta
- Supabase project: ogiyhazpgqrglanvhpdj.supabase.co
