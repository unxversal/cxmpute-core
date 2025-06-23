'use client';

// NOTE: This file contains the original implementation of the CAD page. It is imported dynamically from the server wrapper (page.tsx) with `ssr:false` so that Web Worker APIs are not evaluated during server-side rendering.

import React, { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { SandpackProvider, SandpackLayout, SandpackCodeEditor } from '@codesandbox/sandpack-react';
import styles from './page.module.css';

// Components
import ErrorDisplay from './components/ErrorDisplay';
import CADViewer from './components/CADViewer';

// Convert CADShape to WorkerShape format for compatibility
export interface WorkerShape {
  name?: string;
  color?: string;
  opacity?: number;
  meshData: {
    vertices: Float32Array;
    indices: Uint32Array | Uint16Array;
    normals?: Float32Array;
  };
}

// Default example code showing replicad-threejs-helper usage
const DEFAULT_CODE = `// Migrated to replicad-threejs-helper - No CSP Issues!
// This code demonstrates the proper way to use replicad with Three.js

import { drawCircle, drawRoundedRectangle } from 'replicad';
import { syncGeometries } from 'replicad-threejs-helper';

// Example 1: Simple cylinder
const cylinder = drawCircle(20).sketchOnPlane().extrude(50);

// Example 2: Rounded rectangle
const roundedRect = drawRoundedRectangle(40, 30, 5)
  .sketchOnPlane()
  .extrude(10);

// Create meshed shapes for replicad-threejs-helper
const meshedShapes = [
  {
    name: 'Cylinder',
    faces: cylinder.mesh({ tolerance: 0.05, angularTolerance: 30 }),
    edges: cylinder.meshEdges({ keepMesh: true }),
  },
  {
    name: 'Rounded Rectangle',
    faces: roundedRect.mesh({ tolerance: 0.05, angularTolerance: 30 }),
    edges: roundedRect.meshEdges({ keepMesh: true }),
  }
];

// Use replicad-threejs-helper to convert to Three.js BufferGeometry
// This approach avoids CSP issues entirely
const geometries = syncGeometries(meshedShapes, []);

// Export for use in Three.js scene
export { geometries };`;

export default function CADClientPage() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [shapes, setShapes] = useState<WorkerShape[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

    // Initialize OpenCascade once
  useEffect(() => {
    const initializeOpenCascade = async () => {
      if (isInitialized) return;

      try {
        console.log('Initializing OpenCascade...');
        
        const replicad = await import('replicad');
        const opencascadeModule = await import('replicad-opencascadejs');
        
        const opencascade = opencascadeModule.default;
        // @ts-expect-error - opencascade types are outdated
        const OC = await opencascade({
          locateFile: (file: string) => {
            console.log('OpenCascade requesting file:', file);
            if (file.endsWith('.wasm')) {
              return '/replicad_single.wasm';
            }
            return file;
          }
        });
        
        console.log('OpenCascade loaded, setting OC...');
        replicad.setOC(OC);
        console.log('OpenCascade setup complete');
        
        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to initialize OpenCascade:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize OpenCascade');
      }
    };

    initializeOpenCascade();
  }, [isInitialized]);

  // Execute example code
  const executeExampleCode = useCallback(async () => {
    if (isExecuting || !isInitialized) return;

    setIsExecuting(true);
    setError(null);
    const toastId = toast.loading('Generating shapes...', {
      description: 'Creating 3D models with replicad.',
    });

    try {
      // Import replicad and helper
      const replicad = await import('replicad');
      const { syncGeometries } = await import('replicad-threejs-helper');

      // Create shapes using replicad
      const cylinder = replicad.drawCircle(20).sketchOnPlane().extrude(50);
      const roundedRect = replicad.drawRoundedRectangle(40, 30, 5)
        .sketchOnPlane()
        .extrude(10);

      // Mesh the shapes
      const meshedShapes = [
        {
          name: 'Cylinder',
          faces: cylinder.mesh({ tolerance: 0.05, angularTolerance: 30 }),
          edges: cylinder.meshEdges(),
        },
        {
          name: 'Rounded Rectangle',
          faces: roundedRect.mesh({ tolerance: 0.05, angularTolerance: 30 }),
          edges: roundedRect.meshEdges(),
        }
      ];

      // Use replicad-threejs-helper to create Three.js geometries
      const geometries = syncGeometries(meshedShapes, []);

       // Convert to WorkerShape format for the viewer
       const workerShapes: WorkerShape[] = geometries.map((geom: any, index: number) => {
        const faces = geom.faces;
        const vertices = faces.attributes.position.array as Float32Array;
        const indices = faces.index?.array as Uint32Array | Uint16Array;
        const normals = faces.attributes.normal?.array as Float32Array;

        return {
          name: meshedShapes[index]?.name || `Shape ${index + 1}`,
          color: index === 0 ? '#667eea' : '#f093fb',
          opacity: 1,
          meshData: {
            vertices,
            indices: indices || new Uint32Array(),
            normals
          }
        };
      });

      setShapes(workerShapes);
      toast.success('Shapes generated successfully!', {
        id: toastId,
        description: `Generated ${workerShapes.length} shapes.`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      toast.error('Generation failed', {
        id: toastId,
        description: errorMessage.slice(0, 80) + (errorMessage.length > 80 ? '...' : ''),
      });
    } finally {
      setIsExecuting(false);
    }
  }, [isExecuting, isInitialized]);

  // Auto-execute once after initialization
  useEffect(() => {
    if (isInitialized && shapes.length === 0) {
      executeExampleCode();
    }
  }, [isInitialized]); // Only depend on isInitialized, not executeExampleCode

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        if (isInitialized) {
          executeExampleCode();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInitialized]); // Only depend on isInitialized

  // Set up global function for AI agents
  useEffect(() => {
    window.setCADCode = (newCode: string) => {
      setCode(newCode);
      if (isInitialized) {
        executeExampleCode();
      }
    };

    return () => {
      delete window.setCADCode;
    };
  }, [isInitialized]); // Only depend on isInitialized

  const handleExportSTL = useCallback(async () => {
    if (shapes.length === 0) {
      toast.error('No shapes to export');
      return;
    }
    toast.info('STL export would use replicad export functions directly');
  }, [shapes.length]);

  const handleExportSTEP = useCallback(async () => {
    if (shapes.length === 0) {
      toast.error('No shapes to export');
      return;
    }
    toast.info('STEP export would use replicad export functions directly');
  }, [shapes.length]);

  return (
    <div className={styles.pageContainer}>
      <header className={styles.header}>
        <h1 className={styles.title}>CAD Engine</h1>
        <p className={styles.subtitle}>Create 3D models with code using Replicad</p>
      </header>

      <div className={styles.mainContent}>
        {/* Left Panel - Code Editor with Sandpack */}
        <div className={styles.leftPanel}>
          <div className={styles.editorHeader}>
            <h3>Code Editor</h3>
            <div className={styles.editorControls}>
              <button
                className={styles.runButton}
                onClick={executeExampleCode}
                disabled={isExecuting}
              >
                {isExecuting ? 'Running...' : 'Run Code'}
              </button>
            </div>
          </div>

          <div className={styles.sandpackContainer}>
            <SandpackProvider
              template="vanilla-ts"
              files={{
                "/index.ts": {
                  code: code,
                },
                "/package.json": {
                  code: JSON.stringify({
                    dependencies: {
                      "replicad": "^0.19.0",
                      "replicad-threejs-helper": "^0.19.0",
                      "three": "^0.177.0"
                    }
                  }, null, 2)
                }
              }}
              options={{
                autorun: false,
              }}
            >
              <SandpackLayout>
                <SandpackCodeEditor 
                  showTabs={false}
                  showLineNumbers={true}
                  showInlineErrors={false}
                  wrapContent={false}
                  closableTabs={false}
                  readOnly={true}
                />
              </SandpackLayout>
            </SandpackProvider>
          </div>

          {/* Export Controls */}
          <div className={styles.exportControls}>
            <button
              className={styles.exportButton}
              onClick={handleExportSTL}
              disabled={shapes.length === 0}
            >
              Export STL
            </button>
            <button
              className={styles.exportButton}
              onClick={handleExportSTEP}
              disabled={shapes.length === 0}
            >
              Export STEP
            </button>
          </div>
        </div>

        {/* Right Panel - 3D Viewer */}
        <div className={styles.rightPanel}>
          <div className={styles.viewerHeader}>
            <h3>3D Preview</h3>
            <div className={styles.shapeInfo}>
              {shapes.length > 0 ? `${shapes.length} shape(s)` : 'Loading...'}
            </div>
          </div>

          {error ? (
            <ErrorDisplay error={error} onClose={() => setError(null)} />
          ) : (
            <CADViewer shapes={shapes} />
          )}
        </div>
      </div>


    </div>
  );
}

// Extend the Window interface for our global function
declare global {
  interface Window {
    setCADCode?: (code: string) => void;
  }
} 