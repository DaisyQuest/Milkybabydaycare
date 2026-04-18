# Milky Baby Daycare

A playful pastel anime-style joke website: **"Welcome to the Milky Baby Daycare — are you picking up or dropping off?"**

Now includes an Express-powered `/world` route featuring an interactive ASCII world with per-viewer character assignment.

## Runtime and platform
- **Node:** 22+
- **Deployment target:** Azure App Service / any Node host via `npm start`

## Local development
```bash
npm install
npm start
```

Then open:
- `http://localhost:3000/` for the original prompt flow
- `http://localhost:3000/world` for the interactive ASCII world

## Testing quality gates
- `vitest` with `v8` coverage
- Coverage thresholds are set to **100%** for:
  - branches
  - lines
  - functions
  - statements
