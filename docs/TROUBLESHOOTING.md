# Troubleshooting

## 1) Page Looks Unstyled or Broken

- Confirm CSS/JS links point to `/assets/...` paths in the page HTML.
- Verify files exist in:
  - `assets/css`
  - `assets/js`

## 2) Missing Images

- Confirm image paths are under `/assets/images/...`.
- Check expected files in:
  - `assets/images/brand`
  - `assets/images/home`
  - `assets/images/office`
  - `assets/images/partners/optimized`

## 3) Favicon or Social Preview Not Updating

- Favicon path should be `/assets/icons/favicon.ico`.
- Open Graph image path should be:
  - `https://www.attainmentofficeadserv.org/assets/images/seo/open-graph.png`
- Clear browser/social cache and re-crawl if needed.

## 4) Local Dev Route Not Found

- Start app with `npm run dev`.
- Confirm `server.js` is running on `http://localhost:3000`.
- Check `server.js` clean URL logic for page routing.

## 5) Maintenance Script Not Working

- Run scripts from project root.
- Scripts are located in `scripts/maintenance`.
- Example:
  - `node scripts/maintenance/update_styles.js`

## 6) Verify Refactor Integrity

Run these checks from project root:

```powershell
rg -n "src=\"/assets|href=\"/assets" -g "*.html"
rg --files assets
```

If a page still references an old root path, update it to the `/assets/...` equivalent.

## 7) Admin CRM Supabase Errors

If admin endpoints return:
- `Supabase CRM tables are missing. Run docs/SUPABASE_SETUP.sql first.`

Then:
- Open your Supabase project SQL Editor.
- Run `docs/SUPABASE_SETUP.sql` once.
- Confirm `.env` has:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ADMIN_USERNAME`
  - `ADMIN_PASSWORD`
