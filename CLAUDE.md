# CLAUDE — Vesta Context File
**Generated:** 2026-07-03
**Project type:** Web (PWA, mobile-first)
**AI platform:** Claude

## Project Summary
Vesta ("where all things come together") is a private two-user household PWA for Bob and Chassidy: shared calendar with per-person metallic colors, synced check-off lists (grocery/home), recipes with cook-mode and one-tap ingredients→grocery-list, vacation fund tracker, and The Decider (ported from existing standalone). React 18 + Vite PWA frontend, Supabase backend (auth, Postgres, realtime), installed to both phones via Add to Home Screen. Push notifications for activity ("Chassidy bought milk") and reminders ("dentist tomorrow at 5:15").

## Project Structure
```
vesta/
├── index.html              # manifest, icons, brand fonts
├── package.json            # pinned deps
├── vite.config.js          # PWA plugin
├── public/
│   ├── manifest.webmanifest
│   └── icons/              # from SVG-master icon pack
├── src/
│   ├── main.jsx            # entry only
│   ├── app.jsx             # SHELL ONLY — tab nav + module mounting
│   ├── styles/
│   │   ├── tokens.css      # LOCKED palette — edit requires Decision Log entry
│   │   └── base.css        # reset + .sheen metallic sweep system
│   ├── shared/
│   │   ├── supabase.js     # single client, sole DB entry point
│   │   └── components/     # shared UI (built as needed)
│   └── modules/            # ISOLATED features — never import each other
│       ├── home/           # stub built
│       ├── calendar/ lists/            # v1, Phase 6
│       └── recipes/ fund/ decider/     # reserved, post-v1
└── supabase/schema.sql     # designed in Phase 3
```

## Current Phase
Phase 2 complete. Phase 3 (Modular Architecture Plan) next.

## Key Rules for This Project
- Read HANDOFF.md before any session; update it at session end — no exceptions
- One module per session; modules import from src/shared/ ONLY, never from each other
- Never edit a file without seeing it in full first
- Identity is signed off — name, tagline, palette, fonts do not change
- Core hexes for text/small elements; metallic gradients (--m-*) for fills; light text on metallic, never dark
- Naming: files kebab-case, components PascalCase, functions/vars camelCase, branches feature/module-name
- Lucide icons only

## Important Decisions Made
- Supabase over self-hosted Pi (realtime + zero maintenance; export path preserved)
- v1 scope: calendar + lists + sync + notifications; recipes/fund/decider fast-follow
- Module isolation is the load-bearing architectural principle (Bob's explicit requirement)

## Do Not Touch Without Explicit Instruction
- src/styles/tokens.css (locked palette)
- public/icons/ (generated from SVG masters)

## Environment Notes
- .env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
- Dev port 5173; deploy target TBD (leaning Vercel)
