/* eslint-disable @typescript-eslint/no-explicit-any */
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
  sketchPlaneAtom,
} from '../stores/cadStore';
import { CADObject, CADTool } from '../types/cad';
import { useTheme } from '../hooks/useTheme';
import styles from './CADViewport.module.css';
import { toast } from 'sonner';
import { CADUtils } from '../lib/cadUtils';

// Component to render a single CAD object
function CADMesh({ cadObject }: { cadObject: CADObject }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [selectedIds] = useAtom(selectedObjectsAtom);
  const setSelected = useSetAtom(selectedObjectsAtom);
  const updateObject = useSetAtom(updateObjectAtom);
  const setSelection = useSetAtom(selectionAtom);
  const selection = useAtomValue(selectionAtom);
  const isSelected = selectedIds.includes(cadObject.id);

  // Create the geometry from the raw mesh data
  const geometry = useMemo(() => {
    if (cadObject.mesh?.vertices && cadObject.mesh?.indices) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute(
        'position',
        new THREE.BufferAttribute(cadObject.mesh.vertices, 3)
      );
      geom.setIndex(new THREE.BufferAttribute(cadObject.mesh.indices, 1));
      
      if (cadObject.mesh.normals) {
        geom.setAttribute(
          'normal',
          new THREE.BufferAttribute(cadObject.mesh.normals, 3)
        );
      } else {
        geom.computeVertexNormals();
      }
      
      return geom;
    }
    return undefined;
  }, [cadObject.mesh]);

  const highlightGeometry = useMemo(() => {
    if (!geometry || selection?.type !== 'face' || selection.objectId !== cadObject.id) {
      return null;
    }
    const geom = geometry as THREE.BufferGeometry;
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
  }, [selection, geometry, cadObject.id]);

  const edgeHighlight = useMemo(() => {
    if (!geometry || selection?.type !== 'edge' || selection.objectId !== cadObject.id) return null;
    const geom = geometry as THREE.BufferGeometry;
    if (!geom.index) return null;
    const vKey = selection.edgeId.toString().split('_');
    if (vKey.length !== 2) return null;
    const [v1, v2] = vKey.map(Number);
    const positions = geom.getAttribute('position');
    const verts: number[] = [positions.getX(v1), positions.getY(v1), positions.getZ(v1), positions.getX(v2), positions.getY(v2), positions.getZ(v2)];
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return lineGeo;
  }, [selection, geometry, cadObject.id]);
  
  // Early return if no valid geometry could be created.
  if (!geometry) {
    return null;
  }

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
        <primitive object={geometry} attach="geometry" />
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

