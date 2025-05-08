import { withAccelerate } from '@prisma/extension-accelerate'

import { PrismaClient } from '../generated/prisma/index.js'

let prisma

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient().$extends(withAccelerate())
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient().$extends(withAccelerate())
  }
  prisma = global.__prisma
}

export default prisma
