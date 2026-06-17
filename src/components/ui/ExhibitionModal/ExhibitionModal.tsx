'use client'

import React, { useState, useCallback, useEffect } from 'react'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Text } from '@/components/ui/Typography'
import type { TOption } from '@/types/artwork'

import styles from './ExhibitionModal.module.scss'

type ExhibitionModalProps = {
  creating: boolean
  onClose: () => void
  onCreate: (title: string, customUrl: string) => void
  selectedSpace: TOption<string> | null
  handleSelectSpace: (opt: TOption<string>) => void
  spaceOptions: TOption<string>[]
  userId: string
}

const slugify = (str: string): string =>
  str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim()

export const ExhibitionModal = React.memo(
  ({
    creating,
    onClose,
    onCreate,
    selectedSpace,
    handleSelectSpace,
    spaceOptions,
    userId,
  }: ExhibitionModalProps) => {
    const [mainTitle, setMainTitle] = useState('')
    const [customUrl, setCustomUrl] = useState('')
    const [urlEdited, setUrlEdited] = useState(false)

    const [urlError, setUrlError] = useState('')
    const [titleError, setTitleError] = useState('')
    const [checking, setChecking] = useState(false)

    // Auto-generate URL from title (unless manually edited)
    useEffect(() => {
      if (!urlEdited) {
        setCustomUrl(slugify(mainTitle))
      }
    }, [mainTitle, urlEdited])

    // Check URL availability when customUrl changes
    useEffect(() => {
      if (!customUrl || !userId) {
        setUrlError('')
        return
      }

      const checkUrl = async () => {
        setChecking(true)
        try {
          const response = await fetch(
            `/api/exhibitions/check-url?userId=${userId}&url=${encodeURIComponent(customUrl)}`,
          )
          const data = await response.json()

          if (!data.available) {
            setUrlError('This URL is already in use. Please choose a different name.')
          } else {
            setUrlError('')
          }
        } catch {
          // Silently fail - backend will catch duplicates anyway
          setUrlError('')
        } finally {
          setChecking(false)
        }
      }

      // Debounce the check
      const timeout = setTimeout(checkUrl, 300)
      return () => clearTimeout(timeout)
    }, [customUrl, userId])

    const handleUrlChange = (value: string) => {
      setUrlEdited(true)
      setCustomUrl(slugify(value))
    }

    const handleCreateClick = useCallback(() => {
      if (!mainTitle.trim()) {
        setTitleError('Please enter an exhibition title.')
        return
      }
      setTitleError('')
      if (urlError || !customUrl) return
      onCreate(mainTitle, customUrl)
    }, [onCreate, mainTitle, customUrl, urlError])

    return (
      <div className={styles.modal}>
        <Text font="dashboard" as="h2">
          New Exhibition
        </Text>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleCreateClick()
          }}
          autoComplete="off"
          noValidate
        >
          <div className={styles.section}>
            <label className={styles.label} htmlFor="exhibitionTitle">
              Exhibition Title
            </label>
            <Input
              id="exhibitionTitle"
              type="text"
              size="medium"
              value={mainTitle}
              onChange={(e) => {
                setMainTitle(e.target.value)
                if (titleError && e.target.value.trim()) setTitleError('')
              }}
              invalid={!!titleError}
              required
            />
            <ErrorText>{titleError}</ErrorText>

            <label className={styles.label} htmlFor="exhibitionUrl">
              URL Slug
            </label>
            <Input
              id="exhibitionUrl"
              type="text"
              size="medium"
              value={customUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              invalid={!!urlError}
              required
            />
            <Text font="dashboard" as="p" className={styles.urlPreview}>
              /exhibitions/your-name/<strong>{customUrl || 'exhibition-url'}</strong>
            </Text>
            <ErrorText>{urlError}</ErrorText>

            <label className={styles.label} htmlFor="space">
              Space
            </label>
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

          <div className={styles.actions}>
            <Button
              font="dashboard"
              variant="secondary"
              label="Cancel"
              onClick={onClose}
              type="button"
            />
            <Button
              font="dashboard"
              variant="primary"
              label={creating ? 'Creating...' : 'Create Exhibition'}
              type="submit"
              disabled={creating || checking}
            />
          </div>
        </form>
      </div>
    )
  },
)

ExhibitionModal.displayName = 'ExhibitionModal'
export default ExhibitionModal
