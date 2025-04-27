/* ---------------------------------------------------------
 *  src/app/c3d/threejs/page.tsx
 * --------------------------------------------------------*/
"use client";

import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
  SandpackCodeEditor,
  useSandpack,
  type SandpackPreviewRef
} from "@codesandbox/sandpack-react";
import { useRef, useState, useCallback, useEffect } from "react";
import styles from "./threejs.module.css";
import { Undo2, Redo2, Code2 } from "lucide-react";
import Button from "@/components/button/button";

const DEFAULT_CODE = `export default function App(): JSX.Element {
  return (
    <div className="flex flex-col justify-center items-center h-[100vh] bg-[#f9f5f2]">
      <div className="max-w-[800px] flex flex-col gap-3 p-2">
        <img src="https://i.postimg.cc/4yPxCKr9/dolphinhero.png" width="200" />
        <h1 className="text-[60px] font-bold">Text to 3D (threejs)</h1>
        <p className="text-slate-800 text-lg">Generate 3D react components from prompts.</p>
        <h2 className="text-slate-800">Made with ❤️ by C3D</h2>
        <p className="text-slate-600">
          C3D is a research initiative by{" "}
          <a href="https://cxmpute.cloud/" target="_blank" className="text-rose-600">
            cxmpute.cloud
          </a>{" "}
          that aims to bridge text and 3D creation through AI research, providing open tooling, infrastructure, benchmarks, and model finetunes to make sophisticated 3D generation accessible to everyone.
        </p>

        <a
          href="https://cxmpute.cloud/"
          target="_blank"
          className="
            text-[0.9rem]
            w-fit
            border-2 border-black rounded-[7px]
            px-[0.5rem] py-[0.3rem]
            bg-[#91a8eb]
            shadow-[5px_5px_0px_black]
            flex items-center justify-center gap-2
            font-bold text-center cursor-pointer
            transition-all duration-300 ease-in-out
            hover:shadow-[0_0_0_black]
            hover:translate-x-[3px] hover:translate-y-[3px]
          "
        >
          Learn more about cxmpute.cloud
        </a>
      </div>
    </div>
  );
}`

export default function ThreeJSPage() {
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
    const [codeVisisble, setCodeVisible] = useState(true);

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

      if (!prompt.trim()) return;
      setBusy(true);
      
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
            sandpack.updateFile("/App.tsx", code);
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
              iteration: i
            }),
            signal // Pass the abort signal to the fetch call
          }).then((r) => r.json() as Promise<{ code: string; finished: boolean }>);

          code = res.code;
          if (res.finished) break;
        }

        // final candidate → editor
        sandpack.updateFile("/App.tsx", code);
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
    }, [prompt, sandpack, listen, busy]);


    return (
      <>
        {/* Sandpack UI -------------------------------------------------- */}
        <SandpackLayout>
          <SandpackPreview
            ref={previewRef}
            style={{ height: "100vh", border: "none" }}
            // actionsChildren={
            //   <button onClick={() => setCodeVisible(!codeVisisble)} className={styles.codeButton}>
            //     Toggle Code
            //   </button>
            // }
            showRefreshButton
            showRestartButton
          />

          {codeVisisble && <SandpackCodeEditor
            style={{ height: "100vh" }}
            showLineNumbers
            showTabs
            wrapContent
          />}
        </SandpackLayout>

        {/* Prompt overlay ---------------------------------------------- */}
        <div className={styles.inputContainer}>
          <input
            className={styles.input}
            value={prompt}
            disabled={busy}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What imagination will you make reality?"
          />

          <div className={styles.inputFooter}>
            <div className={styles.leftButtons}>
              <button
                className={styles.undoButton}
                onClick={() => window.history.back()}
              >
                <Undo2 size={16} />
              </button>
              <button
                className={styles.redoButton}
                onClick={() => window.history.forward()}
              >
                <Redo2 size={16} />
              </button>
              <button
                className={styles.toggleButton}
                onClick={() => setCodeVisible(!codeVisisble)}
              >
                <Code2 size={16} />
              </button>
            </div>

            <div className={styles.rightButtons}>
              <div
                className={styles.c3dbtn}
                onClick={() => window.open("/c3d", "_blank")}
              >
                <Button text="Learn more about C3D" backgroundColor="#f8cb46" />
              </div>
              <div
                className={`${styles.inputButton} ${busy ? styles.busyButton : ''}`}
                onClick={run}
                onMouseEnter={() => busy && setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
              >
                
                  <Button 
                    text={busy 
                      ? isHovering ? "Kill" : "Generating…" 
                      : "Submit"} 
                    backgroundColor="#20a191" 
                  />
              </div>
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
        template="react-ts"
        theme="light"
        customSetup={{
          dependencies: {
            three: "0.161.0",
            "@react-three/fiber": "latest",
            "@react-three/drei": "latest",
          }
        }}
        files={{
          "/App.tsx": DEFAULT_CODE,
          "/index.tsx": {
            code: `
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
createRoot(document.getElementById("root")!).render(
  <StrictMode><App /></StrictMode>
);`,
            readOnly: true,
            hidden: true
          }
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