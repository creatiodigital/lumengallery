import { useMemo, useRef, useCallback, useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  DoubleSide,
  MeshStandardMaterial,
  SRGBColorSpace,
  Vector3,
  Vector2,
  Quaternion,
  TextureLoader,
  Texture,
  LinearMipmapLinearFilter,
} from 'three'
import type { ThreeEvent } from '@react-three/fiber'

import { Frame } from '@/components/scene/spaces/objects/Frame'
import { Passepartout } from '@/components/scene/spaces/objects/Passepartout'
import { ShadowDecal } from '@/components/scene/spaces/objects/ShadowDecal'
import { Support } from '@/components/scene/spaces/objects/Support'
import { useAmbientLightColor } from '@/hooks/useAmbientLight'
import { showArtworkPanel } from '@/redux/slices/dashboardSlice'
import { setCurrentArtwork, setFocusTarget } from '@/redux/slices/sceneSlice'
import type { RootState } from '@/redux/store'
import type { RuntimeArtwork } from '@/utils/artworkTransform'
import { assetUrl } from '@/lib/assetUrl'

type DisplayProps = {
  artwork: RuntimeArtwork
}

type ArtworkImageProps = {
  url: string
  width: number
  height: number
}

// Placeholder shown while texture loads
const ImagePlaceholder = ({ width, height }: { width: number; height: number }) => (
  <mesh renderOrder={2}>
    <planeGeometry args={[width, height]} />
    <meshBasicMaterial color="#f0f0f0" side={DoubleSide} />
  </mesh>
)

// Bounded, reference-counted in-memory cache of decoded artwork textures,
// keyed by image URL.
//
// Purpose: keep textures resident across a scene unmount/remount — e.g. when a
// visitor opens an artwork detail page and navigates back, the exhibition scene
// remounts from scratch. Without this, every image refetches/decodes/uploads and
// briefly shows the gray placeholder (the "blank flash"). With it, the hook
// returns the existing texture synchronously, so the image is there immediately.
//
// Memory-safe for large exhibitions (many images, plus video/sound elsewhere):
//  - Reference-counted: a texture currently on screen (refs > 0) is NEVER
//    disposed, so visible artwork can't break.
//  - Pruning runs only when NEW textures load (i.e. entering a different
//    exhibition), never when leaving — so the round-trip to an artwork page and
//    back disposes nothing, even for a huge exhibition.
//  - When a load pushes the cache past MAX_RETAINED_TEXTURES, the least-recently
//    -used UNMOUNTED textures (refs === 0, e.g. left over from a previous
//    exhibition) are disposed, freeing their GPU memory.
//  - In-memory only (gone on a hard refresh) and keyed by URL, so it can never
//    serve a stale image — a re-uploaded image gets a new URL = cache miss.
type TextureCacheEntry = { texture: Texture; refs: number }
const MAX_RETAINED_TEXTURES = 48
const textureCache = new Map<string, TextureCacheEntry>()

const configureTexture = (texture: Texture) => {
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
}

// Re-insert so this entry counts as most-recently-used (Map keeps insertion order).
const touchTexture = (url: string, entry: TextureCacheEntry) => {
  textureCache.delete(url)
  textureCache.set(url, entry)
}

// Dispose least-recently-used, currently-unmounted textures until within budget.
// Called only on new loads, so leaving an exhibition never triggers disposal.
const pruneTextureCache = () => {
  if (textureCache.size <= MAX_RETAINED_TEXTURES) return
  for (const [url, entry] of textureCache) {
    if (textureCache.size <= MAX_RETAINED_TEXTURES) break
    if (entry.refs === 0) {
      entry.texture.dispose()
      textureCache.delete(url)
    }
  }
}

// Acquire a cached texture, marking one active on-screen reference. Null on miss.
const acquireTexture = (url: string): Texture | null => {
  const entry = textureCache.get(url)
  if (!entry) return null
  entry.refs += 1
  touchTexture(url, entry)
  return entry.texture
}