// Grid component – now aligns with the current sketch plane (if any)
function CADGrid() {
  const [viewportSettings] = useAtom(viewportSettingsAtom);
  const isSketching = useAtomValue(isSketchingAtom);
  const sketchPlane = useAtomValue(sketchPlaneAtom);
  const { theme } = useTheme();

  if (!viewportSettings.grid.visible) {
    return null;
  }

  // Determine grid rotation based on active sketch plane
  const rotation: [number, number, number] = (() => {
    if (isSketching && sketchPlane?.plane) {
      switch (sketchPlane.plane) {
        case 'XY':
          // Move grid from XZ (default) to XY – rotate -90° around X
          return [-Math.PI / 2, 0, 0];
        case 'YZ':
          // Rotate 90° around Z so X axis becomes Y
          return [0, 0, Math.PI / 2];
        case 'XZ':
        default:
          return [0, 0, 0];
      }
    }
    return [0, 0, 0];
  })();

  return (
    <group rotation={rotation}>
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
    </group>
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
  const sketchPlane = useAtomValue(sketchPlaneAtom);
  
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
    if (!sketchPlane || !sketchPlane.normal || !sketchPlane.center) {
      toast.warning('No active sketch plane with valid geometry.');
      return;
    }

    // 1. Get the plane's normal and a point on the plane (the center).
    const planeNormal = new THREE.Vector3().fromArray(sketchPlane.normal).normalize();
    const pointOnPlane = new THREE.Vector3().fromArray(sketchPlane.center);

    // 2. The click event gives a 3D point in world space.
    const clickPoint = event.point;

    // 3. Project the click point onto the sketch plane.
    const vectorFromPlaneToPoint = new THREE.Vector3().subVectors(clickPoint, pointOnPlane);
    const distanceFromPlane = vectorFromPlaneToPoint.dot(planeNormal);
    const projectedPoint3D = new THREE.Vector3().subVectors(clickPoint, planeNormal.clone().multiplyScalar(distanceFromPlane));
    
    // 4. To get 2D coordinates, we need a coordinate system on the plane.
    const u_axis = new THREE.Vector3();
    const v_axis = new THREE.Vector3();
    const ref_vec = Math.abs(planeNormal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    u_axis.crossVectors(planeNormal, ref_vec).normalize();
    v_axis.crossVectors(planeNormal, u_axis).normalize();

    // 5. Project the 3D point (relative to plane center) onto the U and V axes.
    const pointRelativeToCenter = new THREE.Vector3().subVectors(projectedPoint3D, pointOnPlane);
    const point2D: [number, number] = [
      pointRelativeToCenter.dot(u_axis),
      pointRelativeToCenter.dot(v_axis)
    ];
    
    // 6. Add the new 2D point to the current sketch entities.
    setSketchEntities(prev => {
      const lastEntity = prev[prev.length - 1];
      // If the last entity is a line, add a point to it.
      if (lastEntity && lastEntity.type === 'line') {
        const updatedEntity = {
          ...lastEntity,
          points: [...lastEntity.points, point2D],
        };
        return [...prev.slice(0, -1), updatedEntity];
      }
      // Otherwise, create a new line entity with this as the first point.
      const newEntity = {
        id: `line_${Date.now()}`,
        type: 'line' as const,
        points: [point2D],
        params: {}
      };
      return [...prev, newEntity];
    });

    toast.success(`Sketch point added at (${point2D[0].toFixed(1)}, ${point2D[1].toFixed(1)})`);
  };

  const createPrimitiveAtPoint = async (type: 'box' | 'cylinder' | 'sphere' | 'cone', point: THREE.Vector3) => {
    try {
      let result;
      const colors = { box: '#6366f1', cylinder: '#10b981', sphere: '#f59e0b', cone: '#8b5cf6' };
      
      // Use default dimensions for each primitive type
      switch (type) {
        case 'box':
          result = await CADUtils.createBox(2, 2, 2);
          break;
        case 'cylinder':
          result = await CADUtils.createCylinder({ radius: 1, height: 2 });
          break;
        case 'sphere':
          result = await CADUtils.createSphere({ radius: 1 });
          break;
        case 'cone':
          result = await CADUtils.createCone({ baseRadius: 1, topRadius: 0.5, height: 2 });
          break;
      }

      if (result?.success && result.shape) {
        const objectId = addObject({
          name: `${type}_${Date.now()}`,
          type: 'solid',
          mesh: result.shape.mesh, // Include the mesh data for rendering
          visible: true,
          layerId: 'default',
          properties: {
            color: colors[type],
            opacity: 1,
            material: 'default',
            position: point.toArray(),
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            dimensions: result.shape.parameters,
          },
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            creator: 'user',
            replicadId: result.shape.id,
          },
        });

        addOperation({
          type: `create_${type}`,
          params: result.shape.parameters,
          targetObjectId: objectId,
          undoable: true,
        });
      } else {
        toast.error(result?.error || `Failed to create ${type}`);
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

      {/* Sketch entities preview */}
      {isSketching && sketchEntities.length > 0 && (
        <group>
          {sketchEntities.map(entity => {
            if (entity.type === 'line' && entity.points.length > 1 && sketchPlane?.normal && sketchPlane?.center) {
              // We need to transform the 2D sketch points back to 3D on the sketch plane.
              const planeNormal = new THREE.Vector3().fromArray(sketchPlane.normal);
              const planeCenter = new THREE.Vector3().fromArray(sketchPlane.center);
              const u_axis = new THREE.Vector3();
              const v_axis = new THREE.Vector3();
              const ref_vec = Math.abs(planeNormal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
              u_axis.crossVectors(planeNormal, ref_vec).normalize();
              v_axis.crossVectors(planeNormal, u_axis).normalize();
              
              const points3D = entity.points.map(p => {
                const pointOnPlane = new THREE.Vector3();
                pointOnPlane.add(planeCenter);
                pointOnPlane.add(u_axis.clone().multiplyScalar(p[0]));
                pointOnPlane.add(v_axis.clone().multiplyScalar(p[1]));
                return pointOnPlane;
              });

              return (
                <Line
                  key={entity.id}
                  points={points3D}
                  color="#22d3ee"
                  lineWidth={2}
                />
              );
            }
            // Optionally, render points for lines with only one point
            if (entity.type === 'line' && entity.points.length === 1 && sketchPlane?.normal && sketchPlane?.center) {
              const planeNormal = new THREE.Vector3().fromArray(sketchPlane.normal);
              const planeCenter = new THREE.Vector3().fromArray(sketchPlane.center);
              const u_axis = new THREE.Vector3();
              const v_axis = new THREE.Vector3();
              const ref_vec = Math.abs(planeNormal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
              u_axis.crossVectors(planeNormal, ref_vec).normalize();
              v_axis.crossVectors(planeNormal, u_axis).normalize();
              const point3D = planeCenter.clone().add(u_axis.multiplyScalar(entity.points[0][0])).add(v_axis.multiplyScalar(entity.points[0][1]));
              return (
                <mesh key={`${entity.id}_point`} position={point3D}>
                  <sphereGeometry args={[0.05]} />
                  <meshBasicMaterial color="#22d3ee" />
                </mesh>
              );
            }
            return null;
          })}
        </group>
      )}
    </group>
  );
}

// Camera setup with modified controls
function CameraSetup() {
  const [viewportSettings] = useAtom(viewportSettingsAtom);
  const activeTool = useAtomValue(activeToolAtom);
  const isSketching = useAtomValue(isSketchingAtom);
  const sketchPlane = useAtomValue(sketchPlaneAtom);
  const controlsRef = useRef<any>(null);
  const setOrbitControlsRef = useSetAtom(orbitControlsRefAtom);

  useEffect(() => {
    if (controlsRef.current) {
      setOrbitControlsRef(controlsRef);
    }
  }, [setOrbitControlsRef]);

  // Handle sketch mode camera positioning
  useEffect(() => {
    if (isSketching && sketchPlane && controlsRef.current) {
      const controls = controlsRef.current;
      
      if (sketchPlane.type === 'reference') {
        // Position camera for reference plane sketching
        let cameraPosition: [number, number, number];
        const target: [number, number, number] = [0, 0, 0];
        
        switch (sketchPlane.plane) {
          case 'XY':
            cameraPosition = [0, 0, 10];
            break;
          case 'XZ':
            cameraPosition = [0, 10, 0];
            break;
          case 'YZ':
            cameraPosition = [10, 0, 0];
            break;
          default:
            return;
        }
        
        // Smoothly transition camera
        controls.target.set(...target);
        controls.object.position.set(...cameraPosition);
        controls.update();
        
        toast.success(`Camera positioned for ${sketchPlane.plane} plane sketching`);
      } else if (sketchPlane.type === 'face' && sketchPlane.center && sketchPlane.normal) {
        // Position camera for face sketching
        const center = sketchPlane.center;
        const normal = sketchPlane.normal;
        const distance = 10;
        
        const cameraPosition = [
          center[0] + normal[0] * distance,
          center[1] + normal[1] * distance,
          center[2] + normal[2] * distance
        ];
        
        controls.target.set(...center);
        controls.object.position.set(...cameraPosition);
        controls.update();
        
        toast.success('Camera positioned for face sketching');
      }
    }
  }, [isSketching, sketchPlane]);

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