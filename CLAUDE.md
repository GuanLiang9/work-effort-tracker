# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file client-side work effort tracker (`index.html`) backed by **Supabase** (auth + Postgres). No framework, no bundler — one HTML file with inline CSS and JS.

## Running locally

```bash
# 1. Fill in .env.local with your Supabase keys (see README)
# 2. Generate config.js
node build.js

# 3. Open in browser
npx serve . -p 3000
# or just open index.html directly
```

Without a `.env.local` the app runs in **DEMO mode** (localStorage only, no auth required).

## Architecture

Everything lives in `index.html` as three inline sections:

| Section | Purpose |
|---|---|
| `<style>` | All CSS — CSS custom properties on `:root`, dark theme |
| `<body>` | `#login-screen` overlay + 5 `.page` divs (`dashboard`, `tasks`, `log`, `customers`, `projects`) |
| `<script>` | App logic — Supabase init, auth flow, data layer, render functions |

### Config injection

`build.js` reads `.env.local` (or CI env vars) and writes `config.js`:
```js
window.APP_CONFIG = { supabaseUrl: "...", supabaseAnonKey: "..." };
```
`index.html` loads `config.js` via `<script src="config.js">` before the app script. If the file is missing or values are `'DEMO'`, the app falls back to localStorage.

### Auth flow

```
initAuth()
  └─ supa.auth.onAuthStateChange
        ├─ session present  → dbLoad(uid) → showApp()
        └─ no session       → showLogin()
```

`DEMO_MODE = !CFG.supabaseUrl || CFG.supabaseUrl === 'DEMO'`

In DEMO mode all Supabase calls are skipped; data lives in `localStorage` under key `wt_v3`.

### Data model (Supabase tables)

```
projects   id · user_id · name · color · description
customers  id · user_id · name · type (internal|external) · color
entries    id · user_id · title · project_id · customer_id · hours
           status (pending|in-progress|completed) · date · notes
```

Full schema + RLS policies in `schema.sql`. Row Level Security ensures each user only sees their own rows.

### Key JS functions

| Function | Purpose |
|---|---|
| `dbLoad(uid)` | Fetches all rows from projects / customers / entries for the user |
| `dbSeed(uid)` | Inserts default projects, customers, entries on first login |
| `dbInsert(table, row)` | Insert row; in DEMO mode mutates `appData` + saves to localStorage |
| `dbUpdate(table, id, patch)` | Update by id |
| `dbDelete(table, id)` | Delete by id |
| `getProjId(e)` | Returns `e.project_id \|\| e.projectId` — handles both Supabase and DEMO shapes |
| `navigate(page)` | Switches active `.page` div, calls matching `render*()` |
| `refresh()` | Re-renders current page after mutations |

### Charts

Chart.js 4.4.0 (CDN). Stored in module-level `chartH` / `chartS` / `chartP`. Each `renderDashboard()` call destroys and recreates them to avoid "Canvas already in use" errors on back-navigation.

### Adding a new page

1. Add `<div id="page-X" class="page">` in `<body>`
2. Add a `.nav-item[data-page="X"]` in the sidebar
3. Add `if (page === 'X') renderX();` in `navigate()`
4. Write `renderX()` in the script block

## External dependencies (CDN)

| Library | URL |
|---|---|
| Supabase JS v2 | `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js` |
| Chart.js 4.4.0 | `https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js` |
| Inter font | Google Fonts |

## Deployment

- **Build command** (Cloudflare Pages): `node build.js`
- **Output directory**: `/` (root)
- **Environment variables**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
