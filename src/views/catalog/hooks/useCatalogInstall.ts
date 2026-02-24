import { useCallback, useEffect, useState } from "react";
import type { InstanceContentItem, InstanceSummary, ModrinthProjectHit } from "../../../types";
import * as catalogApi from "../api";
import type { ProjectType } from "../constants";
import { formatLoaderLabel } from "../utils";
import type { ConfirmOptions } from "../types";
import type { CatalogToastState } from "./useCatalogToast";

type ShowToast = (
  payload: Omit<CatalogToastState, "kind"> & { kind?: CatalogToastState["kind"] }
) => void;

type CatalogInstallArgs = {
  projectType: ProjectType;
  projectTypeLabel: string;
  selectedProject: ModrinthProjectHit | null;
  selectedInstance: InstanceSummary | null;
  loader?: string;
  gameVersionFilter?: string;
  availableLoaders: string[];
  contentKind: "mods" | "resourcepacks" | "shaderpacks" | null;
  requiresInstance: boolean;
  selectedWorldId: string;
  worlds: string[];
  worldsLoading: boolean;
  onConfirm: (opts: ConfirmOptions) => Promise<boolean>;
  onRefreshInstances?: () => void | Promise<void>;
  onSelectInstance: (id: string) => void;
  onGoPlay?: () => void;
  onGoInstances?: () => void;
  showToast: ShowToast;
  closeProjectModal: () => void;
  setStatus: (value: string) => void;
  setLoading: (value: boolean) => void;
  setInstalledItems: (items: InstanceContentItem[]) => void;
};

