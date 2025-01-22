import { MeshStandardMaterial } from 'three'

export const windowMaterial = new MeshStandardMaterial({
  color: '#000000',
  roughness: 0.4,
  metalness: 1,
  envMapIntensity: 1,
})

export const lineMaterial = new MeshStandardMaterial({
  color: '#ffffff',
})

export const reelMaterial = new MeshStandardMaterial({
  color: '#ffffff',
  roughness: 0.8,
  metalness: 0.2,
})

export const lampMaterial = new MeshStandardMaterial({
  color: '#ffffff',
  roughness: 0.4,
  metalness: 0.1,
  envMapIntensity: 1,
})

export const bulbMaterial = new MeshStandardMaterial({
  color: '#ffffff',
  emissive: '#ffffff',
  emissiveIntensity: 10,
})
