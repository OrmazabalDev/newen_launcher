import React, { useEffect, useState } from "react";
import type { GameSettings, InstanceSummary, RuntimeMetrics, SystemJava } from "../types";
import { IconChevronDown, IconJava } from "../icons";
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
  const [metrics, setMetrics] = useState<RuntimeMetrics | null>(null);
  const [uiFps, setUiFps] = useState(0);
  const [smoothedLauncherCpu, setSmoothedLauncherCpu] = useState<number | null>(null);
  const [smoothedGameCpu, setSmoothedGameCpu] = useState<number | null>(null);
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
    if (!settings.performanceOverlay) return;
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
  }, [settings.performanceOverlay, gamePid]);

  useEffect(() => {
    if (!settings.performanceOverlay) {
      setSmoothedLauncherCpu(null);
      setSmoothedGameCpu(null);
    }
  }, [settings.performanceOverlay]);

  useEffect(() => {
    setSmoothedGameCpu(null);
  }, [gamePid]);

  useEffect(() => {
    if (!metrics) return;
    const smooth = (prev: number | null, next: number, alpha = 0.2) =>
      prev === null ? next : prev * (1 - alpha) + next * alpha;
    if (metrics.launcher_cpu_percent !== null && metrics.launcher_cpu_percent !== undefined) {
      setSmoothedLauncherCpu((prev) => smooth(prev, metrics.launcher_cpu_percent));
    }
    if (metrics.process_cpu_percent !== null && metrics.process_cpu_percent !== undefined) {
      setSmoothedGameCpu((prev) => smooth(prev, metrics.process_cpu_percent));
    }
  }, [metrics]);

  useEffect(() => {
    if (!settings.performanceOverlay) return;
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const loop = (time: number) => {
      frames += 1;
      if (time - last >= 1000) {
        setUiFps(Math.round((frames * 1000) / (time - last)));
        frames = 0;
        last = time;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [settings.performanceOverlay]);

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

  return (
    <>
      <div className="absolute inset-0 z-0">
        <img
          src="/hero-bg.svg"
          className="w-full h-full object-cover opacity-50"
          alt=""
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/80 to-transparent" />
      </div>

      <div
        className="relative z-10 flex-1 flex flex-col justify-end p-12 max-w-6xl mx-auto w-full"
        aria-busy={isProcessing}
      >
        <div className="mb-10">
          <div className="text-xs uppercase tracking-[0.25em] text-gray-500 font-bold">Instancia activa</div>
          <h1 className="text-5xl font-black text-white mt-2 drop-shadow-2xl">
            {hasInstance ? selectedInstance?.name : "Sin instancia"}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-gray-300">
            <span className="px-2.5 py-1 rounded-full bg-gray-900/70 border border-gray-800">
              {loaderLabel}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-gray-900/70 border border-gray-800">
              {selectedInstance?.version || "N/A"}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-gray-900/70 border border-gray-800">
              {modsLabel}
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-4 max-w-2xl">
            Newen gestiona tu experiencia. Minecraft queda en segundo plano.
          </p>
        </div>

        <div className="bg-gray-900/70 backdrop-blur border border-gray-800 rounded-2xl p-6 shadow-xl w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-950/40 border border-gray-800 rounded-2xl p-5">
              <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Instancia</div>
              <div className="mt-2 text-2xl font-black text-white">
                {hasInstance ? selectedInstance?.name : "Sin instancia"}
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-sm text-gray-300">
                <span className="px-2.5 py-1 rounded-full bg-gray-900/70 border border-gray-800">{loaderLabel}</span>
                <span className="px-2.5 py-1 rounded-full bg-gray-900/70 border border-gray-800">
                  {selectedInstance?.version || "N/A"}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-gray-900/70 border border-gray-800">
                  {modsLabel}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[220px]">
                  <select
                    id="instance-select"
                    className="w-full appearance-none bg-gray-900/80 backdrop-blur border border-gray-700 text-white py-3 px-4 pr-10 rounded-xl font-medium focus:ring-2 focus:ring-brand-accent outline-none cursor-pointer hover:bg-gray-800 transition"
                    value={selectedInstanceId}
                    onChange={(e) => onSelectInstance(e.target.value)}
                    disabled={isProcessing || instances.length === 0}
                    aria-label="Instancia"
                  >
                    {instances.length === 0 && <option value="">Sin instancias</option>}
                    {instances.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                    <IconChevronDown />
                  </div>
                </div>
                <button
                  onClick={onGoInstances}
                  type="button"
                  className="px-4 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold"
                >
                  Editar
                </button>
              </div>

              {!hasInstance && (
                <button
                  onClick={onGoInstances}
                  type="button"
                  className="mt-4 px-4 py-2 rounded-xl bg-brand-accent hover:bg-brand-accent-deep text-white font-bold"
                >
                  Crear instancia
                </button>
              )}
            </div>

            <div className="bg-gray-950/40 border border-gray-800 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Estado</div>
                <div className="mt-3 flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black ${
                      isProcessing
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : isError
                          ? "bg-red-600/20 text-red-300 border border-red-600/40"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    }`}
                  >
                    {isProcessing ? "..." : isError ? "!" : "OK"}
                  </div>
                  <div>
                    <div className="text-xl font-black text-white">
                      {isProcessing ? "Procesando" : isError ? "Atención" : "Listo"}
                    </div>
                    <div className="text-gray-300 text-sm">
                      {hasInstance
                        ? `Instancia: ${selectedInstance?.name} - ${selectedInstance?.version}`
                        : "Crea una instancia para empezar."}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                {hasInstance ? (
                  <button
                    onClick={onPlay}
                    disabled={isProcessing}
                    type="button"
                    className={`w-full h-[64px] rounded-xl font-black text-2xl tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 overflow-hidden relative ${
                      isProcessing
                        ? "bg-gray-800 cursor-wait text-gray-300 border border-gray-700"
                        : "bg-brand-accent hover:bg-brand-accent-deep text-white hover:shadow-brand-accent/30 active:scale-[0.98]"
                    }`}
                  >
                    {isProcessing && (
                      <div className="absolute inset-0">
                        <div
                          className="h-full bg-white/15"
                          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                        />
                      </div>
                    )}
                    <span className="relative z-10">{launchLabel}</span>
                  </button>
                ) : (
                  <button
                    onClick={onGoInstances}
                    type="button"
                    className="w-full h-[64px] rounded-xl font-bold text-xl tracking-wide bg-brand-accent hover:bg-brand-accent-deep text-white shadow-xl transition-all"
                  >
                    CREAR UNA INSTANCIA
                  </button>
                )}

                {isProcessing && statusText && (
                  <div className="text-sm mt-1 px-3 py-2 rounded-lg border text-gray-200 border-gray-700 bg-gray-900/70">
                    {statusText}
                  </div>
                )}

                {!isProcessing && statusText && (
                  <div className="mt-1 space-y-2">
                    <div
                      className={`text-sm px-3 py-2 rounded-lg border ${
                        isError
                          ? "text-red-200 border-red-800 bg-red-950/50"
                          : isSuccess
                            ? "text-brand-accent border-brand-accent/40 bg-brand-accent/10"
                            : "text-gray-200 border-gray-700 bg-gray-900/70"
                      }`}
                      role="status"
                      aria-live="polite"
                    >
                      {statusText}
                    </div>
                    {isError && hasInstance && (
                      <button
                        type="button"
                        onClick={onRepairInstance}
                        className="px-3 py-2 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700 text-sm"
                      >
                        Reparar instancia
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-12 text-xs text-gray-400 flex items-center gap-2">
        <IconJava /> {systemJava?.valid ? `Java sistema: ${systemJava.version}` : "Java: auto (portable)"}
      </div>

      {settings.performanceOverlay && (
        <div className="absolute top-10 right-10 z-20 bg-gray-950/90 border border-gray-800 rounded-2xl px-4 py-3 text-[11px] text-gray-200 shadow-xl font-mono">
          <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Rendimiento</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div>FPS: {settings.maxFps === 0 ? "Sin límite" : settings.maxFps}</div>
            <div>UI: {uiFps}</div>
            <div>CPU: {cpuDisplay !== null && cpuDisplay !== undefined ? `${cpuDisplay.toFixed(1)}%` : "--"}</div>
            <div>RAM launcher: {formatMemory(launcherUsed)}</div>
          </div>
          <div className="mt-3 pt-2 border-t border-gray-800 text-gray-400 space-y-1">
            {gamePid && (
              <div>
                Juego: usada {formatMemory(gameUsed)} / reservada {formatMemory(gameReserved)}
              </div>
            )}
            <div>Launcher: reservada {formatMemory(launcherReserved)}</div>
          </div>
        </div>
      )}
    </>
  );
}
