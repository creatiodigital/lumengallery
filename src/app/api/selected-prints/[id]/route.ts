import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

import { requireSuperAdmin } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

type RouteParams = { params: Promise<{ id: string }> }

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const { id } = await params
  await prisma.selectedPrint.deleteMany({ where: { id } })

  revalidatePath('/prints')
  return NextResponse.json({ success: true })
}
