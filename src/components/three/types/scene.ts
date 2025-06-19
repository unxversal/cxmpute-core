export type Vector3 = [number, number, number];
export type Color = string;
export type Gradient = [Color, Color] | [Color, Color, Color];

export type NoiseType = 'perlin' | 'simplex' | 'curl' | 'worley';
export type WaveType = 'sine' | 'cosine' | 'circular' | 'ripple';
export type ParticleType = 'dust' | 'fireflies' | 'snow' | 'rain' | 'stars' | 'bubbles';
export type MaterialType = 'standard' | 'physical' | 'toon' | 'glass' | 'chrome' | 'holographic' | 'transmission' | 'matcap' | 'lambert' | 'phong';

// Asset configuration for user-provided resources
export interface AssetConfig {
  type: 'image' | 'hdri' | 'glb' | 'gltf';
  url: string;
  name?: string;
}

export interface NoiseConfig {
  type: NoiseType;
  scale?: number;
  speed?: number;
  amplitude?: number;
  octaves?: number;
  persistence?: number;
  lacunarity?: number;
}

export interface WaveConfig {
  type: WaveType;
  amplitude?: number;
  frequency?: number;
  speed?: number;
  direction?: Vector3;
  color?: Color | Gradient;
}

export interface ParticleSystemConfig {
  type: ParticleType;
  count: number;
  size?: number;
  speed?: number;
  color?: Color | Gradient;
  opacity?: number;
  trail?: boolean;
  trailLength?: number;
  gravity?: Vector3;
  turbulence?: number;
}

export interface MaterialConfig {
  type: MaterialType;
  color?: Color;
  gradient?: Gradient;
  metalness?: number;
  roughness?: number;
  emissive?: Color;
  emissiveIntensity?: number;
  transmission?: number;
  thickness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  sheen?: number;
  sheenColor?: Color;
  opacity?: number;
  transparent?: boolean;
  ior?: number;
  reflectivity?: number;
  // Asset support
  map?: string; // URL to texture
  normalMap?: string;
  roughnessMap?: string;
  metalnessMap?: string;
  emissiveMap?: string;
  alphaMap?: string;
  envMap?: string;
  matcap?: string;
}

export interface ObjectConfig {
  type: 'box' | 'sphere' | 'torus' | 'cylinder' | 'cone' | 'text' | 'custom' | 'plane' | 'ring' | 'octahedron' | 'icosahedron' | 'dodecahedron' | 'tetrahedron' | 'model';
  position: Vector3;
  rotation?: Vector3;
  scale?: number | Vector3;
  material: MaterialConfig;
  noise?: NoiseConfig;
  wave?: WaveConfig;
  followMouse?: boolean;
  followMouseSpeed?: number;
  followMouseDistance?: number;
  text?: string;
  customGeometry?: string;
  // Model support
  modelUrl?: string; // For GLB/GLTF models
  castShadow?: boolean;
  receiveShadow?: boolean;
  // Physics
  physics?: {
    type: 'static' | 'dynamic' | 'kinematic';
    mass?: number;
    friction?: number;
    restitution?: number;
  };
}

export interface LightConfig {
  type: 'point' | 'spot' | 'directional' | 'ambient' | 'rect' | 'hemisphere';
  position?: Vector3;
  target?: Vector3;
  color?: Color;
  intensity?: number;
  castShadow?: boolean;
  decay?: number;
  distance?: number;
  angle?: number;
  penumbra?: number;
  width?: number;
  height?: number;
  // Advanced properties
  shadow?: {
    mapSize?: [number, number];
    camera?: {
      near?: number;
      far?: number;
      left?: number;
      right?: number;
      top?: number;
      bottom?: number;
    };
  };
}

export interface PostProcessingConfig {
  bloom?: {
    enabled: boolean;
    intensity?: number;
    threshold?: number;
    radius?: number;
    mipmapBlur?: boolean;
  };
  dof?: {
    enabled: boolean;
    focusDistance?: number;
    focalLength?: number;
    bokehScale?: number;
    height?: number;
  };
  vignette?: {
    enabled: boolean;
    darkness?: number;
    offset?: number;
  };
  chromaticAberration?: {
    enabled: boolean;
    offset?: [number, number];
  };
  film?: {
    enabled: boolean;
    noiseIntensity?: number;
    scanlineIntensity?: number;
    scanlineCount?: number;
    grayscale?: boolean;
  };
  ssao?: {
    enabled: boolean;
    intensity?: number;
    radius?: number;
    bias?: number;
  };
  outline?: {
    enabled: boolean;
    thickness?: number;
    color?: Color;
  };
  tonemap?: {
    enabled: boolean;
    exposure?: number;
    whitePoint?: number;
  };
}

export interface EnvironmentConfig {
  type: 'gradient' | 'hdri' | 'color' | 'fog' | 'sky';
  background?: Color | Gradient;
  hdri?: string; // URL to HDRI
  fog?: {
    color: Color;
    near?: number;
    far?: number;
    density?: number;
  };
  intensity?: number;
  // Sky configuration
  sky?: {
    turbidity?: number;
    rayleigh?: number;
    mieCoefficient?: number;
    mieDirectionalG?: number;
    elevation?: number;
    azimuth?: number;
  };
}

export interface CameraConfig {
  position: Vector3;
  target?: Vector3;
  fov?: number;
  near?: number;
  far?: number;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  enableZoom?: boolean;
  enablePan?: boolean;
  enableDamping?: boolean;
  dampingFactor?: number;
  minDistance?: number;
  maxDistance?: number;
  minPolarAngle?: number;
  maxPolarAngle?: number;
}

export interface SceneConfig {
  name?: string;
  description?: string;
  camera: CameraConfig;
  environment: EnvironmentConfig;
  objects: ObjectConfig[];
  lights: LightConfig[];
  particles?: ParticleSystemConfig[];
  postProcessing?: PostProcessingConfig;
  // User assets
  assets?: AssetConfig[];
  // Animation
  animation?: {
    autoPlay?: boolean;
    loop?: boolean;
    duration?: number;
  };
} 