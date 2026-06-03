/**
 * enrich-data.js — fills the `skills` field on every existing entry by
 * inferring sensible skill tags from each task's title, notes and project.
 * Also seeds known certifications (AWS AI Practitioner) if not already added.
 *
 * Re-running is safe: entries that already have skills are skipped.
 *
 * Requires: same env as setup-appwrite.js
 *   APPWRITE_ENDPOINT  · APPWRITE_PROJECT_ID  · APPWRITE_DATABASE_ID
 *   APPWRITE_API_KEY   (databases.read + databases.write)
 *
 * Run:    node enrich-data.js
 */

const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  const p = path.join(__dirname, file);
  if (!fs.existsSync(p)) return;
  fs.readFileSync(p, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const eq = t.indexOf('='); if (eq === -1) return;
    const k = t.slice(0, eq).trim(); const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  });
}
loadEnv('.env.local');

const ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const PROJECT  = process.env.APPWRITE_PROJECT_ID;
const DB_ID    = process.env.APPWRITE_DATABASE_ID;
const API_KEY  = process.env.APPWRITE_API_KEY;
if (!API_KEY) { console.error('✗ APPWRITE_API_KEY missing in .env.local'); process.exit(1); }

const { Client, Databases, Query, ID } = require('node-appwrite');
const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
const dbs = new Databases(client);

// ── Skill-inference rules ──────────────────────────────────
// Keyword → skill tags. First match wins per task, then combined + deduped.
// Order matters: more specific phrases first.
const RULES = [
  // BMC product family
  [/\bbmc\s+ems\b/i,                   ['BMC EMS', 'IT Operations Management']],
  [/\baudit\s+log/i,                   ['BMC Helix', 'Audit Compliance', 'Logging']],
  [/\bmis\s+catalog/i,                 ['BMC Helix', 'ITSM', 'Service Catalog Management']],
  [/\bvendor\s+ticket|customization\b/i,['BMC Helix', 'Customization', 'Vendor Integration']],
  [/\bschedule\s+notification|notification.*bulk|bulk\s+closure/i,
                                       ['BMC Helix', 'Notifications', 'Workflow Automation']],
  [/\bdashboard/i,                     ['Dashboard Setup', 'Reporting']],
  [/\bonboard/i,                       ['Customer Onboarding', 'SLA Management']],
  [/\bvulnerab|security\s+fix/i,       ['Security Vulnerability Management', 'BMC Helix']],
  [/\bday\s+to\s+day|support\b/i,      ['BMC Helix', 'Technical Support', 'Incident Management']],
  [/\bkt\b|knowledge\s+transfer|mentoring/i,
                                       ['Knowledge Transfer', 'BMC Administration', 'Mentoring']],
  [/\bbmc\s+tal\s+setup|tal\s+setup/i, ['BMC Helix', 'Environment Setup', 'Customer Onboarding']],
  [/\btesting|qa\b/i,                  ['QA Testing', 'Bug Fixing']],
  // OneApp / domain
  [/oneapp.*domain|domain\s+change/i,  ['DNS', 'Domain Management', 'Customer Communication']],
  [/oneapp/i,                          ['OneApp Administration']],
  // AI / cloud — specific certs FIRST so they win over generic rules
  [/aws.*saa|aws.*solutions?\s+architect\s+associate/i,
                                       ['AWS', 'Solution Architecture', 'Cloud Computing', 'AWS Well-Architected Framework']],
  [/aws.*ai\s+practitioner/i,          ['AWS', 'AI/ML Fundamentals', 'Cloud Computing', 'Generative AI']],
  [/azure.*ai.*app.*agent|azure.*developer\s+associate|ai-102/i,
                                       ['Microsoft Azure', 'Azure AI Services', 'AI Agent Development', 'Prompt Engineering', 'Python']],
  [/azure.*ai.*foundations|ai-900/i,   ['Microsoft Azure', 'Azure AI', 'AI/ML Fundamentals']],
  [/aiops/i,                           ['AIOps', 'Machine Learning', 'Forecasting', 'Python']],
  [/garden\s+by\s+the\s+bay|gbtb/i,    ['AI/ML', 'Solution Architecture', 'Python', 'Proof of Concept']],
  [/\bpoc\b/i,                         ['Proof of Concept', 'Solution Architecture']],
  [/\bemail\s+rule|rpa\b/i,            ['BMC Helix', 'Workflow Automation', 'Email Configuration']],
  [/contact\s+list/i,                  ['BMC Helix', 'Data Management']],
  [/logo|branding/i,                   ['BMC Helix', 'UI Configuration', 'Stakeholder Management']],
  // Generic
  [/meeting|standup/i,                 ['Stakeholder Management', 'Client Communication']],
  [/sentosa/i,                         ['Stakeholder Management']],
];

// Allow re-applying skills with: node enrich-data.js --force
const FORCE = process.argv.includes('--force');

