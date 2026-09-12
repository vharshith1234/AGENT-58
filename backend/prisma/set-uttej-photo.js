const { PrismaClient } = require('@prisma/client')
const { loginEmailFor } = require('./login-credentials')

const prisma = new PrismaClient()
const photo = '/uploads/profiles/uttej-kumar-n.png'

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: loginEmailFor('01918', 'uttejkumarn@vignan.ac.in') },
  })
  if (!user) throw new Error('User not found: Uttej Kumar N')

  await prisma.user.update({
    where: { id: user.id },
    data: { name: 'Uttej Kumar N', photoUrl: photo },
  })

  if (user.facultyId) {
    await prisma.faculty.update({
      where: { id: user.facultyId },
      data: {
        name: 'Uttej Kumar N',
        designation: 'Assistant Professor',
        photoUrl: photo,
      },
    })
  }

  const fac = user.facultyId
    ? await prisma.faculty.findUnique({
        where: { id: user.facultyId },
        include: { department: true },
      })
    : null

  console.log(
    JSON.stringify(
      {
        email: loginEmailFor('01918', 'uttejkumarn@vignan.ac.in'),
        name: 'Uttej Kumar N',
        photoUrl: photo,
        designation: fac?.designation,
        department: fac?.department?.name,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
