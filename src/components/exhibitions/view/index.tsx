'use client'

import { useProgress } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Info,
  Mouse,
  Touchpad,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'

import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'
import Monogram from '@/icons/monogram.svg'
import { preloadFloorMaterial } from '@/components/scene/spaces/objects/Floor/ReflectiveFloor'
import { ArtworkPanel } from '@/components/editview/ArtworkPanel'
import { ArtworkModal } from '@/components/exhibitions/view/ArtworkModal/ArtworkModal'
import { Scene } from '@/components/scene'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useLoadExhibitionArtworks } from '@/hooks/useLoadExhibitionArtworks'
import { useGetExhibitionByUrlQuery } from '@/redux/slices/exhibitionApi'
import { setExhibition } from '@/redux/slices/exhibitionSlice'
import { closeArtworkModal } from '@/redux/slices/dashboardSlice'
import { hidePlaceholders, resetScene } from '@/redux/slices/sceneSlice'
import { resetWallView } from '@/redux/slices/wallViewSlice'
import type { AppDispatch, RootState } from '@/redux/store'
import type { TExhibition } from '@/types/exhibition'
import { Text } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'
import Tooltip from '@/components/ui/Tooltip/Tooltip'
import styles from './ExhibitionView.module.scss'

interface NavigationButtonProps {
  artistSlug: string
  exhibitionSlug: string
}

const NavigationButton = ({ artistSlug, exhibitionSlug }: NavigationButtonProps) => {
  const router = useRouter()

  const handleClick = () => {
    try {
      const nav = sessionStorage.getItem('the-art-room:internal-nav')
      if (nav) {
        const { returnUrl } = JSON.parse(nav)
        sessionStorage.removeItem('the-art-room:internal-nav')
        if (returnUrl) {
          router.push(returnUrl)
          return
        }
      }
    } catch {}
    router.push(`/exhibitions/${artistSlug}/${exhibitionSlug}`)
  }

  return (
    <div className={styles.navigationButtonWrapper}>
      <Tooltip label="Leave Exhibition" placement="left">
        <Button
          variant="ghost"
          onClick={handleClick}
          className={styles.navigationButton}
          aria-label="Leave Exhibition"
        >
          <X size={20} strokeWidth={ICON_STROKE_WIDTH} />
        </Button>
      </Tooltip>
    </div>
  )
}

interface ExhibitionViewPageProps {
  artistSlug: string
  exhibitionSlug: string
}

const LoadingOverlay = () => {
  const { active, progress } = useProgress()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!active && progress >= 100) {
      const timer = setTimeout(() => setDismissed(true), 100)
      return () => clearTimeout(timer)
    }
  }, [active, progress])

  if (dismissed) return null

  return (
    <div className={styles.loadingOverlay}>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>
      <Text as="span">
        {active ? `Loading Exhibition ${Math.round(progress)}%` : 'Almost ready...'}
      </Text>
    </div>
  )
}

const MobileExhibitionView = ({
  artistSlug,
  exhibitionSlug,
}: {
  artistSlug: string
  exhibitionSlug: string
}) => {
  return (
    <div className={styles.mobileOverlay}>
      <div className={styles.mobileOverlayContent}>
        <Text as="h2" size="lg" font="serif" className={styles.mobileOverlayTitle}>
          Step inside on a bigger screen
        </Text>
        <Text as="p" size="md" className={styles.mobileOverlayText}>
          This immersive space is best explored on a laptop or desktop, where there&apos;s room to
          roam — but you won&apos;t miss a thing in the meantime. The full exhibition, with every
          artwork, is right here on the exhibition page.
        </Text>
        <Link
          href={`/exhibitions/${artistSlug}/${exhibitionSlug}`}
          className={styles.mobileOverlayButton}
        >
          View the full exhibition
        </Link>
      </div>
    </div>
  )
}

// Nav help is dismissed globally — once a visitor learns the controls,
// they don't need to re-learn them per exhibition.
const NAVIGATION_HELP_STORAGE_KEY = 'the-art-room:navigation-help-dismissed'

// Media notice is dismissed PER exhibition: each exhibition with audio /
// video needs to warn the visitor fresh, since sound is exhibition-
// specific (the user has to know which rooms to turn the volume up for).
// Key shape: `${MEDIA_NOTICE_STORAGE_PREFIX}${exhibitionId}`.
const MEDIA_NOTICE_STORAGE_PREFIX = 'the-art-room:media-notice-dismissed:'

