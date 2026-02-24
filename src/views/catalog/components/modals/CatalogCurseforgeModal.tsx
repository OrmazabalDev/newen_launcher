import type { RefObject } from "react";
import type { CurseForgeMod } from "../../../../types";
import { modalBackdrop, modalCard } from "../../../../components/modalStyles";
import { panelCompact, primaryButton, textButton } from "../../styles";
import { cn } from "../../../../utils/cn";

type CatalogCurseforgeModalProps = {
  open: boolean;
  selectedCurse: CurseForgeMod | null;
  showCurseforgeBanner: boolean;
  onClose: () => void;
  modalRef: RefObject<HTMLDivElement>;
  closeRef: RefObject<HTMLButtonElement>;
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
      className={modalBackdrop({ context: "catalog" })}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className={modalCard({
          size: "lg",
          padding: "none",
          tone: "subtle",
          overflow: "hidden",
        })}
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
                <img
                  src={selectedCurse.logo.thumbnail_url}
                  alt={selectedCurse.name}
                  className="w-full h-full object-cover"
                />
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
            className={textButton()}
            aria-label="Cerrar"
            ref={closeRef}
          >
            X
          </button>
        </div>
        <div className="p-6">
          <div className={cn(panelCompact(), "p-4")}>
            Integración de CurseForge: búsqueda disponible. Instalación y dependencias se
            implementarán con API key.
          </div>
          <div className="mt-4 space-y-2">
            <button
              type="button"
              disabled
              className={cn(
                primaryButton({ tone: "gray" }),
                "w-full px-4 py-2.5 text-sm cursor-not-allowed"
              )}
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
