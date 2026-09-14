/**
 * Replace operational demo teaching data with Section-7 timetable +
 * official Vignan people.php details for confident name matches only.
 *
 * Run: node prisma/import-section7.js
 *
 * Does not wipe HR/HOD/Dean/Principal login accounts.
 * Does not invent projects, research, PhD, or committees.
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const {
  adminEmails,
  loginEmailFor,
  passwordFor,
} = require('./login-credentials');

const prisma = new PrismaClient();

function hoursBetween(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.round(((eh * 60 + em - (sh * 60 + sm)) / 60) * 1000) / 1000;
}

const FACULTY = [
  {
    key: 'keerthi',
    name: 'Dr. Gabbi Reddy Keerthi',
    phone: '9491139513',
    facultyCode: '9491139513',
    match: {
      status: 'UNCERTAIN',
      websiteName: 'dr . keerthi g',
      websiteDesignation: 'ASSISTANT PROFESSOR (CSE)',
      photoUrl: 'https://vignan.ac.in/Facultyprofiles/uploads/03259/profilepic03259.webp',
      note: 'Timetable name kept as Gabbi Reddy Keerthi; directory lists Keerthi G. Photo copied from the CSE directory row.',
    },
  },
  {
    key: 'senthil',
    name: 'Mr. Senthil D',
    phone: '8925096166',
    facultyCode: '8925096166',
    match: {
      status: 'MATCHED',
      websiteName: 'mr . senthil d',
      websiteDesignation: 'ASSISTANT PROFESSOR (CSE)',
      specialization: 'AI in cybersecurity',
    },
  },
  {
    key: 'uvrao',
    name: 'Mr. U. Venkateswara Rao',
    phone: '9966258482',
    facultyCode: '9966258482',
    match: {
      status: 'MATCHED',
      websiteName: 'mr . uppala venkateswara rao',
      websiteDesignation: 'ASSISTANT PROFESSOR (CSE)',
      specialization: 'Deep learning, Image Processing.',
    },
  },
  {
    key: 'kaveri',
    name: 'A. Venkata Kaveri',
    facultyCode: 'TT-SEC7-KAVERI',
    match: { status: 'UNMATCHED', note: 'Name visible on timetable; no confident people.php match.' },
  },
  {
    key: 'nafees',
    name: 'Mr. Syed Nafees Ahamed',
    phone: '8790696105',
    facultyCode: '8790696105',
    match: {
      status: 'MATCHED',
      websiteName: 'mr . syed nafees ahamed',
      websiteDesignation: 'ASSISTANT PROFESSOR (CSE)',
      specialization: 'NLP With Deep Learning Optimization Algorithms Cloud & Fogg Computing',
      note: 'Directory also lists a Diploma row with the same name; CSE row used.',
    },
  },
  {
    key: 'lalitha',
    name: 'Mrs. B. Lalitha',
    facultyCode: 'TT-SEC7-LALITHA-B',
    match: {
      status: 'UNCERTAIN',
      websiteName: 'mrs . ravuri lalitha',
      websiteDesignation: 'ASSISTANT PROFESSOR (CSE)',
      note: 'Directory Lalitha is Ravuri, timetable initial is B. Not merged.',
    },
  },
  {
    key: 'javeed',
    name: 'SK Javeed Ali',
    facultyCode: 'TT-SEC7-JAVEED',
    match: { status: 'UNMATCHED', note: 'Name visible on timetable; no people.php match.' },
  },
  {
    key: 'naveen',
    name: 'G. Naveen',
    phone: '9493453595',
    facultyCode: '9493453595',
    match: {
      status: 'UNCERTAIN',
      note: 'Directory Naveen records are B.N. Naveen Kumar (Maths) and B. Naveen Kumar Reddy. Not merged with G. Naveen.',
    },
  },
  {
    key: 'pushya',
    name: 'Ms. Pushya Chaparala',
    phone: '7780112971',
    facultyCode: '7780112971',
    match: {
      status: 'MATCHED',
      websiteName: 'ms . pushya chaparala',
      websiteDesignation: 'ASSISTANT PROFESSOR (CSE)',
      specialization: 'Recommender systems Symbolic Data Analysis',
    },
  },
  {
    key: 'meghana',
    name: 'T. Meghana',
    phone: '8919459991',
    facultyCode: '8919459991',
    match: {
      status: 'UNCERTAIN',
      websiteName: 'ms . chikkala meghana',
      websiteDesignation: 'ASSISTANT PROFESSOR (SSH)',
      note: 'Different initial/department. Not merged.',
    },
  },
  {
    key: 'thajuddin',
    name: 'SD. Thajuddin Baba',
    phone: '9985916678',
    facultyCode: '9985916678',
    match: { status: 'UNMATCHED', note: 'Name and phone visible on timetable; no people.php match.' },
  },
  {
    key: 'ninnagari',
    name: 'Bhathula Ninnagari',
    phone: '7842481619',
    facultyCode: '7842481619',
    match: { status: 'UNMATCHED', note: 'Name and phone visible on timetable; no people.php match.' },
  },
  {
    key: 'bhavani',
    name: 'Ms. A. Durga Bhavani',
    phone: '9394835222',
    facultyCode: '9394835222',
    match: {
      status: 'UNCERTAIN',
      note: 'Directory has dr . s durga and ms . setti sridurga (Chemistry). Not merged with A. Durga Bhavani.',
    },
  },
  {
    key: 'gowtham',
    name: 'Mr. R. Gowtham',
    facultyCode: 'TT-SEC7-GOWTHAM-R',
    match: {
      status: 'UNMATCHED',
      note: 'Phone on image is truncated (846…). Name imported as visible; phone left empty.',
    },
  },
  {
    key: 'sinkhu',
    name: 'Sai Swateh Sinkhu',
    phone: '7853038516',
    facultyCode: '7853038516',
    match: { status: 'UNMATCHED', note: 'Name and phone visible on timetable; no people.php match.' },
  },
  {
    key: 'sandhya',
    name: 'Kuruva Sandhya Rani',
    facultyCode: 'TT-SEC7-SANDHYA',
    match: {
      status: 'UNMATCHED',
      note: 'Phone on image is truncated (720…). Name imported as visible; phone left empty.',
    },
  },
  {
    key: 'spandana',
    name: 'Mrs. V. Sai Spandana',
    phone: '9948368555',
    facultyCode: '9948368555',
    match: {
      status: 'MATCHED',
      websiteName: 'mrs . v.sai spandana',
      websiteDesignation: 'ASSISTANT PROFESSOR (CSE)',
      note: 'Distinctive given names Sai Spandana; timetable surname Verella vs directory initial V.',
    },
  },
  {
    key: 'manju',
    name: 'Sri Manju Nadh',
    facultyCode: 'TT-SEC7-MANJU',
    match: { status: 'UNMATCHED', note: 'Name visible on timetable; no people.php match.' },
  },
  {
    key: 'vyshnavi',
    name: 'M Vyshnavi',
    facultyCode: 'TT-SEC7-VYSHNAVI-M',
    match: {
      status: 'UNCERTAIN',
      note: 'Several directory Vyshnavi records (Koduru / Nakka / Tallam). Not merged.',
    },
  },
  {
    key: 'veeranjaneyulu',
    name: 'Dr. J. Veeranjaneyulu',
    phone: '9492246551',
    facultyCode: '9492246551',
    match: {
      status: 'MATCHED',
      websiteName: 'dr . j. veeranjaneyulu',
      websiteDesignation: 'ASSISTANT PROFESSOR (CSE)',
    },
  },
];

const LOGIN_EMAIL = {
  keerthi: loginEmailFor('9491139513', 'gabbireddykeerthi@vignan.ac.in'),
  senthil: loginEmailFor('8925096166', 'dsenthil@vignan.ac.in'),
  nafees: loginEmailFor('8790696105', 'syednafeesahamed@vignan.ac.in'),
  pushya: loginEmailFor('7780112971', 'chpushya@vignan.ac.in'),
  ninnagari: loginEmailFor('7842481619', 'bhathulaninnagari@vignan.ac.in'),
  spandana: loginEmailFor('9948368555', 'saispandanaverella@vignan.ac.in'),
  veeranjaneyulu: loginEmailFor('9492246551', 'jveeranjaneyulu@vignan.ac.in'),
};

const KEEP_FACULTY_KEYS = new Set(Object.keys(LOGIN_EMAIL));

const ADMIN_EMAILS = adminEmails();

const MANUAL_VERIFICATION = [
  'SK Suf… — truncated on timetable next to A. Venkata Kaveri; not created.',
  'Dr. Gabbi Reddy Keerthi vs directory Keerthi G — possible same person, not merged.',
  'Mrs. B. Lalitha vs Ravuri Lalitha — not merged.',
  'G. Naveen vs other Naveen records — not merged.',
  'T. Meghana vs Chikkala Meghana (SSH) — not merged.',
  'M Vyshnavi — multiple directory hits, not merged.',
  'Ms. A. Durga Bhavani — no confident directory match.',
  'Co-listed lab/tutorial faculty were not given invented hour splits; only the first-listed teacher received allocation hours from the grid.',
];

const COURSES = [
  { key: 'PID', code: '22CS406', name: 'Privacy Preserving and Intrusion Detection', type: 'THEORY' },
  { key: 'PID-T', code: '22CS406-T', name: 'Privacy Preserving and Intrusion Detection', type: 'TUTORIAL' },
  { key: 'BDA', code: '22CS402', name: 'Big Data Analytics', type: 'THEORY' },
  { key: 'BDA-P', code: '22CS402-P', name: 'Big Data Analytics', type: 'LABORATORY' },
  { key: 'CC', code: '22CS403', name: 'Cloud Computing', type: 'THEORY' },
  { key: 'CC-P', code: '22CS403-P', name: 'Cloud Computing', type: 'LABORATORY' },
  { key: 'CE', code: '22CS310', name: 'Computing Ethics', type: 'THEORY' },
  { key: 'MLOPS', code: 'MLOps', name: 'MLOps', type: 'THEORY' },
  { key: 'MLOPS-P', code: 'MLOps-P', name: 'MLOps', type: 'LABORATORY' },
  { key: 'NLP', code: 'NLP', name: 'Natural Language Processing', type: 'THEORY' },
  { key: 'NLP-P', code: 'NLP-P', name: 'Natural Language Processing', type: 'LABORATORY' },
  { key: 'AI', code: '22CS959', name: 'Agentic AI', type: 'THEORY' },
  { key: 'EL', code: 'EL/SL/PROJECT', name: 'Experiential Learning / Self Learning / Project', type: 'THEORY' },
];

const PRIMARY_ALLOCATION = {
  PID: 'senthil',
  'PID-T': 'senthil',
  BDA: 'nafees',
  'BDA-P': 'nafees',
  CC: 'pushya',
  'CC-P': 'pushya',
  CE: 'ninnagari',
  MLOPS: 'keerthi',
  'MLOPS-P': 'keerthi',
  NLP: 'spandana',
  'NLP-P': 'spandana',
  AI: 'veeranjaneyulu',
};

const COL = {
  p2: 'N-312',
  p3: 'N-312',
  p4: 'N-414b',
  p5: 'N-414b',
  p6: 'N-414b',
};

const SLOTS = [
  { day: 1, start: '08:30', end: '10:30', course: 'CE', type: 'THEORY', room: 'N-110 SEMINAR HALL', faculty: 'ninnagari' },
  { day: 1, start: '10:50', end: '11:40', course: 'CC-P', type: 'LAB', room: 'N-516', faculty: null },
  { day: 1, start: '11:40', end: '12:30', course: 'NLP', type: 'THEORY', room: COL.p3, faculty: 'spandana' },
  { day: 1, start: '12:45', end: '13:35', course: 'NLP', type: 'THEORY', room: COL.p4, faculty: 'spandana' },
  { day: 1, start: '14:20', end: '15:10', course: 'EL', type: 'THEORY', room: COL.p5, faculty: null },
  { day: 1, start: '15:10', end: '16:00', course: 'MLOPS', type: 'THEORY', room: 'N-417', faculty: 'keerthi' },

  { day: 2, start: '08:30', end: '10:30', course: 'AI', type: 'THEORY', room: 'N-313', faculty: 'veeranjaneyulu' },
  { day: 2, start: '10:50', end: '11:40', course: 'PID-T', type: 'TUTORIAL', room: 'N-314B', faculty: null },
  { day: 2, start: '11:40', end: '12:30', course: 'NLP', type: 'THEORY', room: COL.p3, faculty: 'spandana' },
  { day: 2, start: '12:45', end: '13:35', course: 'NLP', type: 'THEORY', room: COL.p4, faculty: 'spandana' },
  { day: 2, start: '14:20', end: '15:10', course: 'EL', type: 'THEORY', room: COL.p5, faculty: null },
  { day: 2, start: '15:10', end: '16:00', course: 'NLP', type: 'THEORY', room: COL.p6, faculty: 'spandana' },

  { day: 3, start: '10:50', end: '11:40', course: 'NLP-P', type: 'LAB', room: 'N-516', faculty: null },
  { day: 3, start: '11:40', end: '12:30', course: 'CC', type: 'THEORY', room: COL.p3, faculty: 'pushya' },
  { day: 3, start: '12:45', end: '13:35', course: 'CC', type: 'THEORY', room: COL.p4, faculty: 'pushya' },
  { day: 3, start: '14:20', end: '15:10', course: 'EL', type: 'THEORY', room: COL.p5, faculty: null },
  { day: 3, start: '15:10', end: '16:00', course: 'BDA', type: 'THEORY', room: COL.p6, faculty: 'nafees' },

  { day: 4, start: '10:50', end: '11:40', course: 'MLOPS-P', type: 'LAB', room: COL.p2, faculty: null },
  { day: 4, start: '11:40', end: '12:30', course: 'CC', type: 'THEORY', room: COL.p3, faculty: 'pushya' },
  { day: 4, start: '12:45', end: '13:35', course: 'CC', type: 'THEORY', room: COL.p4, faculty: 'pushya' },
  { day: 4, start: '14:20', end: '15:10', course: 'EL', type: 'THEORY', room: COL.p5, faculty: null },
  { day: 4, start: '15:10', end: '16:00', course: 'BDA', type: 'THEORY', room: COL.p6, faculty: 'nafees' },

  { day: 5, start: '08:30', end: '10:30', course: 'AI', type: 'THEORY', room: 'N-313', faculty: 'veeranjaneyulu' },
  { day: 5, start: '10:50', end: '11:40', course: 'PID', type: 'THEORY', room: COL.p2, faculty: 'senthil' },
  { day: 5, start: '11:40', end: '12:30', course: 'BDA-P', type: 'LAB', room: COL.p3, faculty: null },
  { day: 5, start: '12:45', end: '13:35', course: 'BDA', type: 'THEORY', room: COL.p4, faculty: 'nafees' },
  { day: 5, start: '14:20', end: '15:10', course: 'EL', type: 'THEORY', room: COL.p5, faculty: null },
  { day: 5, start: '15:10', end: '16:00', course: 'MLOPS', type: 'THEORY', room: 'N-504', faculty: 'keerthi' },

  { day: 6, start: '10:50', end: '11:40', course: 'MLOPS-P', type: 'LAB', room: COL.p2, faculty: null },
  { day: 6, start: '11:40', end: '12:30', course: 'PID', type: 'THEORY', room: COL.p3, faculty: 'senthil' },
  { day: 6, start: '12:45', end: '13:35', course: 'PID', type: 'THEORY', room: COL.p4, faculty: 'senthil' },
  { day: 6, start: '14:20', end: '15:10', course: 'EL', type: 'THEORY', room: COL.p5, faculty: null },
  { day: 6, start: '15:10', end: '16:00', course: 'CC', type: 'THEORY', room: COL.p6, faculty: 'pushya' },
];

function designationFromWebsite(row) {
  if (row.match.status === 'MATCHED' && row.match.websiteDesignation) {
    return row.match.websiteDesignation.replace(/\s+/g, ' ').trim();
  }
  return 'Not specified';
}

async function ensureFacultyLogin(cse, row, facultyId, email) {
  const passwordHash = await bcrypt.hash(passwordFor(row.facultyCode, row.facultyCode), 10);
  const data = {
    email,
    passwordHash,
    name: row.name,
    role: 'FACULTY',
    status: 'ACTIVE',
    facultyId,
    departmentId: cse.id,
    schoolId: cse.schoolId,
  };
  const byFaculty = await prisma.user.findUnique({ where: { facultyId } });
  if (byFaculty) {
    await prisma.user.update({ where: { id: byFaculty.id }, data });
    return;
  }
  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    await prisma.user.update({ where: { id: byEmail.id }, data });
    return;
  }
  await prisma.user.create({ data });
}

async function ensureSection7Logins() {
  const cse = await prisma.department.findFirst({ where: { code: 'CSE' } });
  if (!cse) throw new Error('CSE department not found.');
  const keepCodes = new Set(
    FACULTY.filter((f) => KEEP_FACULTY_KEYS.has(f.key)).map((f) => f.facultyCode),
  );
  const created = [];
  for (const row of FACULTY.filter((f) => KEEP_FACULTY_KEYS.has(f.key))) {
    const email = LOGIN_EMAIL[row.key];
    const faculty = await prisma.faculty.findUnique({
      where: { facultyCode: row.facultyCode },
    });
    if (!faculty) {
      created.push({ name: row.name, email, ok: false, error: 'faculty row missing' });
      continue;
    }
    await prisma.faculty.update({
      where: { id: faculty.id },
      data: { email, status: 'Active' },
    });
    await ensureFacultyLogin(cse, row, faculty.id, email);
    created.push({
      name: row.name,
      email,
      password: passwordFor(row.facultyCode, row.facultyCode),
      ok: true,
    });
  }

  const others = await prisma.faculty.findMany({
    include: { user: true, department: true },
  });
  const deactivated = [];
  for (const fac of others) {
    if (fac.dataSource === 'DEMO' || fac.departmentId !== cse.id) continue;
    if (ADMIN_EMAILS.includes(fac.email) || ADMIN_EMAILS.includes(fac.user?.email || '')) continue;
    if (keepCodes.has(fac.facultyCode)) continue;
    if (KEEP_FACULTY_KEYS.has(Object.keys(LOGIN_EMAIL).find((k) => LOGIN_EMAIL[k] === fac.email) || '')) continue;
    await prisma.faculty.update({
      where: { id: fac.id },
      data: { status: 'Inactive' },
    });
    if (fac.user && !['HR', 'HOD', 'DEAN', 'PRINCIPAL'].includes(fac.user.role)) {
      await prisma.user.update({
        where: { id: fac.user.id },
        data: { status: 'INACTIVE' },
      });
    }
    deactivated.push({ name: fac.name, email: fac.email });
  }

  const keepEmails = new Set([...Object.values(LOGIN_EMAIL), ...ADMIN_EMAILS]);
  const leftoverUsers = await prisma.user.findMany({
    where: { role: 'FACULTY', status: { not: 'INACTIVE' } },
    include: { faculty: true, department: true },
  });
  for (const u of leftoverUsers) {
    if (keepEmails.has(u.email)) continue;
    if (u.faculty?.dataSource === 'DEMO') continue;
    if (u.departmentId && u.departmentId !== cse.id) continue;
    await prisma.user.update({
      where: { id: u.id },
      data: { status: 'INACTIVE' },
    });
    deactivated.push({ name: u.name, email: u.email });
  }

  return { created, deactivated };
}

async function main() {
  const cse = await prisma.department.findFirst({ where: { code: 'CSE' } });
  if (!cse) throw new Error('CSE department not found. Seed school/department first.');
  await prisma.department.update({
    where: { id: cse.id },
    data: { dataSource: 'REAL' },
  });

  const keepAdminEmails = new Set(ADMIN_EMAILS);
  // Default: non-destructive so Odd-2026 CSE allocations survive.
  // Destructive wipe only when ALLOW_SECTION7_WIPE=1.
  const allowWipe = process.env.ALLOW_SECTION7_WIPE === '1';

  const demoTeachingEmails = [
    'sks_cse@vignan.ac.in',
    'ssk_cse@vignan.ac.in',
    'crkr_cse@vignan.ac.in',
    'gn_cse@vignan.ac.in',
  ];

  const cseFacultyRows = await prisma.faculty.findMany({
    where: { departmentId: cse.id },
    select: { id: true },
  });
  const cseFacultyIds = cseFacultyRows.map((f) => f.id);
  const cseCourseRows = await prisma.course.findMany({
    where: { departmentId: cse.id },
    select: { id: true },
  });
  const cseCourseIds = cseCourseRows.map((c) => c.id);

  const deactivated = [];

  if (!allowWipe) {
    console.log(
      'Section-7: non-destructive mode (Odd-2026 allocations preserved). Set ALLOW_SECTION7_WIPE=1 to wipe CSE allocations/timetable.',
    );
  } else {
    await prisma.adminResponsibility.deleteMany({
      where: {
        facultyId: { in: cseFacultyIds },
        roleName: { contains: 'Class Teacher' },
      },
    });
    await prisma.researchCommitment.deleteMany({
      where: { facultyId: { in: cseFacultyIds } },
    });
    await prisma.committeeMembership.deleteMany({
      where: { facultyId: { in: cseFacultyIds } },
    });
    await prisma.phDSupervision.deleteMany({
      where: { facultyId: { in: cseFacultyIds } },
    });
    await prisma.project.deleteMany({
      where: {
        OR: [{ guideId: { in: cseFacultyIds } }, { coGuideId: { in: cseFacultyIds } }],
      },
    });
    if (cseCourseIds.length) {
      await prisma.timetableSlot.deleteMany({
        where: { courseId: { in: cseCourseIds } },
      });
      await prisma.courseAllocation.deleteMany({
        where: { courseId: { in: cseCourseIds } },
      });
    }

    const demoCourses = await prisma.course.findMany({
      where: {
        departmentId: cse.id,
        OR: [
          { code: { startsWith: 'CS3' } },
          {
            name: {
              in: [
                'DBMS',
                'DBMS Lab',
                'Operating Systems',
                'Computer Networks',
                'Artificial Intelligence',
                'Machine Learning',
                'AI Lab',
                'OS Tutorial',
                'Software Engineering',
                'Networks Lab',
                'Programming Tutorial',
              ],
            },
          },
        ],
      },
      select: { id: true, code: true, name: true },
    });
    await prisma.course.deleteMany({
      where: { id: { in: demoCourses.map((c) => c.id) } },
    });
  }

  for (const email of demoTeachingEmails) {
    const fac = await prisma.faculty.findUnique({ where: { email } });
    if (!fac) continue;
    await prisma.faculty.update({
      where: { id: fac.id },
      data: { status: 'Inactive' },
    });
    await prisma.user.updateMany({
      where: { email },
      data: { status: 'INACTIVE' },
    });
    deactivated.push({ name: fac.name, email, action: 'deactivated' });
  }

  if (allowWipe) {
    const keepNames = new Set(
      FACULTY.filter((f) => KEEP_FACULTY_KEYS.has(f.key)).map((f) => f.name.toLowerCase()),
    );
    const extra = await prisma.faculty.findMany({
      where: { departmentId: cse.id, status: { not: 'Inactive' } },
      include: { user: true },
    });
    for (const fac of extra) {
      if (keepAdminEmails.has(fac.email) || keepAdminEmails.has(fac.user?.email || '')) continue;
      if (keepNames.has(fac.name.toLowerCase())) continue;
      if (fac.user && fac.user.role !== 'FACULTY') continue;
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
      deactivated.push({ name: fac.name, email: fac.email, action: 'deactivated-not-in-keep-list' });
    }
  }

  const facultyIds = {};
  for (const row of FACULTY.filter((f) => KEEP_FACULTY_KEYS.has(f.key))) {
    const email = LOGIN_EMAIL[row.key];
    const designation = designationFromWebsite(row);
    const specialization =
      row.match.status === 'MATCHED'
        ? row.match.specialization || null
        : row.match.note || null;
    const existing =
      (await prisma.faculty.findUnique({ where: { facultyCode: row.facultyCode } })) ||
      (await prisma.faculty.findUnique({ where: { email } }));
    const data = {
      facultyCode: row.facultyCode,
      name: row.name,
      email,
      phone: row.phone || null,
      departmentId: cse.id,
      designation,
      qualification: 'Not specified',
      employmentType: 'Not specified',
      joiningDate: null,
      status: 'Active',
      specialization,
      employeeId: row.facultyCode,
      dataSource: 'REAL',
      identitySource: row.match.status === 'MATCHED' ? 'OFFICIAL' : 'TIMETABLE',
      researchInterests: specialization,
    };
    const saved = existing
      ? await prisma.faculty.update({ where: { id: existing.id }, data })
      : await prisma.faculty.create({ data });
    facultyIds[row.key] = saved.id;
    await ensureFacultyLogin(cse, row, saved.id, email);
  }

  if (!allowWipe) {
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'non-destructive',
      note: 'Skipped CSE allocation/timetable wipe and Section-7 slot import. Odd-2026 data preserved. Re-run with ALLOW_SECTION7_WIPE=1 for legacy Section-7 replace.',
      demoFacultyDeactivated: deactivated,
      facultyEnsured: Object.keys(facultyIds).length,
    };
    console.log(JSON.stringify(report, null, 2));
    return report;
  }

  const courseIds = {};
  for (const c of COURSES) {
    const weekly = SLOTS.filter((s) => s.course === c.key).reduce(
      (sum, s) => sum + hoursBetween(s.start, s.end),
      0,
    );
    const existing = await prisma.course.findFirst({
      where: { code: c.code, departmentId: cse.id },
    });
    const data = {
      code: c.code,
      name: c.name,
      semester: 0,
      credits: 0,
      type: c.type,
      hoursPerWeek: Math.round(weekly * 1000) / 1000,
      students: 0,
      section: '7',
      academicYear: null,
      status: 'ACTIVE',
      dataSource: 'REAL',
      departmentId: cse.id,
    };
    const saved = existing
      ? await prisma.course.update({ where: { id: existing.id }, data })
      : await prisma.course.create({ data });
    courseIds[c.key] = saved.id;
  }

  const allocationHours = {};
  for (const s of SLOTS) {
    const hrs = hoursBetween(s.start, s.end);
    allocationHours[s.course] = (allocationHours[s.course] || 0) + hrs;
  }

  let allocationsCreated = 0;
  for (const [courseKey, facultyKey] of Object.entries(PRIMARY_ALLOCATION)) {
    await prisma.courseAllocation.create({
      data: {
        courseId: courseIds[courseKey],
        facultyId: facultyIds[facultyKey],
        hours: Math.round((allocationHours[courseKey] || 0) * 1000) / 1000,
        section: '7',
        dataSource: 'REAL',
      },
    });
    allocationsCreated += 1;
  }

  let slotsCreated = 0;
  for (const s of SLOTS) {
    await prisma.timetableSlot.create({
      data: {
        courseId: courseIds[s.course],
        facultyId: s.faculty ? facultyIds[s.faculty] : null,
        dayOfWeek: s.day,
        startTime: s.start,
        endTime: s.end,
        room: s.room || null,
        contactType: s.type,
        durationHrs: hoursBetween(s.start, s.end),
        batchLabel: '7',
        dataSource: 'REAL',
      },
    });
    slotsCreated += 1;
  }

  const classTeacher = facultyIds.keerthi;
  if (classTeacher) {
    await prisma.adminResponsibility.create({
      data: {
        facultyId: classTeacher,
        roleName: 'Class Teacher',
        scopeLabel: 'Section-7',
        duration: 'Visible on Section-7 timetable',
      },
    });
  }

  const period = await prisma.academicPeriod.findFirst({ where: { isActive: true } });
  if (period) {
    await prisma.workloadSnapshot.deleteMany({
      where: {
        periodId: period.id,
        facultyId: { in: Object.values(facultyIds) },
      },
    });
  }

  const activeTeaching = await prisma.faculty.count({
    where: {
      departmentId: cse.id,
      status: { notIn: ['Inactive', 'INACTIVE', 'Suspended'] },
      OR: [{ user: { is: null } }, { user: { role: { in: ['FACULTY'] } } }],
    },
  });

  const report = {
    generatedAt: new Date().toISOString(),
    sourceTimetable: 'Section-7 image provided in chat',
    sourceDirectory: 'https://vignan.ac.in/newvignan/people.php',
    facultyFoundInTimetable: FACULTY.length,
    facultyKeptOperational: KEEP_FACULTY_KEYS.size,
    incompleteNamesSkipped: ['SK Suf… (truncated)'],
    facultyMatchedWithWebsite: FACULTY.filter((f) => f.match.status === 'MATCHED').map((f) => f.name),
    facultyUncertain: FACULTY.filter((f) => f.match.status === 'UNCERTAIN').map((f) => ({
      name: f.name,
      note: f.match.note,
    })),
    facultyUnmatched: FACULTY.filter((f) => f.match.status === 'UNMATCHED').map((f) => f.name),
    manualVerification: MANUAL_VERIFICATION,
    demoFacultyDeactivated: deactivated,
    demoCoursesRemoved: [],
    fakeProjectsResearchPhdCommitteesCleared: true,
    coursesImported: COURSES.length,
    timetableRecordsImported: slotsCreated,
    courseAllocationsCreated: allocationsCreated,
    activeOperationalFacultyCount: activeTeaching,
    expectedTimetableFacultyCount: KEEP_FACULTY_KEYS.size,
    countsMatch: activeTeaching === KEEP_FACULTY_KEYS.size,
    notes: [
      'Allocation hours were computed from timetable grid durations for the first-listed teacher of each course.',
      'Multi-faculty lab/tutorial cells do not invent a faculty assignment on the slot.',
      'Seven Section-7 faculty have FACULTY logins as name@vignan.ac.in. Password pattern: Vignan@{8-digit}.',
      'Credits, student strength, semester, and joining dates were not visible; stored as unspecified/zero rather than guessed.',
      'Class Teacher (Dr. Gabbi Reddy Keerthi, Section-7) is the only administrative role taken from the timetable.',
    ],
  };

  const out = path.join(__dirname, 'section7-validation.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nWrote ${out}`);
}

module.exports = { importSection7: main, ensureSection7Logins, FACULTY, LOGIN_EMAIL, disconnect: () => prisma.$disconnect() };

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
