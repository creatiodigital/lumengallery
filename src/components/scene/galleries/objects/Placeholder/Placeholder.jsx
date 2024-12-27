import React, { useMemo } from 'react'
import { useDispatch } from 'react-redux'
import { MeshStandardMaterial, EdgesGeometry, LineDashedMaterial } from 'three'

import { hideArtworkPanel } from '@/lib/features/dashboardSlice'
import { showWallView } from '@/lib/features/wallViewSlice'

const Placeholder = ({ i, nodes }) => {
  const dispatch = useDispatch()
  const dashedLineMaterial = useMemo(
    () =>
      new LineDashedMaterial({
        color: '#555555',
        dashSize: 0.2,
        gapSize: 0.1,
        linewidth: 2,
      }),
    [],
  )

  const getPlaceholderMaterial = useMemo(
    () => () =>
      new MeshStandardMaterial({
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      }),
    [],
  )

  const handleOnPlaceholderClick = (mesh) => {
    dispatch(showWallView(mesh.uuid))
    dispatch(hideArtworkPanel())
  }

  return (
    <>
      <mesh
        name={`placeholder${i}`}
        castShadow
        receiveShadow
        onDoubleClick={() => handleOnPlaceholderClick(nodes[`placeholder${i}`])}
        geometry={nodes[`placeholder${i}`].geometry}
        material={getPlaceholderMaterial(i)}
      />
      <lineSegments
        geometry={new EdgesGeometry(nodes[`placeholder${i}`].geometry)}
        material={dashedLineMaterial}
        onUpdate={(self) => self.computeLineDistances()}
      />
    </>
  )
}

export default Placeholder
