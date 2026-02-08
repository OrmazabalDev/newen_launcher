import { useCallback, useEffect, useState } from "react";
import type { Update } from "@tauri-apps/plugin-updater";

export interface UpdatesApi {
  checkForUpdate: () => Promise<Update | null>;
  relaunch: () => Promise<void>;
}

export interface UseUpdatesOptions {
  api: UpdatesApi;
  isDev: boolean;
  onToast: (message: string, kind?: "success" | "info" | "error") => void;
  checkDelayMs?: number;
}

export interface UseUpdatesResult {
  updateInfo: Update | null;
  updateBusy: boolean;
  updateError: string;
  scheduleUpdateCheck: (silent?: boolean) => void;
  handleUpdateNow: () => Promise<void>;
  handleUpdateLater: () => void;
}

/**
 * Encapsula el flujo de actualizaciones (check, download + install).
 */
export function useUpdates(options: UseUpdatesOptions): UseUpdatesResult {
  const { api, isDev, onToast, checkDelayMs = 1500 } = options;

  const [updateInfo, setUpdateInfo] = useState<Update | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateError, setUpdateError] = useState("");

  const scheduleUpdateCheck = useCallback(
    (silent = true) => {
      if (isDev) return;
      const timer = window.setTimeout(async () => {
        try {
          const update = await api.checkForUpdate();
          if (update) {
            setUpdateInfo(update);
            setUpdateError("");
          } else if (!silent) {
            onToast("No hay actualizaciones disponibles.", "info");
          }
        } catch {
          if (!silent) {
            onToast("No se pudo buscar actualizaciones.", "error");
          }
        }
      }, checkDelayMs);
      return () => window.clearTimeout(timer);
    },
    [api, checkDelayMs, isDev, onToast]
  );

  useEffect(() => {
    const cleanup = scheduleUpdateCheck(true);
    return () => {
      cleanup?.();
    };
  }, [scheduleUpdateCheck]);

  const handleUpdateNow = useCallback(async () => {
    if (!updateInfo) return;
    setUpdateBusy(true);
    setUpdateError("");
    try {
      await updateInfo.downloadAndInstall();
      await api.relaunch();
    } catch {
      setUpdateError("No se pudo instalar la actualizacion. Intenta mas tarde.");
      setUpdateBusy(false);
    }
  }, [api, updateInfo]);

  const handleUpdateLater = useCallback(() => {
    setUpdateInfo(null);
    setUpdateError("");
  }, []);

  return {
    updateInfo,
    updateBusy,
    updateError,
    scheduleUpdateCheck,
    handleUpdateNow,
    handleUpdateLater,
  };
}