// Store a freshly loaded texture. `active` = the requesting component is still
// mounted. Returns the canonical texture (handles concurrent load races).
const storeTexture = (url: string, texture: Texture, active: boolean): Texture => {
  const existing = textureCache.get(url)
  if (existing) {
    if (texture !== existing.texture) texture.dispose() // lost a race; drop the dup
    if (active) existing.refs += 1
    touchTexture(url, existing)
    return existing.texture
  }
  textureCache.set(url, { texture, refs: active ? 1 : 0 })
  pruneTextureCache()
  return texture
}

// Release one on-screen reference. Does not dispose — pruning handles that on the
// next load, so leaving a scene never frees textures we may immediately return to.
const releaseTexture = (url: string) => {
  const entry = textureCache.get(url)
  if (entry) entry.refs = Math.max(0, entry.refs - 1)
}

// Shared texture loader for both blob: and regular URLs, with ref-counted caching.
const useCachedTexture = (url: string, accept: (u: string) => boolean): Texture | null => {
  const [texture, setTexture] = useState<Texture | null>(() =>
    url && accept(url) ? (textureCache.get(url)?.texture ?? null) : null,
  )

  useEffect(() => {
    if (!url || !accept(url)) {
      setTexture(null)
      return
    }

    const cached = acquireTexture(url)
    if (cached) {
      setTexture(cached)
      return () => releaseTexture(url)
    }

    let active = true
    const loader = new TextureLoader()
    loader.load(
      url,
      (loaded) => {
        configureTexture(loaded)
        const stored = storeTexture(url, loaded, active)
        if (active) setTexture(stored)
      },
      undefined,
      (error) => {
        console.warn('Failed to load texture:', url, error)
        if (active) setTexture(null)
      },
    )

    return () => {
      active = false
      releaseTexture(url)
    }
  }, [url, accept])

  return texture
}

const isBlobUrl = (url: string) => url.startsWith('blob:')
const isNonEmptyUrl = (url: string) => url !== ''

// Custom hook to load blob URLs directly with TextureLoader
const useBlobTexture = (url: string): Texture | null => useCachedTexture(url, isBlobUrl)

// Apply "background-size: cover" style UV mapping to a texture.
// Crops and centers the texture so it fills the plane without distortion.
const applyCoverUVs = (texture: Texture, planeWidth: number, planeHeight: number) => {
  const imgAspect = texture.image.width / texture.image.height
  const planeAspect = planeWidth / planeHeight

  if (imgAspect > planeAspect) {
    // Image is wider than plane — crop sides
    const scale = planeAspect / imgAspect
    texture.repeat.set(scale, 1)
    texture.offset.set((1 - scale) / 2, 0)
  } else {
    // Image is taller than plane — crop top/bottom
    const scale = imgAspect / planeAspect
    texture.repeat.set(1, scale)
    texture.offset.set(0, (1 - scale) / 2)
  }
}

// Component for blob URL images (uses custom loader)
const BlobImage = ({ url, width, height }: ArtworkImageProps) => {
  const texture = useBlobTexture(url)
  const ambientColor = useAmbientLightColor('#ffffff', 1.0)

  if (!texture) {
    return <ImagePlaceholder width={width} height={height} />
  }

  applyCoverUVs(texture, width, height)

  return (
    <mesh castShadow receiveShadow renderOrder={2}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} color={ambientColor} side={DoubleSide} />
    </mesh>
  )
}

// Custom hook to load regular URL textures with error handling
const useRegularTexture = (url: string): Texture | null => useCachedTexture(url, isNonEmptyUrl)

// Component for regular URL images (uses custom loader with error handling)
const RegularImage = ({ url, width, height }: ArtworkImageProps) => {
  const texture = useRegularTexture(url)
  const ambientColor = useAmbientLightColor('#ffffff', 1.0)

  if (!texture) {
    return <ImagePlaceholder width={width} height={height} />
  }

  applyCoverUVs(texture, width, height)

  return (
    <mesh castShadow receiveShadow renderOrder={2}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} color={ambientColor} side={DoubleSide} />
    </mesh>
  )
}

