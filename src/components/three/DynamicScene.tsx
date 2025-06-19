"use client"

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import type { SceneConfig } from './types'

const Scene = dynamic(() => import('./CanvasRenderer').then(mod => mod.RenderScene), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <p>Loading 3D scene...</p>
    </div>
  )
})

export function DynamicScene({
  sceneConfig,
  onCapture,
}: {
  sceneConfig: SceneConfig
  onCapture: (blob: Blob) => void
}) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Scene sceneConfig={sceneConfig} onCapture={onCapture} />
    </Suspense>
  )
} 