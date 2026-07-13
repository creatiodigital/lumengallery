import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'

import {
  type ExhibitionArtworkResponse,
  mapToArtwork,
  mapToArtworkPosition,
} from '@/lib/exhibitionArtworkMapper'
import { resetArtworks, restoreArtwork } from '@/redux/slices/artworkSlice'
import { createArtworkPosition } from '@/redux/slices/exhibitionSlice'

/**
 * Preload images and track progress
 */
const preloadImages = (
  imageUrls: string[],
  onProgress: (loaded: number, total: number) => void,
): Promise<void> => {
  return new Promise((resolve) => {
    if (imageUrls.length === 0) {
      onProgress(0, 0)
      resolve()
      return
    }

    let loaded = 0
    const total = imageUrls.length

    imageUrls.forEach((url) => {
      const img = new Image()
      // crossOrigin matches THREE's texture request (TextureLoader defaults to
      // "anonymous") so both share one browser-cache entry. Without it the
      // no-cors preload and the CORS texture fetch are keyed separately and
      // every artwork downloads twice at full size.
      img.crossOrigin = 'anonymous'
      img.onload = img.onerror = () => {
        loaded++
        onProgress(loaded, total)
        if (loaded === total) {
          resolve()
        }
      }
      img.src = url
    })
  })
}

export const useLoadExhibitionArtworks = (
  exhibitionId: string | undefined,
  mode?: 'edit',
  /** Exhibition artworks already delivered by /api/exhibitions/by-url. When
   *  provided (visit page), they're dispatched directly instead of re-fetching
   *  the same data from /api/exhibition-artworks — one round trip per visit.
   *  Edit mode omits this: it needs live positions, not the snapshot. */
  preloaded?: ExhibitionArtworkResponse[],
) => {
  const dispatch = useDispatch()
  const [loading, setLoading] = useState(false)
  const [imagesLoading, setImagesLoading] = useState(false)
  const [imageProgress, setImageProgress] = useState({ loaded: 0, total: 0 })

  // Which exhibition's artworks are currently in `state.byId`. Tracked as
  // state (not a ref) so consumers can react when it flips — e.g. the
  // NavigationHelpModal needs to wait until this matches the visiting
  // exhibition before deciding whether to auto-show the media warning,
  // otherwise it reads the previous exhibition's artworks from the
  // Redux store and warns about media that isn't here.
  const [loadedExhibitionId, setLoadedExhibitionId] = useState<string | null>(null)

  useEffect(() => {
    // Skip if no exhibition ID
    if (!exhibitionId) return

    // Skip if we already loaded this exact exhibition
    if (loadedExhibitionId === exhibitionId) return

    const loadArtworks = async () => {
      setLoading(true)
      setImagesLoading(true)
      // Clear artworks from any previous exhibition before loading the new
      // ones. Without this, navigating exhibition A → exhibition B leaves
      // A's artworks in `state.byId` and the scene renders both sets
      // mixed in the same room. Same-exhibition reload is short-circuited
      // by the `loadedExhibitionId === exhibitionId` check above, so this
      // only fires on a genuine exhibition switch.
      dispatch(resetArtworks())
      try {
        let exhibitionArtworks: ExhibitionArtworkResponse[]
        if (preloaded) {
          exhibitionArtworks = preloaded
        } else {
          const modeParam = mode ? `&mode=${mode}` : ''
          const response = await fetch(
            `/api/exhibition-artworks?exhibitionId=${exhibitionId}${modeParam}`,
          )
          if (!response.ok) {
            console.error('Failed to load exhibition artworks')
            return
          }
          exhibitionArtworks = await response.json()
        }

        // Collect image URLs for preloading
        const imageUrls: string[] = []

        // Restore each artwork with full metadata from database
        exhibitionArtworks.forEach((ea) => {
          dispatch(restoreArtwork(mapToArtwork(ea)))

          // Collect image URL for preloading
          if (ea.artwork.imageUrl) {
            imageUrls.push(ea.artwork.imageUrl)
          }

          // Create position in exhibition slice
          dispatch(
            createArtworkPosition({
              artworkId: ea.artworkId,
              artworkPosition: mapToArtworkPosition(ea),
            }),
          )
        })

        // Redux now reflects this exhibition. Mark the load complete
        // *before* image preloading so downstream consumers (modal
        // gating, "has media artworks?" checks) can run as soon as the
        // data is in place, without waiting on every image download.
        setLoading(false)
        setLoadedExhibitionId(exhibitionId)

        // Preload all images
        await preloadImages(imageUrls, (loaded, total) => {
          setImageProgress({ loaded, total })
        })
      } catch (error) {
        console.error('Error loading exhibition artworks:', error)
      } finally {
        setLoading(false)
        setImagesLoading(false)
      }
    }

    loadArtworks()
  }, [exhibitionId, dispatch, mode, loadedExhibitionId, preloaded])

  return {
    loading,
    imagesLoading,
    imageProgress,
    // Combined ready state - false until both data and images are loaded
    isReady: !loading && !imagesLoading,
    /** ID of the exhibition whose artworks currently populate Redux.
     *  Compare with the exhibition you're viewing to know whether the
     *  store is stale (mid-switch) vs. correctly populated. */
    loadedExhibitionId,
  }
}
