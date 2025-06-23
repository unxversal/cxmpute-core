'use client';

import React, { Suspense, useRef, useState, createContext, useContext } from 'react';
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
// WorkerShape interface moved to CADClientPage
interface WorkerShape {
  name?: string;
  color?: string;
  opacity?: number;
  meshData: {
    vertices: Float32Array;
    indices: Uint32Array | Uint16Array;
    normals?: Float32Array;
  };
}
import styles from '../page.module.css';
import Tooltip from './Tooltip';

// Wireframe context
const WireframeContext = createContext<boolean>(false);

interface CADViewerProps {
  shapes: WorkerShape[];
}

// Component for rendering a single CAD shape
function CADShape({ shapeData }: { shapeData: WorkerShape }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const isWireframe = useContext(WireframeContext);
  
  const geometry = React.useMemo(() => {
    const geom = new THREE.BufferGeometry();
    if (shapeData.meshData.vertices) {
      geom.setAttribute('position', new THREE.BufferAttribute(shapeData.meshData.vertices, 3));
    }
    if (shapeData.meshData.indices) {
      geom.setIndex(new THREE.BufferAttribute(shapeData.meshData.indices, 1));
    }
    if (shapeData.meshData.normals) {
      geom.setAttribute('normal', new THREE.BufferAttribute(shapeData.meshData.normals, 3));
    } else {
      geom.computeVertexNormals();
    }
    return geom;
  }, [shapeData.meshData]);
  
  const material = React.useMemo(() => {
    return new THREE.MeshPhongMaterial({
      color: new THREE.Color(shapeData.color),
      transparent: (shapeData.opacity ?? 1) < 1,
      opacity: shapeData.opacity ?? 1,
      side: THREE.DoubleSide,
      wireframe: isWireframe,
    });
  }, [shapeData.color, shapeData.opacity, isWireframe]);
        
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
function CameraController({ shapes, autoFit }: { shapes: WorkerShape[], autoFit: boolean }) {
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
function Scene({ shapes, isWireframe }: { shapes: WorkerShape[], isWireframe: boolean }) {
  return (
    <WireframeContext.Provider value={isWireframe}>
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
    </WireframeContext.Provider>
  );
}

export default function CADViewer({ shapes }: CADViewerProps) {
  const [autoFit, setAutoFit] = useState(true);
  const [isWireframe, setIsWireframe] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
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
    setIsWireframe(prev => !prev);
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
            <Scene shapes={shapes} isWireframe={isWireframe} />
            <CameraController shapes={shapes} autoFit={autoFit} />
          </Suspense>
        </Canvas>
      </div>
      
      {/* Viewer Controls */}
      <div className={styles.viewerControls}>
        <Tooltip content="Home">
          <button
            className={styles.viewerButton}
            onClick={resetView}
          >
            <Home size={16} />
          </button>
        </Tooltip>
        <Tooltip content="Fit">
          <button
            className={styles.viewerButton}
            onClick={fitToView}
          >
            <Maximize2 size={16} />
          </button>
        </Tooltip>
        <Tooltip content="Wireframe">
          <button
            className={styles.viewerButton}
            onClick={toggleWireframe}
          >
            <Grid3X3 size={16} />
          </button>
        </Tooltip>
        <Tooltip content="Screenshot">
          <button
            className={styles.viewerButton}
            onClick={captureScreenshot}
          >
            <Camera size={16} />
          </button>
        </Tooltip>
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