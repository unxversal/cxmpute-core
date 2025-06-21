'use client';

import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, Edges, TransformControls, Line } from '@react-three/drei';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import React, { Suspense, useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { ZoomIn, ZoomOut } from 'lucide-react';
import {
  visibleObjectsAtom,
  viewportSettingsAtom,
  selectedObjectsAtom,
  updateObjectAtom,
  draftSketchPointsAtom,
  activeToolAtom,
  addObjectAtom,
  addOperationAtom,
  orbitControlsRefAtom,
  selectionAtom,
  isSketchingAtom,
  currentSketchEntitiesAtom,
} from '../stores/cadStore';
import { CADObject, CADTool } from '../types/cad';
import { useTheme } from '../hooks/useTheme';
import styles from './CADViewport.module.css';
import { toast } from 'sonner';
import { cadEngine } from '../lib/cadEngine';

// Component to render a single CAD object
function CADMesh({ cadObject }: { cadObject: CADObject }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const selectedIds = useAtomValue(selectedObjectsAtom) as string[];
  const isSelected = selectedIds.includes(cadObject.id);
  const setSelected = useSetAtom(selectedObjectsAtom);
  const updateObject = useSetAtom(updateObjectAtom);
  const setSelection = useSetAtom(selectionAtom);
  const selection = useAtomValue(selectionAtom);
  const isSketching = useAtomValue(isSketchingAtom);
  const orbitControlsRef = useAtomValue(orbitControlsRefAtom);
  
  // Skip rendering if no mesh data available.
  if (!cadObject.mesh) {
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
          {/* @ts-expect-error Replicad mesh vertices are provided as raw Float32Array */}
          <bufferAttribute
            attach="attributes-position"
            count={cadObject.mesh.vertices.length / 3}
            array={cadObject.mesh.vertices}
            itemSize={3}
          />
          {/* @ts-expect-error Replicad mesh indices are provided as raw Uint32Array */}
          <bufferAttribute
            attach="index"
            array={cadObject.mesh.indices}
          />
          {cadObject.mesh.normals && (
            <>
              {/* @ts-expect-error Replicad mesh normals are provided as raw Float32Array */}
              <bufferAttribute
                attach="attributes-normal"
                count={cadObject.mesh.normals.length / 3}
                array={cadObject.mesh.normals}
                itemSize={3}
              />
            </>
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

  const highlightGeometry = useMemo(() => {
    if (!meshRef.current || selection?.type !== 'face' || selection.objectId !== cadObject.id) {
      return null;
    }
    const geom = meshRef.current.geometry as THREE.BufferGeometry;
    if (!geom.index) return null;
    const { array: indexArray } = geom.index;
    const faceIdx = selection.faceIndex;
    const vIndices = [indexArray[faceIdx * 3], indexArray[faceIdx * 3 + 1], indexArray[faceIdx * 3 + 2]];
    const positions = geom.getAttribute('position');
    const verts: number[] = [];
    vIndices.forEach((vi) => {
      verts.push(positions.getX(vi), positions.getY(vi), positions.getZ(vi));
    });
    const highlight = new THREE.BufferGeometry();
    highlight.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    highlight.setIndex([0, 1, 2]);
    return highlight;
  }, [selection, meshRef.current]);

  const edgeHighlight = useMemo(() => {
    if (!meshRef.current || selection?.type !== 'edge' || selection.objectId !== cadObject.id) return null;
    const geom = meshRef.current.geometry as THREE.BufferGeometry;
    if (!geom.index) return null;
    const vKey = selection.edgeId.toString().split('_');
    if (vKey.length !== 2) return null;
    const [v1, v2] = vKey.map(Number);
    const positions = geom.getAttribute('position');
    const verts: number[] = [positions.getX(v1), positions.getY(v1), positions.getZ(v1), positions.getX(v2), positions.getY(v2), positions.getZ(v2)];
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return lineGeo;
  }, [selection, meshRef.current]);

  useEffect(() => {
    if (isSketching && selection?.type === 'face' && orbitControlsRef) {
      // compute centroid & normal of selected face and move camera
      if (!meshRef.current) return;
      const geom = meshRef.current.geometry as THREE.BufferGeometry;
      if (!geom.index) return;
      const iArr = geom.index.array;
      const idx = selection.faceIndex;
      const vA = iArr[idx*3];
      const vB = iArr[idx*3+1];
      const vC = iArr[idx*3+2];
      const posAttr = geom.getAttribute('position');
      const a = new THREE.Vector3(posAttr.getX(vA),posAttr.getY(vA),posAttr.getZ(vA));
      const b = new THREE.Vector3(posAttr.getX(vB),posAttr.getY(vB),posAttr.getZ(vB));
      const c = new THREE.Vector3(posAttr.getX(vC),posAttr.getY(vC),posAttr.getZ(vC));
      const centroid = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1/3);
      const normal = new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).normalize();
      const camPos = centroid.clone().add(normal.multiplyScalar(10));
      if (orbitControlsRef.current) {
        orbitControlsRef.current.target.copy(centroid);
        orbitControlsRef.current.object.position.copy(camPos);
        orbitControlsRef.current.update();
      }
    }
  }, [isSketching]);

  return (
    <>
      {isSelected && meshRef.current && (
        <TransformControls
          object={meshRef.current}
          mode="translate"
          showX
          showY
          showZ
          onObjectChange={() => {
            if (!meshRef.current) return;
            const pos: [number, number, number] = [
              meshRef.current.position.x,
              meshRef.current.position.y,
              meshRef.current.position.z,
            ];
            const rot: [number, number, number] = [
              meshRef.current.rotation.x,
              meshRef.current.rotation.y,
              meshRef.current.rotation.z,
            ];
            const scl: [number, number, number] = [
              meshRef.current.scale.x,
              meshRef.current.scale.y,
              meshRef.current.scale.z,
            ];
            updateObject(cadObject.id, {
              properties: { ...cadObject.properties, position: pos, rotation: rot, scale: scl },
            });
          }}
        />
      )}
      <mesh
        ref={meshRef}
        userData={{ id: cadObject.id }}
        position={cadObject.properties.position}
        rotation={cadObject.properties.rotation}
        scale={cadObject.properties.scale}
        visible={cadObject.visible}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          if (e.shiftKey) {
            // Edge selection
            if (typeof e.faceIndex === 'number' && meshRef.current?.geometry.index) {
              const indexArr = meshRef.current.geometry.index.array;
              const faceIdx = e.faceIndex;
              const vA = indexArr[faceIdx * 3];
              const vB = indexArr[faceIdx * 3 + 1];
              // store edge
              setSelection({ type: 'edge', objectId: cadObject.id, edgeId: Number(`${Math.min(vA,vB)}_${Math.max(vA,vB)}`) });
              toast.success(`Edge selected on ${cadObject.name}`);
            }
          } else if (e.ctrlKey || e.metaKey) {
            // Face selection when modifier key held
            if (typeof e.faceIndex === 'number') {
              setSelection({ type: 'face', objectId: cadObject.id, faceIndex: e.faceIndex });
              toast.success(`Face selected on ${cadObject.name}`);
            }
          } else {
            setSelected([cadObject.id]);
            setSelection({ type: 'object', id: cadObject.id });
            toast.success(`Selected ${cadObject.name}`);
          }
        }}
      >
        {renderGeometry()}
        {isSelected && <Edges scale={1.02} threshold={15} color="#facc15" />}  {/* yellow outline */}
        <meshStandardMaterial 
          color={isSelected ? '#facc15' : cadObject.properties.color}
          transparent={cadObject.properties.opacity < 1}
          opacity={cadObject.properties.opacity}
          roughness={0.3}
          metalness={0.1}
        />
        {highlightGeometry && (
          <mesh geometry={highlightGeometry}>
            <meshStandardMaterial color="#facc15" opacity={0.6} transparent side={THREE.DoubleSide} />
          </mesh>
        )}
        {edgeHighlight && (
          <mesh geometry={edgeHighlight}>
            <meshStandardMaterial color="#facc15" opacity={0.6} transparent side={THREE.DoubleSide} />
          </mesh>
        )}
      </mesh>
    </>
  );
}

