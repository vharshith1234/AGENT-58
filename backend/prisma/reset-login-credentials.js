/**
 * Rebuild every live login as name@vignan.ac.in / Vignan@{8 digits}.
 * Run: node prisma/reset-login-credentials.js
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const {
  emailFromName,
  uniqueEmail,
  uniquePin,
  passwordFromPin,
  loadCatalog,
  saveCatalog,
  writeReadme,
} = require('./login-credentials');

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE' },
    include: {
      faculty: { include: { department: true } },
      department: true,
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });

  const previous = loadCatalog();
  const usedEmails = new Set(previous.map((row) => row.email));
  const usedPins = new Set(
    previous.map((row) => String(row.password || '').replace(/^Vignan@/, '')),
  );
  const planned = [];

  for (const user of users) {
    const name = user.faculty?.name || user.name;
    const saved =
      previous.find((row) => row.facultyCode && row.facultyCode === user.faculty?.facultyCode) ||
      previous.find((row) => (row.oldEmails || []).includes(user.email)) ||
      previous.find((row) => row.email === user.email);
    const email = saved?.email || uniqueEmail(emailFromName(name), usedEmails);
    if (!usedEmails.has(email)) usedEmails.add(email);
    const password = saved?.password || passwordFromPin(uniquePin(usedPins));
    planned.push({
      userId: user.id,
      facultyId: user.facultyId,
      facultyCode: user.faculty?.facultyCode || null,
      role: user.role,
      name,
      department: user.faculty?.department?.code || user.department?.code || '',
      email,
      oldEmails: [...new Set([user.email, user.faculty?.email].filter(Boolean))],
      password,
    });
  }

  const plannedEmails = planned.map((row) => row.email);
  const plannedFacultyIds = planned.map((row) => row.facultyId).filter(Boolean);
  const plannedUserIds = planned.map((row) => row.userId);

  const blockingFaculty = await prisma.faculty.findMany({
    where: { email: { in: plannedEmails }, id: { notIn: plannedFacultyIds } },
  });
  for (const fac of blockingFaculty) {
    await prisma.faculty.update({
      where: { id: fac.id },
      data: { email: `inactive.${fac.id}@tmp.vignan.ac.in` },
    });
  }
  const blockingUsers = await prisma.user.findMany({
    where: { email: { in: plannedEmails }, id: { notIn: plannedUserIds } },
  });
  for (const user of blockingUsers) {
    await prisma.user.update({
      where: { id: user.id },
      data: { email: `inactive.${user.id}@tmp.vignan.ac.in` },
    });
  }

  for (const row of planned) {
    const tempUser = `pending.${row.userId}@tmp.vignan.ac.in`;
    await prisma.user.update({
      where: { id: row.userId },
      data: { email: tempUser },
    });
    if (row.facultyId) {
      const tempFaculty = `pending.${row.facultyId}@tmp.vignan.ac.in`;
      await prisma.faculty.update({
        where: { id: row.facultyId },
        data: { email: tempFaculty },
      });
    }
  }

  for (const row of planned) {
    const passwordHash = await bcrypt.hash(row.password, 10);
    await prisma.user.update({
      where: { id: row.userId },
      data: {
        email: row.email,
        name: row.name,
        passwordHash,
      },
    });
    if (row.facultyId) {
      await prisma.faculty.update({
        where: { id: row.facultyId },
        data: { email: row.email },
      });
    }
  }

  const catalog = planned.map(({ userId, facultyId, ...rest }) => rest);
  saveCatalog(catalog);
  writeReadme(catalog);

  await prisma.refreshToken.deleteMany();

  console.log(`Updated ${catalog.length} logins`);
  for (const row of catalog) {
    console.log(`${row.role.padEnd(10)} ${row.email.padEnd(42)} ${row.password}  ${row.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
