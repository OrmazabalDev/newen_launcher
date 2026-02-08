import React, { useId, useRef } from "react";
import { useModalFocus } from "../hooks/useModalFocus";

type JavaModalProps = {
  open: boolean;
  onRetryDownload: () => void;
  onClose: () => void;
};

export function JavaModal({ open, onRetryDownload, onClose }: JavaModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const retryRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const messageId = useId();

  useModalFocus({ open, containerRef: dialogRef, initialFocusRef: retryRef, onClose });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-950/90 backdrop-blur-sm animate-fadeIn p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={messageId}
    >
      <div
        ref={dialogRef}
        className="bg-gray-900 p-8 rounded-2xl shadow-2xl border border-gray-700 max-w-sm w-full text-center"
        tabIndex={-1}
      >
        <h3 className="text-xl font-bold text-white mb-2" id={titleId}>
          Java no disponible
        </h3>
        <p className="text-sm text-gray-300" id={messageId}>
          No se pudo preparar Java automáticamente. Reintenta la descarga.
        </p>
        <div className="space-y-3 mt-4">
          <button
            onClick={onRetryDownload}
            type="button"
            ref={retryRef}
            className="w-full py-3 bg-brand-accent hover:bg-brand-accent-deep rounded-xl font-bold text-white transition active:scale-[0.98]"
            aria-labelledby={titleId}
          >
            Reintentar descarga
          </button>
          <button
            onClick={onClose}
            type="button"
            className="w-full py-3 bg-gray-800 rounded-xl text-gray-300 transition hover:bg-gray-700"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
