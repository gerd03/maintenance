# Project Structure

## Goals of this Structure

- Keep root clean and easy to scan.
- Separate runtime frontend assets from backend/service code.
- Keep legacy/one-off scripts out of the main app flow.
- Make documentation and troubleshooting faster.

## Folder Guide

- `assets/css`
  - Main site/admin stylesheets.

- `assets/js`
  - Main site/admin runtime JavaScript loaded by HTML pages.

- `assets/icons`
  - Favicon and icon files used in `<head>` metadata.

- `assets/images`
  - `brand/`: company logo image.
  - `home/hero/`: homepage slideshow images.
  - `home/professional-excellence/`: homepage carousel images.
  - `office/`: office location popup/gallery images.
  - `partners/raw/`: source partner logos.
  - `partners/optimized/`: optimized partner logos used on pages.
  - `seo/`: social sharing image(s), including Open Graph.

- `services`
  - Service pages and service-specific assets (`services/assets`) plus service-page script.

- `scripts/maintenance`
  - One-off patch/refactor scripts.
  - Run from project root, for example:
    - `node scripts/maintenance/replace_alerts_index.js`

- `archive`
  - Backup files and legacy moved folders.

## Runtime Entry Points

- Frontend pages: root `*.html` and `services/*.html`
- Local backend: `server.js`
- Serverless backend: `api/**/*.js`
- Shared backend utils: `lib/*.js`

## Path Conventions

- Frontend references now use root-absolute paths for shared assets:
  - CSS: `/assets/css/...`
  - JS: `/assets/js/...`
  - Images: `/assets/images/...`
  - Icons: `/assets/icons/...`

This avoids fragile `../` paths across pages in different folders.
