import { cn } from "../../utils/cn";
import { statusActionButton, statusBox } from "./styles";

function buildRecoveryGuide(statusText: string, reportPath: string, prelaunchPath: string) {
  const lower = statusText.toLowerCase();

  if (lower.includes("reparacion automatica aplicada")) {
    return {
      title: "Detectamos un problema e intentamos repararlo automaticamente.",
      nextStep:
        "Intenta iniciar de nuevo. Si vuelve a fallar, genera o comparte un reporte de diagnostico.",
    };
  }

  if (lower.includes("reparacion automatica fallo")) {
    return {
      title: "No pudimos reparar esta instancia automaticamente.",
      nextStep:
        "Prueba primero con Reparar instancia. Si el problema sigue, comparte un reporte de diagnostico o el log.",
    };
  }

  if (reportPath || prelaunchPath) {
    return {
      title: "No pudimos iniciar esta instancia correctamente.",
      nextStep:
        "Prueba primero con Reparar instancia. Si vuelve a fallar, copia el reporte o el log para revisarlo.",
    };
  }

  return {
    title: "No pudimos iniciar esta instancia correctamente.",
    nextStep: "Prueba primero con Reparar instancia y vuelve a intentarlo.",
  };
}

export function DashboardStatus({
  isProcessing,
  statusText,
  isError,
  isSuccess,
  hasInstance,
  onRepairInstance,
  reportPath,
  prelaunchPath,
  onUploadReport,
  isUploadingReport,
  uploadStatus,
}: {
  isProcessing: boolean;
  statusText: string;
  isError: boolean;
  isSuccess: boolean;
  hasInstance: boolean;
  onRepairInstance: () => void;
  reportPath: string;
  prelaunchPath: string;
  onUploadReport: () => void;
  isUploadingReport: boolean;
  uploadStatus: string;
}) {
  if (!statusText) return null;

  const recoveryGuide = isError && hasInstance
    ? buildRecoveryGuide(statusText, reportPath, prelaunchPath)
    : null;

  if (isProcessing) {
    return (
      <div className={cn(statusBox({ tone: "neutral" }), "mt-6")} aria-live="polite">
        {statusText}
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-2">
      <div
        className={statusBox({
          tone: isError ? "error" : isSuccess ? "success" : "neutral",
        })}
        role="status"
        aria-live="polite"
      >
        {statusText}
      </div>
      {recoveryGuide && (
        <div className="rounded-xl border border-amber-900/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          <div className="font-medium">{recoveryGuide.title}</div>
          <div className="mt-1 text-xs text-amber-200/80">{recoveryGuide.nextStep}</div>
        </div>
      )}
      {isError && hasInstance && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onRepairInstance} className={statusActionButton({ tone: "neutral" })}>
            Reparar instancia
          </button>
          {reportPath && (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(reportPath).catch(() => undefined);
              }}
              className={statusActionButton({ tone: "neutral" })}
            >
              Copiar reporte de diagnostico
            </button>
          )}
          {reportPath && (
            <button
              type="button"
              onClick={() => onUploadReport()}
              disabled={isUploadingReport}
              aria-disabled={isUploadingReport}
              className={cn(statusActionButton({ tone: "info" }), "disabled:opacity-60 disabled:cursor-not-allowed")}
            >
              {isUploadingReport ? "Subiendo reporte..." : "Subir reporte"}
            </button>
          )}
          {prelaunchPath && (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(prelaunchPath).catch(() => undefined);
              }}
              className={statusActionButton({ tone: "neutral" })}
            >
              Copiar log
            </button>
          )}
        </div>
      )}
      {uploadStatus && (
        <div className="text-xs text-gray-300 bg-gray-950/60 border border-gray-800 rounded-xl px-3 py-2">
          {uploadStatus}
        </div>
      )}
    </div>
  );
}
