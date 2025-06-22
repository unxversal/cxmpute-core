'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import styles from '../page.module.css';
import { CADShape } from '../utils/cadEngine';
import { convertShapeToMesh, createGeometryFromMeshData } from '../utils/shapeConverter';

interface CADViewerProps {
  shapes: CADShape[];
  isLoading: boolean;
}

// Component to render individual CAD shapes
function CADShapeRenderer({ shape }: { shape: CADShape }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    if (!shape.shape) return;

    try {
      // Convert replicad shape to Three.js geometry
      const meshData = convertShapeToMesh(shape.shape);
      if (meshData) {
        const geo = createGeometryFromMeshData(meshData);
        setGeometry(geo);
      }
    } catch (error) {
      console.error('Failed to convert shape to geometry:', error);
    }
  }, [shape.shape]);

  if (!geometry) return null;

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial 
        color={shape.color || '#667eea'}
        transparent={shape.opacity !== undefined}
        opacity={shape.opacity || 1}
        roughness={0.3}
        metalness={0.1}
      />
    </mesh>
  );
}

// Camera controller component
function CameraController() {
  const { camera } = useThree();
  
  useEffect(() => {
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return (
    <OrbitControls
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      maxPolarAngle={Math.PI}
      minDistance={1}
      maxDistance={100}
    />
  );
}

// Scene setup component
function Scene({ shapes }: { shapes: CADShape[] }) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[10, 10, 10]} 
        intensity={0.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight 
        position={[-10, -10, -10]} 
        intensity={0.3}
      />

      {/* Grid */}
      <Grid 
        args={[50, 50]} 
        cellSize={1} 
        cellThickness={0.5} 
        cellColor="#333" 
        sectionSize={5} 
        sectionThickness={1} 
        sectionColor="#555"
        fadeDistance={30}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={true}
      />

      {/* Render shapes */}
      {shapes.map((shape, index) => (
        <CADShapeRenderer key={index} shape={shape} />
      ))}

      {/* Camera controller */}
      <CameraController />
    </>
  );
}

// Main viewer component
export function CADViewer({ shapes, isLoading }: CADViewerProps) {
  const [showWireframe, setShowWireframe] = useState(false);

  const handleResetView = () => {
    // This would reset the camera position
    window.location.reload(); // Quick reset for now
  };

  const toggleWireframe = () => {
    setShowWireframe(!showWireframe);
  };

  return (
    <div className={styles.cadViewer}>
      {/* Loading overlay */}
      {isLoading && (
        <div className={styles.viewerOverlay}>
          <div className={styles.loadingSpinner}></div>
          <p>Rendering...</p>
        </div>
      )}

      {/* Viewer controls */}
      <div className={styles.viewerControls}>
        <button 
          className={styles.viewerButton}
          onClick={handleResetView}
          title="Reset View"
        >
          🏠
        </button>
        <button 
          className={styles.viewerButton}
          onClick={toggleWireframe}
          title="Toggle Wireframe"
        >
          {showWireframe ? '🎭' : '📐'}
        </button>
      </div>

      {/* 3D Canvas */}
      <Canvas
        className={styles.viewerCanvas}
        camera={{ 
          position: [5, 5, 5],
          fov: 60,
          near: 0.1,
          far: 1000
        }}
        shadows
        gl={{ 
          antialias: true,
          alpha: false,
          preserveDrawingBuffer: true
        }}
      >
        <color attach="background" args={['#0f0f0f']} />
        <Scene shapes={shapes} />
      </Canvas>

      {/* Info panel */}
      {shapes.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '1rem',
          left: '1rem',
          background: 'rgba(26, 26, 26, 0.9)',
          padding: '0.5rem 1rem',
          borderRadius: '6px',
          color: '#e5e5e5',
          fontSize: '0.875rem'
        }}>
          {shapes.length} shape{shapes.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
} 