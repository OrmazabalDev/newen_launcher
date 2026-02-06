import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AuthMode,
  GameSettings,
  InstanceSummary,
  MinecraftProfile,
  ProgressPayload,
  SystemJava,
  VersionItem,
  View,
} from "./types";

import { Sidebar } from "./components/Sidebar";
import { JavaModal } from "./components/JavaModal";
import { GlobalProgress } from "./components/GlobalProgress";
import { ConfirmModal } from "./components/ConfirmModal";
import { UpdateModal } from "./components/UpdateModal";

import { LoginView } from "./views/LoginView";
import { DashboardView } from "./views/DashboardView";
import { ManagerView } from "./views/ManagerView";
import { InstancesView } from "./views/InstancesView";
import { CatalogView } from "./views/CatalogView";
import { SkinsView } from "./views/SkinsView";
import { SettingsView } from "./views/SettingsView";

import { useTauriProgress } from "./hooks/useTauriProgress";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { check } from "@tauri-apps/plugin-updater";
import type { Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import * as tauri from "./services/tauri";
import { loadSession, saveSession } from "./store/sessionStore";

function inferVersionType(id: string): "release" | "snapshot" {
  return id.match(/^\d+\.\d+(\.\d+)?$/) ? "release" : "snapshot";
}

function extractBaseVersion(versionId: string): string {
  if (versionId.includes("-forge-")) {
    return versionId.split("-forge-")[0];
  }
  if (versionId.includes("-neoforge-")) {
    return versionId.split("-neoforge-")[0];
  }
  if (versionId.startsWith("neoforge-")) {
    const token = versionId.split("-")[1] || "";
    const parts = token.split(".");
    const minor = Number(parts[0] || 0);
    const patch = Number(parts[1] || 0);
    if (minor > 0) {
      return patch > 0 ? `1.${minor}.${patch}` : `1.${minor}`;
    }
  }
  if (versionId.startsWith("fabric-loader-")) {
    const parts = versionId.split("-");
    return parts[parts.length - 1] || versionId;
  }
  return versionId;
}

export default function App() {
  const persisted = useMemo(() => loadSession(), []);

  // UI
  const [currentView, setCurrentView] = useState<View>("dashboard");

  // Auth
  const [userProfile, setUserProfile] = useState<MinecraftProfile | null>(persisted.userProfile);
  const [authMode, setAuthMode] = useState<AuthMode>("offline");
  const [offlineUsername, setOfflineUsername] = useState("");
  const [authError, setAuthError] = useState("");

  // Versions
  const [installedVersions, setInstalledVersions] = useState<string[]>([]);
  const [mojangVersions, setMojangVersions] = useState<VersionItem[]>([]);

  // Instances
  const [instances, setInstances] = useState<InstanceSummary[]>([]);
  const [instancesLoading, setInstancesLoading] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>(persisted.selectedInstanceId || "");
  const [pendingInstanceId, setPendingInstanceId] = useState<string>("");
  const [errorInstanceIds, setErrorInstanceIds] = useState<Set<string>>(new Set());

  // Status / Progress
  const [globalStatus, setGlobalStatus] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [progressActive, setProgressActive] = useState(false);
  const progressTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);
  const splashClosed = useRef(false);
  const discordReadyRef = useRef(false);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "info" | "error" } | null>(null);
  const [gamePid, setGamePid] = useState<number | null>(null);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    resolve: (value: boolean) => void;
  } | null>(null);
  const [updateInfo, setUpdateInfo] = useState<Update | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateError, setUpdateError] = useState("");

  // Java
  const [systemJava, setSystemJava] = useState<SystemJava | null>(null);
  const [showJavaPrompt, setShowJavaPrompt] = useState(false);

  // Settings
  const [gameSettings, setGameSettings] = useState<GameSettings>(persisted.gameSettings);

  // Manager filter
  const [showSnapshots, setShowSnapshots] = useState<boolean>(persisted.showSnapshots);


  // Listen backend progress
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
      if (toastTimer.current) {
        window.clearTimeout(toastTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      event.preventDefault();
    };
    window.addEventListener("contextmenu", handler);
    return () => {
      window.removeEventListener("contextmenu", handler);
    };
  }, []);

  const showToast = useCallback((message: string, kind: "success" | "info" | "error" = "info") => {
    if (toastTimer.current) {
      window.clearTimeout(toastTimer.current);
    }
    setToast({ message, kind });
    toastTimer.current = window.setTimeout(() => setToast(null), 4500);
  }, []);

  const askConfirm = useCallback(
    (opts: {
      title: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
      danger?: boolean;
    }) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({ ...opts, resolve });
      }),
    []
  );

  const checkForUpdates = useCallback(
    async (silent = true) => {
      if (import.meta.env.DEV) return;
      try {
        const update = await check();
        if (update) {
          setUpdateInfo(update);
          setUpdateError("");
        } else if (!silent) {
          showToast("No hay actualizaciones disponibles.", "info");
        }
      } catch (err) {
        if (!silent) {
          showToast("No se pudo buscar actualizaciones.", "error");
        }
      }
    },
    [showToast]
  );

  const resolveConfirm = useCallback(
    (value: boolean) => {
      if (confirmState) {
        confirmState.resolve(value);
        setConfirmState(null);
      }
    },
    [confirmState]
  );

  const closeSplash = useCallback(async () => {
    if (splashClosed.current) return;
    splashClosed.current = true;
    try {
      await tauri.closeSplash();
    } catch {
      // ignore splash close errors
    }
  }, []);

  const setLauncherPresence = useCallback(async (state: string) => {
    try {
      if (!discordReadyRef.current) {
        await tauri.discordInit();
        discordReadyRef.current = true;
      }
      const startTimestamp = Math.floor(Date.now() / 1000);
      await tauri.discordSetActivity(state, "Newen Launcher", startTimestamp);
    } catch {
      // ignore discord errors
    }
  }, []);

  const savePrefetch = (key: string, payload: any) => {
    try {
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), ...payload }));
    } catch {
      // ignore storage issues
    }
  };

  const handleUpdateNow = useCallback(async () => {
    if (!updateInfo) return;
    setUpdateBusy(true);
    setUpdateError("");
    try {
      await updateInfo.downloadAndInstall();
      await relaunch();
    } catch (err) {
      setUpdateError("No se pudo instalar la actualización. Intenta más tarde.");
      setUpdateBusy(false);
    }
  }, [updateInfo]);

  const handleUpdateLater = useCallback(() => {
    setUpdateInfo(null);
    setUpdateError("");
  }, []);

  const prefetchCatalog = useCallback(async (loaders: string[]) => {
    const loaderSet = new Set(loaders.filter((l) => l === "forge" || l === "neoforge" || l === "fabric"));
    loaderSet.add("forge");
    loaderSet.add("neoforge");
    loaderSet.add("fabric");
    const uniqueLoaders = Array.from(loaderSet);

    const prefetchOne = async (
      key: string,
      projectType: "mod" | "modpack" | "resourcepack" | "datapack" | "shader",
      loader?: string
    ) => {
      try {
        const result = await tauri.modrinthSearch("", 24, 0, loader, undefined, "downloads", projectType);
        savePrefetch(key, {
          hits: result.hits,
          total: result.total_hits || 0,
        });
      } catch {
        // ignore prefetch errors
      }
    };

    const tasks: Promise<void>[] = [
      prefetchOne("launcher_catalog_prefetch_modpacks_any_v1", "modpack"),
      prefetchOne("launcher_catalog_prefetch_resourcepacks_any_v1", "resourcepack"),
      prefetchOne("launcher_catalog_prefetch_datapacks_any_v1", "datapack"),
      prefetchOne("launcher_catalog_prefetch_shaders_any_v1", "shader"),
    ];

    for (const loader of uniqueLoaders) {
      tasks.push(prefetchOne(`launcher_catalog_prefetch_mods_${loader}_v1`, "mod", loader));
      tasks.push(prefetchOne(`launcher_catalog_prefetch_modpacks_${loader}_v1`, "modpack", loader));
    }

    await Promise.all(tasks);
  }, []);

  // Focus Mode: minimize on game start, restore on game exit
  useEffect(() => {
    const appWindow = getCurrentWindow();
    const wasMaximized = { current: false };
    const wasFullscreen = { current: false };

    const unlistenStart = listen<{ pid: number }>("game-started", async (event) => {
      setGamePid(event.payload?.pid ?? null);
      try {
        await tauri.discordClearActivity();
      } catch {
        // ignore discord errors
      }
      if (!gameSettings.focusMode) return;
      try {
        wasMaximized.current = await appWindow.isMaximized();
        wasFullscreen.current = await appWindow.isFullscreen();
        if (wasFullscreen.current) {
          await appWindow.setFullscreen(false);
        }
        await appWindow.minimize();
      } catch {
        // ignore window errors
      }
    });

    const unlistenExit = listen<{ pid: number; code?: number | null }>("game-exited", async () => {
      setGamePid(null);
      void setLauncherPresence("Gestionando instancias");
      if (!gameSettings.focusMode) return;
      try {
        await appWindow.show();
        await appWindow.unminimize();
        if (wasFullscreen.current) {
          await appWindow.setFullscreen(true);
        } else if (wasMaximized.current) {
          await appWindow.maximize();
        }
        await appWindow.setFocus();
      } catch {
        // ignore window errors
      }
    });

    return () => {
      unlistenStart.then((f) => f());
      unlistenExit.then((f) => f());
    };
  }, [gameSettings.focusMode, setLauncherPresence]);

  // Boot
  useEffect(() => {
    const splashTimer = window.setTimeout(() => {
      void closeSplash();
    }, 700);

    (async () => {
      try {
        const java = await tauri.detectSystemJava();
        setSystemJava(java);
      } catch (e) {
        console.error(e);
      }
      await refreshInstalledVersions();
      const list = await refreshInstances();
      void prefetchCatalog(list.map((item) => item.loader));
      await closeSplash();
    })();

    return () => {
      window.clearTimeout(splashTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeSplash, prefetchCatalog]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void checkForUpdates(true);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [checkForUpdates]);

  useEffect(() => {
    if (!userProfile) return;
    void setLauncherPresence("Gestionando instancias");
  }, [userProfile, setLauncherPresence]);

  // Restaurar sesion en backend (CURRENT_PROFILE)
  useEffect(() => {
    if (!persisted.userProfile) return;
    (async () => {
      try {
        if (persisted.userProfile!.is_offline) {
          const res = await tauri.loginOffline(persisted.userProfile!.name);
          const parsed = JSON.parse(res) as MinecraftProfile;
          setUserProfile(parsed);
          setAuthMode("offline");
        } else {
          const res = await tauri.restoreMsSession();
          const parsed = JSON.parse(res) as MinecraftProfile;
          setUserProfile(parsed);
          setAuthMode("microsoft");
        }
      } catch (e: any) {
        setUserProfile(null);
        setAuthError("No se pudo restaurar sesion: " + String(e));
      }
    })();
  }, [persisted.userProfile]);

  // Persist session
  useEffect(() => saveSession({ userProfile }), [userProfile]);
  useEffect(() => saveSession({ selectedInstanceId }), [selectedInstanceId]);
  useEffect(() => saveSession({ showSnapshots }), [showSnapshots]);
  useEffect(() => saveSession({ gameSettings }), [gameSettings]);

  const refreshInstalledVersions = async () => {
    try {
      const installed = await tauri.getInstalledVersions();
      setInstalledVersions(installed);
    } catch (err) {
      console.error("Error cargando instaladas", err);
      showToast("No se pudieron cargar las versiones instaladas.", "error");
    }
  };

  const refreshInstances = async (): Promise<InstanceSummary[]> => {
    setInstancesLoading(true);
    try {
      const list = await tauri.listInstances();
      setInstances(list);
      if (!selectedInstanceId && list.length > 0) {
        setSelectedInstanceId(list[0].id);
      } else if (selectedInstanceId && !list.find((i) => i.id === selectedInstanceId)) {
        setSelectedInstanceId(list[0]?.id || "");
      }
      return list;
    } catch (err) {
      console.error("Error cargando instancias", err);
      showToast("No se pudieron cargar las instancias.", "error");
      return [];
    } finally {
      setInstancesLoading(false);
    }
  };

  const loadMojangVersions = async () => {
    if (mojangVersions.length > 0) return;
    setGlobalStatus("Cargando lista de Mojang...");
    try {
      const ids = await tauri.getVersions();
      setMojangVersions(ids.map((id) => ({ id, type: inferVersionType(id) })));
      setGlobalStatus("");
    } catch (err: any) {
      setGlobalStatus("Error: no se pudo cargar la lista de Mojang. " + String(err));
    }
  };

  const navigate = async (v: View) => {
    setCurrentView(v);
    if (v === "instances") {
      await refreshInstances();
      await loadMojangVersions();
    }
    if (v === "catalog" || v === "modpacks") {
      await refreshInstances();
    }
  };

  const selectedInstance = useMemo(
    () => instances.find((i) => i.id === selectedInstanceId) || null,
    [instances, selectedInstanceId]
  );

  const handleInstallVanilla = async (versionId: string) => {
    setIsProcessing(true);
    setProgress(0);
    setCurrentView("dashboard");
    setGlobalStatus(`Iniciando instalación de ${versionId}...`);

    try {
      await tauri.getVersionMetadata(versionId);
      await tauri.downloadClient(versionId);
      await tauri.downloadGameFiles(versionId);
      await refreshInstalledVersions();
      setGlobalStatus("Listo: instalación completada. Crea una instancia para jugar.");
    } catch (err: any) {
      setGlobalStatus("Error: instalación fallida. " + String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInstallForge = async (versionId: string, isSnapshot: boolean) => {
    if (isSnapshot) return;
    setIsProcessing(true);
    setProgress(0);
    setCurrentView("dashboard");
    setGlobalStatus(`Instalando Forge para ${versionId}...`);
    try {
      const forgeId = await tauri.installForge(versionId);
      await refreshInstalledVersions();
      setGlobalStatus(`Listo: Forge instalado (${forgeId}). Crea una instancia para jugar.`);
    } catch (err: any) {
      setGlobalStatus("Error: instalación de Forge. " + String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInstallFabric = async (versionId: string, isSnapshot: boolean) => {
    if (isSnapshot) return;
    setIsProcessing(true);
    setProgress(0);
    setCurrentView("dashboard");
    setGlobalStatus(`Instalando Fabric para ${versionId}...`);
    try {
      const fabricId = await tauri.installFabric(versionId);
      await refreshInstalledVersions();
      setGlobalStatus(`Listo: Fabric instalado (${fabricId}). Crea una instancia para jugar.`);
    } catch (err: any) {
      setGlobalStatus("Error: instalación de Fabric. " + String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const launchInstance = async (instance: InstanceSummary) => {
    const versionId = instance.version;
    const isModded = versionId.includes("forge") || versionId.includes("neoforge") || versionId.includes("fabric");
    setPendingInstanceId(instance.id);
    setIsProcessing(true);
    setProgress(0);
    setGlobalStatus("Validando archivos...");
    void setLauncherPresence("Lanzando Minecraft...");

    try {
      if (!isModded) {
        await tauri.getVersionMetadata(versionId);
      }

      setGlobalStatus(`Lanzando ${versionId}...`);
      await tauri.launchGame(versionId, gameSettings, instance.id);
      setErrorInstanceIds((prev) => {
        const next = new Set(prev);
        next.delete(instance.id);
        return next;
      });
    } catch (err: any) {
      const message = String(err);
      setGlobalStatus("Error: lanzamiento fallido. " + message);
      void setLauncherPresence("Gestionando instancias");
      setErrorInstanceIds((prev) => {
        const next = new Set(prev);
        next.add(instance.id);
        return next;
      });
      if (message.includes("Auto-repair aplicado")) {
        showToast("Auto-repair aplicado. Intenta lanzar otra vez.", "success");
      } else if (message.includes("Auto-repair fallo")) {
        showToast("Auto-repair fallo. Revisa Logs/Crash.", "error");
      }
      const lower = message.toLowerCase();
      if (lower.includes("java") || lower.includes("adoptium") || lower.includes("runtime")) {
        setShowJavaPrompt(true);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInstallNeoForge = async (versionId: string, isSnapshot: boolean) => {
    if (isSnapshot) return;
    setIsProcessing(true);
    setProgress(0);
    setCurrentView("dashboard");
    setGlobalStatus(`Instalando NeoForge para ${versionId}...`);
    try {
      const neoforgeId = await tauri.installNeoForge(versionId);
      await refreshInstalledVersions();
      setGlobalStatus(`Listo: NeoForge instalado (${neoforgeId}). Crea una instancia para jugar.`);
    } catch (err: any) {
      setGlobalStatus("Error: instalación de NeoForge. " + String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRepairSelected = async () => {
    if (!selectedInstance) {
      setGlobalStatus("Error: selecciona una instancia primero.");
      return;
    }
    setIsProcessing(true);
    setGlobalStatus("Reparando instancia...");
    try {
      const msg = await tauri.repairInstance(selectedInstance.id);
      setGlobalStatus(msg);
      setErrorInstanceIds((prev) => {
        const next = new Set(prev);
        next.delete(selectedInstance.id);
        return next;
      });
    } catch (e: any) {
      setGlobalStatus("Error: reparación fallida. " + String(e));
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePlayClick = async () => {
    if (!selectedInstance) {
      setGlobalStatus("Error: selecciona una instancia primero.");
      return;
    }
    await launchInstance(selectedInstance);
  };

  const handleJavaRetryDownload = async () => {
    setShowJavaPrompt(false);
    setIsProcessing(true);
    try {
      const target = instances.find((i) => i.id === pendingInstanceId) || selectedInstance;
      const baseVersion = target ? extractBaseVersion(target.version) : undefined;
      await tauri.downloadJava(baseVersion);
      if (target) {
        await tauri.launchGame(target.version, gameSettings, target.id);
      }
    } catch (err: any) {
      setGlobalStatus("Error: Java. " + String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const loginOffline = async () => {
    if (!offlineUsername.trim()) return;
    try {
      setAuthError("");
      const res = await tauri.loginOffline(offlineUsername.trim());
      const parsed = JSON.parse(res) as MinecraftProfile;
      setUserProfile(parsed);
      setAuthMode("offline");
    } catch (e: any) {
      setAuthError(String(e));
    }
  };

  const loginMicrosoft = (profile: MinecraftProfile) => {
    setUserProfile(profile);
    setAuthMode("microsoft");
  };

  const logout = async () => {
    if (!userProfile) return;
    if (!userProfile.is_offline) {
      try {
        await tauri.logoutSession();
      } catch (e) {
        console.error(e);
      }
    }
    setUserProfile(null);
    setCurrentView("dashboard");
    setAuthError("");
  };

  const refreshOnlineProfile = async () => {
    if (!userProfile || userProfile.is_offline) return;
    try {
      const res = await tauri.refreshMsProfile();
      const parsed = JSON.parse(res) as MinecraftProfile;
      setUserProfile(parsed);
    } catch (e) {
      console.error(e);
    }
  };

  // UX actions
  const openInstanceFolder = async (id?: string) => {
    const target = id || selectedInstanceId;
    if (!target) {
      setGlobalStatus("Error: selecciona una instancia primero.");
      return;
    }
    try {
      await tauri.openInstanceFolder(target);
    } catch (e) {
      setGlobalStatus("Error: no se pudo abrir la carpeta.");
    }
  };

  const createInstance = async (payload: {
    name: string;
    version: string;
    loader: "vanilla" | "snapshot" | "forge" | "neoforge" | "fabric";
    thumbnail?: string;
    tags?: string[];
  }) => {

    setIsProcessing(true);
    setProgress(0);
    setGlobalStatus("Preparando instancia...");
    try {
      let versionId = payload.version;
      if (payload.loader === "forge") {
        setGlobalStatus("Instalando Forge...");
        versionId = await tauri.installForge(payload.version);
      } else if (payload.loader === "neoforge") {
        setGlobalStatus("Instalando NeoForge...");
        versionId = await tauri.installNeoForge(payload.version);
      } else if (payload.loader === "fabric") {
        setGlobalStatus("Instalando Fabric...");
        versionId = await tauri.installFabric(payload.version);
      } else {
        setGlobalStatus("Descargando archivos...");
        await tauri.getVersionMetadata(versionId);
        await tauri.downloadClient(versionId);
        await tauri.downloadGameFiles(versionId);
      }

      const created = await tauri.createInstance({ ...payload, version: versionId });
      setInstances((prev) => [created, ...prev]);
      setSelectedInstanceId(created.id);
      setGlobalStatus("Instancia creada.");
      if ((payload.loader === "forge" || payload.loader === "neoforge" || payload.loader === "fabric") && !created.tags?.includes("modpack")) {
        const ok = await askConfirm({
          title: "Optimizar instancia",
          message: "Quieres optimizar esta instancia ahora?",
          confirmLabel: "Optimizar",
          cancelLabel: "Ahora no",
        });
        if (ok) {
          const baseVersion = extractBaseVersion(created.version);
          const msg = await tauri.applyOptimizationPack(created.id, created.loader, baseVersion, "balanced");
          setGlobalStatus(msg);
        }
      }
    } catch (e: any) {
      setGlobalStatus("Error: no se pudo crear la instancia. " + String(e));
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteInstance = async (id: string) => {
    const target = instances.find((i) => i.id === id);
    const name = target?.name || "esta instancia";
    const ok = await askConfirm({
      title: "Eliminar instancia",
      message: `Eliminar ${name}?`,
      confirmLabel: "Eliminar",
      cancelLabel: "Cancelar",
      danger: true,
    });
    if (!ok) return;

    try {
      await tauri.deleteInstance(id);
      await refreshInstances();
      setErrorInstanceIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setGlobalStatus("Instancia eliminada.");
    } catch (e: any) {
      setGlobalStatus("Error: no se pudo eliminar la instancia. " + String(e));
    }
  };

  // ----- RENDER -----
  const updateModal = (
    <UpdateModal
      open={Boolean(updateInfo)}
      version={updateInfo?.version ?? ""}
      notes={updateInfo?.body ?? ""}
      date={updateInfo?.date ?? ""}
      isDownloading={updateBusy}
      error={updateError}
      onUpdate={handleUpdateNow}
      onLater={handleUpdateLater}
    />
  );

  if (!userProfile) {
    return (
      <>
        <LoginView
          authMode={authMode}
          setAuthMode={setAuthMode}
          offlineUsername={offlineUsername}
          setOfflineUsername={setOfflineUsername}
          onLoginOffline={loginOffline}
          onLoginMicrosoft={loginMicrosoft}
          authError={authError}
          setAuthError={setAuthError}
        />
        {updateModal}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex font-body overflow-hidden">
      <Sidebar
        currentView={currentView}
        onNavigate={navigate}
        userProfile={userProfile}
        onLogout={logout}
        isProcessing={isProcessing}
        isGameRunning={Boolean(gamePid)}
      />

      <div className="flex-1 relative flex flex-col bg-gray-950 overflow-hidden">
        <GlobalProgress
          isProcessing={isProcessing}
          status={globalStatus}
          progress={progress}
          isActive={progressActive}
        />
        {toast && (
          <div
            className={`fixed right-6 top-6 z-50 rounded-xl border px-4 py-3 text-sm shadow-lg ${
              toast.kind === "success"
                ? "bg-emerald-900/80 border-emerald-700 text-emerald-100"
                : toast.kind === "error"
                  ? "bg-red-900/80 border-red-700 text-red-100"
                  : "bg-gray-900/80 border-gray-700 text-gray-100"
            }`}
          >
            {toast.message}
          </div>
        )}
        {currentView === "dashboard" && (
          <DashboardView
            instances={instances}
            selectedInstanceId={selectedInstanceId}
            onSelectInstance={setSelectedInstanceId}
            isProcessing={isProcessing}
            globalStatus={globalStatus}
            onPlay={handlePlayClick}
            onGoInstances={() => navigate("instances")}
            onRepairInstance={handleRepairSelected}
            systemJava={systemJava}
            settings={gameSettings}
            gamePid={gamePid}
            progress={progress}
          />
        )}

        {currentView === "manager" && (
          <ManagerView
            mojangVersions={mojangVersions}
            installedVersions={installedVersions}
            showSnapshots={showSnapshots}
            setShowSnapshots={setShowSnapshots}
            onInstallVanilla={handleInstallVanilla}
            onInstallForge={handleInstallForge}
            onInstallNeoForge={handleInstallNeoForge}
            onInstallFabric={handleInstallFabric}
          />
        )}

        {currentView === "instances" && (
          <InstancesView
            instances={instances}
            availableVersions={mojangVersions}
            selectedInstanceId={selectedInstanceId}
            errorInstanceIds={errorInstanceIds}
            onSelectInstance={setSelectedInstanceId}
            onCreateInstance={createInstance}
            onPlayInstance={(id) => {
              const inst = instances.find((i) => i.id === id);
              if (inst) {
                setSelectedInstanceId(inst.id);
                launchInstance(inst);
              }
            }}
            onOpenInstance={(id) => openInstanceFolder(id)}
            onDeleteInstance={deleteInstance}
            onLoadVersions={loadMojangVersions}
            onConfirm={askConfirm}
            isProcessing={isProcessing}
            isLoading={instancesLoading}
            globalStatus={globalStatus}
          />
        )}

        {currentView === "catalog" && (
          <CatalogView
            instances={instances}
            selectedInstanceId={selectedInstanceId}
            onSelectInstance={setSelectedInstanceId}
            onGoInstances={() => navigate("instances")}
            onRefreshInstances={refreshInstances}
            onConfirm={askConfirm}
            progressLabel={globalStatus}
            hiddenProjectTypes={["modpack"]}
          />
        )}

        {currentView === "settings" && (
          <SettingsView
            settings={gameSettings}
            onChange={setGameSettings}
          />
        )}

        {currentView === "skins" && (
          <SkinsView
            userProfile={userProfile}
            onRefreshOnline={refreshOnlineProfile}
          />
        )}
        {currentView === "modpacks" && (
          <CatalogView
            instances={instances}
            selectedInstanceId={selectedInstanceId}
            onSelectInstance={setSelectedInstanceId}
            onRefreshInstances={refreshInstances}
            onGoInstances={() => navigate("instances")}
            onGoPlay={() => navigate("dashboard")}
            onConfirm={askConfirm}
            progressLabel={globalStatus}
            lockedProjectType="modpack"
            title="Modpacks"
            subtitle="Instala modpacks completos y crea una instancia lista para jugar."
            lockSource="modrinth"
          />
        )}

        <JavaModal open={showJavaPrompt} onRetryDownload={handleJavaRetryDownload} onClose={() => setShowJavaPrompt(false)} />
        <ConfirmModal
          open={Boolean(confirmState)}
          title={confirmState?.title || "Confirmar"}
          message={confirmState?.message || ""}
          confirmLabel={confirmState?.confirmLabel}
          cancelLabel={confirmState?.cancelLabel}
          danger={confirmState?.danger}
          onConfirm={() => resolveConfirm(true)}
          onCancel={() => resolveConfirm(false)}
        />
        {updateModal}

      </div>
    </div>
  );
}
