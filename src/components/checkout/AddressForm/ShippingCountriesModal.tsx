'use client'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Text } from '@/components/ui/Typography'
import { getCountryName } from '@/lib/print-providers/dialCodes'

import styles from './AddressForm.module.scss'

type ShippingCountriesModalProps = {
  countryCodes: string[]
  onClose: () => void
  /** Picking one here sets the form's country and closes — the buyer came
   *  looking for their country, so finding it should do something. */
  onSelect: (code: string) => void
}

/**
 * Where we currently ship, shown without leaving checkout.
 *
 * A buyer who cannot find their country in the picker has exactly one question
 * — "do you ship to me?" — and the worst possible answer is making them leave a
 * half-filled checkout to go and look. So this is a modal over the flow, every
 * field behind it untouched.
 *
 * Selecting a country here sets it on the form. Someone who opened this list
 * was looking for their own country; finding it and then having to close the
 * dialog and hunt through the dropdown again is a needless second search.
 */
export const ShippingCountriesModal = ({
  countryCodes,
  onClose,
  onSelect,
}: ShippingCountriesModalProps) => {
  const sorted = [...countryCodes].sort((a, b) =>
    getCountryName(a).localeCompare(getCountryName(b)),
  )

  return (
    <Modal onClose={onClose} titleId="shipping-countries-title" maxWidth="640px">
      <Text as="h2" font="serif" size="xl" id="shipping-countries-title">
        Where we ship
      </Text>
      <Text as="p" size="sm" className={styles.modalIntro}>
        We currently deliver to {sorted.length} countries. Choose yours to continue.
      </Text>

      <ul className={styles.countryList}>
        {sorted.map((code) => (
          <li key={code}>
            <Button
              variant="menuItem"
              size="smallSquared"
              fullWidth
              className={styles.countryItem}
              onClick={() => onSelect(code)}
              label={getCountryName(code)}
            />
          </li>
        ))}
      </ul>

      <Text as="p" size="sm" className={styles.modalOutro}>
        Not on the list yet? We’re adding new delivery countries as we grow — if yours matters to
        you, tell us and it moves up the list.
      </Text>
    </Modal>
  )
}
