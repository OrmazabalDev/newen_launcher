import { useRef, useState } from "react";
import type { InstanceContentItem, InstanceLogEntry, InstanceSummary } from "../../types";
import * as tauri from "../../services/tauri";
import { useModalFocus } from "../../hooks/useModalFocus";
import { save } from "@tauri-apps/plugin-dialog";
import { ManageInstanceContentPanel } from "./ManageInstanceContentPanel";
import { ManageInstanceHeader } from "./ManageInstanceHeader";
import { ManageInstanceLogsPanel } from "./ManageInstanceLogsPanel";
import { ManageInstanceSidebar } from "./ManageInstanceSidebar";
import type { ConfirmOptions, ManageTab } from "./types";
import { extractBaseVersion } from "./utils";
import { useManageInstanceContent } from "./useManageInstanceContent";

export function ManageInstanceModal({
  instance,
  onClose,
  onConfirm,
  onDeleteInstance,
}: {
  instance: InstanceSummary;
  onClose: () => void;
  onConfirm: (opts: ConfirmOptions) => Promise<boolean>;
  onDeleteInstance: (id: string) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<ManageTab>("mods");
  const [selectedLog, setSelectedLog] = useState<InstanceLogEntry | null>(null);
  const [logContent, setLogContent] = useState("");
  const [status, setStatus] = useState<{
    message: string;
    kind: "success" | "info" | "error";
  } | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [exportingPack, setExportingPack] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  useModalFocus({ open: true, containerRef: dialogRef, initialFocusRef: closeRef, onClose });

  const {
    logs,
    loading,
    counts,
    contentQuery,
    setContentQuery,
    sortMode,
    setSortMode,
    filterSource,
    setFilterSource,
    filteredItems,
    reloadContent,
  } = useManageInstanceContent({
    instanceId: instance.id,
    tab,
    onStatus: setStatus,
  });

  const handleToggle = async (item: InstanceContentItem) => {
    try {
      await tauri.toggleInstanceContent(instance.id, tab, item.file_name, !item.enabled);
      await reloadContent();
    } catch (e) {
      setStatus({ message: String(e), kind: "error" });
    }
  };

  const handleDelete = async (item: InstanceContentItem) => {
    const extra = item.required_by.length ? ` Requerido por: ${item.required_by.join(", ")}` : "";
    const ok = await onConfirm({
      title: "Eliminar contenido",
      message: `Eliminar ${item.name}?${extra}`,
      confirmLabel: "Eliminar",
      cancelLabel: "Cancelar",
      danger: true,
    });
    if (!ok) return;
    try {
      await tauri.deleteInstanceContent(instance.id, tab, item.file_name);
      await reloadContent();
    } catch (e) {
      setStatus({ message: String(e), kind: "error" });
    }
  };

  const handleBulkToggle = async (enabled: boolean) => {
    if (tab === "logs") return;
    setBulkBusy(true);
    setStatus(null);
    try {
      const targets = filteredItems.filter((item) => item.enabled !== enabled);
      for (const item of targets) {
        await tauri.toggleInstanceContent(instance.id, tab, item.file_name, enabled);
      }
      await reloadContent();
      setStatus({
        message: enabled
          ? "Todos los elementos visibles fueron activados."
          : "Todos los elementos visibles fueron desactivados.",
        kind: "success",
      });
    } catch (e) {
      setStatus({ message: String(e), kind: "error" });
    } finally {
      setBulkBusy(false);
    }
  };

  const handleExportModpack = async () => {
    setExportingPack(true);
    setStatus(null);
    try {
      const selected = await save({
        title: "Guardar modpack",
        defaultPath: `${instance.name}.mrpack`,
        filters: [{ name: "Modrinth Pack", extensions: ["mrpack"] }],
      });
      if (!selected) {
        setExportingPack(false);
        return;
      }
      const path = await tauri.exportModpackMrpack(instance.id, selected);
      setStatus({ message: `Modpack exportado: ${path}`, kind: "success" });
    } catch (e) {
      setStatus({ message: "Error exportando modpack: " + String(e), kind: "error" });
    } finally {
      setExportingPack(false);
    }
  };

  const handleOpenFolder = async () => {
    try {
      if (tab === "logs") return;
      await tauri.openInstanceContentFolder(instance.id, tab);
    } catch (e) {
      setStatus({ message: String(e), kind: "error" });
    }
  };

  const handleDeleteInstance = async () => {
    const ok = await onConfirm({
      title: "Eliminar instancia",
      message: `Esto borrará ${instance.name} y todo su contenido. Continuar?`,
      confirmLabel: "Eliminar",
      cancelLabel: "Cancelar",
      danger: true,
    });
    if (!ok) return;
    onDeleteInstance(instance.id);
    onClose();
  };

  const handleReadLog = async (entry: InstanceLogEntry) => {
    try {
      setSelectedLog(entry);
      setLogContent("Cargando...");
      const content = await tauri.readInstanceReport(instance.id, entry.kind, entry.name);
      setLogContent(content);
    } catch (e) {
      setLogContent(String(e));
    }
  };

  const isModded =
    instance.loader === "forge" || instance.loader === "neoforge" || instance.loader === "fabric";
  const isModpack = instance.tags?.includes("modpack");

  const applyOptimization = async (preset: string) => {
    setOptimizing(true);
    setStatus(null);
    try {
      if (isModpack) {
        setStatus({ message: "La optimización no se puede aplicar a modpacks.", kind: "info" });
        return;
      }
      if (!isModded) {
        setStatus({
          message: "La optimización automática solo aplica para Forge, NeoForge o Fabric.",
          kind: "info",
        });
        return;
      }
      const ok = await onConfirm({
        title: "Aplicar optimización",
        message:
          "Esto instalará mods de rendimiento y ajustará options.txt en esta instancia. Continuar?",
        confirmLabel: "Aplicar",
        cancelLabel: "Cancelar",
      });
      if (!ok) {
        setStatus({ message: "Optimización cancelada.", kind: "info" });
        return;
      }
      const gameVersion = extractBaseVersion(instance.version);
      const msg = await tauri.applyOptimizationPack(
        instance.id,
        instance.loader,
        gameVersion,
        preset
      );
      if (msg.includes("No se instalaron mods nuevos")) {
        setStatus({
          message:
            msg +
            " Sugerencia: verifica la versión de la instancia y que sea Forge/NeoForge/Fabric.",
          kind: "info",
        });
      } else {
        setStatus({ message: msg, kind: "success" });
      }
      await reloadContent();
    } catch (e) {
      setStatus({ message: String(e), kind: "error" });
    } finally {
      setOptimizing(false);
    }
  };

  const handleRepair = async () => {
    const ok = await onConfirm({
      title: "Reparar instancia",
      message:
        "Esto verificará cliente, assets y librerías de la instancia. Puede tardar unos minutos. Continuar?",
      confirmLabel: "Reparar",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;
    setRepairing(true);
    setStatus(null);
    try {
      const msg = await tauri.repairInstance(instance.id);
      const lower = msg.toLowerCase();
      const kind = lower.includes("error") || lower.includes("fallo") ? "error" : "success";
      setStatus({ message: msg, kind });
    } catch (e) {
      const message = String(e);
      setStatus({
        message: message + " Sugerencia: revisa tu conexión e intenta de nuevo.",
        kind: "error",
      });
    } finally {
      setRepairing(false);
    }
  };

  const handleRollbackOptimization = async () => {
    const ok = await onConfirm({
      title: "Revertir optimización",
      message: "Se eliminarán mods optimizados y se restaurará options.txt. Continuar?",
      confirmLabel: "Revertir",
      cancelLabel: "Cancelar",
      danger: true,
    });
    if (!ok) return;
    try {
      setOptimizing(true);
      const msg = await tauri.rollbackOptimization(instance.id);
      setStatus({ message: msg, kind: "success" });
      await reloadContent();
    } catch (e) {
      const message = String(e);
      setStatus({
        message: message.includes("No hay backup")
          ? message + " Aplica optimización al menos una vez para generar el backup."
          : message,
        kind: "error",
      });
    } finally {
      setOptimizing(false);
    }
  };

  const handleCopyLog = async () => {
    if (!logContent) return;
    try {
      await navigator.clipboard.writeText(logContent);
      setStatus({
        message: "Log copiado al portapapeles.",
        kind: "success",
      });
    } catch {
      setStatus({ message: "No se pudo copiar el log.", kind: "error" });
    }
  };

  const handleGenerateReport = async () => {
    try {
      const path = await tauri.generateDiagnosticReport();
      setStatus({ message: `Reporte exportado: ${path}`, kind: "success" });
    } catch (e) {
      setStatus({
        message: "Error exportando reporte: " + String(e),
        kind: "error",
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-instance-title"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-5xl h-[85vh] bg-[#141419] rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
        tabIndex={-1}
      >
        <ManageInstanceHeader instance={instance} closeRef={closeRef} onClose={onClose} />

        <div className="flex flex-1 overflow-hidden">
          <ManageInstanceSidebar
            tab={tab}
            counts={counts}
            onTabChange={setTab}
            onRepair={handleRepair}
            onOpenFolder={handleOpenFolder}
            onExportModpack={handleExportModpack}
            onDeleteInstance={handleDeleteInstance}
            repairing={repairing}
            exportingPack={exportingPack}
            showContentActions={tab !== "logs"}
          />

          <div className="flex-1 bg-[#0f0f13] p-6 overflow-hidden flex flex-col">
            {status && (
              <div
                className={`mb-3 text-sm rounded-xl p-3 border ${
                  status.kind === "success"
                    ? "text-emerald-200 bg-emerald-950/40 border-emerald-900"
                    : status.kind === "error"
                      ? "text-red-200 bg-red-950/40 border-red-900"
                      : "text-amber-200 bg-amber-950/40 border-amber-900"
                }`}
              >
                {status.message}
              </div>
            )}

            <div className="flex-1 overflow-hidden">
              {loading && <div className="text-gray-400 text-sm">Cargando...</div>}

              {!loading && tab !== "logs" && (
                <ManageInstanceContentPanel
                  tab={tab}
                  contentQuery={contentQuery}
                  onContentQueryChange={setContentQuery}
                  sortMode={sortMode}
                  onSortModeChange={setSortMode}
                  filterSource={filterSource}
                  onFilterSourceChange={setFilterSource}
                  bulkBusy={bulkBusy}
                  filteredItems={filteredItems}
                  isModpack={isModpack}
                  isModded={isModded}
                  loader={instance.loader}
                  optimizing={optimizing}
                  onBulkToggle={handleBulkToggle}
                  onApplyOptimization={applyOptimization}
                  onRollbackOptimization={handleRollbackOptimization}
                  onToggleItem={handleToggle}
                  onDeleteItem={handleDelete}
                />
              )}

              {!loading && tab === "logs" && (
                <ManageInstanceLogsPanel
                  logs={logs}
                  selectedLog={selectedLog}
                  logContent={logContent}
                  onReadLog={handleReadLog}
                  onCopyLog={handleCopyLog}
                  onGenerateReport={handleGenerateReport}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

