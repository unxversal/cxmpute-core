import { SceneConfig } from '../types/scene';
import { advancedPresets } from './advanced';
import { heroPresets } from './hero-examples';

export const presets: Record<string, SceneConfig> = {
  // Hero Section Examples (Non-interactive, optimized for showcasing)
  ...heroPresets,
  
  // Original examples (keeping for backward compatibility)
  neonWaves: {
    name: 'Neon Waves',
    description: 'A cyberpunk-inspired scene with neon waves and floating orbs',
    camera: {
      position: [0, 5, 10],
      target: [0, 0, 0],
      fov: 75,
      enableDamping: true,
      dampingFactor: 0.05,
    },
    environment: {
      type: 'gradient',
      background: ['#000000', '#1a0033'],
      fog: {
        color: '#1a0033',
        near: 1,
        far: 30,
      },
    },
    objects: [
      {
        type: 'sphere',
        position: [0, 2, 0],
        scale: 1,
        material: {
          type: 'glass',
          color: '#ff00ff',
          transmission: 0.9,
          thickness: 0.5,
          roughness: 0,
        },
        followMouse: true,
        followMouseSpeed: 0.1,
        followMouseDistance: 2,
        castShadow: true,
      }
    ],
    lights: [
      {
        type: 'point',
        position: [5, 5, 5],
        color: '#ff00ff',
        intensity: 1,
      },
      {
        type: 'point',
        position: [-5, 5, -5],
        color: '#00ffff',
        intensity: 1,
      }
    ],
    particles: [
      {
        type: 'fireflies',
        count: 100,
        color: ['#ff00ff', '#00ffff'],
        size: 0.1,
        speed: 0.5,
        trail: true,
        trailLength: 10,
      }
    ],
    postProcessing: {
      bloom: {
        enabled: true,
        intensity: 1.5,
        mipmapBlur: true,
      },
      chromaticAberration: {
        enabled: true,
        offset: [0.002, 0.002],
      },
    },
  },

  cosmicDust: {
    name: 'Cosmic Dust',
    description: 'A space-themed scene with floating particles and nebula effects',
    camera: {
      position: [0, 0, 10],
      fov: 60,
      autoRotate: true,
      autoRotateSpeed: 0.5,
      enableDamping: true,
    },
    environment: {
      type: 'gradient',
      background: ['#000000', '#0a0a2a', '#1a0033'],
    },
    objects: [
      {
        type: 'sphere',
        position: [0, 0, 0],
        scale: 3,
        material: {
          type: 'physical',
          color: '#ffffff',
          emissive: '#000033',
          emissiveIntensity: 0.5,
          roughness: 0.2,
          metalness: 0.8,
        },
        noise: {
          type: 'perlin',
          scale: 1,
          speed: 0.2,
          amplitude: 0.1,
        },
        castShadow: true,
      }
    ],
    lights: [
      {
        type: 'ambient',
        color: '#ffffff',
        intensity: 0.1,
      },
      {
        type: 'point',
        position: [5, 5, 5],
        color: '#ff3366',
        intensity: 1,
        castShadow: true,
      }
    ],
    particles: [
      {
        type: 'dust',
        count: 2000,
        color: ['#ffffff', '#ff3366'],
        size: 0.02,
        speed: 0.1,
      },
      {
        type: 'stars',
        count: 1000,
        color: '#ffffff',
        size: 0.01,
      }
    ],
    postProcessing: {
      bloom: {
        enabled: true,
        intensity: 1,
        radius: 1,
      },
      dof: {
        enabled: true,
        focusDistance: 10,
        focalLength: 0.02,
      },
    },
  },

  wavyMinimal: {
    name: 'Wavy Minimal',
    description: 'A minimalist scene with flowing waves and subtle animations',
    camera: {
      position: [0, 5, 10],
      target: [0, 0, 0],
      fov: 50,
    },
    environment: {
      type: 'color',
      background: '#ffffff',
    },
    objects: [
      {
        type: 'custom',
        position: [0, 0, 0],
        scale: [10, 1, 10],
        material: {
          type: 'standard',
          color: '#f0f0f0',
          roughness: 0.4,
          metalness: 0.6,
        },
        wave: {
          type: 'ripple',
          amplitude: 0.2,
          frequency: 0.5,
          speed: 0.3,
        },
      }
    ],
    lights: [
      {
        type: 'ambient',
        intensity: 0.5,
      },
      {
        type: 'directional',
        position: [5, 5, 5],
        intensity: 0.8,
        castShadow: true,
      }
    ],
    postProcessing: {
      bloom: {
        enabled: true,
        intensity: 0.5,
      },
      vignette: {
        enabled: true,
        darkness: 0.5,
      },
    },
  },

  holographicShowcase: {
    name: 'Holographic Showcase',
    description: 'A futuristic display with holographic elements',
    camera: {
      position: [0, 2, 5],
      fov: 60,
    },
    environment: {
      type: 'gradient',
      background: ['#000022', '#000044'],
      fog: {
        color: '#000033',
        near: 1,
        far: 15,
      },
    },
    objects: [
      {
        type: 'torus',
        position: [0, 1, 0],
        scale: 1.5,
        material: {
          type: 'holographic',
          color: '#00ffff',
          opacity: 0.8,
          transmission: 0.5,
        },
        wave: {
          type: 'sine',
          amplitude: 0.1,
          frequency: 1,
          speed: 0.5,
        },
      }
    ],
    lights: [
      {
        type: 'rect',
        position: [0, 5, 0],
        width: 4,
        height: 4,
        color: '#00ffff',
        intensity: 0.5,
      }
    ],
    particles: [
      {
        type: 'fireflies',
        count: 50,
        color: '#00ffff',
        size: 0.05,
        speed: 0.2,
        opacity: 0.5,
      }
    ],
    postProcessing: {
      bloom: {
        enabled: true,
        intensity: 1,
      },
      film: {
        enabled: true,
        noiseIntensity: 0.1,
        scanlineIntensity: 0.1,
      },
    },
  },

  // Advanced examples
  ...advancedPresets,
}; 