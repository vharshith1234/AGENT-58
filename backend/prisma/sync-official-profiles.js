/**
 * Correct official names/details and attach directory photos
 * without changing login emails or passwords.
 *
 * Run: node prisma/sync-official-profiles.js
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { loadCatalog, saveCatalog, writeReadme } = require('./login-credentials');

const prisma = new PrismaClient();
const PEOPLE_URL = 'https://vignan.ac.in/newvignan/people.php';
const PROFILE_API = 'https://vignan.ac.in/newvignan/getfaculty.php';
const PHOTO_BASE = 'https://vignan.ac.in/Facultyprofiles/uploads';
const HTML_CACHE = path.join(__dirname, 'data', 'vignan-people.html');

const DEPT_BRANCH = {
  CSE: ['CSE'],
  IT: ['IT'],
  CA: ['CA'],
  ACSE: ['ACSE'],
  ECE: ['ECE'],
  EEE: ['EEE'],
  MECH: ['MECH'],
  CIVIL: ['CIVIL'],
  DMS: ['DMS', 'MGT', 'MBA', 'MS'],
};

const FORCE_EMPCODE = {
  '01918': '01918',
  '675': '675',
  '163': '163',
  '189': '189',
  '8925096166': '03082',
  '7780112971': '01988',
  '8790696105': '03361',
  '9492246551': '02194',
  '9948368555': '02696',
  '9491139513': '03259',
};

function tokens(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(dr|prof|mr|mrs|ms)\b\.?/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

function titleCaseName(raw) {
  let s = String(raw || '')
    .replace(/\s+/g, ' ')
    .trim();
  s = s.replace(/\s*\.\s*/g, '.');
  s = s.replace(/\.([A-Za-z]{2,})/g, '. $1');
  s = s.toLowerCase();
  s = s.replace(/(^|[\s.])([a-z])/g, (_, p, c) => p + c.toUpperCase());
  return s.replace(/\s+/g, ' ').trim();
}

function prettyDesignation(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\bhod\b/g, 'HoD')
    .replace(/\bphd\b/gi, 'Ph.D')
    .replace(/(^|[\s&,/-])([a-z])/g, (_, p, c) => p + c.toUpperCase())
    .replace(/\sAnd\s/g, ' and ')
    .replace(/\sOf\s/g, ' of ');
}

function isRealAdminLabel(value) {
  const v = String(value || '').trim();
  if (!v || v === '--NA--' || /^librarian$/i.test(v)) return false;
  return true;
}

const KEEP_TIMETABLE_NAME = new Set(['9491139513', '7842481619']);

function displayName(row) {
  const salutation = String(row.salutation || '')
    .replace(/\./g, '')
    .trim();
  const titled = titleCaseName(row.name);
  if (!salutation) return titled;
  const pretty = salutation
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ');
  if (titled.toLowerCase().startsWith(pretty.toLowerCase() + ' ')) return titled;
  return `${pretty}. ${titled}`.replace(/\.\./g, '.');
}

function designationOf(row) {
  const desig = prettyDesignation(row.desig || row.actualdesig || '');
  const extras = [row.adminpos, row.deans]
    .filter(isRealAdminLabel)
    .map(prettyDesignation);
  if (!desig) return extras[0] || 'Not specified';
  if (!extras.length) return desig;
  return `${desig} & ${extras.join(' & ')}`;
}

function photoUrlFor(row) {
  const pic = String(row.profilepic || '').trim();
  const emp = String(row.empcode || '').trim();
  const id = String(row.id || '').trim();
  if (!pic || /no\s*file|default|placeholder/i.test(pic)) return null;
  const folder = emp || id;
  return `${PHOTO_BASE}/${folder}/${pic}`;
}

function loadDirectory() {
  const html = fs.readFileSync(HTML_CACHE, 'utf8');
  const marker = html.indexOf('var data =');
  if (marker < 0) throw new Error('Official directory JSON not found in cached people.php');
  const start = html.indexOf('[', marker);
  let depth = 0;
  let end = -1;
  for (let p = start; p < html.length; p += 1) {
    if (html[p] === '[') depth += 1;
    else if (html[p] === ']') {
      depth -= 1;
      if (depth === 0) {
        end = p;
        break;
      }
    }
  }
  if (end < 0) throw new Error('Official directory JSON is truncated');
  const rows = JSON.parse(html.slice(start, end + 1));
  return rows.filter((r) => r.name);
}

