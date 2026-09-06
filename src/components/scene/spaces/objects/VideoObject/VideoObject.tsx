import { useMemo, useRef, useCallback, useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  CanvasTexture,
  DefaultLoadingManager,
  DoubleSide,
  Frustum,
  Matrix4,
  MeshStandardMaterial,
  SRGBColorSpace,
  Vector3,
  Quaternion,
} from 'three'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'

import { Frame } from '@/components/scene/spaces/objects/Frame'
import { Passepartout } from '@/components/scene/spaces/objects/Passepartout'
import { ShadowDecal } from '@/components/scene/spaces/objects/ShadowDecal'
import { Support } from '@/components/scene/spaces/objects/Support'
import { useSceneAudioActions } from '@/contexts/SceneAudioContext'
import { useAmbientLightColor } from '@/hooks/useAmbientLight'
import { showArtworkPanel } from '@/redux/slices/dashboardSlice'
import { setCurrentArtwork, setFocusTarget } from '@/redux/slices/sceneSlice'
import type { RootState } from '@/redux/store'
import type { RuntimeArtwork } from '@/utils/artworkTransform'
import { useDisposable } from '@/components/scene/spaces/objects/useDisposable'

type VideoObjectProps = {
  artwork: RuntimeArtwork
}

// Constants for click detection
const CLICK_MAX_DISTANCE = 5
const CLICK_MAX_DURATION = 300
const DOUBLE_CLICK_DELAY = 250

