const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function wipeAll() {
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
  await wipeAll();

  const counts = {
    schools: await prisma.school.count(),
    departments: await prisma.department.count(),
    users: await prisma.user.count(),
    faculty: await prisma.faculty.count(),
    academicPeriods: await prisma.academicPeriod.count(),
    policies: await prisma.workloadPolicy.count(),
    norms: await prisma.workloadNorm.count(),
    courses: await prisma.course.count(),
    allocations: await prisma.courseAllocation.count(),
    timetableSlots: await prisma.timetableSlot.count(),
    projects: await prisma.project.count(),
    phd: await prisma.phDSupervision.count(),
    committees: await prisma.committee.count(),
    memberships: await prisma.committeeMembership.count(),
    research: await prisma.researchCommitment.count(),
    admin: await prisma.adminResponsibility.count(),
    snapshots: await prisma.workloadSnapshot.count(),
    corrections: await prisma.correctionRequest.count(),
    approvals: await prisma.approvalRequest.count(),
    notifications: await prisma.notification.count(),
    refreshTokens: await prisma.refreshToken.count(),
  };

  console.log('All mock/seed data removed. Table counts:');
  console.log(counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
