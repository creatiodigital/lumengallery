import React, { useMemo, useCallback, useState, Fragment } from 'react'
import { useSelector } from 'react-redux'

import { useGLTF } from '@react-three/drei'

import {
  MeshStandardMaterial,
  DoubleSide,
  TextureLoader,
  LineDashedMaterial,
  EdgesGeometry,
  Vector3,
  Quaternion,
  SRGBColorSpace,
} from 'three'

const OneSpace = ({ wallRefs, onPlaceholderClick, isSpace, ...props }) => {
  const { nodes, materials } = useGLTF('/assets/one-space3.glb')
  const artworks = useSelector((state) => state.artist.artworks)

  const [hovered, setHovered] = useState([])

  const editIcon = useMemo(() => {
    const icon = new TextureLoader().load('/assets/edit.png')
    icon.flipY = true
    icon.center.set(0.5, 0.5)
    icon.rotation = Math.PI
    icon.repeat.set(1.5, 1.5)
    return icon
  }, [])

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

  useMemo(() => {
    if (materials.floorMaterial?.map) {
      materials.floorMaterial.map.colorSpace = SRGBColorSpace
    }
    if (materials.ceilingMaterial?.map) {
      materials.ceilingMaterial.map.colorSpace = SRGBColorSpace
    }
    if (materials.wallMaterial?.map) {
      materials.wallMaterial.map.colorSpace = SRGBColorSpace
    }
  }, [materials])

  const wallsArray = Array.from({ length: 1 })
  const placeholdersArray = Array.from({ length: 6 }) || []
  const handlersArray = Array.from({ length: 6 }) || []
  const rectLightsArray = Array.from({ length: 5 })
  const lampsArray = Array.from({ length: 27 })

  const lampMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.8,
      }),
    [],
  )

  const rectLightMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#ffffff',
        emissiveIntensity: 10,
      }),
    [],
  )

  const bulbMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#ffffff',
        emissiveIntensity: 10,
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

  // Precompute artwork data
  const precomputedArtworks = useMemo(
    () =>
      artworks?.map((artwork) => {
        if (!artwork.url) return null

        const position = new Vector3(
          artwork.space.position.x,
          artwork.space.position.y,
          artwork.space.position.z,
        )

        const quaternion = new Quaternion(
          artwork.space.quaternion.x,
          artwork.space.quaternion.y,
          artwork.space.quaternion.z,
          artwork.space.quaternion.w,
        )

        const texture = (() => {
          if (!artwork.url) return null
          const loader = new TextureLoader()
          const loadedTexture = loader.load(artwork.url)
          loadedTexture.colorSpace = SRGBColorSpace
          return loadedTexture
        })()

        return { ...artwork, position, quaternion, texture }
      }),
    [artworks],
  )

  return (
    <group {...props} dispose={null}>
      <mesh
        name="floor"
        castShadow
        receiveShadow
        geometry={nodes.floor.geometry}
        material={materials.floorMaterial}
      />
      <mesh
        name="ceiling"
        castShadow
        receiveShadow
        geometry={nodes.ceiling.geometry}
        material={materials.ceilingMaterial}
      />
      {wallsArray?.map((_, i) => (
        <mesh
          key={i}
          name={`wall1`}
          ref={wallRefs[i]}
          castShadow
          receiveShadow
          geometry={nodes[`wall${i}`].geometry}
          material={materials[`wallMaterial`]}
        />
      ))}
      {!isSpace &&
        placeholdersArray.map((_, i) => (
          <Fragment key={i}>
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
          </Fragment>
        ))}
      {!isSpace &&
        handlersArray.map((_, i) => (
          <mesh
            key={i}
            name={`handler${i}`}
            castShadow
            receiveShadow
            geometry={nodes[`handler${i}`].geometry}
            material={getEditIconMaterial(i)}
            onClick={() => onPlaceholderClick(nodes[`placeholder${i}`])}
            onPointerOver={() => handlePointerOver(i)}
            onPointerOut={() => handlePointerOut(i)}
          />
        ))}
      {rectLightsArray.map((_, i) => (
        <mesh
          key={i}
          name={`rectLight${i}`}
          castShadow
          receiveShadow
          geometry={nodes[`rectLight${i}`].geometry}
          material={rectLightMaterial}
        />
      ))}
      {lampsArray.map((_, i) => (
        <Fragment key={i}>
          <mesh
            name={`base${i}`}
            castShadow
            receiveShadow
            geometry={nodes[`base${i}`].geometry}
            material={lampMaterial}
          />
          <mesh
            name={`stick${i}`}
            castShadow
            receiveShadow
            geometry={nodes[`stick${i}`].geometry}
            material={lampMaterial}
          />
          <mesh
            name={`bulb${i}`}
            castShadow
            receiveShadow
            geometry={nodes[`bulb${i}`].geometry}
            material={bulbMaterial}
          />
        </Fragment>
      ))}
      {precomputedArtworks?.map(
        (artwork) =>
          artwork && (
            <mesh
              key={artwork.id}
              position={artwork.position}
              quaternion={artwork.quaternion}
              renderOrder={2}
            >
              <planeGeometry
                args={[artwork.space.width || 1, artwork.space.height || 1]}
              />
              <meshBasicMaterial
                side={DoubleSide}
                toneMapped={false}
                map={artwork.texture || null}
                roughness={1}
                metalness={0}
              />
            </mesh>
          ),
      )}
    </group>
  )
}

useGLTF.preload('/assets/one-space3.glb')

export default OneSpace
