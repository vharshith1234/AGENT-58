/**
 * Additive seed: official Vignan faculty identities for non-CSE departments,
 * with DEMO timetables/allocations/workload. Does not wipe CSE REAL data.
 *
 * Run: node prisma/seed-demo-departments.js
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { emailFromName, findCredential, loginEmailFor } = require('./login-credentials');
const { DEPT_ACADEMIC, seedDepartmentAcademic } = require('./academic-years-lib');

const prisma = new PrismaClient();

const DIRECTORY_CANDIDATES = [
  path.join(__dirname, 'data', 'vignan-people.md'),
  path.join(
    process.env.USERPROFILE || '',
    '.cursor',
    'projects',
    'c-Users-yelet-Desktop-AGENT-58',
    'uploads',
    'people.php-0.md',
  ),
];

const SCHOOLS = [
  { code: 'SOCI', name: 'School of Computing and Informatics' },
  { code: 'SOE', name: 'School of Engineering' },
  { code: 'SOM', name: 'School of Management' },
];

const DEMO_DEPARTMENTS = [
  { code: 'IT', name: 'Information Technology', school: 'SOCI', dirCodes: ['IT'] },
  { code: 'CA', name: 'Computer Applications', school: 'SOCI', dirCodes: ['CA'] },
  { code: 'ACSE', name: 'Advanced Computer Science and Engineering', school: 'SOCI', dirCodes: ['ACSE'] },
  { code: 'ECE', name: 'Electronics and Communication Engineering', school: 'SOE', dirCodes: ['ECE'] },
  { code: 'EEE', name: 'Electrical and Electronics Engineering', school: 'SOE', dirCodes: ['EEE'] },
  { code: 'MECH', name: 'Mechanical Engineering', school: 'SOE', dirCodes: ['MECH'] },
  { code: 'CIVIL', name: 'Civil Engineering', school: 'SOE', dirCodes: ['CIVIL'] },
  { code: 'DMS', name: 'Management Studies', school: 'SOM', dirCodes: ['DMS'] },
];


const CSE_ENRICH_MATCHES = [
  { email: loginEmailFor('8925096166', 'dsenthil@vignan.ac.in'), tokens: ['senthil'] },
  { email: loginEmailFor('9492246551', 'jveeranjaneyulu@vignan.ac.in'), tokens: ['veeranjaneyulu'] },
  { email: loginEmailFor('8790696105', 'syednafeesahamed@vignan.ac.in'), tokens: ['nafees', 'ahamed'] },
  { email: loginEmailFor('7780112971', 'chpushya@vignan.ac.in'), tokens: ['pushya'] },
  { email: loginEmailFor('163', 'kvkrishnakishore@vignan.ac.in'), tokens: ['krishna', 'kishore'] },
  { email: loginEmailFor('675', 'svphanikumar@vignan.ac.in'), tokens: ['phani', 'kumar'] },
  { email: loginEmailFor('189', 'sdevakumar@vignan.ac.in'), tokens: ['deva', 'kumar'] },
];

function hoursBetween(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.round(((eh * 60 + em - (sh * 60 + sm)) / 60) * 1000) / 1000;
}

function slug(name) {
  return name
    .toLowerCase()
    .replace(/\b(dr|prof|mr|mrs|ms)\b\.?/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24);
}

function tokens(name) {
  return name
    .toLowerCase()
    .replace(/\b(dr|prof|mr|mrs|ms)\b\.?/g, ' ')
    .split(/[^a-z]+/)
    .filter((t) => t.length > 2);
}

function titleName(raw) {
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(dr|prof|mr|mrs|ms)\s*\.?\s*/i, (m) => {
      const t = m.trim().replace(/\./g, '').toLowerCase();
      const map = { dr: 'Dr.', prof: 'Prof.', mr: 'Mr.', mrs: 'Mrs.', ms: 'Ms.' };
      return (map[t] || 'Dr.') + ' ';
    })
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\b(Dr|Mr|Mrs|Ms|Prof)\b/g, (c) => c + (c.includes('.') ? '' : '.'))
    .replace(/\.\./g, '.');
}

