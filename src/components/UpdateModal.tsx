import React, { useRef } from "react";
import { useModalFocus } from "../hooks/useModalFocus";

type UpdateModalProps = {
  open: boolean;
  version: string;
  notes?: string | null;
  date?: string | null;
  isDownloading?: boolean;
  error?: string | null;
  onUpdate: () => void;
  onLater: () => void;
};

const formatDate = (value?: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString();
};

export function UpdateModal({
  open,
  version,
  notes,
  date,
  isDownloading = false,
  error,
  onUpdate,
  onLater,
}: UpdateModalProps) {
  if (!open) return null;

  const prettyDate = formatDate(date);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const updateRef = useRef<HTMLButtonElement | null>(null);
  const summaryId = "update-modal-summary";

  useModalFocus({ open, containerRef: dialogRef, initialFocusRef: updateRef, onClose: onLater });

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-950/90 backdrop-blur-sm animate-fadeIn p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-modal-title"
      aria-describedby={summaryId}
    >
      <div
        ref={dialogRef}
        className="bg-gray-900 p-8 rounded-2xl shadow-2xl border border-gray-700 max-w-lg w-full"
        tabIndex={-1}
      >
        <h3 className="text-xl font-bold text-white mb-2" id="update-modal-title">
          Actualización disponible
        </h3>
        <div className="text-sm text-gray-300 space-y-2" id={summaryId}>
          <div>
            Versión nueva: <span className="text-white font-semibold">{version}</span>
          </div>
          {prettyDate && <div>Publicada: {prettyDate}</div>}
          {notes && (
            <div className="mt-3 bg-gray-950/60 border border-gray-800 rounded-xl p-3 max-h-40 overflow-auto whitespace-pre-wrap text-gray-200">
              {notes}
            </div>
          )}
          {error && <div className="text-red-300">{error}</div>}
        </div>
        <div className="mt-5 space-y-3">
          <button
            onClick={onUpdate}
            type="button"
            disabled={isDownloading}
            ref={updateRef}
            className={`w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition active:scale-[0.98] ${
              isDownloading ? "bg-brand-accent/60 cursor-not-allowed" : "bg-brand-accent hover:bg-brand-accent-deep"
            }`}
          >
            {isDownloading && (
              <span className="inline-block h-4 w-4 rounded-full border-2 border-white/60 border-t-white animate-spin" />
            )}
            {isDownloading ? "Actualizando..." : "Actualizar ahora"}
          </button>
          <button
            onClick={onLater}
            type="button"
            disabled={isDownloading}
            className="w-full py-3 bg-gray-800 rounded-xl text-gray-300 disabled:opacity-60 transition hover:bg-gray-700"
          >
            Actualizar más tarde
          </button>
        </div>
      </div>
    </div>
  );
}
