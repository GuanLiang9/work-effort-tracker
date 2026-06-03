/**
 * setup-appwrite.js — one-shot migration that creates the new
 * `companies` + `certifications` collections and adds the two new
 * attributes (`skills`, `company_id`) to the existing `entries`
 * collection. Idempotent: re-running it is safe — existing items are
 * left alone.
 *
 * USAGE
 * -----
 * 1. Generate an Appwrite API key
 *    Appwrite Console → your project → Settings → API Keys → Create API Key
 *      - Name:   "WorkTracker migration"
 *      - Scopes: tick `databases.read` and `databases.write`
 *      - Expiry: 1 day is enough (you only need it once)
 *    Copy the secret.
 *
 * 2. Put it in .env.local (next to APPWRITE_PROJECT_ID etc.):
 *    APPWRITE_API_KEY=paste-the-secret-here
 *
 * 3. Install the SDK once:
 *    npm install node-appwrite
 *
 * 4. Run:
 *    node setup-appwrite.js
 *
 * That's it. Reload the live app and the new pages will work.
 */

const fs = require('fs');
const path = require('path');

// ── Load .env.local ────────────────────────────────────────
function loadEnv(file) {
  const p = path.join(__dirname, file);
  if (!fs.existsSync(p)) return;
  fs.readFileSync(p, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const eq = t.indexOf('=');
    if (eq === -1) return;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  });
}
loadEnv('.env.local');

const ENDPOINT = process.env.APPWRITE_ENDPOINT  || 'https://cloud.appwrite.io/v1';
const PROJECT  = process.env.APPWRITE_PROJECT_ID;
const DB_ID    = process.env.APPWRITE_DATABASE_ID;
const API_KEY  = process.env.APPWRITE_API_KEY;

if (!PROJECT || !DB_ID) {
  console.error('✗ Missing APPWRITE_PROJECT_ID or APPWRITE_DATABASE_ID in .env.local');
  process.exit(1);
}
if (!API_KEY) {
  console.error(`✗ Missing APPWRITE_API_KEY.

Generate one:
  Appwrite Console → your project → Settings → API Keys → Create API Key
  Scopes needed: databases.read, databases.write
  Then add to .env.local:  APPWRITE_API_KEY=...
`);
  process.exit(1);
}

let sdk;
try { sdk = require('node-appwrite'); }
catch (e) {
  console.error('✗ node-appwrite not installed. Run:  npm install node-appwrite');
  process.exit(1);
}
// Newer node-appwrite renamed IndexType → DatabasesIndexType; fall back to the literal 'key' if neither exists
const { Client, Databases, Permission, Role } = sdk;
const IDX_KEY = (sdk.DatabasesIndexType && sdk.DatabasesIndexType.Key) || (sdk.IndexType && sdk.IndexType.Key) || 'key';

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
const dbs = new Databases(client);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function ensureCollection(id, name) {
  try {
    await dbs.getCollection(DB_ID, id);
    console.log(`  ✓ collection '${id}' already exists`);
  } catch (e) {
    if (e.code !== 404) throw e;
    await dbs.createCollection(
      DB_ID, id, name,
      [Permission.read(Role.users()), Permission.create(Role.users()), Permission.update(Role.users()), Permission.delete(Role.users())],
      true  // documentSecurity
    );
    console.log(`  + created collection '${id}'`);
  }
}

async function ensureStringAttr(collId, key, size, required = false) {
  try {
    await dbs.getAttribute(DB_ID, collId, key);
    process.stdout.write(`    · ${key.padEnd(18)} `);
    console.log('exists');
  } catch (e) {
    if (e.code !== 404) throw e;
    await dbs.createStringAttribute(DB_ID, collId, key, size, required);
    process.stdout.write(`    + ${key.padEnd(18)} `);
    console.log(`String(${size})${required ? ' required' : ''}`);
    await sleep(1500);  // Appwrite needs a moment to provision the column
  }
}

async function ensureIndex(collId, key, attributes) {
  try {
    await dbs.getIndex(DB_ID, collId, key);
    console.log(`    · index '${key}' exists`);
  } catch (e) {
    if (e.code !== 404) throw e;
    await dbs.createIndex(DB_ID, collId, key, IDX_KEY, attributes);
    console.log(`    + created index '${key}' on (${attributes.join(', ')})`);
  }
}

async function main() {
  console.log(`\n▶ WorkTracker → Appwrite migration`);
  console.log(`  endpoint: ${ENDPOINT}`);
  console.log(`  project:  ${PROJECT}`);
  console.log(`  database: ${DB_ID}\n`);

  console.log('— companies collection —');
  await ensureCollection('companies', 'Companies');
  await ensureStringAttr('companies', 'name',            255, true);
  await ensureStringAttr('companies', 'role',            255);
  await ensureStringAttr('companies', 'start_date',      20);
  await ensureStringAttr('companies', 'end_date',        20);
  await ensureStringAttr('companies', 'color',           20);
  await ensureStringAttr('companies', 'notes',           2000);
  await ensureStringAttr('companies', 'employment_type', 50);   // Full-time, Contract, …
  await ensureStringAttr('companies', 'location',        100);  // "Singapore · On-site"
  await ensureStringAttr('companies', 'description',     2000); // resume summary paragraph
  await ensureStringAttr('companies', 'user_id',         36,  true);
  await ensureIndex('companies', 'user_id_idx', ['user_id']);

  console.log('\n— certifications collection —');
  await ensureCollection('certifications', 'Certifications');
  await ensureStringAttr('certifications', 'name',           255, true);
  await ensureStringAttr('certifications', 'issuer',         255);
  await ensureStringAttr('certifications', 'issue_date',     20);
  await ensureStringAttr('certifications', 'expiry_date',    20);
  await ensureStringAttr('certifications', 'credential_url', 500);
  await ensureStringAttr('certifications', 'notes',          2000);
  await ensureStringAttr('certifications', 'company_id',     36);
  await ensureStringAttr('certifications', 'user_id',        36,  true);
  await ensureIndex('certifications', 'user_id_idx', ['user_id']);

  console.log('\n— entries: new attributes —');
  await ensureStringAttr('entries', 'skills',     1000);
  await ensureStringAttr('entries', 'company_id', 36);

  console.log('\n— projects: description attribute —');
  await ensureStringAttr('projects', 'description', 1000); // one-line accomplishment bullet for the Skills page

  console.log('\n✓ All done. Reload the app — the default "Keppel Technology Solutions" company will be auto-created and your existing tasks tagged with it.');
  console.log('  Then revoke the API key in Appwrite Console (Settings → API Keys → delete) — you don\'t need it again.\n');
}

main().catch(e => {
  console.error('\n✗ Migration failed:', e.message);
  if (e.response) console.error('  Appwrite response:', e.response);
  process.exit(1);
});
