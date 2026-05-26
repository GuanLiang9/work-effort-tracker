# Work Effort Tracker

A personal work effort tracker — log hours, manage tasks, and visualise productivity across projects and customers. Built as a single HTML file with a Supabase backend (auth + database).

---

## Features

- **Dashboard** — stat cards (total hours, tasks, projects, customers) + 3 charts
- **Tasks** — filterable task list with status tabs (Pending / In-Progress / Completed)
- **Log Work** — form to add work entries, recent history table
- **Customers** — internal 🏢 vs external 🤝 customer cards
- **Projects** — project overview with total hours
- **Auth** — email/password login, registration, and Google OAuth via Supabase

---

## Quick Start (local dev — no Supabase needed)

```bash
node build.js          # generates config.js with DEMO values
# then open index.html in a browser  (or: npx serve . -p 3000)
```

Data is stored in `localStorage` in DEMO mode — no account needed.

---

## Production Setup

### 1 · Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in / create a free account.
2. Click **New Project** → choose an organisation → fill in:
   - **Name**: `work-effort-tracker` (or anything)
   - **Database Password**: save it somewhere safe
   - **Region**: closest to you (e.g. *Southeast Asia — Singapore*)
3. Click **Create new project** and wait ~2 minutes.

### 2 · Get your API keys

1. Go to **Project Settings** (⚙ gear icon) → **API**.
2. Copy two values:
   - **Project URL** — looks like `https://xxxxxxxxxxxx.supabase.co`
   - **anon public** key — long `eyJ…` JWT string

### 3 · Create the database schema

1. Go to **SQL Editor** → **New query**.
2. Open `schema.sql` from this repo and paste the entire contents.
3. Click **Run** (▶). You should see "Success. No rows returned."

### 4 · Enable authentication providers

**Email/Password** — enabled by default, nothing to do.

**Google OAuth** (optional):
1. **Authentication** → **Providers** → **Google** → toggle on.
2. Follow Supabase's guide: [https://supabase.com/docs/guides/auth/social-login/auth-google](https://supabase.com/docs/guides/auth/social-login/auth-google)
3. Paste your **Google Client ID** and **Client Secret** into the form.

**Redirect URL** (required for OAuth):
- **Authentication** → **URL Configuration** → add your Cloudflare Pages URL (e.g. `https://your-project.pages.dev`) to *Redirect URLs*.

### 5 · Configure local environment

```bash
# 1. Copy the template
cp .env.example .env.local

# 2. Edit .env.local and paste your keys:
#    SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
#    SUPABASE_ANON_KEY=eyJ...

# 3. Generate config.js
node build.js
# ✓ config.js generated  →  https://xxxxxxxxxxxx.supabase.co
```

Open `index.html` (or `npx serve . -p 3000`). You should see the login page.

---

## Deploying to Cloudflare Pages

### Option A — Connect GitHub (recommended — auto-deploys on every push)

1. [https://dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Authorise Cloudflare to access GitHub and select the `work-effort-tracker` repo.
3. Set build configuration:

   | Setting | Value |
   |---|---|
   | Build command | `node build.js` |
   | Build output directory | `/` *(root)* |

4. Under **Environment variables (production)**, click **Add variable** for each:

   | Variable name | Value |
   |---|---|
   | `SUPABASE_URL` | `https://xxxxxxxxxxxx.supabase.co` |
   | `SUPABASE_ANON_KEY` | `eyJ…` |

5. Click **Save and Deploy**. Your site goes live at `https://your-project.pages.dev` in ~1 minute.

Every `git push` to `main` triggers a new deploy automatically.

### Option B — Wrangler CLI (manual)

```bash
npm install -g wrangler
wrangler login          # opens browser to authorise

node build.js           # build config.js first

wrangler pages deploy . --project-name work-effort-tracker
```

After first deploy, go to your Cloudflare Pages project → **Settings** → **Environment variables** and add `SUPABASE_URL` and `SUPABASE_ANON_KEY` so future CI deploys have them.

---

## File Reference

| File | Purpose |
|---|---|
| `index.html` | Entire app — HTML + CSS + JS in one file |
| `schema.sql` | Supabase table definitions + RLS policies |
| `build.js` | Reads `.env.local` / CI env → writes `config.js` |
| `config.js` | **Generated, gitignored** — never commit |
| `.env.local` | **Gitignored** — your local Supabase keys |
| `.env.example` | Safe template to commit |

---

## Data Model

```
projects   id · user_id · name · color · description
customers  id · user_id · name · type (internal|external) · color
entries    id · user_id · title · project_id · customer_id · hours · status · date · notes
```

All tables have Row Level Security — each user sees only their own rows.