const VideoObject = ({ artwork }: VideoObjectProps) => {
  const {
    position,
    quaternion,
    width,
    height,
    videoUrl,
    videoPlayMode,
    videoLoop,
    videoProximityDistance,
    showFrame,
    frameColor,
    frameSize,
    frameThickness,
    showPassepartout,
    passepartoutColor,
    passepartoutSize,
    passepartoutThickness,
    supportThickness,
    supportColor,
    showSupport,
    hideShadow,
    frameCornerStyle,
    soundSpatial,
    soundDistance,
    videoVolume,
  } = artwork

  const playMode = videoPlayMode ?? 'proximity'

  const isPlaceholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)
  const isArtworkPanelOpen = useSelector((state: RootState) => state.dashboard.isArtworkPanelOpen)
  const focusTarget = useSelector((state: RootState) => state.scene.focusTarget)
  const shadowBlur = useSelector((state: RootState) => state.exhibition.shadowBlur ?? 0.025)
  const shadowSpread = useSelector((state: RootState) => state.exhibition.shadowSpread ?? 1.2)
  const shadowOpacity = useSelector((state: RootState) => state.exhibition.shadowOpacity ?? 0.25)
  const shadowDirection = useSelector((state: RootState) => state.exhibition.shadowDirection ?? 0.2)
  const dispatch = useDispatch()
  const { registerVideoAudio, unregisterVideoAudio } = useSceneAudioActions()

  // Refs for click detection
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
  const pointerDownTime = useRef<number>(0)
  const singleClickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Video element — created once, starts paused at frame 0 ──
  const [video] = useState(() => {
    if (!videoUrl) return null
    const vid = document.createElement('video')
    vid.src = videoUrl
    vid.crossOrigin = 'Anonymous'
    vid.loop = videoLoop ?? true
    vid.muted = true
    vid.playsInline = true
    vid.preload = 'auto'

    // Hook into Three.js loading manager so the Loader progress bar
    // waits for video data before the scene is considered ready
    const loadingUrl = `video:${videoUrl}`
    DefaultLoadingManager.itemStart(loadingUrl)
    vid.addEventListener(
      'canplaythrough',
      () => {
        DefaultLoadingManager.itemEnd(loadingUrl)
      },
      { once: true },
    )
    // Handle load errors gracefully so the loader doesn't hang forever
    vid.addEventListener(
      'error',
      () => {
        DefaultLoadingManager.itemEnd(loadingUrl)
      },
      { once: true },
    )

    vid.load() // Force browser to start buffering
    return vid
  })

  // Play state
  const isPlayingRef = useRef(false)
  // Minimum 4m, default 5m
  const proximityDistance = Math.max(4, videoProximityDistance ?? 5)

  // Dynamically sync loop prop ↔ video element
  useEffect(() => {
    if (video) video.loop = videoLoop ?? true
  }, [video, videoLoop])

  // ── Manually managed texture with resolution cap ──
  const MAX_TEXTURE_HEIGHT = 1080
  const MAX_TEXTURE_WIDTH = 1920

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const canvasCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const [videoTexture, setVideoTexture] = useState<CanvasTexture | null>(null)
  const frameCountRef = useRef(0)
  const meshRef = useRef<unknown>(null)
  const videoReadyRef = useRef(false)
  // Reusable objects for frustum culling (avoid per-frame GC)
  const frustumRef = useRef(new Frustum())
  const projMatrixRef = useRef(new Matrix4())
  // Pre-allocated Vector3 objects reused every frame (avoid GC pressure)
  const _artworkPosRef = useRef(new Vector3())
  const _forwardRef = useRef(new Vector3())
  const _upRef = useRef(new Vector3())

  // Create offscreen canvas + texture once the video metadata is available
  useEffect(() => {
    if (!video) return

    const setupCanvas = () => {
      const vw = video.videoWidth
      const vh = video.videoHeight
      if (!vw || !vh) return // metadata not loaded yet

      // Calculate downscaled dimensions (preserve aspect ratio)
      let canvasW = vw
      let canvasH = vh
      if (vh > MAX_TEXTURE_HEIGHT || vw > MAX_TEXTURE_WIDTH) {
        const scale = Math.min(MAX_TEXTURE_WIDTH / vw, MAX_TEXTURE_HEIGHT / vh)
        canvasW = Math.round(vw * scale)
        canvasH = Math.round(vh * scale)
      }

      const canvas = document.createElement('canvas')
      canvas.width = canvasW
      canvas.height = canvasH
      const ctx = canvas.getContext('2d')!
      // Draw initial black frame
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, canvasW, canvasH)

      canvasRef.current = canvas
      canvasCtxRef.current = ctx
      videoReadyRef.current = true

      const tex = new CanvasTexture(canvas)
      tex.colorSpace = SRGBColorSpace
      tex.generateMipmaps = false
      setVideoTexture(tex)
    }

    // If metadata is already loaded, set up immediately
    if (video.readyState >= 1) {
      setupCanvas()
    } else {
      video.addEventListener('loadedmetadata', setupCanvas, { once: true })
    }

    return () => {
      video.removeEventListener('loadedmetadata', setupCanvas)
      canvasRef.current = null
      canvasCtxRef.current = null
      videoReadyRef.current = false
      setVideoTexture((prev) => {
        prev?.dispose()
        return null
      })
    }
  }, [video])

  // ── Spatial audio via Web Audio API ──
  const audioCtxRef = useRef<AudioContext | null>(null)
  const pannerRef = useRef<PannerNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const spatialEnabledRef = useRef(soundSpatial ?? true)

  // Setup Web Audio graph once video starts playing
  useEffect(() => {
    if (!video) return

    const setupAudio = () => {
      // Only create once
      if (audioCtxRef.current) return

      const ctx = new AudioContext()
      audioCtxRef.current = ctx

      const source = ctx.createMediaElementSource(video)
      sourceRef.current = source

      const vol = videoVolume ?? 1.0
      const gain = ctx.createGain()
      gain.gain.value = vol
      gainRef.current = gain

      const panner = ctx.createPanner()
      panner.panningModel = 'HRTF'
      panner.distanceModel = 'inverse'
      panner.refDistance = soundDistance ?? 5
      panner.maxDistance = 100
      panner.rolloffFactor = 1
      pannerRef.current = panner

      if (soundSpatial ?? true) {
        source.connect(panner).connect(gain).connect(ctx.destination)
      } else {
        source.connect(gain).connect(ctx.destination)
      }

      // Register with global audio context for mute control
      registerVideoAudio(artwork.id, gain, vol)
    }

    // Try to set up on first play event
    video.addEventListener('play', setupAudio, { once: true })

    return () => {
      video.removeEventListener('play', setupAudio)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video, soundDistance, soundSpatial])

  // Update panner refDistance when soundDistance changes
  useEffect(() => {
    if (pannerRef.current) {
      pannerRef.current.refDistance = soundDistance ?? 5
    }
  }, [soundDistance])

  // Sync gain with videoVolume prop
  useEffect(() => {
    if (gainRef.current) {
      const vol = videoVolume ?? 1.0
      gainRef.current.gain.value = vol
      // Update the registered original volume
      registerVideoAudio(artwork.id, gainRef.current, vol)
    }
  }, [videoVolume, artwork.id, registerVideoAudio])

  // Reconnect graph when spatial toggle changes
  useEffect(() => {
    const ctx = audioCtxRef.current
    const source = sourceRef.current
    const panner = pannerRef.current
    const gain = gainRef.current
    if (!ctx || !source || !panner || !gain) return

    const wasSpatial = spatialEnabledRef.current
    const nowSpatial = soundSpatial ?? true
    if (wasSpatial === nowSpatial) return

    spatialEnabledRef.current = nowSpatial

    // Disconnect everything and reconnect
    source.disconnect()
    panner.disconnect()
    gain.disconnect()

    if (nowSpatial) {
      source.connect(panner).connect(gain).connect(ctx.destination)
    } else {
      source.connect(gain).connect(ctx.destination)
    }
  }, [soundSpatial])

  // Click mode: track when waiting for autofocus to complete before playing
  const waitingForFocusRef = useRef(false)

  // 'always' mode: auto-play on mount
  useEffect(() => {
    if (!video || playMode !== 'always') return

    // Start muted so browser autoplay policy allows it.
    // Unmute on first user interaction (e.g. dismissing the help modal).
    video.muted = true
    video.play().catch(() => {})
    isPlayingRef.current = true

    const unmute = () => {
      video.muted = false
      // Resume AudioContext if it was created in suspended state
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume()
      }
    }
    document.addEventListener('click', unmute, { once: true })

    return () => {
      document.removeEventListener('click', unmute)
      video.pause()
      video.muted = true
      isPlayingRef.current = false
    }
  }, [video, playMode])

  // Click mode: start video when autofocus completes (focusTarget clears)
  useEffect(() => {
    if (playMode !== 'click' || !video) return
    if (!focusTarget && waitingForFocusRef.current) {
      waitingForFocusRef.current = false
      if (!video.src || video.readyState === 0) {
        video.src = videoUrl!
        video.load()
      }
      video.muted = false
      video.play().catch(() => {})
      isPlayingRef.current = true
    }
  }, [focusTarget, playMode, video, videoUrl])

  // Clean up video element on unmount — only pause, don't destroy src
  useEffect(() => {
    return () => {
      if (video) {
        video.pause()
      }
    }
  }, [video])

  // Unregister video audio on unmount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => unregisterVideoAudio(artwork.id), [])

  // Ambient light colors
  const frameAmbientColor = useAmbientLightColor(frameColor ?? '#000000')
  const passepartoutAmbientColor = useAmbientLightColor(passepartoutColor ?? '#ffffff')
  const supportAmbientColor = useAmbientLightColor(supportColor ?? '#ffffff')

  // ── Proximity mode: play on enter, pause on exit ──
  useFrame(({ camera, invalidate }) => {
    if (playMode === 'proximity') {
      if (!position || !video || !videoUrl) return

      const artworkPos = _artworkPosRef.current.set(position.x, position.y, position.z)
      const distance = camera.position.distanceTo(artworkPos)

      if (distance <= proximityDistance && !isPlayingRef.current) {
        isPlayingRef.current = true
        // Defensive: restore src if cleared by HMR
        if (!video.src || video.readyState === 0) {
          video.src = videoUrl
          video.load()
        }
        video.muted = false
        video.play().catch(() => {})
      } else if (distance > proximityDistance && isPlayingRef.current) {
        isPlayingRef.current = false
        video.muted = true
        video.pause()
      }
    }

    // Update panner position for spatial audio (runs every frame, all modes)
    if (pannerRef.current && position) {
      // Firefox doesn't support positionX as AudioParam — fall back to deprecated setPosition()
      if (pannerRef.current.positionX) {
        pannerRef.current.positionX.value = position.x
        pannerRef.current.positionY.value = position.y
        pannerRef.current.positionZ.value = position.z
      } else {
        pannerRef.current.setPosition(position.x, position.y, position.z)
      }

      // Sync AudioListener position with camera
      const listener = audioCtxRef.current?.listener
      if (listener) {
        if (listener.positionX) {
          listener.positionX.value = camera.position.x
          listener.positionY.value = camera.position.y
          listener.positionZ.value = camera.position.z
          const forward = _forwardRef.current.set(0, 0, -1).applyQuaternion(camera.quaternion)
          const up = _upRef.current.set(0, 1, 0).applyQuaternion(camera.quaternion)
          listener.forwardX.value = forward.x
          listener.forwardY.value = forward.y
          listener.forwardZ.value = forward.z
          listener.upX.value = up.x
          listener.upY.value = up.y
          listener.upZ.value = up.z
        } else {
          // Firefox fallback: use deprecated setPosition/setOrientation
          listener.setPosition(camera.position.x, camera.position.y, camera.position.z)
          const forward = _forwardRef.current.set(0, 0, -1).applyQuaternion(camera.quaternion)
          const up = _upRef.current.set(0, 1, 0).applyQuaternion(camera.quaternion)
          listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z)
        }
      }
    }

    // ── Distance-based texture throttling + frustum culling ──
    if (videoTexture && video && position && videoReadyRef.current) {
      frameCountRef.current++

      const artworkPos = _artworkPosRef.current.set(position.x, position.y, position.z)
      const dist = camera.position.distanceTo(artworkPos)

      // Determine update interval based on distance
      let updateInterval: number
      if (dist <= 5) updateInterval = 1
      else if (dist <= 15) updateInterval = 3
      else if (dist <= 30) updateInterval = 10
      else updateInterval = 30

      // Frustum check — skip texture update if mesh is behind the camera
      const projMat = projMatrixRef.current
      projMat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      frustumRef.current.setFromProjectionMatrix(projMat)
      const inView = frustumRef.current.containsPoint(artworkPos)

      // Draw video frame to offscreen canvas (auto-downscaled) and update texture
      if (inView && frameCountRef.current % updateInterval === 0) {
        const ctx = canvasCtxRef.current
        const canvas = canvasRef.current
        if (ctx && canvas) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          videoTexture.needsUpdate = true
          // Request next frame for video texture updates (frameloop="demand")
          invalidate()
        }
      }
    }

    // Keep rendering while video is playing (frameloop="demand")
    if (isPlayingRef.current) {
      invalidate()
    }
  })

  // Calculate the normal vector from artwork's quaternion
  const getNormalFromQuaternion = useCallback((q: Quaternion): Vector3 => {
    const normal = new Vector3(0, 0, 1)
    normal.applyQuaternion(q)
    return normal
  }, [])

  // Handle single click — in 'click' mode: focus then play. Otherwise: just focus.
  const handleSingleClick = useCallback(() => {
    if (!isPlaceholdersShown && quaternion && position) {
      const normal = getNormalFromQuaternion(quaternion)

      const pBorder = (showPassepartout ? passepartoutSize?.value : 0) || 0
      const fBorder = (showFrame ? frameSize?.value : 0) || 0
      const displayWidth = (width || 1) + (pBorder * 2 + fBorder * 2) / 100
      const displayHeight = (height || 1) + (pBorder * 2 + fBorder * 2) / 100

      // Click mode: if playing, pause. If not, focus then play.
      if (playMode === 'click' && video) {
        if (isPlayingRef.current) {
          isPlayingRef.current = false
          video.muted = true
          video.pause()
          return
        }
        // Set flag — video will start when focusTarget clears
        waitingForFocusRef.current = true
      }

      // Dispatch focus target (camera autofocus)
      dispatch(
        setFocusTarget({
          artworkId: artwork.id,
          position: { x: position.x, y: position.y, z: position.z },
          normal: { x: normal.x, y: normal.y, z: normal.z },
          width: displayWidth,
          height: displayHeight,
        }),
      )

      if (isArtworkPanelOpen) {
        dispatch(setCurrentArtwork(artwork.id))
      }
    }
  }, [
    playMode,
    video,
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
    showFrame,
    frameSize,
  ])

  // Handle double click to open artwork panel
  const handleDoubleClick = useCallback(() => {
    dispatch(setCurrentArtwork(artwork.id))
    dispatch(showArtworkPanel())
  }, [dispatch, artwork.id])

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    pointerDownPos.current = { x: e.clientX, y: e.clientY }
    pointerDownTime.current = Date.now()
  }, [])

  const handlePointerUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()

      if (!pointerDownPos.current) return
      const dx = e.clientX - pointerDownPos.current.x
      const dy = e.clientY - pointerDownPos.current.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      const duration = Date.now() - pointerDownTime.current
      pointerDownPos.current = null

      if (distance > CLICK_MAX_DISTANCE || duration > CLICK_MAX_DURATION) return

      if (singleClickTimeout.current) {
        clearTimeout(singleClickTimeout.current)
        singleClickTimeout.current = null
        handleDoubleClick()
      } else {
        singleClickTimeout.current = setTimeout(() => {
          singleClickTimeout.current = null
          handleSingleClick()
        }, DOUBLE_CLICK_DELAY)
      }
    },
    [handleSingleClick, handleDoubleClick],
  )

  // Computed dimensions
  const planeWidth = width || 1
  const planeHeight = height || 1

  const frameS = showFrame ? (frameSize?.value ?? 3) : 0
  const frameDepth = Math.min(20, Math.max(1, frameThickness?.value ?? 1))
  const passepartoutS = showPassepartout ? (passepartoutSize?.value ?? 5) : 0
  const passepartoutDepth = Math.min(3, Math.max(0.2, passepartoutThickness?.value ?? 0.4))
  const supportDepth = Math.min(10, Math.max(0, supportThickness?.value ?? 2))

  const passepartoutBorder = passepartoutS / 100
  const frameBorder = frameS / 100

  const passepartoutOuterW = planeWidth + passepartoutBorder * 2
  const passepartoutOuterH = planeHeight + passepartoutBorder * 2
  const frameOuterW = passepartoutOuterW + frameBorder * 2
  const frameOuterH = passepartoutOuterH + frameBorder * 2
  const totalWidth = frameOuterW
  const totalHeight = frameOuterH

  // Materials
  const frameMatObj = useMemo(() => {
    return new MeshStandardMaterial({
      color: frameAmbientColor,
      roughness: 0.6,
      metalness: 0.05,
    })
  }, [frameAmbientColor])
  useDisposable(frameMatObj)

  const passepartoutMaterial = useMemo(() => {
    return new MeshStandardMaterial({
      color: passepartoutAmbientColor,
      roughness: 1,
    })
  }, [passepartoutAmbientColor])
  useDisposable(passepartoutMaterial)

  const supportMaterial = useMemo(() => {
    return new MeshStandardMaterial({
      color: supportAmbientColor,
      roughness: 1.0,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2,
    })
  }, [supportAmbientColor])
  useDisposable(supportMaterial)

  return (
    <group
      position={position}
      quaternion={quaternion}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {/* Invisible hit area covering the full frame */}
      <mesh renderOrder={1}>
        <planeGeometry args={[totalWidth, totalHeight]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Artwork plane — video as self-lit screen */}
      <group position={[0, 0, showSupport ? supportDepth / 100 : 0]}>
        {video && videoTexture ? (
          <mesh ref={meshRef} castShadow receiveShadow renderOrder={2}>
            <planeGeometry args={[planeWidth, planeHeight]} />
            <meshStandardMaterial
              color="black"
              emissive="white"
              emissiveMap={videoTexture}
              emissiveIntensity={0.6}
              toneMapped={false}
              side={DoubleSide}
            />
          </mesh>
        ) : (
          <mesh renderOrder={2}>
            <planeGeometry args={[planeWidth, planeHeight]} />
            <meshBasicMaterial color="white" side={DoubleSide} />
          </mesh>
        )}
      </group>

      {/* Frame */}
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

      {/* Passepartout */}
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

      {/* Shadow */}
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

      {/* Support */}
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

export default VideoObject
