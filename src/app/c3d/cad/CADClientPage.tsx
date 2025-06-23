/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

// NOTE: This file contains the original implementation of the CAD page. It is imported dynamically from the server wrapper (page.tsx) with `ssr:false` so that Web Worker APIs are not evaluated during server-side rendering.

import React, { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { SandpackProvider, SandpackLayout, SandpackCodeEditor, useSandpack } from '@codesandbox/sandpack-react';
import { amethyst } from '@codesandbox/sandpack-themes';
import { MessageCircle, Send } from 'lucide-react';
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

// Chat component
function ChatInterface({ state }: { state: 'panel' | 'overlay' }) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    // TODO: Implement AI chat functionality
    console.log('Message:', message);
    setMessage('');
  };

  if (state === 'overlay') {
    return (
      <div className={styles.chatOverlay}>
        <form onSubmit={handleSubmit} className={styles.chatForm}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask the AI agent to help with your CAD design..."
            className={styles.chatTextarea}
            rows={5}
          />
          <button type="submit" className={styles.chatSubmit}>
            <Send size={16} />
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={styles.chatPanel}>
      <div className={styles.chatHeader}>
        <h3>AI Agent</h3>
      </div>
      <div className={styles.chatMessages}>
        <div className={styles.chatMessage}>
          <div className={styles.chatMessageContent}>
            Welcome! I can help you create CAD designs with code. Try asking me to create shapes, modify existing designs, or explain CAD concepts.
          </div>
        </div>
      </div>
      <form onSubmit={handleSubmit} className={styles.chatInputForm}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask me to help with your CAD design..."
          className={styles.chatInput}
          rows={2}
        />
        <button type="submit" className={styles.chatSubmitButton}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

// Component to handle code changes within Sandpack context
function CodeEditor({ onCodeChange }: { onCodeChange: (code: string) => void }) {
  const { sandpack } = useSandpack();
  
  useEffect(() => {
    const file = sandpack.files['/index.ts'];
    if (file && file.code) {
      onCodeChange(file.code);
    }
  }, [sandpack.files, onCodeChange]);

  return (
    <SandpackCodeEditor 
      showTabs={false}
      showLineNumbers={true}
      showInlineErrors={false}
      wrapContent={false}
      closableTabs={false}
      style={{ height: "100vh" }}
    />
  );
}

export default function CADClientPage() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [shapes, setShapes] = useState<WorkerShape[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [chatState, setChatState] = useState<'hidden' | 'panel' | 'overlay'>('hidden');

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

  // Execute current code
  const executeCode = useCallback(async () => {
    if (isExecuting || !isInitialized) return;

    setIsExecuting(true);
    setError(null);
    const toastId = toast.loading('Generating shapes...', {
      description: 'Creating 3D models with replicad.',
    });

    try {
      // For now, execute the default example (user code execution requires eval)
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
      executeCode();
    }
  }, [isInitialized, executeCode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        if (isInitialized) {
          executeCode();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInitialized, executeCode]);

  // Set up global function for AI agents
  useEffect(() => {
    window.setCADCode = (newCode: string) => {
      setCode(newCode);
      if (isInitialized) {
        executeCode();
      }
    };

    return () => {
      delete window.setCADCode;
    };
  }, [isInitialized, executeCode]);

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

  const toggleChat = () => {
    setChatState(prev => {
      if (prev === 'hidden') return 'panel';
      if (prev === 'panel') return 'overlay';
      return 'hidden';
    });
  };

  return (
    <div className={styles.pageContainer}>
      <header className={styles.header}>
        <h1 className={styles.title}>C3D CAD</h1>
        <p className={styles.subtitle}>An agentic, code-first CAD editor.</p>
      </header>

      <div className={styles.mainContent}>
        {/* Left Panel - 3D Viewer */}
        <div className={styles.leftPanel}>
          {error ? (
            <ErrorDisplay error={error} onClose={() => setError(null)} />
          ) : (
            <CADViewer shapes={shapes} />
          )}
        </div>

        {/* Middle Panel - Code Editor with Sandpack */}
        <div className={`${styles.rightPanel} ${chatState === 'panel' ? styles.withChatPanel : ''}`}>
          <div className={styles.editorHeader}>
            <div className={styles.editorHeaderLeft}>
              <button
                className={styles.runButton}
                onClick={executeCode}
                disabled={isExecuting}
              >
                ▶ {isExecuting ? 'Running...' : 'Run'}
              </button>
              <span className={styles.shortcutHint}>⌘ + Enter</span>
            </div>
            <div className={styles.editorHeaderRight}>
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
              <button
                className={styles.aiButton}
                onClick={toggleChat}
                title={`AI Agent (${chatState})`}
              >
                <MessageCircle size={16} />
              </button>
            </div>
          </div>

          <div className={styles.sandpackContainer}>
            <SandpackProvider
              template="vanilla-ts"
              theme={amethyst}
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
                <CodeEditor onCodeChange={setCode} />
              </SandpackLayout>
            </SandpackProvider>
          </div>
          
          {/* Chat overlay - on top of code editor */}
          {chatState === 'overlay' && <ChatInterface state="overlay" />}
        </div>

        {/* Right Panel - Chat (when in panel mode) */}
        {chatState === 'panel' && <ChatInterface state="panel" />}
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