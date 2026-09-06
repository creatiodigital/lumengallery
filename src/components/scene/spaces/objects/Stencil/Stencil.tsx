import { Text, RoundedBox, Line } from '@react-three/drei'
import { WALL_SCALE } from '@/components/wallview/constants'
import { Suspense, useState, useRef, useEffect, useCallback } from 'react'
import type { ComponentRef } from 'react'
import { DoubleSide, Vector2, Vector3, Quaternion } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { usePaperTexture } from './usePaperTexture'
import { useMonogramTexture } from './useMonogramTexture'
import { useDispatch, useSelector } from 'react-redux'

import { showArtworkPanel } from '@/redux/slices/dashboardSlice'
import { setCurrentArtwork, setFocusTarget } from '@/redux/slices/sceneSlice'
import type { RootState } from '@/redux/store'
import type { RuntimeArtwork } from '@/utils/artworkTransform'

type StencilProps = {
  artwork: RuntimeArtwork
}

// Constants for click detection
const CLICK_MAX_DISTANCE = 5
const CLICK_MAX_DURATION = 300
const DOUBLE_CLICK_DELAY = 250

/**
 * Inner component for paper-textured background.
 * Separated because useTexture (drei) requires Suspense.
 */
function PaperBackground({
  width,
  height,
  depth,
  tintColor,
}: {
  width: number
  height: number
  depth: number
  tintColor?: string | null
}) {
  const textures = usePaperTexture(/* textureRepeat */ 1)

  if (depth > 0) {
    return (
      <RoundedBox
        args={[width, height, depth]}
        radius={0.003}
        smoothness={2}
        renderOrder={1}
        position={[0, 0, -depth / 2]}
      >
        <meshStandardMaterial
          map={textures.map}
          normalMap={textures.normalMap}
          normalScale={new Vector2(1.5, 1.5)}
          roughnessMap={textures.roughnessMap}
          roughness={0.85}
          aoMap={textures.aoMap}
          aoMapIntensity={0.15}
          metalness={0}
          color={tintColor ?? '#ffffff'}
        />
      </RoundedBox>
    )
  }

  return (
    <mesh renderOrder={1}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        map={textures.map}
        normalMap={textures.normalMap}
        normalScale={new Vector2(1.5, 1.5)}
        roughnessMap={textures.roughnessMap}
        roughness={0.85}
        aoMap={textures.aoMap}
        aoMapIntensity={0.15}
        metalness={0}
        color={tintColor ?? '#ffffff'}
        side={DoubleSide}
      />
    </mesh>
  )
}

/** Decorative inset border — thin rectangular outline on the card face */
function InsetBorder({
  width,
  height,
  inset = 0.012,
  color = '#c9a96e',
  lineWidth = 1,
}: {
  width: number
  height: number
  inset?: number
  color?: string
  lineWidth?: number
}) {
  const hw = width / 2 - inset
  const hh = height / 2 - inset
  const z = 0.0004 // just above the card face

  const points: [number, number, number][] = [
    [-hw, hh, z],
    [hw, hh, z],
    [hw, -hh, z],
    [-hw, -hh, z],
    [-hw, hh, z], // close the loop
  ]

  return <Line points={points} color={color} lineWidth={lineWidth} />
}

