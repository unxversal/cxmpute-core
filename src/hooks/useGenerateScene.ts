"use client";
import { useState, useCallback } from "react";
import html2canvas from "html2canvas";
import { useSandpack } from "@codesandbox/sandpack-react";
import type { SandpackPreviewRef } from "@codesandbox/sandpack-react";
import type { GenResultType } from "@/lib/genSchema";

export function useGenerateScene(previewRef: React.RefObject<SandpackPreviewRef | null>) {
  const { sandpack, listen } = useSandpack();
  const [busy, setBusy] = useState(false);

  /** Wait for one `"done"` message from the bundler. */
  

  const run = useCallback(
    async (prompt: string) => {

        const waitForDone = () =>
            new Promise<void>((resolve) => {
              const stop = listen((msg) => {
                if (msg.type === "done") {
                  stop();
                  resolve();
                }
              });
            });
      setBusy(true);
      let code = "";

      for (let i = 0; i < 4; i++) {
        if (i > 0) {
          sandpack.updateFile("/App.tsx", code);
          await waitForDone();
        }

        /* ---------------- Screenshot ---------------- */
        let screenshotB64 = "";
        if (i > 0 && previewRef.current) {
          // Grab iframe inside the preview component
          const client = await previewRef.current.getClient();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const iframe = (client as any).iframe as HTMLIFrameElement | undefined;
          if (iframe?.contentDocument?.body) {
            screenshotB64 = await html2canvas(iframe.contentDocument.body, {
              useCORS: true,
              backgroundColor: null
            }).then((c) => c.toDataURL("image/png").split(",")[1]);
          }
        }

        const compileErrors = sandpack.error ? [sandpack.error.message] : [];

        const res: GenResultType = await fetch("/api/iterate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            screenshotBase64: screenshotB64,
            compileErrors,
            iteration: i
          })
        }).then((r) => r.json());

        code = res.code;
        if (res.finished) break;
      }

      // final code goes to the editor
      sandpack.updateFile("/App.tsx", code);
      setBusy(false);
    },
    [listen, previewRef, sandpack]
  );

  return { busy, run };
}