// Tasks that match these patterns are themselves certification exams →
// each should produce a certification row. Order: pattern, cert spec.
// validity = number of months until expiry (null = no expiry)
const CERT_FROM_TASK = [
  [/aws.*ai\s+practitioner.*(certification\s+exam|exam)/i,
    { name: 'AWS Certified AI Practitioner', issuer: 'Amazon Web Services', validity: 36 }],
  [/aws.*saa|aws.*solutions?\s+architect\s+associate.*(certificate|certification|exam)/i,
    { name: 'AWS Certified Solutions Architect – Associate', issuer: 'Amazon Web Services', validity: 36 }],
  [/azure.*ai.*app.*agent.*(developer\s+associate|certification)|ai-102/i,
    { name: 'Microsoft Certified: Azure AI Engineer Associate', issuer: 'Microsoft', validity: 12 }],
];

// Fallback by project name (when no keyword matches)
const PROJECT_DEFAULTS = {
  BMC:              ['BMC Helix', 'ITSM'],
  OneApp:           ['OneApp Administration'],
  'AI Engineering': ['AI/ML', 'Python'],
};

function inferSkills(title, notes, projectName) {
  const hay = (title + ' ' + (notes || '')).toLowerCase();
  const out = new Set();
  RULES.forEach(([re, tags]) => { if (re.test(hay)) tags.forEach(t => out.add(t)); });
  if (out.size === 0 && projectName && PROJECT_DEFAULTS[projectName]) {
    PROJECT_DEFAULTS[projectName].forEach(t => out.add(t));
  }
  return [...out].join(', ');
}

async function main() {
  console.log(`\n▶ Enriching ${PROJECT}/${DB_ID}\n`);

  // 1. Build project id → name lookup so we can use project defaults
  const projRes = await dbs.listDocuments(DB_ID, 'projects', [Query.limit(500)]);
  const projById = {};
  projRes.documents.forEach(p => { projById[p.$id] = p.name; });

  // 2. Walk every entry and fill skills if missing
  const entries = (await dbs.listDocuments(DB_ID, 'entries', [Query.limit(500)])).documents;
  console.log(`  ${entries.length} entries found\n`);

  let updated = 0, skipped = 0;
  for (const e of entries) {
    if (e.skills && e.skills.trim() && !FORCE) {
      console.log(`  · skip "${truncate(e.title, 50)}" — already has skills (use --force to override)`);
      skipped++; continue;
    }
    const skills = inferSkills(e.title || '', e.notes || '', projById[e.project_id]);
    if (!skills) { console.log(`  ? no inference for "${truncate(e.title, 50)}"`); continue; }
    if (e.skills === skills) { skipped++; continue; }
    await dbs.updateDocument(DB_ID, 'entries', e.$id, { skills });
    console.log(`  ${FORCE && e.skills ? '~' : '+'} "${truncate(e.title, 50)}"`);
    console.log(`       → ${skills}`);
    updated++;
  }

  console.log(`\n  Updated ${updated}, skipped ${skipped}\n`);

  // 3. Auto-create certifications from any task whose title looks like an
  //    exam / certification. Issue date = task date.
  const certs = (await dbs.listDocuments(DB_ID, 'certifications', [Query.limit(100)])).documents;
  const have  = new Set(certs.map(c => c.name.toLowerCase()));
  const companies = (await dbs.listDocuments(DB_ID, 'companies', [Query.limit(100)])).documents;
  const keppel = companies.find(c => /keppel/i.test(c.name));

  console.log('— certifications (auto-detected from cert tasks) —');
  let certsAdded = 0;
  for (const e of entries) {
    for (const [re, spec] of CERT_FROM_TASK) {
      if (!re.test(e.title || '')) continue;
      if (have.has(spec.name.toLowerCase())) {
        console.log(`  · "${spec.name}" already exists`);
        have.add(spec.name.toLowerCase()); // prevent duplicate per-task
        break;
      }
      const issue = e.date || todayISO();
      const expiry = spec.validity ? addMonths(issue, spec.validity) : '';
      const ownerId = e.user_id || entries[0]?.user_id;
      if (!ownerId) { console.warn('  ! could not derive user_id'); break; }
      await dbs.createDocument(DB_ID, 'certifications', ID.unique(), {
        name: spec.name,
        issuer: spec.issuer,
        issue_date: issue,
        expiry_date: expiry,
        credential_url: '',
        notes: `Auto-created from task: "${truncate(e.title, 60)}"`,
        company_id: keppel ? keppel.$id : null,
        user_id: ownerId,
      });
      console.log(`  + "${spec.name}"  · ${issue} → ${expiry || 'no expiry'}`);
      certsAdded++;
      have.add(spec.name.toLowerCase());
      break;
    }
  }
  if (certsAdded === 0) console.log('  (none to add)');

  console.log('\n✓ Done. Hard-refresh the app to see the skills + certs appear.');
  console.log('  Once you\'re happy, revoke the API key in Appwrite Console → Settings → API Keys.\n');
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function addMonths(yyyymmdd, n) {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  const dt = new Date(y, m - 1 + n, 1);
  const lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  dt.setDate(Math.min(d, lastDay));
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}

function truncate(s, n) { return (s || '').length > n ? s.slice(0, n - 1) + '…' : s; }

main().catch(e => { console.error('\n✗ Enrichment failed:', e.message); if (e.response) console.error(' ', e.response); process.exit(1); });
