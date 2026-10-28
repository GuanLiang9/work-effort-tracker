/**
 * migrate-roles.js — Role → Project hierarchy + per-company projects/customers.
 * Idempotent. Needs APPWRITE_API_KEY (databases.read + databases.write) in .env.local
 * and `npm install` (node-appwrite).
 *
 *   node migrate-roles.js schema            add attributes, backfill company_id, split
 *                                           projects/customers shared across companies
 *   node migrate-roles.js dump [days]       write .migrate/current.json (current company's
 *                                           entries for the last N days, default 21)
 *   node migrate-roles.js apply plan.json   dry-run: print what would change
 *   node migrate-roles.js apply plan.json --yes   write it
 *
 * plan.json
 *   { "company_id": "...", "role": { "id": "<existing role id>" | null, "name": "AI Engineering" },
 *     "projects":  [{ "key": "rag", "name": "RAG Assistant", "color": "#C38133", "description": "" }],
 *     "customers": [{ "key": "int", "name": "Internal", "type": "internal" }],
 *     "entries":   [{ "id": "<entry id>", "project": "rag", "customer": "int",
 *                    "title": "...", "notes": "...", "challenges": "...", "skills": "..." }] }
 *   Entry fields other than id are optional; "project"/"customer" are plan keys or existing ids.
 */
const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  const p = path.join(__dirname, file);
  if (!fs.existsSync(p)) return;
  fs.readFileSync(p, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const eq = t.indexOf('=');
    if (eq === -1) return;
    const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  });
}
loadEnv('.env.local');
loadEnv('.env.example');

const { APPWRITE_ENDPOINT: ENDPOINT = 'https://cloud.appwrite.io/v1', APPWRITE_PROJECT_ID: PROJECT, APPWRITE_DATABASE_ID: DB_ID, APPWRITE_API_KEY: API_KEY } = process.env;
if (!PROJECT || !DB_ID) { console.error('✗ Missing APPWRITE_PROJECT_ID / APPWRITE_DATABASE_ID'); process.exit(1); }
if (!API_KEY) { console.error('✗ Missing APPWRITE_API_KEY in .env.local (Console → Settings → API Keys, scopes databases.read + databases.write)'); process.exit(1); }

let sdk;
try { sdk = require('node-appwrite'); } catch { console.error('✗ Run: npm install'); process.exit(1); }
const { Client, Databases, Query, ID, Permission, Role } = sdk;
const dbs = new Databases(new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = path.join(__dirname, '.migrate');
const perm = uid => [Permission.read(Role.user(uid)), Permission.update(Role.user(uid)), Permission.delete(Role.user(uid))];

async function listAll(coll) {
  const out = [];
  let cursor = null;
  for (;;) {
    const q = [Query.limit(100)];
    if (cursor) q.push(Query.cursorAfter(cursor));
    const r = await dbs.listDocuments(DB_ID, coll, q);
    out.push(...r.documents);
    if (r.documents.length < 100) return out;
    cursor = r.documents[r.documents.length - 1].$id;
  }
}
async function ensureAttr(coll, key, size) {
  try { await dbs.getAttribute(DB_ID, coll, key); console.log(`  · ${coll}.${key} exists`); return; }
  catch (e) { if (e.code !== 404) throw e; }
  await dbs.createStringAttribute(DB_ID, coll, key, size, false);
  console.log(`  + ${coll}.${key} String(${size})`);
  for (let i = 0; i < 30; i++) {           // wait until provisioned
    const a = await dbs.getAttribute(DB_ID, coll, key);
    if (a.status === 'available') return;
    if (a.status === 'failed') throw new Error(`attribute ${coll}.${key} failed`);
    await sleep(1000);
  }
}
async function loadAll() {
  const [companies, projects, customers, entries] = await Promise.all(['companies', 'projects', 'customers', 'entries'].map(listAll));
  const users = new Set([...companies, ...entries].map(d => d.user_id));
  const uid = process.env.MIGRATE_USER_ID || (users.size === 1 ? [...users][0] : null);
  if (!uid) { console.error('✗ Multiple users found; set MIGRATE_USER_ID. Users:', [...users].join(', ')); process.exit(1); }
  const mine = a => a.filter(d => d.user_id === uid);
  return { uid, companies: mine(companies), projects: mine(projects), customers: mine(customers), entries: mine(entries) };
}
const currentCompany = cos => [...cos].filter(c => !c.end_date).sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''))[0]
  || [...cos].sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''))[0];

async function schema() {
  console.log('— attributes —');
  await ensureAttr('projects', 'parent_id', 36);
  await ensureAttr('projects', 'company_id', 36);
  await ensureAttr('customers', 'company_id', 36);
  await ensureAttr('entries', 'challenges', 2000);

  const { uid, companies, projects, customers, entries } = await loadAll();
  const fallbackCo = [...companies].sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''))[0]?.$id || '';
  console.log(`\n— backfill company_id (user ${uid}) —`);
  for (const [coll, items, ref] of [['projects', projects, 'project_id'], ['customers', customers, 'customer_id']]) {
    for (const it of items) {
      if (it.company_id) continue;
      const cos = [...new Set(entries.filter(e => e[ref] === it.$id).map(e => e.company_id).filter(Boolean))];
      const [primary, ...others] = cos.length ? cos.sort((a, b) => entries.filter(e => e.company_id === b && e[ref] === it.$id).length - entries.filter(e => e.company_id === a && e[ref] === it.$id).length) : [fallbackCo];
      await dbs.updateDocument(DB_ID, coll, it.$id, { company_id: primary });
      console.log(`  ${coll}: ${it.name} → ${companies.find(c => c.$id === primary)?.name || primary}`);
      // Same name used under another company → give that company its own copy
      for (const co of others) {
        const { $id, $collectionId, $databaseId, $createdAt, $updatedAt, $permissions, $sequence, ...data } = it;
        const copy = await dbs.createDocument(DB_ID, coll, ID.unique(), { ...data, company_id: co, parent_id: coll === 'projects' ? '' : undefined }, perm(uid));
        const moved = entries.filter(e => e[ref] === it.$id && e.company_id === co);
        for (const e of moved) await dbs.updateDocument(DB_ID, 'entries', e.$id, { [ref]: copy.$id });
        console.log(`    ↳ split: copy for ${companies.find(c => c.$id === co)?.name || co}, ${moved.length} entries re-pointed`);
      }
    }
  }
  console.log('\n✓ schema done');
}

