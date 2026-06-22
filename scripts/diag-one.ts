import prisma from '@/lib/prisma'
async function main() {
  const order = await prisma.printOrder.findFirst({ orderBy: { createdAt: 'desc' } })
  if (!order) return console.log('no orders')
  console.log('ORDER', order.id, order.buyerEmail, (order.totalCents/100).toFixed(2), order.currency)
  const ev = await prisma.printOrderEvent.findMany({
    where: { orderId: order.id }, orderBy: { at: 'asc' },
    select: { kind: true, message: true, payload: true, at: true },
  })
  for (const e of ev) console.log(`  [${e.kind}] ${e.message ?? ''}  ${JSON.stringify(e.payload)}`)
}
main().finally(() => prisma.$disconnect())
