import { withAccelerate } from '@prisma/extension-accelerate'

import { PrismaClient } from '../generated/prisma' // no `.js`

declare global {
  var __prisma: ReturnType<PrismaClient['$extends']> | undefined
}

const prisma =
  process.env.NODE_ENV === 'production'
    ? new PrismaClient().$extends(withAccelerate())
    : (global.__prisma ?? new PrismaClient().$extends(withAccelerate()))

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma
}

export default prisma
