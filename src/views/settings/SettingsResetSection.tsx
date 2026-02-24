import { SectionCard } from "../../components/ui/SectionCard";
import { actionButton } from "./styles";

export function SettingsResetSection({ onReset }: { onReset: () => void }) {
  return (
    <SectionCard
      title="Restablecer"
      description="Si algo no funciona, vuelve a la configuración recomendada."
    >
      <button type="button" onClick={onReset} className={actionButton({ tone: "secondary" })}>
        Restaurar ajustes por defecto
      </button>
    </SectionCard>
  );
}
