import { MeshStandardMaterial, DoubleSide } from 'three'

export const windowMaterial = new MeshStandardMaterial({
  color: '#000000',
  roughness: 0.4,
  metalness: 1,
  envMapIntensity: 1,
})

export const glassMaterial = new MeshStandardMaterial({
  color: '#ffffff',
  transparent: true,
  opacity: 0,
  depthWrite: false,
  // emissive: '#ffffff',
  // emissiveIntensity: 1,
})

export const lineMaterial = new MeshStandardMaterial({
  color: '#ffffff',
})

export const reelMaterial = new MeshStandardMaterial({
  color: '#ffffff',
  roughness: 0.4,
  metalness: 0.1,
})

export const topMaterial = new MeshStandardMaterial({
  color: '#ffffff',
  emissive: '#ffffff',
  emissiveIntensity: 30,
  side: DoubleSide,
})

export const rectLampMaterial = new MeshStandardMaterial({
  color: '#ffffff',
  emissive: '#ffffff',
  emissiveIntensity: 100,
  side: DoubleSide,
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
  emissiveIntensity: 30,
})
