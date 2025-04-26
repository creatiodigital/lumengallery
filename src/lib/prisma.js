import { PrismaClient } from '../generated/prisma'

let prisma

// In dev, reuse the client across hot reloads
if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient()
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient()
  }
  prisma = global.__prisma
}

export default prisma
