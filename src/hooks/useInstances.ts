import { useCallback, useMemo, useState } from "react";
import type { GameSettings, InstanceSummary, LoaderType } from "../types";
import type { ConfirmOptions } from "./useConfirm";
import type { ToastKind } from "./useToast";
import { extractBaseVersion } from "../utils/versioning";

export interface InstancesApi {
  listInstances: () => Promise<InstanceSummary[]>;
  createInstance: (payload: {
    name: string;
    version: string;
    loader: LoaderType;
    thumbnail?: string;
    tags?: string[];
  }) => Promise<InstanceSummary>;
  deleteInstance: (instanceId: string) => Promise<void>;
  openInstanceFolder: (instanceId: string) => Promise<void>;
  launchGame: (versionId: string, settings: GameSettings, instanceId?: string) => Promise<void>;
  getVersionMetadata: (versionId: string) => Promise<void>;
  downloadClient: (versionId: string) => Promise<void>;
  downloadGameFiles: (versionId: string) => Promise<void>;
  downloadJava: (versionId?: string) => Promise<void>;
  repairInstance: (instanceId: string) => Promise<string>;
  applyOptimizationPack: (instanceId: string, loader: string, gameVersion: string, preset?: string) => Promise<string>;
  installForge: (versionId: string) => Promise<string>;
  installNeoForge: (versionId: string) => Promise<string>;
  installFabric: (versionId: string) => Promise<string>;
}

export interface CreateInstancePayload {
  name: string;
  version: string;
  loader: LoaderType;
  thumbnail?: string;
  tags?: string[];
}

export interface UseInstancesOptions {
  api: InstancesApi;
  gameSettings: GameSettings;
  initialSelectedInstanceId?: string;
  onGlobalStatus: (message: string) => void;
  onProcessingChange: (value: boolean) => void;
  onProgressChange: (value: number) => void;
  showToast: (message: string, kind?: ToastKind) => void;
  askConfirm: (options: ConfirmOptions) => Promise<boolean>;
  setLauncherPresence: (state: string) => Promise<void>;
}

export interface UseInstancesResult {
  instances: InstanceSummary[];
  instancesLoading: boolean;
  selectedInstanceId: string;
  setSelectedInstanceId: (value: string) => void;
  selectedInstance: InstanceSummary | null;
  errorInstanceIds: Set<string>;
  showJavaPrompt: boolean;
  closeJavaPrompt: () => void;
  refreshInstances: () => Promise<InstanceSummary[]>;
  createInstance: (payload: CreateInstancePayload) => Promise<void>;
  deleteInstance: (id: string) => Promise<void>;
  openInstanceFolder: (id?: string) => Promise<void>;
  launchInstance: (instance: InstanceSummary) => Promise<void>;
  repairSelectedInstance: () => Promise<void>;
  playSelectedInstance: () => Promise<void>;
  retryJavaDownload: () => Promise<void>;
}

/**
 * Encapsula el estado y las operaciones relacionadas con instancias.
 */
