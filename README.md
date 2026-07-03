# Vesta
*where all things come together*

Shared household PWA for Bob & Chassidy — calendar, lists, recipes, vacation fund, and The Decider, in one place.

## Stack
- React 18 + Vite PWA (frontend, installed to both phones via Add to Home Screen)
- Supabase (auth, Postgres, realtime sync)
- Lucide icons, metallic token design system

## Run
```
npm install
cp .env.example .env   # fill in Supabase keys
npm run dev
```

## Build
```
npm run build && npm run preview
```

## Architecture rule
Each feature lives in `src/modules/<name>/` and is fully isolated — modules never import from each other. Shared code only via `src/shared/`. Fix the calendar, never break the lists.