const ArtworkImage = ({ url, width, height }: ArtworkImageProps) => {
  // Skip rendering if URL is empty or invalid
  if (!url || url === '') {
    return <ImagePlaceholder width={width} height={height} />
  }

  // Use custom loader for blob URLs (temporary local previews)
  if (url.startsWith('blob:')) {
    return <BlobImage url={url} width={width} height={height} />
  }

  // Use custom loader for regular URLs (with error handling)
  return <RegularImage url={url} width={width} height={height} />
}

// Constants for click detection
const CLICK_MAX_DISTANCE = 5 // Max pixels of mouse movement to qualify as click
const CLICK_MAX_DURATION = 300 // Max ms between pointer down and up for a click
const DOUBLE_CLICK_DELAY = 250 // Delay to wait for potential double-click

const Display = ({ artwork }: DisplayProps) => {
  const {
    position,
    quaternion,
    width,
    height,
    showArtworkInformation,
    imageUrl,
    showFrame,
    frameColor,
    frameSize,
    frameThickness,
    showPassepartout,
    passepartoutColor,
    passepartoutSize,
    passepartoutThickness,
    showPaperBorder,
    paperBorderSize,
    supportThickness,
    supportColor,
    showSupport,
    hideShadow,
    frameMaterial,
    frameCornerStyle,
    frameTextureScale,
    frameTextureRotation,
    frameTextureRoughness,
    frameTextureNormalScale,
  } = artwork

  const isPlaceholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)
  const isArtworkPanelOpen = useSelector((state: RootState) => state.dashboard.isArtworkPanelOpen)
  const autofocusGroups = useSelector((state: RootState) => state.exhibition.autofocusGroups ?? [])
  const shadowBlur = useSelector((state: RootState) => state.exhibition.shadowBlur ?? 0.025)
  const shadowSpread = useSelector((state: RootState) => state.exhibition.shadowSpread ?? 1.2)
  const shadowOpacity = useSelector((state: RootState) => state.exhibition.shadowOpacity ?? 0.25)
  const shadowDirection = useSelector((state: RootState) => state.exhibition.shadowDirection ?? 0.2)
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )
  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const dispatch = useDispatch()

  // Refs for click detection
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
  const pointerDownTime = useRef<number>(0)
  const singleClickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Use the ambient light hook for frame and passepartout colors
  const frameAmbientColor = useAmbientLightColor(frameColor ?? '#000000')
  const passepartoutAmbientColor = useAmbientLightColor(passepartoutColor ?? '#ffffff')
  const supportAmbientColor = useAmbientLightColor(supportColor ?? '#ffffff')

  // Calculate the normal vector from artwork's quaternion (facing direction)
  const getNormalFromQuaternion = useCallback((q: Quaternion): Vector3 => {
    // Default plane faces +Z, apply quaternion to get actual facing direction
    const normal = new Vector3(0, 0, 1)
    normal.applyQuaternion(q)
    return normal
  }, [])

  // Handle single click for focus (and update panel info if panel is open)
  const handleSingleClick = useCallback(() => {
    if (!isPlaceholdersShown && quaternion && position) {
      const normal = getNormalFromQuaternion(quaternion)

      // Check if this artwork belongs to an autofocus group
      const group = autofocusGroups.find((g) => g.artworkIds.includes(artwork.id))

      if (group && group.artworkIds.length >= 2) {
        // Compute group center from all member positions
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
          if (
            memberArt?.showPaperBorder &&
            memberArt?.imageUrl &&
            memberArt?.paperBorderSize?.value
          ) {
            halfW += memberArt.paperBorderSize.value / 100
            halfH += memberArt.paperBorderSize.value / 100
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
        const pBorder = (showPassepartout ? passepartoutSize?.value : 0) || 0
        const fBorder = (showFrame ? frameSize?.value : 0) || 0
        const paperBorderCm = (showPaperBorder ? paperBorderSize?.value : 0) || 0
        const displayWidth = (width || 1) + (pBorder * 2 + fBorder * 2 + paperBorderCm * 2) / 100
        const displayHeight = (height || 1) + (pBorder * 2 + fBorder * 2 + paperBorderCm * 2) / 100

        dispatch(
          setFocusTarget({
            artworkId: artwork.id,
            position: { x: position.x, y: position.y, z: position.z },
            normal: { x: normal.x, y: normal.y, z: normal.z },
            width: displayWidth,
            height: displayHeight,
          }),
        )
      }

      // If the panel is already open, also update the current artwork info
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
    showPassepartout,
    passepartoutSize,
    showPaperBorder,
    paperBorderSize,
    showFrame,
    frameSize,
    autofocusGroups,
    exhibitionArtworksById,
    artworksById,
  ])

  // Handle double click for info panel (existing behavior)
  const handleDoubleClick = useCallback(() => {
    // Cancel any pending single-click action
    if (singleClickTimeout.current) {
      clearTimeout(singleClickTimeout.current)
      singleClickTimeout.current = null
    }

    if (!isPlaceholdersShown && showArtworkInformation) {
      dispatch(showArtworkPanel())
      dispatch(setCurrentArtwork(artwork.id))
    }
  }, [dispatch, artwork.id, isPlaceholdersShown, showArtworkInformation])

  // Pointer down - start tracking (and clear any pending single-click to support double-click)
  const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    // Clear any pending single-click timeout (this is the start of a potential double-click)
    if (singleClickTimeout.current) {
      clearTimeout(singleClickTimeout.current)
      singleClickTimeout.current = null
    }
    pointerDownPos.current = { x: event.clientX, y: event.clientY }
    pointerDownTime.current = Date.now()
  }, [])

  // Pointer up - check if it qualifies as a click
  const handlePointerUp = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!pointerDownPos.current) return

      const dx = event.clientX - pointerDownPos.current.x
      const dy = event.clientY - pointerDownPos.current.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      const duration = Date.now() - pointerDownTime.current

      // Reset tracking
      pointerDownPos.current = null

      // Check if this qualifies as a click (minimal movement + short duration)
      if (distance < CLICK_MAX_DISTANCE && duration < CLICK_MAX_DURATION) {
        // Delay single-click action to see if a double-click follows
        singleClickTimeout.current = setTimeout(() => {
          handleSingleClick()
          singleClickTimeout.current = null
        }, DOUBLE_CLICK_DELAY)
      }
    },
    [handleSingleClick],
  )

  const planeWidth = width || 1
  const planeHeight = height || 1

  // Load PBR textures for both frame materials (via useEffect to avoid render-time state updates)
  const [plasticTextures, setPlasticTextures] = useState<{
    diffuse: Texture
    normal: Texture
    roughnessMap: Texture
  } | null>(null)

  useEffect(() => {
    const loader = new TextureLoader()
    const diffuse = loader.load(assetUrl('/assets/materials/plastic-frame/diffuse.jpg'))
    const normal = loader.load(assetUrl('/assets/materials/plastic-frame/normal.jpg'))
    const roughnessMap = loader.load(assetUrl('/assets/materials/plastic-frame/roughness.jpg'))

    ;[diffuse, normal, roughnessMap].forEach((tex) => {
      tex.wrapS = tex.wrapT = 1000 // RepeatWrapping
      tex.repeat.set(2, 2)
    })

    diffuse.colorSpace = SRGBColorSpace

    setPlasticTextures({ diffuse, normal, roughnessMap })

    return () => {
      diffuse.dispose()
      normal.dispose()
      roughnessMap.dispose()
    }
  }, [])

  const [woodTextures, setWoodTextures] = useState<{
    diffuse: Texture
    normal: Texture
    roughnessMap: Texture
  } | null>(null)

  useEffect(() => {
    // Determine which wood folder to load based on frameMaterial
    const woodFolder = frameMaterial?.startsWith('wood') ? frameMaterial : 'wood-dark'
    const woodBase = assetUrl(`/assets/materials/wooden-frame-${woodFolder.replace('wood-', '')}`)
    const loader = new TextureLoader()
    const diffuse = loader.load(`${woodBase}/diffuse.jpg?v=2`)
    const normal = loader.load(`${woodBase}/normal.jpg?v=2`)
    const roughnessMap = loader.load(`${woodBase}/roughness.jpg?v=2`)

    ;[diffuse, normal, roughnessMap].forEach((tex) => {
      tex.wrapS = tex.wrapT = 1000 // RepeatWrapping
    })

    diffuse.colorSpace = SRGBColorSpace

    setWoodTextures({ diffuse, normal, roughnessMap })

    return () => {
      diffuse.dispose()
      normal.dispose()
      roughnessMap.dispose()
    }
  }, [frameMaterial])

  // Apply wood texture control properties reactively
  const texScale = frameTextureScale ?? 2.0
  const texRotation = ((frameTextureRotation ?? 0) * Math.PI) / 180

  // Per-artwork seed offset so adjacent wood frames don't have identical grain patterns
  const artworkSeedOffset = useMemo(() => {
    const id = artwork.id || ''
    let hash = 0
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) | 0
    }
    return {
      x: (hash & 0xffff) / 0xffff, // 0–1 range
      y: ((hash >>> 16) & 0xffff) / 0xffff, // 0–1 range
    }
  }, [artwork.id])

  useMemo(() => {
    if (!woodTextures) return
    ;[woodTextures.diffuse, woodTextures.normal, woodTextures.roughnessMap].forEach((tex) => {
      tex.repeat.set(1 / texScale, 1 / texScale)
      tex.offset.set(artworkSeedOffset.x, artworkSeedOffset.y)
      tex.rotation = texRotation
      tex.center.set(0.5, 0.5)
      tex.needsUpdate = true
    })
  }, [woodTextures, texScale, texRotation, artworkSeedOffset])

  // Frame material: plastic PBR or wood PBR based on dropdown
  const frameMaterialType = frameMaterial ?? 'plastic'
  const frameMatObj = useMemo(() => {
    if (frameMaterialType.startsWith('wood') && woodTextures) {
      const tintColor = frameColor ?? '#ffffff'
      const isPainted = tintColor !== '#ffffff'
      return new MeshStandardMaterial({
        // When painted: drop diffuse, paint color IS the base; normal+roughness keep grain detail
        // When natural: diffuse provides the wood color
        map: isPainted ? null : woodTextures.diffuse,
        normalMap: woodTextures.normal,
        normalScale: new Vector2(frameTextureNormalScale ?? 0.5, frameTextureNormalScale ?? 0.5),
        roughnessMap: woodTextures.roughnessMap,
        color: tintColor,
        roughness: frameTextureRoughness ?? 0.6,
        metalness: 0.05,
      })
    }
    // Plastic: use normal + roughness for subtle surface detail, but pure user color
    return new MeshStandardMaterial({
      normalMap: plasticTextures?.normal ?? null,
      roughnessMap: plasticTextures?.roughnessMap ?? null,
      color: frameAmbientColor,
      roughness: frameTextureRoughness ?? 0.6,
      metalness: 0.05,
    })
  }, [
    frameMaterialType,
    frameAmbientColor,
    frameColor,
    woodTextures,
    plasticTextures,
    frameTextureRoughness,
    frameTextureNormalScale,
  ])

  // Passepartout material with ambient light applied
  const passepartoutMaterial = useMemo(() => {
    return new MeshStandardMaterial({
      color: passepartoutAmbientColor,
      roughness: 1,
    })
  }, [passepartoutAmbientColor])

  // Support material with ambient light applied
  const supportMaterial = useMemo(() => {
    return new MeshStandardMaterial({
      color: supportAmbientColor,
      roughness: 1.0, // Fully rough like canvas or wood
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2,
    })
  }, [supportAmbientColor])

  const frameS = showFrame ? (frameSize?.value ?? 3) : 0
  // frameThickness is for Z-depth, range 1-20
  const frameDepth = Math.min(20, Math.max(1, frameThickness?.value ?? 1))
  const passepartoutS = showPassepartout ? (passepartoutSize?.value ?? 5) : 0
  // passepartoutThickness is for Z-depth, clamped 0.1-1.0
  const passepartoutDepth = Math.min(3, Math.max(0.2, passepartoutThickness?.value ?? 0.4))
  // supportThickness is for Z-depth, clamped 0-10
  const supportDepth = Math.min(10, Math.max(0, supportThickness?.value ?? 2))
  // Paper border (white margin) — extends paper plane around the image
  const paperBorderS = showPaperBorder ? (paperBorderSize?.value ?? 0) : 0

  // Image stays at the artist-specified size (planeWidth × planeHeight).
  // Paper, passepartout, and frame each grow OUTWARD around the image.
  const paperBorder = paperBorderS / 100 // border width in 3D units (cm → m)
  const passepartoutBorder = passepartoutS / 100
  const frameBorder = frameS / 100

  // Paper outer = image + paper border on each side
  const paperOuterW = planeWidth + paperBorder * 2
  const paperOuterH = planeHeight + paperBorder * 2

  // Passepartout outer = paper outer + passepartout border on each side
  const passepartoutOuterW = paperOuterW + passepartoutBorder * 2
  const passepartoutOuterH = paperOuterH + passepartoutBorder * 2

  // Frame outer = passepartout outer + frame border on each side
  const frameOuterW = passepartoutOuterW + frameBorder * 2
  const frameOuterH = passepartoutOuterH + frameBorder * 2

  // The overall display size (for hit area and shadow)
  const totalWidth = frameOuterW
  const totalHeight = frameOuterH

  return (
    <group
      position={position}
      quaternion={quaternion}
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <mesh renderOrder={1}>
        <planeGeometry args={[totalWidth, totalHeight]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Artwork sits on top of support surface — at the artist-specified size */}
      <group position={[0, 0, showSupport ? supportDepth / 100 : 0]}>
        {/* Paper sheet — extends past the image as a white margin on every side */}
        {showPaperBorder && paperBorder > 0 && (
          <mesh renderOrder={1} position={[0, 0, -0.0005]}>
            <planeGeometry args={[paperOuterW, paperOuterH]} />
            <meshBasicMaterial color="#ffffff" side={DoubleSide} />
          </mesh>
        )}

        {!imageUrl && (
          <mesh renderOrder={2}>
            <planeGeometry args={[planeWidth, planeHeight]} />
            <meshBasicMaterial color="white" side={DoubleSide} />
          </mesh>
        )}

        {imageUrl && <ArtworkImage url={imageUrl} width={planeWidth} height={planeHeight} />}
      </group>

      {/* Frame extends backward from Z=0 by frameDepth — outermost layer */}
      {showFrame && (
        <Frame
          width={frameOuterW}
          height={frameOuterH}
          thickness={frameBorder}
          depth={frameDepth / 100}
          material={frameMatObj}
          cornerStyle={(frameCornerStyle as 'mitered' | 'straight') ?? 'mitered'}
        />
      )}

      {/* Passepartout sits ON TOP of support surface — between frame and image */}
      {showPassepartout && (
        <group position={[0, 0, showSupport ? supportDepth / 100 : 0]}>
          <Passepartout
            width={passepartoutOuterW}
            height={passepartoutOuterH}
            thickness={passepartoutBorder}
            depth={passepartoutDepth / 100}
            material={passepartoutMaterial}
          />
        </group>
      )}

      {/* Shadow blur - memoized component, size proportional to frame depth */}
      {!hideShadow && (
        <ShadowDecal
          width={totalWidth}
          height={totalHeight}
          frameDepth={showFrame ? frameDepth / 100 : showSupport ? supportDepth / 100 : 0}
          blur={shadowBlur}
          spread={shadowSpread}
          opacity={shadowOpacity}
          direction={shadowDirection}
        />
      )}

      {/* Support (canvas/panel depth) - fits inside frame, front at Z=0 */}
      {showSupport && supportDepth > 0 && (
        <Support
          width={passepartoutOuterW}
          height={passepartoutOuterH}
          depth={supportDepth / 100}
          material={supportMaterial}
        />
      )}
    </group>
  )
}

export default Display
