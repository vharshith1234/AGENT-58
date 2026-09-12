const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const fixes = [
  ['dean_addl._acse@vignan.ac.in', 'demo.acse.venkatesuludondeti@vignan.ac.in'],
  ['dean_sa@vignan.ac.in', 'demo.ece.mssrukmini@vignan.ac.in'],
  ['dean_res@vignan.ac.in', 'demo.eee.srinivasaraogorantla@vignan.ac.in'],
  ['director_ies@vignan.ac.in', 'demo.mech.bnageswararao@vignan.ac.in'],
  ['dean_iqac@vignan.ac.in', 'demo.mech.mramakrishna@vignan.ac.in'],
];

(async () => {
  for (const [from, to] of fixes) {
    const fac = await prisma.faculty.findUnique({ where: { email: from } });
    if (!fac) {
      console.log('skip missing', from);
      continue;
    }
    const taken = await prisma.faculty.findUnique({ where: { email: to } });
    if (taken) {
      console.log('skip taken', to);
      continue;
    }
    await prisma.faculty.update({ where: { id: fac.id }, data: { email: to } });
    await prisma.user.updateMany({ where: { facultyId: fac.id }, data: { email: to } });
    console.log('fixed', from, '->', to);
  }
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
