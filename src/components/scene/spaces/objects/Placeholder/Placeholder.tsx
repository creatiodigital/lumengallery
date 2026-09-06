import { useMemo, useRef, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import {
  MeshBasicMaterial,
  EdgesGeometry,
  LineDashedMaterial,
  Mesh,
  BufferGeometry,
  LineSegments,
} from 'three'

import { snapshotArtworks } from '@/redux/slices/artworkSlice'
import {
  hideArtworkPanel,
  hideFloorPanel,
  hideLightingPanel,
  hideCameraPanel,
} from '@/redux/slices/dashboardSlice'
import { snapshotExhibition } from '@/redux/slices/exhibitionSlice'
import { showWallView } from '@/redux/slices/wallViewSlice'
import { useDisposable } from '@/components/scene/spaces/objects/useDisposable'

interface PlaceholderProps {
  i: number
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
}

const Placeholder: React.FC<PlaceholderProps> = ({ i, nodes }) => {
  const dispatch = useDispatch()
  const lineRef = useRef<LineSegments>(null)

  const meshKey = `placeholder${i}`
  const node = nodes[meshKey]

  const dashedLineMaterial = useMemo(() => {
    return new LineDashedMaterial({
      color: '#555555',
      dashSize: 0.1,
      gapSize: 0.05,
      linewidth: 4,
    })
  }, [])

  const placeholderMaterial = useMemo(() => {
    return new MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
    })
  }, [])
  useDisposable(placeholderMaterial)

  // Memoize EdgesGeometry — previously recreated every render frame
  const edgesGeometry = useMemo(() => {
    if (!node) return null
    return new EdgesGeometry(node.geometry)
  }, [node])

  // Compute line distances once after mount
  useEffect(() => {
    if (lineRef.current) {
      lineRef.current.computeLineDistances()
    }
  }, [edgesGeometry])

  const handleOnPlaceholderClick = (mesh: Mesh) => {
    dispatch(snapshotExhibition())
    dispatch(snapshotArtworks())
    dispatch(showWallView(mesh.name))
    dispatch(hideArtworkPanel())
    dispatch(hideFloorPanel())
    dispatch(hideLightingPanel())
    dispatch(hideCameraPanel())
  }

  if (!node) return null

  return (
    <>
      <mesh
        name={meshKey}
        onDoubleClick={() => handleOnPlaceholderClick(nodes[meshKey])}
        geometry={node.geometry}
        material={placeholderMaterial}
        position={node.position}
        rotation={node.rotation}
        scale={node.scale}
      />
      <lineSegments
        ref={lineRef}
        geometry={edgesGeometry!}
        material={dashedLineMaterial}
        position={node.position}
        rotation={node.rotation}
        scale={node.scale}
      />
    </>
  )
}

export default Placeholder
