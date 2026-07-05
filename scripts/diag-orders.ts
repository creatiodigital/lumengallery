// TEMP read-only diagnostic: latest orders + their email events.
import prisma from '@/lib/prisma'

async function main() {
  const orders = await prisma.printOrder.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: {
      id: true,
      createdAt: true,
      buyerEmail: true,
      buyerName: true,
      totalCents: true,
      currency: true,
      paymentStatus: true,
    },
  })
  console.log('=== RECENT ORDERS ===')
  console.log(JSON.stringify(orders, null, 2))

  if (orders.length) {
    const events = await prisma.printOrderEvent.findMany({
      where: { orderId: { in: orders.map((o) => o.id) } },
      orderBy: { at: 'asc' },
      select: { orderId: true, kind: true, message: true, actor: true, payload: true, at: true },
    })
    console.log('=== EVENTS (most-recent 3 orders) ===')
    console.log(JSON.stringify(events, null, 2))
  } else {
    console.log('No orders found.')
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect())
