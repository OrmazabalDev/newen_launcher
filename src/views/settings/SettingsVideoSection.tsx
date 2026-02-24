import { IconChevronDown } from "../../icons";
import type { GameSettings } from "../../types";
import { SectionCard } from "../../components/ui/SectionCard";
import { label, selectInput, textInput, actionButton } from "./styles";

type ResolutionPreset = {
  key: string;
  label: string;
  width: number;
  height: number;
};

export function SettingsVideoSection({
  settings,
  presets,
  resolutionMode,
  onResolutionModeChange,
  currentPreset,
  onSetResolution,
  onToggleFullscreen,
}: {
  settings: GameSettings;
  presets: ResolutionPreset[];
  resolutionMode: "preset" | "custom";
  onResolutionModeChange: (mode: "preset" | "custom") => void;
  currentPreset: ResolutionPreset | null;
  onSetResolution: (width: number, height: number) => void;
  onToggleFullscreen: (value: boolean) => void;
}) {
  const fallbackPresetKey = currentPreset?.key ?? presets[0]?.key ?? "custom";

  return (
    <SectionCard
      title="Video"
      description="Usa un preset o define tu resolución personalizada."
    >
      <label className={label()}>Resolución</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <select
            className={selectInput()}
            value={resolutionMode === "custom" ? "custom" : fallbackPresetKey}
            onChange={(e) => {
              if (e.target.value === "custom") {
                onResolutionModeChange("custom");
                return;
              }
              const preset = presets.find((p) => p.key === e.target.value);
              if (preset) {
                onResolutionModeChange("preset");
                onSetResolution(preset.width, preset.height);
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
          onClick={() => onResolutionModeChange("custom")}
          type="button"
          className={actionButton({
            tone: resolutionMode === "custom" ? "accent" : "secondary",
            size: "md",
          })}
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
            className={textInput()}
            value={settings.resolution.width}
            onChange={(e) => onSetResolution(Number(e.target.value), settings.resolution.height)}
            aria-label="Ancho"
            placeholder="Ancho"
          />
          <input
            type="number"
            min={480}
            max={4320}
            className={textInput()}
            value={settings.resolution.height}
            onChange={(e) => onSetResolution(settings.resolution.width, Number(e.target.value))}
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
          onChange={(e) => onToggleFullscreen(e.target.checked)}
        />
        <span className="text-sm text-gray-100">Pantalla completa</span>
      </label>
    </SectionCard>
  );
}
