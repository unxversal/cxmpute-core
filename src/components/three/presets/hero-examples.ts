import { SceneConfig } from '../types/scene';

export const heroExamples: { [key: string]: SceneConfig } = {
  rotatingBoxes: {
    name: 'Rotating Boxes',
    description: 'Simple rotating boxes with hover effects',
    camera: {
      position: [0, 0, 5],
      fov: 75,
      controls: {
        type: 'orbit',
        autoRotate: false,
        enableDamping: true,
        dampingFactor: 0.05,
      }
    },
    environment: {
      type: 'color',
      background: '#f0f0f0',
    },
    lights: [
      {
        type: 'ambient',
        color: '#ffffff',
        intensity: 0.3,
      },
      {
        type: 'point',
        position: [10, 10, 5],
        color: '#ffffff',
        intensity: 1,
      },
      {
        type: 'point',
        position: [-10, -10, -5],
        color: '#ffffff',
        intensity: 1,
      },
    ],
    objects: [
      {
        type: 'box',
        position: [-1.5, 0, 0],
        scale: 1,
        material: {
          type: 'standard',
          color: '#ff6b35',
        },
      },
      {
        type: 'box',
        position: [1.5, 0, 0],
        scale: 1,
        material: {
          type: 'standard',
          color: '#4ecdc4',
        },
      },
    ],
  },

  floatingSphere: {
    name: 'Floating Sphere',
    description: 'A gently floating sphere with bloom effect',
    camera: {
      position: [0, 0, 8],
      fov: 75,
      controls: {
        type: 'orbit',
        autoRotate: true,
        autoRotateSpeed: 0.5,
        enableDamping: true,
      }
    },
    environment: {
      type: 'color',
      background: '#000011',
    },
    lights: [
      {
        type: 'ambient',
        color: '#ffffff',
        intensity: 0.2,
      },
      {
        type: 'point',
        position: [0, 0, 0],
        color: '#4ecdc4',
        intensity: 2,
      },
    ],
    objects: [
      {
        type: 'sphere',
        position: [0, 0, 0],
        scale: 1.5,
        material: {
          type: 'standard',
          color: '#4ecdc4',
          emissive: '#4ecdc4',
          emissiveIntensity: 0.2,
        },
      },
    ],
    postProcessing: {
      bloom: {
        enabled: true,
        intensity: 1,
        luminanceThreshold: 0.1,
        radius: 0.8,
      },
    },
  },

  glassTransmission: {
    name: 'Glass Transmission',
    description: 'Advanced glass material with transmission and refraction',
    camera: {
      position: [0, 0, 5],
      fov: 75,
      controls: {
        type: 'orbit',
        autoRotate: true,
        autoRotateSpeed: 1,
        enableDamping: true,
      }
    },
    environment: {
      type: 'preset',
      preset: 'studio',
      background: false,
      intensity: 1.0,
    },
    lights: [
      {
        type: 'ambient',
        color: '#ffffff',
        intensity: 0.5,
      },
      {
        type: 'directional',
        position: [5, 5, 5],
        color: '#ffffff',
        intensity: 1,
      },
    ],
    objects: [
      {
        type: 'torus',
        position: [0, 0, 0],
        scale: 1.5,
        material: {
          type: 'transmission',
          color: '#ffffff',
          transmission: 0.95,
          thickness: 0.2,
          roughness: 0,
          ior: 1.5,
          samples: 16,
          resolution: 512,
          clearcoat: 1,
          clearcoatRoughness: 0,
        },
      },
    ],
    postProcessing: {
      bloom: {
        enabled: true,
        intensity: 0.5,
        luminanceThreshold: 0.7,
        radius: 0.5,
      },
    },
  },

  holographicTorus: {
    name: 'Holographic Torus',
    description: 'A holographic torus with animated shader effects',
    camera: {
      position: [0, 2, 5],
      fov: 60,
      controls: {
        type: 'orbit',
        autoRotate: true,
        autoRotateSpeed: 0.8,
      }
    },
    environment: {
      type: 'color',
      background: '#0a0a0a',
    },
    lights: [
      {
        type: 'ambient',
        intensity: 0.1,
      },
      {
        type: 'rectArea',
        position: [0, 5, 0],
        width: 4,
        height: 4,
        color: '#00ffff',
        intensity: 0.5,
      }
    ],
    objects: [
      {
        type: 'torus',
        position: [0, 0, 0],
        scale: 1.5,
        material: {
          type: 'holographic',
          color: '#00ffff',
          opacity: 0.8,
          holographicFrequency: 10.0,
          holographicAmplitude: 0.05,
        },
      }
    ],
    postProcessing: {
      bloom: {
        enabled: true,
        intensity: 1.2,
        luminanceThreshold: 0.1,
        radius: 0.8,
      },
      chromaticAberration: {
        enabled: true,
        offset: [0.002, 0.002],
      },
    },
  },

  physicsBoxes: {
    name: 'Physics Boxes',
    description: 'Bouncing boxes with realistic physics',
    camera: {
      position: [0, 5, 10],
      fov: 60,
      controls: {
        type: 'orbit',
        enableDamping: true,
      }
    },
    environment: {
      type: 'preset',
      preset: 'warehouse',
      background: true,
    },
    physicsWorld: {
      gravity: [0, -9.81, 0],
    },
    lights: [
      {
        type: 'ambient',
        intensity: 0.4,
      },
      {
        type: 'directional',
        position: [5, 10, 5],
        intensity: 1,
        castShadow: true,
      },
    ],
    objects: [
      // Ground
      {
        type: 'box',
        position: [0, -5, 0],
        scale: [20, 1, 20],
        material: {
          type: 'standard',
          color: '#808080',
          roughness: 0.8,
        },
                 physics: {
           type: 'fixed',
           restitution: 0.7,
           friction: 0.8,
           colliders: [{ type: 'cuboid' as const, args: [10, 0.5, 10] }]
         },
        receiveShadow: true,
      },
      // Falling boxes
      ...Array.from({ length: 8 }).map((_, i) => ({
        type: 'box' as const,
        position: [
          Math.sin(i * 0.8) * 3,
          5 + i * 2,
          Math.cos(i * 0.8) * 3
        ] as [number, number, number],
        scale: 0.8 + Math.random() * 0.4,
        material: {
          type: 'physical' as const,
          color: `hsl(${i * 45}, 70%, 60%)`,
          metalness: 0.1,
          roughness: 0.2,
          clearcoat: 0.8,
          clearcoatRoughness: 0.1,
        },
                 physics: {
           type: 'dynamic' as const,
           mass: 1,
           restitution: 0.6,
           friction: 0.4,
           colliders: [{ type: 'cuboid' as const, args: [0.4, 0.4, 0.4] }]
         },
        castShadow: true,
        receiveShadow: true,
      }))
    ],
    shadows: {
      type: 'soft',
      size: 25,
      focus: 0,
      samples: 10,
    },
    postProcessing: {
      n8ao: {
        enabled: true,
        aoRadius: 1,
        intensity: 1,
      },
    },
  },

  colorfulSpheres: {
    name: 'Colorful Spheres',
    description: 'Multiple spheres with different materials and colors',
    camera: {
      position: [0, 0, 10],
      fov: 75,
      controls: {
        type: 'orbit',
        autoRotate: true,
        autoRotateSpeed: 1,
        enableDamping: true,
      }
    },
    environment: {
      type: 'color',
      background: '#1a1a2e',
    },
    lights: [
      {
        type: 'ambient',
        color: '#ffffff',
        intensity: 0.3,
      },
      {
        type: 'point',
        position: [0, 0, 0],
        color: '#ffffff',
        intensity: 1,
      },
    ],
    objects: [
      {
        type: 'sphere',
        position: [0, 0, 0],
        scale: 0.8,
        material: {
          type: 'standard',
          color: '#ff6b35',
          metalness: 0.8,
          roughness: 0.2,
        },
      },
      {
        type: 'sphere',
        position: [3, 0, 0],
        scale: 0.6,
        material: {
          type: 'transmission',
          color: '#4ecdc4',
          transmission: 0.8,
          thickness: 0.3,
          roughness: 0.1,
        },
      },
      {
        type: 'sphere',
        position: [-3, 0, 0],
        scale: 0.6,
        material: {
          type: 'physical',
          color: '#45b7d1',
          metalness: 0.9,
          roughness: 0.1,
          clearcoat: 1,
          clearcoatRoughness: 0,
        },
      },
      {
        type: 'sphere',
        position: [0, 3, 0],
        scale: 0.4,
        material: {
          type: 'standard',
          color: '#f9ca24',
          emissive: '#f9ca24',
          emissiveIntensity: 0.3,
        },
      },
      {
        type: 'sphere',
        position: [0, -3, 0],
        scale: 0.4,
        material: {
          type: 'holographic',
          color: '#6c5ce7',
          opacity: 0.7,
          holographicFrequency: 15.0,
        },
      },
    ],
    postProcessing: {
      bloom: {
        enabled: true,
        intensity: 0.8,
        luminanceThreshold: 0.3,
        radius: 0.6,
      },
    },
  },

  wavyShader: {
    name: 'Wavy Shader',
    description: 'Interactive shader with wave patterns based on mouse position',
    camera: {
      position: [0, 0, 3],
      fov: 45,
      controls: {
        type: 'orbit',
        enableZoom: false,
        enablePan: false,
      }
    },
    environment: {
      type: 'color',
      background: '#000000',
    },
    lights: [],
    objects: [
      {
        type: 'plane',
        position: [0, 0, 0],
        scale: [4, 4, 1],
        material: {
          type: 'shader',
          shaderTimeUniform: 'time',
          shaderColorUniform: 'uColor',
          color: '#ff3366',
        },
      }
    ],
  },
}; 