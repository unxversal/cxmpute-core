'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
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

    // Mount the renderer to the DOM
    mountRef.current.appendChild(renderer.domElement);

    // Controls setup
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.enablePan = true;
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

    // Animation loop
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      if (controlsRef.current) {
        controlsRef.current.update();
      }
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
      
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
      
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

  // Convert Replicad shapes to Three.js geometries
  const createMeshFromShape = (shape: unknown): THREE.BufferGeometry => {
    // Extract mesh data from Replicad shape
    // This is a simplified implementation - in a real app,
    // you would use Replicad's mesh conversion functions
    try {
      // If shape has a mesh property with vertices and faces
      const shapeWithMesh = shape as { mesh?: { vertices?: number[][]; faces?: number[][] } };
      if (shapeWithMesh.mesh) {
        const geometry = new THREE.BufferGeometry();
        
        // Set vertices
        if (Array.isArray(shapeWithMesh.mesh.vertices)) {
          const vertices = new Float32Array(shapeWithMesh.mesh.vertices.flat());
          geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        }
        
        // Set faces
        if (Array.isArray(shapeWithMesh.mesh.faces)) {
          const indices = new Uint32Array(shapeWithMesh.mesh.faces.flat());
          geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        }
        
        // Calculate normals if they're not provided
        geometry.computeVertexNormals();
        
        return geometry;
      }
      
      // If shape has triangulation data
      const shapeWithTriangulation = shape as { 
        triangulation?: { 
          vertices?: number[][];
          triangles?: number[][] 
        } 
      };
      
      if (shapeWithTriangulation.triangulation) {
        const geometry = new THREE.BufferGeometry();
        
        // Set vertices
        if (Array.isArray(shapeWithTriangulation.triangulation.vertices)) {
          const vertices = new Float32Array(shapeWithTriangulation.triangulation.vertices.flat());
          geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        }
        
        // Set faces
        if (Array.isArray(shapeWithTriangulation.triangulation.triangles)) {
          const indices = new Uint32Array(shapeWithTriangulation.triangulation.triangles.flat());
          geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        }
        
        // Calculate normals
        geometry.computeVertexNormals();
        
        return geometry;
      }

      // Fallback to checking if shape is a Three.js geometry or has a toThreeGeometry method
      if (shape instanceof THREE.BufferGeometry) {
        return shape;
      }
      
      const shapeWithMethod = shape as { toThreeGeometry?: () => THREE.BufferGeometry };
      if (typeof shapeWithMethod.toThreeGeometry === 'function') {
        return shapeWithMethod.toThreeGeometry();
      }
      
      // If no conversion method works, return a simple box as fallback
      console.warn('Could not convert shape to Three.js geometry, using fallback box', shape);
      return new THREE.BoxGeometry(10, 10, 10);
    } catch (error) {
      console.error('Error converting shape to Three.js geometry:', error);
      return new THREE.BoxGeometry(10, 10, 10);
    }
  };

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
    shapes.forEach((shapeItem) => {
      try {
        // Get color and opacity from shape if available
        const shapeData = shapeItem as ShapeData;
        const color = shapeData.color ? new THREE.Color(shapeData.color) : new THREE.Color(0x8844ff);
        const opacity = typeof shapeData.opacity === 'number' ? shapeData.opacity : 0.8;
        const isTransparent = opacity < 1;
        
        // Get the actual shape object
        const actualShape = shapeData.shape || shapeItem;
        
        // Create geometry from shape
        const geometry = createMeshFromShape(actualShape);
        
        // Create material
        const material = new THREE.MeshPhongMaterial({ 
          color: color,
          transparent: isTransparent,
          opacity: opacity,
          side: THREE.DoubleSide,
          flatShading: false,
        });
        
        // Create mesh
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.isCADShape = true;
        
        // Add to scene
        sceneRef.current?.add(mesh);
      } catch (error) {
        console.error('Error adding shape to scene:', error);
      }
    });

    // Call fitToView to focus on the new shapes
    if (shapes.length > 0) {
      fitToView();
    }
  }, [shapes, isInitialized]);

  // Control functions
  const resetView = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    
    cameraRef.current.position.set(50, 50, 50);
    cameraRef.current.lookAt(0, 0, 0);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
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
        const material = child.material as THREE.Material;
        if ('wireframe' in material) {
          material.wireframe = !material.wireframe;
        }
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
          Home
        </button>
        <button
          className={styles.viewerButton}
          onClick={fitToView}
          title="Fit all shapes in view"
        >
          Fit
        </button>
        <button
          className={styles.viewerButton}
          onClick={toggleWireframe}
          title="Toggle wireframe mode"
        >
          Wireframe
        </button>
        <button
          className={styles.viewerButton}
          onClick={captureScreenshot}
          title="Take screenshot"
        >
          Screenshot
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