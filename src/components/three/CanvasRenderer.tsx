"use client"

import { Canvas } from '@react-three/fiber'
import { Suspense, useRef, useMemo, useState, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { 
  OrbitControls, 
  Environment, 
  Text, 
  Center,
  Stars,
  Html
} from '@react-three/drei'
import { 
  EffectComposer,
  Bloom,
  ChromaticAberration,
  DepthOfField
} from '@react-three/postprocessing'
import { Physics, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { useScene, useSceneInteraction } from './context/SceneContext'

// Screenshot hook
function Screenshot({ onCapture }: { onCapture: (blob: Blob) => void }) {
  const { gl, scene, camera } = useThree()
  const captured = useRef(false)

  useFrame(() => {
    if (!captured.current) {
      gl.render(scene, camera)
      gl.domElement.toBlob((blob: Blob | null) => {
        if (blob) {
          onCapture(blob)
          captured.current = true
        }
      })
    }
  }, 1)

  return null
}

type Vector3 = [number, number, number]
type AnimationType = 'rotate' | 'bounce' | 'wave' | 'none' | 'physics'

interface ObjectConfig {
  type: 'box' | 'sphere' | 'torus' | 'cylinder' | 'cone' | 'text' | 'cloud'
  position: Vector3
  rotation?: Vector3
  scale?: number | Vector3
  color: string
  metalness?: number
  roughness?: number
  animation?: AnimationType
  animationSpeed?: number
  emissive?: string
  emissiveIntensity?: number
  text?: string
  interactive?: boolean
  mass?: number
}

interface LightConfig {
  type: 'point' | 'spot' | 'directional'
  position: Vector3
  color?: string
  intensity?: number
  castShadow?: boolean
}

interface SceneConfig {
  objects: ObjectConfig[]
  lights?: LightConfig[]
  environment?: 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'apartment' | 'studio' | 'city' | 'park' | 'lobby'
  background?: string | null
  effects?: {
    bloom?: boolean
    chromaticAberration?: boolean
    depthOfField?: boolean
    stars?: boolean
  }
}

const Geometry = ({ type, text, ...props }: { type: ObjectConfig['type'], text?: string }) => {
  switch (type) {
    case 'sphere':
      return <sphereGeometry args={[1, 32, 32]} {...props} />
    case 'torus':
      return <torusGeometry args={[1, 0.4, 16, 32]} {...props} />
    case 'cylinder':
      return <cylinderGeometry args={[1, 1, 2, 32]} {...props} />
    case 'cone':
      return <coneGeometry args={[1, 2, 32]} {...props} />
    case 'text':
      return (
        <Center>
          <Text 
            fontSize={1}
            maxWidth={200}
            lineHeight={1}
            letterSpacing={0.02}
            textAlign="center"
          >
            {text || 'Hello'}
          </Text>
        </Center>
      )
    case 'cloud':
      return null
    default:
      return <boxGeometry args={[1, 1, 1]} {...props} />
  }
}

const Light = ({ config }: { config: LightConfig }) => {
  const { type, position, color = 'white', intensity = 1, castShadow = false } = config
  const props = { position, color, intensity, castShadow }

  switch (type) {
    case 'spot':
      return <spotLight {...props} />
    case 'directional':
      return <directionalLight {...props} />
    default:
      return <pointLight {...props} />
  }
}

const InteractiveObject = ({ config, onClick }: { config: ObjectConfig, onClick?: () => void }) => {
  const [hovered, setHovered] = useState(false)
  const meshRef = useRef<THREE.Mesh>(null)
  const startY = config.position[1]
  const time = useRef(0)

  const handlePointerOver = useCallback(() => setHovered(true), [])
  const handlePointerOut = useCallback(() => setHovered(false), [])

  useFrame((state, delta) => {
    if (!meshRef.current || config.animation === 'physics') return

    time.current += delta

    switch (config.animation) {
      case 'rotate':
        meshRef.current.rotation.x += delta * (config.animationSpeed || 1)
        meshRef.current.rotation.y += delta * (config.animationSpeed || 1) * 0.5
        break
      case 'bounce':
        meshRef.current.position.y = startY + Math.sin(time.current * 2) * 0.5 * (config.animationSpeed || 1)
        break
      case 'wave':
        meshRef.current.position.y = startY + Math.sin(time.current * 2 + meshRef.current.position.x) * 0.2 * (config.animationSpeed || 1)
        break
    }
  })

  const scale = typeof config.scale === 'number' 
    ? [config.scale, config.scale, config.scale] as Vector3
    : config.scale || [1, 1, 1] as Vector3

  const material = useMemo(() => (
    <meshStandardMaterial
      color={hovered ? '#fff' : config.color}
      metalness={config.metalness || 0}
      roughness={config.roughness || 1}
      emissive={config.emissive || '#000000'}
      emissiveIntensity={config.emissiveIntensity || 0}
    />
  ), [hovered, config.color, config.metalness, config.roughness, config.emissive, config.emissiveIntensity])

  if (config.animation === 'physics') {
    return (
      <RigidBody colliders="ball" mass={config.mass || 1}>
        <mesh
          ref={meshRef}
          position={config.position}
          rotation={config.rotation}
          scale={scale}
          onClick={onClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <Geometry type={config.type} text={config.text} />
          {material}
        </mesh>
      </RigidBody>
    )
  }

  return (
    <mesh
      ref={meshRef}
      position={config.position}
      rotation={config.rotation}
      scale={scale}
      onClick={onClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <Geometry type={config.type} text={config.text} />
      {material}
    </mesh>
  )
}

const ScoreDisplay = () => {
  const { state } = useScene();
  return (
    <Html position={[0, 2, 0]} center>
      <div style={{ 
        background: 'rgba(0,0,0,0.8)', 
        padding: '10px 20px', 
        borderRadius: '20px',
        color: 'white',
        fontFamily: 'monospace',
        fontSize: '24px'
      }}>
        Score: {state.score}
      </div>
    </Html>
  )
}

export function RenderScene({
  sceneConfig,
  onCapture,
}: {
  sceneConfig: SceneConfig
  onCapture: (blob: Blob) => void
}) {
  const { handleInteraction } = useSceneInteraction();
  const background = useMemo(() => {
    if (!sceneConfig.background) return null
    if (sceneConfig.background.startsWith('#')) {
      return new THREE.Color(sceneConfig.background)
    }
    return sceneConfig.background
  }, [sceneConfig.background])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        shadows
        style={{ width: '100%', height: '100%' }}
        camera={{ position: [0, 2, 5], fov: 75 }}
      >
        <color attach="background" args={[background || '#000000']} />
        
        <Physics 
          gravity={[0, -9.81, 0]}
          colliders="hull"
          interpolate={true}
        >
          <Suspense fallback={null}>
            {sceneConfig.environment && (
              <Environment preset={sceneConfig.environment} />
            )}
            
            {sceneConfig.effects?.stars && (
              <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
            )}

            {(!sceneConfig.lights || sceneConfig.lights.length === 0) && (
              <ambientLight intensity={0.5} />
            )}

            {sceneConfig.lights?.map((light, index) => (
              <Light key={index} config={light} />
            ))}

            <RigidBody type="fixed" colliders="cuboid">
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
                <planeGeometry args={[50, 50]} />
                <meshStandardMaterial color="#1a1a1a" />
              </mesh>
            </RigidBody>

            {sceneConfig.objects.map((obj, index) => (
              <InteractiveObject 
                key={index} 
                config={obj}
                onClick={() => obj.interactive && handleInteraction(obj.type + '_' + index)}
              />
            ))}

            <Screenshot onCapture={onCapture} />
            <ScoreDisplay />
          </Suspense>

          {sceneConfig.effects?.bloom && (
            <EffectComposer>
              <Bloom luminanceThreshold={0.5} intensity={1.5} />
            </EffectComposer>
          )}
          {sceneConfig.effects?.chromaticAberration && (
            <EffectComposer>
              <ChromaticAberration offset={[0.002, 0.002]} />
            </EffectComposer>
          )}
          {sceneConfig.effects?.depthOfField && (
            <EffectComposer>
              <DepthOfField
                focusDistance={0}
                focalLength={0.02}
                bokehScale={2}
              />
            </EffectComposer>
          )}
        </Physics>

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  )
} 