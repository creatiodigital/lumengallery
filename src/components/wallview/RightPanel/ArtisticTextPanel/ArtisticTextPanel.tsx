'use client'

import { useGLTF } from '@react-three/drei'
import { useCallback, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Mesh } from 'three'

import { Button } from '@/components/ui/Button'
import { Section } from '@/components/ui/Section/Section'
import { Checkbox } from '@/components/ui/Checkbox'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Select } from '@/components/ui/Select'
import { Text } from '@/components/ui/Typography'
import { getSpaceConfig, type SpaceKey } from '@/components/scene/constants'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import { convert2DTo3D } from '@/components/wallview/utils'
import { useArtworkDetails } from '@/components/wallview/RightPanel/hooks/useArtworkDetails'
import { useArtworkTextHandlers } from '@/components/wallview/RightPanel/hooks/useArtworkTextHandlers'
import PresetSection from '@/components/wallview/RightPanel/PresetSection/PresetSection'
import styles from '@/components/wallview/RightPanel/RightPanel.module.scss'
import { updateArtworkPosition, pushToHistory } from '@/redux/slices/exhibitionSlice'
import type { RootState } from '@/redux/store'
import type { TFontFamily, TFontWeight } from '@/types/fonts'
import { FONT_FAMILY_WEIGHTS } from '@/types/fonts'

import {
  fontSizes,
  lineHeights,
  fontFamilies,
  fontWeights,
  letterSpacings,
  textPaddings,
  textThicknessOptions,
} from './constants'

/** Map font-family keys to the CSS custom properties used in the 2D wall view */
const fontFamilyMap: Record<string, string> = {
  roboto: 'var(--font-wall-roboto)',
  lora: 'var(--font-wall-lora)',
  alegreya: 'var(--font-wall-alegreya)',
  manrope: 'var(--font-wall-manrope)',
  'garamond-glc': 'var(--font-wall-garamond-glc)',
  crimson: 'var(--font-wall-crimson)',
}

