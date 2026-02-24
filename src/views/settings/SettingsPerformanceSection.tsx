import type { GameSettings } from "../../types";
import { SectionCard } from "../../components/ui/SectionCard";
import { label, pillButton, rangeInput } from "./styles";

export function SettingsPerformanceSection({
  settings,
  ramPresets,
  onSetMaxRam,
  onSetMaxFps,
}: {
  settings: GameSettings;
  ramPresets: number[];
  onSetMaxRam: (value: number) => void;
  onSetMaxFps: (value: number) => void;
}) {
  return (
    <SectionCard
      title="Rendimiento"
      description="Asigna la memoria que puede usar Minecraft. Recomendado: 2-4 GB para vanilla, 6-8 GB para modpacks."
    >
      <label className={label()}>RAM máxima (GB)</label>
      <input
        type="range"
        min={2}
        max={16}
        step={1}
        value={settings.memory.maxGb}
        onChange={(e) => onSetMaxRam(Number(e.target.value))}
        className={rangeInput()}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {ramPresets.map((ram) => (
          <button
            key={ram}
            type="button"
            onClick={() => onSetMaxRam(ram)}
            className={pillButton({ active: settings.memory.maxGb === ram })}
          >
            {ram} GB
          </button>
        ))}
      </div>

      <div className="mt-4 text-sm text-gray-300">
        Asignado: <span className="font-bold">{settings.memory.maxGb} GB</span>
      </div>

      <div className="mt-6 border-t border-gray-800 pt-4">
        <label className={label()}>Límite de FPS</label>
        <input
          type="range"
          min={0}
          max={260}
          step={10}
          value={settings.maxFps}
          onChange={(e) => onSetMaxFps(Number(e.target.value))}
          className={rangeInput()}
        />
        <div className="mt-2 text-sm text-gray-300">
          {settings.maxFps === 0 ? "Sin límite" : `${settings.maxFps} FPS`}
        </div>
      </div>
    </SectionCard>
  );
}
