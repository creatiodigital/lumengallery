import React, { useMemo, useCallback, useState } from 'react'
import { useDispatch } from 'react-redux'
import { MeshStandardMaterial, TextureLoader } from 'three'

import { hideArtworkPanel } from '@/lib/features/sceneSlice'
import { showWallView } from '@/lib/features/wallViewSlice'

const Handler = ({ i, nodes }) => {
  const dispatch = useDispatch()

  const [hovered, setHovered] = useState([])

  const editIcon = useMemo(() => {
    const icon = new TextureLoader().load('/assets/edit.png')
    icon.flipY = true
    icon.center.set(0.5, 0.5)
    icon.rotation = Math.PI
    icon.repeat.set(1.5, 1.5)
    return icon
  }, [])

  const handleOnHandlerClick = (mesh) => {
    dispatch(showWallView(mesh.uuid))
    dispatch(hideArtworkPanel())
  }

  const getEditIconMaterial = useMemo(
    () => (index) =>
      new MeshStandardMaterial({
        map: editIcon,
        color: '#a43f3f',
        transparent: true,
        opacity: hovered[index] ? 1 : 1,
      }),
    [editIcon, hovered],
  )

  const handlePointerOver = useCallback((index) => {
    setHovered((prev) => {
      const newHovered = [...prev]
      newHovered[index] = true
      return newHovered
    })
  }, [])

  const handlePointerOut = useCallback((index) => {
    setHovered((prev) => {
      const newHovered = [...prev]
      newHovered[index] = false
      return newHovered
    })
  }, [])

  return (
    <mesh
      name={`handler${i}`}
      castShadow
      receiveShadow
      geometry={nodes[`handler${i}`].geometry}
      material={getEditIconMaterial(i)}
      onClick={() => handleOnHandlerClick(nodes[`placeholder${i}`])}
      onPointerOver={() => handlePointerOver(i)}
      onPointerOut={() => handlePointerOut(i)}
    />
  )
}

export default Handler
