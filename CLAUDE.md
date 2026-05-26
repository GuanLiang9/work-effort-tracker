# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file client-side work effort tracker (`index.html`) backed by **Appwrite Cloud** (auth + database). No framework, no bundler — one HTML file with inline CSS and JS.

## Running locally

```bash
# 1. Fill in .env.local with your Appwrite keys (see README)
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
| `<script>` | App logic — Appwrite init, auth flow, data layer, render functions |

### Config injection

`build.js` reads `.env.local` (or CI env vars) and writes `config.js`:
```js
window.APP_CONFIG = {
  appwriteEndpoint: "https://cloud.appwrite.io/v1",
  appwriteProjectId: "...",
  appwriteDatabaseId: "..."
};
```
`index.html` loads `config.js` before the app script. If missing or `appwriteProjectId === 'DEMO'`, app falls back to localStorage.

### Appwrite SDK globals

```js
const aw = new Appwrite.Client().setEndpoint(...).setProject(...);
const aw_account   = new Appwrite.Account(aw);
const aw_databases = new Appwrite.Databases(aw);
const AW_DB        = "database-id";
const COL          = { projects: 'projects', customers: 'customers', entries: 'entries' };
```

### Auth flow

Appwrite has no `onChange` listener. Auth state is checked once on load:
```
initAuth()
  └─ aw_account.get()
        ├─ resolves  → dbLoad(user.$id) → showApp()
        └─ throws    → showLogin()
```
After login/register, `account.get()` is called again to get the fresh user object.

`DEMO_MODE = !CFG.appwriteProjectId || CFG.appwriteProjectId === 'DEMO'`

In DEMO mode all Appwrite calls are skipped; data lives in `localStorage` under key `wt_v3`.

### Data model (Appwrite collections — IDs are exact strings)

```
projects   $id · user_id · name · color · description
customers  $id · user_id · name · type (internal|external) · color
entries    $id · user_id · title · project_id · customer_id
           hours · status (pending|in-progress|completed) · date · notes
```

All collections have **Document security** enabled. Each document carries `Permission.read/update/delete(Role.user(uid))`.

Appwrite documents have `$id` as their identifier. A `norm(d)` helper normalises to `{ ...d, id: d.$id }` so the rest of the app can use `id` consistently.

### Key JS functions

| Function | Purpose |
|---|---|
| `dbLoad(uid)` | `databases.listDocuments` for all 3 collections, normalises `$id → id` |
| `dbSeed(uid)` | Creates default data on first login; builds `projMap`/`custMap` to link entries |
| `dbInsert(table, row)` | `databases.createDocument` with document-level permissions |
| `dbUpdate(table, id, patch)` | `databases.updateDocument` |
| `dbDelete(table, id)` | `databases.deleteDocument` |
| `getProjId(e)` | Returns `e.project_id \|\| e.projectId` — handles live and DEMO shapes |
| `norm(d)` | `{ ...d, id: d.$id }` — normalise Appwrite `$id` to `id` |
| `perm(uid)` | Returns `[Permission.read, .update, .delete](Role.user(uid))` |
| `navigate(page)` | Switches active `.page` div, calls matching `render*()` |
| `refresh()` | Re-renders current page after mutations |

### Appwrite SDK patterns

```js
// Auth
await aw_account.createEmailPasswordSession(email, password);
await aw_account.create(Appwrite.ID.unique(), email, password, name);
await aw_account.get();           // returns user with $id
await aw_account.deleteSession('current');
await aw_account.createRecovery(email, redirectUrl);
aw_account.createOAuth2Session('google', successUrl, failUrl);  // redirects page

// Data (errors thrown, not returned)
await aw_databases.listDocuments(AW_DB, COL.entries, [
  Appwrite.Query.equal('user_id', uid),
  Appwrite.Query.limit(500),
  Appwrite.Query.orderDesc('date')
]);  // returns { documents: [...], total: n }

await aw_databases.createDocument(AW_DB, COL.projects, Appwrite.ID.unique(), data, permissions);
await aw_databases.updateDocument(AW_DB, COL.projects, id, patch);
await aw_databases.deleteDocument(AW_DB, COL.projects, id);
```

### Charts

Chart.js 4.4.0 (CDN). Stored in module-level `chartH` / `chartS` / `chartC`. Each `renderDashboard()` call destroys and recreates them to avoid "Canvas already in use" errors on back-navigation.

### Adding a new page

1. Add `<div id="page-X" class="page">` in `<body>`
2. Add a `.nav-item[data-page="X"]` in the sidebar
3. Add `if (page === 'X') renderX();` in `navigate()`
4. Write `renderX()` in the script block
5. Create collection `X` in Appwrite with `user_id` attribute + document security + `user_id` index

## External dependencies (CDN)

| Library | URL |
|---|---|
| Appwrite JS SDK v16 | `https://cdn.jsdelivr.net/npm/appwrite@16.0.0/dist/umd/sdk.min.js` |
| Chart.js 4.4.0 | `https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js` |
| Inter font | Google Fonts |

## Deployment

- **Build command** (Cloudflare Pages): `node build.js`
- **Output directory**: `/` (root)
- **Environment variables**: `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_DATABASE_ID`
