import { useCallback, useEffect, useState } from "react";
import type { InstanceSummary } from "../../../types";
import * as catalogApi from "../api";
import type { CatalogToastState } from "./useCatalogToast";

type ShowToast = (
  payload: Omit<CatalogToastState, "kind"> & { kind?: CatalogToastState["kind"] }
) => void;

type CatalogWorldsArgs = {
  isModModalOpen: boolean;
  isDatapack: boolean;
  selectedInstance: InstanceSummary | null;
  showToast: ShowToast;
  setStatus: (value: string) => void;
};

export function useCatalogWorlds({
  isModModalOpen,
  isDatapack,
  selectedInstance,
  showToast,
  setStatus,
}: CatalogWorldsArgs) {
  const [worlds, setWorlds] = useState<string[]>([]);
  const [worldsLoading, setWorldsLoading] = useState(false);
  const [worldsError, setWorldsError] = useState("");
  const [selectedWorldId, setSelectedWorldId] = useState("");
  const [importingDatapack, setImportingDatapack] = useState(false);

  useEffect(() => {
    if (!isModModalOpen || !isDatapack || !selectedInstance) {
      setWorlds([]);
      setSelectedWorldId("");
      setWorldsError("");
      setWorldsLoading(false);
      return;
    }
    let cancelled = false;
    setWorldsLoading(true);
    setWorldsError("");
    catalogApi
      .listInstanceWorlds(selectedInstance.id)
      .then((list: string[]) => {
        if (cancelled) return;
        setWorlds(list);
        setSelectedWorldId((current) => {
          if (current && list.includes(current)) return current;
          return list[0] || "";
        });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setWorlds([]);
        setSelectedWorldId("");
        setWorldsError(String(e));
      })
      .finally(() => {
        if (!cancelled) setWorldsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isModModalOpen, isDatapack, selectedInstance, selectedInstance?.id]);

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
      reader.readAsDataURL(file);
    });

  const handleImportDatapack = useCallback(
    async (file: File) => {
      if (!isDatapack) return;
      if (!selectedInstance) {
        setStatus("Selecciona una instancia para importar datapacks.");
        return;
      }
      if (!selectedWorldId) {
        if (worldsLoading) {
          setStatus("Cargando mundos...");
        } else if (worlds.length === 0) {
          setStatus("No hay mundos disponibles. Crea uno primero.");
        } else {
          setStatus("Selecciona un mundo para importar el datapack.");
        }
        return;
      }
      if (!file.name.toLowerCase().endsWith(".zip")) {
        setStatus("Solo se permiten archivos .zip.");
        return;
      }
      setImportingDatapack(true);
      setStatus("Importando datapack...");
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const base64 = dataUrl.split(",")[1] || "";
        const msg = await catalogApi.importDatapackZip(
          selectedInstance.id,
          selectedWorldId,
          file.name,
          base64
        );
        setStatus(msg);
        showToast({
          message: "Datapack importado.",
          kind: "success",
          actionLabel: "Abrir carpeta",
          action: {
            type: "open-datapacks",
            instanceId: selectedInstance.id,
            worldId: selectedWorldId,
          },
        });
      } catch (e: unknown) {
        setStatus("Error importando datapack: " + String(e));
        showToast({ message: "No se pudo importar el datapack.", kind: "error" });
      } finally {
        setImportingDatapack(false);
      }
    },
    [
      isDatapack,
      selectedInstance,
      selectedWorldId,
      setStatus,
      showToast,
      worldsLoading,
      worlds,
    ]
  );

  return {
    worlds,
    worldsLoading,
    worldsError,
    selectedWorldId,
    setSelectedWorldId,
    importingDatapack,
    handleImportDatapack,
  };
}
