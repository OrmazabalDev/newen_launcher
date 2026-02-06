import React, { useEffect, useMemo, useState } from "react";
import type { InstanceContentItem, InstanceLogEntry, InstanceSummary, LoaderType } from "../types";
import { IconChevronDown, IconFolder, IconPlay, IconPlus, IconTrash } from "../icons";
import * as tauri from "../services/tauri";

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
    <div className="absolute inset-0 z-20 bg-gray-950 flex flex-col p-8 overflow-hidden animate-fadeIn">
      <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-white">Gestor de instancias</h2>
              <p className="text-gray-300 text-sm">
                Crea perfiles con versiones y mods separados. Cada instancia tiene su propia carpeta.
              </p>
            </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreate(true)}
              type="button"
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl bg-brand-accent hover:bg-brand-accent-deep text-white font-bold flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <IconPlus /> Nueva instancia
            </button>
          </div>
        </div>

        {isProcessing && globalStatus && (
          <div className="mt-4 text-sm text-gray-200 bg-gray-900/70 border border-gray-800 rounded-xl px-4 py-2">
            {globalStatus}
          </div>
        )}
        {!isProcessing && globalStatus && (
          <div className="mt-4 text-sm text-gray-200 bg-gray-900/70 border border-gray-800 rounded-xl px-4 py-2">
            {globalStatus}
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-center">
          <input
            className="flex-1 min-w-[240px] px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white outline-none focus:border-brand-accent"
            placeholder="Buscar por nombre, versión o loader..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {showSkeleton && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={`skeleton-${idx}`}
                className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 shadow-xl animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-gray-800" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-800 rounded w-3/4" />
                    <div className="h-3 bg-gray-800 rounded w-1/2" />
                  </div>
                  <div className="h-5 w-14 bg-gray-800 rounded" />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="h-3 w-16 bg-gray-800 rounded" />
                  <div className="h-3 w-24 bg-gray-800 rounded" />
                </div>
                <div className="mt-4 flex gap-2">
                  <div className="h-9 flex-1 bg-gray-800 rounded-lg" />
                  <div className="h-9 w-10 bg-gray-800 rounded-lg" />
                  <div className="h-9 w-10 bg-gray-800 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!showSkeleton && filtered.length === 0 && (
          <div className="text-gray-500 text-center py-10">
            No hay instancias que coincidan. Crea una nueva o cambia los filtros.
          </div>
        )}

        {!showSkeleton && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {filtered.map((inst) => (
            <div
              key={inst.id}
              className={`rounded-2xl border bg-gray-900/70 backdrop-blur p-4 shadow-xl flex flex-col gap-3 ${
                inst.id === selectedInstanceId ? "border-brand-accent/70 ring-1 ring-brand-accent/50" : "border-gray-800"
              }`}
              onClick={() => onSelectInstance(inst.id)}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-800 flex items-center justify-center shrink-0">
                  {inst.thumbnail ? (
                    <img src={inst.thumbnail} alt={inst.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-2xl font-black text-gray-400">{inst.name.slice(0, 1).toUpperCase()}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-bold text-white truncate">{inst.name}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-gray-800 text-gray-200 border border-gray-700">
                    {inst.loader}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-900 text-gray-300 border border-gray-700">
                    {inst.version}
                  </span>
                  {inst.id === selectedInstanceId && (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      Activa
                    </span>
                  )}
                  {errorInstanceIds.has(inst.id) && (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-red-600/20 text-red-300 border border-red-600/40">
                      Error
                    </span>
                  )}
                  {inst.tags?.includes("modpack") && (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-brand-info/20 text-brand-info border border-brand-info/40">
                      Modpack
                    </span>
                  )}
                  {inst.tags?.includes("multiplayer") && (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-500/40">
                      Multiplayer
                    </span>
                  )}
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-gray-400 flex items-center justify-between">
                <span>{inst.mods_count} mods</span>
                <span className="truncate">Último uso: {formatLastPlayed(inst.last_played)}</span>
              </div>

              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayInstance(inst.id);
                  }}
                  type="button"
                  className="flex-1 py-2 rounded-lg bg-brand-accent hover:bg-brand-accent-deep text-white font-bold flex items-center justify-center gap-2 text-sm min-w-[88px]"
                >
                  <IconPlay /> Jugar
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setManageInstance(inst);
                  }}
                  type="button"
                  className="px-4 py-2 rounded-lg bg-gray-900 border border-brand-accent/50 text-gray-100 hover:bg-gray-800 min-w-[96px]"
                  title="Gestionar contenido"
                >
                  Gestionar
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenInstance(inst.id);
                  }}
                  type="button"
                  className="px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-200 hover:bg-gray-800"
                  title="Abrir carpeta"
                >
                  <IconFolder />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteInstance(inst.id);
                  }}
                  type="button"
                  className="px-3 py-2 rounded-lg bg-red-600/80 border border-red-900 text-white hover:bg-red-600"
                  title="Eliminar instancia"
                >
                  <IconTrash />
                </button>
              </div>
            </div>
          ))}
          </div>
        )}
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
        />
      )}
    </div>
  );
}

