const { PrismaClient } = require('@prisma/client')

const p = new PrismaClient()

async function main() {
  for (let i = 1; i <= 6; i++) {
    try {
      const t0 = Date.now()
      await p.$queryRaw`SELECT 1`
      console.log(`OK in ${Date.now() - t0}ms (attempt ${i})`)
      return
    } catch (e) {
      console.log(`fail ${i}: ${e.code || e.message.slice(0, 100)}`)
      await new Promise((r) => setTimeout(r, 2500))
    }
  }
  process.exitCode = 1
}

main().finally(() => p.$disconnect())
