/**
 * Create a real user (not seed/mock).
 * Usage:
 *   node prisma/create-user.js <email> <password> <role> [name]
 * Example:
 *   node prisma/create-user.js admin@vignan.ac.in 'SecurePass1' HR "HR Admin"
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const [email, password, role, ...nameParts] = process.argv.slice(2);
  const allowed = ['HR', 'HOD', 'DEAN', 'PRINCIPAL', 'FACULTY'];
  if (!email || !password || !role) {
    console.error(
      'Usage: node prisma/create-user.js <email> <password> <role> [name]',
    );
    process.exit(1);
  }
  if (!allowed.includes(role.toUpperCase())) {
    console.error('Role must be one of:', allowed.join(', '));
    process.exit(1);
  }

  const user = await prisma.user.create({
    data: {
      email: email.trim().toLowerCase(),
      passwordHash: await bcrypt.hash(password, 10),
      name: nameParts.join(' ') || email.split('@')[0],
      role: role.toUpperCase(),
      status: 'ACTIVE',
    },
  });

  console.log('Created user:', {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
