# Work Effort Tracker

A personal work effort tracker — log hours, manage tasks, and visualise productivity across projects and customers. Built as a single HTML file with an **Appwrite** backend (auth + database).

🌐 **Live app:** [work-effort-tracker.pages.dev](https://work-effort-tracker.pages.dev/)

---

## Features

- **Dashboard** — stat cards + 3 charts, with a **month-period filter** so you can drill into hours by month
- **Tasks** — filterable list with status tabs, project/customer filters, and a **date-range filter** (From / To)
- **Export** — one-click **CSV** (Excel) and **PDF** export of the current filtered task view, with totals and active-filter summary
- **Log Work** — form to add work entries with a **🔁 Recurring task** option (auto-creates the same entry across N future months, each independently editable), plus a **Skills Gained** tag field
- **Customers** — internal 🏢 vs external 🤝 customer cards
- **Projects** — project overview with total hours
- **🏢 Companies / Roles** — every job you've held, with start/end dates. Active-company switcher in the sidebar; entries default to the active company
- **⭐ Skills** — resume-ready markdown extracted from your completed tasks, grouped by company + role + dates. One-click "Copy as Markdown" for direct paste into your CV or LinkedIn
- **🎓 Certifications** — track active credentials with renewal-date alerts. Status auto-derives: Active / Expiring &lt; 90 days / Expired
- **Auth** — email/password, registration, Google OAuth via Appwrite
- **Mobile-friendly** — sliding sidebar, finger-sized tap targets, no iOS zoom on input focus, swipeable tables, stacked layouts on phones

---

## Filtering & Export

- **Dashboard** — pick a month from the **Period** dropdown to scope all stats and charts to that month (or "All time").
- **Tasks** — combine status tabs, project, customer, and **From / To** date inputs to narrow the list. Click **Clear dates** to reset.
- **Export buttons** (Tasks page):
  - **📊 Export CSV** — opens in Excel; UTF-8 BOM so emoji and accents render correctly.
  - **📄 Export PDF** — landscape A4 report with branded header, filter summary, alternating rows, and a TOTAL row.
  - Filenames auto-include the active filters, e.g. `worktracker_completed_BMC_Sentosa_2026-05-26.pdf`.

---

## Recurring tasks

On the **Log Work** page, tick **🔁 Recurring task** and set how many months to repeat for (2–36). One entry is created per month at the same day-of-month as the original (clamped to month-end if needed — e.g. Jan 31 → Feb 28). Each generated entry is independent, so you can edit hours, mark complete, or delete any individual occurrence without affecting the others.

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
  | `skills` | String | | 1000 |
  | `company_id` | String | | 36 |
  | `user_id` | String | ✅ | 36 |
- **Indexes:** Add key indexes on `user_id` and `date`

#### Collection `companies`
- Enable **Document security**
- **Attributes:**
  | Attribute | Type | Required | Size |
  |---|---|---|---|
  | `name` | String | ✅ | 255 |
  | `role` | String | | 255 |
  | `start_date` | String | | 20 |
  | `end_date` | String | | 20 |
  | `color` | String | | 20 |
  | `notes` | String | | 2000 |
  | `user_id` | String | ✅ | 36 |
- **Indexes:** Add key index on `user_id`

#### Collection `certifications`
- Enable **Document security**
- **Attributes:**
  | Attribute | Type | Required | Size |
  |---|---|---|---|
  | `name` | String | ✅ | 255 |
  | `issuer` | String | | 255 |
  | `issue_date` | String | | 20 |
  | `expiry_date` | String | | 20 |
  | `credential_url` | String | | 500 |
  | `notes` | String | | 2000 |
  | `company_id` | String | | 36 |
  | `user_id` | String | ✅ | 36 |
- **Indexes:** Add key index on `user_id`

> **Note:** Collection IDs must be exactly `projects`, `customers`, `entries`, `companies`, `certifications` — the app uses these strings directly.
>
> **Migrating from an older version?** Either add the two new collections + the two new `entries` attributes (`skills`, `company_id`) manually via the dashboard, **or** run the included migration script — see below. The app will auto-create a default `Keppel Technology Solutions` company on first load after migration and back-fill every existing entry with its id, so nothing is lost.

### 2b · Automated migration (one command)

If you'd rather not click through the dashboard, run the included `setup-appwrite.js` — it creates the two new collections, all 15 attributes and 2 indexes, idempotently.

```bash
# 1. Get a temporary API key from Appwrite Console → Settings → API Keys → Create API Key
#    Scopes: databases.read + databases.write   ·   Expiry: 1 day is enough
#    Add it to .env.local:
#      APPWRITE_API_KEY=your-key-here

# 2. Install the SDK and run:
npm install node-appwrite
node setup-appwrite.js

# 3. Revoke the API key when done (Settings → API Keys → delete).
```

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
   | Build output directory | `dist` |

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
wrangler pages deploy dist --project-name work-effort-tracker --branch master
```

Set the three environment variables in Cloudflare Pages → **Settings** → **Environment variables**.

---

## File Reference

| File | Purpose |
|---|---|
| `index.html` | Entire app — HTML + CSS + JS |
| `schema.sql` | Collection attribute reference (not SQL — see file) |
| `build.js` | Reads `.env.local` / CI env → writes `dist/config.js` and copies `dist/index.html` |
| `dist/` | **Generated, gitignored** — Cloudflare Pages build output |
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
