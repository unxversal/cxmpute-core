/* ---------------------------------------------------------
 *  src/app/c3d/cad/page.tsx
 * --------------------------------------------------------*/
"use client";

import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
  SandpackCodeEditor,
  useSandpack,
  type SandpackPreviewRef,
  SandpackConsole,
  SandpackFileExplorer
} from "@codesandbox/sandpack-react";
import { useRef, useState, useCallback, useEffect } from "react";
import { Undo2, Redo2, Download } from "lucide-react";
import styles from "./cad2.module.css";

const DEFAULT_CODE = `// Import replicad functions
import { 
  draw, 
  makeCylinder, 
  FaceFinder, 
  makeOffset 
} from 'replicad';

// Define your 3D model using ReplicaCAD
// This code will create a simple bottle

// Define parameters
const width = 50;
const height = 70;
const thickness = 30;

// Create the main shape of the bottle
const shape = draw([-width / 2, 0])
  .vLine(-thickness / 4)
  .threePointsArc(width, 0, width / 2, -thickness / 4)
  .vLine(thickness / 4)
  .closeWithMirror()
  .sketchOnPlane()
  .extrude(height)
  .fillet(thickness / 12);

// Create the neck
const neckRadius = thickness / 4;
const neckHeight = height / 10;
const neck = makeCylinder(
  neckRadius,
  neckHeight,
  [0, 0, height],
  [0, 0, 1]
);

// Fuse the neck with the bottle body
let bottle = shape.fuse(neck);

// Shell the bottle to make it hollow
bottle = bottle.shell(thickness / 50, (f) =>
  f.inPlane("XY", [0, 0, height + neckHeight])
);

// Create the thread on the neck
const neckFace = new FaceFinder()
  .containsPoint([0, neckRadius, height])
  .ofSurfaceType("CYLINDER")
  .find(bottle.clone(), { unique: true });

const bottomThreadFace = makeOffset(neckFace, -0.01 * neckRadius).faces[0];
const baseThreadSketch = draw([0.75, 0.25])
  .halfEllipse(2, 0.5, 0.1)
  .close()
  .sketchOnFace(bottomThreadFace, "bounds");

const topThreadFace = makeOffset(neckFace, 0.05 * neckRadius).faces[0];
const topThreadSketch = draw([0.75, 0.25])
  .halfEllipse(2, 0.5, 0.05)
  .close()
  .sketchOnFace(topThreadFace, "bounds");

const thread = baseThreadSketch.loftWith(topThreadSketch);

// Final model with the thread
const finalModel = bottle.fuse(thread);

// Export the model
export default finalModel;`;

