'use client'

import * as THREE from 'three'
import React, { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useSelector } from 'react-redux'
import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'

import SceneContext from '@/contexts/SceneContext'
import { Controls } from '@/components/scene/controls'
import { Elements } from '@/components/scene/elements/Elements'

const Scene = () => {
  const [space, setSpace] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const wallRefs = useRef([])
  const { handler, space: spaceId } = useParams()
  const artworks = useSelector((state) => state.artist.arworks)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const url = `/api/spaces?handler=${handler}&space=${spaceId}`
        const response = await fetch(url)
        const data = await response.json()

        if (data?.space) {
          setSpace(data.space)
        } else {
          setError('Artist or space not found')
          setSpace(null)
        }
      } catch (error) {
        setError('There was a problem')
        setSpace(null)
      }

      setLoading(false)
    }

    fetchData()
  }, [handler, spaceId])

  if (loading) return <div>Loading...</div>
  // if (error) return <div>Error: {error}</div>
  // if (!space) return <div>No data found</div>

  return (
    <SceneContext.Provider value={{ wallRefs }}>
      <div>
        <Canvas
          gl={{
            toneMapping: ACESFilmicToneMapping,
            toneMappingExposure: 1,
            outputColorSpace: SRGBColorSpace,
            antialias: true,
          }}
        >
          <group>
            <Controls />
            <Elements artworks={artworks} isSpace />
          </group>
        </Canvas>
      </div>
    </SceneContext.Provider>
  )
}

export default Scene
