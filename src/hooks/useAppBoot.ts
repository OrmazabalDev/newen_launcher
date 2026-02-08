import { useEffect, useRef } from "react";
import type { InstanceSummary, SystemJava } from "../types";
import type { ModrinthSearchFn } from "../utils/prefetch";
import { prefetchCatalog } from "../utils/prefetch";

export interface AppBootDependencies {
  detectSystemJava: () => Promise<SystemJava>;
  closeSplash: () => Promise<void>;
  refreshInstalledVersions: () => Promise<void>;
  refreshInstances: () => Promise<InstanceSummary[]>;
  modrinthSearch: ModrinthSearchFn;
}

export interface AppBootOptions {
  splashDelayMs?: number;
  onSystemJavaDetected: (java: SystemJava | null) => void;
}

/**
 * Ejecuta el flujo de inicio del launcher:
 * - Cierra el splash con timeout de seguridad.
 * - Detecta Java.
 * - Carga versiones instaladas e instancias.
 * - Precarga el catalogo de Modrinth.
 */
export function useAppBoot(deps: AppBootDependencies, options: AppBootOptions): void {
  const splashClosedRef = useRef(false);
  const depsRef = useRef(deps);
  const optionsRef = useRef(options);

  useEffect(() => {
    const currentDeps = depsRef.current;
    const currentOptions = optionsRef.current;

    const closeSplashSafe = async () => {
      if (splashClosedRef.current) return;
      splashClosedRef.current = true;
      try {
        await currentDeps.closeSplash();
      } catch {
        // El cierre del splash no debe bloquear el inicio.
      }
    };

    const splashTimer = window.setTimeout(() => {
      void closeSplashSafe();
    }, currentOptions.splashDelayMs ?? 700);

    (async () => {
      try {
        const java = await currentDeps.detectSystemJava();
        currentOptions.onSystemJavaDetected(java);
      } catch (e) {
        console.error(e);
        currentOptions.onSystemJavaDetected(null);
      }

      await currentDeps.refreshInstalledVersions();
      const list = await currentDeps.refreshInstances();
      void prefetchCatalog(
        list.map((item) => item.loader),
        currentDeps.modrinthSearch
      );
      await closeSplashSafe();
    })();

    return () => {
      window.clearTimeout(splashTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
