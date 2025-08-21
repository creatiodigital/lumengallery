import { withAccelerate } from '@prisma/extension-accelerate'

import { PrismaClient } from '../generated/prisma/index.js'

const prisma = new PrismaClient().$extends(withAccelerate())

async function main() {
  const user = await prisma.user.create({
    data: {
      name: 'Eduardo',
      lastName: 'Plaza',
      handler: 'eduardo-plaza',
      biography: 'A simple biography',
      email: 'edoplaza@gmail.com',
    },
  })

  console.log('✅ User created:', user)
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
