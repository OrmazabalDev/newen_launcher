import React, { useEffect, useMemo, useRef, useState } from "react";
import type { InstanceContentItem, InstanceLogEntry, InstanceSummary, LoaderType } from "../types";
import {
  IconChevronDown,
  IconFolder,
  IconPlay,
  IconPlus,
  IconSearch,
  IconSettings,
} from "../icons";
import * as tauri from "../services/tauri";
import { useModalFocus } from "../hooks/useModalFocus";
import { Box, Code, Coffee, Wrench, Zap } from "lucide-react";

type CreatePayload = {
  name: string;
  version: string;
  loader: LoaderType;
  thumbnail?: string;
  tags?: string[];
};

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

export function InstancesView({
  instances,
  availableVersions,
  selectedInstanceId,
  errorInstanceIds,
  onSelectInstance,
  onCreateInstance,
  onPlayInstance,
  onOpenInstance,
  onDeleteInstance,
  onLoadVersions,
  onConfirm,
  isProcessing,
  isLoading,
  globalStatus,
}: {
  instances: InstanceSummary[];
  availableVersions: { id: string; type: "release" | "snapshot" }[];
  selectedInstanceId: string;
  errorInstanceIds: Set<string>;
  onSelectInstance: (id: string) => void;
  onCreateInstance: (payload: CreatePayload) => void;
  onPlayInstance: (id: string) => void;
  onOpenInstance: (id: string) => void;
  onDeleteInstance: (id: string) => void;
  onLoadVersions: () => void;
  onConfirm: (opts: ConfirmOptions) => Promise<boolean>;
  isProcessing: boolean;
  isLoading?: boolean;
  globalStatus: string;
}) {
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [manageInstance, setManageInstance] = useState<InstanceSummary | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return instances.filter((inst) => {
      if (!q) return true;
      return (
        inst.name.toLowerCase().includes(q) ||
        inst.version.toLowerCase().includes(q) ||
        inst.loader.toLowerCase().includes(q)
      );
    });
  }, [instances, query]);

  const formatLastPlayed = (ts?: number | null) => {
    if (!ts) return "Nunca";
    const date = new Date(ts);
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  const showSkeleton = Boolean(isLoading) && instances.length === 0;

return (
  <div className="absolute inset-0 z-20 bg-[#0f0f13] flex flex-col overflow-hidden animate-fadeIn">
    <div className="sticky top-0 z-20 bg-[#0f0f13]/80 backdrop-blur-xl border-b border-white/5 px-8 py-6">
      <div className="flex items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-white">Mis instancias</h2>
          <p className="text-gray-400 text-sm mt-1">Gestiona y organiza tus perfiles de juego</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="relative group">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-brand-accent transition-colors">
                <IconSearch />
              </span>
            <input
              className="bg-[#1a1a1f] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/40 transition-all w-64"
              placeholder="Buscar instancia..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowCreate(true)}
            type="button"
            disabled={isProcessing}
            aria-disabled={isProcessing}
            title={isProcessing ? "Espera a que termine el proceso actual." : "Crear nueva instancia"}
            className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-xl font-bold hover:bg-brand-accent hover:text-white transition-all shadow-lg shadow-white/5 hover:shadow-brand-accent/20 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <IconPlus />
            <span>Nueva instancia</span>
          </button>
        </div>
      </div>
      {isProcessing && (
        <div className="mt-3 text-xs text-gray-500">Acciones bloqueadas por tarea en curso.</div>
      )}
    </div>

    {globalStatus && (
      <div className="px-8 pt-4">
        <div
          className="text-sm text-gray-200 bg-white/5 border border-white/10 rounded-xl px-4 py-2"
          role="status"
          aria-live="polite"
        >
          {globalStatus}
        </div>
      </div>
    )}

    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="p-8">

        {showSkeleton && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={`skeleton-${idx}`}
                className="rounded-2xl border border-white/5 bg-[#18181d] p-5 shadow-xl animate-pulse"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-[#25252b]" />
                  <div className="h-5 w-16 bg-[#25252b] rounded" />
                </div>
                <div className="space-y-2 mb-6">
                  <div className="h-4 bg-[#25252b] rounded w-3/4" />
                  <div className="h-3 bg-[#25252b] rounded w-1/2" />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="h-10 col-span-3 bg-[#25252b] rounded-xl" />
                  <div className="h-10 col-span-1 bg-[#25252b] rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!showSkeleton && filtered.length === 0 && (
          <div className="text-gray-400 text-center py-12">
            <div className="text-lg font-bold text-white">No hay instancias que coincidan</div>
            <div className="text-sm mt-2">
              Ajusta la búsqueda o crea una nueva instancia para continuar.
            </div>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="px-4 py-2 rounded-xl bg-brand-accent hover:bg-brand-accent-deep text-white font-bold"
              >
                Crear instancia
              </button>
              {query.trim() && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold"
                >
                  Limpiar búsqueda
                </button>
              )}
            </div>
          </div>
        )}

        {!showSkeleton && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((inst) => {
            const loaderBadgeClass =
              inst.loader === "fabric"
                ? "text-emerald-300 border-emerald-500/30"
                : inst.loader === "forge"
                  ? "text-blue-300 border-blue-500/30"
                  : inst.loader === "neoforge"
                    ? "text-orange-300 border-orange-500/30"
                    : inst.loader === "snapshot"
                      ? "text-purple-300 border-purple-500/30"
                      : "text-gray-300 border-gray-500/30";
            const loaderLabel =
              inst.loader === "neoforge"
                ? "NEOFORGE"
                : inst.loader === "forge"
                  ? "FORGE"
                  : inst.loader === "fabric"
                    ? "FABRIC"
                    : inst.loader === "snapshot"
                      ? "SNAPSHOT"
                      : "VANILLA";
            const instanceInitial = inst.name.slice(0, 1).toUpperCase();

            return (
              <div
                key={inst.id}
                className={`group relative bg-[#18181d] rounded-2xl overflow-hidden border border-white/5 hover:border-brand-accent/30 transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 hover:-translate-y-1 p-5 flex flex-col ${
                  inst.id === selectedInstanceId ? "ring-1 ring-brand-accent/50 border-brand-accent/60" : ""
                }`}
                onClick={() => onSelectInstance(inst.id)}
                role="button"
                tabIndex={0}
                aria-pressed={inst.id === selectedInstanceId}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectInstance(inst.id);
                  }
                }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-[#25252b] border border-white/5 shadow-lg flex items-center justify-center overflow-hidden p-2 group-hover:scale-105 transition-transform duration-300">
                    {inst.thumbnail ? (
                      <img src={inst.thumbnail} alt={inst.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-xl font-black text-gray-300">{instanceInitial}</div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md border bg-white/5 ${loaderBadgeClass}`}>
                      {loaderLabel}
                    </span>
                    {inst.id === selectedInstanceId && (
                      <span className="text-[10px] uppercase font-bold px-2 py-1 rounded-md border bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                        Activa
                      </span>
                    )}
                    {errorInstanceIds.has(inst.id) && (
                      <span className="text-[10px] uppercase font-bold px-2 py-1 rounded-md border bg-red-600/20 text-red-300 border-red-600/40">
                        Error
                      </span>
                    )}
                    {inst.tags?.includes("modpack") && (
                      <span className="text-[10px] uppercase font-bold px-2 py-1 rounded-md border bg-brand-info/20 text-brand-info border-brand-info/40">
                        Modpack
                      </span>
                    )}
                    {inst.tags?.includes("multiplayer") && (
                      <span className="text-[10px] uppercase font-bold px-2 py-1 rounded-md border bg-blue-500/20 text-blue-200 border-blue-500/40">
                        Multiplayer
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setManageInstance(inst);
                      }}
                      type="button"
                      className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                      title="Configurar"
                    >
                      <IconSettings />
                    </button>
                  </div>
                </div>

                <div className="flex-1 mb-6">
                  <h3 className="text-xl font-bold text-white mb-1 truncate">{inst.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-gray-500 font-mono">
                    <span>{inst.version}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                    <span>{inst.mods_count} mods</span>
                    <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                    <span>{formatLastPlayed(inst.last_played)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayInstance(inst.id);
                    }}
                    type="button"
                    className="col-span-3 py-3 rounded-xl bg-[#25252b] border border-white/5 group-hover:bg-brand-accent group-hover:border-brand-accent group-hover:text-white flex items-center justify-center gap-2 transition-all font-bold text-gray-300 shadow-lg"
                  >
                    <IconPlay />
                    <span>Jugar</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenInstance(inst.id);
                    }}
                    type="button"
                    className="col-span-1 rounded-xl bg-[#25252b] border border-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                    title="Abrir carpeta"
                  >
                    <IconFolder />
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        )}
        </div>
      </div>

      {showCreate && (
        <CreateInstanceModal
          availableVersions={availableVersions}
          onClose={() => setShowCreate(false)}
          onLoadVersions={onLoadVersions}
          isProcessing={isProcessing}
          onCreate={(payload) => {
            onCreateInstance(payload);
            setShowCreate(false);
          }}
        />
      )}

      {manageInstance && (
        <ManageInstanceModal
          instance={manageInstance}
          onClose={() => setManageInstance(null)}
          onConfirm={onConfirm}
          onDeleteInstance={onDeleteInstance}
        />
      )}
    </div>
  );
}

function ManageInstanceModal({
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
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [tab, setTab] = useState<"mods" | "resourcepacks" | "shaderpacks" | "logs">("mods");
  const [items, setItems] = useState<InstanceContentItem[]>([]);
  const [logs, setLogs] = useState<InstanceLogEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<InstanceLogEntry | null>(null);
  const [logContent, setLogContent] = useState("");
  const [status, setStatus] = useState<{ message: string; kind: "success" | "info" | "error" } | null>(null);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [counts, setCounts] = useState({
    mods: 0,
    resourcepacks: 0,
    shaderpacks: 0,
    logs: 0,
  });

  useModalFocus({ open: true, containerRef: dialogRef, initialFocusRef: closeRef, onClose });

  const loadContent = async () => {
    setLoading(true);
    setStatus(null);
    try {
      if (tab === "logs") {
        const list = await tauri.listInstanceReports(instance.id);
        setLogs(list);
      } else {
        const list = await tauri.listInstanceContent(instance.id, tab);
        setItems(list);
      }
    } catch (e: any) {
      setStatus({ message: String(e), kind: "error" });
    } finally {
      setLoading(false);
    }
  };

  const loadCounts = async () => {
    try {
      const [mods, resourcepacks, shaderpacks, reports] = await Promise.all([
        tauri.listInstanceContent(instance.id, "mods"),
        tauri.listInstanceContent(instance.id, "resourcepacks"),
        tauri.listInstanceContent(instance.id, "shaderpacks"),
        tauri.listInstanceReports(instance.id),
      ]);
      setCounts({
        mods: mods.length,
        resourcepacks: resourcepacks.length,
        shaderpacks: shaderpacks.length,
        logs: reports.length,
      });
    } catch {
      // ignore count errors
    }
  };

  useEffect(() => {
    loadContent();
    loadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, instance.id]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatDate = (ts: number) => {
    if (!ts) return "Sin fecha";
    const date = new Date(ts);
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleToggle = async (item: InstanceContentItem) => {
    try {
      await tauri.toggleInstanceContent(instance.id, tab, item.file_name, !item.enabled);
      await loadContent();
    } catch (e: any) {
      setStatus({ message: String(e), kind: "error" });
    }
  };

  const handleDelete = async (item: InstanceContentItem) => {
    const extra = item.required_by.length
      ? ` Requerido por: ${item.required_by.join(", ")}`
      : "";
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
      await loadContent();
    } catch (e: any) {
      setStatus({ message: String(e), kind: "error" });
    }
  };

  const handleOpenFolder = async () => {
    try {
      if (tab === "logs") return;
      await tauri.openInstanceContentFolder(instance.id, tab);
    } catch (e: any) {
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
    } catch (e: any) {
      setLogContent(String(e));
    }
  };

  const extractBaseVersion = (versionId: string) => {
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
  };

  const isModded = instance.loader === "forge" || instance.loader === "neoforge" || instance.loader === "fabric";
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
        setStatus({ message: "La optimización automática solo aplica para Forge, NeoForge o Fabric.", kind: "info" });
        return;
      }
      const ok = await onConfirm({
        title: "Aplicar optimización",
        message: "Esto instalará mods de rendimiento y ajustará options.txt en esta instancia. Continuar?",
        confirmLabel: "Aplicar",
        cancelLabel: "Cancelar",
      });
      if (!ok) {
        setStatus({ message: "Optimización cancelada.", kind: "info" });
        return;
      }
      const gameVersion = extractBaseVersion(instance.version);
      const msg = await tauri.applyOptimizationPack(instance.id, instance.loader, gameVersion, preset);
      if (msg.includes("No se instalaron mods nuevos")) {
        setStatus({
          message: msg + " Sugerencia: verifica la versión de la instancia y que sea Forge/NeoForge/Fabric.",
          kind: "info",
        });
      } else {
        setStatus({ message: msg, kind: "success" });
      }
      await loadContent();
    } catch (e: any) {
      setStatus({ message: String(e), kind: "error" });
    } finally {
      setOptimizing(false);
    }
  };

  const handleRepair = async () => {
    const ok = await onConfirm({
      title: "Reparar instancia",
      message: "Esto verificará cliente, assets y librerías de la instancia. Puede tardar unos minutos. Continuar?",
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
    } catch (e: any) {
      const message = String(e);
      setStatus({ message: message + " Sugerencia: revisa tu conexión e intenta de nuevo.", kind: "error" });
    } finally {
      setRepairing(false);
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
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#18181d]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#25252b] flex items-center justify-center overflow-hidden border border-white/10 p-2">
              {instance.thumbnail ? (
                <img src={instance.thumbnail} alt={instance.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-black text-gray-300">{instance.name.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white" id="manage-instance-title">
                Gestionar: {instance.name}
              </h3>
              <p className="text-xs text-gray-400 font-mono">{instance.version} - {instance.loader}</p>
            </div>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            type="button"
            className="text-gray-400 hover:text-white"
            aria-label="Cerrar"
          >
            X
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-64 bg-[#18181d] border-r border-white/5 p-4 space-y-2">
            <button
              type="button"
              onClick={() => setTab("mods")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
                tab === "mods" ? "bg-white/10 text-white font-medium" : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span>Mods</span>
              <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded text-gray-300">{counts.mods}</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("resourcepacks")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
                tab === "resourcepacks" ? "bg-white/10 text-white font-medium" : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span>Resourcepacks</span>
              <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded text-gray-300">{counts.resourcepacks}</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("shaderpacks")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
                tab === "shaderpacks" ? "bg-white/10 text-white font-medium" : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span>Shaders</span>
              <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded text-gray-300">{counts.shaderpacks}</span>
            </button>
            <div className="h-px bg-white/5 my-2" />
            <button
              type="button"
              onClick={() => setTab("logs")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
                tab === "logs" ? "bg-white/10 text-white font-medium" : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span>Logs / Crash</span>
              <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded text-gray-300">{counts.logs}</span>
            </button>
            <div className="h-px bg-white/5 my-2" />
            <button
              type="button"
              onClick={handleRepair}
              disabled={repairing}
              aria-disabled={repairing}
              title={repairing ? "Reparando..." : "Reparar instancia"}
              className="w-full px-3 py-2 rounded-lg bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 disabled:opacity-60"
            >
              Reparar
            </button>
            {tab !== "logs" && (
              <>
                <button
                  type="button"
                  onClick={handleOpenFolder}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 text-gray-300 hover:text-white hover:bg-white/10"
                >
                  Abrir carpeta
                </button>
                <button
                  type="button"
                  onClick={handleDeleteInstance}
                  className="w-full px-3 py-2 rounded-lg bg-red-600/20 text-red-200 hover:bg-red-600/30"
                >
                  Eliminar instancia
                </button>
              </>
            )}
          </div>

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

                  {loading && (
                    <div className="text-gray-400 text-sm">Cargando...</div>
                  )}

                  {!loading && tab !== "logs" && (
                    <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
                      {tab === "mods" && !isModpack && (
                        <div className="mb-4 bg-gradient-to-br from-brand-accent/10 via-gray-950/40 to-gray-950/40 border border-brand-accent/30 rounded-xl p-4">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="text-2xl">⚡</div>
                            <div className="text-sm font-bold text-white">Optimización en 1 clic</div>
                          </div>
                          <div className="text-xs text-gray-300 mb-2">
                            Instala mods de rendimiento y ajusta options.txt en esta instancia.
                          </div>
                          <div className="text-[11px] text-gray-400 mb-3">
                            No toca tus mods existentes y se puede revertir.
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => applyOptimization("competitive")}
                              disabled={optimizing || !isModded || isModpack}
                              className="px-3 py-1.5 rounded-full text-xs font-bold bg-gray-800 text-gray-200 hover:bg-gray-700 disabled:opacity-60"
                            >
                              Competitivo
                            </button>
                            <button
                              type="button"
                              onClick={() => applyOptimization("balanced")}
                              disabled={optimizing || !isModded || isModpack}
                              className="px-3 py-1.5 rounded-full text-xs font-bold bg-gray-800 text-gray-200 hover:bg-gray-700 disabled:opacity-60"
                            >
                              Balanceado
                            </button>
                            <button
                              type="button"
                              onClick={() => applyOptimization("quality")}
                              disabled={optimizing || !isModded || isModpack}
                              className="px-3 py-1.5 rounded-full text-xs font-bold bg-gray-800 text-gray-200 hover:bg-gray-700 disabled:opacity-60"
                            >
                              Calidad
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
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
                                  await loadContent();
                                } catch (e: any) {
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
                              }}
                              disabled={optimizing || !isModded || isModpack}
                              className="px-3 py-1.5 rounded-full text-xs font-bold bg-red-700/80 text-white hover:bg-red-700 disabled:opacity-60"
                            >
                              Revertir
                            </button>
                          </div>
                          <div className="mt-3 text-[11px] text-gray-500">
                            Mods incluidos: {instance.loader === "fabric"
                              ? "Sodium, Lithium, Starlight, FerriteCore, EntityCulling"
                              : "ModernFix, FerriteCore, EntityCulling, Render mod (Rubidium/Embeddium)"}.
                          </div>
                          <div className="mt-3 text-[11px] text-gray-500">
                            Nota: el rollback solo elimina mods instalados por el launcher.
                          </div>
                          {isModpack && (
                            <div className="mt-3 text-xs text-amber-300">
                              Los modpacks ya traen optimizaciones propias; no se puede aplicar este perfil.
                            </div>
                          )}
                          {!isModded && !isModpack && (
                            <div className="mt-3 text-xs text-amber-300">
                              Necesitas una instancia Forge, NeoForge o Fabric para instalar mods de rendimiento.
                            </div>
                          )}
                        </div>
                      )}
                      {items.length === 0 && (
                        <div className="text-gray-500 text-center py-10">
                          No hay archivos en esta sección.
                        </div>
                      )}
                      <div className="space-y-3">
                        {items.map((item) => (
                          <div
                            key={item.file_name}
                            className="border border-gray-800 rounded-xl p-4 bg-gray-950/40 flex items-start gap-4"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="font-semibold text-white truncate">{item.name}</div>
                                {!item.enabled && (
                                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-red-600/20 text-red-300 border border-red-600/40">
                                    Desactivado
                                  </span>
                                )}
                                {item.source && (
                                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 border border-gray-700">
                                    {item.source}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {formatSize(item.size)} - {formatDate(item.modified)}
                              </div>
                              {item.required_by.length > 0 && (
                                <div className="mt-2 text-xs text-amber-300">
                                  Requerido por: {item.required_by.join(", ")}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleToggle(item)}
                                type="button"
                                className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700 text-xs"
                              >
                                {item.enabled ? "Desactivar" : "Activar"}
                              </button>
                              <button
                                onClick={() => handleDelete(item)}
                                type="button"
                                className="px-3 py-1.5 rounded-lg bg-red-600/80 text-white hover:bg-red-600 text-xs"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!loading && tab === "logs" && (
                    <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4 h-full min-h-0">
                      <div className="bg-gray-950/40 border border-gray-800 rounded-xl p-3 overflow-y-auto custom-scrollbar">
                        {logs.length === 0 && (
                          <div className="text-gray-500 text-sm py-6 text-center">No hay logs ni crash reports.</div>
                        )}
                        <div className="space-y-2">
                          {logs.map((entry) => (
                            <button
                              key={`${entry.kind}-${entry.name}`}
                              onClick={() => handleReadLog(entry)}
                              type="button"
                              className={`w-full text-left px-3 py-2 rounded-lg border ${
                                selectedLog?.name === entry.name ? "border-brand-accent/60 bg-gray-800" : "border-gray-800"
                              }`}
                            >
                              <div className="text-sm text-white truncate">{entry.name}</div>
                              <div className="text-[11px] text-gray-500">
                                {entry.kind.toUpperCase()} - {formatSize(entry.size)} - {formatDate(entry.modified)}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="bg-gray-950/40 border border-gray-800 rounded-xl p-3 flex flex-col min-w-0">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                          <span>
                            {selectedLog ? `${selectedLog.kind.toUpperCase()} - ${selectedLog.name}` : "Selecciona un log para ver detalles"}
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!logContent) return;
                                try {
                                  await navigator.clipboard.writeText(logContent);
                                  setStatus({ message: "Log copiado al portapapeles.", kind: "success" });
                                } catch {
                                  setStatus({ message: "No se pudo copiar el log.", kind: "error" });
                                }
                              }}
                              className="px-2 py-1 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700"
                            >
                              Copiar
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const path = await tauri.generateDiagnosticReport();
                                  setStatus({ message: `Reporte exportado: ${path}`, kind: "success" });
                                } catch (e: any) {
                                  setStatus({ message: "Error exportando reporte: " + String(e), kind: "error" });
                                }
                              }}
                              className="px-2 py-1 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700"
                            >
                              Generar reporte
                            </button>
                          </div>
                        </div>
                        <div className="text-[11px] text-gray-500 mb-2">
                          El reporte incluye logs, instances.json y diagnostic.json (SO, versión y ruta del launcher).
                        </div>
                        <pre className="flex-1 overflow-auto text-xs text-gray-200 whitespace-pre-wrap break-all select-text">
        {logContent || "Sin contenido."}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
  );
}

function CreateInstanceModal({
  availableVersions,
  onClose,
  onCreate,
  onLoadVersions,
  isProcessing,
}: {
  availableVersions: { id: string; type: "release" | "snapshot" }[];
  onClose: () => void;
  onCreate: (payload: CreatePayload) => void;
  onLoadVersions: () => void;
  isProcessing: boolean;
}) {
  const [name, setName] = useState("");
  const [loader, setLoader] = useState<LoaderType>("vanilla");
  const [multiplayer, setMultiplayer] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useModalFocus({ open: true, containerRef: dialogRef, initialFocusRef: nameRef, onClose });

  useEffect(() => {
    onLoadVersions();
  }, [onLoadVersions]);

  const versionOptions = useMemo(() => {
    if (loader === "snapshot") return availableVersions.filter((v) => v.type === "snapshot").map((v) => v.id);
    const releases = availableVersions.filter((v) => v.type === "release").map((v) => v.id);
    if (loader === "forge") return releases;
    if (loader === "neoforge") return releases;
    if (loader === "fabric") return releases;
    return releases;
  }, [availableVersions, loader]);

  const [version, setVersion] = useState(versionOptions[0] || "");
  const latestRelease = useMemo(
    () => availableVersions.find((v) => v.type === "release")?.id || "",
    [availableVersions]
  );

  useEffect(() => {
    setVersion((prev) => (versionOptions.includes(prev) ? prev : versionOptions[0] || ""));
  }, [versionOptions]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fadeIn p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-instance-title"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-xl bg-[#141419] rounded-3xl border border-white/10 shadow-2xl p-8 relative"
        tabIndex={-1}
      >
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 text-gray-500 hover:text-white"
          aria-label="Cerrar"
        >
          X
        </button>

        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-white" id="create-instance-title">
            Nueva instancia
          </h3>
          <p className="text-gray-400 text-sm mt-1">Personaliza tu versiónnn y gestor de mods</p>
        </div>

        {availableVersions.length === 0 && (
          <div className="text-sm text-gray-300 bg-[#1e1e24] border border-white/10 rounded-xl p-4 mb-4">
            Cargando lista de versiones disponibles...
          </div>
        )}

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Nombre</label>
              <input
                className="w-full bg-[#1e1e24] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent placeholder:text-gray-600 transition-all"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mi mundo survival"
                ref={nameRef}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Versi?n</label>
              <div className="relative">
                <select
                  className="w-full appearance-none bg-[#1e1e24] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-brand-accent cursor-pointer font-mono text-sm"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  disabled={versionOptions.length === 0}
                >
                  {versionOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                  <IconChevronDown />
                </div>
              </div>
              {versionOptions.length === 0 && (
                <p className="text-xs text-gray-500 mt-2">No hay versiones disponibles para este loader.</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Mod Loader</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {[
                {
                  id: "fabric",
                  label: "Fabric",
                  icon: <Box size={22} />,
                  active: "bg-emerald-500/10 border-emerald-500/40 text-emerald-200",
                },
                {
                  id: "forge",
                  label: "Forge",
                  icon: <Wrench size={22} />,
                  active: "bg-blue-500/10 border-blue-500/40 text-blue-200",
                },
                {
                  id: "neoforge",
                  label: "NeoForge",
                  icon: <Code size={22} />,
                  active: "bg-orange-500/10 border-orange-500/40 text-orange-200",
                },
                {
                  id: "vanilla",
                  label: "Vanilla",
                  icon: <Coffee size={22} />,
                  active: "bg-gray-500/10 border-gray-500/40 text-gray-200",
                },
                {
                  id: "snapshot",
                  label: "Snapshot",
                  icon: <Zap size={22} />,
                  active: "bg-purple-500/10 border-purple-500/40 text-purple-200",
                },
              ].map((option) => {
                const isActive = loader === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setLoader(option.id as LoaderType);
                      if (option.id !== "snapshot" && latestRelease) {
                        setVersion(latestRelease);
                      }
                    }}
                    className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border transition-all duration-200 h-28 ${
                      isActive
                        ? option.active
                        : "bg-[#1e1e24] border-white/5 text-gray-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {option.icon}
                    <span className="text-xs font-bold uppercase tracking-wide">{option.label}</span>
                    {isActive && <div className="w-2 h-2 rounded-full bg-current shadow-lg mt-1" />}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 text-center mt-2 min-h-[1rem]">
              {loader === "fabric" && "Ligero y rápido. Recomendado para optimización y mods modernos."}
              {loader === "forge" && "El estándar clásico. Mayor compatibilidad con grandes modpacks."}
              {loader === "neoforge" && "La nueva evolución de Forge. Compatible con nuevos estándares."}
              {loader === "vanilla" && "Sin mods. La experiencia original de Minecraft."}
              {loader === "snapshot" && "Versiones experimentales para probar contenido nuevo."}
            </p>
          </div>

          <div className="pt-2 border-t border-white/5">
            <label className="flex items-center gap-3 bg-[#1e1e24] border border-white/10 rounded-xl px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                className="accent-brand-accent"
                checked={multiplayer}
                onChange={(e) => setMultiplayer(e.target.checked)}
              />
              <span className="text-sm text-gray-100">Marcar como multijugador</span>
            </label>
          </div>

          <button
            onClick={() =>
              onCreate({
                name,
                version,
                loader,
                tags: multiplayer ? ["multiplayer"] : [],
              })
            }
            disabled={!name.trim() || !version || isProcessing}
            type="button"
            className="w-full bg-gradient-to-r from-brand-accent to-orange-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-brand-accent/20 hover:shadow-brand-accent/40 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Crear instancia
          </button>
        </div>
      </div>
    </div>
  );

}




