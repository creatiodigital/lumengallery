export const spaceOptions = [
  { label: 'Paris', value: 'paris', adminOnly: false },
  { label: 'Madrid', value: 'madrid', adminOnly: false },
  // Vienna ships in the code but is NOT offered yet: its GLB and bakes are not on
  // R2, and production always resolves assets to R2 (NEXT_PUBLIC_LOCAL_ASSETS is
  // dev-only), so choosing it would create an exhibition in an empty room.
  // `adminOnly` is not enforced at the only call site (`dashboard/index.tsx`
  // passes spaceOptions unfiltered), so the flag alone would not have gated it.
  // Re-enable with one line once the uploads are done:
  //   { label: 'Vienna', value: 'vienna', adminOnly: false },
]
