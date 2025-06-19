"use client"

import Button from "@/components/button/button";
import styles from "./three.module.css";
import { RenderScene } from "@/components/three/CanvasRenderer";
import { useState, useRef } from "react";
import { SceneProvider } from "@/components/three/context/SceneContext";

type Vector3 = [number, number, number];
type ObjectType = 'box' | 'sphere' | 'torus' | 'cylinder' | 'cone' | 'text';
type AnimationType = 'rotate' | 'bounce' | 'wave' | 'none' | 'physics';

interface BaseObject {
  position: Vector3;
  color: string;
  metalness?: number;
  roughness?: number;
  scale?: number;
  animation?: AnimationType;
  animationSpeed?: number;
  interactive?: boolean;
  mass?: number;
  emissive?: string;
  emissiveIntensity?: number;
}

interface TextObject extends BaseObject {
  type: 'text';
  text: string;
}

interface PhysicsObject extends BaseObject {
  type: 'sphere' | 'box';
  animation: 'physics';
  mass: number;
  interactive: boolean;
}

interface RegularObject extends BaseObject {
  type: ObjectType;
}

type SceneObject = TextObject | PhysicsObject | RegularObject;

export default function ThreePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sceneConfig, setSceneConfig] = useState({
    objects: [
      // Interactive floating text
      {
        type: 'text' as const,
        position: [0, 1, -2] as Vector3,
        color: '#ff6b6b',
        text: 'Click objects to score!',
        animation: 'bounce' as AnimationType,
        animationSpeed: 0.5,
        metalness: 0.8,
        roughness: 0.2,
        emissive: '#ff6b6b',
        emissiveIntensity: 0.5
      },
      // Physics-enabled bouncing spheres
      {
        type: 'sphere' as const,
        position: [-2, 5, 0] as Vector3,
        color: '#4ecdc4',
        scale: 0.75,
        animation: 'physics' as AnimationType,
        metalness: 0.8,
        roughness: 0.2,
        interactive: true,
        mass: 1
      },
      {
        type: 'sphere' as const,
        position: [2, 5, 0] as Vector3,
        color: '#ffe66d',
        scale: 0.75,
        animation: 'physics' as AnimationType,
        metalness: 0.8,
        roughness: 0.2,
        interactive: true,
        mass: 1
      },
      // Rotating torus in the center
      {
        type: 'torus' as const,
        position: [0, 0, 0] as Vector3,
        color: '#ff9f43',
        scale: 1,
        animation: 'rotate' as AnimationType,
        animationSpeed: 1,
        metalness: 0.5,
        roughness: 0.5,
        interactive: true,
        emissive: '#ff9f43',
        emissiveIntensity: 0.2
      }
    ] as SceneObject[],
    lights: [
      {
        type: 'point' as const,
        position: [5, 5, 5] as Vector3,
        color: '#ffffff',
        intensity: 1,
        castShadow: true
      },
      {
        type: 'spot' as const,
        position: [-5, 5, 0] as Vector3,
        color: '#ff9f43',
        intensity: 0.8,
        castShadow: true
      }
    ],
    environment: 'night' as const,
    background: '#000000',
    effects: {
      bloom: true,
      stars: true
    }
  });

  const handleCapture = (blob: Blob) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      // Here you would typically send this to your AI model
      console.log('Screenshot captured:', base64data.slice(0, 50) + '...');
    };
    reader.readAsDataURL(blob);
  };

  const createPhysicsObject = (type: 'sphere' | 'box'): PhysicsObject => ({
    type,
    position: [
      Math.random() * 6 - 3,
      10,
      Math.random() * 6 - 3
    ] as Vector3,
    color: '#' + Math.floor(Math.random()*16777215).toString(16),
    scale: Math.random() * 0.5 + 0.5,
    animation: 'physics',
    metalness: Math.random(),
    roughness: Math.random(),
    interactive: true,
    mass: Math.random() * 2 + 0.5
  });

  const handleSubmit = () => {
    const prompt = inputRef.current?.value;
    if (!prompt) return;

    // Here you would:
    // 1. Send the prompt to your AI
    // 2. Get back a scene configuration
    // 3. Update the scene

    // For now, let's just add a new physics object at a random position
    const newObject = createPhysicsObject(Math.random() > 0.5 ? 'sphere' : 'box');

    setSceneConfig({
      ...sceneConfig,
      objects: [...sceneConfig.objects, newObject]
    });

    // Clear input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const resetPhysics = () => {
    const resetObjects = sceneConfig.objects.map(obj => ({
      ...obj,
      position: [obj.position[0], 5, obj.position[2]] as Vector3
    }));
    setSceneConfig({
      ...sceneConfig,
      objects: resetObjects
    });
  };

  return (
    <SceneProvider>
      <main className={styles.main}>
        <div className={styles.content}>
          <RenderScene sceneConfig={sceneConfig} onCapture={handleCapture} />
        </div>
        <div className={styles.inputContainer}>
          <div className={styles.input}>
            <input 
              ref={inputRef}
              placeholder="what will you generate?"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div className={styles.buttons}>
            <div className={styles.left}>
              <Button text="reset physics" onClick={resetPhysics} />
            </div>
            <div className={styles.left}>
              <Button text="generate" onClick={handleSubmit} />
            </div>
          </div>
        </div>
      </main>
    </SceneProvider>
  );
}
