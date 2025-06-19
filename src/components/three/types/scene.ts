export type Vector3 = [number, number, number];
export type Color = string; // Hex, rgb, rgba, hsl, or named color
export type Gradient = [Color, Color] | [Color, Color, Color];

export type NoiseType = 'perlin' | 'simplex' | 'curl' | 'worley';
export type WaveType = 'sine' | 'cosine' | 'circular' | 'ripple';
export type ParticleType = 'dust' | 'fireflies' | 'snow' | 'rain' | 'stars' | 'bubbles';
export type MaterialType = 
  | 'standard' 
  | 'physical' 
  | 'toon' 
  | 'glass' 
  | 'chrome'
  | 'holographic' 
  | 'transmission' 
  | 'matcap' 
  | 'lambert' 
  | 'phong'
  | 'shader';

// Asset configuration for user-provided resources
export interface AssetConfig {
  type: 'image' | 'hdri' | 'glb' | 'gltf' | 'lut';
  url: string;
  name: string;
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
  opacity?: number;
  transparent?: boolean;

  // Enhanced material properties
  transmission?: number;
  thickness?: number;
  backside?: boolean;
  backsideThickness?: number;
  samples?: number;
  resolution?: number;
  anisotropicBlur?: number;
  iridescence?: number;
  iridescenceIOR?: number;
  iridescenceThicknessRange?: [number, number];
  clearcoat?: number;
  clearcoatRoughness?: number;
  
  // Physical material specific
  sheen?: number;
  sheenColor?: Color;
  ior?: number;
  reflectivity?: number;
  
  // Holographic specific
  holographicFrequency?: number;
  holographicAmplitude?: number;

  // Shader material specific
  shaderTimeUniform?: string;
  shaderColorUniform?: string;

  // Asset support (references asset by name)
  map?: string; 
  normalMap?: string;
  roughnessMap?: string;
  metalnessMap?: string;
  emissiveMap?: string;
  alphaMap?: string;
  envMap?: string;
  matcap?: string;
}

export interface ObjectConfig {
  type: 'box' | 'sphere' | 'torus' | 'cylinder' | 'cone' | 'text' | 'plane' | 'ring' | 'octahedron' | 'icosahedron' | 'dodecahedron' | 'tetrahedron' | 'model' | 'roundedBox';
  id?: string;
  position: Vector3;
  rotation?: Vector3;
  scale?: number | Vector3;
  material: MaterialConfig | MaterialConfig[]; // Allow array for multi-material objects
  
  // Geometry specific args
  geometryArgs?: number[];
  
  // Effects
  noise?: NoiseConfig;
  wave?: WaveConfig;
  
  // Interaction
  followMouse?: boolean;
  followMouseSpeed?: number;
  followMouseDistance?: number;

  // Text specific
  text?: string;
  fontUrl?: string;
  fontSize?: number;
  textColor?: Color;

  // Model specific
  modelName?: string; // Reference asset by name

  // Shadows
  castShadow?: boolean;
  receiveShadow?: boolean;
  
  // Physics
  physics?: {
    type: 'static' | 'dynamic' | 'kinematicPosition' | 'fixed';
    mass?: number;
    friction?: number;
    restitution?: number;
    linearDamping?: number;
    angularDamping?: number;
    colliders?: Array<{
      type: 'ball' | 'cuboid' | 'cylinder' | 'trimesh' | 'hull' | 'cone';
      args: number[];
      position?: Vector3;
      rotation?: Vector3;
    }>;
  };

  // Instancing
  isInstanced?: boolean;
  instanceData?: Array<{
    position: Vector3;
    rotation?: Vector3;
    scale?: number | Vector3;
    color?: Color;
  }>;
}

export interface LightConfig {
  type: 'point' | 'spot' | 'directional' | 'ambient' | 'rectArea' | 'hemisphere' | 'lightformer';
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
  groundColor?: Color; // For hemisphere

  // Lightformer specific
  form?: 'rect' | 'circle' | 'ring';
  scale?: number | Vector3;
  lookAt?: Vector3;

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
    bias?: number;
    normalBias?: number;
  };
}

export interface PostProcessingConfig {
  bloom?: {
    enabled: boolean;
    intensity?: number;
    luminanceThreshold?: number;
    luminanceSmoothing?: number;
    radius?: number;
    mipmapBlur?: boolean;
    levels?: number;
  };
  dof?: {
    enabled: boolean;
    target?: Vector3;
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
  n8ao?: {
    enabled: boolean;
    aoRadius?: number;
    intensity?: number;
    distanceFalloff?: number;
    color?: Color;
    aoSamples?: number;
    denoiseSamples?: number;
    denoiseRadius?: number;
  };
  lut?: {
    enabled: boolean;
    lutTextureName: string;
  };
  brightnessContrast?: {
    enabled: boolean;
    brightness?: number;
    contrast?: number;
  };
  hueSaturation?: {
    enabled: boolean;
    hue?: number;
    saturation?: number;
  };
  toneMapping?: {
    enabled: boolean;
    mode?: 'ACESFilmic' | 'Linear' | 'Reinhard' | 'OptimizedCineon' | 'None';
    adaptive?: boolean;
    resolution?: number;
    whitePoint?: number;
    minLuminance?: number;
    maxLuminance?: number;
    averageLuminance?: number;
    middleGrey?: number;
    exposure?: number;
  };
  outline?: {
    enabled: boolean;
    thickness?: number;
    color?: Color;
  };
}

export interface EnvironmentConfig {
  type: 'color' | 'gradient' | 'hdri' | 'sky' | 'preset';
  background?: boolean | Color | Gradient;
  hdriName?: string; // Reference asset by name
  fog?: {
    color: Color;
    near?: number;
    far?: number;
    density?: number;
  };
  intensity?: number;
  resolution?: number;
  
  sky?: {
    turbidity?: number;
    rayleigh?: number;
    mieCoefficient?: number;
    mieDirectionalG?: number;
    azimuth?: number;
    inclination?: number;
    sunPosition?: Vector3;
  };

  preset?: 
    | 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' 
    | 'apartment' | 'studio' | 'city' | 'park' | 'lobby';

  lightformers?: LightConfig[];
}

export interface CameraConfig {
  position: Vector3;
  target?: Vector3;
  fov?: number;
  near?: number;
  far?: number;
  zoom?: number;

  controls?: {
    type: 'orbit' | 'camera';
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
    minAzimuthAngle?: number;
    maxAzimuthAngle?: number;
    dollyToCursor?: boolean;
    infinityDolly?: boolean;
  };
}

export interface PhysicsWorldConfig {
  gravity: Vector3;
  timeStep?: 'vary' | number;
}

export interface SceneConfig {
  name: string;
  description?: string;
  camera: CameraConfig;
  environment: EnvironmentConfig;
  objects: ObjectConfig[];
  lights: LightConfig[];
  particles?: ParticleSystemConfig[];
  postProcessing?: PostProcessingConfig;
  assets?: AssetConfig[];
  physicsWorld?: PhysicsWorldConfig;

  animation?: {
    autoPlay?: boolean;
    loop?: boolean;
    duration?: number;
  };
  
  shadows?: {
    type: 'soft' | 'accumulative' | 'contact' | 'none';
    size?: number;
    focus?: number;
    samples?: number;
    temporal?: boolean;
    frames?: number;
    alphaTest?: number;
    opacity?: number;
    scale?: number;
    color?: Color;
    colorBlend?: number;
    blur?: number;
    far?: number;
  };
} 