import type { RefObject } from "react";
import type { CurseForgeMod } from "../../../../types";

type CatalogCurseforgeModalProps = {
  open: boolean;
  selectedCurse: CurseForgeMod | null;
  showCurseforgeBanner: boolean;
  onClose: () => void;
  modalRef: RefObject<HTMLDivElement | null>;
  closeRef: RefObject<HTMLButtonElement | null>;
};

export function CatalogCurseforgeModal({
  open,
  selectedCurse,
  showCurseforgeBanner,
  onClose,
  modalRef,
  closeRef,
}: CatalogCurseforgeModalProps) {
  if (!open || !selectedCurse) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/90 backdrop-blur-sm p-6 overscroll-contain"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="curseforge-modal-title"
        aria-describedby="curseforge-modal-desc"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gray-800 overflow-hidden">
              {selectedCurse.logo?.thumbnail_url ? (
                <img src={selectedCurse.logo.thumbnail_url} alt={selectedCurse.name} className="w-full h-full object-cover" />
              ) : null}
            </div>
            <div>
              <div className="text-lg font-bold text-white" id="curseforge-modal-title">
                {selectedCurse.name}
              </div>
              <div className="text-xs text-gray-400" id="curseforge-modal-desc">
                {selectedCurse.summary}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            aria-label="Cerrar"
            ref={closeRef}
          >
            X
          </button>
        </div>
        <div className="p-6">
          <div className="text-sm text-gray-300 bg-gray-950/60 border border-gray-800 rounded-xl p-4">
            Integración de CurseForge: búsqueda disponible. Instalación y dependencias se implementarán con API key.
          </div>
          <div className="mt-4 space-y-2">
            <button
              type="button"
              disabled
              className="w-full px-4 py-2.5 rounded-xl bg-gray-800 text-gray-400 text-sm font-bold cursor-not-allowed"
            >
              Instalación no disponible
            </button>
            {showCurseforgeBanner && (
              <div className="text-xs text-amber-300">
                Agrega CURSEFORGE_API_KEY para habilitar instalación.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
