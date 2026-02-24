import { SectionCard } from "../../components/ui/SectionCard";
import { actionButton } from "./styles";
import { cn } from "../../utils/cn";

export function SettingsDiagnosticsSection({
  reportStatus,
  uploadStatus,
  isGeneratingReport,
  onGenerateReport,
}: {
  reportStatus: string;
  uploadStatus: string;
  isGeneratingReport: boolean;
  onGenerateReport: () => void | Promise<void>;
}) {
  return (
    <SectionCard
      title="Diagnóstico"
      description="Genera un reporte con logs y configuración para soporte técnico."
      className="min-w-0"
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onGenerateReport()}
          disabled={isGeneratingReport}
          aria-disabled={isGeneratingReport}
          title={isGeneratingReport ? "Generando reporte..." : "Generar reporte"}
          className={actionButton({ tone: "secondary", size: "md" })}
        >
          {isGeneratingReport ? "Generando..." : "Generar reporte"}
        </button>
        <button
          type="button"
          disabled
          aria-disabled
          title="Próximamente"
          className={cn(actionButton({ tone: "muted", size: "md" }), "cursor-not-allowed")}
        >
          Próximamente
        </button>
      </div>
      {reportStatus && (
        <div className="mt-3 text-xs text-gray-300 bg-gray-950/60 border border-gray-800 rounded-xl px-3 py-2 max-w-full break-all">
          {reportStatus}
        </div>
      )}
      {uploadStatus && (
        <div className="mt-2 text-xs text-gray-300 bg-gray-950/60 border border-gray-800 rounded-xl px-3 py-2 max-w-full break-all">
          {uploadStatus}
        </div>
      )}
    </SectionCard>
  );
}
