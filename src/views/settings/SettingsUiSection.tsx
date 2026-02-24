import { SectionCard } from "../../components/ui/SectionCard";
import { pillButton } from "./styles";

export function SettingsUiSection({
  uiScale,
  scales,
  onChangeUiScale,
}: {
  uiScale: number;
  scales: number[];
  onChangeUiScale: (value: number) => void;
}) {
  return (
    <SectionCard title="Interfaz" description="Ajusta el tamaño de la UI sin deformar el layout.">
      <div className="flex flex-wrap gap-2">
        {scales.map((scale) => {
          const label = `${Math.round(scale * 100)}%`;
          const active = Math.abs(uiScale - scale) < 0.01;
          return (
            <button
              key={scale}
              type="button"
              onClick={() => onChangeUiScale(scale)}
              className={pillButton({ active })}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="mt-3 text-xs text-gray-500">
        Recomendado: 100%. Si ves recortes, reduce la escala o amplía la ventana.
      </div>
    </SectionCard>
  );
}