// Grid component
function CADGrid() {
  const [viewportSettings] = useAtom(viewportSettingsAtom);
  const { theme } = useTheme();
  
  if (!viewportSettings.grid.visible) {
    return null;
  }

  return (
    <Grid
      args={[viewportSettings.grid.size, viewportSettings.grid.divisions]}
      cellSize={viewportSettings.grid.size / viewportSettings.grid.divisions}
      cellThickness={0.5}
      cellColor={theme === 'dark' ? '#374151' : '#6f6f6f'}
      sectionSize={viewportSettings.grid.size}
      sectionThickness={1}
      sectionColor={theme === 'dark' ? '#3b82f6' : '#9d4b4b'}
      fadeDistance={100}
      fadeStrength={1}
      followCamera
      infiniteGrid
    />
  );
}

// Convert an array of 2-D draft points to THREE.Vector3 for preview lines
function pointsToVec3(points: { x: number; y: number; z?: number }[]): THREE.Vector3[] {
  return points.map(p => new THREE.Vector3(p.x, p.y, p.z ?? 0));
}

// Viewport overlay controls component for zoom buttons
function ViewportOverlayControls() {
  const orbitControlsRef = useAtomValue(orbitControlsRefAtom);

  const handleZoom = (factor: number) => {
    if (orbitControlsRef?.current) {
      if (factor > 1) {
        orbitControlsRef.current.dollyOut(factor);
      } else {
        orbitControlsRef.current.dollyIn(1 / factor);
      }
      orbitControlsRef.current.update();
    }
  };

  return (
    <div className={styles.viewportOverlay}>
      <button 
        onClick={() => handleZoom(0.8)} 
        title="Zoom In" 
        className={styles.controlButton}
      >
        <ZoomIn size={18} />
      </button>
      <button 
        onClick={() => handleZoom(1.2)} 
        title="Zoom Out" 
        className={styles.controlButton}
      >
        <ZoomOut size={18} />
      </button>
    </div>
  );
}