const ArtisticText = ({ disabled }: { disabled?: boolean }) => {
  const dispatch = useDispatch()
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)
  const { handleEditArtworkText } = useArtworkTextHandlers(currentArtworkId || '')

  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )

  // Bounding data for 2D→3D coordinate conversion
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) as SpaceKey | null
  const gltfPath = getSpaceConfig(spaceId || 'paris').gltfPath
  const { nodes } = useGLTF(gltfPath) as unknown as { nodes: Record<string, Mesh> }
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)
  const boundingData = useBoundingData(nodes as Record<string, Mesh>, currentWallId)

  const {
    textContent,
    textColor,
    textBackgroundColor,
    fontSize,
    lineHeight,
    fontWeight,
    letterSpacing,
    fontFamily,
    textPadding,
    textPaddingTop,
    textPaddingBottom,
    textPaddingLeft,
    textPaddingRight,
    textThickness,
    textBackgroundTexture,
    showTextBorder,
    textBorderColor,
    textBorderOffset,
    showMonogram,
    monogramColor,
    monogramOpacity,
    monogramPosition,
    monogramOffset,
    monogramSize,
  } = useArtworkDetails(currentArtworkId!)

  // Filter font weight options based on selected family's supported variants
  const filteredWeights = useMemo(() => {
    const family = (fontFamily?.value ?? 'roboto') as TFontFamily
    const supported = FONT_FAMILY_WEIGHTS[family] ?? FONT_FAMILY_WEIGHTS.roboto
    return fontWeights.filter((w) => supported.includes(w.value))
  }, [fontFamily?.value])

  /**
   * Measure the text's natural (unconstrained) dimensions using an off-screen
   * element styled identically to the 2D ArtisticText content div, then resize
   * the artwork frame to snugly fit around the text + padding.
   */
  const handleWrapAroundText = useCallback(() => {
    if (!currentArtworkId || !textContent?.trim()) return

    const exhibitionArtwork = exhibitionArtworksById[currentArtworkId]
    if (!exhibitionArtwork) return

    const padding = textPadding?.value ?? 0
    const fSize = fontSize?.value ?? 16
    const lHeight = lineHeight?.value ?? 1
    const lSpacing = letterSpacing?.value ?? 0
    const fFamily = fontFamily?.value ?? 'roboto'
    const fWeight = fontWeight?.value ?? 'regular'

    // Content width = current artwork width minus padding on both sides
    const contentWidth = exhibitionArtwork.width2d - padding * 2

    // Create an off-screen measurement div with the same text styles
    // constrained to the current content width so text wraps the same way
    const measurer = document.createElement('div')
    measurer.style.position = 'absolute'
    measurer.style.top = '-9999px'
    measurer.style.left = '-9999px'
    measurer.style.visibility = 'hidden'
    measurer.style.whiteSpace = 'pre-wrap' // match the 2D content style
    measurer.style.wordWrap = 'break-word'
    measurer.style.overflowWrap = 'break-word'
    measurer.style.width = `${contentWidth}px` // constrain to current content width
    measurer.style.fontSize = `${fSize}px`
    measurer.style.lineHeight = String(lHeight)
    measurer.style.letterSpacing = `${lSpacing}px`
    measurer.style.fontFamily = fontFamilyMap[fFamily] ?? fontFamilyMap.roboto
    measurer.style.fontWeight = fWeight === 'bold' ? '600' : '400'

    // Use an inner span for tight bounding box measurement
    // (block-level scrollHeight often includes trailing line-height space)
    const span = document.createElement('span')
    span.innerText = textContent
    measurer.appendChild(span)

    document.body.appendChild(measurer)

    const measuredHeight = span.getBoundingClientRect().height

    document.body.removeChild(measurer)

    // Keep current width, only adjust height to fit text + padding
    const newHeight2d = measuredHeight + padding * 2

    // Keep artwork horizontally centered, adjust vertical center
    const oldCenterY = exhibitionArtwork.posY2d + exhibitionArtwork.height2d / 2
    const newPosY2d = oldCenterY - newHeight2d / 2

    const artworkPosition = {
      posY2d: newPosY2d,
      height2d: newHeight2d,
    }

    // Compute 3D coordinates (keep existing X and width)
    const coords3D = boundingData
      ? convert2DTo3D(
          exhibitionArtwork.posX2d,
          newPosY2d,
          exhibitionArtwork.width2d,
          newHeight2d,
          boundingData,
        )
      : {}

    dispatch(pushToHistory())
    dispatch(
      updateArtworkPosition({
        artworkId: currentArtworkId,
        artworkPosition: { ...artworkPosition, ...coords3D },
      }),
    )
  }, [
    currentArtworkId,
    textContent,
    exhibitionArtworksById,
    textPadding,
    fontSize,
    lineHeight,
    letterSpacing,
    fontFamily,
    fontWeight,
    boundingData,
    dispatch,
  ])

  // Hide all text styling fields if there's no text content
  if (!textContent || textContent.trim() === '') {
    return null
  }

  return (
    <>
      <Section title="Alignment" disabled={disabled}>
        <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
          Text Align
        </Text>
        <div className={styles.row}>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="textLeft"
              onClick={() => handleEditArtworkText('textAlign', 'left')}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="textCenter"
              onClick={() => handleEditArtworkText('textAlign', 'center')}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="textRight"
              onClick={() => handleEditArtworkText('textAlign', 'right')}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="textJustify"
              onClick={() => handleEditArtworkText('textAlign', 'justify')}
            />
          </div>
        </div>
        <Text font="dashboard" as="h4" size="xs" className={styles.subtitle}>
          Vertical Align
        </Text>
        <div className={styles.row}>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="textVerticalTop"
              onClick={() => handleEditArtworkText('textVerticalAlign', 'top')}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="textVerticalCenter"
              onClick={() => handleEditArtworkText('textVerticalAlign', 'center')}
            />
          </div>
          <div className={styles.item}>
            <Button
              size="small"
              variant="secondary"
              icon="textVerticalBottom"
              onClick={() => handleEditArtworkText('textVerticalAlign', 'bottom')}
            />
          </div>
        </div>
        <div style={{ marginTop: 'var(--space-2)' }}>
          <Button
            font="dashboard"
            fullWidth
            variant="secondary"
            label="Wrap around text"
            onClick={handleWrapAroundText}
          />
        </div>
      </Section>

      <Section title="Presets" disabled={disabled}>
        <PresetSection presetType="text" />
      </Section>

      <Section title="Style" disabled={disabled}>
        <div className={styles.row}>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Size (cm)
            </Text>
            <Select<number>
              options={fontSizes}
              value={fontSize?.value}
              onChange={(val) =>
                handleEditArtworkText('fontSize', { label: String(val), value: val })
              }
            />
          </div>

          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Line height
            </Text>

            <Select<number>
              options={lineHeights}
              value={lineHeight?.value}
              onChange={(val) =>
                handleEditArtworkText('lineHeight', { label: String(val), value: val })
              }
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Font Style
            </Text>
            <Select<TFontWeight>
              options={filteredWeights}
              value={fontWeight?.value}
              onChange={(val) => handleEditArtworkText('fontWeight', { label: val, value: val })}
            />
          </div>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Letter Spacing
            </Text>
            <Select<number>
              options={letterSpacings}
              value={letterSpacing?.value}
              onChange={(val) =>
                handleEditArtworkText('letterSpacing', { label: String(val), value: val })
              }
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Font Family
            </Text>
            <Select<TFontFamily>
              options={fontFamilies}
              value={fontFamily?.value}
              onChange={(val) => handleEditArtworkText('fontFamily', { label: val, value: val })}
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Padding Top
            </Text>
            <Select<number>
              options={textPaddings}
              value={textPaddingTop?.value ?? 0}
              onChange={(val) =>
                handleEditArtworkText('textPaddingTop', { label: String(val), value: val })
              }
            />
          </div>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Padding Bottom
            </Text>
            <Select<number>
              options={textPaddings}
              value={textPaddingBottom?.value ?? 0}
              onChange={(val) =>
                handleEditArtworkText('textPaddingBottom', { label: String(val), value: val })
              }
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Padding Left
            </Text>
            <Select<number>
              options={textPaddings}
              value={textPaddingLeft?.value ?? 0}
              onChange={(val) =>
                handleEditArtworkText('textPaddingLeft', { label: String(val), value: val })
              }
            />
          </div>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Padding Right
            </Text>
            <Select<number>
              options={textPaddings}
              value={textPaddingRight?.value ?? 0}
              onChange={(val) =>
                handleEditArtworkText('textPaddingRight', { label: String(val), value: val })
              }
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Text Color
            </Text>
            <ColorPicker
              textColor={textColor!}
              onColorSelect={(value) => handleEditArtworkText('textColor', value)}
            />
          </div>
          <div className={styles.item}>
            <Text font="dashboard" as="span" size="xs" className={styles.label}>
              Background
            </Text>
            <div className={styles.backgroundColorRow}>
              <ColorPicker
                textColor={textBackgroundColor ?? '#ffffff'}
                onColorSelect={(value) => handleEditArtworkText('textBackgroundColor', value)}
              />
              <Button
                size="small"
                variant={textBackgroundColor === undefined ? 'primary' : 'secondary'}
                label="None"
                onClick={() => {
                  handleEditArtworkText('textBackgroundColor', undefined)
                  handleEditArtworkText('textThickness', { label: '0', value: 0 })
                }}
              />
            </div>
          </div>
        </div>
        {textBackgroundColor !== undefined && (
          <div className={styles.row}>
            <div className={styles.item}>
              <Text font="dashboard" as="span" size="xs" className={styles.label}>
                Thickness (cm)
              </Text>
              <Select<number>
                options={textThicknessOptions}
                value={textThickness?.value}
                onChange={(val) =>
                  handleEditArtworkText('textThickness', {
                    label: String(val),
                    value: val,
                  })
                }
              />
            </div>
          </div>
        )}
        <div className={styles.row}>
          <div className={styles.item}>
            <Checkbox
              checked={!!textBackgroundTexture}
              onChange={(e) => {
                handleEditArtworkText(
                  'textBackgroundTexture',
                  e.target.checked ? 'paper' : undefined,
                )
              }}
              label="Use Texture"
            />
          </div>
        </div>
        {textBackgroundTexture && (
          <div className={styles.row}>
            <div className={styles.item}>
              <Text font="dashboard" as="span" size="xs" className={styles.label}>
                Texture
              </Text>
              <Select<string>
                options={[{ label: 'Plain Paper', value: 'paper' }]}
                value={textBackgroundTexture}
                onChange={(val) => handleEditArtworkText('textBackgroundTexture', val)}
              />
            </div>
          </div>
        )}

        <div className={styles.row}>
          <div className={styles.item}>
            <Checkbox
              checked={!!showTextBorder}
              onChange={(e) => handleEditArtworkText('showTextBorder', e.target.checked)}
              label="Show Border"
            />
          </div>
        </div>
        {showTextBorder && (
          <>
            <div className={styles.row}>
              <div className={styles.item}>
                <Text font="dashboard" as="span" size="xs" className={styles.label}>
                  Border Color
                </Text>
                <ColorPicker
                  textColor={textBorderColor ?? '#c9a96e'}
                  onColorSelect={(value) => handleEditArtworkText('textBorderColor', value)}
                />
              </div>
              <div className={styles.item}>
                <Text font="dashboard" as="span" size="xs" className={styles.label}>
                  Border Offset (cm)
                </Text>
                <Select<number>
                  options={Array.from({ length: 36 }, (_, i) => {
                    const val = Number((0.5 + i * 0.1).toFixed(1))
                    return { label: String(val), value: val }
                  })}
                  value={textBorderOffset?.value ?? 1.2}
                  onChange={(val) =>
                    handleEditArtworkText('textBorderOffset', {
                      label: String(val),
                      value: val,
                    })
                  }
                />
              </div>
            </div>
          </>
        )}

        <div className={styles.row}>
          <div className={styles.item}>
            <Checkbox
              checked={!!showMonogram}
              onChange={(e) => handleEditArtworkText('showMonogram', e.target.checked)}
              label="Show Monogram"
            />
          </div>
        </div>
        {showMonogram && (
          <>
            <div className={styles.row}>
              <div className={styles.item}>
                <Text font="dashboard" as="span" size="xs" className={styles.label}>
                  Color
                </Text>
                <ColorPicker
                  textColor={monogramColor ?? '#c0392b'}
                  onColorSelect={(value) => handleEditArtworkText('monogramColor', value)}
                />
              </div>
              <div className={styles.item}>
                <Text font="dashboard" as="span" size="xs" className={styles.label}>
                  Opacity
                </Text>
                <Select<number>
                  options={[
                    { label: '10%', value: 0.1 },
                    { label: '20%', value: 0.2 },
                    { label: '30%', value: 0.3 },
                    { label: '40%', value: 0.4 },
                    { label: '50%', value: 0.5 },
                    { label: '60%', value: 0.6 },
                    { label: '70%', value: 0.7 },
                    { label: '80%', value: 0.8 },
                    { label: '90%', value: 0.9 },
                    { label: '100%', value: 1.0 },
                  ]}
                  value={monogramOpacity?.value ?? 1.0}
                  onChange={(val) =>
                    handleEditArtworkText('monogramOpacity', {
                      label: String(val),
                      value: val,
                    })
                  }
                />
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.item}>
                <Text font="dashboard" as="span" size="xs" className={styles.label}>
                  Position
                </Text>
                <Select<string>
                  options={[
                    { label: 'Top Center', value: 'top' },
                    { label: 'Bottom Center', value: 'bottom' },
                  ]}
                  value={monogramPosition ?? 'bottom'}
                  onChange={(val) =>
                    handleEditArtworkText('monogramPosition', val as 'top' | 'bottom')
                  }
                />
              </div>
              <div className={styles.item}>
                <Text font="dashboard" as="span" size="xs" className={styles.label}>
                  Offset (cm)
                </Text>
                <Select<number>
                  options={[
                    { label: '0', value: 0 },
                    { label: '1', value: 1 },
                    { label: '2', value: 2 },
                    { label: '3', value: 3 },
                    { label: '4', value: 4 },
                  ]}
                  value={monogramOffset?.value ?? 2}
                  onChange={(val) =>
                    handleEditArtworkText('monogramOffset', {
                      label: String(val),
                      value: val,
                    })
                  }
                />
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.item}>
                <Text font="dashboard" as="span" size="xs" className={styles.label}>
                  Size (cm)
                </Text>
                <Select<number>
                  options={[
                    { label: '1', value: 1 },
                    { label: '1.5', value: 1.5 },
                    { label: '2', value: 2 },
                    { label: '2.5', value: 2.5 },
                    { label: '3', value: 3 },
                    { label: '3.5', value: 3.5 },
                    { label: '4', value: 4 },
                    { label: '4.5', value: 4.5 },
                    { label: '5', value: 5 },
                    { label: '6', value: 6 },
                    { label: '7', value: 7 },
                    { label: '8', value: 8 },
                    { label: '9', value: 9 },
                    { label: '10', value: 10 },
                  ]}
                  value={monogramSize?.value ?? 4}
                  onChange={(val) =>
                    handleEditArtworkText('monogramSize', {
                      label: String(val),
                      value: val,
                    })
                  }
                />
              </div>
            </div>
          </>
        )}
      </Section>
    </>
  )
}

export default ArtisticText
