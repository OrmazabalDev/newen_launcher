import type { ReactNode, RefObject } from "react";
import type { ModrinthProject, ModrinthProjectHit, ModrinthVersion } from "../../../../types";
import { IconChevronDown } from "../../../../icons";
import { ModrinthMarkdown } from "../ModrinthMarkdown";
import { cn } from "../../../../utils/cn";
import { modalBackdrop, modalCard } from "../../../../components/modalStyles";
import {
  panelCompact,
  primaryButton,
  selectInput,
  textButton,
} from "../../styles";

type ModrinthGalleryItem = NonNullable<ModrinthProject["gallery"]>[number];

type CatalogModpackModalProps = {
  open: boolean;
  selectedProject: ModrinthProjectHit | null;
  projectTypeLabel: string;
  versionLabel: string;
  activeImage: ModrinthGalleryItem | null;
  gallery: ModrinthGalleryItem[];
  galleryCount: number;
  galleryIndex: number;
  onPrevImage: () => void;
  onNextImage: () => void;
  onSelectImage: (index: number) => void;
  modpackDetails: ModrinthProject | null;
  showFullDescription: boolean;
  modpackPreview: string;
  showDescriptionToggle: boolean;
  onShowFullDescription: () => void;
  onHideFullDescription: () => void;
  versions: ModrinthVersion[];
  selectedVersion: ModrinthVersion | null;
  selectedVersionId: string;
  onSelectVersionId: (value: string) => void;
  loaderLabel: string;
  onInstall: (versionId: string) => void | Promise<void>;
  modpackButtonContent: ReactNode;
  modpackInstallDisabledReason: string;
  loading: boolean;
  progressText: string;
  onClose: () => void;
  modalRef: RefObject<HTMLDivElement>;
  closeRef: RefObject<HTMLButtonElement>;
};

export function CatalogModpackModal({
  open,
  selectedProject,
  projectTypeLabel,
  versionLabel,
  activeImage,
  gallery,
  galleryCount,
  galleryIndex,
  onPrevImage,
  onNextImage,
  onSelectImage,
  modpackDetails,
  showFullDescription,
  modpackPreview,
  showDescriptionToggle,
  onShowFullDescription,
  onHideFullDescription,
  versions,
  selectedVersion,
  selectedVersionId,
  onSelectVersionId,
  loaderLabel,
  onInstall,
  modpackButtonContent,
  modpackInstallDisabledReason,
  loading,
  progressText,
  onClose,
  modalRef,
  closeRef,
}: CatalogModpackModalProps) {
  if (!open || !selectedProject) return null;

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
          size: "2xl",
          padding: "none",
          tone: "subtle",
          overflow: "hidden",
        })}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modpack-modal-title"
        aria-describedby="modpack-modal-desc"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gray-800 overflow-hidden">
              {selectedProject.icon_url ? (
                <img
                  src={selectedProject.icon_url}
                  alt={selectedProject.title}
                  className="w-full h-full object-cover"
                />
              ) : null}
            </div>
            <div>
              <div className="text-lg font-bold text-white" id="modpack-modal-title">
                {selectedProject.title}
              </div>
              <div className="text-xs text-gray-400" id="modpack-modal-desc">
                {selectedProject.description}
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

        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.9fr] gap-6 p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-4">
            <div className="text-xs text-gray-400">
              Tipo: {projectTypeLabel} - Versiones compatibles: {versionLabel}
            </div>

            {activeImage && (
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-widest mb-2">Galería</div>
                <div className="relative rounded-2xl overflow-hidden border border-gray-800 bg-gray-950">
                  <img
                    src={activeImage.url}
                    alt={activeImage.title || selectedProject.title}
                    className="w-full h-56 object-cover"
                  />
                  {galleryCount > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={onPrevImage}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-gray-950/70 text-white flex items-center justify-center hover:bg-gray-950/90"
                        aria-label="Anterior"
                      >
                        <span className="text-lg">&lt;</span>
                      </button>
                      <button
                        type="button"
                        onClick={onNextImage}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-gray-950/70 text-white flex items-center justify-center hover:bg-gray-950/90"
                        aria-label="Siguiente"
                      >
                        <span className="text-lg">&gt;</span>
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                        {gallery.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => onSelectImage(idx)}
                            className={`w-2.5 h-2.5 rounded-full ${
                              idx === galleryIndex % galleryCount ? "bg-white" : "bg-white/40"
                            }`}
                            aria-label={`Ir a imagen ${idx + 1}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {(activeImage.title || activeImage.description) && (
                  <div className="text-xs text-gray-400 mt-2">
                    {activeImage.title || activeImage.description}
                  </div>
                )}
              </div>
            )}

            {modpackDetails?.body && (
              <div className={cn(panelCompact(), "p-4")}>
                {!showFullDescription ? (
                  <>
                    <div className="text-sm text-gray-200 leading-relaxed">{modpackPreview}</div>
                    {showDescriptionToggle && (
                      <button
                        type="button"
                        onClick={onShowFullDescription}
                        className="mt-3 text-xs font-bold text-brand-info hover:text-brand-accent"
                      >
                        Ver descripción completa
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <ModrinthMarkdown content={modpackDetails.body} />
                    <button
                      type="button"
                      onClick={onHideFullDescription}
                      className={cn(textButton(), "mt-2 text-xs font-bold")}
                    >
                      Ver menos
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {versions.length === 0 && (
              <div className="text-gray-500 text-sm">Sin versiones encontradas.</div>
            )}
            {versions.length > 0 && (
              <div className={cn(panelCompact(), "p-4 space-y-3")}>
                <label className="block text-[11px] uppercase tracking-widest text-gray-400">
                  Versión disponible
                </label>
                <div className="relative">
                  <select
                    className={selectInput({ size: "sm" })}
                    value={selectedVersionId}
                    onChange={(e) => onSelectVersionId(e.target.value)}
                  >
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} - {v.version_number}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                    <IconChevronDown />
                  </div>
                </div>

                {selectedVersion && (
                  <div className="text-xs text-brand-accent">Loader requerido: {loaderLabel}</div>
                )}

                <button
                  onClick={() => selectedVersionId && onInstall(selectedVersionId)}
                  type="button"
                  className={cn(primaryButton(), "w-full px-4 py-2.5 text-sm")}
                  disabled={!selectedVersionId || loading}
                >
                  {modpackButtonContent}
                </button>
                {(!selectedVersionId || loading) && modpackInstallDisabledReason && (
                  <div className="text-[11px] text-amber-300">{modpackInstallDisabledReason}</div>
                )}
                {loading && (
                  <div className="text-xs text-gray-400">
                    {progressText || "Instalando modpack..."}
                  </div>
                )}
              </div>
            )}

            <div className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
              Backup recomendado: se crea una copia automática del modpack instalado (se guardan
              hasta 5).
            </div>

            <div className="text-xs text-gray-400">
              Al instalar se creará una instancia nueva automáticamente.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
