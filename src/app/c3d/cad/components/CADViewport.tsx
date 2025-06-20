'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import { useAtom } from 'jotai';
import { Suspense, useRef } from 'react';
import * as THREE from 'three';
import { visibleObjectsAtom, viewportSettingsAtom } from '../stores/cadStore';
import { CADObject } from '../types/cad';
import { useTheme } from '../hooks/useTheme';
import styles from './CADViewport.module.css';

// Component to render a single CAD object
function CADMesh({ cadObject }: { cadObject: CADObject }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  if (!cadObject.solid && !cadObject.sketch) {
    return null;
  }

  // Render geometry based on available mesh data or fallback to simple geometries
  const renderGeometry = () => {
    const { properties } = cadObject;
    const dims = properties.dimensions;
    
    // If we have mesh data from replicad, use it
    if (cadObject.mesh?.vertices && cadObject.mesh?.indices) {
      return (
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={cadObject.mesh.vertices.length / 3}
            array={cadObject.mesh.vertices}
            itemSize={3}
          />
          <bufferAttribute
            attach="index"
            array={cadObject.mesh.indices}
          />
          {cadObject.mesh.normals && (
            <bufferAttribute
              attach="attributes-normal"
              count={cadObject.mesh.normals.length / 3}
              array={cadObject.mesh.normals}
              itemSize={3}
            />
          )}
        </bufferGeometry>
      );
    }
    
    // Fallback to simple geometries based on type and dimensions
    switch (cadObject.type) {
      case 'solid':
        if (dims?.radius && dims?.height) {
          // Cylinder
          return <cylinderGeometry args={[dims.radius, dims.radius, dims.height, 32]} />;
        } else if (dims?.radius && !dims?.height) {
          // Sphere
          return <sphereGeometry args={[dims.radius, 32, 16]} />;
        } else {
          // Box
          return (
            <boxGeometry 
              args={[
                dims?.width || dims?.length || 1, 
                dims?.height || 1, 
                dims?.depth || dims?.width || 1
              ]} 
            />
          );
        }
      default:
        return <boxGeometry args={[1, 1, 1]} />;
    }
  };

  return (
    <mesh
      ref={meshRef}
      position={cadObject.properties.position}
      rotation={cadObject.properties.rotation}
      scale={cadObject.properties.scale}
      visible={cadObject.visible}
      castShadow
      receiveShadow
    >
      {renderGeometry()}
      <meshStandardMaterial 
        color={cadObject.properties.color}
        transparent={cadObject.properties.opacity < 1}
        opacity={cadObject.properties.opacity}
        roughness={0.3}
        metalness={0.1}
      />
    </mesh>
  );
}

// Grid component
function CADGrid() {
  const [viewportSettings] = useAtom(viewportSettingsAtom);
  
  if (!viewportSettings.grid.visible) {
    return null;
  }

  return (
    <Grid
      args={[viewportSettings.grid.size, viewportSettings.grid.divisions]}
      cellSize={viewportSettings.grid.size / viewportSettings.grid.divisions}
      cellThickness={0.5}
      cellColor="#6f6f6f"
      sectionSize={viewportSettings.grid.size}
      sectionThickness={1}
      sectionColor="#9d4b4b"
      fadeDistance={100}
      fadeStrength={1}
      followCamera
      infiniteGrid
    />
  );
}

// Scene component
function CADScene() {
  const [visibleObjects] = useAtom(visibleObjectsAtom);
  
  return (
    <group>
      {visibleObjects.map((obj) => (
        <CADMesh key={obj.id} cadObject={obj} />
      ))}
    </group>
  );
}

// Camera setup
function CameraSetup() {
  const [viewportSettings] = useAtom(viewportSettingsAtom);
  
  return (
    <OrbitControls
      target={viewportSettings.camera.target}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      minDistance={0.1}
      maxDistance={1000}
      enableDamping={true}
      dampingFactor={0.05}
    />
  );
}

// Lighting setup
function Lighting() {
  const [viewportSettings] = useAtom(viewportSettingsAtom);
  
  return (
    <>
      <ambientLight intensity={viewportSettings.lighting.ambient} />
      <directionalLight
        position={viewportSettings.lighting.directional.position}
        intensity={viewportSettings.lighting.directional.intensity}
        castShadow
      />
      <pointLight position={[10, 10, 10]} intensity={0.3} />
    </>
  );
}

export default function CADViewport() {
  const [viewportSettings] = useAtom(viewportSettingsAtom);
  const { theme } = useTheme();

  return (
    <div className={styles.container} data-theme={theme}>
      <Canvas
        camera={{
          position: viewportSettings.camera.position,
          fov: viewportSettings.camera.fov,
        }}
        shadows
        gl={{ antialias: true }}
        className={styles.canvas}
      >
        <Suspense fallback={null}>
          <CameraSetup />
          <Lighting />
          <CADGrid />
          <CADScene />
          <Environment preset="studio" />
        </Suspense>
      </Canvas>

      {/* Viewport Controls */}
      <div className={styles.info}>
        <div>View: Perspective</div>
        <div>Mode: Select</div>
      </div>

      {/* Coordinate System */}
      <div className={styles.gridToggle}>
        <span style={{ color: '#ef4444' }}>X</span>
        <span style={{ color: '#22c55e' }}>Y</span>
        <span style={{ color: '#3b82f6' }}>Z</span>
      </div>
    </div>
  );
} 