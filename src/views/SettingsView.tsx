import React, { useEffect, useMemo, useState } from "react";
import type { GameSettings } from "../types";
import { IconChevronDown } from "../icons";
import * as tauri from "../services/tauri";

const DEFAULT_SETTINGS: GameSettings = {
  resolution: { width: 1280, height: 720 },
  fullscreen: true,
  memory: { minGb: 1, maxGb: 2 },
  javaArgs: "",
  javaPath: "",
  maxFps: 120,
  focusMode: false,
  performanceOverlay: true,
};

const RAM_PRESETS = [2, 4, 6, 8, 12, 16];
const UI_SCALES = [0.9, 1, 1.1, 1.25];
export function SettingsView({
  settings,
  onChange,
  uiScale,
  onChangeUiScale,
}: {
  settings: GameSettings;
  onChange: (s: GameSettings) => void;
  uiScale: number;
  onChangeUiScale: (value: number) => void;
}) {
  const presets = useMemo(
    () => [
      { key: "1280x720", label: "1280x720 (HD)", width: 1280, height: 720 },
      { key: "1366x768", label: "1366x768", width: 1366, height: 768 },
      { key: "1600x900", label: "1600x900", width: 1600, height: 900 },
      { key: "1920x1080", label: "1920x1080 (Full HD)", width: 1920, height: 1080 },
      { key: "2560x1440", label: "2560x1440 (2K)", width: 2560, height: 1440 },
    ],
    []
  );

  const findPreset = (width: number, height: number) =>
    presets.find((p) => p.width === width && p.height === height) || null;

  const [resolutionMode, setResolutionMode] = useState<"preset" | "custom">(
    findPreset(settings.resolution.width, settings.resolution.height) ? "preset" : "custom"
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cacheStatus, setCacheStatus] = useState("");
  const [reportStatus, setReportStatus] = useState("");
  const [reportPath, setReportPath] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isUploadingReport, setIsUploadingReport] = useState(false);

  const currentPreset = findPreset(settings.resolution.width, settings.resolution.height);

  useEffect(() => {
    const preset = findPreset(settings.resolution.width, settings.resolution.height);
    setResolutionMode(preset ? "preset" : "custom");
  }, [settings.resolution.width, settings.resolution.height, presets]);

  const setResolution = (width: number, height: number) =>
    onChange({ ...settings, resolution: { width, height } });

  const setMinRam = (minGb: number) => {
    const maxGb = Math.max(minGb, settings.memory.maxGb);
    onChange({ ...settings, memory: { minGb, maxGb } });
  };

  const setMaxRam = (maxGb: number) => {
    const minGb = Math.min(settings.memory.minGb, maxGb);
    onChange({ ...settings, memory: { minGb, maxGb } });
  };

  const setMaxFps = (value: number) => {
    onChange({ ...settings, maxFps: value });
  };

  const handleClearCache = async () => {
    setCacheStatus("Limpiando cache...");
    setIsClearingCache(true);
    try {
      const msg = await tauri.clearCache();
      setCacheStatus(msg);
    } catch (e: any) {
      setCacheStatus("Error limpiando cache: " + String(e));
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleGenerateReport = async () => {
    setReportStatus("Generando reporte...");
    setUploadStatus("");
    setIsGeneratingReport(true);
    try {
      const path = await tauri.generateDiagnosticReport();
      setReportStatus(`Reporte generado: ${path}`);
      setReportPath(path);
    } catch (e: any) {
      setReportStatus("Error generando reporte: " + String(e));
      setReportPath("");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleUploadReport = async () => {
    if (!reportPath) {
      setUploadStatus("Primero genera un reporte.");
      return;
    }
    setUploadStatus("Subiendo reporte...");
    setIsUploadingReport(true);
    try {
      const res = await tauri.uploadDiagnosticReport(reportPath);
      setUploadStatus(res);
    } catch (e: any) {
      setUploadStatus("Error subiendo reporte: " + String(e));
    } finally {
      setIsUploadingReport(false);
    }
  };

  return (
    <div className="absolute inset-0 z-20 bg-gray-950 flex flex-col p-8 overflow-y-auto animate-fadeIn">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white">Ajustes</h2>
        <p className="text-gray-300 text-sm">
          Personaliza rendimiento, video y opciones avanzadas. Los cambios se guardan automáticamente.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
        <div className="space-y-6">
          <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-lg font-bold text-white mb-2">Video</h3>
            <p className="text-xs text-gray-400 mb-4">
              Usa un preset o define tu resolucion personalizada.
            </p>

            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">
              Resolucion
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  className="w-full appearance-none bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-brand-accent"
                  value={resolutionMode === "custom" ? "custom" : currentPreset?.key || presets[0].key}
                  onChange={(e) => {
                    if (e.target.value === "custom") {
                      setResolutionMode("custom");
                      return;
                    }
                    const preset = presets.find((p) => p.key === e.target.value);
                    if (preset) {
                      setResolutionMode("preset");
                      setResolution(preset.width, preset.height);
                    }
                  }}
                >
                  {presets.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                  <option value="custom">Personalizada</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                  <IconChevronDown />
                </div>
              </div>
              <button
                onClick={() => setResolutionMode("custom")}
                type="button"
                className={`px-4 py-2 rounded-xl font-bold ${
                  resolutionMode === "custom"
                    ? "bg-brand-accent text-white"
                    : "bg-gray-800 text-gray-200 hover:bg-gray-700"
                }`}
              >
                Personalizar
              </button>
            </div>

            {resolutionMode === "custom" && (
              <div className="flex gap-3 mt-3">
                <input
                  type="number"
                  min={640}
                  max={7680}
                  className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-brand-accent"
                  value={settings.resolution.width}
                  onChange={(e) => setResolution(Number(e.target.value), settings.resolution.height)}
                  aria-label="Ancho"
                  placeholder="Ancho"
                />
                <input
                  type="number"
                  min={480}
                  max={4320}
                  className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-brand-accent"
                  value={settings.resolution.height}
                  onChange={(e) => setResolution(settings.resolution.width, Number(e.target.value))}
                  aria-label="Alto"
                  placeholder="Alto"
                />
              </div>
            )}

            <label className="mt-4 flex items-center gap-3 bg-gray-950/60 border border-gray-800 rounded-xl px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                className="accent-brand-accent"
                checked={settings.fullscreen}
                onChange={(e) => onChange({ ...settings, fullscreen: e.target.checked })}
              />
              <span className="text-sm text-gray-100">Pantalla completa</span>
            </label>
          </section>

          <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-lg font-bold text-white mb-2">Rendimiento</h3>
            <p className="text-xs text-gray-400 mb-4">
              Asigna la memoria que puede usar Minecraft. Recomendado: 2-4 GB para vanilla, 6-8 GB para modpacks.
            </p>

            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">
              RAM maxima (GB)
            </label>
            <input
              type="range"
              min={2}
              max={16}
              step={1}
              value={settings.memory.maxGb}
              onChange={(e) => setMaxRam(Number(e.target.value))}
              className="w-full accent-brand-accent"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {RAM_PRESETS.map((ram) => (
                <button
                  key={ram}
                  type="button"
                  onClick={() => setMaxRam(ram)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                    settings.memory.maxGb === ram
                      ? "bg-brand-accent text-white border-brand-accent/70"
                      : "bg-gray-900 text-gray-300 border-gray-700"
                  }`}
                >
                  {ram} GB
                </button>
              ))}
            </div>

            <div className="mt-4 text-sm text-gray-300">
              Asignado: <span className="font-bold">{settings.memory.maxGb} GB</span>
            </div>

            <div className="mt-6 border-t border-gray-800 pt-4">
              <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">
                Limite de FPS
              </label>
              <input
                type="range"
                min={0}
                max={260}
                step={10}
                value={settings.maxFps}
                onChange={(e) => setMaxFps(Number(e.target.value))}
                className="w-full accent-brand-accent"
              />
              <div className="mt-2 text-sm text-gray-300">
                {settings.maxFps === 0 ? "Sin límite" : `${settings.maxFps} FPS`}
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Avanzado</h3>
                <p className="text-xs text-gray-400">Opciones para usuarios tecnicos.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvanced((prev) => !prev)}
                className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-200 text-xs font-bold"
              >
                {showAdvanced ? "Ocultar" : "Mostrar"}
              </button>
            </div>

            {showAdvanced && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">
                    RAM minima (GB)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={settings.memory.maxGb}
                    value={settings.memory.minGb}
                    onChange={(e) => setMinRam(Number(e.target.value))}
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-brand-accent"
                  />
                </div>

              </div>
            )}
          </section>

          <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-lg font-bold text-white mb-2">Interfaz</h3>
            <p className="text-xs text-gray-400 mb-4">
              Ajusta el tamaño de la UI sin deformar el layout.
            </p>
            <div className="flex flex-wrap gap-2">
              {UI_SCALES.map((scale) => {
                const label = `${Math.round(scale * 100)}%`;
                const active = Math.abs(uiScale - scale) < 0.01;
                return (
                  <button
                    key={scale}
                    type="button"
                    onClick={() => onChangeUiScale(scale)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                      active
                        ? "bg-brand-accent text-white border-brand-accent/70"
                        : "bg-gray-900 text-gray-300 border-gray-700"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 text-xs text-gray-500">
              Recomendado: 100%. Si ves recortes, reduce la escala o amplia la ventana.
            </div>
          </section>

          <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-lg font-bold text-white mb-2">Cache</h3>
            <p className="text-xs text-gray-400 mb-4">
              Limpia archivos temporales de descargas y manifiestos. No borra instancias.
            </p>
            <button
              type="button"
              onClick={handleClearCache}
              disabled={isClearingCache}
              aria-disabled={isClearingCache}
              title={isClearingCache ? "Limpiando cache..." : "Limpiar cache"}
              className="px-4 py-2 rounded-xl bg-brand-info hover:bg-brand-info/90 text-white font-bold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isClearingCache ? "Limpiando..." : "Limpiar cache"}
            </button>
            {cacheStatus && (
              <div className="mt-3 text-xs text-gray-300 bg-gray-950/60 border border-gray-800 rounded-xl px-3 py-2">
                {cacheStatus}
              </div>
            )}
          </section>

          <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-lg font-bold text-white mb-2">Diagnostico</h3>
            <p className="text-xs text-gray-400 mb-4">
              Genera un reporte con logs y configuracion para soporte tecnico.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleGenerateReport}
                disabled={isGeneratingReport}
                aria-disabled={isGeneratingReport}
                title={isGeneratingReport ? "Generando reporte..." : "Generar reporte"}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isGeneratingReport ? "Generando..." : "Generar reporte"}
              </button>
              <button
                type="button"
                onClick={handleUploadReport}
                disabled={!reportPath || isUploadingReport}
                aria-disabled={!reportPath || isUploadingReport}
                title={isUploadingReport ? "Subiendo reporte..." : "Subir reporte"}
                className="px-4 py-2 rounded-xl bg-brand-info hover:bg-brand-info/90 text-white font-bold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isUploadingReport ? "Subiendo..." : "Subir reporte"}
              </button>
            </div>
            {reportStatus && (
              <div className="mt-3 text-xs text-gray-300 bg-gray-950/60 border border-gray-800 rounded-xl px-3 py-2">
                {reportStatus}
              </div>
            )}
            {uploadStatus && (
              <div className="mt-2 text-xs text-gray-300 bg-gray-950/60 border border-gray-800 rounded-xl px-3 py-2">
                {uploadStatus}
              </div>
            )}
          </section>

          <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-lg font-bold text-white mb-2">Comportamiento</h3>
            <p className="text-xs text-gray-400 mb-4">
              Activa el modo enfoque para minimizar el launcher cuando el juego arranca y restaurarlo al cerrar.
            </p>
            <label className="flex items-center gap-3 bg-gray-950/60 border border-gray-800 rounded-xl px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                className="accent-brand-accent"
                checked={settings.focusMode}
                onChange={(e) => onChange({ ...settings, focusMode: e.target.checked })}
              />
              <span className="text-sm text-gray-100">Focus Mode (minimizar al iniciar)</span>
            </label>
            <label className="mt-3 flex items-center gap-3 bg-gray-950/60 border border-gray-800 rounded-xl px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                className="accent-brand-accent"
                checked={Boolean(settings.performanceOverlay)}
                onChange={(e) => onChange({ ...settings, performanceOverlay: e.target.checked })}
              />
              <span className="text-sm text-gray-100">Overlay de rendimiento en el launcher</span>
            </label>
          </section>

          <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-lg font-bold text-white mb-2">Restablecer</h3>
            <p className="text-xs text-gray-400 mb-4">
              Si algo no funciona, vuelve a la configuracion recomendada.
            </p>
            <button
              type="button"
              onClick={() => onChange(DEFAULT_SETTINGS)}
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold"
            >
              Restaurar ajustes por defecto
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
