'use client'

import { CartIcon } from '@/components/cart/CartIcon'
import { SelectDropdown, type SelectOption } from '@/components/ui/SelectDropdown'

import styles from './prints.module.scss'

type Props = {
  artistOptions: SelectOption<string>[]
  artistId: string
  onArtistChange: (value: string) => void
}

export const PrintsToolbar = ({ artistOptions, artistId, onArtistChange }: Props) => {
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
      </div>

      <div className={styles.toolbarActions}>
        <CartIcon />
      </div>
    </div>
  )
}
