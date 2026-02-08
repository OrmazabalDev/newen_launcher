import { useCallback, useRef } from "react";

/**
 * API minima requerida por el hook para manejar presencia en Discord.
 * Permite inyectar un servicio mock en pruebas.
 */
export interface DiscordPresenceApi {
  discordInit: () => Promise<void>;
  discordSetActivity: (state: string, details: string, startTimestamp: number) => Promise<void>;
  discordClearActivity: () => Promise<void>;
}

/**
 * Gestiona la presencia del launcher en Discord.
 * Inicializa una sola vez y maneja errores de forma segura.
 */
export function useLauncherPresence(api: DiscordPresenceApi): {
  setLauncherPresence: (state: string) => Promise<void>;
  clearLauncherPresence: () => Promise<void>;
} {
  const discordReadyRef = useRef(false);

  const setLauncherPresence = useCallback(
    async (state: string) => {
      try {
        if (!discordReadyRef.current) {
          await api.discordInit();
          discordReadyRef.current = true;
        }
        const startTimestamp = Math.floor(Date.now() / 1000);
        await api.discordSetActivity(state, "Newen Launcher", startTimestamp);
      } catch {
        // Errores de Discord no deben romper el launcher.
      }
    },
    [api]
  );

  const clearLauncherPresence = useCallback(async () => {
    try {
      await api.discordClearActivity();
    } catch {
      // Errores de Discord no deben romper el launcher.
    }
  }, [api]);

  return { setLauncherPresence, clearLauncherPresence };
}
