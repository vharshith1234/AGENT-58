const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function timed(label, fn) {
  const t0 = Date.now()
  const result = await fn()
  console.log(`${label}: ${Date.now() - t0}ms`)
  return result
}

async function main() {
  await timed('ping', () => p.$queryRaw`SELECT 1`)
  const depts = await timed('departments', () =>
    p.department.findMany({ include: { school: true } }),
  )
  const period = await timed('period', () =>
    p.academicPeriod.findFirst({ where: { isActive: true } }),
  )
  const faculty = await timed('faculty', () =>
    p.faculty.findMany({
      where: {
        status: { notIn: ['Inactive', 'INACTIVE', 'Suspended'] },
        OR: [{ user: { is: null } }, { user: { role: { in: ['FACULTY'] } } }],
      },
      select: { id: true, departmentId: true, dataSource: true },
    }),
  )
  console.log('faculty count', faculty.length)
  if (period) {
    const ids = faculty.map((f) => f.id)
    await timed('latest snaps', () =>
      p.$queryRaw`
        SELECT DISTINCT ON ("facultyId") "facultyId", status, total
        FROM "WorkloadSnapshot"
        WHERE "periodId" = ${period.id}
          AND "facultyId" IN (${ids[0]}, ${ids[1] || ids[0]})
        ORDER BY "facultyId", "calculatedAt" DESC
      `,
    )
    await timed('snap count', () =>
      p.workloadSnapshot.count({ where: { periodId: period.id } }),
    )
  }
  await timed('corr group', () =>
    p.correctionRequest.groupBy({ by: ['status'], _count: { _all: true } }),
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => p.$disconnect())