function ManageInstanceModal({
  instance,
  onClose,
  onConfirm,
}: {
  instance: InstanceSummary;
  onClose: () => void;
  onConfirm: (opts: ConfirmOptions) => Promise<boolean>;
}) {
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
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-950/90 backdrop-blur-sm animate-fadeIn p-4">
      <div className="bg-gray-900 p-6 rounded-2xl shadow-2xl border border-gray-800 w-full max-w-[1140px] h-[calc(100vh-40px)] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-white">Gestionar instancia</h3>
            <p className="text-xs text-gray-400">{instance.name} - {instance.version}</p>
          </div>
          <button onClick={onClose} type="button" className="text-gray-400 hover:text-white">
            X
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          {(["mods", "resourcepacks", "shaderpacks", "logs"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-xl text-sm ${
                tab === key ? "bg-brand-accent text-white" : "bg-gray-800 text-gray-300 hover:text-white"
              }`}
            >
              {key === "mods" && `Mods (${counts.mods})`}
              {key === "resourcepacks" && `Resourcepacks (${counts.resourcepacks})`}
              {key === "shaderpacks" && `Shaders (${counts.shaderpacks})`}
              {key === "logs" && `Logs / Crash (${counts.logs})`}
            </button>
          ))}
          <button
            type="button"
            onClick={handleRepair}
            disabled={repairing}
            className="ml-auto px-4 py-2 rounded-xl bg-gray-800 text-gray-300 hover:text-white disabled:opacity-60"
          >
            Reparar
          </button>
          {tab !== "logs" && (
            <button
              type="button"
              onClick={handleOpenFolder}
              className="px-4 py-2 rounded-xl bg-gray-800 text-gray-300 hover:text-white"
            >
              Abrir carpeta
            </button>
          )}
        </div>

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
  const [thumbnail, setThumbnail] = useState("");
  const [multiplayer, setMultiplayer] = useState(false);

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
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-950/90 backdrop-blur-sm animate-fadeIn p-4">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-2xl border border-gray-700 max-w-lg w-full">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-white">Nueva instancia</h3>
          <button onClick={onClose} type="button" className="text-gray-400 hover:text-white">
            X
          </button>
        </div>

        {availableVersions.length === 0 && (
          <div className="text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-xl p-4 mb-4">
            Cargando lista de versiones disponibles...
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setLoader("vanilla");
                if (latestRelease) setVersion(latestRelease);
              }}
              className="px-3 py-2 rounded-xl bg-gray-900 border border-gray-700 text-gray-200 hover:bg-gray-800 text-xs font-bold"
            >
              ⚡ Vanilla rápido
            </button>
            <button
              type="button"
              onClick={() => {
                setLoader("fabric");
                if (latestRelease) setVersion(latestRelease);
              }}
              className="px-3 py-2 rounded-xl bg-gray-900 border border-gray-700 text-gray-200 hover:bg-gray-800 text-xs font-bold"
            >
              ⚙ Fabric optimizado
            </button>
            <button
              type="button"
              onClick={() => {
                setLoader("forge");
                if (latestRelease) setVersion(latestRelease);
              }}
              className="px-3 py-2 rounded-xl bg-gray-900 border border-gray-700 text-gray-200 hover:bg-gray-800 text-xs font-bold"
            >
              🧱 Forge mods
            </button>
            <button
              type="button"
              onClick={() => {
                setLoader("neoforge");
                if (latestRelease) setVersion(latestRelease);
              }}
              className="px-3 py-2 rounded-xl bg-gray-900 border border-gray-700 text-gray-200 hover:bg-gray-800 text-xs font-bold"
            >
              NeoForge moderno
            </button>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">Nombre</label>
            <input
              className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-brand-accent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mi instancia"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">Loader</label>
            <div className="relative">
              <select
                className="w-full appearance-none bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-brand-accent"
                value={loader}
                onChange={(e) => setLoader(e.target.value as LoaderType)}
              >
                <option value="vanilla">Vanilla</option>
                <option value="snapshot">Snapshot</option>
                <option value="forge">Forge</option>
                <option value="neoforge">NeoForge</option>
                <option value="fabric">Fabric</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                <IconChevronDown />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {loader === "fabric"
                ? "Fabric recomendado para rendimiento."
                : loader === "neoforge"
                  ? "NeoForge recomendado para mods modernos."
                : loader === "forge"
                  ? "Forge recomendado para mods clásicos."
                  : loader === "snapshot"
                    ? "Snapshot para probar contenido nuevo."
                    : "Vanilla estable y simple."}
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">Versión</label>
            <div className="relative">
              <select
                className="w-full appearance-none bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-brand-accent"
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
              <p className="text-xs text-gray-400 mt-2">
                No hay versiones disponibles para este loader.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">Thumbnail</label>
            <input
              className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-brand-accent"
              value={thumbnail}
              onChange={(e) => setThumbnail(e.target.value)}
              placeholder="URL de imagen (opcional)"
            />
            <p className="text-xs text-gray-500 mt-2">Útil para identificar instancias rápidamente.</p>
          </div>

          <label className="flex items-center gap-3 bg-gray-950/60 border border-gray-800 rounded-xl px-4 py-3 cursor-pointer">
            <input
              type="checkbox"
              className="accent-brand-accent"
              checked={multiplayer}
              onChange={(e) => setMultiplayer(e.target.checked)}
            />
            <span className="text-sm text-gray-100">Marcar como multijugador</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() =>
              onCreate({
                name,
                version,
                loader,
                thumbnail: thumbnail.trim() || undefined,
                tags: multiplayer ? ["multiplayer"] : [],
              })
            }
            disabled={!name.trim() || !version || isProcessing}
            type="button"
            className="px-5 py-2.5 bg-brand-accent hover:bg-brand-accent-deep rounded-xl font-bold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Crear instancia
          </button>
        </div>
      </div>
    </div>
  );
}




