import { cn } from "../../utils/cn";
import { statusActionButton, statusBox } from "./styles";

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
              Copiar reporte
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
              {isUploadingReport ? "Subiendo..." : "Subir reporte"}
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
