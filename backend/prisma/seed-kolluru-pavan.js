/**
 * Upsert Mr. Kolluru Pavan Kumar (CSE Assistant Professor) with profile,
 * photo, teaching load, and login.
 *
 * Run: node prisma/seed-kolluru-pavan.js
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const {
  findCredential,
  saveCatalog,
  loadCatalog,
} = require('./login-credentials');

const prisma = new PrismaClient();

const EMAIL = 'kpk_cse@vignan.ac.in';
const NAME = 'Mr. Kolluru Pavan Kumar';
const FACULTY_CODE = 'CSE-KPK';
const PHOTO = '/uploads/faculty/kolluru-pavan-kumar.png';
const FIXED_PIN = '72846193';

const PROFILE_EXTRAS = {
  researchInterestsList: ['Computer Networks', 'Predictive Analysis'],
  teachingEngagements: [
    'Compiler Design',
    'Operating Systems',
    'Python Programming',
    'Programming in C',
    'Computer Networks',
  ],
  academicExperienceList: [
    { org: 'VFSTRU, Vadlamudi', from: '2016 June', to: '2023 January' },
    { org: 'GHRCEM, Pune', from: '2014 June', to: '2016 June' },
  ],
  educationList: [
    { degree: 'M.Tech', year: '2010 January' },
    { degree: 'Ph.D', year: '2020 January' },
  ],
  publications: [
    {
      title:
        'Exploring Time-Series Forecasting Model for Accurate Dynamic Stock Price Prediction using Facebook Prophet',
      date: '2024 April',
    },
    {
      title: 'An Enhanced Convolution Neural Network Approach with Higher Classification rate for Images',
      date: '2023 January',
    },
  ],
  conferences: [{ name: 'ICSCSS 2024', date: '2023 January' }],
  events: [{ name: 'Alumni Interaction sessions', date: '2024 January' }],
  administrativePositions: [{ role: 'Alumni Coordinator', date: '2024 January' }],
};

const COURSES = [
  { code: 'CSE-CD', name: 'Compiler Design', hours: 4, type: 'THEORY', semester: 6 },
  { code: 'CSE-OS', name: 'Operating Systems', hours: 3, type: 'THEORY', semester: 4 },
  { code: 'CSE-PY', name: 'Python Programming', hours: 3, type: 'LABORATORY', semester: 3 },
  { code: 'CSE-C', name: 'Programming in C', hours: 3, type: 'LABORATORY', semester: 2 },
  { code: 'CSE-CN', name: 'Computer Networks', hours: 4, type: 'THEORY', semester: 5 },
];

async function main() {
  const cse = await prisma.department.findUnique({ where: { code: 'CSE' } });
  if (!cse) throw new Error('CSE department missing — run db:seed:real first');

  const period =
    (await prisma.academicPeriod.findFirst({ where: { isActive: true } })) ||
    (await prisma.academicPeriod.create({
      data: {
        code: 'ODD-2026',
        name: 'Odd Semester 2026',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-12-31'),
        isActive: true,
      },
    }));

  const researchInterests = PROFILE_EXTRAS.researchInterestsList.join('\n');
  const academicExperience = PROFILE_EXTRAS.academicExperienceList
    .map((e) => `${e.org} — ${e.from} to ${e.to}`)
    .join('\n');
  const education = PROFILE_EXTRAS.educationList
    .map((e) => `${e.degree} (${e.year})`)
    .join('\n');

  // Prefer official Emp 01350 from Odd-2026 import when present
  let existing =
    (await prisma.faculty.findFirst({ where: { employeeId: '01350' } })) ||
    (await prisma.faculty.findUnique({ where: { email: EMAIL } })) ||
    (await prisma.faculty.findUnique({ where: { facultyCode: FACULTY_CODE } }));

  const hasOdd2026Cn =
    existing &&
    (await prisma.courseAllocation.count({
      where: {
        facultyId: existing.id,
        dataSource: 'REAL',
        course: { code: '24CS303' },
      },
    })) > 0;

  const faculty = existing
    ? await prisma.faculty.update({
        where: { id: existing.id },
        data: {
          email: existing.email || EMAIL,
          phone: existing.phone || '9440781558',
          designation: existing.designation || 'Assistant Professor',
          qualification: existing.qualification || 'M.Tech, Ph.D',
          employeeId: '01350',
          researchInterests: existing.researchInterests || researchInterests,
          academicExperience: existing.academicExperience || academicExperience,
          education: existing.education || education,
          specialization:
            existing.specialization || 'Computer Networks · Predictive Analysis',
          profileExtras: existing.profileExtras || PROFILE_EXTRAS,
          photoUrl: PHOTO,
          photoThumbUrl: PHOTO,
          dataSource: 'REAL',
          status: 'Active',
        },
      })
    : await prisma.faculty.create({
        data: {
          facultyCode: FACULTY_CODE,
          name: NAME,
          email: EMAIL,
          phone: '9440781558',
          departmentId: cse.id,
          designation: 'Assistant Professor',
          qualification: 'M.Tech, Ph.D',
          joiningDate: new Date('2016-06-01'),
          employmentType: 'Regular',
          status: 'Active',
          dataSource: 'REAL',
          identitySource: 'OFFICIAL',
          researchInterests,
          academicExperience,
          education,
          specialization: 'Computer Networks · Predictive Analysis',
          profileExtras: PROFILE_EXTRAS,
          photoUrl: PHOTO,
          photoThumbUrl: PHOTO,
          employeeId: '01350',
        },
      });

  await prisma.facultyAffiliation.upsert({
    where: {
      facultyId_departmentId: { facultyId: faculty.id, departmentId: cse.id },
    },
    create: { facultyId: faculty.id, departmentId: cse.id, isPrimary: true },
    update: { isPrimary: true },
  });

  let cred = findCredential({ email: EMAIL }) || findCredential({ facultyCode: '01350' }) || findCredential({ facultyCode: FACULTY_CODE });
  if (!cred) {
    const catalog = loadCatalog();
    cred = {
      name: faculty.name || NAME,
      email: EMAIL,
      facultyCode: '01350',
      role: 'FACULTY',
      pin: FIXED_PIN,
      password: `Vignan@${FIXED_PIN}`,
    };
    catalog.push(cred);
    saveCatalog(catalog);
  } else {
    cred.password = cred.password || `Vignan@${cred.pin || FIXED_PIN}`;
  }

  const passwordHash = await bcrypt.hash(cred.password, 10);
  await prisma.user.upsert({
    where: { email: EMAIL },
    create: {
      email: EMAIL,
      passwordHash,
      name: faculty.name || NAME,
      role: 'FACULTY',
      status: 'ACTIVE',
      photoUrl: PHOTO,
      facultyId: faculty.id,
      departmentId: cse.id,
      schoolId: cse.schoolId,
    },
    update: {
      passwordHash,
      name: faculty.name || NAME,
      photoUrl: PHOTO,
      facultyId: faculty.id,
      departmentId: cse.id,
      schoolId: cse.schoolId,
      role: 'FACULTY',
      status: 'ACTIVE',
    },
  });

  if (hasOdd2026Cn) {
    console.log(
      JSON.stringify(
        {
          mode: 'photo-profile-only',
          empCode: '01350',
          email: faculty.email,
          photoUrl: PHOTO,
          note: 'Skipped synthetic courses/snapshot — Odd-2026 Computer Networks (24CS303) already present',
        },
        null,
        2,
      ),
    );
    return;
  }

  // Legacy fallback teaching load (only when Odd-2026 import not present)
  for (const c of COURSES) {
    const course = await prisma.course.upsert({
      where: { code_departmentId: { code: c.code, departmentId: cse.id } },
      create: {
        code: c.code,
        name: c.name,
        semester: c.semester,
        credits: c.hours,
        type: c.type,
        hoursPerWeek: c.hours,
        students: 60,
        section: 'A',
        academicYear: '2025-26',
        status: 'ACTIVE',
        dataSource: 'REAL',
        departmentId: cse.id,
      },
      update: {
        name: c.name,
        hoursPerWeek: c.hours,
        type: c.type,
        status: 'ACTIVE',
      },
    });

    const existing = await prisma.courseAllocation.findFirst({
      where: { courseId: course.id, facultyId: faculty.id },
    });
    if (existing) {
      await prisma.courseAllocation.update({
        where: { id: existing.id },
        data: { hours: c.hours, dataSource: 'REAL', section: 'A' },
      });
    } else {
      await prisma.courseAllocation.create({
        data: {
          courseId: course.id,
          facultyId: faculty.id,
          hours: c.hours,
          section: 'A',
          dataSource: 'REAL',
        },
      });
    }
  }

  // Sample project supervision
  const existingProject = await prisma.project.findFirst({
    where: { guideId: faculty.id, title: 'Predictive Analytics Capstone' },
  });
  if (!existingProject) {
    await prisma.project.create({
      data: {
        title: 'Predictive Analytics Capstone',
        studentCount: 4,
        guideId: faculty.id,
        semester: 8,
        level: 'UG',
        guideShare: 1,
        academicYear: '2025-26',
        status: 'ACTIVE',
      },
    });
  }

  // Research commitment
  const existingResearch = await prisma.researchCommitment.findFirst({
    where: { facultyId: faculty.id },
  });
  if (!existingResearch) {
    await prisma.researchCommitment.create({
      data: {
        facultyId: faculty.id,
        projectTitle: 'Time-series forecasting & CNN image classification',
        role: 'INVESTIGATOR',
        commitmentPct: 10,
        status: 'Active',
      },
    });
  }

  // Alumni Coordinator admin role
  const adminExisting = await prisma.adminResponsibility.findFirst({
    where: { facultyId: faculty.id, roleName: 'Alumni Coordinator' },
  });
  if (adminExisting) {
    await prisma.adminResponsibility.update({
      where: { id: adminExisting.id },
      data: { scopeLabel: 'Department / Alumni Cell', duration: '2024 January – Present' },
    });
  } else {
    await prisma.adminResponsibility.create({
      data: {
        facultyId: faculty.id,
        roleName: 'Alumni Coordinator',
        scopeLabel: 'Department / Alumni Cell',
        duration: '2024 January – Present',
      },
    });
  }

  // Workload snapshot (theory-heavy NORMAL load ≈ 18)
  // Teaching hours weighted ≈ 4+3+3*0.5+3*0.5+4 = 14.5 + projects/admin ≈ 18
  const teachingWeighted = 4 + 3 + 1.5 + 1.5 + 4; // 14
  const projectsWeighted = 2;
  const researchWeighted = 1;
  const adminWeighted = 1;
  const total = teachingWeighted + projectsWeighted + researchWeighted + adminWeighted; // 18
  const min = 16;
  const expected = 18;
  const max = 20;

  await prisma.workloadSnapshot.deleteMany({
    where: { facultyId: faculty.id, periodId: period.id },
  });
  await prisma.workloadSnapshot.create({
    data: {
      facultyId: faculty.id,
      periodId: period.id,
      teachingRaw: 17,
      projectsRaw: 4,
      researchRaw: 10,
      adminRaw: 1,
      committeeRaw: 0,
      phdRaw: 0,
      teachingWeighted,
      projectsWeighted,
      researchWeighted,
      adminWeighted,
      committeeWeighted: 0,
      phdWeighted: 0,
      total,
      status: 'NORMAL',
      provisionalTeaching: false,
      normMin: min,
      normExpected: expected,
      normMax: max,
      dataSource: 'REAL',
      evidenceJson: JSON.stringify({
        source: 'KOLLURU_PAVAN_SEED',
        courses: COURSES.map((c) => c.name),
        note: 'Assistant Professor CSE — teaching + project + research + alumni role',
      }),
    },
  });

  // Ensure photo file exists under uploads
  const srcCandidates = [
    path.join(__dirname, '..', 'uploads', 'faculty', 'kolluru-pavan-kumar.png'),
    path.join(
      __dirname,
      '..',
      '..',
      'frontend',
      'public',
      'brand',
      'kolluru-pavan-kumar.png',
    ),
  ];
  const dest = path.join(__dirname, '..', 'uploads', 'faculty', 'kolluru-pavan-kumar.png');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!fs.existsSync(dest)) {
    for (const s of srcCandidates) {
      if (fs.existsSync(s) && s !== dest) {
        fs.copyFileSync(s, dest);
        break;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        facultyId: faculty.id,
        email: EMAIL,
        password: cred.password,
        photoUrl: PHOTO,
        workloadTotal: total,
        status: 'NORMAL',
        courses: COURSES.length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