async function dump(days = 21) {
  const { companies, projects, customers, entries } = await loadAll();
  const co = currentCompany(companies);
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const pick = (d, keys) => Object.fromEntries(['$id', ...keys].map(k => [k, d[k]]));
  const data = {
    company: pick(co, ['name', 'role', 'start_date', 'end_date']),
    projects: projects.filter(p => p.company_id === co.$id).map(p => pick(p, ['name', 'parent_id', 'color', 'description'])),
    customers: customers.filter(c => c.company_id === co.$id).map(c => pick(c, ['name', 'type'])),
    entries: entries.filter(e => e.company_id === co.$id && (e.date || '') >= since).sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .map(e => pick(e, ['date', 'title', 'project_id', 'customer_id', 'hours', 'status', 'notes', 'skills', 'challenges'])),
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'current.json'), JSON.stringify(data, null, 2));
  console.log(`✓ ${data.entries.length} entries for ${co.name} since ${since} → .migrate/current.json`);
}

async function apply(file, yes) {
  const plan = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { uid, projects, customers, entries } = await loadAll();
  const co = plan.company_id;
  const log = (...a) => console.log((yes ? '' : '[dry-run] ') + a.join(' '));
  const write = async (fn) => (yes ? fn() : { $id: '(new)' });

  let roleId = plan.role.id;
  const role = roleId && projects.find(p => p.$id === roleId);
  if (role) {
    const patch = { parent_id: '', company_id: co, ...(plan.role.name && plan.role.name !== role.name ? { name: plan.role.name } : {}) };
    log(`role  ${role.name}${patch.name ? ' → ' + patch.name : ''} (top level, company stamped)`);
    await write(() => dbs.updateDocument(DB_ID, 'projects', roleId, patch));
  } else {
    log(`role  + ${plan.role.name}`);
    roleId = (await write(() => dbs.createDocument(DB_ID, 'projects', ID.unique(), { name: plan.role.name, color: plan.role.color || '#000000', parent_id: '', company_id: co, user_id: uid }, perm(uid)))).$id;
  }

  const keys = {};
  for (const p of plan.projects || []) {
    const ex = projects.find(x => x.company_id === co && x.parent_id === roleId && x.name === p.name);
    if (ex) { keys[p.key] = ex.$id; log(`proj  · ${p.name} exists`); continue; }
    log(`proj  + ${p.name}`);
    keys[p.key] = (await write(() => dbs.createDocument(DB_ID, 'projects', ID.unique(), { name: p.name, color: p.color || '#C38133', description: p.description || '', parent_id: roleId, company_id: co, user_id: uid }, perm(uid)))).$id;
  }
  for (const c of plan.customers || []) {
    const ex = customers.find(x => x.company_id === co && x.name === c.name);
    if (ex) { keys[c.key] = ex.$id; log(`cust  · ${c.name} exists`); continue; }
    log(`cust  + ${c.name}`);
    keys[c.key] = (await write(() => dbs.createDocument(DB_ID, 'customers', ID.unique(), { name: c.name, type: c.type || 'internal', color: c.color || '#5E5A52', company_id: co, user_id: uid }, perm(uid)))).$id;
  }

  for (const pe of plan.entries || []) {
    const e = entries.find(x => x.$id === pe.id);
    if (!e) { console.warn(`  ! entry ${pe.id} not found — skipped`); continue; }
    const patch = {};
    if (pe.project) patch.project_id = keys[pe.project] || pe.project;
    if (pe.customer !== undefined) patch.customer_id = pe.customer ? (keys[pe.customer] || pe.customer) : null;
    for (const f of ['title', 'notes', 'challenges', 'skills', 'status']) if (pe[f] !== undefined && pe[f] !== e[f]) patch[f] = pe[f];
    if (!Object.keys(patch).length) continue;
    log(`entry ${e.date} "${e.title}"`);
    for (const [k, v] of Object.entries(patch)) if (k !== 'title' || v !== e.title) log(`        ${k}: ${JSON.stringify(e[k] ?? '')} → ${JSON.stringify(v)}`);
    await write(() => dbs.updateDocument(DB_ID, 'entries', e.$id, patch));
  }
  console.log(yes ? '\n✓ applied' : '\nDry-run only. Re-run with --yes to write.');
}

const [cmd, arg, flag] = process.argv.slice(2);
({ schema, dump: () => dump(parseInt(arg, 10) || 21), apply: () => apply(arg, flag === '--yes') }[cmd] || (() => { console.log('usage: node migrate-roles.js schema | dump [days] | apply plan.json [--yes]'); }))()
  .catch(e => { console.error('\n✗', e.message); if (e.response) console.error(e.response); process.exit(1); });
