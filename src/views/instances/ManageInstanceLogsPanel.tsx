import type { InstanceLogEntry } from "../../types";
import { formatDate, formatSize } from "./utils";

type ManageInstanceLogsPanelProps = {
  logs: InstanceLogEntry[];
  selectedLog: InstanceLogEntry | null;
  logContent: string;
  onReadLog: (entry: InstanceLogEntry) => void;
  onCopyLog: () => void;
  onGenerateReport: () => void;
};

export function ManageInstanceLogsPanel({
  logs,
  selectedLog,
  logContent,
  onReadLog,
  onCopyLog,
  onGenerateReport,
}: ManageInstanceLogsPanelProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4 h-full min-h-0">
      <div className="bg-gray-950/40 border border-gray-800 rounded-xl p-3 overflow-y-auto custom-scrollbar">
        {logs.length === 0 && (
          <div className="text-gray-500 text-sm py-6 text-center">
            No hay logs ni crash reports.
          </div>
        )}
        <div className="space-y-2">
          {logs.map((entry) => (
            <button
              key={`${entry.kind}-${entry.name}`}
              onClick={() => onReadLog(entry)}
              type="button"
              className={`w-full text-left px-3 py-2 rounded-lg border ${
                selectedLog?.name === entry.name
                  ? "border-brand-accent/60 bg-gray-800"
                  : "border-gray-800"
              }`}
            >
              <div className="text-sm text-white truncate">{entry.name}</div>
              <div className="text-[11px] text-gray-500">
                {entry.kind.toUpperCase()} - {formatSize(entry.size)} - {formatDate(entry.modified)}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-950/40 border border-gray-800 rounded-xl p-3 flex flex-col min-w-0">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>
            {selectedLog
              ? `${selectedLog.kind.toUpperCase()} - ${selectedLog.name}`
              : "Selecciona un log para ver detalles"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCopyLog}
              className="px-2 py-1 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700"
            >
              Copiar
            </button>
            <button
              type="button"
              onClick={onGenerateReport}
              className="px-2 py-1 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700"
            >
              Generar reporte
            </button>
          </div>
        </div>
        <div className="text-[11px] text-gray-500 mb-2">
          El reporte incluye logs, instances.json y diagnostic.json (SO, versión y ruta del
          launcher).
        </div>
        <pre className="flex-1 overflow-auto text-xs text-gray-200 whitespace-pre-wrap break-all select-text">
          {logContent || "Sin contenido."}
        </pre>
      </div>
    </div>
  );
}
