# Milky Baby Daycare

A playful pastel anime-style joke website: **"Welcome to the Milky Baby Daycare — are you picking up or dropping off?"**

## Runtime and platform
- **Node:** 22+
- **Deployment target:** Azure Static Web Apps (see `staticwebapp.config.json`)

## Local development
```bash
npm install
npm test
```

Open `milkybabydaycare.html` in a browser to view the page.

## Testing quality gates
- `vitest` with `v8` coverage
- Coverage thresholds are set to **100%** for:
  - branches
  - lines
  - functions
  - statements
