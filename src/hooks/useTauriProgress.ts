import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import type { ProgressPayload } from "../types";

export function useTauriProgress(onProgress: (p: ProgressPayload) => void) {
  useEffect(() => {
    const unlisten = listen<ProgressPayload>("download-progress", (event) => {
      onProgress(event.payload);
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, [onProgress]);
}