export default function CADPage() {
  /** This ref is shared with the SandpackPreview so we can screenshot. */
  const previewRef = useRef<SandpackPreviewRef | null>(null);

  /* ------------------------------------------------------------------
   *  Inner component – lives INSIDE <SandpackProvider>
   * ----------------------------------------------------------------*/
  const Playground = () => {
    const { sandpack, listen } = useSandpack();
    const [prompt, setPrompt] = useState("");
    const [busy, setBusy] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const [modelHistory, setModelHistory] = useState<string[]>([DEFAULT_CODE]);
    const [historyIndex, setHistoryIndex] = useState(0);
    
    // Clean up any lingering abort controllers on unmount
    useEffect(() => {
      return () => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }, []);

    /** Capture the iframe content */
    const captureIframeContent = async (): Promise<string> => {
      if (!previewRef.current) return "";
      
      try {
        const client = await previewRef.current.getClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const iframe = (client as any).iframe as HTMLIFrameElement | undefined;
        
        if (!iframe || !iframe.contentWindow) return "";
        
        // Use the iframe's document to create a canvas
        return new Promise((resolve) => {
          // Create a message channel for secure communication with the iframe
          const channel = new MessageChannel();
          
          // Set up the listener for the response
          channel.port1.onmessage = (event) => {
            resolve(event.data || "");
            channel.port1.close();
          };
          
          // Inject a script into the iframe that will capture the content
          const script = iframe.contentDocument?.createElement('script');
          if (script) {
            script.textContent = `
              // Define a function to capture the screen
              function captureScreen() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const width = document.documentElement.clientWidth || window.innerWidth;
                const height = document.documentElement.clientHeight || window.innerHeight;
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw the current view to the canvas
                ctx.drawImage(document, 0, 0, width, height);
                
                // Return the data URL
                return canvas.toDataURL('image/png').split(',')[1];
              }
              
              // Send the captured image back via the message channel
              window.onmessage = function(event) {
                if (event.data === 'capture') {
                  try {
                    const imageData = captureScreen();
                    event.ports[0].postMessage(imageData);
                  } catch (e) {
                    event.ports[0].postMessage('');
                  }
                }
              };
            `;
            iframe.contentDocument?.head.appendChild(script);
            
            // Request the screenshot
            iframe.contentWindow?.postMessage('capture', '*', [channel.port2]);
          } else {
            resolve("");
          }
        });
      } catch (error) {
        console.error("Failed to capture iframe content:", error);
        return "";
      }
    };

    /** Download model as STL */
    const downloadModel = useCallback(async () => {
      if (!previewRef.current) return;
      
      try {
        const client = await previewRef.current.getClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const iframe = (client as any).iframe as HTMLIFrameElement | undefined;
        
        if (!iframe || !iframe.contentWindow) return;
        
        iframe.contentWindow.postMessage({ type: 'exportSTL' }, '*');
      } catch (error) {
        console.error("Failed to download model:", error);
      }
    }, []);

    /** Add download listener for STL export */
    useEffect(() => {
      if (!previewRef.current) return;
      
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'stlBlob' && event.data.blob) {
          // Create a download link for the STL file
          const blob = new Blob([event.data.blob], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'model.stl';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      };
      
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, []);

    /** Main generation loop */
    const run = useCallback(async () => {
      // If already running, abort the current operation
      if (busy) {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
          setBusy(false);
          return;
        }
      }

      if (!prompt.trim()) return;
      setBusy(true);

        /** Wait for the bundler to emit a single `"done"` message. */
        const waitForDone = () =>
            new Promise<void>((resolve) => {
            const stop = listen((msg) => {
                if (msg.type === "done") {
                stop();
                resolve();
                }
            });
            });
      
      // Create a new AbortController for this operation
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
        let code = "";
        for (let i = 0; i < 4; i++) {
          // Check if the operation was aborted
          if (signal.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }

          if (i > 0) {
            // 1️⃣ inject candidate code and wait for rebuild
            sandpack.updateFile("/model.js", code);
            await waitForDone();
          }

          // 2️⃣ take screenshot (after first render)
          let screenshot = "";
          if (i > 0) {
            screenshot = await captureIframeContent();
          }

          // 3️⃣ collect compile errors
          const compileErrors = sandpack.error ? [sandpack.error.message] : [];

          // Check again if operation was aborted before making API call
          if (signal.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }

          // 4️⃣ call OpenAI edge route
          const res = await fetch("/api/iterate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt,
              screenshotBase64: screenshot,
              compileErrors,
              iteration: i,
              cadFormat: true // Signal that we want CAD code
            }),
            signal // Pass the abort signal to the fetch call
          }).then((r) => r.json() as Promise<{ code: string; finished: boolean }>);

          code = res.code;
          if (res.finished) break;
        }

        // final candidate → editor
        sandpack.updateFile("/model.js", code);
        
        // Add to history
        setModelHistory(prev => {
          const newHistory = [...prev.slice(0, historyIndex + 1), code];
          setHistoryIndex(newHistory.length - 1);
          return newHistory;
        });
      } catch (err) {
        // Handle abort error gracefully
        if (err instanceof DOMException && err.name === "AbortError") {
          console.log("Operation was aborted");
        } else {
          console.error("Error during generation:", err);
        }
      } finally {
        setBusy(false);
        abortControllerRef.current = null;
      }
    }, [prompt, sandpack, listen, busy, historyIndex]);

    /** Handle undo */
    const handleUndo = useCallback(() => {
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        sandpack.updateFile("/model.js", modelHistory[newIndex]);
      }
    }, [historyIndex, modelHistory, sandpack]);

    /** Handle redo */
    const handleRedo = useCallback(() => {
      if (historyIndex < modelHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        sandpack.updateFile("/model.js", modelHistory[newIndex]);
      }
    }, [historyIndex, modelHistory, sandpack]);

    return (
      <>
        {/* Sandpack UI -------------------------------------------------- */}
        <SandpackLayout>
          <SandpackPreview
            ref={previewRef}
            style={{ height: "100vh", width: "50%", border: "none" }}
            showOpenInCodeSandbox={false}
          />
          <SandpackCodeEditor
            style={{ height: "100vh", width: "50%" }}
            showLineNumbers
            showTabs
            wrapContent
          />
          <SandpackConsole
            style={{ height: "100vh", width: "50%" }}
          />
          <SandpackFileExplorer
            style={{ height: "100vh", width: "50%" }}
          />
          
        </SandpackLayout>

        {/* Prompt overlay ---------------------------------------------- */}
        <div className={styles.inputContainer}>
          <input
            className={styles.input}
            value={prompt}
            disabled={busy}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the 3D model you want to create..."
          />

          <div className={styles.inputFooter}>
            <div className={styles.leftButtons}>
              <button
                className={styles.undoButton}
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                title="Undo"
              >
                <Undo2 size={16} />
              </button>
              <button
                className={styles.redoButton}
                onClick={handleRedo}
                disabled={historyIndex >= modelHistory.length - 1}
                title="Redo"
              >
                <Redo2 size={16} />
              </button>
            </div>

            <div className={styles.rightButtons}>
              <button
                className={styles.downloadButton}
                onClick={downloadModel}
                title="Download STL"
              >
                <Download size={16} /> Download STL
              </button>
              <button
                className={styles.c3dbtn}
                onClick={() => window.open("/c3d", "_blank")}
              >
                Learn more about C3D
              </button>
              <button
                className={`${styles.inputButton} ${busy ? styles.busyButton : ''}`}
                onClick={run}
                onMouseEnter={() => busy && setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
              >
                {busy 
                  ? isHovering ? "Kill" : "Generating…" 
                  : "Submit"}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  };
  /* ---------------------------  end <Playground/> ------------------- */

  return (
    <div className={styles.tt3d}>
      <SandpackProvider
        template="vite-react"
        theme="auto"
        customSetup={{
          dependencies: {
            "replicad": "0.19.0", 
            "replicad-opencascadejs": "0.19.0",
            "replicad-threejs-helper": "0.19.0",
            "three": "^0.155.0",
            "@react-three/fiber": "^8.13.6",
            "@react-three/drei": "^9.92.7",
            "comlink": "^4.3.1",
            "file-saver": "^2.0.5"
          }
        }}
        files={{
          "/model.js": DEFAULT_CODE,
          "/worker.js": {
            code: `
import opencascade from "replicad-opencascadejs";
import { setOC } from "replicad";
import { expose } from "comlink";

// Dynamically import the model
let modelModule = null;

// This is the logic to load the web assembly code into replicad
let loaded = false;
const init = async () => {
  if (loaded) return Promise.resolve(true);

  console.log("Initializing OpenCascade in worker...");
  
  try {
    const OC = await opencascade();
    loaded = true;
    setOC(OC);
    console.log("OpenCascade initialized successfully in worker");
    return true;
  } catch (error) {
    console.error("Failed to initialize OpenCascade in worker:", error);
    return false;
  }
};

// Start initialization immediately
const started = init();

async function updateModel(moduleUrl) {
  await started;
  
  // Create a dynamic module from the code
  try {
    // Clean up previous model if exists
    modelModule = null;
    
    // Create a blob URL from the code
    // const blob = new Blob([code], { type: 'application/javascript' });
    // const url = URL.createObjectURL(blob);
    
    // Import the dynamic module
    modelModule = await import(/* @vite-ignore */ \`\${moduleUrl}?t=\${Date.now()}\`);
    
    // Clean up
    // URL.revokeObjectURL(url);
    
    return { success: true };
  } catch (error) {
    console.error("Error updating model:", error);
    return { success: false, error: error.message };
  }
}

async function createMesh() {
  await started;
  
  try {
    if (!modelModule || !modelModule.default) {
      throw new Error("No model loaded");
    }
    
    const shape = modelModule.default;
    
    // Return the mesh data for three.js
    return {
      faces: shape.mesh(),
      edges: shape.meshEdges(),
      success: true
    };
  } catch (error) {
    console.error("Error creating mesh:", error);
    return { success: false, error: error.message };
  }
}

async function createSTL() {
  await started;
  
  try {
    if (!modelModule || !modelModule.default) {
      throw new Error("No model loaded");
    }
    
    const shape = modelModule.default;
    
    // Return the STL blob
    return {
      blob: shape.blobSTL(),
      success: true
    };
  } catch (error) {
    console.error("Error creating STL:", error);
    return { success: false, error: error.message };
  }
}

// Expose these functions to the main thread via comlink
expose({ updateModel, createMesh, createSTL });
`,
            hidden: false
          },
          "/App.jsx": {
            code: `
import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { syncFaces, syncLines } from 'replicad-threejs-helper';
import { wrap } from 'comlink';

// Configure Three.js to use Z-up
THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

// Import our worker (this needs to be a separate import for Vite to work properly)
import WorkerModule from './worker.js?worker';

// Create a worker instance
const worker = wrap(new WorkerModule());

function ReplicadMesh({ modelData }) {
  const meshRef = useRef();
  const edgesRef = useRef();

  useEffect(() => {
    if (!modelData || !meshRef.current || !edgesRef.current) return;

    try {
      // Update mesh and edges using replicad-threejs-helper
      syncFaces(meshRef.current, modelData.faces);
      syncLines(edgesRef.current, modelData.edges);
    } catch (error) {
      console.error("Error syncing mesh data:", error);
    }
  }, [modelData]);

  if (!modelData) return null;

  return (
    <group>
      <mesh ref={meshRef}>
        <meshStandardMaterial 
          color="#5a8296" 
          roughness={0.3}
          metalness={0.2}
          polygonOffset 
          polygonOffsetFactor={2.0} 
          polygonOffsetUnits={1.0} 
        />
      </mesh>
      <lineSegments ref={edgesRef}>
        <lineBasicMaterial color="#3c5a6e" />
      </lineSegments>
    </group>
  );
}

function Scene() {
  const [modelData, setModelData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Process the model when it changes
  useEffect(() => {
    let isMounted = true;
    
    async function loadModel() {
      setLoading(true);
      setError(null);
      
      try {
        // Get the model code
        const modelUrl = new URL('./model.js', import.meta.url).href;

        
        // Update the worker with the new model code
        const updateResult = await worker.updateModel(modelUrl);
        
        if (!updateResult.success) {
          throw new Error(\`Failed to update model: \${updateResult.error}\`);
        }
        
        // Get the mesh data
        const meshResult = await worker.createMesh();
        
        if (!meshResult.success) {
          throw new Error(\`Failed to create mesh: \${meshResult.error}\`);
        }
        
        if (isMounted) {
          setModelData({ faces: meshResult.faces, edges: meshResult.edges });
          setError(null);
        }
      } catch (error) {
        console.error("Error loading model:", error);
        if (isMounted) {
          setError(error.message || "Unknown error");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    
    loadModel();
    
    return () => {
      isMounted = false;
    };
  }, []);
  
  // Listen for export requests
  useEffect(() => {
    const handleMessage = async (event) => {
      if (event.data?.type === 'exportSTL') {
        try {
          const result = await worker.createSTL();
          
          if (result.success && result.blob) {
            window.parent.postMessage({ type: 'stlBlob', blob: result.blob }, '*');
          } else {
            console.error("Error exporting STL:", result.error);
          }
        } catch (error) {
          console.error("Failed to export STL:", error);
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (loading) {
    return (
      <div style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        color: 'white',
        background: '#1e1e1e',
        flexDirection: 'column'
      }}>
        <div style={{ marginBottom: '10px' }}>Loading...</div>
        <div style={{ 
          width: '100px',
          height: '2px',
          background: '#333',
          borderRadius: '2px',
          overflow: 'hidden',
        }}>
          <div style={{ 
            width: '30%',
            height: '100%',
            background: '#5a8296',
            animation: 'loading 1.5s infinite',
          }}></div>
        </div>
        <style>{
          \`@keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(300%); }
          }\`
        }</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center',
        color: '#ff5555',
        background: '#1e1e1e',
        padding: '20px',
        textAlign: 'center' 
      }}>
        <h3>Error Loading Model</h3>
        <pre style={{ 
          maxWidth: '100%', 
          overflow: 'auto',
          background: '#2a2a2a',
          padding: '10px',
          borderRadius: '4px'
        }}>{error}</pre>
      </div>
    );
  }

  return (
    <Canvas
      camera={{ position: [100, 100, 100], fov: 50 }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[100, 100, 100]} intensity={0.8} />
      <gridHelper args={[100, 10]} />
      <axesHelper args={[50]} />
      <OrbitControls enableDamping dampingFactor={0.25} />
      <Environment preset="city" />
      <ReplicadMesh modelData={modelData} />
    </Canvas>
  );
}

export default function App() {
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <Scene />
    </div>
  );
}
`,
          },
          "/index.jsx": {
            code: `
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Create root and render app
const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
`,
            hidden: true
          },
          "/index.css": {
            code: `
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: #1e1e1e;
  color: #f5f5f5;
  overflow: hidden;
}

html, body, #root {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

canvas {
  touch-action: none;
}
`,
            hidden: true
          },
          "/index.html": {
            code: `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ReplicaCAD Viewer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/index.jsx"></script>
  </body>
</html>
`,
            hidden: true
          },
          "/vite.config.js": {
            code: `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: ['replicad-opencascadejs']
  },
  worker: {
    format: 'es'
  }
});
`,
            hidden: true
          },
        }}
        options={{
          externalResources: ["https://cdn.tailwindcss.com"]
        }}
      >
        <Playground />
      </SandpackProvider>
    </div>
  );
}