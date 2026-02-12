import React, { useEffect, useState } from "react";
import type { GameSettings, InstanceSummary, RuntimeMetrics, SystemJava } from "../types";
import { IconChevronDown, IconJava } from "../icons";
import { Cpu, Edit3, HardDrive, Play } from "lucide-react";
import * as tauri from "../services/tauri";

export function DashboardView({
  instances,
  selectedInstanceId,
  onSelectInstance,
  isProcessing,
  globalStatus,
  onPlay,
  onGoInstances,
  onRepairInstance,
  systemJava,
  settings,
  gamePid,
  progress,
}: {
  instances: InstanceSummary[];
  selectedInstanceId: string;
  onSelectInstance: (id: string) => void;
  isProcessing: boolean;
  globalStatus: string;
  onPlay: () => void;
  onGoInstances: () => void;
  onRepairInstance: () => void;
  systemJava: SystemJava | null;
  settings: GameSettings;
  gamePid: number | null;
  progress: number;
}) {
  const selectedInstance = instances.find((i) => i.id === selectedInstanceId) || null;
  const hasInstance = instances.length > 0 && !!selectedInstance;
  const statusText = globalStatus.trim();
  const statusLower = statusText.toLowerCase();
  const isError = statusLower.startsWith("error");
  const isSuccess = statusLower.startsWith("listo");
  const reportPathMatch = statusText.match(/Reporte diagnostico:\s*([^|]+)/i);
  const reportPath = reportPathMatch ? reportPathMatch[1].trim() : "";
  const prelaunchMatch = statusText.match(/Log prelaunch:\s*([^|]+)/i);
  const prelaunchPath = prelaunchMatch ? prelaunchMatch[1].trim() : "";
  const [uploadStatus, setUploadStatus] = useState("");
  const [isUploadingReport, setIsUploadingReport] = useState(false);
  const [metrics, setMetrics] = useState<RuntimeMetrics | null>(null);
  const [smoothedLauncherCpu, setSmoothedLauncherCpu] = useState<number | null>(null);
  const [smoothedGameCpu, setSmoothedGameCpu] = useState<number | null>(null);
  const [isInstanceMenuOpen, setIsInstanceMenuOpen] = useState(false);
  const loaderLabel = selectedInstance
    ? selectedInstance.loader === "fabric"
      ? "Fabric"
      : selectedInstance.loader === "neoforge"
        ? "NeoForge"
      : selectedInstance.loader === "forge"
        ? "Forge"
        : selectedInstance.loader === "snapshot"
          ? "Snapshot"
          : "Vanilla"
    : "Ninguna";
  const modsLabel = selectedInstance ? `${selectedInstance.mods_count} mods` : "Sin mods";
  const launchLabel = (() => {
    if (!isProcessing) return "JUGAR";
    const lower = statusLower;
    if (lower.includes("mods")) return "CARGANDO MODS";
    if (lower.includes("assets") || lower.includes("librerias")) return "CARGANDO";
    if (lower.includes("lanzando")) return "LANZANDO";
    if (lower.includes("verificando") || lower.includes("preparando")) return "INICIANDO";
    if (progress >= 80) return "LANZANDO";
    if (progress >= 40) return "CARGANDO";
    return "INICIANDO";
  })();

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const data = await tauri.getRuntimeMetrics(gamePid ?? undefined);
        if (alive) setMetrics(data);
      } catch {
        if (alive) setMetrics(null);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [gamePid]);


  useEffect(() => {
    setSmoothedGameCpu(null);
  }, [gamePid]);

  useEffect(() => {
    setUploadStatus("");
    setIsUploadingReport(false);
  }, [statusText]);

  useEffect(() => {
    if (!metrics) return;
    const smooth = (prev: number | null, next: number, alpha = 0.2) =>
      prev === null ? next : prev * (1 - alpha) + next * alpha;
    const launcherCpu = metrics.launcher_cpu_percent;
    if (typeof launcherCpu === "number") {
      setSmoothedLauncherCpu((prev) => smooth(prev, launcherCpu));
    }
    const processCpu = metrics.process_cpu_percent;
    if (typeof processCpu === "number") {
      setSmoothedGameCpu((prev) => smooth(prev, processCpu));
    }
  }, [metrics]);

  const formatMemory = (mb: number | null | undefined) => {
    if (mb === null || mb === undefined) return "--";
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb} MB`;
  };

  const launcherUsed = metrics?.launcher_memory_mb ?? null;
  const launcherReserved = metrics?.launcher_virtual_mb ?? null;
  const gameUsed = metrics?.process_memory_mb ?? null;
  const gameReserved = metrics?.process_virtual_mb ?? null;
  const cpuDisplay =
    gamePid && smoothedGameCpu !== null && smoothedGameCpu !== undefined
      ? smoothedGameCpu
      : smoothedLauncherCpu;
  const cpuText = cpuDisplay !== null && cpuDisplay !== undefined ? `${cpuDisplay.toFixed(1)}%` : "--";
  const ramDisplay = formatMemory(gameUsed ?? launcherUsed ?? null);
  const instanceInitial = selectedInstance?.name?.charAt(0).toUpperCase() || "?";
  const loaderDotClass = selectedInstance
    ? selectedInstance.loader === "fabric"
      ? "bg-emerald-400"
      : selectedInstance.loader === "forge"
        ? "bg-blue-400"
        : selectedInstance.loader === "neoforge"
          ? "bg-orange-400"
          : selectedInstance.loader === "snapshot"
            ? "bg-purple-400"
            : "bg-gray-400"
    : "bg-gray-600";
  const canSelectInstance = instances.length > 0 && !isProcessing;
  const instanceMenuRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isInstanceMenuOpen) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!instanceMenuRef.current) return;
      if (!instanceMenuRef.current.contains(event.target as Node)) {
        setIsInstanceMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsInstanceMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isInstanceMenuOpen]);

  return (
    <>
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[#0f0f13]" />
        <img
          src="/hero-bg.svg"
          className="w-full h-full object-cover opacity-35"
          alt=""
          aria-hidden="true"
        />
        <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-brand-accent/10 blur-[140px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-gray-950/40 via-gray-950/70 to-gray-950" />
      </div>

      <header className="relative z-10 flex justify-end p-6">
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-4 bg-black/40 backdrop-blur-md border border-white/5 px-4 py-2 rounded-full text-xs font-mono text-gray-300">
            <div className="flex items-center gap-2">
              <Cpu size={14} className="text-brand-accent" />
              <span className="hidden md:inline">CPU: {cpuText}</span>
              <span className="md:hidden">CPU {cpuText}</span>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2">
              <HardDrive size={14} className="text-blue-400" />
              <span className="hidden md:inline">RAM: {ramDisplay}</span>
              <span className="md:hidden">RAM {ramDisplay}</span>
            </div>
          </div>
          <div className="text-[11px] text-gray-400 bg-black/30 border border-white/5 rounded-full px-3 py-1 font-mono">
            Launcher reservada: {formatMemory(launcherReserved)}
          </div>
        </div>
      </header>

      <div
        className="relative z-10 flex-1 flex flex-col justify-center px-12 lg:px-20 pb-16"
        aria-busy={isProcessing}
      >
        <div className="space-y-4 mb-10">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider border bg-blue-500/10 text-blue-300 border-blue-500/20">
              {loaderLabel} {selectedInstance?.version || "N/A"}
            </span>
            <span className="px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider border bg-purple-500/10 text-purple-300 border-purple-500/20">
              {modsLabel}
            </span>
          </div>

          <h1 className="text-6xl font-black text-white tracking-tight drop-shadow-2xl max-w-3xl leading-tight">
            {hasInstance ? selectedInstance?.name : "Sin instancia"}
          </h1>
          <p className="text-gray-400 max-w-lg text-lg">
            Tu aventura está lista. Newen gestiona los recursos en segundo plano para una experiencia fluida.
          </p>

          {!hasInstance && (
            <div className="text-sm text-gray-200 bg-white/5 border border-white/10 rounded-xl px-4 py-3 max-w-2xl">
              Crea tu primera instancia para empezar. Puedes elegir Vanilla, Forge, NeoForge o Fabric.
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center gap-8 mt-2">
          {hasInstance ? (
            <button
              onClick={onPlay}
              disabled={isProcessing}
              type="button"
              aria-disabled={isProcessing}
              title={isProcessing ? "Procesando, espera un momento." : "Iniciar juego"}
              className={`group relative px-10 py-6 rounded-2xl flex items-center gap-5 shadow-2xl transition-all duration-300 transform min-w-[280px] ${
                isProcessing
                  ? "bg-gray-800 cursor-wait scale-95"
                  : "bg-gradient-to-r from-brand-accent to-orange-500 hover:from-orange-500 hover:to-orange-400 hover:scale-105 hover:shadow-brand-accent/40 active:scale-95"
              }`}
            >
              <div className={`p-3 bg-white/20 rounded-xl backdrop-blur-sm transition-transform ${!isProcessing ? "group-hover:rotate-12" : ""}`}>
                {isProcessing ? (
                  <div className="w-7 h-7 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Play size={28} fill="currentColor" />
                )}
              </div>
              <div className="text-left">
                <p className="text-xs font-bold uppercase tracking-wider text-orange-100 opacity-80 mb-0.5">
                  {isProcessing ? "Inicializando..." : "Estado: Listo"}
                </p>
                <p className="text-3xl font-black text-white leading-none">{launchLabel}</p>
              </div>
            </button>
          ) : (
            <button
              onClick={onGoInstances}
              type="button"
              className="px-10 py-6 rounded-2xl bg-gradient-to-r from-brand-accent to-orange-500 text-white font-black text-2xl shadow-2xl hover:from-orange-500 hover:to-orange-400 transition-all"
            >
              CREAR INSTANCIA
            </button>
          )}

          <div className="h-16 w-px bg-white/10 mx-2 hidden md:block" />

          <div className="flex flex-col gap-2">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-widest pl-1">Instancia activa</span>
            <div className="relative group" ref={instanceMenuRef}>
              <button
                type="button"
                onClick={() => {
                  if (!canSelectInstance) return;
                  setIsInstanceMenuOpen((prev) => !prev);
                }}
                disabled={!canSelectInstance}
                aria-haspopup="listbox"
                aria-expanded={isInstanceMenuOpen}
                className={`flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 backdrop-blur-md pr-10 pl-3 py-3 rounded-xl transition-all min-w-[260px] text-left ${
                  canSelectInstance ? "" : "opacity-60 cursor-not-allowed"
                }`}
              >
                <div className="w-12 h-12 rounded-lg bg-[#25252b] flex items-center justify-center overflow-hidden border border-white/10 shadow-inner p-1">
                  {selectedInstance?.thumbnail ? (
                    <img src={selectedInstance.thumbnail} alt={selectedInstance.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-black text-gray-300">{instanceInitial}</span>
                  )}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-bold text-base text-gray-200 truncate max-w-[160px]">
                    {hasInstance ? selectedInstance?.name : "Sin instancia"}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`w-2 h-2 rounded-full ${loaderDotClass}`}></span>
                    <p className="text-xs text-gray-400">{loaderLabel} {selectedInstance?.version || "N/A"}</p>
                  </div>
                </div>
                <IconChevronDown />
              </button>

              {isInstanceMenuOpen && (
                <div
                  role="listbox"
                  className="absolute mt-2 w-full min-w-[260px] bg-[#141419] border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden"
                >
                  <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    {instances.map((inst) => (
                      <button
                        key={inst.id}
                        role="option"
                        aria-selected={inst.id === selectedInstanceId}
                        type="button"
                        onClick={() => {
                          onSelectInstance(inst.id);
                          setIsInstanceMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors ${
                          inst.id === selectedInstanceId ? "bg-white/5 text-white" : "text-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#25252b] flex items-center justify-center overflow-hidden border border-white/10 p-1">
                            {inst.thumbnail ? (
                              <img src={inst.thumbnail} alt={inst.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-black text-gray-300">{inst.name.slice(0, 1).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{inst.name}</div>
                            <div className="text-xs text-gray-500">
                              {inst.loader} • {inst.version}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={onGoInstances}
                className="absolute -right-3 -top-3 w-8 h-8 bg-[#1e1e24] border border-white/10 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:border-brand-accent hover:bg-brand-accent/10 transition-all opacity-0 group-hover:opacity-100 shadow-lg scale-90 group-hover:scale-100"
                title="Editar instancia"
              >
                <Edit3 size={14} />
              </button>
            </div>
          </div>
        </div>

        {isProcessing && statusText && (
          <div className="text-sm mt-6 px-4 py-3 rounded-xl border text-gray-200 border-white/10 bg-white/5">
            {statusText}
          </div>
        )}

        {!isProcessing && statusText && (
          <div className="mt-6 space-y-2">
            <div
              className={`text-sm px-4 py-3 rounded-xl border ${
                isError
                  ? "text-red-200 border-red-800 bg-red-950/50"
                  : isSuccess
                    ? "text-brand-accent border-brand-accent/40 bg-brand-accent/10"
                    : "text-gray-200 border-white/10 bg-white/5"
              }`}
              role="status"
              aria-live="polite"
            >
              {statusText}
            </div>
            {isError && hasInstance && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onRepairInstance}
                  className="px-4 py-2 rounded-xl bg-white/5 text-gray-200 hover:bg-white/10 text-sm"
                >
                  Reparar instancia
                </button>
                {reportPath && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(reportPath).catch(() => undefined);
                    }}
                    className="px-4 py-2 rounded-xl bg-white/5 text-gray-200 hover:bg-white/10 text-sm"
                  >
                    Copiar reporte
                  </button>
                )}
                {reportPath && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!reportPath || isUploadingReport) return;
                      setUploadStatus("Subiendo reporte...");
                      setIsUploadingReport(true);
                      try {
                        const res = await tauri.uploadDiagnosticReport(reportPath, selectedInstance?.id);
                        setUploadStatus(res);
                      } catch (e: any) {
                        setUploadStatus("Error subiendo reporte: " + String(e));
                      } finally {
                        setIsUploadingReport(false);
                      }
                    }}
                    disabled={isUploadingReport}
                    aria-disabled={isUploadingReport}
                    className="px-4 py-2 rounded-xl bg-brand-info text-white hover:bg-brand-info/90 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isUploadingReport ? "Subiendo..." : "Subir reporte"}
                  </button>
                )}
                {prelaunchPath && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(prelaunchPath).catch(() => undefined);
                    }}
                    className="px-4 py-2 rounded-xl bg-white/5 text-gray-200 hover:bg-white/10 text-sm"
                  >
                    Copiar log
                  </button>
                )}
              </div>
            )}
            {uploadStatus && (
              <div className="text-xs text-gray-300 bg-gray-950/60 border border-gray-800 rounded-xl px-3 py-2">
                {uploadStatus}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="absolute bottom-8 left-12 text-xs text-gray-400 flex items-center gap-2">
        <IconJava /> {systemJava?.valid ? `Java sistema: ${systemJava.version}` : "Java: auto (portable)"}
      </div>

    </>
  );
}
