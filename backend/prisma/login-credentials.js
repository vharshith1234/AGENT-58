/**
 * Shared login catalog: name@vignan.ac.in + Vignan@{8-digit}.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CATALOG_FILE = path.join(__dirname, 'login-credentials.json');
const README_FILE = path.join(__dirname, '..', '..', 'README.md');

function slugFromName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(dr|prof|mr|mrs|ms)\b\.?/g, ' ')
    .replace(/[^a-z0-9]+/g, '');
}

function emailFromName(name) {
  const slug = slugFromName(name);
  if (!slug) throw new Error(`Cannot build email from name: ${name}`);
  return `${slug}@vignan.ac.in`;
}

function uniqueEmail(baseEmail, used) {
  if (!used.has(baseEmail)) {
    used.add(baseEmail);
    return baseEmail;
  }
  const [local, domain] = baseEmail.split('@');
  let i = 2;
  let next = `${local}${i}@${domain}`;
  while (used.has(next)) {
    i += 1;
    next = `${local}${i}@${domain}`;
  }
  used.add(next);
  return next;
}

function uniquePin(used) {
  let pin;
  do {
    pin = String(crypto.randomInt(10000000, 100000000));
  } while (used.has(pin));
  used.add(pin);
  return pin;
}

function passwordFromPin(pin) {
  return `Vignan@${pin}`;
}

function loadCatalog() {
  if (!fs.existsSync(CATALOG_FILE)) return [];
  return JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
}

function saveCatalog(rows) {
  fs.writeFileSync(CATALOG_FILE, JSON.stringify(rows, null, 2));
}

function findCredential(query) {
  const catalog = loadCatalog();
  return (
    catalog.find((row) => query.facultyCode && row.facultyCode === query.facultyCode) ||
    catalog.find((row) => query.email && row.email === query.email) ||
    catalog.find((row) => query.email && (row.oldEmails || []).includes(query.email)) ||
    catalog.find((row) => query.name && row.name === query.name) ||
    null
  );
}

function byFacultyCode(code) {
  const row = findCredential({ facultyCode: code });
  if (!row) throw new Error(`No saved login for facultyCode ${code}`);
  return row;
}

function adminEmails() {
  const fromCatalog = loadCatalog()
    .filter((row) => ['HR', 'HOD', 'DEAN', 'PRINCIPAL'].includes(row.role))
    .map((row) => row.email);
  if (fromCatalog.length) return fromCatalog;
  return [
    'uttejkumarn@vignan.ac.in',
    'svphanikumar@vignan.ac.in',
    'kvkrishnakishore@vignan.ac.in',
    'sdevakumar@vignan.ac.in',
  ];
}

function keepLoginEmails() {
  const catalog = loadCatalog();
  const admin = adminEmails();
  const cse = catalog
    .filter((row) => row.role === 'FACULTY' && row.department === 'CSE')
    .map((row) => row.email);
  return [...new Set([...admin, ...cse])];
}

function passwordFor(facultyCode, fallbackCode) {
  const row = findCredential({ facultyCode });
  if (row) return row.password;
  const digits = String(fallbackCode || facultyCode || '').replace(/\D/g, '');
  return `Vignan@${digits || uniquePin(new Set())}`;
}

function loginEmailFor(facultyCode, fallbackEmail) {
  const row = findCredential({ facultyCode });
  if (row) return row.email;
  return fallbackEmail;
}

function mdTable(headers, rows) {
  const line = `| ${headers.join(' | ')} |`;
  const sep = `|${headers.map(() => '---').join('|')}|`;
  const body = rows.map((r) => `| ${r.join(' | ')} |`);
  return [line, sep, ...body].join('\n');
}

function writeReadme(catalog) {
  const admin = catalog.filter((r) => ['HR', 'HOD', 'DEAN', 'PRINCIPAL'].includes(r.role));
  const cse = catalog.filter((r) => r.role === 'FACULTY' && r.department === 'CSE');
  const demo = catalog.filter((r) => r.role === 'FACULTY' && r.department !== 'CSE');
  const roleOrder = { HR: 1, HOD: 2, DEAN: 3, PRINCIPAL: 4 };

  const cseOrder = [
    'Dr. Gabbi Reddy Keerthi',
    'Mr. Senthil D',
    'Mr. Syed Nafees Ahamed',
    'Ms. Pushya Chaparala',
    'Bhathula Ninnagari',
    'Mrs. V. Sai Spandana',
    'Dr. J. Veeranjaneyulu',
  ];
  const deptOrder = ['IT', 'CA', 'ACSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'DMS'];

  admin.sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);
  cse.sort((a, b) => {
    const ia = cseOrder.indexOf(a.name);
    const ib = cseOrder.indexOf(b.name);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  demo.sort((a, b) => {
    const da = deptOrder.indexOf(a.department);
    const db = deptOrder.indexOf(b.department);
    return (da === -1 ? 99 : da) - (db === -1 ? 99 : db) || a.name.localeCompare(b.name);
  });

  const contents = `# Agent 58 — Faculty Workload System

## Quick start

### Backend
\`\`\`bash
cd backend
npm install --legacy-peer-deps
npx prisma db push
npm run start:dev
\`\`\`
API: http://localhost:3000/api

### Frontend
\`\`\`bash
cd frontend
npm install
npm run dev
\`\`\`
App: http://localhost:5173/login

## Logins

Every account uses the same pattern:

- **Email:** \`name@vignan.ac.in\`
- **Password:** \`Vignan@\` followed by 8 random digits

Sign in at http://localhost:5173/login with the email and password below. Each account opens the matching dashboard.

### Admin

${mdTable(
    ['Name', 'Role', 'Email', 'Password'],
    admin.map((r) => [r.name, r.role, r.email, r.password]),
  )}

### CSE faculty (REAL)

${mdTable(
    ['Name', 'Email', 'Password'],
    cse.map((r) => [r.name, r.email, r.password]),
  )}

### Other-department faculty (DEMO academic data)

CSE academic data is **REAL**. Other departments use **DEMO** timetable/workload data until a real timetable is imported. Identities, photos, and profile details for those departments come from https://vignan.ac.in/newvignan/people.php

${mdTable(
    ['Department', 'Name', 'Email', 'Password'],
    demo.map((r) => [r.department, r.name, r.email, r.password]),
  )}

## Seed / import

\`\`\`bash
cd backend
npm run db:import:section7
npm run db:section7:logins
npm run db:seed:demo-depts
npm run db:enrich:official
npm run db:sync:official
\`\`\`

## Engine tests
\`\`\`bash
cd backend
npm run test:engine
\`\`\`

## Notes
- Weights/norms come from DB; what-if never writes; mutations recalculate snapshots.
- Agent 25/56 feeds are stub provider interfaces in the HOD module (no fake rows unless you insert them).
`;

  fs.writeFileSync(README_FILE, contents);
  return README_FILE;
}

module.exports = {
  CATALOG_FILE,
  README_FILE,
  slugFromName,
  emailFromName,
  uniqueEmail,
  uniquePin,
  passwordFromPin,
  loadCatalog,
  saveCatalog,
  findCredential,
  byFacultyCode,
  adminEmails,
  keepLoginEmails,
  passwordFor,
  loginEmailFor,
  writeReadme,
};
