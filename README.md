# Work Effort Tracker

A personal work effort tracker — log hours, manage tasks, and visualise productivity across projects and customers. Built as a single HTML file with an **Appwrite** backend (auth + database).

---

## Features

- **Dashboard** — stat cards (total hours, tasks, projects, customers) + 3 charts
- **Tasks** — filterable task list with status tabs (Pending / In-Progress / Completed)
- **Log Work** — form to add work entries, recent history table
- **Customers** — internal 🏢 vs external 🤝 customer cards
- **Projects** — project overview with total hours
- **Auth** — email/password, registration, Google OAuth via Appwrite

---

## Quick Start (local dev — no backend needed)

```bash
node build.js          # generates config.js in DEMO mode
# open index.html in a browser  (or: npx serve . -p 3000)
```

Data is stored in `localStorage` — no account, no internet required.

---

## Production Setup

### 1 · Create an Appwrite Cloud project

1. Go to **[cloud.appwrite.io](https://cloud.appwrite.io)** → sign in (free tier available).
2. Click **Create project** → give it a name (e.g. `WorkTracker`) → Create.
3. Note your **Project ID** — shown in **Settings** → **General** → *Project ID*.

### 2 · Create a database and 3 collections

In your project: **Databases** → **Create database** → name it (e.g. `WorkTracker`) → note the **Database ID**.

Then create three collections inside it — use these **exact Collection IDs**:

#### Collection `projects`
- **Settings** → enable **Document security**
- **Attributes:**
  | Attribute | Type | Required | Size |
  |---|---|---|---|
  | `name` | String | ✅ | 255 |
  | `color` | String | | 20 |
  | `description` | String | | 1000 |
  | `user_id` | String | ✅ | 36 |
- **Indexes:** Add key index on `user_id`

#### Collection `customers`
- Enable **Document security**
- **Attributes:**
  | Attribute | Type | Required | Size |
  |---|---|---|---|
  | `name` | String | ✅ | 255 |
  | `type` | String | ✅ | 20 |
  | `color` | String | | 20 |
  | `user_id` | String | ✅ | 36 |
- **Indexes:** Add key index on `user_id`

#### Collection `entries`
- Enable **Document security**
- **Attributes:**
  | Attribute | Type | Required | Size |
  |---|---|---|---|
  | `title` | String | ✅ | 500 |
  | `project_id` | String | | 36 |
  | `customer_id` | String | | 36 |
  | `hours` | Float | ✅ | — |
  | `status` | String | | 20 |
  | `date` | String | | 20 |
  | `notes` | String | | 2000 |
  | `user_id` | String | ✅ | 36 |
- **Indexes:** Add key indexes on `user_id` and `date`

> **Note:** Collection IDs must be exactly `projects`, `customers`, `entries` — the app uses these strings directly.

### 3 · Enable Google OAuth (optional)

1. Your project → **Auth** → **Settings** → **OAuth2 Providers** → **Google** → enable.
2. Create an OAuth client in [Google Cloud Console](https://console.cloud.google.com):
   - Authorised redirect URI: `https://cloud.appwrite.io/v1/account/sessions/oauth2/callback/google/[your-project-id]`
3. Paste **Client ID** and **Client Secret** into Appwrite.

### 4 · Configure your local environment

```bash
# Edit .env.local:
#   APPWRITE_PROJECT_ID=your-project-id
#   APPWRITE_DATABASE_ID=your-database-id

node build.js
# ✓ config.js generated  →  project=xxxx  db=yyyy
```

Open `index.html` → register an account → your default data seeds automatically on first login.

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
   | `APPWRITE_ENDPOINT` | `https://cloud.appwrite.io/v1` |
   | `APPWRITE_PROJECT_ID` | your project ID |
   | `APPWRITE_DATABASE_ID` | your database ID |

5. **Save and Deploy** → live in ~1 minute.

### Option B — Wrangler CLI

```bash
npm install -g wrangler
wrangler login
node build.js
wrangler pages deploy . --project-name work-effort-tracker
```

Set the three environment variables in Cloudflare Pages → **Settings** → **Environment variables**.

---

## File Reference

| File | Purpose |
|---|---|
| `index.html` | Entire app — HTML + CSS + JS |
| `schema.sql` | Collection attribute reference (not SQL — see file) |
| `build.js` | Reads `.env.local` / CI env → writes `config.js` |
| `config.js` | **Generated, gitignored** — never commit |
| `.env.local` | **Gitignored** — your local Appwrite keys |
| `.env.example` | Safe template |

---

## Data Model

```
projects   $id · user_id · name · color · description
customers  $id · user_id · name · type (internal|external) · color
entries    $id · user_id · title · project_id · customer_id · hours · status · date · notes
```

Document-level permissions ensure each user sees only their own records.
