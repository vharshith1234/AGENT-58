/**
 * Attach official Vignan directory photos by employee code.
 * Does NOT wipe or recreate faculty — only fills empty photoUrl fields.
 *
 * Run: node prisma/restore-faculty-photos.js
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PHOTO_BASE = 'https://vignan.ac.in/Facultyprofiles/uploads';

const KNOWN = {
  '01918': `${PHOTO_BASE}/01918/profilepic01918.png`,
  '00675': `${PHOTO_BASE}/675/profilepic675.webp`,
  '675': `${PHOTO_BASE}/675/profilepic675.webp`,
  '00163': `${PHOTO_BASE}/163/profilepic163.png`,
  '163': `${PHOTO_BASE}/163/profilepic163.png`,
  '00189': `${PHOTO_BASE}/189/profilepic189.webp`,
  '189': `${PHOTO_BASE}/189/profilepic189.webp`,
};

function empVariants(code) {
  const raw = String(code || '').trim();
  if (!raw) return [];
  const stripped = raw.replace(/^0+/, '') || '0';
  return [...new Set([raw, stripped, stripped.padStart(5, '0')])];
}

function photoForEmp(code) {
  for (const v of empVariants(code)) {
    if (KNOWN[v]) return KNOWN[v];
  }
  const stripped = String(code || '').replace(/^0+/, '') || '';
  if (!stripped) return null;
  return `${PHOTO_BASE}/${stripped}/profilepic${stripped}.png`;
}

async function main() {
  const faculty = await prisma.faculty.findMany({
    select: {
      id: true,
      employeeId: true,
      facultyCode: true,
      email: true,
      photoUrl: true,
      user: { select: { id: true, photoUrl: true } },
    },
  });

  let updated = 0;
  let skipped = 0;
  for (const f of faculty) {
    if (f.photoUrl && !f.photoUrl.includes('placeholder')) {
      skipped += 1;
      continue;
    }
    const url = photoForEmp(f.employeeId || f.facultyCode);
    if (!url) continue;
    await prisma.faculty.update({
      where: { id: f.id },
      data: { photoUrl: url },
    });
    if (f.user?.id && !f.user.photoUrl) {
      await prisma.user.update({
        where: { id: f.user.id },
        data: { photoUrl: url },
      });
    }
    updated += 1;
  }

  console.log(JSON.stringify({ total: faculty.length, updated, skipped }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