// Scene component
function CADScene() {
  const [visibleObjects] = useAtom(visibleObjectsAtom);
  const setSelected = useSetAtom(selectedObjectsAtom);
  const [draftPoints] = useAtom(draftSketchPointsAtom);
  const [activeTool, setActiveTool] = useAtom(activeToolAtom);
  const addObject = useSetAtom(addObjectAtom);
  const addOperation = useSetAtom(addOperationAtom);
  const isSketching = useAtomValue(isSketchingAtom);
  const [sketchEntities, setSketchEntities] = useAtom(currentSketchEntitiesAtom);
  const selection = useAtomValue(selectionAtom);
  
  const handleCanvasClick = async (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();

    if (isSketching) {
      await handleSketchClick(event);
      return;
    }

    const primitiveTools: CADTool[] = ['box', 'cylinder', 'sphere', 'cone'];

    if (primitiveTools.includes(activeTool)) {
      await createPrimitiveAtPoint(activeTool as 'box' | 'cylinder' | 'sphere' | 'cone', event.point);
      toast.success(`Created ${activeTool} at [${event.point.x.toFixed(1)}, ${event.point.y.toFixed(1)}, ${event.point.z.toFixed(1)}]`);
      setActiveTool('select');
    } else {
      setSelected([]);
    }
  };

  const handleSketchClick = async (event: ThreeEvent<MouseEvent>) => {
    if (!selection || selection.type !== 'face') {
      toast.warning('No face selected for sketching');
      return;
    }

    // Project 3D click point to the face plane for 2D coordinates
    const clickPoint = event.point;
    
    // For now, map to simple 2D coordinates - in production this would use the face plane transformation
    const point2D: [number, number] = [clickPoint.x, clickPoint.z];
    
    // Create a simple line point for the active sketch
    const newEntity = {
      id: `point_${Date.now()}`,
      type: 'line' as const,
      points: [point2D],
      params: {}
    };

    setSketchEntities(prev => [...prev, newEntity]);
    toast.success(`Added sketch point at (${point2D[0].toFixed(1)}, ${point2D[1].toFixed(1)})`);
  };

  const createPrimitiveAtPoint = async (type: 'box' | 'cylinder' | 'sphere' | 'cone', point: THREE.Vector3) => {
    try {
      let shape;
      // Hardcoded dimensions for now, as per original implementation
      switch (type) {
        case 'box':
          shape = await cadEngine.createBox(2, 2, 2);
          break;
        case 'cylinder':
          shape = await cadEngine.createCylinder(1, 2);
          break;
        case 'sphere':
          shape = await cadEngine.createSphere(1);
          break;
        case 'cone':
          shape = await cadEngine.createCone(1, 0.5, 2);
          break;
      }

      if (shape) {
        const objectId = addObject({
          name: `${type}_${Date.now()}`,
          type: 'solid',
          // Replicad solid kept internally by CADEngine – only mesh & params stored in UI
          visible: true,
          layerId: 'default',
          properties: {
            color: '#ffffff',
            opacity: 1,
            material: 'default',
            position: point.toArray(),
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            dimensions: shape.parameters,
          },
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            creator: 'user',
            replicadId: shape.id,
          },
        });

        addOperation({
          type: `create_${type}`,
          params: shape.parameters,
          targetObjectId: objectId,
          undoable: true,
        });
      }
    } catch (error) {
      console.error(`Failed to create ${type}:`, error);
      toast.error(`Failed to create ${type}`);
    }
  };

  return (
    <group>
      {visibleObjects.map((obj) => (
        <CADMesh key={obj.id} cadObject={obj} />
      ))}
      {/* Click empty space (large, invisible plane) to clear selection */}
      <mesh
        onClick={handleCanvasClick}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        visible={true}
      >
        <planeGeometry args={[5000, 5000]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Draft sketch preview */}
      {activeTool === 'sketch' && draftPoints.length > 0 && (
        <Line
          points={pointsToVec3(draftPoints)}
          color="#38bdf8"
          lineWidth={2}
        />
      )}
    </group>
  );
}

