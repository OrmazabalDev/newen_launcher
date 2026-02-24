import { useCallback, useState } from "react";
import * as tauri from "../../services/tauri";

export function useInstanceActions({
  onRefreshInstances,
  onSelectInstance,
}: {
  onRefreshInstances?: () => void | Promise<void>;
  onSelectInstance: (id: string) => void;
}) {
  const [importingModpack, setImportingModpack] = useState(false);
  const [importStatus, setImportStatus] = useState("");

  const handleImportModpack = useCallback(
    async (file: File) => {
      setImportStatus("");
      setImportingModpack(true);
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const raw = String(reader.result || "");
            const marker = "base64,";
            const idx = raw.indexOf(marker);
            resolve(idx >= 0 ? raw.slice(idx + marker.length) : raw);
          };
          reader.onerror = () => reject(new Error("Error leyendo el archivo"));
          reader.readAsDataURL(file);
        });
        const name = file.name.replace(/\.mrpack$/i, "").replace(/\.zip$/i, "");
        const created = await tauri.importModpackMrpack(name, file.name, base64);
        await onRefreshInstances?.();
        onSelectInstance(created.id);
        setImportStatus(`Modpack importado: ${created.name}`);
      } catch (e) {
        setImportStatus("Error importando modpack: " + String(e));
      } finally {
        setImportingModpack(false);
      }
    },
    [onRefreshInstances, onSelectInstance]
  );

  const clearImportStatus = useCallback(() => {
    setImportStatus("");
  }, []);

  return {
    importingModpack,
    importStatus,
    handleImportModpack,
    clearImportStatus,
  };
}
