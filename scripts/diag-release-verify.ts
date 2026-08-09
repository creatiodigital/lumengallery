// TEMP verification (mutates then fully cleans up): proves that the release
// path deleteOrder runs DOES free a limited-edition number bound to a (cart)
// order — even a SOLD/captured one. Mirrors the real flow:
//   reserve → attach PI → create order + item → bind number → mark sold
//   → releaseEditionNumberForPaymentIntent(PI, {allowSold:true})  [the deleteOrder call]
// Then asserts the number is back to `available` with all bindings cleared,
// and deletes the test order. Net DB change: none.
import prisma from '@/lib/prisma'
import {
  bindEditionNumbersToOrderItem,
  markEditionNumberSold,
} from '@/lib/editions/reserveEditionNumber'
import { releaseEditionNumberForPaymentIntent } from '@/lib/editions/releaseEditionNumber'

const TEST_PI = 'pi_tps_test_release_verify'

async function main() {
  // 0. Grab a real available number + its artwork/artist (no publish-guard
  //    dependency — we construct the reserved state directly).
  const avail = await prisma.editionNumber.findFirst({
    where: { state: 'available' },
    select: {
      id: true,
      number: true,
      variant: {
        select: { name: true, artwork: { select: { id: true, userId: true, title: true } } },
      },
    },
  })
  if (!avail) {
    console.log('No available edition number to test with. Seed/publish a limited variant first.')
    return
  }
  const { id: numberId } = avail
  const artworkId = avail.variant.artwork.id
  const artistUserId = avail.variant.artwork.userId
  console.log(
    `Testing with ${avail.variant.artwork.title} · ${avail.variant.name} #${avail.number} (${numberId})`,
  )

  // Clean any stale test order from a prior run.
  await prisma.printOrder.deleteMany({ where: { paymentIntentId: TEST_PI } })

  try {
    // 1. Reserve + attach PI (mimic reserveNextEditionNumber + attach).
    await prisma.editionNumber.update({
      where: { id: numberId },
      data: {
        state: 'reserved',
        paymentIntentId: TEST_PI,
        buyerEmail: 'verify@test.local',
        reservedAt: new Date(),
      },
    })

    // 2. Real order + line item (the cart shape).
    const order = await prisma.printOrder.create({
      data: {
        paymentIntentId: TEST_PI,
        artworkId,
        artistUserId,
        buyerEmail: 'verify@test.local',
        buyerName: 'Release Verify',
        shippingAddress: {},
        printConfig: {},
        country: 'es',
        totalCents: 1000,
        artistCents: 500,
        galleryCents: 200,
        productionCents: 300,
        productionShippingCents: 0,
        customerVatCents: 0,
        paymentStatus: 'succeeded',
      },
    })
    const item = await prisma.printOrderItem.create({
      data: {
        orderId: order.id,
        artworkId,
        artistUserId,
        printConfig: {},
        quantity: 1,
        productionCents: 300,
        artistCents: 500,
        galleryCents: 200,
      },
    })

    // 3. Bind via the REAL cart bind fn, then mark sold (simulate capture).
    const bound = await bindEditionNumbersToOrderItem({
      numberIds: [numberId],
      orderItemId: item.id,
      buyerEmail: 'verify@test.local',
    })
    await markEditionNumberSold(TEST_PI)

    const before = await prisma.editionNumber.findUnique({
      where: { id: numberId },
      select: { state: true, orderItemId: true, paymentIntentId: true, buyerEmail: true },
    })
    console.log('BEFORE release:', { bound, ...before })

    // 4. THE deleteOrder release call.
    await releaseEditionNumberForPaymentIntent(order.paymentIntentId, { allowSold: true })

    const after = await prisma.editionNumber.findUnique({
      where: { id: numberId },
      select: {
        state: true,
        orderId: true,
        orderItemId: true,
        paymentIntentId: true,
        buyerEmail: true,
        soldAt: true,
      },
    })
    console.log('AFTER release :', after)

    const pass =
      after?.state === 'available' &&
      after.orderId === null &&
      after.orderItemId === null &&
      after.paymentIntentId === null &&
      after.buyerEmail === null &&
      after.soldAt === null
    console.log(
      pass
        ? '\n✅ PASS — bound + SOLD number freed by the deleteOrder release path.'
        : '\n❌ FAIL — number not fully freed.',
    )
  } finally {
    // 5. Remove the test order (cascades the item). Number already freed above.
    await prisma.printOrder.deleteMany({ where: { paymentIntentId: TEST_PI } })
    const final = await prisma.editionNumber.findUnique({
      where: { id: numberId },
      select: { state: true },
    })
    console.log('Cleanup done. Number state now:', final?.state, '(test order deleted)')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