export function useCatalogInstall({
  projectType,
  projectTypeLabel,
  selectedProject,
  selectedInstance,
  loader,
  gameVersionFilter,
  availableLoaders,
  contentKind,
  requiresInstance,
  selectedWorldId,
  worlds,
  worldsLoading,
  onConfirm,
  onRefreshInstances,
  onSelectInstance,
  onGoPlay,
  onGoInstances,
  showToast,
  closeProjectModal,
  setStatus,
  setLoading,
  setInstalledItems,
}: CatalogInstallArgs) {
  const [installingVersionId, setInstallingVersionId] = useState<string | null>(null);

  const refreshInstalledItems = useCallback(async () => {
    if (!requiresInstance || !selectedInstance || !contentKind) {
      setInstalledItems([]);
      return;
    }
    try {
      const items = await catalogApi.listInstanceContent(selectedInstance.id, contentKind);
      setInstalledItems(items);
    } catch {
      setInstalledItems([]);
    }
  }, [contentKind, requiresInstance, selectedInstance, setInstalledItems]);

  useEffect(() => {
    void refreshInstalledItems();
  }, [refreshInstalledItems]);

  const handleInstall = useCallback(
    async (versionId: string) => {
      if (installingVersionId) return;
      if (projectType === "datapack") {
        if (!selectedInstance) {
          setStatus("Selecciona una instancia para instalar datapacks.");
          return;
        }
        if (!selectedWorldId) {
          if (worldsLoading) {
            setStatus("Cargando mundos...");
          } else if (worlds.length === 0) {
            setStatus("No hay mundos disponibles. Crea uno primero.");
          } else {
            setStatus("Selecciona un mundo para instalar el datapack.");
          }
          return;
        }
        setInstallingVersionId(versionId);
        setLoading(true);
        setStatus("Instalando datapack...");
        try {
          const msg = await catalogApi.modrinthInstallDatapack(
            selectedInstance.id,
            selectedWorldId,
            versionId
          );
          setStatus(msg);
          showToast({
            message: "Datapack instalado.",
            kind: "success",
            actionLabel: "Abrir carpeta",
            action: {
              type: "open-datapacks",
              instanceId: selectedInstance.id,
              worldId: selectedWorldId,
            },
          });
        } catch (e: unknown) {
          setStatus("Error instalando datapack: " + String(e));
          showToast({ message: "No se pudo instalar el datapack.", kind: "error" });
        } finally {
          setLoading(false);
          setInstallingVersionId(null);
        }
        return;
      }
      if (projectType === "modpack") {
        if (!selectedProject) {
          setStatus("Selecciona un modpack primero.");
          return;
        }
        const ok = await onConfirm({
          title: "Instalar modpack",
          message: "Antes de instalar un modpack se recomienda hacer backup. Continuar?",
          confirmLabel: "Instalar",
          cancelLabel: "Cancelar",
        } as ConfirmOptions);
        if (!ok) {
          setStatus("Instalación cancelada.");
          return;
        }
        setInstallingVersionId(versionId);
        setLoading(true);
        setStatus("Creando instancia del modpack...");
        try {
          const created = await catalogApi.modrinthInstallModpackWithBackup(
            versionId,
            selectedProject.title,
            selectedProject.icon_url || undefined,
            true
          );
          if (onRefreshInstances) {
            await onRefreshInstances();
          }
          onSelectInstance(created.id);
          setStatus(`Modpack instalado en la instancia "${created.name}".`);
          showToast({
            message: "Modpack instalado.",
            kind: "success",
            actionLabel: "Abrir carpeta",
            action: { type: "open-instance", instanceId: created.id },
          });
          closeProjectModal();
          if (onGoPlay) {
            onGoPlay();
          } else if (onGoInstances) {
            onGoInstances();
          }
        } catch (e: unknown) {
          setStatus(
            "Error instalando modpack: " +
              String(e) +
              ". Prueba con otra versión, verifica tu conexión o revisa la carpeta de logs."
          );
          showToast({ message: "No se pudo instalar el modpack.", kind: "error" });
        } finally {
          setLoading(false);
          setInstallingVersionId(null);
        }
        return;
      }
      const instance = selectedInstance;
      if (!instance) {
        setStatus(
          projectType === "mod"
            ? "Selecciona una instancia Forge, NeoForge o Fabric para instalar mods."
            : "Selecciona una instancia para instalar contenido."
        );
        return;
      }
      const verb = projectType === "mod" ? "Instalando" : "Descargando";
      setInstallingVersionId(versionId);
      setLoading(true);
      setStatus(`${verb} ${String(projectTypeLabel).toLowerCase()}...`);
      try {
        const msg = await catalogApi.modrinthInstallVersion(
          instance.id,
          versionId,
          loader,
          gameVersionFilter,
          projectType
        );
        setStatus(msg);
        await refreshInstalledItems();
        if (contentKind) {
          showToast({
            message: "Instalación completada.",
            kind: "success",
            actionLabel: "Abrir carpeta",
            action: { type: "open-content", instanceId: instance.id, kind: contentKind },
          });
        } else {
          showToast({ message: "Instalación completada.", kind: "success" });
        }
      } catch (e: unknown) {
        const errorMessage = String(e);
        const available = availableLoaders.map((entry) => entry.toLowerCase());
        const hasFabricCompat =
          available.includes("fabric") ||
          available.includes("quilt") ||
          available.includes("quilt-loader");
        const isLoaderCompatible =
          !loader || available.length === 0
            ? null
            : loader === "fabric"
              ? hasFabricCompat
              : available.includes(loader);
        let suggestedLoader: string | null = null;
        if (isLoaderCompatible === false) {
          if (hasFabricCompat) suggestedLoader = "Fabric";
          else if (available.includes("neoforge")) suggestedLoader = "NeoForge";
          else if (available.includes("forge")) suggestedLoader = "Forge";
        }
        if (suggestedLoader) {
          const loaderLabelText = loader ? formatLoaderLabel(loader) : "este loader";
          setStatus(
            `No compatible con ${loaderLabelText}. Cambia a una instancia ${suggestedLoader}.`
          );
          if (onGoInstances) {
            showToast({
              message: `Cambia a una instancia ${suggestedLoader}.`,
              kind: "error",
              actionLabel: `Cambiar a ${suggestedLoader}`,
              action: { type: "go-instances" },
            });
          } else {
            showToast({ message: `Cambia a una instancia ${suggestedLoader}.`, kind: "error" });
          }
        } else {
          setStatus("Error instalando: " + errorMessage);
          showToast({ message: "No se pudo instalar.", kind: "error" });
        }
      } finally {
        setLoading(false);
        setInstallingVersionId(null);
      }
    },
    [
      availableLoaders,
      closeProjectModal,
      contentKind,
      gameVersionFilter,
      installingVersionId,
      loader,
      onConfirm,
      onGoInstances,
      onGoPlay,
      onRefreshInstances,
      onSelectInstance,
      projectType,
      projectTypeLabel,
      refreshInstalledItems,
      selectedInstance,
      selectedProject,
      selectedWorldId,
      setLoading,
      setStatus,
      showToast,
      worlds,
      worldsLoading,
    ]
  );

  return {
    installingVersionId,
    handleInstall,
    refreshInstalledItems,
  };
}
