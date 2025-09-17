import { withAccelerate } from '@prisma/extension-accelerate'

import { PrismaClient } from '../src/generated/prisma/index.js'

const prisma = new PrismaClient().$extends(withAccelerate())

async function main() {
  const user = await prisma.user.create({
    data: {
      name: 'Mathias',
      lastName: 'Heizmann',
      handler: 'mathias-heizmann',
      biography: 'A simple biography',
      email: 'edoplaza@gmail.com',
      userType: 'artist',
    },
  })

  console.log('User created:', user)
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
