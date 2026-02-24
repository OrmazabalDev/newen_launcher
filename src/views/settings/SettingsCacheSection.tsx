import { SectionCard } from "../../components/ui/SectionCard";
import { actionButton } from "./styles";

export function SettingsCacheSection({
  cacheStatus,
  isClearingCache,
  onClearCache,
}: {
  cacheStatus: string;
  isClearingCache: boolean;
  onClearCache: () => void | Promise<void>;
}) {
  return (
    <SectionCard
      title="Cache"
      description="Limpia archivos temporales de descargas y manifiestos. No borra instancias."
    >
      <button
        type="button"
        onClick={() => void onClearCache()}
        disabled={isClearingCache}
        aria-disabled={isClearingCache}
        title={isClearingCache ? "Limpiando cache..." : "Limpiar cache"}
        className={actionButton({ tone: "primary", size: "md" })}
      >
        {isClearingCache ? "Limpiando..." : "Limpiar cache"}
      </button>
      {cacheStatus && (
        <div className="mt-3 text-xs text-gray-300 bg-gray-950/60 border border-gray-800 rounded-xl px-3 py-2">
          {cacheStatus}
        </div>
      )}
    </SectionCard>
  );
}
