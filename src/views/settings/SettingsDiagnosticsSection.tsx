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
      title="Diagnostico"
      description="Genera un reporte de diagnostico con logs y configuracion para soporte."
      className="min-w-0"
    >
      <div className="mb-4 space-y-2 text-xs text-gray-400">
        <p>
          El reporte incluye logs, configuracion del launcher y datos utiles para diagnosticar
          fallos.
        </p>
        <p>
          Se guarda localmente en tu equipo y no se sube automaticamente. Puedes compartirlo de
          forma manual si necesitas soporte.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onGenerateReport()}
          disabled={isGeneratingReport}
          aria-disabled={isGeneratingReport}
          title={
            isGeneratingReport ? "Generando reporte de diagnostico..." : "Generar reporte de diagnostico"
          }
          className={actionButton({ tone: "secondary", size: "md" })}
        >
          {isGeneratingReport ? "Generando..." : "Generar reporte de diagnostico"}
        </button>
        <button
          type="button"
          disabled
          aria-disabled
          title="Subir reporte (proximamente)"
          className={cn(actionButton({ tone: "muted", size: "md" }), "cursor-not-allowed")}
        >
          Subir reporte (proximamente)
        </button>
      </div>
      <div className="mt-3 text-[11px] text-gray-500">
        Hoy puedes generar el reporte y compartirlo manualmente junto con el log o el reporte de
        crash.
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