function scoreMatch(faculty, row) {
  const facTok = tokens(faculty.name);
  const rowTok = tokens(`${row.salutation || ''} ${row.name || ''}`);
  const overlap = facTok.filter((t) => rowTok.includes(t)).length;
  const branch = String(row.branch || '').toUpperCase();
  const allowed = DEPT_BRANCH[faculty.department.code] || [];
  const sameDept = allowed.includes(branch);
  let score = overlap;
  if (sameDept) score += 2;
  const emp = String(row.empcode || '');
  if (faculty.employeeId && faculty.employeeId === emp) score += 8;
  if (faculty.facultyCode && faculty.facultyCode === emp) score += 8;
  return { score, overlap, sameDept, row };
}

function pickRow(faculty, directory) {
  const forced = FORCE_EMPCODE[faculty.facultyCode];
  if (forced) {
    const hit =
      directory.find((r) => String(r.empcode) === forced) ||
      directory.find((r) => String(r.id) === forced);
    if (hit) return { row: hit, score: 99, forced: true };
  }
  const allowed = DEPT_BRANCH[faculty.department.code];
  const pool = allowed
    ? directory.filter((r) => allowed.includes(String(r.branch || '').toUpperCase()))
    : directory;
  let best = null;
  for (const row of pool) {
    const s = scoreMatch(faculty, row);
    if (!best || s.score > best.score) best = s;
  }
  if (best && (best.score >= 4 || (best.overlap >= 2 && best.sameDept))) return best;
  return { row: null, score: best?.score || 0 };
}

function joinField(arr, key) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr
    .map((row) => {
      const value = row[key] || row.interest || row.expeirence || row.facultyeducation;
      const extra = row.date || row.fromdt || '';
      return extra ? `${value} (${extra})` : value;
    })
    .filter(Boolean)
    .join('; ');
}

async function fetchOfficialProfile(id) {
  const res = await fetch(PROFILE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0',
    },
    body: `id=${encodeURIComponent(id)}`,
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function mapLimit(items, limit, fn) {
  const out = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

async function main() {
  const directory = loadDirectory();
  const facultyRows = await prisma.faculty.findMany({
    where: { user: { status: 'ACTIVE' } },
    include: { department: true, user: true },
    orderBy: [{ name: 'asc' }],
  });

  const report = { updated: [], missingPhoto: [], unmatched: [] };

  await mapLimit(facultyRows, 4, async (fac) => {
    const picked = pickRow(fac, directory);
    if (!picked.row) {
      report.unmatched.push({ name: fac.name, email: fac.email, department: fac.department.code });
      return;
    }
    const row = picked.row;
    const official =
      (await fetchOfficialProfile(row.empcode)) ||
      (await fetchOfficialProfile(row.id));
    const name = KEEP_TIMETABLE_NAME.has(fac.facultyCode)
      ? fac.name
      : displayName(row);
    const photoUrl = photoUrlFor(row);
    const education = joinField(official?.facultyeducation, 'facultyeducation');
    const experience = joinField(official?.expeirence, 'expeirence');
    const interests =
      joinField(official?.interests, 'interest') || fac.researchInterests;
    const phone =
      (official?.personalcontact && official.personalcontact !== 'Not Available'
        ? official.personalcontact
        : null) ||
      (row.personalcontact && row.personalcontact !== 'Not Available'
        ? row.personalcontact
        : null) ||
      fac.phone;
    const designation = designationOf(official || row);

    await prisma.faculty.update({
      where: { id: fac.id },
      data: {
        name,
        designation,
        qualification: /phd|ph\.d/i.test(String(row.desig) + String(education || ''))
          ? 'Ph.D'
          : fac.qualification,
        phone,
        photoUrl,
        employeeId: row.empcode || fac.employeeId,
        identitySource: 'OFFICIAL',
        officialProfileUrl: PEOPLE_URL,
        researchInterests: interests,
        academicExperience: experience,
        education,
        specialization: interests || fac.specialization,
      },
    });
    if (fac.user) {
      await prisma.user.update({
        where: { id: fac.user.id },
        data: {
          name,
          photoUrl,
        },
      });
    }
    const item = {
      department: fac.department.code,
      name,
      email: fac.email,
      photoUrl,
      empcode: row.empcode,
      officialName: row.name,
    };
    report.updated.push(item);
    if (!photoUrl) report.missingPhoto.push(item);
  });

  const catalog = loadCatalog().map((row) => {
    const hit = report.updated.find((u) => u.email === row.email);
    return hit ? { ...row, name: hit.name } : row;
  });
  saveCatalog(catalog);
  writeReadme(catalog);

  const stillMissing = await prisma.user.findMany({
    where: { status: 'ACTIVE', OR: [{ photoUrl: null }, { photoUrl: '' }] },
    select: { name: true, email: true, role: true, photoUrl: true },
  });

  console.log(JSON.stringify({
    directoryRows: directory.length,
    facultyConsidered: facultyRows.length,
    updated: report.updated.length,
    unmatched: report.unmatched,
    missingPhoto: report.missingPhoto,
    usersWithoutPhoto: stillMissing,
  }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
