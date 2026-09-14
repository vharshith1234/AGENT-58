/**
 * Real Vignan credentials only — no mock/demo people.
 * Run: node prisma/seed-real-users.js
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { byFacultyCode } = require('./login-credentials');

const prisma = new PrismaClient();

async function hash(pw) {
  return bcrypt.hash(pw, 10);
}

async function wipe() {
  await prisma.auditLog.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.approvalAuditLog.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.correctionRequest.deleteMany();
  await prisma.workloadSnapshot.deleteMany();
  await prisma.adminResponsibility.deleteMany();
  await prisma.researchCommitment.deleteMany();
  await prisma.committeeMembership.deleteMany();
  await prisma.committee.deleteMany();
  await prisma.phDSupervision.deleteMany();
  await prisma.project.deleteMany();
  await prisma.timetableSlot.deleteMany();
  await prisma.courseAllocation.deleteMany();
  await prisma.course.deleteMany();
  await prisma.workloadNorm.deleteMany();
  await prisma.workloadPolicy.deleteMany();
  await prisma.academicPeriod.deleteMany();
  await prisma.user.deleteMany();
  await prisma.faculty.deleteMany();
  await prisma.department.deleteMany();
  await prisma.school.deleteMany();
}

async function main() {
  await wipe();

  const school = await prisma.school.create({
    data: {
      name: "School of Computing and Informatics",
      code: 'SOCI',
    },
  });

  const cse = await prisma.department.create({
    data: {
      name: 'Computer Science and Engineering',
      code: 'CSE',
      schoolId: school.id,
    },
  });

  await prisma.academicPeriod.create({
    data: {
      name: 'Odd Semester 2026-27',
      code: 'ODD-2026',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-12-15'),
      isActive: true,
    },
  });

  // Institutional policy (config, not people)
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

  /**
   * Real people from Vignan sheets
   * role on User drives login panel; Faculty row holds HR master data
   */
  const people = [
    {
      facultyCode: '01918',
      name: 'Uttej Kumar Nannapaneni',
      email: byFacultyCode('01918').email,
      password: byFacultyCode('01918').password,
      designation: 'Assistant Professor',
      phone: '9573793892',
      role: 'HR',
      linkFaculty: true,
      photoUrl: 'https://vignan.ac.in/Facultyprofiles/uploads/01918/profilepic01918.png',
    },
    {
      facultyCode: '675',
      name: 'Dr. Venkatrama Phani Kumar S',
      email: byFacultyCode('675').email,
      password: byFacultyCode('675').password,
      designation: 'Professor & HoD, CSE',
      phone: '9912514034',
      role: 'HOD',
      linkFaculty: true,
      photoUrl: 'https://vignan.ac.in/Facultyprofiles/uploads/675/profilepic675.webp',
    },
    {
      facultyCode: '163',
      name: 'Dr. K.V. Krishna Kishore',
      email: byFacultyCode('163').email,
      password: byFacultyCode('163').password,
      designation: 'Professor & Dean, SOCI',
      phone: '9490647678',
      role: 'DEAN',
      linkFaculty: true,
      photoUrl: 'https://vignan.ac.in/Facultyprofiles/uploads/163/profilepic163.png',
    },
    {
      facultyCode: '189',
      name: 'Dr. S. Deva Kumar',
      email: byFacultyCode('189').email,
      password: byFacultyCode('189').password,
      designation: 'Assoc. Prof.',
      phone: '9959949221',
      role: 'PRINCIPAL',
      linkFaculty: true,
      photoUrl: 'https://vignan.ac.in/Facultyprofiles/uploads/189/profilepic189.webp',
    },
  ];

  const byEmail = {};
  const logins = [];

  for (const p of people) {
    const faculty = await prisma.faculty.create({
      data: {
        facultyCode: p.facultyCode,
        name: p.name,
        email: p.email,
        departmentId: cse.id,
        designation: p.designation,
        qualification: p.designation.includes('Professor') ? 'Ph.D' : 'M.Tech',
        joiningDate: new Date('2018-01-01'),
        employmentType: 'Regular',
        status: 'Active',
        specialization: p.specialization || null,
        phone: p.phone || null,
        photoUrl: p.photoUrl || null,
        employeeId: p.facultyCode,
      },
    });
    byEmail[p.email] = faculty;

    const password = p.password;
    await prisma.user.create({
      data: {
        email: p.email,
        passwordHash: await hash(password),
        name: p.name,
        role: p.role,
        status: 'ACTIVE',
        facultyId: p.linkFaculty ? faculty.id : null,
        departmentId: p.role === 'HOD' || p.role === 'FACULTY' || p.role === 'HR' ? cse.id : null,
        schoolId: school.id,
        photoUrl: p.photoUrl || null,
      },
    });

    logins.push({
      role: p.role,
      name: p.name,
      email: p.email,
      facultyId: p.facultyCode,
      password,
    });
  }

  await prisma.department.update({
    where: { id: cse.id },
    data: { hodFacultyId: byEmail[byFacultyCode('675').email].id },
  });

  // Section-7 wipe/import is optional and destructive to CSE allocations.
  // Prefer: npm run db:import:cse-odd2026 for full Odd-2026 REAL CSE.
  if (process.env.IMPORT_SECTION7 === '1') {
    const { importSection7 } = require('./import-section7');
    await importSection7();
    console.log('\nSection-7 timetable imported (IMPORT_SECTION7=1).');
  } else {
    console.log(
      '\nSkipped Section-7 import (set IMPORT_SECTION7=1 to force). Next: npm run db:import:cse-odd2026',
    );
  }

  console.log('\n=== Agent 58 role logins (Neon) ===\n');
  for (const row of logins) {
    console.log(
      `${row.role.padEnd(10)} | ${row.email.padEnd(28)} | ${row.password} | ${row.name}`,
    );
  }
  console.log('\nPolicies/norms/admin bootstrap ready. No fake projects/PhD/committees.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
