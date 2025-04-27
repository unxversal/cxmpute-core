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
            sandpack.updateFile("/src/model.js", code);
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
        sandpack.updateFile("/src/model.js", code);
        
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
        sandpack.updateFile("/src/model.js", modelHistory[newIndex]);
      }
    }, [historyIndex, modelHistory, sandpack]);

    /** Handle redo */
    const handleRedo = useCallback(() => {
      if (historyIndex < modelHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        sandpack.updateFile("/src/model.js", modelHistory[newIndex]);
      }
    }, [historyIndex, modelHistory, sandpack]);

    return (
      <>
        {/* Sandpack UI -------------------------------------------------- */}
        <SandpackLayout
            
        >
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
            "replicad": "latest", 
            "replicad-opencascadejs": "latest",
            "replicad-threejs-helper": "latest",
            "three": "^0.161.0",
            "@react-three/fiber": "^8.0.0",
            "@react-three/drei": "^9.0.0",
          }
        
        }}
        files={{
          "/src/model.js": DEFAULT_CODE,
          "/src/App.jsx": {
            code: `
import { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { syncFaces, syncLines } from 'replicad-threejs-helper';
import opencascade from 'replicad-opencascadejs/src/replicad_single.js';
import opencascadeWasm from 'replicad-opencascadejs/src/replicad_single.wasm?url';
import { setOC } from 'replicad';

// Dynamic import of the model
import model from './model.js';

function ReplicadMesh({ modelData }) {
  const meshRef = useRef();
  const edgesRef = useRef();

  useEffect(() => {
    if (!modelData || !meshRef.current || !edgesRef.current) return;

    // Update mesh and edges using replicad-threejs-helper
    syncFaces(meshRef.current, modelData.faces);
    syncLines(edgesRef.current, modelData.edges);
  }, [modelData]);

  return (
    <group>
      <mesh ref={meshRef}>
        <meshStandardMaterial 
          color="#5a8296" 
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
  const [loaded, setLoaded] = useState(false);

  // Initialize OpenCascade
  useEffect(() => {
    async function initOpenCascade() {
      try {
        const OC = await opencascade({
          locateFile: () => opencascadeWasm
        });
        
        setOC(OC);
        setLoaded(true);
      } catch (error) {
        console.error("Failed to initialize OpenCascade:", error);
      }
    }
    
    initOpenCascade();
  }, []);

  // Process the model
  useEffect(() => {
    if (!loaded) return;
    
    try {
      const processModel = async () => {
        // Get the model
        const shape = model;
        
        // Get mesh data
        const faces = shape.mesh();
        const edges = shape.meshEdges();
        
        setModelData({ faces, edges });
        
        // Set up STL export
        window.exportSTL = () => {
          try {
            const stlBlob = shape.blobSTL();
            return stlBlob;
          } catch (error) {
            console.error("Error exporting STL:", error);
          }
        };
      };
      
      processModel();
    } catch (error) {
      console.error("Error processing model:", error);
    }
  }, [loaded]);

  // Listen for export requests
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data.type === 'exportSTL') {
        const stlBlob = window.exportSTL?.();
        if (stlBlob) {
          window.parent.postMessage({ type: 'stlBlob', blob: stlBlob }, '*');
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Default camera position
  const defaultCameraPosition = [100, 100, 100];

  return (
    <Canvas
      camera={{ position: defaultCameraPosition, fov: 50 }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[100, 100, 100]} intensity={0.8} />
      <gridHelper args={[100, 10]} rotation={[Math.PI/2, 0, 0]} />
      <axesHelper args={[50]} />
      <OrbitControls enableDamping dampingFactor={0.25} />
      {modelData ? <ReplicadMesh modelData={modelData} /> : null}
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
            hidden: false
          },
          "/src/index.jsx": {
            code: `
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
`,
            hidden: true
          },
          "/src/index.css": {
            code: `
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
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
    <script type="module" src="/src/index.jsx"></script>
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
  }
});
`,
            hidden: true
          },
        }}
      >
        <Playground />
      </SandpackProvider>
    </div>
  );
}