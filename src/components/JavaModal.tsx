import React from "react";

export function JavaModal({
  open,
  onRetryDownload,
  onClose,
}: {
  open: boolean;
  onRetryDownload: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-gray-950/90 backdrop-blur-sm animate-fadeIn p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="java-modal-title"
    >
      <div className="bg-gray-900 p-8 rounded-2xl shadow-2xl border border-gray-700 max-w-sm w-full text-center">
        <h3 className="text-xl font-bold text-white mb-2" id="java-modal-title">Java no disponible</h3>
        <p className="text-sm text-gray-300">
          No se pudo preparar Java automaticamente. Reintenta la descarga.
        </p>
        <div className="space-y-3 mt-4">
          <button
            onClick={onRetryDownload}
            type="button"
            className="w-full py-3 bg-brand-accent hover:bg-brand-accent-deep rounded-xl font-bold text-white"
            aria-labelledby="java-modal-title"
          >
            Reintentar descarga
          </button>
          <button onClick={onClose} type="button" className="w-full py-3 bg-gray-800 rounded-xl text-gray-300">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