// Camera setup with modified controls
function CameraSetup() {
  const [viewportSettings] = useAtom(viewportSettingsAtom);
  const activeTool = useAtomValue(activeToolAtom);
  const controlsRef = useRef<any>(null);
  const setOrbitControlsRef = useSetAtom(orbitControlsRefAtom);

  useEffect(() => {
    if (controlsRef.current) {
      setOrbitControlsRef(controlsRef);
    }
  }, [setOrbitControlsRef]);

  useEffect(() => {
    const currentControls = controlsRef.current;
    if (currentControls) {
      // Default settings for all tools
      currentControls.enablePan = true;
      currentControls.enableRotate = true;
      currentControls.enableZoom = true;

      switch (activeTool) {
        case 'select':
          currentControls.mouseButtons = {
            LEFT: undefined, // Disables OrbitControls default left mouse - let TransformControls handle
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE,
          };
          currentControls.enablePan = false; // Disable pan for select mode
          break;
        case 'pan':
          currentControls.mouseButtons = {
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE,
          };
          break;
        case 'rotate':
          currentControls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          };
          break;
        case 'zoom':
          currentControls.mouseButtons = {
            LEFT: undefined,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE,
          };
          break;
        default: // For primitive creation tools (box, cylinder, etc.)
          currentControls.mouseButtons = {
            LEFT: undefined, // Let canvas click handler work for placing primitives
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE,
          };
          currentControls.enablePan = false; // Prevent accidental panning during primitive placement
          break;
      }
    }
  }, [activeTool]);
  
  return (
    <OrbitControls
      ref={controlsRef}
      target={viewportSettings.camera.target}
      enableZoom={true}
      minDistance={0.1}
      maxDistance={1000}
      enableDamping={true}
      dampingFactor={0.05}
      keys={{
        LEFT: 'ArrowLeft',
        UP: 'ArrowUp', 
        RIGHT: 'ArrowRight',
        BOTTOM: 'ArrowDown'
      }}
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

      {/* Zoom Controls */}
      <ViewportOverlayControls />

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