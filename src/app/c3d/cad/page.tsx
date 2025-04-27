/* ---------------------------------------------------------
 *  src/app/c3d/cad/page.tsx  – working version
 * --------------------------------------------------------*/
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
  SandpackCodeEditor,
  useSandpack,
  type SandpackPreviewRef,
} from "@codesandbox/sandpack-react";
import { useCallback, useRef, useState } from "react";
import { Undo2, Redo2, Download, FileDown } from "lucide-react";
import styles from "./cad.module.css";

const DEFAULT_MODEL = String.raw`/* ————————————————
 *  Model.ts   (edit me!)
 * ————————————————*/
import { drawEllipse } from "replicad";

export default function main() {
  // Super-simple starter: a tall extruded ellipse
  return drawEllipse(20, 30)
    .sketchOnPlane()
    .extrude(60)
    .fillet(2);
}
`;

export default function CadPage() {
  const previewRef = useRef<SandpackPreviewRef | null>(null);

  /* ---------------------------------------------------- */
  /*  <Playground/> — lives *inside* the Sandpack bundle  */
  /* ---------------------------------------------------- */
  const Playground = () => {
    const { sandpack, listen } = useSandpack();
    const [prompt, setPrompt] = useState("");
    const [busy,   setBusy]   = useState(false);
    const [hover,  setHover]  = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    /* ---------------- helpers ---------------- */
   

    /* screenshot helper – unchanged */
    const grabScreenshot = async () => {
      if (!previewRef.current) return "";
      const client = await previewRef.current.getClient();
      const iframe = (client as any).iframe as HTMLIFrameElement;
      if (!iframe?.contentWindow) return "";

      return new Promise<string>((resolve) => {
        const chan = new MessageChannel();
        chan.port1.onmessage = (e) => resolve(e.data ?? "");
        const sc = iframe.contentDocument!.createElement("script");
        sc.textContent = String.raw`
          (() => {
            const c=document.createElement('canvas');
            c.width=innerWidth; c.height=innerHeight;
            c.getContext('2d').drawImage(document.body,0,0);
            onmessage=e=>{
              if(e.data==='shot')
                postMessage(c.toDataURL('image/png').split(',')[1],'*');
            };
          })();`;
        iframe.contentDocument!.head.appendChild(sc);
        iframe.contentWindow!.postMessage("shot", "*", [chan.port2]);
      });
    };

    /* --------------- main generate loop --------------- */
    const run = useCallback(async () => {
      if (busy) {
        abortRef.current?.abort();
        return;
      }
      if (!prompt.trim()) return;

      setBusy(true);
      abortRef.current = new AbortController();
      const { signal } = abortRef.current;

      const waitForDone = () =>
        new Promise<void>((res) => {
          const stop = listen((m) => m.type === "done" && (stop(), res()));
        });

      try {
        let code = "";
        for (let i = 0; i < 4; i++) {
          if (i) {                    // inject & rebuild
            sandpack.updateFile("/Model.ts", code);
            await waitForDone();
          }

          const screenshot    = i ? await grabScreenshot() : "";
          const compileErrors = sandpack.error ? [sandpack.error.message] : [];

          const { code: next, finished } = await fetch("/api/cadIterate", {
            method : "POST",
            headers: { "Content-Type": "application/json" },
            body   : JSON.stringify({
              prompt,
              screenshotBase64: screenshot,
              compileErrors,
              iteration: i,
            }),
            signal,
          }).then((r) => r.json());

          code = next;
          if (finished) break;
        }
        sandpack.updateFile("/Model.ts", code);
      } catch (err) {
        if ((err as any).name !== "AbortError") console.error(err);
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    }, [busy, prompt, sandpack, listen]);

    /* ----- export helper -------------------------------- */
    const exportFile = (fmt: "stl" | "step") => {
      if (!previewRef.current) return;
      previewRef.current.getClient().then((client: any) => {
        const iframe = client.iframe as HTMLIFrameElement;
        iframe.contentWindow!.postMessage({ kind: "export", format: fmt }, "*");
      });
    };

    /* ------------------ UI ------------------ */
    return (
      <>
        <SandpackLayout>
          <SandpackPreview
            ref={previewRef}
            style={{ height: "100vh", border: "none" }}
          />
          <SandpackCodeEditor style={{ height: "100vh" }} showLineNumbers />
        </SandpackLayout>

        <div className={styles.inputContainer}>
          <input
            className={styles.input}
            disabled={busy}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. “a simple tapered hexagonal cup”"
          />

          <div className={styles.inputFooter}>
            <div className={styles.leftButtons}>
              <button onClick={() => window.history.back()}><Undo2 size={16} /></button>
              <button onClick={() => window.history.forward()}><Redo2 size={16} /></button>
            </div>

            <div className={styles.rightButtons}>
              <button onClick={() => exportFile("stl")} ><Download size={16}/> STL</button>
              <button onClick={() => exportFile("step")}><FileDown size={16}/> STEP</button>

              <button
                className={`${styles.runButton} ${busy ? styles.busy : ""}`}
                onClick={run}
                onMouseEnter={() => busy && setHover(true)}
                onMouseLeave={() => setHover(false)}
              >
                {busy ? (hover ? "Kill" : "Generating…") : "Submit"}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  };
  /* ---------------- /Playground ---------------- */

  return (
    <div className={styles.ttcad}>
      <SandpackProvider
        template="react-ts"
        theme="auto"
        /* keep template deps & ADD the extra ones */
        customSetup={{
          dependencies: {
            three: "latest",
            "@react-three/fiber": "latest",
            "@react-three/drei": "latest",
            replicad: "latest",
            "replicad-threejs-helper": "latest",
            "replicad-opencascadejs": "latest",
            "file-saver": "latest",
            react: "latest",
            "react-dom": "latest",
            "@types/file-saver": "latest"
          },
        }}
        files={{
          "/Model.ts": DEFAULT_MODEL,

          /* ----- viewer & OC loader ----------------------- */
          "/App.tsx": String.raw`
import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas }  from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { BufferGeometry } from "three";
import { syncFaces, syncLinesFromFaces } from "replicad-threejs-helper";
import { setOC } from "replicad";
import ocLoader from "replicad-opencascadejs/src/replicad_single.js";
import { saveAs }  from "file-saver";
import Model      from "./Model";

/* wasm path helper */
const ocWasmURL = new URL(
  "replicad-opencascadejs/src/replicad_single.wasm",
  import.meta.url
).href;

/* Z axis up like replicad */
THREE.Object3D.DEFAULT_UP.set(0,0,1);

function Viewer() {
  const body  = useRef<BufferGeometry>(new THREE.BufferGeometry());
  const edges = useRef<BufferGeometry>(new THREE.BufferGeometry());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      /* 1️⃣  ensure OC kernel is loaded only once */
      if (!(window as any).__ocLoaded) {
        const OC = await ocLoader({ locateFile: () => ocWasmURL });
        setOC(OC);
        (window as any).__ocLoaded = true;
      }

      /* 2️⃣  build the shape */
      let shape;
      try {
        shape = Model();
      } catch (err) {
        console.error(err);
        return;
      }
      if (cancelled) return;

      /* 3️⃣  mesh sync */
      syncFaces(body.current, shape.mesh());
      syncLinesFromFaces(edges.current, body.current);
      setTick(t => t + 1);

      /* 4️⃣  hook export messages */
      const handler = (e: MessageEvent) => {
        if (!e.data?.kind) return;
        if (e.data.kind === "export") {
          const blob = e.data.format === "stl"
            ? shape.blobSTL()
            : shape.blobSTEP();
          saveAs(blob, "model." + e.data.format);
        }
      };
      window.addEventListener("message", handler, false);
      return () => window.removeEventListener("message", handler);
    })();

    return () => { cancelled = true; };
  }, [Model]);

  /* ------------- canvas ------------- */
  return (
    <Canvas
      key={tick}
      style={{ width:"100%", height:"100vh", background:"#f5f5f5" }}
      camera={{ position:[150,150,150] }}
      frameloop="demand"
    >
      <ambientLight intensity={4}/>
      <pointLight position={[100,100,100]}/>
      <mesh geometry={body.current}>
        <meshStandardMaterial
          color="#5a8296"
          polygonOffset
          polygonOffsetFactor={2}
          polygonOffsetUnits={1}
        />
      </mesh>
      <lineSegments geometry={edges.current}>
        <lineBasicMaterial color="#3c5a6e"/>
      </lineSegments>
      <OrbitControls/>
    </Canvas>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><Viewer/></StrictMode>
);`,

          "/index.tsx": { code: `import "./App";`, readOnly: true, hidden: true },
        }}
        options={{ externalResources: ["https://cdn.tailwindcss.com"] }}
      >
        <Playground />
      </SandpackProvider>
    </div>
  );
}