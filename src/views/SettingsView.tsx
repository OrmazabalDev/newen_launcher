import { useEffect, useState } from "react";
import type { GameSettings } from "../types";
import * as tauri from "../services/tauri";
import {
  DEFAULT_SETTINGS,
  RAM_PRESETS,
  RESOLUTION_PRESETS,
  UI_SCALES,
} from "./settings/constants";
import { SettingsHeader } from "./settings/SettingsHeader";
import { SettingsVideoSection } from "./settings/SettingsVideoSection";
import { SettingsPerformanceSection } from "./settings/SettingsPerformanceSection";
import { SettingsUiSection } from "./settings/SettingsUiSection";
import { SettingsBehaviorSection } from "./settings/SettingsBehaviorSection";
import { SettingsCacheSection } from "./settings/SettingsCacheSection";
import { SettingsDiagnosticsSection } from "./settings/SettingsDiagnosticsSection";
import { SettingsResetSection } from "./settings/SettingsResetSection";

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
  const findPreset = (width: number, height: number) =>
    RESOLUTION_PRESETS.find((p) => p.width === width && p.height === height) || null;

  const [resolutionMode, setResolutionMode] = useState<"preset" | "custom">(
    findPreset(settings.resolution.width, settings.resolution.height) ? "preset" : "custom"
  );
  const [cacheStatus, setCacheStatus] = useState("");
  const [reportStatus, setReportStatus] = useState("");
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const currentPreset = findPreset(settings.resolution.width, settings.resolution.height);

  useEffect(() => {
    const preset = findPreset(settings.resolution.width, settings.resolution.height);
    setResolutionMode(preset ? "preset" : "custom");
  }, [settings.resolution.width, settings.resolution.height]);

  const setResolution = (width: number, height: number) =>
    onChange({ ...settings, resolution: { width, height } });

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
    } catch (e) {
      setCacheStatus("Error limpiando cache: " + String(e));
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleGenerateReport = async () => {
    setReportStatus("Generando reporte...");
    setIsGeneratingReport(true);
    try {
      const path = await tauri.generateDiagnosticReport();
      setReportStatus(`Reporte generado: ${path}`);
    } catch (e) {
      setReportStatus("Error generando reporte: " + String(e));
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <div className="absolute inset-0 z-20 bg-gray-950 flex flex-col p-8 overflow-y-auto animate-fadeIn">
      <SettingsHeader />

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
        <div className="space-y-6">
          <SettingsVideoSection
            settings={settings}
            presets={RESOLUTION_PRESETS}
            resolutionMode={resolutionMode}
            onResolutionModeChange={setResolutionMode}
            currentPreset={currentPreset}
            onSetResolution={setResolution}
            onToggleFullscreen={(value) => onChange({ ...settings, fullscreen: value })}
          />

          <SettingsPerformanceSection
            settings={settings}
            ramPresets={RAM_PRESETS}
            onSetMaxRam={setMaxRam}
            onSetMaxFps={setMaxFps}
          />
        </div>

        <div className="space-y-6">
          <SettingsUiSection uiScale={uiScale} scales={UI_SCALES} onChangeUiScale={onChangeUiScale} />

          <SettingsBehaviorSection settings={settings} onChange={onChange} />

          <SettingsCacheSection
            cacheStatus={cacheStatus}
            isClearingCache={isClearingCache}
            onClearCache={handleClearCache}
          />

          <SettingsDiagnosticsSection
            reportStatus={reportStatus}
            uploadStatus={""}
            isGeneratingReport={isGeneratingReport}
            onGenerateReport={handleGenerateReport}
          />

          <SettingsResetSection onReset={() => onChange(DEFAULT_SETTINGS)} />
        </div>
      </div>
    </div>
  );
}

