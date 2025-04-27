"use client";
import { useState, useCallback } from "react";
import html2canvas from "html2canvas";
import { GenResultType } from "@/lib/genSchema";
import { useSandpack } from "@codesandbox/sandpack-react";

/**
 * Drives the “generate → render → screenshot → refine” loop.
 * Must be used **inside** a SandpackProvider tree.
 */
export function useGenerateScene(iframeRef: React.RefObject<HTMLIFrameElement>) {
  const { sandpack, listen } = useSandpack();      // ← official hook
  const [busy, setBusy]     = useState(false);

  

  /** Single run initiated by a prompt. */
  const run = useCallback(
    async (prompt: string) => {

        /** Wait for the bundler to finish a rebuild. */
    const waitForDone = () =>
        new Promise<void>((resolve) => {
        const stop = listen((msg) => {
            if (msg.type === "done") {
            stop();          // unsubscribe
            resolve();
            }
        });
        });

      setBusy(true);
      let code = "";

      for (let i = 0; i < 4; i++) {
        if (i > 0) {
          // ❶ inject the candidate code and wait for rebuild
          sandpack.updateFile("/App.tsx", code);
          await waitForDone();
        }

        // ❷ grab screenshot (only after something rendered)
        const screenshot =
          i > 0 && iframeRef.current
            ? await html2canvas(
                iframeRef.current.contentDocument!.body,
                { useCORS: true, backgroundColor: null }
              ).then((c) => c.toDataURL("image/png").split(",")[1])
            : "";

        // ❸ collect build errors (if any)
        const compileErrors = sandpack.error
          ? [sandpack.error.message]
          : [];

        // ❹ ask the model for the next iteration
        const res: GenResultType = await fetch("/api/iterate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            screenshotBase64: screenshot,
            compileErrors,
            iteration: i
          })
        }).then((r) => r.json());

        code = res.code;
        if (res.finished) break;
      }

      // put the final version in the editor
      sandpack.updateFile("/App.tsx", code);
      setBusy(false);
    },
    [iframeRef, sandpack, listen]
  );

  return { busy, run };
}