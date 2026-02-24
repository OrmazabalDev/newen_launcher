import React, { useCallback, useEffect, useRef, useState } from "react";
import type { GameSettings, ProgressPayload, SystemJava, VersionItem, View } from "../types";
import { inferVersionType } from "../utils/versioning";
import { useTauriProgress } from "../hooks/useTauriProgress";
import { useConfirm } from "../hooks/useConfirm";
import { useToast } from "../hooks/useToast";
import { useLauncherPresence } from "../hooks/useLauncherPresence";
import { useFocusMode } from "../hooks/useFocusMode";
import { useAppBoot } from "../hooks/useAppBoot";
import { useInstances } from "../hooks/useInstances";
import { useAuth } from "../hooks/useAuth";
import { useUpdates } from "../hooks/useUpdates";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import * as tauri from "../services/tauri";
import { usePersistedSession } from "../store/useSession";

export type AppStateValue = ReturnType<typeof useAppState>;

export function AppState({ children }: { children: (state: AppStateValue) => React.ReactNode }) {
  const state = useAppState();
  return <>{children(state)}</>;
}

function useAppState() {
  const { persisted, persist } = usePersistedSession();

  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [installedVersions, setInstalledVersions] = useState<string[]>([]);
  const [mojangVersions, setMojangVersions] = useState<VersionItem[]>([]);
  const [globalStatus, setGlobalStatus] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [progressActive, setProgressActive] = useState(false);
  const progressTimer = useRef<number | null>(null);
  const [gamePid, setGamePid] = useState<number | null>(null);
  const [systemJava, setSystemJava] = useState<SystemJava | null>(null);
  const [gameSettings, setGameSettings] = useState<GameSettings>(persisted.gameSettings);
  const [uiScale, setUiScale] = useState<number>(persisted.uiScale ?? 1);
  const [showSnapshots, setShowSnapshots] = useState<boolean>(persisted.showSnapshots);
  const [authError, setAuthError] = useState("");

  const { toast, showToast } = useToast();
  const { confirmState, askConfirm, resolveConfirm } = useConfirm();
  const { setLauncherPresence, setGamePresence, clearLauncherPresence } =
    useLauncherPresence(tauri);

  const {
    instances,
    instancesLoading,
    selectedInstanceId,
    setSelectedInstanceId,
    errorInstanceIds,
    showJavaPrompt,
    closeJavaPrompt,
    refreshInstances,
    createInstance,
    deleteInstance,
    openInstanceFolder,
    launchInstance,
    repairSelectedInstance,
    playSelectedInstance,
    retryJavaDownload,
  } = useInstances({
    api: tauri,
    gameSettings,
    initialSelectedInstanceId: persisted.selectedInstanceId || "",
    onGlobalStatus: setGlobalStatus,
    onProcessingChange: setIsProcessing,
    onProgressChange: setProgress,
    showToast,
    askConfirm,
    setLauncherPresence,
  });

  const {
    userProfile,
    authMode,
    offlineUsername,
    setAuthMode,
    setOfflineUsername,
    loginOffline,
    loginMicrosoft,
    logout,
    refreshOnlineProfile,
  } = useAuth({
    api: tauri,
    persistedProfile: persisted.userProfile ?? null,
    onAuthError: setAuthError,
    onPresence: setLauncherPresence,
    onPersist: (profile) => persist({ userProfile: profile }),
  });

  const { updateInfo, updateBusy, updateError, handleUpdateNow, handleUpdateLater } = useUpdates({
    api: {
      checkForUpdate: check,
      relaunch,
    },
    isDev: import.meta.env.DEV,
    onToast: showToast,
    checkDelayMs: 1500,
  });

  const scheduleProgressIdle = useCallback((delayMs: number) => {
    if (progressTimer.current) {
      window.clearTimeout(progressTimer.current);
    }
    progressTimer.current = window.setTimeout(() => {
      setProgressActive(false);
    }, delayMs);
  }, []);

  useTauriProgress(
    useCallback(
      (p: ProgressPayload) => {
        setGlobalStatus(p.task);
        setProgress(p.percent);
        setProgressActive(true);
        scheduleProgressIdle(p.percent >= 100 ? 800 : 4000);
      },
      [scheduleProgressIdle]
    )
  );

  useEffect(() => {
    return () => {
      if (progressTimer.current) {
        window.clearTimeout(progressTimer.current);
      }
      void clearLauncherPresence();
    };
  }, [clearLauncherPresence]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      event.preventDefault();
    };
    window.addEventListener("contextmenu", handler);
    return () => {
      window.removeEventListener("contextmenu", handler);
    };
  }, []);

  const refreshInstalledVersions = useCallback(async () => {
    try {
      const installed = await tauri.getInstalledVersions();
      setInstalledVersions(installed);
    } catch (err) {
      console.error("Error cargando instaladas", err);
      showToast("No se pudieron cargar las versiones instaladas.", "error");
    }
  }, [showToast]);

  useFocusMode(
    gameSettings.focusMode,
    getCurrentWindow(),
    { listen },
    {
      onGameStart: (pid) => {
        setGamePid(pid ?? null);
        void setGamePresence();
      },
      onGameExit: () => {
        setGamePid(null);
        void setLauncherPresence("Gestionando instancias");
      },
    }
  );

  useAppBoot(
    {
      detectSystemJava: tauri.detectSystemJava,
      closeSplash: tauri.closeSplash,
      refreshInstalledVersions,
      refreshInstances,
      modrinthSearch: tauri.modrinthSearch,
    },
    {
      onSystemJavaDetected: setSystemJava,
      splashDelayMs: 700,
    }
  );

  useEffect(() => persist({ selectedInstanceId }), [persist, selectedInstanceId]);
  useEffect(() => persist({ showSnapshots }), [persist, showSnapshots]);
  useEffect(() => persist({ gameSettings }), [persist, gameSettings]);
  useEffect(() => persist({ uiScale }), [persist, uiScale]);

  useEffect(() => {
    const scale = Math.max(0.85, Math.min(1.3, uiScale || 1));
    document.documentElement.style.zoom = String(scale);
  }, [uiScale]);

  const loadMojangVersions = useCallback(async () => {
    if (mojangVersions.length > 0) return;
    setGlobalStatus("Cargando lista de Mojang...");
    try {
      const ids = await tauri.getVersions();
      setMojangVersions(ids.map((id) => ({ id, type: inferVersionType(id) })));
      setGlobalStatus("");
    } catch (err) {
      setGlobalStatus("Error: no se pudo cargar la lista de Mojang. " + String(err));
    }
  }, [mojangVersions.length]);

  const navigate = useCallback(
    async (v: View) => {
      setCurrentView(v);
      if (v === "instances") {
        await refreshInstances();
        await loadMojangVersions();
      }
      if (v === "catalog" || v === "modpacks") {
        await refreshInstances();
      }
    },
    [loadMojangVersions, refreshInstances]
  );

  const handleRefreshInstances = useCallback(async () => {
    await refreshInstances();
  }, [refreshInstances]);

  const handleInstallVanilla = useCallback(
    async (versionId: string) => {
      setIsProcessing(true);
      setProgress(0);
      setCurrentView("dashboard");
      setGlobalStatus(`Iniciando instalacion de ${versionId}...`);

      try {
        await tauri.getVersionMetadata(versionId);
        await tauri.downloadClient(versionId);
        await tauri.downloadGameFiles(versionId);
        await refreshInstalledVersions();
        setGlobalStatus("Listo: instalacion completada. Crea una instancia para jugar.");
      } catch (err) {
        setGlobalStatus("Error: instalacion fallida. " + String(err));
      } finally {
        setIsProcessing(false);
      }
    },
    [refreshInstalledVersions]
  );

  const handleInstallForge = useCallback(
    async (versionId: string, isSnapshot: boolean) => {
      if (isSnapshot) return;
      setIsProcessing(true);
      setProgress(0);
      setCurrentView("dashboard");
      setGlobalStatus(`Instalando Forge para ${versionId}...`);
      try {
        const forgeId = await tauri.installForge(versionId);
        await refreshInstalledVersions();
        setGlobalStatus(`Listo: Forge instalado (${forgeId}). Crea una instancia para jugar.`);
      } catch (err) {
        setGlobalStatus("Error: instalacion de Forge. " + String(err));
      } finally {
        setIsProcessing(false);
      }
    },
    [refreshInstalledVersions]
  );

  const handleInstallFabric = useCallback(
    async (versionId: string, isSnapshot: boolean) => {
      if (isSnapshot) return;
      setIsProcessing(true);
      setProgress(0);
      setCurrentView("dashboard");
      setGlobalStatus(`Instalando Fabric para ${versionId}...`);
      try {
        const fabricId = await tauri.installFabric(versionId);
        await refreshInstalledVersions();
        setGlobalStatus(`Listo: Fabric instalado (${fabricId}). Crea una instancia para jugar.`);
      } catch (err) {
        setGlobalStatus("Error: instalacion de Fabric. " + String(err));
      } finally {
        setIsProcessing(false);
      }
    },
    [refreshInstalledVersions]
  );

  const handleInstallNeoForge = useCallback(
    async (versionId: string, isSnapshot: boolean) => {
      if (isSnapshot) return;
      setIsProcessing(true);
      setProgress(0);
      setCurrentView("dashboard");
      setGlobalStatus(`Instalando NeoForge para ${versionId}...`);
      try {
        const neoforgeId = await tauri.installNeoForge(versionId);
        await refreshInstalledVersions();
        setGlobalStatus(
          `Listo: NeoForge instalado (${neoforgeId}). Crea una instancia para jugar.`
        );
      } catch (err) {
        setGlobalStatus("Error: instalacion de NeoForge. " + String(err));
      } finally {
        setIsProcessing(false);
      }
    },
    [refreshInstalledVersions]
  );

  const handleLogout = useCallback(async () => {
    await logout();
    setCurrentView("dashboard");
    setAuthError("");
  }, [logout]);

  return {
    currentView,
    setCurrentView,
    navigate,
    installedVersions,
    mojangVersions,
    globalStatus,
    isProcessing,
    progress,
    progressActive,
    gamePid,
    systemJava,
    gameSettings,
    setGameSettings,
    uiScale,
    setUiScale,
    showSnapshots,
    setShowSnapshots,
    toast,
    showToast,
    confirmState,
    askConfirm,
    resolveConfirm,
    instances,
    instancesLoading,
    selectedInstanceId,
    setSelectedInstanceId,
    errorInstanceIds,
    showJavaPrompt,
    closeJavaPrompt,
    refreshInstances,
    createInstance,
    deleteInstance,
    openInstanceFolder,
    launchInstance,
    repairSelectedInstance,
    playSelectedInstance,
    retryJavaDownload,
    userProfile,
    authMode,
    offlineUsername,
    setAuthMode,
    setOfflineUsername,
    loginOffline,
    loginMicrosoft,
    logout: handleLogout,
    refreshOnlineProfile,
    authError,
    setAuthError,
    updateInfo,
    updateBusy,
    updateError,
    handleUpdateNow,
    handleUpdateLater,
    handleInstallVanilla,
    handleInstallForge,
    handleInstallFabric,
    handleInstallNeoForge,
    loadMojangVersions,
    refreshInstalledVersions,
    handleRefreshInstances,
  };
}
