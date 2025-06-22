'use client';

import React, { Suspense, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Html } from '@react-three/drei';
import * as THREE from 'three';
import { 
  Home, 
  Maximize2, 
  Grid3X3, 
  Camera, 
  Loader2
} from 'lucide-react';
import { convertReplicadShapeToGeometry, normalizeShapeData, type NormalizedShapeData } from '../utils/shapeConverter';
import styles from '../page.module.css';

interface ShapeData {
  shape?: unknown;
  color?: string;
  opacity?: number;
  name?: string;
}

interface CADViewerProps {
  shapes: (unknown | ShapeData)[];
}

// Component for rendering a single CAD shape
function CADShape({ shapeData }: { shapeData: NormalizedShapeData }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const geometry = React.useMemo(() => {
    return convertReplicadShapeToGeometry(shapeData.shape);
  }, [shapeData.shape]);
  
  const material = React.useMemo(() => {
    return new THREE.MeshPhongMaterial({
      color: new THREE.Color(shapeData.color),
      transparent: shapeData.opacity < 1,
      opacity: shapeData.opacity,
      side: THREE.DoubleSide,
    });
  }, [shapeData.color, shapeData.opacity]);
  
  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      castShadow
      receiveShadow
    />
  );
}

// Component for camera controls and auto-fitting
function CameraController({ shapes, autoFit }: { shapes: NormalizedShapeData[], autoFit: boolean }) {
  const { camera, scene } = useThree();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  
  const fitToView = React.useCallback(() => {
    const box = new THREE.Box3();
    
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        box.expandByObject(child);
      }
    });
    
    if (box.isEmpty()) return;
    
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    const distance = maxDim * 2;
    camera.position.set(
      center.x + distance,
      center.y + distance,
      center.z + distance
    );
    camera.lookAt(center.x, center.y, center.z);
    
    if (controlsRef.current) {
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    }
  }, [camera, scene]);
  
  React.useEffect(() => {
    if (autoFit && shapes.length > 0) {
      fitToView();
    }
  }, [shapes, autoFit, fitToView]);
  
  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={1}
      maxDistance={1000}
    />
  );
}

// Loading component
function LoadingSpinner() {
  return (
    <Html center>
      <div className={styles.loadingSpinner}>
        <Loader2 className="animate-spin" size={24} />
      </div>
    </Html>
  );
}

// Scene setup component
function Scene({ shapes }: { shapes: NormalizedShapeData[] }) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[50, 100, 50]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={500}
      />
      <directionalLight
        position={[-50, 20, -50]}
        intensity={0.2}
        color="#4444ff"
      />
      
      {/* Grid */}
      <Grid
        args={[100, 100]}
        cellSize={5}
        cellThickness={0.5}
        cellColor="#333333"
        sectionSize={20}
        sectionThickness={1}
        sectionColor="#555555"
        fadeDistance={400}
        fadeStrength={1}
        infiniteGrid
      />
      
      {/* Shapes */}
      {shapes.map((shapeData, index) => (
        <CADShape key={index} shapeData={shapeData} />
      ))}
    </>
  );
}

export default function CADViewer({ shapes }: CADViewerProps) {
  const [autoFit, setAutoFit] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Normalize shapes data
  const normalizedShapes: NormalizedShapeData[] = React.useMemo(() => {
    return shapes.map((shapeItem, index) => normalizeShapeData(shapeItem, index));
  }, [shapes]);
  
  // Control functions
  const resetView = () => {
    setAutoFit(prev => !prev); // Trigger re-fit
    setTimeout(() => setAutoFit(true), 100);
  };
  
  const captureScreenshot = () => {
    if (!canvasRef.current) return;
    
    const link = document.createElement('a');
    link.download = 'cad-model.png';
    link.href = canvasRef.current.toDataURL();
    link.click();
  };
  
  const fitToView = () => {
    setAutoFit(prev => !prev);
    setTimeout(() => setAutoFit(true), 100);
  };
  
  const toggleWireframe = () => {
    // This would need to be implemented with a context or state management
    console.log('Wireframe toggle not yet implemented');
  };
  
  return (
    <div className={styles.cadViewer}>
      <div className={styles.viewerCanvas}>
        <Canvas
          ref={canvasRef}
          camera={{ 
            position: [50, 50, 50], 
            fov: 75,
            near: 0.1,
            far: 1000
          }}
          shadows
          gl={{ 
            antialias: true, 
            alpha: true,
            preserveDrawingBuffer: true // For screenshots
          }}
        >
          <Suspense fallback={<LoadingSpinner />}>
            <Scene shapes={normalizedShapes} />
            <CameraController shapes={normalizedShapes} autoFit={autoFit} />
          </Suspense>
        </Canvas>
      </div>
      
      {/* Viewer Controls */}
      <div className={styles.viewerControls}>
        <button
          className={styles.viewerButton}
          onClick={resetView}
          title="Reset view to default position"
        >
          <Home size={16} />
          <span>Home</span>
        </button>
        <button
          className={styles.viewerButton}
          onClick={fitToView}
          title="Fit all shapes in view"
        >
          <Maximize2 size={16} />
          <span>Fit</span>
        </button>
        <button
          className={styles.viewerButton}
          onClick={toggleWireframe}
          title="Toggle wireframe mode"
        >
          <Grid3X3 size={16} />
          <span>Wireframe</span>
        </button>
        <button
          className={styles.viewerButton}
          onClick={captureScreenshot}
          title="Take screenshot"
        >
          <Camera size={16} />
          <span>Screenshot</span>
        </button>
      </div>

      {/* Info Panel */}
      {shapes.length > 0 && (
        <div className={styles.infoPanel}>
          {shapes.length} shape{shapes.length !== 1 ? 's' : ''} loaded
        </div>
      )}
    </div>
  );
} 