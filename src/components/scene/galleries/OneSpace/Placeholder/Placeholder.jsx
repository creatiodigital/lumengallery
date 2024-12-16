import React, { useMemo } from 'react'
import { MeshStandardMaterial, EdgesGeometry, LineDashedMaterial } from 'three'

const Placeholder = ({ i, nodes }) => {
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
      }),
    [],
  )

  return (
    <>
      <mesh
        name={`placeholder${i}`}
        castShadow
        receiveShadow
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
