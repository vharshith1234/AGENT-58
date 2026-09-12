/**
 * Attach official Vignan directory photos + profile details, and
 * create Faculty logins for DEMO-department people.
 *
 * Source: https://vignan.ac.in/newvignan/people.php
 * Photos: https://vignan.ac.in/Facultyprofiles/uploads/{id}/profilepic{id}.*
 * Details: POST https://vignan.ac.in/newvignan/getfaculty.php
 *
 * Run: node prisma/enrich-official-profiles.js
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const {
  emailFromName,
  keepLoginEmails,
  passwordFor,
  findCredential,
} = require('./login-credentials');

const prisma = new PrismaClient();
const PEOPLE_URL = 'https://vignan.ac.in/newvignan/people.php';
const PROFILE_API = 'https://vignan.ac.in/newvignan/getfaculty.php';
const HTML_CACHE = path.join(__dirname, 'data', 'vignan-people.html');

const DEPT_DIR = {
  IT: ['IT'],
  CA: ['CA'],
  ACSE: ['ACSE'],
  ECE: ['ECE'],
  EEE: ['EEE'],
  MECH: ['MECH'],
  CIVIL: ['CIVIL'],
  DMS: ['DMS'],
  CSE: ['CSE'],
};

const CSE_FORCE_MATCH = [
  { email: 'dsenthil@vignan.ac.in', tokens: ['senthil'] },
  { email: 'jveeranjaneyulu@vignan.ac.in', tokens: ['veeranjaneyulu'] },
  { email: 'syednafeesahamed@vignan.ac.in', tokens: ['nafees', 'ahamed'] },
  { email: 'chpushya@vignan.ac.in', tokens: ['pushya'] },
  { email: 'kvkrishnakishore@vignan.ac.in', tokens: ['krishna', 'kishore'] },
  { email: 'svphanikumar@vignan.ac.in', tokens: ['phani', 'kumar'] },
  { email: 'sdevakumar@vignan.ac.in', tokens: ['deva', 'kumar'] },
  { email: 'uttejkumarn@vignan.ac.in', tokens: ['uttej'] },
];

const KEEP_LOGIN_EMAILS = new Set(keepLoginEmails());

function tokens(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(dr|prof|mr|mrs|ms)\b\.?/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

function parseCards(html) {
  const people = [];
  const re =
    /class="faculty-img"[^>]*src=([^\s>]+)[^>]*>[\s\S]*?id="([^"]+)"[\s\S]*?class="aboutus-div-56">([^<]+)[\s\S]*?class="faculty-branch">([^<]+)[\s\S]*?class="faculty-interest">([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(html))) {
    const src = m[1].replace(/['"]/g, '');
    const directoryId = m[2].trim();
    const rawName = m[3].replace(/\s+/g, ' ').trim();
    const branch = m[4].replace(/\s+/g, ' ').trim();
    const research = m[5]
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const dirMatch = /\(([^)]+)\)/.exec(branch);
    let photoUrl = null;
    if (src && !/placeholder|default|no[-_]?image/i.test(src)) {
      photoUrl = src.startsWith('http')
        ? src
        : new URL(src, PEOPLE_URL).href;
    }
    people.push({
      directoryId,
      rawName,
      branch,
      dirCode: (dirMatch?.[1] || '').trim().toUpperCase(),
      research: research || null,
      photoUrl,
    });
  }
  return people;
}

function bestMatch(facultyName, pool) {
  const facTok = tokens(facultyName);
  let best = null;
  let bestScore = 0;
  for (const p of pool) {
    const pt = tokens(p.rawName);
    const overlap = facTok.filter((t) => pt.includes(t)).length;
    if (overlap > bestScore) {
      best = p;
      bestScore = overlap;
    }
  }
  if (bestScore >= 2) return { person: best, score: bestScore };
  if (bestScore === 1 && facTok.length <= 2) return { person: best, score: bestScore };
  return { person: null, score: 0 };
}

async function fetchHtml() {
  if (fs.existsSync(HTML_CACHE) && fs.statSync(HTML_CACHE).size > 100000) {
    return fs.readFileSync(HTML_CACHE, 'utf8');
  }
  const res = await fetch(PEOPLE_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const html = await res.text();
  const dir = path.dirname(HTML_CACHE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(HTML_CACHE, html);
  return html;
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

function pickLoginEmail(faculty) {
  const saved = findCredential({ facultyCode: faculty.facultyCode, name: faculty.name, email: faculty.email });
  if (saved) return saved.email;
  return emailFromName(faculty.name);
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

async function ensureFacultyLogin(faculty) {
  const saved = findCredential({ facultyCode: faculty.facultyCode, name: faculty.name, email: faculty.email });
  const password = saved
    ? saved.password
    : passwordFor(faculty.facultyCode, faculty.facultyCode);
  const passwordHash = await bcrypt.hash(password, 10);
  const dept = await prisma.department.findUnique({
    where: { id: faculty.departmentId },
  });
  const data = {
    email: faculty.email,
    passwordHash,
    name: faculty.name,
    role: 'FACULTY',
    status: faculty.status === 'Active' ? 'ACTIVE' : 'INACTIVE',
    facultyId: faculty.id,
    departmentId: faculty.departmentId,
    schoolId: dept?.schoolId || null,
    photoUrl: faculty.photoUrl || null,
  };
  const byFaculty = await prisma.user.findUnique({ where: { facultyId: faculty.id } });
  if (byFaculty) {
    if (KEEP_LOGIN_EMAILS.has(byFaculty.email)) {
      await prisma.user.update({
        where: { id: byFaculty.id },
        data: { photoUrl: faculty.photoUrl || byFaculty.photoUrl, name: faculty.name },
      });
      return { email: byFaculty.email, password, existing: true };
    }
    await prisma.user.update({ where: { id: byFaculty.id }, data });
    return { email: faculty.email, password, existing: true };
  }
  const byEmail = await prisma.user.findUnique({ where: { email: faculty.email } });
  if (byEmail) {
    await prisma.user.update({
      where: { id: byEmail.id },
      data: { ...data, role: byEmail.role === 'FACULTY' ? 'FACULTY' : byEmail.role },
    });
    return { email: faculty.email, password, existing: true };
  }
  await prisma.user.create({ data });
  return { email: faculty.email, password, existing: false };
}

async function main() {
  const html = await fetchHtml();
  const directory = parseCards(html);
  fs.writeFileSync(
    path.join(__dirname, 'data', 'vignan-directory-html.json'),
    JSON.stringify({ source: PEOPLE_URL, count: directory.length }, null, 2),
  );

  const facultyRows = await prisma.faculty.findMany({
    where: { status: 'Active' },
    include: { department: true, user: true },
  });

  const report = {
    directoryCards: directory.length,
    photosAssigned: 0,
    photosSkipped: [],
    detailsEnriched: 0,
    logins: [],
  };

  const jobs = [];
  for (const fac of facultyRows) {
    const dirCodes = DEPT_DIR[fac.department.code];
    if (!dirCodes) continue;
    const pool = directory.filter((p) => dirCodes.includes(p.dirCode));
    const forced = CSE_FORCE_MATCH.find(
      (r) =>
        r.email === fac.email ||
        (fac.department.code === 'CSE' &&
          r.tokens.every((t) => tokens(fac.name).includes(t))),
    );
    let person = null;
    if (forced) {
      person =
        pool.find((p) => forced.tokens.every((t) => tokens(p.rawName).includes(t))) || null;
    } else if (fac.dataSource === 'DEMO') {
      person = bestMatch(fac.name, pool).person;
    }
    if (!person) {
      report.photosSkipped.push({ name: fac.name, reason: 'no confident directory match' });
      continue;
    }
    jobs.push({ fac, person });
  }

  await mapLimit(jobs, 4, async ({ fac, person }) => {
    const official = await fetchOfficialProfile(person.directoryId);
    const education = joinField(official?.facultyeducation, 'facultyeducation');
    const experience = joinField(official?.expeirence, 'expeirence');
    const interests =
      joinField(official?.interests, 'interest') || person.research || fac.researchInterests;
    const nextEmail = KEEP_LOGIN_EMAILS.has(fac.email)
      ? fac.email
      : pickLoginEmail(fac);
    const emailTaken =
      nextEmail !== fac.email
        ? await prisma.faculty.findUnique({ where: { email: nextEmail } })
        : null;
    const email = emailTaken ? fac.email : nextEmail;
    const phone =
      official?.personalcontact || official?.contact || fac.phone || null;
    const photoUrl = person.photoUrl || fac.photoUrl;
    await prisma.faculty.update({
      where: { id: fac.id },
      data: {
        email,
        phone: phone && phone !== 'Not Available' ? phone : fac.phone,
        photoUrl,
        identitySource: 'OFFICIAL',
        officialProfileUrl: PEOPLE_URL,
        researchInterests: interests,
        academicExperience: experience,
        education,
        specialization: interests || fac.specialization,
        employeeId: official?.empcode || fac.employeeId,
        designation: official?.desig
          ? `${official.salutation ? `${official.salutation}. ` : ''}${official.desig}${official.adminpos && official.adminpos !== '--NA--' ? ` & ${official.adminpos}` : ''}`.replace(/^\. /, '')
          : fac.designation,
      },
    });
    if (photoUrl) report.photosAssigned += 1;
    report.detailsEnriched += 1;
  });

  const demoFaculty = await prisma.faculty.findMany({
    where: { dataSource: 'DEMO', status: 'Active' },
    include: { department: true },
    orderBy: [{ departmentId: 'asc' }, { name: 'asc' }],
  });
  for (const fac of demoFaculty) {
    const login = await ensureFacultyLogin(fac);
    report.logins.push({
      department: fac.department.code,
      name: fac.name,
      email: login.email,
      password: login.password,
      photo: Boolean(fac.photoUrl),
    });
  }

  const cseMatched = await prisma.faculty.findMany({
    where: { email: { in: [...KEEP_LOGIN_EMAILS] } },
    select: { name: true, email: true, photoUrl: true },
  });
  for (const row of cseMatched) {
    if (!row.photoUrl) continue;
    await prisma.user.updateMany({
      where: { email: row.email },
      data: { photoUrl: row.photoUrl },
    });
  }

  const outJson = path.join(__dirname, 'demo-faculty-logins.json');
  fs.writeFileSync(outJson, JSON.stringify(report, null, 2));
  const lines = [
    '# Other-department Faculty logins (DEMO academic data)',
    '',
    'Canonical Name / Email / Password tables are in the project README.',
    '',
    'Email: `name@vignan.ac.in`',
    'Password: `Vignan@{8-digit}`',
    '',
    'Official photos and profile details come from https://vignan.ac.in/newvignan/people.php',
    '',
    '| Department | Faculty | Email | Password |',
    '|---|---|---|---|',
    ...report.logins.map(
      (r) => `| ${r.department} | ${r.name} | ${r.email} | ${r.password} |`,
    ),
    '',
  ];
  fs.writeFileSync(path.join(__dirname, 'demo-faculty-logins.md'), lines.join('\n'));
  console.log(JSON.stringify({
    directoryCards: report.directoryCards,
    photosAssigned: report.photosAssigned,
    photosSkipped: report.photosSkipped.length,
    detailsEnriched: report.detailsEnriched,
    loginsCreated: report.logins.length,
  }, null, 2));
  console.log(`\nWrote ${outJson}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