interface NavigationHelpModalProps {
  hidden?: boolean
  /** ID of the exhibition currently being viewed. */
  exhibitionId?: string
  /** True once `state.artworks.byId` has been populated for the current
   *  exhibition (vs. still holding the previous exhibition's data). Auto-
   *  show is gated on this so we don't read stale artworks and warn
   *  about media that isn't here. */
  artworksReady?: boolean
}

type ModalStep = 'none' | 'help' | 'media'

const NavigationHelpModal = ({ hidden, exhibitionId, artworksReady }: NavigationHelpModalProps) => {
  const [currentStep, setCurrentStep] = useState<ModalStep>('none')
  const [helpDismissed, setHelpDismissed] = useState(false)
  const [mediaDismissed, setMediaDismissed] = useState(false)
  const hasCheckedStorage = useRef(false)

  // Detect if exhibition has video or sound artworks
  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const hasMediaArtworks = useMemo(() => {
    return Object.values(artworksById).some((artwork) => artwork.soundUrl || artwork.videoUrl)
  }, [artworksById])

  // Auto-show on mount: help first, then media. Gated on `artworksReady`
  // so navigating exhibition A → B doesn't trigger the media modal for B
  // based on A's still-cached artworks in Redux.
  useEffect(() => {
    if (!exhibitionId || !artworksReady) return
    if (hasCheckedStorage.current) return
    hasCheckedStorage.current = true

    const isMobile = window.innerWidth < 1024
    if (isMobile) return

    try {
      const helpDone = localStorage.getItem(NAVIGATION_HELP_STORAGE_KEY) === 'true'
      const mediaKey = `${MEDIA_NOTICE_STORAGE_PREFIX}${exhibitionId}`
      const mediaDone = localStorage.getItem(mediaKey) === 'true'

      if (helpDone) setHelpDismissed(true)
      if (mediaDone) setMediaDismissed(true)

      if (!helpDone) {
        const timer = setTimeout(() => setCurrentStep('help'), 500)
        return () => clearTimeout(timer)
      } else if (!mediaDone && hasMediaArtworks) {
        const timer = setTimeout(() => setCurrentStep('media'), 500)
        return () => clearTimeout(timer)
      }
    } catch {
      setCurrentStep('help')
    }
  }, [exhibitionId, artworksReady, hasMediaArtworks])

  // Track if the current flow was manually triggered (info button)
  const manualTriggerRef = useRef(false)

  const handleCloseHelp = () => {
    setCurrentStep('none')
    // After help closes, show media notice if exhibition has media
    if (hasMediaArtworks && (manualTriggerRef.current || !mediaDismissed)) {
      setTimeout(() => setCurrentStep('media'), 300)
    }
    manualTriggerRef.current = false
  }

  const handleCloseMedia = () => {
    setCurrentStep('none')
    manualTriggerRef.current = false
  }

  const handleInfoClick = () => {
    manualTriggerRef.current = true
    setCurrentStep('help')
  }

  if (hidden) return null

  return (
    <>
      <Button
        variant="ghost"
        onClick={handleInfoClick}
        className={styles.infoButton}
        aria-label="Navigation help"
      >
        <Info size={20} strokeWidth={ICON_STROKE_WIDTH} />
      </Button>

      {/* Help Modal */}
      {currentStep === 'help' && (
        <div className={styles.infoOverlay} onClick={handleCloseHelp}>
          <div className={styles.infoPanel} onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              onClick={handleCloseHelp}
              className={styles.infoPanelClose}
              aria-label="Close"
            >
              <X size={16} strokeWidth={ICON_STROKE_WIDTH} />
            </Button>
            <div className={styles.welcomeSection}>
              <Monogram className={styles.welcomeMonogram} />
              <Text as="h2" size="lg" font="sans" className={styles.welcomeTitle}>
                Welcome visitor
              </Text>
              <Text as="p" size="sm" className={styles.welcomeText}>
                You are about to enter an immersive virtual exhibition. Use the controls below to
                explore the space freely.
              </Text>
            </div>
            <Text as="h3" size="md" font="sans" className={styles.infoPanelTitle}>
              Controls
            </Text>
            <div className={styles.infoPanelContent}>
              <div className={styles.infoItem}>
                <div className={styles.infoKeysColumn}>
                  <div className={styles.infoKeys}>
                    <Text as="span" size="sm" className={styles.infoKey}>
                      W
                    </Text>
                    <Text as="span" size="sm" className={styles.infoKey}>
                      A
                    </Text>
                    <Text as="span" size="sm" className={styles.infoKey}>
                      S
                    </Text>
                    <Text as="span" size="sm" className={styles.infoKey}>
                      D
                    </Text>
                  </div>
                  <div className={styles.infoKeys}>
                    <span className={styles.infoKey}>
                      <ArrowUp size={14} strokeWidth={ICON_STROKE_WIDTH} />
                    </span>
                    <span className={styles.infoKey}>
                      <ArrowLeft size={14} strokeWidth={ICON_STROKE_WIDTH} />
                    </span>
                    <span className={styles.infoKey}>
                      <ArrowDown size={14} strokeWidth={ICON_STROKE_WIDTH} />
                    </span>
                    <span className={styles.infoKey}>
                      <ArrowRight size={14} strokeWidth={ICON_STROKE_WIDTH} />
                    </span>
                  </div>
                </div>
                <Text as="span" size="sm">
                  Walk inside the room
                </Text>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoKeyWide}>
                  <Mouse size={14} strokeWidth={ICON_STROKE_WIDTH} />
                  <Text as="span" size="sm">
                    Hold + Drag
                  </Text>
                </span>
                <Text as="span" size="sm">
                  Rotate the view
                </Text>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoKeyWide}>
                  <Touchpad size={14} strokeWidth={ICON_STROKE_WIDTH} />
                  <Text as="span" size="sm">
                    Swipe Left / Right
                  </Text>
                </span>
                <Text as="span" size="sm">
                  Rotate the view
                </Text>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoKeyWide}>
                  <Touchpad size={14} strokeWidth={ICON_STROKE_WIDTH} />
                  <Text as="span" size="sm">
                    Swipe Up / Down
                  </Text>
                </span>
                <Text as="span" size="sm">
                  Walk forward / backward
                </Text>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoKeyWide}>
                  <Mouse size={14} strokeWidth={ICON_STROKE_WIDTH} />
                  <Text as="span" size="sm">
                    Single Click
                  </Text>
                </span>
                <Text as="span" size="sm">
                  Auto focus on any artwork
                </Text>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoKeyWide}>
                  <Mouse size={14} strokeWidth={ICON_STROKE_WIDTH} />
                  <Text as="span" size="sm">
                    Double Click
                  </Text>
                </span>
                <Text as="span" size="sm">
                  Show artwork details
                </Text>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoKeyWide}>
                  <Volume2 size={14} strokeWidth={ICON_STROKE_WIDTH} />
                  <Text as="span" size="sm">
                    Double Click
                  </Text>
                </span>
                <Text as="span" size="sm">
                  Play sound
                </Text>
              </div>
            </div>
            <Text as="p" size="xs" className={styles.infoHint}>
              You can reopen this guide anytime by clicking the{' '}
              <Info size={12} strokeWidth={ICON_STROKE_WIDTH} style={{ verticalAlign: 'middle' }} />{' '}
              icon in the bottom-right corner.
            </Text>
            {!helpDismissed && (
              <Button
                variant="primary"
                size="regularSquared"
                label="Don't show this again"
                className={styles.dismissButton}
                onClick={() => {
                  try {
                    localStorage.setItem(NAVIGATION_HELP_STORAGE_KEY, 'true')
                  } catch {
                    // localStorage not available, ignore
                  }
                  setHelpDismissed(true)
                  handleCloseHelp()
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Media Notice Modal */}
      {currentStep === 'media' && (
        <div className={styles.infoOverlay} onClick={handleCloseMedia}>
          <div className={styles.infoPanel} onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              onClick={handleCloseMedia}
              className={styles.infoPanelClose}
              aria-label="Close"
            >
              <X size={16} strokeWidth={ICON_STROKE_WIDTH} />
            </Button>
            <div className={styles.welcomeSection}>
              <Volume2
                size={32}
                strokeWidth={ICON_STROKE_WIDTH}
                style={{ margin: '0 auto var(--space-4)', display: 'block' }}
              />
              <Text as="h2" size="lg" font="sans" className={styles.welcomeTitle}>
                Sound & Video
              </Text>
              <Text as="p" size="sm" className={styles.welcomeText}>
                This exhibition contains artworks with audio and video. Make sure your volume is
                turned on for the full experience. You can mute all sounds at any time using the
                volume icon in the bottom-right corner.
              </Text>
            </div>
            <div className={styles.infoPanelContent}>
              <div className={styles.infoItem}>
                <span className={styles.infoKeyWide}>
                  <Volume2 size={14} strokeWidth={ICON_STROKE_WIDTH} />
                  <Text as="span" size="sm">
                    Click
                  </Text>
                </span>
                <Text as="span" size="sm">
                  Mute
                </Text>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoKeyWide}>
                  <VolumeX size={14} strokeWidth={ICON_STROKE_WIDTH} />
                  <Text as="span" size="sm">
                    Click
                  </Text>
                </span>
                <Text as="span" size="sm">
                  Unmute
                </Text>
              </div>
            </div>
            {!mediaDismissed && (
              <Button
                variant="primary"
                size="regularSquared"
                label="Don't show this again"
                className={styles.dismissButton}
                onClick={() => {
                  try {
                    if (exhibitionId) {
                      localStorage.setItem(`${MEDIA_NOTICE_STORAGE_PREFIX}${exhibitionId}`, 'true')
                    }
                  } catch {
                    // localStorage not available, ignore
                  }
                  setMediaDismissed(true)
                  handleCloseMedia()
                }}
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}

export const ExhibitionViewPage = ({ artistSlug, exhibitionSlug }: ExhibitionViewPageProps) => {
  const dispatch = useDispatch<AppDispatch>()
  const hasResetRef = useRef(false)
  const searchParams = useSearchParams()
  const previewToken = searchParams.get('preview') || undefined
  const isArtworkPanelOpen = useSelector((state: RootState) => state.dashboard.isArtworkPanelOpen)
  const isArtworkModalOpen = useSelector((state: RootState) => state.dashboard.isArtworkModalOpen)
  const isMobile = useIsMobile()

  const {
    data: exhibition,
    isLoading: isApiLoading,
    error,
  } = useGetExhibitionByUrlQuery(
    { url: exhibitionSlug, ...(previewToken && { preview: previewToken }) },
    {
      skip: !exhibitionSlug,
    },
  )

  useEffect(() => {
    if (!hasResetRef.current) {
      dispatch(resetWallView())
      dispatch(resetScene())
      // Close any stale artwork modal: isArtworkModalOpen lives in dashboardSlice and is
      // only cleared by the modal's own Close. Leaving via Order Print (router.push) leaves
      // it true, and Redux survives client navigation — so without this, the first
      // double-click after re-entering would render the modal instead of the sidebar.
      dispatch(closeArtworkModal())
      // Note: Do NOT call resetArtworks() here - artworks should persist across
      // same-exhibition navigation (e.g., when viewing artwork details and returning).
      // The useLoadExhibitionArtworks hook handles loading artworks when needed.
      dispatch(hidePlaceholders())
      hasResetRef.current = true
    }
  }, [dispatch])

  useEffect(() => {
    if (exhibition) {
      // Warm the texture cache for this exhibition's floor only — from an
      // effect (not render) so the loading manager's onStart doesn't fire
      // mid-render. Runs before the Scene mounts (it's gated on Redux
      // spaceId, set by the dispatch below), so ReflectiveFloor suspends on
      // this cached promise instead of starting its own load.
      preloadFloorMaterial(exhibition.floorMaterial)
      const exhibitionData: TExhibition = {
        id: exhibition.id,
        userId: exhibition.userId,
        name: exhibition.mainTitle,
        mainTitle: exhibition.mainTitle,
        url: exhibition.url,
        thumbnailUrl: exhibition.thumbnailUrl || '',
        spaceId: exhibition.spaceId,
        bannerUrl: exhibition.bannerUrl || '',
        startDate: exhibition.startDate || '',
        endDate: exhibition.endDate || '',
        exhibitionArtworksById: exhibition.exhibitionArtworksById || {},
        allExhibitionArtworkIds: exhibition.allExhibitionArtworkIds || [],
        status: exhibition.status,
        published: exhibition.published ?? false,
        hasPendingChanges: exhibition.hasPendingChanges ?? false,
        previewEnabled: exhibition.previewEnabled ?? false,
        ambientLightColor: exhibition.ambientLightColor ?? undefined,
        ambientLightIntensity: exhibition.ambientLightIntensity ?? undefined,
        skylightColor: exhibition.skylightColor ?? undefined,
        skylightIntensity: exhibition.skylightIntensity ?? undefined,
        ceilingLampColor: exhibition.ceilingLampColor ?? undefined,
        ceilingLampIntensity: exhibition.ceilingLampIntensity ?? undefined,
        trackLampColor: exhibition.trackLampColor ?? undefined,
        trackLampIntensity: exhibition.trackLampIntensity ?? undefined,
        trackLampsVisible: exhibition.trackLampsVisible ?? undefined,
        trackLampAngle: exhibition.trackLampAngle ?? undefined,
        trackLampDistance: exhibition.trackLampDistance ?? undefined,
        trackLampSettings: exhibition.trackLampSettings ?? undefined,
        ceilingLightMode: exhibition.ceilingLightMode ?? undefined,
        recessedLampColor: exhibition.recessedLampColor ?? undefined,
        recessedLampIntensity: exhibition.recessedLampIntensity ?? undefined,
        recessedLampAngle: exhibition.recessedLampAngle ?? undefined,
        recessedLampDistance: exhibition.recessedLampDistance ?? undefined,
        trackLampMaterialColor: exhibition.trackLampMaterialColor ?? undefined,
        windowLightColor: exhibition.windowLightColor ?? undefined,
        windowLightIntensity: exhibition.windowLightIntensity ?? undefined,
        windowTransparency: exhibition.windowTransparency ?? undefined,
        hdriRotation: exhibition.hdriRotation ?? undefined,
        // Floor customization
        floorReflectiveness: exhibition.floorReflectiveness ?? undefined,
        floorMaterial: exhibition.floorMaterial ?? undefined,
        floorTextureScale: exhibition.floorTextureScale ?? undefined,
        floorTextureOffsetX: exhibition.floorTextureOffsetX ?? undefined,
        floorTextureOffsetY: exhibition.floorTextureOffsetY ?? undefined,
        floorTemperature: exhibition.floorTemperature ?? undefined,
        floorNormalScale: exhibition.floorNormalScale ?? undefined,
        floorRotation: exhibition.floorRotation ?? undefined,
        // HDRI
        hdriEnvironment: exhibition.hdriEnvironment ?? undefined,
        // Camera settings
        cameraFOV: exhibition.cameraFOV ?? undefined,
        cameraElevation: exhibition.cameraElevation ?? undefined,
        // Wall & Ceiling
        wallColor: exhibition.wallColor ?? undefined,
        ceilingColor: exhibition.ceilingColor ?? undefined,
        // Autofocus groups
        autofocusGroups: exhibition.autofocusGroups ?? undefined,
      }
      dispatch(setExhibition(exhibitionData))
    }
  }, [exhibition, dispatch])

  // by-url already delivers the (snapshot + live-enriched) exhibition
  // artworks — pass them through so the hook skips its own fetch.
  const { loadedExhibitionId } = useLoadExhibitionArtworks(
    exhibition?.id,
    undefined,
    exhibition?.exhibitionArtworks,
  )
  // Artworks are "ready" for the modal only when Redux holds the
  // current exhibition's data. Avoids the A→B navigation race where the
  // media warning would fire based on the previous exhibition's
  // artworks before the new ones land.
  const artworksReady = !!exhibition?.id && loadedExhibitionId === exhibition.id

  if (error) {
    return <div className={styles.errorState}>Error loading exhibition</div>
  }

  if (!exhibition && !isApiLoading) {
    return <div className={styles.emptyState}>Exhibition not found</div>
  }

  if (isMobile) {
    return <MobileExhibitionView artistSlug={artistSlug} exhibitionSlug={exhibitionSlug} />
  }

  return (
    <>
      {!isArtworkPanelOpen && (
        <NavigationButton artistSlug={artistSlug} exhibitionSlug={exhibitionSlug} />
      )}
      <NavigationHelpModal
        hidden={isArtworkPanelOpen}
        exhibitionId={exhibition?.id}
        artworksReady={artworksReady}
      />
      <LoadingOverlay />
      {exhibition && <Scene hideLoader />}
      {isArtworkPanelOpen && <ArtworkPanel />}
      {isArtworkModalOpen && <ArtworkModal />}
    </>
  )
}
