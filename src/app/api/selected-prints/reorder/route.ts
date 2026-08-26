import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

import { requireSuperAdmin } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

/**
 * Same shape as /api/slides/reorder: the client sends the ids in their new
 * order and each row's `order` becomes its index, in one transaction so a
 * half-written order can never be read.
 */
export async function POST(request: Request) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const body = (await request.json()) as { ids?: unknown }
  const ids = Array.isArray(body.ids) ? body.ids.filter((i) => typeof i === 'string') : []
  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 })
  }

  await prisma.$transaction(
    (ids as string[]).map((id, index) =>
      prisma.selectedPrint.update({ where: { id }, data: { order: index } }),
    ),
  )

  revalidatePath('/prints')
  return NextResponse.json({ success: true })
}
