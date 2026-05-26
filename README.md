# Work Effort Tracker

A personal work effort tracker — log hours, manage tasks, and visualise productivity across projects and customers. Built as a single HTML file with a **PocketBase** backend (auth + database).

---

## Features

- **Dashboard** — stat cards (total hours, tasks, projects, customers) + 3 charts
- **Tasks** — filterable task list with status tabs (Pending / In-Progress / Completed)
- **Log Work** — form to add work entries, recent history table
- **Customers** — internal 🏢 vs external 🤝 customer cards
- **Projects** — project overview with total hours
- **Auth** — email/password login, registration, Google OAuth via PocketBase

---

## Quick Start (local dev — no backend needed)

```bash
node build.js          # generates config.js in DEMO mode
# then open index.html in a browser  (or: npx serve . -p 3000)
```

Data is stored in `localStorage` — no account, no internet required.

---

## Production Setup

### 1 · Create a PocketHost instance (free)

[PocketHost](https://pockethost.io) is free managed PocketBase hosting — no server required.

1. Go to **[pockethost.io](https://pockethost.io)** → sign up for a free account.
2. Click **New Instance** → give it a name (e.g. `work-tracker`).
3. Your instance URL will be: `https://work-tracker.pockethost.io` *(yours will differ)*
4. Click the instance → **Admin Dashboard** (opens `https://your-instance.pockethost.io/_/`)
5. Create your first admin account when prompted.

### 2 · Create the collections

In the PocketBase Admin UI, create three collections:

#### `projects` collection
- Type: **Base**
- Fields:
  | Field | Type | Required |
  |---|---|---|
  | `name` | Text | ✅ |
  | `color` | Text | |
  | `description` | Text | |
  | `user` | Relation → users | ✅ |
- **API Rules** (all 5 rules):
  ```
  List/Search : @request.auth.id = user
  View        : @request.auth.id = user
  Create      : @request.auth.id != ""
  Update      : @request.auth.id = user
  Delete      : @request.auth.id = user
  ```

#### `customers` collection
- Type: **Base**
- Fields:
  | Field | Type | Options | Required |
  |---|---|---|---|
  | `name` | Text | | ✅ |
  | `type` | Select | `internal`, `external` | ✅ |
  | `color` | Text | | |
  | `user` | Relation → users | | ✅ |
- **API Rules**: same as projects

#### `entries` collection
- Type: **Base**
- Fields:
  | Field | Type | Options | Required |
  |---|---|---|---|
  | `title` | Text | | ✅ |
  | `project_id` | Text | | |
  | `customer_id` | Text | | |
  | `hours` | Number | Min: 0 | ✅ |
  | `status` | Select | `pending`, `in-progress`, `completed` | |
  | `date` | Date | | |
  | `notes` | Text | | |
  | `user` | Relation → users | | ✅ |
- **API Rules**: same as projects

### 3 · Enable Google OAuth (optional)

1. PocketBase Admin → **Settings** → **Auth providers** → **Google** → enable it.
2. Create a Google Cloud OAuth client: [console.cloud.google.com](https://console.cloud.google.com)
   - **Authorized redirect URI**: `https://your-instance.pockethost.io/api/oauth2-redirect`
3. Paste your **Client ID** and **Client Secret** into PocketBase.

### 4 · Configure your local environment

```bash
# Edit .env.local — paste your PocketHost URL:
#   POCKETBASE_URL=https://your-instance.pockethost.io

# Then generate config.js:
node build.js
# ✓ config.js generated  →  https://your-instance.pockethost.io
```

Open `index.html` — you should see the login screen.  
Register an account and your default data (projects, customers, entries) will be seeded automatically on first login.

---

## Deploying to Cloudflare Pages

### Option A — Connect GitHub (auto-deploys on every push)

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Select the `work-effort-tracker` repo.
3. Build settings:

   | Setting | Value |
   |---|---|
   | Build command | `node build.js` |
   | Build output directory | `/` *(root)* |

4. **Environment variables (production)**:

   | Variable | Value |
   |---|---|
   | `POCKETBASE_URL` | `https://your-instance.pockethost.io` |

5. **Save and Deploy** → live in ~1 minute.

Every `git push` to `main` auto-deploys.

### Option B — Wrangler CLI

```bash
npm install -g wrangler
wrangler login

node build.js     # builds config.js with DEMO values (Cloudflare will override at deploy time)

wrangler pages deploy . --project-name work-effort-tracker
```

Then set `POCKETBASE_URL` in Cloudflare Pages → **Settings** → **Environment variables**.

---

## File Reference

| File | Purpose |
|---|---|
| `index.html` | Entire app — HTML + CSS + JS |
| `schema.sql` | Collection structure reference (not SQL — see file for details) |
| `build.js` | Reads `.env.local` / CI env → writes `config.js` |
| `config.js` | **Generated, gitignored** — never commit |
| `.env.local` | **Gitignored** — your local PocketBase URL |
| `.env.example` | Safe template |

---

## Data Model

```
projects   id · user · name · color · description
customers  id · user · name · type (internal|external) · color
entries    id · user · title · project_id · customer_id · hours · status · date · notes
```

PocketBase API rules ensure each user sees only their own records.