export function useInstances(options: UseInstancesOptions): UseInstancesResult {
  const {
    api,
    gameSettings,
    initialSelectedInstanceId,
    onGlobalStatus,
    onProcessingChange,
    onProgressChange,
    showToast,
    askConfirm,
    setLauncherPresence,
  } = options;

  const [instances, setInstances] = useState<InstanceSummary[]>([]);
  const [instancesLoading, setInstancesLoading] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>(initialSelectedInstanceId ?? "");
  const [pendingInstanceId, setPendingInstanceId] = useState<string>("");
  const [errorInstanceIds, setErrorInstanceIds] = useState<Set<string>>(new Set());
  const [showJavaPrompt, setShowJavaPrompt] = useState(false);

  const selectedInstance = useMemo(
    () => instances.find((instance) => instance.id === selectedInstanceId) || null,
    [instances, selectedInstanceId]
  );

  const closeJavaPrompt = useCallback(() => {
    setShowJavaPrompt(false);
  }, []);

  const refreshInstances = useCallback(async (): Promise<InstanceSummary[]> => {
    setInstancesLoading(true);
    try {
      const list = await api.listInstances();
      setInstances(list);
      setSelectedInstanceId((current) => {
        if (!current && list.length > 0) {
          return list[0].id;
        }
        if (current && !list.find((item) => item.id === current)) {
          return list[0]?.id || "";
        }
        return current;
      });
      return list;
    } catch (err) {
      console.error("Error cargando instancias", err);
      showToast("No se pudieron cargar las instancias.", "error");
      return [];
    } finally {
      setInstancesLoading(false);
    }
  }, [api, showToast]);

  const launchInstance = useCallback(
    async (instance: InstanceSummary) => {
      const versionId = instance.version;
      const isModded =
        versionId.includes("forge") || versionId.includes("neoforge") || versionId.includes("fabric");

      setPendingInstanceId(instance.id);
      onProcessingChange(true);
      onProgressChange(0);
      onGlobalStatus("Validando archivos...");
      void setLauncherPresence("Lanzando Minecraft...");

      try {
        if (!isModded) {
          await api.getVersionMetadata(versionId);
        }

        onGlobalStatus(`Lanzando ${versionId}...`);
        await api.launchGame(versionId, gameSettings, instance.id);
        setErrorInstanceIds((prev) => {
          const next = new Set(prev);
          next.delete(instance.id);
          return next;
        });
      } catch (err: any) {
        const message = String(err);
        onGlobalStatus("Error: lanzamiento fallido. " + message);
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
        onProcessingChange(false);
      }
    },
    [api, gameSettings, onGlobalStatus, onProcessingChange, onProgressChange, setLauncherPresence, showToast]
  );

  const playSelectedInstance = useCallback(async () => {
    if (!selectedInstance) {
      onGlobalStatus("Error: selecciona una instancia primero.");
      return;
    }
    await launchInstance(selectedInstance);
  }, [launchInstance, onGlobalStatus, selectedInstance]);

  const repairSelectedInstance = useCallback(async () => {
    if (!selectedInstance) {
      onGlobalStatus("Error: selecciona una instancia primero.");
      return;
    }
    onProcessingChange(true);
    onGlobalStatus("Reparando instancia...");
    try {
      const message = await api.repairInstance(selectedInstance.id);
      onGlobalStatus(message);
      setErrorInstanceIds((prev) => {
        const next = new Set(prev);
        next.delete(selectedInstance.id);
        return next;
      });
    } catch (err: any) {
      onGlobalStatus("Error: reparacion fallida. " + String(err));
    } finally {
      onProcessingChange(false);
    }
  }, [api, onGlobalStatus, onProcessingChange, selectedInstance]);

  const openInstanceFolder = useCallback(
    async (id?: string) => {
      const targetId = id || selectedInstanceId;
      if (!targetId) {
        onGlobalStatus("Error: selecciona una instancia primero.");
        return;
      }
      try {
        await api.openInstanceFolder(targetId);
      } catch {
        onGlobalStatus("Error: no se pudo abrir la carpeta.");
      }
    },
    [api, onGlobalStatus, selectedInstanceId]
  );

  const createInstance = useCallback(
    async (payload: CreateInstancePayload) => {
      onProcessingChange(true);
      onProgressChange(0);
      onGlobalStatus("Preparando instancia...");
      try {
        let versionId = payload.version;
        if (payload.loader === "forge") {
          onGlobalStatus("Instalando Forge...");
          versionId = await api.installForge(payload.version);
        } else if (payload.loader === "neoforge") {
          onGlobalStatus("Instalando NeoForge...");
          versionId = await api.installNeoForge(payload.version);
        } else if (payload.loader === "fabric") {
          onGlobalStatus("Instalando Fabric...");
          versionId = await api.installFabric(payload.version);
        } else {
          onGlobalStatus("Descargando archivos...");
          await api.getVersionMetadata(versionId);
          await api.downloadClient(versionId);
          await api.downloadGameFiles(versionId);
        }

        const created = await api.createInstance({ ...payload, version: versionId });
        setInstances((prev) => [created, ...prev]);
        setSelectedInstanceId(created.id);
        onGlobalStatus("Instancia creada.");

        const isModded =
          payload.loader === "forge" || payload.loader === "neoforge" || payload.loader === "fabric";
        if (isModded && !created.tags?.includes("modpack")) {
          const ok = await askConfirm({
            title: "Optimizar instancia",
            message: "Quieres optimizar esta instancia ahora?",
            confirmLabel: "Optimizar",
            cancelLabel: "Ahora no",
          });
          if (ok) {
            const baseVersion = extractBaseVersion(created.version);
            const message = await api.applyOptimizationPack(created.id, created.loader, baseVersion, "balanced");
            onGlobalStatus(message);
          }
        }
      } catch (err: any) {
        onGlobalStatus("Error: no se pudo crear la instancia. " + String(err));
      } finally {
        onProcessingChange(false);
      }
    },
    [api, askConfirm, onGlobalStatus, onProcessingChange, onProgressChange]
  );

  const deleteInstance = useCallback(
    async (id: string) => {
      const target = instances.find((item) => item.id === id);
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
        await api.deleteInstance(id);
        await refreshInstances();
        setErrorInstanceIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        onGlobalStatus("Instancia eliminada.");
      } catch (err: any) {
        onGlobalStatus("Error: no se pudo eliminar la instancia. " + String(err));
      }
    },
    [api, askConfirm, instances, onGlobalStatus, refreshInstances]
  );

  const retryJavaDownload = useCallback(async () => {
    setShowJavaPrompt(false);
    onProcessingChange(true);
    try {
      const target = instances.find((item) => item.id === pendingInstanceId) || selectedInstance;
      const baseVersion = target ? extractBaseVersion(target.version) : undefined;
      await api.downloadJava(baseVersion);
      if (target) {
        await api.launchGame(target.version, gameSettings, target.id);
      }
    } catch (err: any) {
      onGlobalStatus("Error: Java. " + String(err));
    } finally {
      onProcessingChange(false);
    }
  }, [api, gameSettings, instances, onGlobalStatus, onProcessingChange, pendingInstanceId, selectedInstance]);

  return {
    instances,
    instancesLoading,
    selectedInstanceId,
    setSelectedInstanceId,
    selectedInstance,
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
  };
}
