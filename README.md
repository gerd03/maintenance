# AOAS Web

This project was refactored to reduce root-level clutter and make troubleshooting/documentation easier.

## Quick Start

- Install deps: `npm install`
- Configure env: copy `.env.example` to `.env` and set Supabase/admin values
- In Supabase SQL Editor, run `docs/SUPABASE_SETUP.sql` once
- Run local server: `npm run dev`
- Open: `http://localhost:3000`

## Project Layout

```text
AOAS WEB/
  api/                     # Vercel serverless endpoints
  assets/
    css/                   # Frontend styles
    js/                    # Frontend runtime scripts
    icons/                 # Favicons and icon files
    images/                # Brand, SEO, hero, office, and partner images
  data/                    # Runtime data stores/log files
  docs/                    # Documentation and troubleshooting guides
  lib/                     # Shared backend utilities
  scripts/maintenance/     # One-off refactor/maintenance scripts
  services/                # Services pages + service-specific assets/scripts
  archive/                 # Legacy backups and old structure artifacts
  index.html               # Homepage
  careers.html             # Careers page
  admin.html               # Admin UI
  server.js                # Local Express dev server
```

## Documentation

- Structure details: `docs/PROJECT_STRUCTURE.md`
- Troubleshooting checklist: `docs/TROUBLESHOOTING.md`
- Supabase schema bootstrap: `docs/SUPABASE_SETUP.sql`

## Notes

- Static page URLs are unchanged (`/`, `/careers`, `/services/*`, etc.).
- Root now keeps only entry pages/configs; frontend assets live under `assets/`.
