import { useEffect } from "react";

export interface FocusModeWindowApi {
  isMaximized: () => Promise<boolean>;
  isFullscreen: () => Promise<boolean>;
  setFullscreen: (value: boolean) => Promise<void>;
  minimize: () => Promise<void>;
  hide: () => Promise<void>;
  show: () => Promise<void>;
  unminimize: () => Promise<void>;
  maximize: () => Promise<void>;
  setFocus: () => Promise<void>;
  setSkipTaskbar?: (skip: boolean) => Promise<void>;
}

export interface FocusModeDependencies {
  listen: <T>(event: string, handler: (event: { payload?: T }) => void) => Promise<() => void>;
}

/**
 * Maneja el Focus Mode: ocultar el launcher al iniciar el juego y restaurar al salir.
 */
export function useFocusMode(
  isEnabled: boolean,
  windowApi: FocusModeWindowApi,
  deps: FocusModeDependencies,
  options?: {
    onGameExit?: () => void;
    onGameStart?: (pid?: number | null) => void;
  }
): void {
  useEffect(() => {
    const wasMaximized = { current: false };
    const wasFullscreen = { current: false };

    const unlistenStart = deps.listen<{ pid: number }>("game-started", async (event) => {
      options?.onGameStart?.(event.payload?.pid ?? null);
      if (!isEnabled) return;
      try {
        wasMaximized.current = await windowApi.isMaximized();
        wasFullscreen.current = await windowApi.isFullscreen();
        if (wasFullscreen.current) {
          await windowApi.setFullscreen(false);
        }
        if (windowApi.setSkipTaskbar) {
          await windowApi.setSkipTaskbar(true);
        }
        await windowApi.hide();
      } catch {
        // Errores de ventana no deben romper el flujo.
      }
    });

    const unlistenExit = deps.listen<{ pid: number; code?: number | null }>(
      "game-exited",
      async () => {
        options?.onGameExit?.();
        if (!isEnabled) return;
        try {
          if (windowApi.setSkipTaskbar) {
            await windowApi.setSkipTaskbar(false);
          }
          await windowApi.show();
          if (wasFullscreen.current) {
            await windowApi.setFullscreen(true);
          } else if (wasMaximized.current) {
            await windowApi.maximize();
          }
          await windowApi.setFocus();
        } catch {
          // Errores de ventana no deben romper el flujo.
        }
      }
    );

    return () => {
      unlistenStart.then((f) => f());
      unlistenExit.then((f) => f());
    };
  }, [deps, isEnabled, options, windowApi]);
}
