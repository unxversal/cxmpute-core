import { SceneConfig } from '../types/scene';

export const advancedPresets: Record<string, SceneConfig> = {
  fluidWaves: {
    name: 'Fluid Waves',
    description: 'A mesmerizing fluid simulation with dynamic waves and particles',
    camera: {
      position: [0, 5, 10],
      target: [0, 0, 0],
      fov: 60,
    },
    environment: {
      type: 'gradient',
      background: ['#001f3f', '#0074D9'],
      fog: {
        color: '#001f3f',
        near: 5,
        far: 30,
      },
    },
    objects: [
      {
        type: 'custom',
        position: [0, -2, 0],
        scale: [20, 1, 20],
        material: {
          type: 'physical',
          color: '#7FDBFF',
          metalness: 0.2,
          roughness: 0.1,
          transmission: 0.5,
          thickness: 0.5,
        },
        wave: {
          type: 'ripple',
          amplitude: 0.3,
          frequency: 0.5,
          speed: 0.5,
        },
      }
    ],
    lights: [
      {
        type: 'directional',
        position: [5, 10, 5],
        color: '#ffffff',
        intensity: 1,
        castShadow: true,
      },
      {
        type: 'point',
        position: [-5, 5, -5],
        color: '#7FDBFF',
        intensity: 2,
      }
    ],
    particles: [
      {
        type: 'fireflies',
        count: 200,
        color: '#7FDBFF',
        size: 0.05,
        speed: 0.2,
        opacity: 0.6,
      }
    ],
    postProcessing: {
      bloom: {
        enabled: true,
        intensity: 1,
        radius: 0.8,
      },
      dof: {
        enabled: true,
        focusDistance: 10,
        focalLength: 0.02,
      },
    },
  },

  noiseField: {
    name: 'Noise Field',
    description: 'Abstract noise-based deformations with dynamic materials',
    camera: {
      position: [0, 0, 5],
      fov: 75,
      autoRotate: true,
      autoRotateSpeed: 0.5,
    },
    environment: {
      type: 'gradient',
      background: ['#000000', '#1a0038'],
    },
    objects: [
      {
        type: 'sphere',
        position: [0, 0, 0],
        scale: 2,
        material: {
          type: 'physical',
          color: '#ffffff',
          metalness: 1,
          roughness: 0.2,
          clearcoat: 1,
        },
        noise: {
          type: 'perlin',
          scale: 2,
          speed: 0.3,
          amplitude: 0.2,
          octaves: 4,
          persistence: 0.5,
        },
      }
    ],
    lights: [
      {
        type: 'point',
        position: [3, 3, 3],
        color: '#ff0066',
        intensity: 1,
      },
      {
        type: 'point',
        position: [-3, -3, -3],
        color: '#00ffff',
        intensity: 1,
      }
    ],
    particles: [
      {
        type: 'dust',
        count: 1000,
        color: ['#ff0066', '#00ffff'],
        size: 0.02,
        speed: 0.1,
      }
    ],
    postProcessing: {
      bloom: {
        enabled: true,
        intensity: 1.5,
      },
      chromaticAberration: {
        enabled: true,
        offset: [0.002, 0.002],
      },
    },
  },

  crystalGarden: {
    name: 'Crystal Garden',
    description: 'A collection of geometric crystals with dynamic lighting',
    camera: {
      position: [0, 4, 8],
      target: [0, 0, 0],
      fov: 60,
    },
    environment: {
      type: 'gradient',
      background: ['#000022', '#002244'],
      fog: {
        color: '#000033',
        near: 1,
        far: 20,
      },
    },
    objects: [
      {
        type: 'custom',
        position: [0, -1, 0],
        scale: [10, 0.1, 10],
        material: {
          type: 'physical',
          color: '#001133',
          metalness: 0.9,
          roughness: 0.1,
          clearcoat: 1,
        },
      },
      {
        type: 'cone',
        position: [-2, 0, -2],
        scale: 1,
        material: {
          type: 'glass',
          color: '#ff3366',
          transmission: 0.9,
          thickness: 0.5,
          roughness: 0,
        },
        wave: {
          type: 'sine',
          amplitude: 0.1,
          frequency: 1,
          speed: 0.5,
        },
      },
      {
        type: 'box',
        position: [2, 0, -1],
        scale: 1,
        material: {
          type: 'glass',
          color: '#33ff66',
          transmission: 0.9,
          thickness: 0.5,
          roughness: 0,
        },
        wave: {
          type: 'sine',
          amplitude: 0.1,
          frequency: 1,
          speed: 0.7,
        },
      },
      {
        type: 'torus',
        position: [0, 0, 2],
        scale: 1,
        material: {
          type: 'glass',
          color: '#3366ff',
          transmission: 0.9,
          thickness: 0.5,
          roughness: 0,
        },
        wave: {
          type: 'sine',
          amplitude: 0.1,
          frequency: 1,
          speed: 0.3,
        },
      }
    ],
    lights: [
      {
        type: 'point',
        position: [0, 5, 0],
        color: '#ffffff',
        intensity: 0.5,
      },
      {
        type: 'spot',
        position: [5, 5, 5],
        color: '#ff3366',
        intensity: 2,
        castShadow: true,
      },
      {
        type: 'spot',
        position: [-5, 5, -5],
        color: '#3366ff',
        intensity: 2,
        castShadow: true,
      }
    ],
    particles: [
      {
        type: 'dust',
        count: 500,
        color: '#ffffff',
        size: 0.01,
        speed: 0.05,
        opacity: 0.3,
      }
    ],
    postProcessing: {
      bloom: {
        enabled: true,
        intensity: 1,
        radius: 0.8,
      },
      dof: {
        enabled: true,
        focusDistance: 8,
        focalLength: 0.02,
        bokehScale: 2,
      },
    },
  },

  minimalistFlow: {
    name: 'Minimalist Flow',
    description: 'Clean, minimal design with subtle animations',
    camera: {
      position: [0, 2, 5],
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
        scale: [8, 0.05, 8],
        material: {
          type: 'standard',
          color: '#f0f0f0',
          roughness: 0.4,
          metalness: 0.6,
        },
        wave: {
          type: 'sine',
          amplitude: 0.05,
          frequency: 0.5,
          speed: 0.2,
        },
      },
      {
        type: 'sphere',
        position: [0, 1, 0],
        scale: 0.5,
        material: {
          type: 'standard',
          color: '#000000',
          roughness: 0.2,
          metalness: 0.8,
        },
        followMouse: true,
        followMouseSpeed: 0.1,
        followMouseDistance: 2,
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
}; 