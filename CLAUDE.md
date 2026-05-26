# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file client-side work effort tracker (`index.html`) backed by **PocketBase** (auth + database via [pockethost.io](https://pockethost.io)). No framework, no bundler — one HTML file with inline CSS and JS.

## Running locally

```bash
# 1. Fill in .env.local with your PocketBase URL (see README)
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
| `<body>` | `#auth-screen` overlay + 5 `.page` divs (`dashboard`, `tasks`, `log`, `customers`, `projects`) |
| `<script>` | App logic — PocketBase init, auth flow, data layer, render functions |

### Config injection

`build.js` reads `.env.local` (or CI env vars) and writes `config.js`:
```js
window.APP_CONFIG = { pocketbaseUrl: "https://your-instance.pockethost.io" };
```
`index.html` loads `config.js` via `<script src="config.js">` before the app script. If missing or value is `'DEMO'`, app falls back to localStorage.

### Auth flow

```
initAuth()
  └─ pb.authStore.onChange(callback, true)   ← true = fires immediately with current state
        ├─ model present  → dbLoad(model.id) → showApp()
        └─ no model       → showLogin()
```

`DEMO_MODE = !CFG.pocketbaseUrl || CFG.pocketbaseUrl === 'DEMO'`

In DEMO mode all PocketBase calls are skipped; data lives in `localStorage` under key `wt_v3`.

### Data model (PocketBase collections)

```
projects   id · user (relation) · name · color · description
customers  id · user (relation) · name · type (internal|external) · color
entries    id · user (relation) · title · project_id (text) · customer_id (text)
           hours · status (pending|in-progress|completed) · date · notes
```

Collection structure + API rules documented in `schema.sql`. PocketBase API rules ensure each user only sees their own records (equivalent to RLS).

### Key JS functions

| Function | Purpose |
|---|---|
| `dbLoad(uid)` | Fetches all records from projects / customers / entries for the user |
| `dbSeed(uid)` | Creates default projects/customers/entries on first login; builds an ID map so entries reference the correct new IDs |
| `dbInsert(table, row)` | `pb.collection(table).create({...row, user: uid})`; in DEMO mode mutates `db` + saves to localStorage |
| `dbUpdate(table, id, patch)` | `pb.collection(table).update(id, patch)` |
| `dbDelete(table, id)` | `pb.collection(table).delete(id)` |
| `getProjId(e)` | Returns `e.project_id \|\| e.projectId` — handles both live and DEMO shapes |
| `navigate(page)` | Switches active `.page` div, calls matching `render*()` |
| `refresh()` | Re-renders current page after mutations |

### PocketBase SDK patterns

```js
// Auth
pb.collection('users').authWithPassword(email, password)
pb.collection('users').create({ name, email, password, passwordConfirm })
pb.collection('users').requestPasswordReset(email)
pb.authStore.clear()                    // logout
pb.authStore.model                      // current user record
pb.authStore.onChange(callback, true)   // subscribe to auth changes

// Data (errors are thrown, not returned)
await pb.collection('entries').getFullList({ filter: `user="${uid}"`, sort: '-date' })
await pb.collection('entries').create({ ...row, user: uid })
await pb.collection('entries').update(id, patch)
await pb.collection('entries').delete(id)
```

### Charts

Chart.js 4.4.0 (CDN). Stored in module-level `chartH` / `chartS` / `chartC`. Each `renderDashboard()` call destroys and recreates them to avoid "Canvas already in use" errors on back-navigation.

### Adding a new page

1. Add `<div id="page-X" class="page">` in `<body>`
2. Add a `.nav-item[data-page="X"]` in the sidebar
3. Add `if (page === 'X') renderX();` in `navigate()`
4. Write `renderX()` in the script block
5. Add the `X` collection in PocketBase admin with a `user` relation field + API rules

## External dependencies (CDN)

| Library | URL |
|---|---|
| PocketBase JS v0.21.3 | `https://cdn.jsdelivr.net/npm/pocketbase@0.21.3/dist/pocketbase.umd.js` |
| Chart.js 4.4.0 | `https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js` |
| Inter font | Google Fonts |

## Deployment

- **Build command** (Cloudflare Pages): `node build.js`
- **Output directory**: `/` (root)
- **Environment variables**: `POCKETBASE_URL` only