/** Monogram overlay — renders the AR monogram as a transparent textured plane */
function MonogramOverlay({
  width,
  height,
  color = '#c9a96e',
  opacity = 1.0,
  size = 0.04,
  position: pos = 'bottom',
  offset = 0.02,
}: {
  width: number
  height: number
  color?: string
  opacity?: number
  /** Absolute monogram height in meters */
  size?: number
  position?: 'top' | 'bottom'
  /** Margin from edge in meters */
  offset?: number
}) {
  const texture = useMonogramTexture(color, opacity)

  // Size the plane using absolute size (meters)
  // Aspect ratio matches padded canvas: (VB_WIDTH + 2*PADDING) / (VB_HEIGHT + 2*PADDING) = 138/149
  const monoHeight = size
  const monoWidth = monoHeight * (138 / 149)

  // Clamp so it doesn't overflow the card width
  const clampedWidth = Math.min(monoWidth, width * 0.8)
  const clampedHeight = clampedWidth * (149 / 138)

  // Vertical position: near the top or bottom edge, clamped within card
  const halfCard = height / 2
  const halfMono = clampedHeight / 2
  const maxOffset = halfCard - halfMono // maximum distance from center before clipping
  const rawY = pos === 'top' ? halfCard - halfMono - offset : -halfCard + halfMono + offset
  const yOffset = Math.max(-maxOffset, Math.min(maxOffset, rawY))

  return (
    <mesh renderOrder={3} position={[0, yOffset, 0.0005]}>
      <planeGeometry args={[clampedWidth, clampedHeight]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  )
}

const Stencil = ({ artwork }: StencilProps) => {
  const {
    id,
    position,
    quaternion,
    width,
    height,
    textContent,
    textAlign,
    textVerticalAlign,
    textColor,
    textBackgroundColor,
    fontSize,
    lineHeight,
    fontWeight,
    fontFamily,
    letterSpacing,
    textPaddingTop,
    textPaddingBottom,
    textPaddingLeft,
    textPaddingRight,
    textThickness,
    showArtworkInformation,
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
  } = artwork

  const isPlaceholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)
  const isArtworkPanelOpen = useSelector((state: RootState) => state.dashboard.isArtworkPanelOpen)
  const autofocusGroups = useSelector((state: RootState) => state.exhibition.autofocusGroups ?? [])
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )
  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const dispatch = useDispatch()

  // Refs for click detection
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
  const pointerDownTime = useRef<number>(0)
  const singleClickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Calculate the normal vector from artwork's quaternion (facing direction)
  const getNormalFromQuaternion = useCallback((q: Quaternion): Vector3 => {
    const normal = new Vector3(0, 0, 1)
    normal.applyQuaternion(q)
    return normal
  }, [])

  // Handle single click for focus
  const handleSingleClick = useCallback(() => {
    if (!isPlaceholdersShown && quaternion && position) {
      const normal = getNormalFromQuaternion(quaternion)

      // Check if this artwork belongs to an autofocus group
      const group = autofocusGroups.find((g) => g.artworkIds.includes(artwork.id))

      if (group && group.artworkIds.length >= 2) {
        // Compute group center from all member 3D positions
        let minX = Infinity,
          maxX = -Infinity
        let minY = Infinity,
          maxY = -Infinity
        let minZ = Infinity,
          maxZ = -Infinity

        for (const memberId of group.artworkIds) {
          const pos = exhibitionArtworksById[memberId]
          if (!pos) continue
          let halfW = (pos.width3d ?? pos.width2d / 100) / 2
          let halfH = (pos.height3d ?? pos.height2d / 100) / 2

          // Add frame + passepartout borders (cm → meters)
          const memberArt = artworksById[memberId]
          if (memberArt?.showFrame && memberArt?.imageUrl && memberArt?.frameSize?.value) {
            halfW += memberArt.frameSize.value / 100
            halfH += memberArt.frameSize.value / 100
          }
          if (
            memberArt?.showPassepartout &&
            memberArt?.imageUrl &&
            memberArt?.passepartoutSize?.value
          ) {
            halfW += memberArt.passepartoutSize.value / 100
            halfH += memberArt.passepartoutSize.value / 100
          }

          minX = Math.min(minX, pos.posX3d - halfW)
          maxX = Math.max(maxX, pos.posX3d + halfW)
          minY = Math.min(minY, pos.posY3d - halfH)
          maxY = Math.max(maxY, pos.posY3d + halfH)
          minZ = Math.min(minZ, pos.posZ3d - halfW)
          maxZ = Math.max(maxZ, pos.posZ3d + halfW)
        }

        const centerX = (minX + maxX) / 2
        const centerY = (minY + maxY) / 2
        const centerZ = (minZ + maxZ) / 2
        const groupWidth = Math.max(maxX - minX, maxZ - minZ)
        const groupHeight = maxY - minY

        dispatch(
          setFocusTarget({
            artworkId: artwork.id,
            position: { x: centerX, y: centerY, z: centerZ },
            normal: { x: normal.x, y: normal.y, z: normal.z },
            width: Math.max(groupWidth, 0.1),
            height: Math.max(groupHeight, 0.1),
          }),
        )
      } else {
        // Individual artwork focus (default behavior)
        dispatch(
          setFocusTarget({
            artworkId: artwork.id,
            position: { x: position.x, y: position.y, z: position.z },
            normal: { x: normal.x, y: normal.y, z: normal.z },
            width: width || 1,
            height: height || 1,
          }),
        )
      }

      if (isArtworkPanelOpen) {
        dispatch(setCurrentArtwork(artwork.id))
      }
    }
  }, [
    dispatch,
    artwork.id,
    position,
    quaternion,
    width,
    height,
    isPlaceholdersShown,
    isArtworkPanelOpen,
    getNormalFromQuaternion,
    autofocusGroups,
    exhibitionArtworksById,
    artworksById,
  ])

  // Handle double click for info panel
  const handleDoubleClick = useCallback(() => {
    if (singleClickTimeout.current) {
      clearTimeout(singleClickTimeout.current)
      singleClickTimeout.current = null
    }

    if (!isPlaceholdersShown && showArtworkInformation) {
      dispatch(showArtworkPanel())
      dispatch(setCurrentArtwork(artwork.id))
    }
  }, [dispatch, artwork.id, isPlaceholdersShown, showArtworkInformation])

  // Pointer down
  const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (singleClickTimeout.current) {
      clearTimeout(singleClickTimeout.current)
      singleClickTimeout.current = null
    }
    pointerDownPos.current = { x: event.clientX, y: event.clientY }
    pointerDownTime.current = Date.now()
  }, [])

  // Pointer up
  const handlePointerUp = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!pointerDownPos.current) return

      const dx = event.clientX - pointerDownPos.current.x
      const dy = event.clientY - pointerDownPos.current.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      const duration = Date.now() - pointerDownTime.current

      pointerDownPos.current = null

      if (distance < CLICK_MAX_DISTANCE && duration < CLICK_MAX_DURATION) {
        singleClickTimeout.current = setTimeout(() => {
          handleSingleClick()
          singleClickTimeout.current = null
        }, DOUBLE_CLICK_DELAY)
      }
    },
    [handleSingleClick],
  )

  // Font size maps to pixels in the 2D wall view.
  // At WALL_SCALE pixels per meter, fontSize N → N/WALL_SCALE meters.
  const fontSizeFactor = 1 / WALL_SCALE
  // Convert textPadding (pixels) to 3D units using the same scale factor as fontSize
  const padTop3D = (textPaddingTop?.value ?? 0) * fontSizeFactor
  const padBottom3D = (textPaddingBottom?.value ?? 0) * fontSizeFactor
  const padLeft3D = (textPaddingLeft?.value ?? 0) * fontSizeFactor
  const padRight3D = (textPaddingRight?.value ?? 0) * fontSizeFactor
  const paddingOffsetH = padLeft3D + padRight3D // total horizontal padding

  const fontMap: Record<string, Record<string, string>> = {
    lora: {
      regular: '/fonts/lora-regular.ttf',
      italic: '/fonts/lora-italic.ttf',
      bold: '/fonts/lora-bold.ttf',
      'bold-italic': '/fonts/lora-bold-italic.ttf',
    },
    alegreya: {
      regular: '/fonts/alegreya-regular.ttf',
      italic: '/fonts/alegreya-italic.ttf',
      bold: '/fonts/alegreya-bold.ttf',
      'bold-italic': '/fonts/alegreya-bold-italic.ttf',
    },
    manrope: {
      regular: '/fonts/manrope-regular.ttf',
      bold: '/fonts/manrope-bold.ttf',
    },
    roboto: {
      regular: '/fonts/roboto-regular.ttf',
      italic: '/fonts/roboto-italic.ttf',
      bold: '/fonts/roboto-bold.ttf',
      'bold-italic': '/fonts/roboto-bold-italic.ttf',
    },
    'garamond-glc': {
      regular: '/fonts/garamont-glc.ttf',
    },
    crimson: {
      regular: '/fonts/crimson-regular.ttf',
      italic: '/fonts/crimson-italic.ttf',
      bold: '/fonts/crimson-bold.ttf',
      'bold-italic': '/fonts/crimson-bold-italic.ttf',
    },
  }

  const resolvedFontFamily = fontFamily?.value ?? 'roboto'
  const resolvedFontWeight = fontWeight?.value ?? 'regular'
  const fontUrl =
    fontMap[resolvedFontFamily]?.[resolvedFontWeight] ??
    fontMap[resolvedFontFamily]?.regular ??
    fontMap.roboto.regular

  const textRef = useRef<ComponentRef<typeof Text>>(null)
  const [textWidth, setTextWidth] = useState(0)
  const [textHeight, setTextHeight] = useState(0)
  const [fontReady, setFontReady] = useState(false)

  const calculateTextDimensions = () => {
    if (textRef.current) {
      const geometry = textRef.current.geometry
      geometry.computeBoundingBox()
      const boundingBox = geometry.boundingBox
      if (boundingBox) {
        const w = boundingBox.max.x - boundingBox.min.x
        const h = boundingBox.max.y - boundingBox.min.y
        setTextWidth(w > 0 ? w : 0)
        setTextHeight(h > 0 ? h : 0)
      }
    }
    // Font is loaded and text is laid out — safe to show
    setFontReady(true)
  }

  useEffect(() => {
    if (textRef.current) {
      textRef.current.sync()
      calculateTextDimensions()
    }
  }, [textContent])

  const planeWidth = width || 1
  const planeHeight = height || 1

  const getAnchorX = (align: typeof textAlign, planeW: number): number => {
    switch (align) {
      case 'left':
      case 'justify':
        return -planeW / 2 + planeW - padLeft3D
      case 'right':
        return planeW / 2 - planeW + textWidth + padRight3D
      case 'center':
        return textWidth / 2
      default:
        return 0
    }
  }

  // Calculate vertical position offset based on alignment
  // The text is anchored at 'top' and we offset its Y position
  const getTextYOffset = (vAlign: typeof textVerticalAlign, planeH: number): number => {
    const halfPlane = planeH / 2
    switch (vAlign) {
      case 'top':
        return halfPlane - padTop3D
      case 'center':
        return textHeight / 2
      case 'bottom':
        return -halfPlane + textHeight + padBottom3D
      default:
        return halfPlane - padTop3D
    }
  }

  return (
    <group
      position={position}
      quaternion={quaternion}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      {/* Background - paper texture (always on when flag set) or flat color */}
      {(() => {
        const cardDepth = Math.min(10, Math.max(0, textThickness?.value ?? 0)) / 100

        if (textBackgroundTexture) {
          return (
            <>
              <Suspense fallback={null}>
                <PaperBackground
                  width={planeWidth}
                  height={planeHeight}
                  depth={cardDepth}
                  tintColor={textBackgroundColor}
                />
              </Suspense>
              {showTextBorder && (
                <InsetBorder
                  width={planeWidth}
                  height={planeHeight}
                  inset={(textBorderOffset?.value ?? 1.2) / 100}
                  color={textBorderColor ?? '#c9a96e'}
                />
              )}
              {showMonogram && (
                <MonogramOverlay
                  width={planeWidth}
                  height={planeHeight}
                  color={monogramColor ?? '#c0392b'}
                  opacity={monogramOpacity?.value ?? 1.0}
                  size={(monogramSize?.value ?? 4) / 100}
                  position={monogramPosition ?? 'bottom'}
                  offset={(monogramOffset?.value ?? 2) / 100}
                />
              )}
            </>
          )
        }

        // Original flat-color background — only when background color is set or no text
        if (!(textBackgroundColor || !textContent)) return null

        if (cardDepth > 0) {
          return (
            <RoundedBox
              args={[planeWidth, planeHeight, cardDepth]}
              radius={0.003}
              smoothness={2}
              renderOrder={1}
              position={[0, 0, -cardDepth / 2]}
            >
              <meshStandardMaterial color={textBackgroundColor ?? 'white'} roughness={1.0} />
            </RoundedBox>
          )
        }
        return (
          <mesh renderOrder={1}>
            <planeGeometry args={[planeWidth, planeHeight]} />
            <meshBasicMaterial color={textBackgroundColor ?? 'white'} side={DoubleSide} />
          </mesh>
        )
      })()}

      {textContent && fontSize?.value && (
        <mesh
          key={id}
          renderOrder={2}
          position={[0, getTextYOffset(textVerticalAlign, planeHeight), 0.0003]}
          visible={fontReady}
        >
          <Text
            ref={textRef}
            fontSize={fontSize.value * fontSizeFactor}
            lineHeight={lineHeight?.value ?? 1}
            letterSpacing={
              letterSpacing?.value && fontSize?.value ? letterSpacing.value / fontSize.value : 0
            }
            color={textColor ?? 'black'}
            font={fontUrl}
            anchorX={getAnchorX(textAlign, width ?? 1)}
            anchorY="top"
            maxWidth={(width ?? 0) - paddingOffsetH}
            textAlign={textAlign ?? 'left'}
            whiteSpace="normal"
            overflowWrap="break-word"
            onSync={calculateTextDimensions}
            // Troika's SDF glyph atlas is sized by this value, and there is ONE
            // atlas per sdfGlyphSize shared by every font and every <Text> in
            // the scene. It is not a per-label quality knob.
            //
            // At 512 the atlas allocated 2048×8192 from the first glyph (~67 MB,
            // more than Vienna's whole wall+ceiling bake) — and 8192 is the max
            // texture dimension on many GPUs, so past 256 glyphs the allocation
            // simply fails and every label goes blank. It also grew every 16
            // glyphs, disposing and reallocating the GPU texture each time, and
            // any label drawing during that window has no atlas to sample.
            // Glyphs are counted PER FONT, so an exhibition mixing typefaces hit
            // the ceiling quickly — which is why text vanished intermittently.
            //
            // 256: four times the default glyph detail, with a 2048×2048 atlas
            // (32 glyphs per row, ~1024 capacity before the canvas would need to
            // exceed the 8192 texture limit). That is still 4× the headroom 512
            // had when it was overflowing and blanking text. Chosen over 128
            // because wall labels read slightly soft once the canvas dpr was
            // capped at 1.5 — text is far more sensitive to this than photos.
            // Do not raise without redoing the arithmetic:
            //   glyphsPerRow = (2048 / sdfGlyphSize) * 4
            //   startingHeight = sdfGlyphSize * 256 / glyphsPerRow
            sdfGlyphSize={256}
            outlineWidth="0.2%"
            outlineColor={textColor ?? 'black'}
          >
            {textContent}
          </Text>
        </mesh>
      )}
    </group>
  )
}

export default Stencil
