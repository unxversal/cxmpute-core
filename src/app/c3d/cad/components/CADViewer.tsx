'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import styles from '../page.module.css';

interface CADViewerProps {
  shapes: unknown[];
}

export default function CADViewer({ shapes }: CADViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const frameRef = useRef<number | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current || isInitialized) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(50, 50, 50);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true
    });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    // Controls setup
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI;
    controlsRef.current = controls;

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    scene.add(directionalLight);

    // Add a subtle rim light
    const rimLight = new THREE.DirectionalLight(0x4444ff, 0.2);
    rimLight.position.set(-50, 20, -50);
    scene.add(rimLight);

    // Grid helper
    const gridHelper = new THREE.GridHelper(100, 20, 0x333333, 0x222222);
    scene.add(gridHelper);

    // Axes helper
    const axesHelper = new THREE.AxesHelper(30);
    scene.add(axesHelper);

    mountRef.current.appendChild(renderer.domElement);

    // Animation loop
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    setIsInitialized(true);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      
      if (mountRef.current && renderer.domElement && mountRef.current.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
      
      controls.dispose();
      renderer.dispose();
    };
  }, [isInitialized]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;

      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update shapes
  useEffect(() => {
    if (!sceneRef.current || !isInitialized) return;

    // Clear existing shapes (but keep lights, grid, etc.)
    const objectsToRemove: THREE.Object3D[] = [];
    sceneRef.current.traverse((child) => {
      if (child.userData.isCADShape) {
        objectsToRemove.push(child);
      }
    });
    objectsToRemove.forEach((obj) => sceneRef.current?.remove(obj));

    // Add new shapes
    shapes.forEach((shape, index) => {
      // For now, create placeholder geometries
      // TODO: Replace with actual Replicad shape conversion
      const geometry = new THREE.BoxGeometry(10, 10, 10);
      const material = new THREE.MeshLambertMaterial({ 
        color: 0x8844ff,
        transparent: true,
        opacity: 0.8
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(index * 15, 0, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.isCADShape = true;
      sceneRef.current?.add(mesh);
    });
  }, [shapes, isInitialized]);

  // Control functions
  const resetView = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    
    cameraRef.current.position.set(50, 50, 50);
    cameraRef.current.lookAt(0, 0, 0);
    controlsRef.current.reset();
  };

  const fitToView = () => {
    if (!sceneRef.current || !cameraRef.current || !controlsRef.current) return;
    
    const box = new THREE.Box3();
    const meshes: THREE.Mesh[] = [];
    
    sceneRef.current.traverse((child) => {
      if (child.userData.isCADShape && child instanceof THREE.Mesh) {
        meshes.push(child);
        box.expandByObject(child);
      }
    });

    if (meshes.length === 0) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    const distance = maxDim * 2;
    cameraRef.current.position.copy(center);
    cameraRef.current.position.add(new THREE.Vector3(distance, distance, distance));
    cameraRef.current.lookAt(center);
    controlsRef.current.target.copy(center);
    controlsRef.current.update();
  };

  const toggleWireframe = () => {
    if (!sceneRef.current) return;
    
    sceneRef.current.traverse((child) => {
      if (child.userData.isCADShape && child instanceof THREE.Mesh) {
        const material = child.material as THREE.MeshLambertMaterial;
        material.wireframe = !material.wireframe;
      }
    });
  };

  const captureScreenshot = () => {
    if (!rendererRef.current) return;
    
    const link = document.createElement('a');
    link.download = 'cad-model.png';
    link.href = rendererRef.current.domElement.toDataURL();
    link.click();
  };

  return (
    <div className={styles.cadViewer}>
      <div ref={mountRef} className={styles.viewerCanvas} />
      
      {/* Viewer Controls */}
      <div className={styles.viewerControls}>
        <button
          className={styles.viewerButton}
          onClick={resetView}
          title="Reset view to default position"
        >
          🏠
        </button>
        <button
          className={styles.viewerButton}
          onClick={fitToView}
          title="Fit all shapes in view"
        >
          📐
        </button>
        <button
          className={styles.viewerButton}
          onClick={toggleWireframe}
          title="Toggle wireframe mode"
        >
          🔗
        </button>
        <button
          className={styles.viewerButton}
          onClick={captureScreenshot}
          title="Take screenshot"
        >
          📸
        </button>
      </div>

      {/* Info Panel */}
      {shapes.length > 0 && (
        <div className={styles.infoPanel}>
          {shapes.length} shape{shapes.length !== 1 ? 's' : ''} loaded
        </div>
      )}

      {/* Loading Overlay */}
      {!isInitialized && (
        <div className={styles.viewerOverlay}>
          <div className={styles.loadingSpinner} />
        </div>
      )}
    </div>
  );
} 