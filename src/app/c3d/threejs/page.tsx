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
// import { amethyst } from "@codesandbox/sandpack-themes";
import html2canvas from "html2canvas";
import { useRef, useState, useCallback } from "react";
import styles from "./threejs.module.css";
import { Undo2, Redo2 } from "lucide-react";

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
          href="https://cxmpute.cloud/c3d/cad"
          target="_blank"
          className="
            text-[0.9rem]
            w-fit
            border-2 border-black rounded-[7px]
            px-[0.5rem] py-[0.3rem]
            bg-[#20a191]
            shadow-[5px_5px_0px_black]
            flex items-center justify-center gap-2
            font-bold text-center cursor-pointer
            transition-all duration-300 ease-in-out
            hover:shadow-[0_0_0_black]
            hover:translate-x-[3px] hover:translate-y-[3px]
          "
        >
          Check out our Text-to-3D-Model page
        </a>
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
    const [busy, setBusy]     = useState(false);

    

    /** Main generation loop */
    const run = useCallback(async () => {

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

      let code = "";
      for (let i = 0; i < 4; i++) {
        if (i > 0) {
          // 1️⃣ inject candidate code and wait for rebuild
          sandpack.updateFile("/App.tsx", code);
          await waitForDone();
        }

        // 2️⃣ take screenshot (after first render)
        let screenshot = "";
        if (i > 0 && previewRef.current) {
          const client      = await previewRef.current.getClient();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const iframe      = (client as any).iframe as HTMLIFrameElement | undefined;
          const docBody     = iframe?.contentDocument?.body;
          if (docBody) {
            screenshot = await html2canvas(docBody, {
              useCORS: true, backgroundColor: null
            }).then((c) => c.toDataURL("image/png").split(",")[1]);
          }
        }

        // 3️⃣ collect compile errors
        const compileErrors = sandpack.error ? [sandpack.error.message] : [];

        // 4️⃣ call OpenAI edge route
        const res = await fetch("/api/iterate", {
          method : "POST",
          headers: { "Content-Type": "application/json" },
          body   : JSON.stringify({
            prompt,
            screenshotBase64: screenshot,
            compileErrors,
            iteration: i
          })
        }).then((r) => r.json() as Promise<{ code: string; finished: boolean }>);

        code = res.code;
        if (res.finished) break;
      }

      // final candidate → editor
      sandpack.updateFile("/App.tsx", code);
      setBusy(false);
    }, [prompt, sandpack, listen]);

    return (
      <>
        {/* Sandpack UI -------------------------------------------------- */}
        <SandpackLayout>
          <SandpackPreview
            ref={previewRef}
            style={{ height: "100vh", border: "none" }}
          />
          <SandpackCodeEditor
            style={{ height: "100vh" }}
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
            placeholder="What imagination do you wish to make reality?"
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
            </div>

            <div className={styles.rightButtons}>
              <button
                className={styles.c3dbtn}
                onClick={() => window.open("/c3d", "_blank")}
              >
                Learn more about C3D
              </button>
              <button
                className={styles.inputButton}
                disabled={busy}
                onClick={run}
              >
                {busy ? "Generating…" : "Submit"}
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
        template="react-ts"
        // theme={amethyst}
        theme="light"
        customSetup={{
          dependencies: {
            three: "0.161.0",
            "@react-three/fiber": "latest",
            "@react-three/drei": "latest",
            html2canvas: "latest",
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