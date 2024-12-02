import { PrismaClient } from '@prisma/client'

let PrismaInstance

function Prisma() {
  if (!PrismaInstance) {
    PrismaInstance = new PrismaClient()
  }

  return PrismaInstance
}

export default Prisma
