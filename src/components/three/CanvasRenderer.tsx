"use client"

import { Canvas } from '@react-three/fiber'
import { Suspense, useRef, useMemo, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { 
  OrbitControls, 
  Environment, 
  Text, 
  MeshTransmissionMaterial,
  shaderMaterial,
  useGLTF,
  Sky,
  ContactShadows,
  SoftShadows,
} from '@react-three/drei'
import { 
  EffectComposer,
  Bloom,
  ChromaticAberration,
  DepthOfField,
  Vignette,
  ToneMapping,
  Noise,
} from '@react-three/postprocessing'
import { Physics, RigidBody, CuboidCollider, BallCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { SceneConfig, ObjectConfig, MaterialConfig, NoiseConfig, WaveConfig, ParticleSystemConfig } from './types/scene'
import { extend } from '@react-three/fiber'
import { Vector3, Euler } from 'three'

// Enhanced holographic shader
const HolographicShader = shaderMaterial(
  {
    time: 0,
    color: new THREE.Color(0.0, 1.0, 1.0),
    opacity: 0.5,
    frequency: 10.0,
    amplitude: 0.1,
  },
  // Vertex shader
  `
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;
    uniform float time;
    uniform float frequency;
    uniform float amplitude;
    
    void main() {
      vUv = uv;
      vPosition = position;
      vNormal = normal;
      
      vec3 pos = position;
      float wave = sin(pos.x * frequency + time) * amplitude;
      wave += sin(pos.y * frequency * 0.8 + time * 1.2) * amplitude * 0.5;
      pos += normal * wave;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  // Fragment shader
  `
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;
    uniform vec3 color;
    uniform float time;
    uniform float opacity;

    void main() {
      vec3 viewDirection = normalize(cameraPosition - vPosition);
      float fresnel = pow(1.0 - dot(vNormal, viewDirection), 3.0);
      
      float pulse = sin(vPosition.y * 10.0 + time) * 0.5 + 0.5;
      float scanline = sin(vUv.y * 100.0 + time * 5.0) * 0.1 + 0.9;
      
      vec3 finalColor = mix(color, vec3(1.0), fresnel * 0.5);
      finalColor *= scanline;
      finalColor = mix(finalColor, color * 2.0, pulse * 0.3);
      
      float alpha = opacity * (0.7 + fresnel * 0.3 + pulse * 0.2);
      
      gl_FragColor = vec4(finalColor, alpha);
    }
  `
)

extend({ HolographicShader })

type HolographicShaderImpl = {
  time: number
  color: THREE.Color | string
  opacity: number
  frequency: number
  amplitude: number
  transparent?: boolean
}

declare module '@react-three/fiber' {
  interface ThreeElements {
    holographicShader: HolographicShaderImpl
  }
}

// Enhanced Material component with asset support
function Material({ config }: { config: MaterialConfig }) {
  const { type, color = '#ffffff', ...props } = config
  
  // Load textures if URLs are provided
  const [textures, setTextures] = useState<{ [key: string]: THREE.Texture }>({})
  
  useEffect(() => {
    const loadTextures = async () => {
      const loader = new THREE.TextureLoader()
      const texturePromises: { [key: string]: Promise<THREE.Texture> } = {}
      
      if (props.map) texturePromises.map = loader.loadAsync(props.map)
      if (props.normalMap) texturePromises.normalMap = loader.loadAsync(props.normalMap)
      if (props.roughnessMap) texturePromises.roughnessMap = loader.loadAsync(props.roughnessMap)
      if (props.metalnessMap) texturePromises.metalnessMap = loader.loadAsync(props.metalnessMap)
      if (props.emissiveMap) texturePromises.emissiveMap = loader.loadAsync(props.emissiveMap)
      if (props.alphaMap) texturePromises.alphaMap = loader.loadAsync(props.alphaMap)
      if (props.matcap) texturePromises.matcap = loader.loadAsync(props.matcap)
      
      try {
        const loadedTextures = await Promise.all(
          Object.entries(texturePromises).map(async ([key, promise]) => [key, await promise])
        )
        setTextures(Object.fromEntries(loadedTextures))
      } catch (error) {
        console.warn('Failed to load some textures:', error)
      }
    }
    
    const hasTextures = props.map || props.normalMap || props.roughnessMap || 
                       props.metalnessMap || props.emissiveMap || props.alphaMap || props.matcap
    
    if (hasTextures) {
      loadTextures()
    }
  }, [props.map, props.normalMap, props.roughnessMap, props.metalnessMap, props.emissiveMap, props.alphaMap, props.matcap])

  const materialProps = {
    color,
    metalness: props.metalness,
    roughness: props.roughness,
    emissive: props.emissive,
    emissiveIntensity: props.emissiveIntensity,
    transparent: props.opacity !== undefined || props.transparent,
    opacity: props.opacity,
    ...textures
  }

  switch (type) {
    case 'glass':
    case 'transmission':
      return (
        <MeshTransmissionMaterial
          {...materialProps}
          thickness={props.thickness || 0.5}
          roughness={props.roughness || 0}
          transmission={props.transmission || 0.9}
          ior={props.ior || 1.5}
          chromaticAberration={0.1}
          anisotropicBlur={0.1}
          samples={8}
          resolution={512}
        />
      )
    case 'holographic':
      return (
        <holographicShader
          color={color}
          opacity={props.opacity || 0.5}
          frequency={10.0}
          amplitude={0.1}
          transparent
          time={Date.now() * 0.001}
        />
      )
    case 'physical':
      return (
        <meshPhysicalMaterial
          {...materialProps}
          clearcoat={props.clearcoat}
          clearcoatRoughness={props.clearcoatRoughness || props.roughness}
          transmission={props.transmission}
          thickness={props.thickness}
          ior={props.ior || 1.5}
          reflectivity={props.reflectivity}
          sheen={props.sheen}
          sheenColor={props.sheenColor}
        />
      )
    case 'toon':
      return (
        <meshToonMaterial
          {...materialProps}
        />
      )
    case 'matcap':
      return (
        <meshMatcapMaterial
          {...materialProps}
          matcap={textures.matcap}
        />
      )
    case 'lambert':
      return (
        <meshLambertMaterial
          {...materialProps}
        />
      )
    case 'phong':
      return (
        <meshPhongMaterial
          {...materialProps}
          shininess={100}
        />
      )
    default:
      return (
        <meshStandardMaterial
          {...materialProps}
        />
      )
  }
}

// Enhanced noise displacement
function NoiseDisplacement({ config }: { config: NoiseConfig }) {
  const { type, scale = 1, speed = 0.2, amplitude = 0.1, octaves = 1, persistence = 0.5, lacunarity = 2.0 } = config
  const meshRef = useRef<THREE.Mesh>(null)
  const originalPositions = useRef<Float32Array | undefined>(undefined)

  useEffect(() => {
    if (meshRef.current && meshRef.current.geometry.attributes.position) {
      originalPositions.current = meshRef.current.geometry.attributes.position.array.slice() as Float32Array
    }
  }, [])

  useFrame((state) => {
    if (!meshRef.current || !originalPositions.current) return
    const time = state.clock.getElapsedTime()
    
    const position = meshRef.current.geometry.attributes.position
    const original = originalPositions.current
    
    for (let i = 0; i < position.count; i++) {
      const x = original[i * 3]
      const y = original[i * 3 + 1] 
      const z = original[i * 3 + 2]
      
      let noiseValue = 0
      let freq = scale
      let amp = amplitude
      
      // Multi-octave noise
      for (let oct = 0; oct < octaves; oct++) {
        switch (type) {
          case 'perlin':
            noiseValue += Math.sin(time * speed + x * freq) * Math.cos(time * speed + y * freq) * amp
            break
          case 'simplex':
            noiseValue += Math.sin(time * speed + y * freq) * Math.sin(time * speed + z * freq) * amp
            break
          case 'curl':
            noiseValue += Math.sin(time * speed + x * freq + y * freq) * amp
            break
          case 'worley':
            const dist = Math.sqrt((x * freq) ** 2 + (y * freq) ** 2 + (z * freq) ** 2)
            noiseValue += Math.sin(dist + time * speed) * amp
            break
        }
        freq *= lacunarity
        amp *= persistence
      }
      
      const normal = new THREE.Vector3(
        x / Math.sqrt(x*x + y*y + z*z),
        y / Math.sqrt(x*x + y*y + z*z), 
        z / Math.sqrt(x*x + y*y + z*z)
      )
      
      position.setXYZ(
        i,
        x + normal.x * noiseValue,
        y + normal.y * noiseValue,
        z + normal.z * noiseValue
      )
    }
    
    position.needsUpdate = true
  })

  return null
}

// Enhanced wave animation
function WaveAnimation({ config }: { config: WaveConfig }) {
  const { type, amplitude = 0.2, frequency = 1, speed = 0.5 } = config
  const meshRef = useRef<THREE.Mesh>(null)
  const originalPositions = useRef<Float32Array | undefined>(undefined)

  useEffect(() => {
    if (meshRef.current && meshRef.current.geometry.attributes.position) {
      originalPositions.current = meshRef.current.geometry.attributes.position.array.slice() as Float32Array
    }
  }, [])

  useFrame((state) => {
    if (!meshRef.current || !originalPositions.current) return
    const time = state.clock.getElapsedTime()
    const position = meshRef.current.geometry.attributes.position
    const original = originalPositions.current

    for (let i = 0; i < position.count; i++) {
      const x = original[i * 3]
      const y = original[i * 3 + 1]
      const z = original[i * 3 + 2]

      let displacement = 0

      switch (type) {
        case 'sine':
          displacement = Math.sin(time * speed + x * frequency) * amplitude
          position.setY(i, y + displacement)
          break
        case 'cosine':
          displacement = Math.cos(time * speed + x * frequency) * amplitude
          position.setY(i, y + displacement)
          break
        case 'ripple':
          const distance = Math.sqrt(x * x + z * z)
          displacement = Math.sin(time * speed + distance * frequency) * amplitude
          position.setY(i, y + displacement)
          break
        case 'circular':
          const radius = Math.sqrt(x * x + z * z)
          const angle = Math.atan2(z, x)
          const newRadius = radius + Math.sin(time * speed + angle * frequency) * amplitude
          position.setXYZ(
            i,
            newRadius * Math.cos(angle),
            y,
            newRadius * Math.sin(angle)
          )
          break
      }
    }

    position.needsUpdate = true
  })

  return null
}

// Model loader component
function ModelLoader({ url, config }: { url: string; config: ObjectConfig }) {
  const { scene } = useGLTF(url)
  const meshRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!meshRef.current || !config.followMouse) return
    
    const vector = new THREE.Vector3()
    vector.set(
      (state.mouse.x * 2) - 1,
      -(state.mouse.y * 2) + 1,
      0.5
    )
    vector.unproject(state.camera)
    const dir = vector.sub(state.camera.position).normalize()
    const distance = (config.followMouseDistance || 2) - state.camera.position.z
    const targetPos = state.camera.position.clone().add(dir.multiplyScalar(distance))

    meshRef.current.position.lerp(targetPos, config.followMouseSpeed || 0.1)
  })

  return (
    <group
      ref={meshRef}
      position={config.position}
      rotation={config.rotation ? new Euler().setFromVector3(new Vector3(...config.rotation)) : undefined}
      scale={config.scale || 1}
    >
      <primitive object={scene.clone()} />
    </group>
  )
}

// Enhanced Object3D component
function Object3D({ config }: { config: ObjectConfig }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const groupRef = useRef<THREE.Group>(null)
  const mousePos = useRef<THREE.Vector3>(new THREE.Vector3())

  useFrame((state, delta) => {
    const mesh = meshRef.current || groupRef.current
    if (!mesh) return

    // Basic rotation animation for boxes and spheres
    if (config.type === 'box' || config.type === 'sphere' || config.type === 'torus') {
      mesh.rotation.x += delta * 0.5
      mesh.rotation.y += delta * 0.7
    }

    if (!config.followMouse) return
    
    const vector = new THREE.Vector3()
    vector.set(
      (state.mouse.x * 2) - 1,
      -(state.mouse.y * 2) + 1,
      0.5
    )
    vector.unproject(state.camera)
    const dir = vector.sub(state.camera.position).normalize()
    const distance = (config.followMouseDistance || 2) - state.camera.position.z
    mousePos.current.copy(state.camera.position).add(dir.multiplyScalar(distance))

    mesh.position.lerp(mousePos.current, (config.followMouseSpeed || 0.1))
  })

  const geometry = useMemo(() => {
    switch (config.type) {
      case 'model':
        return null // Models are handled separately
      case 'sphere':
        return <sphereGeometry args={[1, 64, 64]} />
      case 'box':
        return <boxGeometry args={[1, 1, 1]} />
      case 'torus':
        return <torusGeometry args={[1, 0.4, 32, 64]} />
      case 'cylinder':
        return <cylinderGeometry args={[1, 1, 2, 32]} />
      case 'cone':
        return <coneGeometry args={[1, 2, 32]} />
      case 'plane':
        return <planeGeometry args={[1, 1, 32, 32]} />
      case 'ring':
        return <ringGeometry args={[0.5, 1, 32]} />
      case 'octahedron':
        return <octahedronGeometry args={[1, 2]} />
      case 'icosahedron':
        return <icosahedronGeometry args={[1, 1]} />
      case 'dodecahedron':
        return <dodecahedronGeometry args={[1, 1]} />
      case 'tetrahedron':
        return <tetrahedronGeometry args={[1, 0]} />
      case 'text':
        return (
          <Text
            fontSize={1}
            maxWidth={200}
            lineHeight={1}
            letterSpacing={0.02}
            textAlign="center"
          >
            {config.text || 'Hello'}
          </Text>
        )
      default:
        return <boxGeometry args={[1, 1, 1]} />
    }
  }, [config.type, config.text])

  // Handle model loading
  if (config.type === 'model' && config.modelUrl) {
    return (
      <Suspense fallback={null}>
        <ModelLoader url={config.modelUrl} config={config} />
      </Suspense>
    )
  }

  const content = (
    <>
      {geometry}
      <Material config={config.material} />
      {config.noise && <NoiseDisplacement config={config.noise} />}
      {config.wave && <WaveAnimation config={config.wave} />}
    </>
  )

  // Wrap in physics if specified
  if (config.physics) {
    return (
      <RigidBody
        type={config.physics.type as 'fixed' | 'dynamic' | 'kinematicPosition' | 'kinematicVelocity'}
        mass={config.physics.mass}
        friction={config.physics.friction}
        restitution={config.physics.restitution}
        position={config.position}
      >
        <mesh
          ref={meshRef}
          rotation={config.rotation ? new Euler().setFromVector3(new Vector3(...config.rotation)) : undefined}
          scale={config.scale || 1}
          castShadow={config.castShadow}
          receiveShadow={config.receiveShadow}
        >
          {content}
        </mesh>
        {config.type === 'sphere' && <BallCollider args={[1]} />}
        {config.type !== 'sphere' && <CuboidCollider args={[1, 1, 1]} />}
      </RigidBody>
    )
  }

  return (
    <mesh
      ref={meshRef}
      position={config.position}
      rotation={config.rotation ? new Euler().setFromVector3(new Vector3(...config.rotation)) : undefined}
      scale={config.scale || 1}
      castShadow={config.castShadow}
      receiveShadow={config.receiveShadow}
    >
      {content}
    </mesh>
  )
}

// Enhanced particle system
function ParticleSystem({ config }: { config: ParticleSystemConfig }) {
  const meshRef = useRef<THREE.Points>(null)
  const velocities = useRef<Float32Array | undefined>(undefined)

  useFrame((state, delta) => {
    if (!meshRef.current) return
    
    // Auto-rotation
    meshRef.current.rotation.y += delta * 0.1
    
    // Animate particles if velocities exist
    if (velocities.current && meshRef.current.geometry.attributes.position) {
      const positions = meshRef.current.geometry.attributes.position.array as Float32Array
      
      for (let i = 0; i < config.count; i++) {
        const i3 = i * 3
        
        // Apply gravity if specified
        if (config.gravity) {
          velocities.current[i3] += config.gravity[0] * delta
          velocities.current[i3 + 1] += config.gravity[1] * delta
          velocities.current[i3 + 2] += config.gravity[2] * delta
        }
        
        // Apply turbulence
        if (config.turbulence) {
          const turbulence = config.turbulence * 0.1
          velocities.current[i3] += (Math.random() - 0.5) * turbulence * delta
          velocities.current[i3 + 1] += (Math.random() - 0.5) * turbulence * delta
          velocities.current[i3 + 2] += (Math.random() - 0.5) * turbulence * delta
        }
        
        // Update positions
        positions[i3] += velocities.current[i3] * delta
        positions[i3 + 1] += velocities.current[i3 + 1] * delta
        positions[i3 + 2] += velocities.current[i3 + 2] * delta
        
        // Boundary check and reset
        if (Math.abs(positions[i3]) > 10 || Math.abs(positions[i3 + 1]) > 10 || Math.abs(positions[i3 + 2]) > 10) {
          positions[i3] = (Math.random() - 0.5) * 10
          positions[i3 + 1] = (Math.random() - 0.5) * 10
          positions[i3 + 2] = (Math.random() - 0.5) * 10
          
          velocities.current[i3] = (Math.random() - 0.5) * (config.speed || 0.1)
          velocities.current[i3 + 1] = (Math.random() - 0.5) * (config.speed || 0.1)
          velocities.current[i3 + 2] = (Math.random() - 0.5) * (config.speed || 0.1)
        }
      }
      
      meshRef.current.geometry.attributes.position.needsUpdate = true
    }
  })

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(config.count * 3)
    const col = new Float32Array(config.count * 3)
    const vel = new Float32Array(config.count * 3)
    
    for (let i = 0; i < config.count; i++) {
      // Positions
      pos[i * 3] = (Math.random() - 0.5) * 10
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10
      
      // Velocities
      vel[i * 3] = (Math.random() - 0.5) * (config.speed || 0.1)
      vel[i * 3 + 1] = (Math.random() - 0.5) * (config.speed || 0.1)
      vel[i * 3 + 2] = (Math.random() - 0.5) * (config.speed || 0.1)
      
      // Colors
      if (Array.isArray(config.color)) {
        const colorIndex = Math.floor(Math.random() * config.color.length)
        const color = new THREE.Color(config.color[colorIndex])
        col[i * 3] = color.r
        col[i * 3 + 1] = color.g
        col[i * 3 + 2] = color.b
      } else {
        const color = new THREE.Color(config.color as string)
        col[i * 3] = color.r
        col[i * 3 + 1] = color.g
        col[i * 3 + 2] = color.b
      }
    }
    
    velocities.current = vel
    return [pos, col]
  }, [config.count, config.color, config.speed])

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={config.count}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          count={config.count}
          array={colors}
          itemSize={3}
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={config.size || 0.1}
        transparent
        opacity={config.opacity || 1}
        vertexColors
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// Enhanced lighting component
function SceneLights({ lights }: { lights: SceneConfig['lights'] }) {
  return (
    <>
      {lights.map((light, index) => {
        switch (light.type) {
          case 'point':
            return (
              <pointLight
                key={index}
                position={light.position}
                color={light.color}
                intensity={light.intensity}
                distance={light.distance}
                decay={light.decay}
                castShadow={light.castShadow}
                shadow-mapSize={light.shadow?.mapSize}
                shadow-camera-near={light.shadow?.camera?.near}
                shadow-camera-far={light.shadow?.camera?.far}
              />
            )
          case 'spot':
            return (
              <spotLight
                key={index}
                position={light.position}
                target-position={light.target}
                color={light.color}
                intensity={light.intensity}
                distance={light.distance}
                angle={light.angle}
                penumbra={light.penumbra}
                decay={light.decay}
                castShadow={light.castShadow}
                shadow-mapSize={light.shadow?.mapSize}
                shadow-camera-near={light.shadow?.camera?.near}
                shadow-camera-far={light.shadow?.camera?.far}
              />
            )
          case 'directional':
            return (
              <directionalLight
                key={index}
                position={light.position}
                target-position={light.target}
                color={light.color}
                intensity={light.intensity}
                castShadow={light.castShadow}
                shadow-mapSize={light.shadow?.mapSize}
                shadow-camera-near={light.shadow?.camera?.near}
                shadow-camera-far={light.shadow?.camera?.far}
                shadow-camera-left={light.shadow?.camera?.left}
                shadow-camera-right={light.shadow?.camera?.right}
                shadow-camera-top={light.shadow?.camera?.top}
                shadow-camera-bottom={light.shadow?.camera?.bottom}
              />
            )
          case 'ambient':
            return (
              <ambientLight
                key={index}
                color={light.color}
                intensity={light.intensity}
              />
            )
          case 'hemisphere':
            return (
              <hemisphereLight
                key={index}
                position={light.position}
                color={light.color}
                groundColor="#404040"
                intensity={light.intensity}
              />
            )
          case 'rect':
            return (
              <rectAreaLight
                key={index}
                position={light.position}
                width={light.width}
                height={light.height}
                color={light.color}
                intensity={light.intensity}
              />
            )
          default:
            return null
        }
      })}
    </>
  )
}

export function RenderScene({
  sceneConfig,
  onCapture,
}: {
  sceneConfig: SceneConfig
  onCapture: (blob: Blob) => void
}) {
  const handleScreenshot = () => {
    // Screenshot functionality will be implemented later
    onCapture(new Blob())
  }

  const postProcessingEffects = useMemo(() => {
    if (!sceneConfig.postProcessing) return null

    const effects = []

    if (sceneConfig.postProcessing.bloom?.enabled) {
      effects.push(
        <Bloom
          key="bloom"
          intensity={sceneConfig.postProcessing.bloom.intensity || 1}
          luminanceThreshold={sceneConfig.postProcessing.bloom.threshold || 0.9}
          radius={sceneConfig.postProcessing.bloom.radius || 0.8}
          mipmapBlur={sceneConfig.postProcessing.bloom.mipmapBlur}
        />
      )
    }

    if (sceneConfig.postProcessing.chromaticAberration?.enabled) {
      effects.push(
        <ChromaticAberration
          key="ca"
          offset={sceneConfig.postProcessing.chromaticAberration.offset || [0.002, 0.002]}
        />
      )
    }

    if (sceneConfig.postProcessing.dof?.enabled) {
      effects.push(
        <DepthOfField
          key="dof"
          focusDistance={sceneConfig.postProcessing.dof.focusDistance || 0}
          focalLength={sceneConfig.postProcessing.dof.focalLength || 0.02}
          bokehScale={sceneConfig.postProcessing.dof.bokehScale || 2}
          height={sceneConfig.postProcessing.dof.height || 480}
        />
      )
    }

    if (sceneConfig.postProcessing.vignette?.enabled) {
      effects.push(
        <Vignette
          key="vignette"
          darkness={sceneConfig.postProcessing.vignette.darkness || 0.5}
          offset={sceneConfig.postProcessing.vignette.offset || 0.5}
        />
      )
    }

    if (sceneConfig.postProcessing.ssao?.enabled) {
      // Note: SSAO might require additional setup for normal pass
      // Temporarily disabled to prevent console errors
      console.warn('SSAO effect requires NormalPass configuration, skipping for now')
      /*
      effects.push(
        <SSAO
          key="ssao"
          intensity={sceneConfig.postProcessing.ssao.intensity || 1}
          radius={sceneConfig.postProcessing.ssao.radius || 1}
          bias={sceneConfig.postProcessing.ssao.bias || 0.5}
        />
      )
      */
    }

    if (sceneConfig.postProcessing.tonemap?.enabled) {
      effects.push(
        <ToneMapping
          key="tonemap"
          exposure={sceneConfig.postProcessing.tonemap.exposure || 1}
          whitePoint={sceneConfig.postProcessing.tonemap.whitePoint || 1}
        />
      )
    }

    if (sceneConfig.postProcessing.film?.enabled) {
      effects.push(
        <Noise
          key="noise"
          premultiply
          opacity={sceneConfig.postProcessing.film.noiseIntensity || 0.1}
        />
      )
    }

    return effects.length > 0 ? (
      <EffectComposer>
        {effects}
      </EffectComposer>
    ) : null
  }, [sceneConfig.postProcessing])

  const backgroundElement = useMemo(() => {
    if (sceneConfig.environment.type === 'gradient' && Array.isArray(sceneConfig.environment.background)) {
      const colors = sceneConfig.environment.background
      if (colors.length === 2) {
        return <color attach="background" args={[colors[0]]} />
      } else if (colors.length === 3) {
        // Create a simple gradient effect
        return <color attach="background" args={[colors[1]]} />
      }
    }
    return <color attach="background" args={[sceneConfig.environment.background as string || '#000000']} />
  }, [sceneConfig.environment])

  const physicsEnabled = sceneConfig.objects.some(obj => obj.physics)

  const sceneContent = (
    <>
      {backgroundElement}
      
      <Suspense fallback={null}>
        {/* Environment */}
        {sceneConfig.environment.type === 'hdri' && sceneConfig.environment.hdri && (
          <Environment files={sceneConfig.environment.hdri} />
        )}
        
        {sceneConfig.environment.type === 'sky' && (
          <Sky
            turbidity={sceneConfig.environment.sky?.turbidity || 8}
            rayleigh={sceneConfig.environment.sky?.rayleigh || 6}
            mieCoefficient={sceneConfig.environment.sky?.mieCoefficient || 0.005}
            mieDirectionalG={sceneConfig.environment.sky?.mieDirectionalG || 0.8}
            sunPosition={[
              100,
              sceneConfig.environment.sky?.elevation || 2,
              sceneConfig.environment.sky?.azimuth || 180
            ]}
          />
        )}

        {/* Fog */}
        {sceneConfig.environment.fog && (
          <fog
            attach="fog"
            args={[
              sceneConfig.environment.fog.color,
              sceneConfig.environment.fog.near || 1,
              sceneConfig.environment.fog.far || 1000
            ]}
          />
        )}

        {/* Lights */}
        <SceneLights lights={sceneConfig.lights} />

        {/* Objects */}
        {sceneConfig.objects.map((object, index) => (
          <Object3D key={index} config={object} />
        ))}

        {/* Particles */}
        {sceneConfig.particles?.map((particles, index) => (
          <ParticleSystem key={index} config={particles} />
        ))}

        {/* Shadows */}
        <SoftShadows size={25} samples={10} focus={0} />
        <ContactShadows position={[0, -1, 0]} opacity={0.4} scale={10} blur={1.5} far={1} />
      </Suspense>

      {postProcessingEffects}
    </>
  )

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        shadows
        camera={{
          position: sceneConfig.camera.position,
          fov: sceneConfig.camera.fov || 75,
          near: sceneConfig.camera.near || 0.1,
          far: sceneConfig.camera.far || 1000,
        }}
        style={{ background: 'transparent' }}
        onCreated={handleScreenshot}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        {physicsEnabled ? (
          <Physics gravity={[0, -9.81, 0]}>
            {sceneContent}
          </Physics>
        ) : (
          sceneContent
        )}

        <OrbitControls
          makeDefault
          target={sceneConfig.camera.target}
          autoRotate={sceneConfig.camera.autoRotate}
          autoRotateSpeed={sceneConfig.camera.autoRotateSpeed}
          enableZoom={sceneConfig.camera.enableZoom !== false}
          enablePan={sceneConfig.camera.enablePan !== false}
          enableDamping={sceneConfig.camera.enableDamping}
          dampingFactor={sceneConfig.camera.dampingFactor || 0.05}
          minDistance={sceneConfig.camera.minDistance}
          maxDistance={sceneConfig.camera.maxDistance}
          minPolarAngle={sceneConfig.camera.minPolarAngle}
          maxPolarAngle={sceneConfig.camera.maxPolarAngle}
        />
      </Canvas>
    </div>
  )
} 