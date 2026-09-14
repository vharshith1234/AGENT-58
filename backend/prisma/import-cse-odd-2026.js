/**
 * Import parsed CSE Odd-2026 JSON into Postgres (REAL CSE only).
 * Run after: node prisma/parse-cse-odd-2026.js
 * Or: npm run db:import:cse-odd2026
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const {
  findCredential,
  loadCatalog,
  saveCatalog,
  uniquePin,
  passwordFromPin,
} = require('./login-credentials');
const { DATA_DIR } = require('./parse-cse-odd-2026');

const prisma = new PrismaClient();

const ADMIN_ROLE_BY_EMP = {
  '163': 'DEAN',
  '675': 'HOD',
  '189': 'PRINCIPAL',
  '01918': 'HR',
  163: 'DEAN',
  675: 'HOD',
  189: 'PRINCIPAL',
  1918: 'HR',
};

const KNOWN_EMAIL_ALIASES = {
  'kvkkishore@vignan.ac.in': 'kvkrishnakishore@vignan.ac.in',
  'sdk_cse@vignan.ac.in': 'sdevakumar@vignan.ac.in',
  'drsvpk_cse@vignan.ac.in': 'svphanikumar@vignan.ac.in',
  'ukn_cse@vignan.ac.in': 'uttejkumarn@vignan.ac.in',
};

function parsePrescribed(prescribed) {
  if (!prescribed) return { min: 16, expected: 18, max: 20 };
  const m = String(prescribed).match(/(\d+)\s*[-–]\s*(\d+)/);
  if (!m) return { min: 16, expected: 18, max: 20 };
  const min = Number(m[1]);
  const max = Number(m[2]);
  const expected = Math.round((min + max) / 2);
  return { min, expected, max };
}

function statusFor(total, norms) {
  if (total < norms.min) return 'UNDERLOAD';
  if (total > norms.max) return 'OVERLOAD';
  return 'NORMAL';
}

function courseTypeFromLTP(L, T, P) {
  if (P > 0 && L === 0 && T === 0) return 'LABORATORY';
  if (P > 0 && L > 0) return 'THEORY'; // mixed; allocations store hours as teaching contact
  if (T > 0 && L === 0) return 'TUTORIAL';
  return 'THEORY';
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'));
}

async function ensureBootstrap() {
  let school = await prisma.school.findUnique({ where: { code: 'SOCI' } });
  if (!school) {
    school = await prisma.school.create({
      data: { code: 'SOCI', name: 'School of Computing and Informatics' },
    });
  }
  let cse = await prisma.department.findUnique({ where: { code: 'CSE' } });
  if (!cse) {
    cse = await prisma.department.create({
      data: {
        code: 'CSE',
        name: 'Computer Science and Engineering',
        schoolId: school.id,
        dataSource: 'REAL',
      },
    });
  } else if (cse.dataSource !== 'REAL') {
    cse = await prisma.department.update({
      where: { id: cse.id },
      data: { dataSource: 'REAL' },
    });
  }

  let period = await prisma.academicPeriod.findFirst({ where: { isActive: true } });
  if (!period) {
    period = await prisma.academicPeriod.create({
      data: {
        code: 'ODD-2026',
        name: 'Odd Semester 2026-27',
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-12-15'),
        isActive: true,
      },
    });
  }

  const policyCount = await prisma.workloadPolicy.count();
  if (policyCount === 0) {
    const policies = [
      { activityType: 'THEORY', weight: 1 },
      { activityType: 'TUTORIAL', weight: 1 },
      { activityType: 'LAB', weight: 0.5 },
      { activityType: 'UG_PROJECT', weight: 0.5 },
      { activityType: 'PG_PROJECT', weight: 1 },
      { activityType: 'PHD', weight: 1.5 },
      { activityType: 'COMMITTEE', weight: 0.5 },
      { activityType: 'ADMIN_ROLE', weight: 2 },
      { activityType: 'RESEARCH', weight: 1 },
    ];
    for (const p of policies) {
      await prisma.workloadPolicy.create({
        data: { ...p, effectiveFrom: new Date('2026-01-01'), isActive: true },
      });
    }
  }
  const normCount = await prisma.workloadNorm.count();
  if (normCount === 0) {
    await prisma.workloadNorm.create({
      data: {
        departmentId: cse.id,
        min: 16,
        expected: 18,
        max: 20,
        effectiveFrom: new Date('2026-01-01'),
        isActive: true,
      },
    });
  }

  return { school, cse, period };
}

function resolveLoginEmail(sheetEmail) {
  const e = String(sheetEmail || '').toLowerCase();
  return KNOWN_EMAIL_ALIASES[e] || e;
}

function normalizeEmp(code) {
  const s = String(code || '').trim();
  if (!s) return '';
  return s.replace(/^0+/, '') || '0';
}

function registerFacultyEmp(map, empCode, entry) {
  const variants = new Set([
    String(empCode),
    normalizeEmp(empCode),
    String(empCode).padStart(5, '0'),
  ]);
  for (const v of variants) {
    if (v) map.set(v, entry);
  }
}

async function ensureCredentialFor(facultyRow) {
  const email = resolveLoginEmail(facultyRow.email);
  let cred =
    findCredential({ email }) ||
    findCredential({ facultyCode: facultyRow.empCode }) ||
    findCredential({ name: facultyRow.name });
  if (cred) {
    if (!cred.facultyCode) cred.facultyCode = facultyRow.empCode;
    return { ...cred, email: resolveLoginEmail(cred.email) || email };
  }
  const catalog = loadCatalog();
  const usedPins = new Set(catalog.map((r) => r.pin).filter(Boolean));
  const pin = uniquePin(usedPins);
  cred = {
    name: facultyRow.name,
    email,
    facultyCode: facultyRow.empCode,
    role: ADMIN_ROLE_BY_EMP[facultyRow.empCode] || 'FACULTY',
    pin,
    password: passwordFromPin(pin),
  };
  catalog.push(cred);
  saveCatalog(catalog);
  return cred;
}

async function main() {
  const facultyRows = readJson('faculty.json');
  const courseRows = readJson('courses.json');
  const allocationRows = readJson('allocations.json');

  const { school, cse, period } = await ensureBootstrap();

  const facultyByEmp = new Map();
  let createdFaculty = 0;
  let updatedFaculty = 0;
  let usersUpserted = 0;

  for (const row of facultyRows) {
    const loginEmail = resolveLoginEmail(row.email);
    const cred = await ensureCredentialFor({ ...row, email: loginEmail });

    // Prefer match by employeeId, then email, then facultyCode (incl. zero-padded variants)
    const empVariants = [
      row.empCode,
      String(row.empCode).replace(/^0+/, '') || '0',
      String(row.empCode).padStart(5, '0'),
    ];
    let existing =
      (await prisma.faculty.findFirst({ where: { employeeId: { in: empVariants } } })) ||
      (await prisma.faculty.findUnique({ where: { email: loginEmail } }).catch(() => null)) ||
      (await prisma.faculty.findFirst({
        where: {
          OR: [
            { facultyCode: { in: empVariants } },
            { facultyCode: `CSE-${row.empCode}` },
          ],
        },
      }));

    // Special: existing Kolluru seed used email kpk_cse and code CSE-KPK
    if (!existing && row.empCode === '01350') {
      existing = await prisma.faculty.findFirst({
        where: { OR: [{ email: 'kpk_cse@vignan.ac.in' }, { facultyCode: 'CSE-KPK' }] },
      });
    }

    const teachingEngagements = [
      ...new Set(
        allocationRows.filter((a) => a.empCode === row.empCode).map((a) => a.courseName),
      ),
    ];

    const baseData = {
      name: row.name,
      email: cred.email || existing?.email || loginEmail,
      phone: row.phone,
      designation: row.designation,
      employeeId: row.empCode,
      departmentId: cse.id,
      dataSource: 'REAL',
      identitySource: 'OFFICIAL',
      status: 'Active',
      employmentType: /contract|associate|teaching associate/i.test(row.designation)
        ? 'Contract'
        : 'Regular',
      qualification: /prof|ph\.?d|dr\./i.test(`${row.designation} ${row.name}`)
        ? 'Ph.D'
        : 'M.Tech',
    };

    // Keep photo / profileExtras if already present (KPK etc.)
    const createData = {
      ...baseData,
      facultyCode: existing?.facultyCode || row.empCode,
      joiningDate: existing?.joiningDate || new Date('2018-01-01'),
      profileExtras: existing?.profileExtras || {
        teachingEngagements,
        administrativePositions: row.additionalDuties
          ? [{ role: row.additionalDuties, date: '2026 Odd' }]
          : [],
      },
      researchInterests: existing?.researchInterests || null,
      academicExperience: existing?.academicExperience || null,
      education: existing?.education || null,
      specialization: existing?.specialization || teachingEngagements.slice(0, 3).join(' · ') || null,
      photoUrl: existing?.photoUrl || null,
      photoThumbUrl: existing?.photoThumbUrl || null,
    };

    let faculty;
    if (existing) {
      faculty = await prisma.faculty.update({
        where: { id: existing.id },
        data: {
          ...baseData,
          facultyCode: existing.facultyCode,
          specialization: existing.specialization || createData.specialization,
          profileExtras: existing.profileExtras || createData.profileExtras,
          // never clear photo
          photoUrl: existing.photoUrl,
          photoThumbUrl: existing.photoThumbUrl,
        },
      });
      updatedFaculty += 1;
    } else {
      // facultyCode uniqueness
      let code = row.empCode;
      const codeTaken = await prisma.faculty.findUnique({ where: { facultyCode: code } });
      if (codeTaken) code = `CSE-${row.empCode}`;
      faculty = await prisma.faculty.create({
        data: { ...createData, facultyCode: code },
      });
      createdFaculty += 1;
    }

    await prisma.facultyAffiliation.upsert({
      where: {
        facultyId_departmentId: { facultyId: faculty.id, departmentId: cse.id },
      },
      create: { facultyId: faculty.id, departmentId: cse.id, isPrimary: true },
      update: { isPrimary: true },
    });

    // Admin duties as AdminResponsibility
    if (row.additionalDuties) {
      const existingAdmin = await prisma.adminResponsibility.findFirst({
        where: { facultyId: faculty.id, roleName: row.additionalDuties },
      });
      if (!existingAdmin) {
        await prisma.adminResponsibility.create({
          data: {
            facultyId: faculty.id,
            roleName: row.additionalDuties,
            scopeLabel: 'CSE',
            duration: '2026 Odd Semester',
          },
        });
      }
    }

    const desiredRole = ADMIN_ROLE_BY_EMP[row.empCode] || 'FACULTY';
    const existingUser =
      (await prisma.user.findUnique({ where: { email: loginEmail } })) ||
      (existing?.email
        ? await prisma.user.findUnique({ where: { email: existing.email } })
        : null);

    const passwordHash = await bcrypt.hash(cred.password, 10);
    if (existingUser) {
      // Preserve elevated roles; only set FACULTY if currently FACULTY/missing
      const keepRole =
        ['HR', 'HOD', 'DEAN', 'PRINCIPAL'].includes(existingUser.role) ||
        ['HR', 'HOD', 'DEAN', 'PRINCIPAL'].includes(desiredRole)
          ? existingUser.role === 'FACULTY' && desiredRole !== 'FACULTY'
            ? desiredRole
            : ['HR', 'HOD', 'DEAN', 'PRINCIPAL'].includes(existingUser.role)
              ? existingUser.role
              : desiredRole
          : desiredRole;

      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          email: cred.email || loginEmail,
          name: row.name,
          facultyId: faculty.id,
          departmentId: cse.id,
          schoolId: school.id,
          role: keepRole,
          status: 'ACTIVE',
          photoUrl: existingUser.photoUrl || faculty.photoUrl,
          // Do not rotate passwords for existing admin accounts
          ...(['HR', 'HOD', 'DEAN', 'PRINCIPAL'].includes(existingUser.role)
            ? {}
            : { passwordHash }),
        },
      });
    } else {
      await prisma.user.create({
        data: {
          email: cred.email || loginEmail,
          passwordHash,
          name: row.name,
          role: desiredRole,
          status: 'ACTIVE',
          facultyId: faculty.id,
          departmentId: cse.id,
          schoolId: school.id,
          photoUrl: faculty.photoUrl,
        },
      });
    }
    usersUpserted += 1;
    registerFacultyEmp(facultyByEmp, row.empCode, { faculty, row, cred, loginEmail });
  }

  // Set HOD on department if present
  const hod = facultyByEmp.get('675') || facultyByEmp.get('00675');
  if (hod) {
    await prisma.department.update({
      where: { id: cse.id },
      data: { hodFacultyId: hod.faculty.id },
    });
  }

  // Courses
  let coursesUpserted = 0;
  const courseByCode = new Map();
  for (const c of courseRows) {
    const semester = (() => {
      const y = String(c.year || '').toUpperCase();
      if (y.includes('IV') || y === '4') return 7;
      if (y.includes('III') || y === '3') return 5;
      if (y.includes('II') || y === '2') return 3;
      return 1;
    })();
    const hoursPerWeek = Number(c.L || 0) + Number(c.T || 0) + Number(c.P || 0) || Number(c.C) || 3;
    const course = await prisma.course.upsert({
      where: { code_departmentId: { code: c.code, departmentId: cse.id } },
      create: {
        code: c.code,
        name: c.name,
        semester,
        credits: Number(c.C) || hoursPerWeek,
        type: courseTypeFromLTP(c.L, c.T, c.P),
        hoursPerWeek,
        students: Number(c.studentStrength) || 60,
        academicYear: '2026-27',
        status: 'ACTIVE',
        dataSource: 'REAL',
        departmentId: cse.id,
      },
      update: {
        name: c.name,
        semester,
        credits: Number(c.C) || hoursPerWeek,
        type: courseTypeFromLTP(c.L, c.T, c.P),
        hoursPerWeek,
        students: Number(c.studentStrength) || 60,
        status: 'ACTIVE',
        dataSource: 'REAL',
      },
    });
    courseByCode.set(c.code, course);
    coursesUpserted += 1;
  }

  // Ensure allocation course codes exist
  for (const a of allocationRows) {
    if (courseByCode.has(a.courseCode)) continue;
    const hoursPerWeek = Number(a.L || 0) + Number(a.T || 0) + Number(a.P || 0) || Number(a.hours) || 3;
    const course = await prisma.course.upsert({
      where: { code_departmentId: { code: a.courseCode, departmentId: cse.id } },
      create: {
        code: a.courseCode,
        name: a.courseName,
        semester: Number(a.year) ? Number(a.year) * 2 - 1 : 1,
        credits: Number(a.C) || hoursPerWeek,
        type: courseTypeFromLTP(a.L, a.T, a.P),
        hoursPerWeek,
        students: Number(a.students) || 70,
        academicYear: '2026-27',
        status: 'ACTIVE',
        dataSource: 'REAL',
        departmentId: cse.id,
      },
      update: {
        name: a.courseName,
        dataSource: 'REAL',
        status: 'ACTIVE',
      },
    });
    courseByCode.set(a.courseCode, course);
    coursesUpserted += 1;
  }

  // Ensure WL-only people (on Faculty WL but not FL) get REAL faculty profiles
  let wlOnlyFaculty = 0;
  const uniqueWl = new Map();
  for (const a of allocationRows) {
    const key = normalizeEmp(a.empCode) || a.empCode;
    if (!key) continue;
    if (
      facultyByEmp.get(a.empCode) ||
      facultyByEmp.get(key) ||
      facultyByEmp.get(String(a.empCode).padStart(5, '0'))
    ) {
      continue;
    }
    if (!uniqueWl.has(key)) uniqueWl.set(key, a);
  }
  for (const [, a] of uniqueWl) {
    const loginEmail = resolveLoginEmail(
      (a.name || 'faculty')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.+|\.+$/g, '')
        .slice(0, 40) +
        '.' +
        normalizeEmp(a.empCode) +
        '@vignan.ac.in',
    );
    const cred = await ensureCredentialFor({
      empCode: String(a.empCode),
      name: a.name,
      email: loginEmail,
    });
    let code = String(a.empCode);
    if (await prisma.faculty.findUnique({ where: { facultyCode: code } })) {
      code = `CSE-${normalizeEmp(a.empCode)}`;
    }
    let faculty =
      (await prisma.faculty.findFirst({
        where: { employeeId: { in: [String(a.empCode), normalizeEmp(a.empCode), String(a.empCode).padStart(5, '0')] } },
      })) ||
      (await prisma.faculty.findUnique({ where: { email: loginEmail } }).catch(() => null));

    if (faculty) {
      faculty = await prisma.faculty.update({
        where: { id: faculty.id },
        data: {
          name: a.name || faculty.name,
          designation: a.designation || faculty.designation,
          employeeId: String(a.empCode),
          departmentId: cse.id,
          dataSource: 'REAL',
          status: 'Active',
        },
      });
    } else {
      faculty = await prisma.faculty.create({
        data: {
          facultyCode: code,
          name: a.name || `Faculty ${a.empCode}`,
          email: loginEmail,
          phone: null,
          departmentId: cse.id,
          designation: a.designation || 'Faculty',
          qualification: /prof|dr\./i.test(`${a.designation} ${a.name}`) ? 'Ph.D' : 'M.Tech',
          joiningDate: new Date('2018-01-01'),
          employmentType: 'Regular',
          status: 'Active',
          dataSource: 'REAL',
          identitySource: 'WORKLOAD_SHEET',
          employeeId: String(a.empCode),
        },
      });
      wlOnlyFaculty += 1;
    }

    await prisma.facultyAffiliation.upsert({
      where: {
        facultyId_departmentId: { facultyId: faculty.id, departmentId: cse.id },
      },
      create: { facultyId: faculty.id, departmentId: cse.id, isPrimary: true },
      update: { isPrimary: true },
    });

    const existingUser = await prisma.user.findUnique({ where: { email: faculty.email } });
    const passwordHash = await bcrypt.hash(cred.password, 10);
    if (!existingUser) {
      await prisma.user.create({
        data: {
          email: faculty.email,
          passwordHash,
          name: faculty.name,
          role: 'FACULTY',
          status: 'ACTIVE',
          facultyId: faculty.id,
          departmentId: cse.id,
          schoolId: school.id,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          facultyId: faculty.id,
          departmentId: cse.id,
          schoolId: school.id,
          status: 'ACTIVE',
          ...(['HR', 'HOD', 'DEAN', 'PRINCIPAL'].includes(existingUser.role)
            ? {}
            : { passwordHash, role: 'FACULTY' }),
        },
      });
    }

    const syntheticRow = {
      empCode: String(a.empCode),
      name: a.name,
      designation: a.designation,
      prescribed: a.prescribed,
      additionalDuties: a.additionalDuties,
      sheetTotalWorkloadWeek: a.totalWorkloadWeek,
      email: faculty.email,
    };
    registerFacultyEmp(facultyByEmp, String(a.empCode), {
      faculty,
      row: syntheticRow,
      cred,
      loginEmail: faculty.email,
    });
  }

  // Replace REAL allocations for all imported faculty (FL + WL-only)
  const importedFacultyIds = [
    ...new Set([...facultyByEmp.values()].map((x) => x.faculty.id)),
  ];
  await prisma.courseAllocation.deleteMany({
    where: {
      facultyId: { in: importedFacultyIds },
      dataSource: 'REAL',
    },
  });

  let allocationsCreated = 0;
  let allocationsSkipped = 0;
  const hoursByFaculty = new Map();
  for (const a of allocationRows) {
    const entry =
      facultyByEmp.get(a.empCode) ||
      facultyByEmp.get(normalizeEmp(a.empCode)) ||
      facultyByEmp.get(String(a.empCode).padStart(5, '0'));
    let course = courseByCode.get(a.courseCode);
    if (!course && a.courseCode) {
      const hoursPerWeek =
        Number(a.L || 0) + Number(a.T || 0) + Number(a.P || 0) || Number(a.hours) || 3;
      course = await prisma.course.upsert({
        where: { code_departmentId: { code: a.courseCode, departmentId: cse.id } },
        create: {
          code: a.courseCode,
          name: a.courseName || a.courseCode,
          semester: Number(a.year) ? Number(a.year) * 2 - 1 : 1,
          credits: Number(a.C) || hoursPerWeek,
          type: courseTypeFromLTP(a.L || 0, a.T || 0, a.P || 0),
          hoursPerWeek,
          students: Number(a.students) || 70,
          academicYear: '2026-27',
          status: 'ACTIVE',
          dataSource: 'REAL',
          departmentId: cse.id,
        },
        update: { name: a.courseName || a.courseCode, dataSource: 'REAL', status: 'ACTIVE' },
      });
      courseByCode.set(a.courseCode, course);
    }
    if (!entry || !course) {
      allocationsSkipped += 1;
      continue;
    }
    await prisma.courseAllocation.create({
      data: {
        courseId: course.id,
        facultyId: entry.faculty.id,
        hours: Number(a.hours),
        section: a.section || null,
        dataSource: 'REAL',
        justification: a.additionalDuties || null,
      },
    });
    allocationsCreated += 1;
    const empKey = normalizeEmp(a.empCode) || a.empCode;
    hoursByFaculty.set(empKey, (hoursByFaculty.get(empKey) || 0) + Number(a.hours));
  }

  // Snapshots
  await prisma.workloadSnapshot.deleteMany({
    where: {
      facultyId: { in: importedFacultyIds },
      periodId: period.id,
    },
  });

  const statusHistogram = { UNDERLOAD: 0, NORMAL: 0, OVERLOAD: 0 };
  const seenFacultyIds = new Set();
  for (const [empCode, entry] of facultyByEmp) {
    // facultyByEmp has padded variants — snapshot once per faculty id
    if (seenFacultyIds.has(entry.faculty.id)) continue;
    seenFacultyIds.add(entry.faculty.id);

    const norms = parsePrescribed(entry.row.prescribed);
    const sheetTotal = Number(entry.row.sheetTotalWorkloadWeek);
    const empKey = normalizeEmp(entry.row.empCode) || entry.row.empCode;
    const summed = Number(hoursByFaculty.get(empKey) || 0);
    const total = sheetTotal > 0 ? sheetTotal : summed;
    const teachingWeighted = total;
    const status = statusFor(total, {
      min: norms.min,
      expected: norms.expected,
      max: norms.max,
    });
    statusHistogram[status] = (statusHistogram[status] || 0) + 1;

    // Use global norms for engine consistency but status from prescribed band
    const globalMin = 16;
    const globalExpected = 18;
    const globalMax = 20;

    await prisma.workloadSnapshot.create({
      data: {
        facultyId: entry.faculty.id,
        periodId: period.id,
        teachingRaw: total,
        projectsRaw: 0,
        researchRaw: 0,
        adminRaw: 0,
        committeeRaw: 0,
        phdRaw: 0,
        teachingWeighted,
        projectsWeighted: 0,
        researchWeighted: 0,
        adminWeighted: 0,
        committeeWeighted: 0,
        phdWeighted: 0,
        total,
        status,
        provisionalTeaching: false,
        normMin: norms.min || globalMin,
        normExpected: norms.expected || globalExpected,
        normMax: norms.max || globalMax,
        dataSource: 'REAL',
        evidenceJson: JSON.stringify({
          source: 'CSE_ODD_2026_WORKBOOK',
          empCode,
          prescribed: entry.row.prescribed || null,
          sheetTotalWorkloadWeek: entry.row.sheetTotalWorkloadWeek || null,
          summedAllocationHours: summed,
        }),
      },
    });
  }

  // Soft-deactivate leftover CSE REAL faculty not in this FL import (keep admins)
  const importedEmp = new Set(facultyRows.map((r) => r.empCode));
  const leftover = await prisma.faculty.findMany({
    where: { departmentId: cse.id, dataSource: 'REAL', status: 'Active' },
    include: { user: true },
  });
  let deactivatedLeftover = 0;
  for (const fac of leftover) {
    const emp = fac.employeeId || fac.facultyCode;
    if (importedEmp.has(emp) || importedEmp.has(String(emp).padStart(5, '0'))) continue;
    if (fac.user && ['HR', 'HOD', 'DEAN', 'PRINCIPAL'].includes(fac.user.role)) continue;
    // Keep if email matches an imported login
    const matchedImport = [...facultyByEmp.values()].some(
      (x) => x.faculty.id === fac.id || x.loginEmail === fac.email,
    );
    if (matchedImport) continue;
    await prisma.faculty.update({
      where: { id: fac.id },
      data: { status: 'Inactive' },
    });
    if (fac.user && fac.user.role === 'FACULTY') {
      await prisma.user.update({
        where: { id: fac.user.id },
        data: { status: 'INACTIVE' },
      });
    }
    deactivatedLeftover += 1;
  }

  const kpk = facultyByEmp.get('01350');
  const kpkSnap = kpk
    ? await prisma.workloadSnapshot.findFirst({
        where: { facultyId: kpk.faculty.id, periodId: period.id },
        orderBy: { calculatedAt: 'desc' },
      })
    : null;
  const kpkAllocs = await prisma.courseAllocation.findMany({
    where: { facultyId: kpk?.faculty.id, dataSource: 'REAL' },
    include: { course: true },
  });

  const validation = {
    facultyParsed: facultyRows.length,
    facultyCreated: createdFaculty,
    facultyUpdated: updatedFaculty,
    usersUpserted,
    coursesUpserted,
    allocationsParsed: allocationRows.length,
    allocationsCreated,
    allocationsSkipped,
    wlOnlyFaculty,
    snapshots: seenFacultyIds.size,
    statusHistogram,
    cseFacultyInDb: await prisma.faculty.count({
      where: { departmentId: cse.id, dataSource: 'REAL', status: 'Active' },
    }),
    deactivatedLeftover,
    kpk: kpk
      ? {
          empCode: '01350',
          facultyId: kpk.faculty.id,
          email: kpk.faculty.email,
          photoUrl: kpk.faculty.photoUrl,
          total: kpkSnap?.total,
          status: kpkSnap?.status,
          courses: kpkAllocs.map((a) => ({
            code: a.course.code,
            name: a.course.name,
            hours: a.hours,
            section: a.section,
          })),
        }
      : null,
  };

  fs.writeFileSync(
    path.join(DATA_DIR, 'cse-odd-2026-validation.json'),
    JSON.stringify(validation, null, 2),
  );
  console.log(JSON.stringify(validation, null, 2));
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { main };
