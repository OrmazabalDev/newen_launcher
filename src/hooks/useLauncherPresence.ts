import { useCallback, useRef } from "react";

/**
 * API minima requerida por el hook para manejar presencia en Discord.
 * Permite inyectar un servicio mock en pruebas.
 */
export interface DiscordPresenceApi {
  discordInit: () => Promise<void>;
  discordSetActivity: (
    state: string,
    details: string,
    startTimestamp: number | undefined,
    showButtons: boolean
  ) => Promise<void>;
  discordClearActivity: () => Promise<void>;
}

/**
 * Gestiona la presencia del launcher en Discord.
 * Inicializa una sola vez y maneja errores de forma segura.
 */
export function useLauncherPresence(api: DiscordPresenceApi): {
  setLauncherPresence: (state: string) => Promise<void>;
  setGamePresence: (details?: string) => Promise<void>;
  clearLauncherPresence: () => Promise<void>;
} {
  const discordReadyRef = useRef(false);

  const ensureDiscordReady = useCallback(async () => {
    if (!discordReadyRef.current) {
      await api.discordInit();
      discordReadyRef.current = true;
    }
  }, [api]);

  const setLauncherPresence = useCallback(
    async (state: string) => {
      try {
        await ensureDiscordReady();
        const startTimestamp = Math.floor(Date.now() / 1000);
        await api.discordSetActivity(state, "Launcher de Minecraft / Version 1.0 Atacama", startTimestamp, true);
      } catch {
        // Errores de Discord no deben romper el launcher.
      }
    },
    [api, ensureDiscordReady]
  );

  const setGamePresence = useCallback(
    async (details?: string) => {
      try {
        await ensureDiscordReady();
        const startTimestamp = Math.floor(Date.now() / 1000);
        await api.discordSetActivity(
          "Desde Newen Launcher",
          details || "Jugando Minecraft",
          startTimestamp,
          true
        );
      } catch {
        // Errores de Discord no deben romper el launcher.
      }
    },
    [api, ensureDiscordReady]
  );

  const clearLauncherPresence = useCallback(async () => {
    try {
      await api.discordClearActivity();
    } catch {
      // Errores de Discord no deben romper el launcher.
    }
  }, [api]);

  return { setLauncherPresence, setGamePresence, clearLauncherPresence };
}
