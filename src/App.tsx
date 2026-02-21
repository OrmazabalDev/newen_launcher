import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameSettings, ProgressPayload, SystemJava, VersionItem, View } from "./types";
import { inferVersionType } from "./utils/versioning";

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
import { useConfirm } from "./hooks/useConfirm";
import { useToast } from "./hooks/useToast";
import { useLauncherPresence } from "./hooks/useLauncherPresence";
import { useFocusMode } from "./hooks/useFocusMode";
import { useAppBoot } from "./hooks/useAppBoot";
import { useInstances } from "./hooks/useInstances";
import { useAuth } from "./hooks/useAuth";
import { useUpdates } from "./hooks/useUpdates";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import * as tauri from "./services/tauri";
import { loadSession, saveSession } from "./store/sessionStore";

export default function App() {
  // Estado persistido de la sesion (localStorage).
  const persisted = useMemo(() => loadSession(), []);

  // UI: vista actual.
  const [currentView, setCurrentView] = useState<View>("dashboard");

  // Versiones disponibles / instaladas.
  const [installedVersions, setInstalledVersions] = useState<string[]>([]);
  const [mojangVersions, setMojangVersions] = useState<VersionItem[]>([]);

  // Estado global y progreso de tareas.
  const [globalStatus, setGlobalStatus] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [progressActive, setProgressActive] = useState(false);
  const progressTimer = useRef<number | null>(null);
  const [gamePid, setGamePid] = useState<number | null>(null);

  // Java detectado en el sistema.
  const [systemJava, setSystemJava] = useState<SystemJava | null>(null);

  // Configuracion del juego.
  const [gameSettings, setGameSettings] = useState<GameSettings>(persisted.gameSettings);
  const [uiScale, setUiScale] = useState<number>(persisted.uiScale ?? 1);

  // Filtro de snapshots en Manager.
  const [showSnapshots, setShowSnapshots] = useState<boolean>(persisted.showSnapshots);

  // UI helpers.
  const { toast, showToast } = useToast();
  const { confirmState, askConfirm, resolveConfirm } = useConfirm();
  const { setLauncherPresence, setGamePresence, clearLauncherPresence } = useLauncherPresence(tauri);
  const [authError, setAuthError] = useState("");

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
    onPersist: (profile) => saveSession({ userProfile: profile }),
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

  // Escucha progreso desde el backend (Tauri).
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
    };
  }, []);

  // Bloquea menu contextual para evitar acciones no deseadas.
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      event.preventDefault();
    };
    window.addEventListener("contextmenu", handler);
    return () => {
      window.removeEventListener("contextmenu", handler);
    };
  }, []);

  const refreshInstalledVersions = async () => {
    try {
      const installed = await tauri.getInstalledVersions();
      setInstalledVersions(installed);
    } catch (err) {
      console.error("Error cargando instaladas", err);
      showToast("No se pudieron cargar las versiones instaladas.", "error");
    }
  };

  // Focus Mode: minimizar al iniciar juego y restaurar al salir.
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

  // Boot del launcher (splash, Java, instancias, prefetch).
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

  // Persistencia de session local.
  useEffect(() => saveSession({ selectedInstanceId }), [selectedInstanceId]);
  useEffect(() => saveSession({ showSnapshots }), [showSnapshots]);
  useEffect(() => saveSession({ gameSettings }), [gameSettings]);
  useEffect(() => saveSession({ uiScale }), [uiScale]);

  useEffect(() => {
    const scale = Math.max(0.85, Math.min(1.3, uiScale || 1));
    document.documentElement.style.zoom = String(scale);
  }, [uiScale]);

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

  // Navegacion entre vistas con pre-cargas necesarias.
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

  const handleRefreshInstances = useCallback(async () => {
    await refreshInstances();
  }, [refreshInstances]);

  // Instalacion de versiones vanilla.
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

  // Instalacion de Forge.
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

  // Instalacion de Fabric.
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

  // Instalacion de NeoForge.
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

  // Logout con limpieza de vista actual.
  const handleLogout = async () => {
    await logout();
    setCurrentView("dashboard");
    setAuthError("");
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
        onLogout={handleLogout}
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
            role="status"
            aria-live="polite"
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
            onPlay={playSelectedInstance}
            onGoInstances={() => navigate("instances")}
            onRepairInstance={repairSelectedInstance}
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
            onOpenInstance={openInstanceFolder}
            onDeleteInstance={deleteInstance}
            onLoadVersions={loadMojangVersions}
            onConfirm={askConfirm}
            onRefreshInstances={refreshInstances}
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
            onRefreshInstances={handleRefreshInstances}
            onConfirm={askConfirm}
            progressLabel={globalStatus}
            hiddenProjectTypes={["modpack"]}
          />
        )}

        {currentView === "settings" && (
          <SettingsView
            settings={gameSettings}
            onChange={setGameSettings}
            uiScale={uiScale}
            onChangeUiScale={setUiScale}
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
            onRefreshInstances={handleRefreshInstances}
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

        <JavaModal open={showJavaPrompt} onRetryDownload={retryJavaDownload} onClose={closeJavaPrompt} />
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



