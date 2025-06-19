import { SceneConfig } from '../types/scene';

export const advancedPresets: Record<string, SceneConfig> = {
  fluidWaves: {
    name: 'Fluid Waves',
    description: 'A mesmerizing fluid simulation with dynamic waves and particles',
    camera: {
      position: [0, 5, 10],
      fov: 60,
      controls: {
        type: 'orbit',
        autoRotate: true,
        autoRotateSpeed: 0.3,
        enableDamping: true,
      }
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
        type: 'plane',
        position: [0, -2, 0],
        rotation: [-Math.PI / 2, 0, 0],
        scale: [20, 20, 1],
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
        luminanceThreshold: 0.3,
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
    description: 'A collection of geometric crystals with dynamic lighting and transmission',
    camera: {
      position: [0, 4, 8],
      fov: 60,
      controls: {
        type: 'orbit',
        autoRotate: true,
        autoRotateSpeed: 0.5,
        enableDamping: true,
      }
    },
    environment: {
      type: 'color',
      background: '#000022',
      fog: {
        color: '#000033',
        near: 1,
        far: 20,
      },
    },
    objects: [
      // Ground
      {
        type: 'plane',
        position: [0, -1, 0],
        rotation: [-Math.PI / 2, 0, 0],
        scale: [20, 20, 1],
        material: {
          type: 'physical',
          color: '#001133',
          metalness: 0.9,
          roughness: 0.1,
          clearcoat: 1,
        },
        receiveShadow: true,
      },
      // Crystal formations
      {
        type: 'cone',
        position: [-2, 0, -2],
        scale: [1, 2, 1],
        material: {
          type: 'transmission',
          color: '#ff3366',
          transmission: 0.9,
          thickness: 0.5,
          roughness: 0,
          samples: 16,
          resolution: 512,
          iridescence: 1,
          iridescenceIOR: 1.3,
        },
        castShadow: true,
      },
      {
        type: 'octahedron',
        position: [2, 0.5, -1],
        scale: 1.2,
        material: {
          type: 'transmission',
          color: '#33ff66',
          transmission: 0.9,
          thickness: 0.3,
          roughness: 0,
          clearcoat: 1,
          clearcoatRoughness: 0,
          anisotropicBlur: 0.1,
        },
        castShadow: true,
      },
      {
        type: 'icosahedron',
        position: [0, 1, 2],
        scale: 0.8,
        material: {
          type: 'transmission',
          color: '#3366ff',
          transmission: 0.95,
          thickness: 0.2,
          roughness: 0,
          iridescence: 0.8,
          iridescenceThicknessRange: [100, 800],
        },
        castShadow: true,
      },
      {
        type: 'dodecahedron',
        position: [-1, 0.5, 1],
        scale: 0.6,
        material: {
          type: 'holographic',
          color: '#ffcc00',
          opacity: 0.8,
          holographicFrequency: 20.0,
          holographicAmplitude: 0.1,
        },
      }
    ],
    lights: [
      {
        type: 'ambient',
        intensity: 0.2,
      },
      {
        type: 'spot',
        position: [5, 8, 5],
        target: [-2, 0, -2],
        color: '#ff3366',
        intensity: 3,
        angle: 0.3,
        penumbra: 0.5,
        castShadow: true,
      },
      {
        type: 'spot',
        position: [-5, 8, -5],
        target: [2, 0, -1],
        color: '#3366ff',
        intensity: 3,
        angle: 0.3,
        penumbra: 0.5,
        castShadow: true,
      },
      {
        type: 'point',
        position: [0, 10, 0],
        color: '#ffffff',
        intensity: 1,
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
    shadows: {
      type: 'soft',
      size: 15,
      focus: 0.5,
      samples: 20,
    },
    postProcessing: {
      bloom: {
        enabled: true,
        intensity: 1.5,
        luminanceThreshold: 0.1,
        radius: 0.8,
        mipmapBlur: true,
      },
      n8ao: {
        enabled: true,
        aoRadius: 2,
        intensity: 1.5,
        distanceFalloff: 1,
      },
      chromaticAberration: {
        enabled: true,
        offset: [0.001, 0.001],
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

  particleSystem: {
    name: 'Particle System',
    description: 'Dynamic particle systems with multiple effects and interactions',
    camera: {
      position: [0, 0, 15],
      fov: 75,
      controls: {
        type: 'orbit',
        autoRotate: true,
        autoRotateSpeed: 0.2,
        enableDamping: true,
      }
    },
    environment: {
      type: 'color',
      background: '#000000',
    },
    objects: [
      // Central attractor
      {
        type: 'sphere',
        position: [0, 0, 0],
        scale: 0.5,
        material: {
          type: 'standard',
          color: '#ffffff',
          emissive: '#4444ff',
          emissiveIntensity: 1,
        },
      }
    ],
    lights: [
      {
        type: 'ambient',
        intensity: 0.1,
      }
    ],
    particles: [
      {
        type: 'fireflies',
        count: 1000,
        color: ['#ff4444', '#44ff44', '#4444ff', '#ffff44'],
        size: 0.08,
        speed: 0.3,
        trail: true,
        trailLength: 15,
        opacity: 0.8,
      },
      {
        type: 'dust',
        count: 2000,
        color: '#ffffff',
        size: 0.02,
        speed: 0.1,
        opacity: 0.4,
        turbulence: 0.5,
      },
      {
        type: 'stars',
        count: 500,
        color: '#ffffff',
        size: 0.05,
        speed: 0.05,
        opacity: 0.9,
      }
    ],
    postProcessing: {
      bloom: {
        enabled: true,
        intensity: 2,
        luminanceThreshold: 0.1,
        radius: 1,
        mipmapBlur: true,
      },
      film: {
        enabled: true,
        noiseIntensity: 0.05,
        scanlineIntensity: 0.05,
      },
    },
  },

  instancedGeometry: {
    name: 'Instanced Geometry',
    description: 'Performance-optimized scene with thousands of instanced objects',
    camera: {
      position: [0, 5, 15],
      fov: 60,
      controls: {
        type: 'orbit',
        autoRotate: true,
        autoRotateSpeed: 1,
        enableDamping: true,
      }
    },
    environment: {
      type: 'preset',
      preset: 'city',
      background: true,
      intensity: 0.8,
    },
    objects: [
      {
        type: 'sphere',
        position: [0, 0, 0],
        isInstanced: true,
        instanceData: Array.from({ length: 200 }, (_, i) => {
          const angle = (i / 200) * Math.PI * 2;
          const radius = 2 + Math.sin(i * 0.1) * 8;
          const height = Math.sin(i * 0.05) * 5;
          return {
            position: [
              Math.cos(angle) * radius,
              height,
              Math.sin(angle) * radius
            ] as [number, number, number],
            scale: 0.1 + Math.random() * 0.2,
            color: `hsl(${i * 1.8}, 70%, 60%)`,
          };
        }),
        material: {
          type: 'physical',
          metalness: 0.8,
          roughness: 0.2,
          clearcoat: 0.9,
          clearcoatRoughness: 0.1,
        },
        castShadow: true,
      }
    ],
    lights: [
      {
        type: 'ambient',
        intensity: 0.4,
      },
      {
        type: 'directional',
        position: [10, 10, 5],
        intensity: 1,
        castShadow: true,
      }
    ],
    shadows: {
      type: 'soft',
      size: 25,
      focus: 1,
      samples: 15,
    },
    postProcessing: {
      n8ao: {
        enabled: true,
        aoRadius: 1,
        intensity: 1,
      },
      toneMapping: {
        enabled: true,
        mode: 'ACESFilmic',
        exposure: 1.2,
      },
    },
  },

  physicsPlayground: {
    name: 'Physics Playground',
    description: 'Interactive physics simulation with multiple object types',
    camera: {
      position: [0, 8, 15],
      fov: 60,
      controls: {
        type: 'orbit',
        enableDamping: true,
        dampingFactor: 0.05,
      }
    },
    environment: {
      type: 'preset',
      preset: 'warehouse',
      background: true,
    },
    physicsWorld: {
      gravity: [0, -9.81, 0],
      timeStep: 1/60,
    },
    objects: [
      // Ground platform
      {
        type: 'box',
        position: [0, -2, 0],
        scale: [15, 1, 15],
        material: {
          type: 'standard',
          color: '#444444',
          roughness: 0.9,
          metalness: 0.1,
        },
        physics: {
          type: 'fixed',
          friction: 0.8,
          restitution: 0.3,
          colliders: [{ type: 'cuboid' as const, args: [7.5, 0.5, 7.5] }]
        },
        receiveShadow: true,
      },
      // Ramps
      {
        type: 'box',
        position: [-5, 0, -5],
        rotation: [0, 0, Math.PI / 8],
        scale: [4, 0.2, 3],
        material: {
          type: 'standard',
          color: '#666666',
          roughness: 0.7,
        },
        physics: {
          type: 'fixed',
          friction: 0.6,
          restitution: 0.4,
          colliders: [{ type: 'cuboid' as const, args: [2, 0.1, 1.5] }]
        },
        castShadow: true,
        receiveShadow: true,
      },
      // Dynamic objects
      ...Array.from({ length: 15 }, (_, i) => {
        const types = ['box', 'sphere', 'cylinder'] as const;
        const type = types[i % 3];
        const colors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff'];
        
        return {
          type,
          id: `physics-object-${i}`,
          position: [
            (Math.random() - 0.5) * 8,
            5 + i * 0.5,
            (Math.random() - 0.5) * 8
          ] as [number, number, number],
          scale: 0.5 + Math.random() * 0.5,
          material: {
            type: 'physical' as const,
            color: colors[i % colors.length],
            metalness: 0.1 + Math.random() * 0.3,
            roughness: 0.1 + Math.random() * 0.3,
            clearcoat: Math.random() * 0.5,
          },
          physics: {
            type: 'dynamic' as const,
            mass: 0.5 + Math.random() * 2,
            friction: 0.3 + Math.random() * 0.4,
            restitution: 0.2 + Math.random() * 0.6,
            linearDamping: 0.1,
            angularDamping: 0.1,
            colliders: type === 'sphere' 
              ? [{ type: 'ball' as const, args: [0.25] }]
              : type === 'cylinder'
              ? [{ type: 'cylinder' as const, args: [0.25, 0.5] }]
              : [{ type: 'cuboid' as const, args: [0.25, 0.25, 0.25] }]
          },
          castShadow: true,
          receiveShadow: true,
        };
      })
    ],
    lights: [
      {
        type: 'ambient',
        intensity: 0.4,
      },
      {
        type: 'directional',
        position: [10, 15, 10],
        intensity: 1.2,
        castShadow: true,
        shadow: {
          mapSize: [2048, 2048],
          camera: {
            left: -20,
            right: 20,
            top: 20,
            bottom: -20,
            near: 0.1,
            far: 30,
          }
        }
      },
      {
        type: 'point',
        position: [0, 5, 0],
        color: '#ffffff',
        intensity: 0.5,
      }
    ],
    shadows: {
      type: 'soft',
      size: 25,
      focus: 1,
      samples: 20,
    },
    postProcessing: {
      n8ao: {
        enabled: true,
        aoRadius: 1.5,
        intensity: 1.2,
        distanceFalloff: 1,
      },
      bloom: {
        enabled: true,
        intensity: 0.3,
        luminanceThreshold: 0.9,
        radius: 0.4,
      },
    },
  },
}; 