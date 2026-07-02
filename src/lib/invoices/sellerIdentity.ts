// Frozen gallery legal identity for the factura (AR-131). Single source,
// rendered on every document and snapshotted into each Invoice at issue time.
// Env-overridable, with the real registered values as fallbacks.
export const SELLER_IDENTITY = {
  legalName: process.env.SELLER_LEGAL_NAME || 'The Art Room Gallery, SL',
  nif: process.env.SELLER_NIF || 'ESB88838172',
  addressLines: (
    process.env.SELLER_ADDRESS ||
    'Avenida Guadarrama 4, Bajo B|28220 Majadahonda|Spain'
  ).split('|'),
  email: process.env.SELLER_EMAIL || 'contact@theartroom.gallery',
  phone: process.env.SELLER_PHONE || '+34 665 05 99 41',
  website: process.env.SELLER_WEBSITE || 'theartroom.gallery',
} as const
