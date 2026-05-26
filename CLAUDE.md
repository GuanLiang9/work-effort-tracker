# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file, client-side work effort tracker (`index.html`). No build step, no dependencies to install, no server required — open the file directly in a browser.

## Running the app

```
# Just open in a browser:
start index.html          # Windows
open index.html           # macOS
xdg-open index.html       # Linux
```

For live-reload during development, any static file server works:
```
npx serve .
python -m http.server 8080
```

## Architecture

Everything lives in `index.html` as three inline sections:

| Section | Purpose |
|---|---|
| `<style>` | All CSS using CSS custom properties (`--bg`, `--primary`, etc.) defined on `:root` |
| `<body>` | Four `.page` divs (`#page-dashboard`, `#page-tasks`, `#page-log`, `#page-projects`) plus two `.overlay` modals |
| `<script>` | All app logic — no framework, vanilla JS |

### Data model (localStorage key: `wt_db_v2`)

```js
{
  projects: [{ id, name, color }],
  entries:  [{ id, title, projectId, hours, status, date, notes }]
}
```

`status` is one of: `"pending"` | `"in-progress"` | `"completed"`

The `SEED` constant at the top of the script holds the default data loaded when localStorage is empty.

### Key JS functions

- `navigate(page)` — switches the active `.page` div and triggers the matching `render*()` call
- `renderDashboard()` — computes stats, builds activity/overview HTML, then calls `buildChartHours()` / `buildChartStatus()` inside a `setTimeout(..., 60)` so Chart.js sees the visible canvas
- `refresh()` — re-renders whichever page is currently active; call this after any mutation to `db`
- `saveDB()` — persists `db` to `localStorage`; must be called after every mutation
- `populateSel(id)` — rebuilds a `<select>` with the current project list; preserves the currently selected value

### Chart.js usage

Charts are destroyed and recreated on every `renderDashboard()` call (stored in module-level `chartH` / `chartS`). This avoids the "Canvas already in use" error when navigating away and back.

### Adding a new page

1. Add a `<div id="page-X" class="page">` block in `<body>`
2. Add a `.nav-item` with `data-page="X"` in the sidebar
3. Add `if (page === 'X') renderX();` in `navigate()`
4. Write `renderX()` in the script block

## External dependency

Chart.js 4.4.0 loaded from jsDelivr CDN:
```
https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js
```
The app will still render but charts will be blank if this CDN is unreachable.
