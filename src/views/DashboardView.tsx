import { useEffect, useState } from "react";
import type { GameSettings, InstanceSummary, RuntimeMetrics, SystemJava } from "../types";
import * as tauri from "../services/tauri";
import { DashboardBackground } from "./dashboard/DashboardBackground";
import { DashboardHeader } from "./dashboard/DashboardHeader";
import { DashboardHero } from "./dashboard/DashboardHero";
import { DashboardPrimaryAction } from "./dashboard/DashboardPrimaryAction";
import { DashboardInstancePicker } from "./dashboard/DashboardInstancePicker";
import { DashboardStatus } from "./dashboard/DashboardStatus";
import { DashboardFooter } from "./dashboard/DashboardFooter";

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
  settings: _settings,
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
  const reportPath = reportPathMatch?.[1]?.trim() ?? "";
  const prelaunchMatch = statusText.match(/Log prelaunch:\s*([^|]+)/i);
  const prelaunchPath = prelaunchMatch?.[1]?.trim() ?? "";
  const [uploadStatus, setUploadStatus] = useState("");
  const [isUploadingReport, setIsUploadingReport] = useState(false);
  const [metrics, setMetrics] = useState<RuntimeMetrics | null>(null);
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
        if (gamePid == null) {
          if (alive) setMetrics(null);
          return;
        }
        const data = await tauri.getRuntimeMetrics(gamePid);
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
    setUploadStatus("");
    setIsUploadingReport(false);
  }, [statusText]);

  const formatMemory = (mb: number | null | undefined) => {
    if (mb === null || mb === undefined) return "--";
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb} MB`;
  };

  const launcherUsed = metrics?.launcher_memory_mb ?? null;
  const launcherReserved = metrics?.launcher_virtual_mb ?? null;
  const gameUsed = metrics?.process_memory_mb ?? null;
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

  const handleUploadReport = async () => {
    if (!reportPath || isUploadingReport) return;
    setUploadStatus("Subiendo reporte...");
    setIsUploadingReport(true);
    try {
      const res = await tauri.uploadDiagnosticReport(reportPath, selectedInstance?.id);
      setUploadStatus(res);
    } catch (e) {
      setUploadStatus("Error subiendo reporte: " + String(e));
    } finally {
      setIsUploadingReport(false);
    }
  };

  return (
    <>
      <DashboardBackground />
      <DashboardHeader
        ramDisplay={ramDisplay}
        launcherReserved={formatMemory(launcherReserved)}
      />

      <div
        className="relative z-10 flex-1 flex flex-col justify-center px-12 lg:px-20 pb-16"
        aria-busy={isProcessing}
      >
        <DashboardHero
          loaderLabel={loaderLabel}
          modsLabel={modsLabel}
          version={selectedInstance?.version || ""}
          hasInstance={hasInstance}
          instanceName={selectedInstance?.name || ""}
        />

        <div className="flex flex-col md:flex-row items-start md:items-center gap-8 mt-2">
          <DashboardPrimaryAction
            hasInstance={hasInstance}
            isProcessing={isProcessing}
            launchLabel={launchLabel}
            onPlay={onPlay}
            onGoInstances={onGoInstances}
          />

          <div className="h-16 w-px bg-white/10 mx-2 hidden md:block" />

          <DashboardInstancePicker
            instances={instances}
            selectedInstanceId={selectedInstanceId}
            selectedInstance={selectedInstance}
            instanceInitial={instanceInitial}
            loaderLabel={loaderLabel}
            loaderDotClass={loaderDotClass}
            canSelect={canSelectInstance}
            onSelectInstance={onSelectInstance}
            onGoInstances={onGoInstances}
          />
        </div>

        <DashboardStatus
          isProcessing={isProcessing}
          statusText={statusText}
          isError={isError}
          isSuccess={isSuccess}
          hasInstance={hasInstance}
          onRepairInstance={onRepairInstance}
          reportPath={reportPath}
          prelaunchPath={prelaunchPath}
          onUploadReport={handleUploadReport}
          isUploadingReport={isUploadingReport}
          uploadStatus={uploadStatus}
        />
      </div>

      <DashboardFooter systemJava={systemJava} />
    </>
  );
}

