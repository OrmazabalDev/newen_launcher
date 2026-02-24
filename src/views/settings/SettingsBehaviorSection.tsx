import type { GameSettings } from "../../types";
import { SectionCard } from "../../components/ui/SectionCard";
import { toggleRow } from "./styles";
import { cn } from "../../utils/cn";

export function SettingsBehaviorSection({
  settings,
  onChange,
}: {
  settings: GameSettings;
  onChange: (settings: GameSettings) => void;
}) {
  return (
    <SectionCard
      title="Comportamiento"
      description="Activa el modo enfoque para minimizar el launcher cuando el juego arranca y restaurarlo al cerrar."
    >
      <label className={toggleRow()}>
        <input
          type="checkbox"
          className="accent-brand-accent"
          checked={settings.focusMode}
          onChange={(e) => onChange({ ...settings, focusMode: e.target.checked })}
        />
        <span className="text-sm text-gray-100">Focus Mode (minimizar al iniciar)</span>
      </label>
      <label className={cn(toggleRow(), "mt-3")}>
        <input
          type="checkbox"
          className="accent-brand-accent"
          checked={Boolean(settings.performanceOverlay)}
          onChange={(e) => onChange({ ...settings, performanceOverlay: e.target.checked })}
        />
        <span className="text-sm text-gray-100">Overlay de rendimiento en el launcher</span>
      </label>
    </SectionCard>
  );
}
