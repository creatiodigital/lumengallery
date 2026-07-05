// TEMP read-only diagnostic: reserved/sold edition numbers + their bindings,
// and whether an order / pending cart still exists for each one's PI.
import prisma from '@/lib/prisma'

async function main() {
  const nums = await prisma.editionNumber.findMany({
    where: { state: { in: ['reserved', 'sold'] } },
    orderBy: [{ reservedAt: 'desc' }],
    select: {
      id: true,
      number: true,
      state: true,
      paymentIntentId: true,
      orderId: true,
      orderItemId: true,
      buyerEmail: true,
      reservedAt: true,
      soldAt: true,
      variant: { select: { name: true, artwork: { select: { title: true } } } },
    },
  })

  console.log(`=== ${nums.length} reserved/sold EditionNumber rows ===`)
  for (const n of nums) {
    // Does anything still reference this number's PI?
    const pi = n.paymentIntentId
    const order = pi
      ? await prisma.printOrder.findUnique({ where: { paymentIntentId: pi }, select: { id: true } })
      : null
    const cart = pi
      ? await prisma.pendingCart.findUnique({
          where: { paymentIntentId: pi },
          select: { id: true },
        })
      : null
    console.log(
      JSON.stringify(
        {
          artwork: n.variant.artwork.title,
          variant: n.variant.name,
          number: n.number,
          state: n.state,
          paymentIntentId: pi,
          orderId: n.orderId,
          orderItemId: n.orderItemId,
          buyerEmail: n.buyerEmail,
          reservedAt: n.reservedAt,
          orderExistsForPI: !!order,
          pendingCartExistsForPI: !!cart,
        },
        null,
        2,
      ),
    )
  }

  const [orders, carts] = await Promise.all([
    prisma.printOrder.count(),
    prisma.pendingCart.count(),
  ])
  console.log(`=== totals: printOrders=${orders}, pendingCarts=${carts} ===`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