function parseDirectory(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const start = lines.findIndex((l) => /^##\s*Faculty/i.test(l));
  const slice = start >= 0 ? lines.slice(start + 1) : lines;
  const nameRe = /^(dr|prof|mr|mrs|ms)\b/i;
  const desRe = /^(PROFESSOR|ASSOCIATE PROFESSOR|ASSISTANT PROFESSOR)\s*\(([^)]+)\)\s*$/i;
  const people = [];
  for (let i = 0; i < slice.length; i += 1) {
    const line = slice[i];
    if (!line || !nameRe.test(line) || line.length < 6) continue;
    let j = i + 1;
    while (j < slice.length && !slice[j]) j += 1;
    const des = slice[j] ? desRe.exec(slice[j]) : null;
    if (!des) continue;
    const interests = [];
    let k = j + 1;
    while (
      k < slice.length &&
      slice[k] &&
      !/^View Profile/i.test(slice[k]) &&
      !nameRe.test(slice[k]) &&
      !desRe.test(slice[k])
    ) {
      if (!/^(Head of the Department)$/i.test(slice[k])) interests.push(slice[k]);
      k += 1;
    }
    const dirCode = des[2].replace(/\s+/g, ' ').trim().toUpperCase();
    people.push({
      rawName: line,
      name: titleName(line),
      designation: `${des[1].replace(/\s+/g, ' ').trim()} (${dirCode})`,
      rank: des[1].toUpperCase().includes('ASSOCIATE')
        ? 2
        : des[1].toUpperCase().startsWith('PROFESSOR')
          ? 1
          : 3,
      dirCode,
      researchInterests: interests.join(' ').replace(/\s+/g, ' ').trim() || null,
      isHodHint: /head of the department/i.test(slice.slice(j, k).join(' ')),
    });
    i = j;
  }
  const seen = new Set();
  return people.filter((p) => {
    const key = `${slug(p.rawName)}|${p.dirCode}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pickFaculty(people, dirCodes, limit = 5) {
  const wanted = new Set(dirCodes);
  return people
    .filter((p) => wanted.has(p.dirCode))
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function matchDirectoryPerson(facultyName, people, dirCode = 'CSE') {
  const facTok = tokens(facultyName);
  const pool = people.filter((p) => p.dirCode === dirCode);
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
  if (bestScore >= 2) return { person: best, confidence: 'MATCHED' };
  if (bestScore === 1 && facTok.length <= 2) return { person: best, confidence: 'MATCHED' };
  return { person: null, confidence: 'UNMATCHED' };
}

async function tagCseReal() {
  const cse = await prisma.department.findFirst({ where: { code: 'CSE' } });
  if (!cse) return;
  await prisma.department.update({
    where: { id: cse.id },
    data: { dataSource: 'REAL' },
  });
  await prisma.faculty.updateMany({
    where: { departmentId: cse.id, status: 'Active', NOT: { dataSource: 'DEMO' } },
    data: { dataSource: 'REAL' },
  });
  await prisma.course.updateMany({
    where: { departmentId: cse.id, NOT: { dataSource: 'DEMO' } },
    data: { dataSource: 'REAL', semester: 7, section: '7', academicYear: '4' },
  });
  const cseFaculty = await prisma.faculty.findMany({
    where: { departmentId: cse.id, NOT: { dataSource: 'DEMO' } },
    select: { id: true },
  });
  const ids = cseFaculty.map((f) => f.id);
  if (ids.length) {
    await prisma.courseAllocation.updateMany({
      where: { facultyId: { in: ids }, NOT: { dataSource: 'DEMO' } },
      data: { dataSource: 'REAL', section: '7' },
    });
    await prisma.timetableSlot.updateMany({
      where: {
        dataSource: { not: 'DEMO' },
        OR: [{ facultyId: { in: ids } }, { course: { departmentId: cse.id, dataSource: { not: 'DEMO' } } }],
      },
      data: { dataSource: 'REAL', batchLabel: '7' },
    });
    await prisma.workloadSnapshot.updateMany({
      where: { facultyId: { in: ids } },
      data: { dataSource: 'REAL' },
    });
  }
}

async function enrichCseFromDirectory(people) {
  const csePeople = people.filter((p) => p.dirCode === 'CSE');
  const matched = [];
  const unmatched = [];
  const manual = [
    'Gabbi Reddy Keerthi vs directory Keerthi G — not merged.',
    'Sai Spandana Verella vs V. Sai Spandana — not merged.',
    'Bhathula Ninnagari — not found in directory listing.',
  ];
  for (const rule of CSE_ENRICH_MATCHES) {
    let faculty = await prisma.faculty.findUnique({ where: { email: rule.email } });
    if (!faculty) {
      const cseFaculty = await prisma.faculty.findMany({
        where: { department: { code: 'CSE' } },
      });
      faculty =
        cseFaculty.find((f) => rule.tokens.every((t) => tokens(f.name).includes(t))) || null;
    }
    if (!faculty) {
      unmatched.push(rule.email);
      continue;
    }
    const hit = csePeople.find((p) => {
      const pt = tokens(p.rawName);
      return rule.tokens.every((t) => pt.includes(t));
    });
    if (!hit) {
      unmatched.push(faculty.name);
      continue;
    }
    await prisma.faculty.update({
      where: { id: faculty.id },
      data: {
        identitySource: 'OFFICIAL',
        researchInterests: hit.researchInterests,
        designation: faculty.designation,
        specialization: hit.researchInterests,
        officialProfileUrl: 'https://vignan.ac.in/newvignan/people.php',
        photoUrl: faculty.photoUrl || null,
      },
    });
    matched.push({ name: faculty.name, directory: hit.name });
  }
  return { csePeople: csePeople.length, matched, unmatched, manual };
}

async function ensureAdminRoles() {
  const mapping = [
    {
      email: loginEmailFor('163', 'kvkrishnakishore@vignan.ac.in'),
      roleName: 'Dean',
      scopeLabel: 'School of Computing and Informatics',
      duration: 'Official administrative position',
    },
    {
      email: loginEmailFor('675', 'svphanikumar@vignan.ac.in'),
      roleName: 'HOD',
      scopeLabel: 'Computer Science and Engineering',
      duration: 'Official administrative position',
    },
    {
      email: loginEmailFor('189', 'sdevakumar@vignan.ac.in'),
      roleName: 'Principal',
      scopeLabel: 'Institution',
      duration: 'Official administrative position',
    },
  ];
  for (const row of mapping) {
    const faculty = await prisma.faculty.findUnique({ where: { email: row.email } });
    if (!faculty) continue;
    const existing = await prisma.adminResponsibility.findFirst({
      where: { facultyId: faculty.id, roleName: row.roleName },
    });
    if (existing) {
      await prisma.adminResponsibility.update({
        where: { id: existing.id },
        data: { scopeLabel: row.scopeLabel, duration: row.duration },
      });
    } else {
      await prisma.adminResponsibility.create({
        data: {
          facultyId: faculty.id,
          roleName: row.roleName,
          scopeLabel: row.scopeLabel,
          duration: row.duration,
        },
      });
    }
  }
}

async function persistDemoSnapshot(facultyId, total, periodId) {
  const min = 16;
  const expected = 18;
  const max = 20;
  const status = total < min ? 'UNDERLOAD' : total > max ? 'OVERLOAD' : 'NORMAL';
  await prisma.workloadSnapshot.create({
    data: {
      facultyId,
      periodId,
      teachingRaw: total,
      projectsRaw: 0,
      researchRaw: 0,
      adminRaw: 0,
      committeeRaw: 0,
      phdRaw: 0,
      teachingWeighted: total,
      projectsWeighted: 0,
      researchWeighted: 0,
      adminWeighted: 0,
      committeeWeighted: 0,
      phdWeighted: 0,
      total,
      status,
      provisionalTeaching: false,
      normMin: min,
      normExpected: expected,
      normMax: max,
      dataSource: 'DEMO',
      evidenceJson: JSON.stringify({ source: 'DEMO_ALLOCATION', note: 'Synthetic academic data' }),
    },
  });
}

async function seedDemoDepartments(people) {
  const schoolIds = {};
  for (const s of SCHOOLS) {
    const existing = await prisma.school.findUnique({ where: { code: s.code } });
    schoolIds[s.code] = existing
      ? existing.id
      : (await prisma.school.create({ data: s })).id;
  }

  const period = await prisma.academicPeriod.findFirst({ where: { isActive: true } });
  const report = {
    departments: [],
    faculty: 0,
    courses: 0,
    timetableEntries: 0,
    courseAllocations: 0,
    workloadCalculations: 0,
    skippedDepartments: [],
  };

  await prisma.timetableSlot.deleteMany({ where: { dataSource: 'DEMO' } });
  await prisma.courseAllocation.deleteMany({ where: { dataSource: 'DEMO' } });
  await prisma.course.deleteMany({ where: { dataSource: 'DEMO' } });
  await prisma.workloadSnapshot.deleteMany({ where: { dataSource: 'DEMO' } });

  for (const spec of DEMO_DEPARTMENTS) {
    const picked = pickFaculty(people, spec.dirCodes, 5);
    if (picked.length < 3) {
      report.skippedDepartments.push({ code: spec.code, found: picked.length });
      continue;
    }

    let dept = await prisma.department.findUnique({ where: { code: spec.code } });
    if (!dept) {
      dept = await prisma.department.create({
        data: {
          name: spec.name,
          code: spec.code,
          schoolId: schoolIds[spec.school],
          dataSource: 'DEMO',
        },
      });
    } else {
      dept = await prisma.department.update({
        where: { id: dept.id },
        data: { dataSource: 'DEMO', name: spec.name, schoolId: schoolIds[spec.school] },
      });
    }

    const existingNorm = await prisma.workloadNorm.findFirst({
      where: { departmentId: dept.id, isActive: true },
    });
    if (!existingNorm) {
      await prisma.workloadNorm.create({
        data: {
          departmentId: dept.id,
          min: 16,
          expected: 18,
          max: 20,
          effectiveFrom: new Date('2026-01-01'),
          isActive: true,
        },
      });
    }

    const facultyIds = [];
    for (const person of picked) {
      const facultyCode = `DEMO-${spec.code}-${slug(person.rawName)}`.slice(0, 40);
      const cred = findCredential({ facultyCode, name: person.name });
      const email = cred?.email || emailFromName(person.name);
      const legacyEmail = `demo.${spec.code.toLowerCase()}.${slug(person.rawName)}@vignan.ac.in`;
      const existing =
        (await prisma.faculty.findUnique({ where: { facultyCode } })) ||
        (await prisma.faculty.findUnique({ where: { email } })) ||
        (await prisma.faculty.findUnique({ where: { email: legacyEmail } }));
      const data = {
        facultyCode: existing?.facultyCode || facultyCode,
        name: person.name,
        email,
        departmentId: dept.id,
        designation: person.designation,
        qualification: person.rank <= 2 ? 'Ph.D' : 'Not specified',
        joiningDate: null,
        employmentType: 'Not specified',
        status: 'Active',
        dataSource: 'DEMO',
        identitySource: 'OFFICIAL',
        officialProfileUrl: 'https://vignan.ac.in/newvignan/people.php',
        researchInterests: person.researchInterests,
        specialization: person.researchInterests,
        photoUrl: existing?.photoUrl || null,
        employeeId: existing?.employeeId || facultyCode,
      };
      const row = existing
        ? await prisma.faculty.update({ where: { id: existing.id }, data })
        : await prisma.faculty.create({ data });
      facultyIds.push(row.id);
      await prisma.facultyAffiliation.upsert({
        where: {
          facultyId_departmentId: { facultyId: row.id, departmentId: dept.id },
        },
        update: { isPrimary: true },
        create: { facultyId: row.id, departmentId: dept.id, isPrimary: true },
      });
      report.faculty += 1;
    }

    const hodId = facultyIds[0];
    await prisma.department.update({
      where: { id: dept.id },
      data: { hodFacultyId: hodId },
    });
    const hodExisting = await prisma.adminResponsibility.findFirst({
      where: { facultyId: hodId, roleName: 'HOD' },
    });
    if (!hodExisting) {
      await prisma.adminResponsibility.create({
        data: {
          facultyId: hodId,
          roleName: 'HOD',
          scopeLabel: spec.name,
          duration: 'Demo department head (same person record; not a duplicate profile)',
        },
      });
    }

    const catalogSpec = DEPT_ACADEMIC[spec.code];
    if (!catalogSpec) {
      report.skippedDepartments.push({ code: spec.code, reason: 'no academic catalog' });
      continue;
    }
    const academic = await seedDepartmentAcademic(prisma, {
      dept,
      facultyIds,
      catalogSpec,
      roomPrefix: spec.code,
    });
    report.courses += academic.courses;
    report.timetableEntries += academic.timetableEntries;
    report.courseAllocations += academic.allocations;

    if (period) {
      for (const fid of facultyIds) {
        const teaching = academic.hoursByFaculty[fid] || 0;
        await persistDemoSnapshot(fid, teaching, period.id);
        report.workloadCalculations += 1;
      }
    }

    report.departments.push({
      code: spec.code,
      name: spec.name,
      faculty: facultyIds.length,
      hod: picked[0].name,
      years: [2, 3, 4],
      sections: ['A', 'B', 'C'],
      courses: academic.courses,
      allocations: academic.allocations,
    });
  }

  return report;
}

async function seedCseDemoAcademic(people) {
  const cse = await prisma.department.findFirst({ where: { code: 'CSE' } });
  if (!cse || !DEPT_ACADEMIC.CSE) {
    return { skipped: true, reason: 'CSE department missing' };
  }
  const existing = await prisma.faculty.findMany({
    where: { departmentId: cse.id },
    select: { id: true, name: true, email: true, facultyCode: true, dataSource: true },
  });
  const taken = new Set(
    existing.flatMap((f) => [slug(f.name), slug(f.email || ''), String(f.facultyCode || '').toLowerCase()]),
  );
  const extras = people
    .filter((p) => p.dirCode === 'CSE')
    .filter((p) => !taken.has(slug(p.rawName)) && !taken.has(slug(p.name)))
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
    .slice(0, 6);

  const facultyIds = [];
  for (const person of extras) {
    const facultyCode = `DEMO-CSE-${slug(person.rawName)}`.slice(0, 40);
    let email = emailFromName(person.name);
    const emailClash = await prisma.faculty.findUnique({ where: { email } });
    if (emailClash && emailClash.facultyCode !== facultyCode) {
      email = `demo.cse.${slug(person.rawName)}@vignan.ac.in`;
    }
    const found =
      (await prisma.faculty.findUnique({ where: { facultyCode } })) ||
      (await prisma.faculty.findUnique({ where: { email } }));
    const data = {
      facultyCode: found?.facultyCode || facultyCode,
      name: person.name,
      email: found?.email || email,
      departmentId: cse.id,
      designation: person.designation,
      qualification: person.rank <= 2 ? 'Ph.D' : 'Not specified',
      joiningDate: null,
      employmentType: 'Not specified',
      status: 'Active',
      dataSource: 'DEMO',
      identitySource: 'OFFICIAL',
      officialProfileUrl: 'https://vignan.ac.in/newvignan/people.php',
      researchInterests: person.researchInterests,
      specialization: person.researchInterests,
      photoUrl: found?.photoUrl || null,
      employeeId: found?.employeeId || facultyCode,
    };
    const row = found
      ? await prisma.faculty.update({ where: { id: found.id }, data })
      : await prisma.faculty.create({ data });
    await prisma.facultyAffiliation.upsert({
      where: {
        facultyId_departmentId: { facultyId: row.id, departmentId: cse.id },
      },
      update: { isPrimary: true },
      create: { facultyId: row.id, departmentId: cse.id, isPrimary: true },
    });
    facultyIds.push(row.id);
  }

  if (facultyIds.length < 3) {
    return {
      extraFaculty: extras.map((p) => p.name),
      skipped: true,
      reason: `Need at least 3 extra CSE directory people; found ${facultyIds.length}.`,
    };
  }

  const academic = await seedDepartmentAcademic(prisma, {
    dept: cse,
    facultyIds,
    catalogSpec: DEPT_ACADEMIC.CSE,
    roomPrefix: 'CSE',
  });
  const period = await prisma.academicPeriod.findFirst({ where: { isActive: true } });
  if (period) {
    for (const fid of facultyIds) {
      await persistDemoSnapshot(fid, academic.hoursByFaculty[fid] || 0, period.id);
    }
  }
  return {
    extraFaculty: extras.map((p) => p.name),
    courses: academic.courses,
    allocations: academic.allocations,
    timetableEntries: academic.timetableEntries,
    years: [2, 3, 4],
    sections: ['A', 'B', 'C'],
    note: 'CSE DEMO years 2–4 / sections A–C are assigned only to DEMO faculty. REAL Section-7 teaching is unchanged.',
  };
}

async function main() {
  const dirFile = DIRECTORY_CANDIDATES.find((p) => fs.existsSync(p));
  if (!dirFile) {
    throw new Error('Official Vignan directory markdown not found.');
  }
  const people = parseDirectory(fs.readFileSync(dirFile, 'utf8'));
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, 'vignan-directory.json'),
    JSON.stringify({ source: 'https://vignan.ac.in/newvignan/people.php', count: people.length, people }, null, 2),
  );

  await tagCseReal();
  const cseEnrich = await enrichCseFromDirectory(people);
  await ensureAdminRoles();
  const demo = await seedDemoDepartments(people);
  const cseDemo = await seedCseDemoAcademic(people);

  const cse = await prisma.department.findFirst({ where: { code: 'CSE' } });
  const cseFaculty = await prisma.faculty.findMany({
    where: { departmentId: cse?.id, status: 'Active', dataSource: 'REAL' },
    include: { user: true },
  });
  const teachingCse = cseFaculty.filter((f) => !f.user || f.user.role === 'FACULTY');
  const cseCourses = await prisma.course.count({ where: { departmentId: cse?.id, dataSource: 'REAL' } });
  const cseSlots = await prisma.timetableSlot.count({ where: { dataSource: 'REAL' } });
  const cseAlloc = await prisma.courseAllocation.count({ where: { dataSource: 'REAL' } });
  const duplicateEmails = [];
  const names = await prisma.faculty.groupBy({
    by: ['name'],
    _count: { name: true },
    having: { name: { _count: { gt: 1 } } },
  });

  const report = {
    sourceDirectory: 'https://vignan.ac.in/newvignan/people.php',
    directoryPeopleParsed: people.length,
    realCse: {
      uniqueTimetableFaculty: teachingCse.length,
      matchedFaculty: cseEnrich.matched.length,
      unmatched: cseEnrich.unmatched,
      manualVerification: cseEnrich.manual,
      officialImagesFound: teachingCse.filter((f) => f.photoUrl).length,
      officialImagesMissing: teachingCse.filter((f) => !f.photoUrl).length,
      courses: cseCourses,
      timetableEntries: cseSlots,
      courseAllocations: cseAlloc,
      note: 'CSE Section-7 timetable remains REAL. Years 2–4 / sections A–C are DEMO and assigned only to DEMO faculty.',
    },
    cseDemoAcademic: cseDemo,
    demoDepartments: demo,
    administrativeRoles: {
      hods: await prisma.adminResponsibility.count({ where: { roleName: 'HOD' } }),
      deans: await prisma.adminResponsibility.count({ where: { roleName: 'Dean' } }),
      principal: await prisma.adminResponsibility.count({ where: { roleName: 'Principal' } }),
      duplicatePeoplePrevented: true,
    },
    duplicateFacultyNames: names.map((n) => ({ name: n.name, count: n._count.name })),
    duplicateEmails,
  };

  const out = path.join(__dirname, 'demo-departments-validation.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nWrote ${out}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
