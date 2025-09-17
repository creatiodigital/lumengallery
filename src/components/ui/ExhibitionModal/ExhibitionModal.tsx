import React, { useState, useCallback } from 'react'

import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import type { TOption } from '@/types/artwork'

import styles from './ExhibitionModal.module.scss'

type ExhibitionModalProps = {
  creating: boolean
  onClose: () => void
  onCreate: (title: string, visibility: string) => void
  selectedSpace: TOption<string> | null
  handleSelectSpace: (opt: TOption<string>) => void
  spaceOptions: TOption<string>[]
}

export const ExhibitionModal = React.memo(
  ({
    creating,
    onClose,
    onCreate,
    selectedSpace,
    handleSelectSpace,
    spaceOptions,
  }: ExhibitionModalProps) => {
    const [mainTitle, setMainTitle] = useState('')
    const [visibility, setVisibility] = useState<'public' | 'private'>('private')

    const handleCreateClick = useCallback(() => {
      onCreate(mainTitle, visibility)
    }, [onCreate, mainTitle, visibility])

    return (
      <div className={styles.wrapper}>
        <div className={styles.content}>
          <h3>Exhibition Title</h3>
          <input
            type="text"
            value={mainTitle}
            onChange={(e) => setMainTitle(e.target.value)}
            placeholder="Exhibition name"
            className={styles.input}
          />

          <h3>Visibility</h3>
          <Select<string>
            options={[
              { value: 'public', label: 'Public' },
              { value: 'private', label: 'Private' },
            ]}
            value={visibility}
            onChange={(val) => setVisibility(val as 'public' | 'private')}
          />

          <h3>Choose a Space</h3>
          <Select<string>
            options={spaceOptions}
            value={selectedSpace?.value}
            onChange={(val) => {
              const opt = spaceOptions.find((opt) => opt.value === val)
              if (opt) handleSelectSpace(opt)
            }}
            size="medium"
          />
        </div>

        <div className={styles.ctas}>
          <Button variant="small" label="Cancel" onClick={onClose} />
          <Button
            variant="small"
            label={creating ? 'Creating...' : 'Create'}
            onClick={handleCreateClick}
          />
        </div>
      </div>
    )
  },
)

ExhibitionModal.displayName = 'ExhibitionModal'
export default ExhibitionModal
