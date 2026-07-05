'use client'

import { CartIcon } from '@/components/cart/CartIcon'
import { SelectDropdown, type SelectOption } from '@/components/ui/SelectDropdown'

import styles from './prints.module.scss'

type Props = {
  artistOptions: SelectOption<string>[]
  artistId: string
  onArtistChange: (value: string) => void
  editionId: string
  onEditionChange: (value: string) => void
}

const EDITION_OPTIONS: SelectOption<string>[] = [
  { value: '', label: 'All Editions' },
  { value: 'limited', label: 'Limited Editions' },
  { value: 'open', label: 'Open Editions' },
]

export const PrintsToolbar = ({
  artistOptions,
  artistId,
  onArtistChange,
  editionId,
  onEditionChange,
}: Props) => {
  return (
    <div className={styles.printsToolbar}>
      <div className={styles.toolbarFilter}>
        <SelectDropdown
          options={artistOptions}
          value={artistId}
          onChange={onArtistChange}
          variant="plain"
          className={styles.artistSelect}
        />
        <SelectDropdown
          options={EDITION_OPTIONS}
          value={editionId}
          onChange={onEditionChange}
          variant="plain"
          placeholder="All Editions"
          className={styles.editionSelect}
        />
      </div>

      <div className={styles.toolbarActions}>
        <CartIcon />
      </div>
    </div>
  )
}
