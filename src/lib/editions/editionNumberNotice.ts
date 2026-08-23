/**
 * What a limited-edition buyer is told about their number AT PAYMENT.
 *
 * The number is in fact already allocated by the time this is shown — it is
 * reserved when the PaymentIntent is created and bound to the order. We
 * deliberately do NOT name it yet: an order can be cancelled or refunded before
 * production and its number returned to the pool, so naming it here would
 * promise a specific copy we might not deliver. The buyer is told WHEN instead,
 * and the in-production email carries the actual number.
 *
 * Note what this does NOT say: the artist's signature is on the Certificate of
 * Authenticity, never on the print. Only the number is printed.
 *
 * One string, shared by the confirmation screen and the order-placed emails, so
 * the promise cannot drift between the two surfaces a buyer sees minutes apart.
 */
export const EDITION_NUMBER_NOTICE_HEADING = 'Your edition number'

export const EDITION_NUMBER_NOTICE_BODY =
  'This is a numbered limited edition. We\u2019ll confirm which copy is yours when your print ' +
  'goes into production \u2014 the number is printed into the margin, and recorded on your ' +
  'Certificate of Authenticity, hand-signed by the artist.'
