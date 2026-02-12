import type { ReactNode, RefObject } from "react";
import type { ModrinthProjectHit, ModrinthVersion } from "../../../../types";
import { IconChevronDown } from "../../../../icons";
import type { ProjectType } from "../../constants";

type CatalogModrinthModalProps = {
  open: boolean;
  selectedProject: ModrinthProjectHit | null;
  projectType: ProjectType;
  projectTypeLabel: string;
  versionLabel: string;
  loader: string | undefined;
  loaderLabel: string;
  selectedVersion: ModrinthVersion | null;
  availableLoaders: string[];
  versions: ModrinthVersion[];
  selectedVersionId: string;
  onSelectVersionId: (value: string) => void;
  worlds: string[];
  worldsLoading: boolean;
  worldsError: string;
  selectedWorldId: string;
  onSelectWorldId: (value: string) => void;
  importingDatapack: boolean;
  datapackImportDisabled: boolean;
  datapackImportDisabledReason: string;
  onImportDatapack: (file: File) => void | Promise<void>;
  onInstall: (versionId: string) => void | Promise<void>;
  installDisabled: boolean;
  installButtonContent: ReactNode;
  isProjectInstalled: boolean;
  isProjectDisabled: boolean;
  isVersionInstalled: boolean;
  onClose: () => void;
  modalRef: RefObject<HTMLDivElement | null>;
  closeRef: RefObject<HTMLButtonElement | null>;
};

export function CatalogModrinthModal({
  open,
  selectedProject,
  projectType,
  projectTypeLabel,
  versionLabel,
  loader,
  loaderLabel,
  selectedVersion,
  availableLoaders,
  versions,
  selectedVersionId,
  onSelectVersionId,
  worlds,
  worldsLoading,
  worldsError,
  selectedWorldId,
  onSelectWorldId,
  importingDatapack,
  datapackImportDisabled,
  datapackImportDisabledReason,
  onImportDatapack,
  onInstall,
  installDisabled,
  installButtonContent,
  isProjectInstalled,
  isProjectDisabled,
  isVersionInstalled,
  onClose,
  modalRef,
  closeRef,
}: CatalogModrinthModalProps) {
  if (!open || !selectedProject) return null;

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
        className="w-full max-w-3xl bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modrinth-modal-title"
        aria-describedby="modrinth-modal-desc"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gray-800 overflow-hidden">
              {selectedProject.icon_url ? (
                <img src={selectedProject.icon_url} alt={selectedProject.title} className="w-full h-full object-cover" />
              ) : null}
            </div>
            <div>
              <div className="text-lg font-bold text-white" id="modrinth-modal-title">
                {selectedProject.title}
              </div>
              <div className="text-xs text-gray-400" id="modrinth-modal-desc">
                {selectedProject.description}
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

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6 p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-3">
            <div className="text-xs text-gray-400">
              Tipo: {projectTypeLabel} · Versiones compatibles: {versionLabel}
              {projectType === "mod" ? ` · Loader: ${loader || "cualquiera"}` : ""}
            </div>
            {projectType === "mod" && selectedVersion && availableLoaders.length > 0 && loaderLabel !== "Cualquiera" && (
              <div className="text-xs text-brand-accent">Loader requerido: {loaderLabel}</div>
            )}
            <div className="text-sm text-gray-300">{selectedProject.description}</div>
          </div>

          <div className="space-y-3">
            {versions.length === 0 && <div className="text-gray-500 text-sm">Sin versiones encontradas.</div>}
            {versions.length > 0 && (
              <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-4 space-y-3">
                {projectType === "datapack" && (
                  <div className="space-y-2">
                    <label className="block text-[11px] uppercase tracking-widest text-gray-400">
                      Mundo
                    </label>
                    {worldsLoading ? (
                      <div className="text-xs text-gray-400">Cargando mundos...</div>
                    ) : worlds.length === 0 ? (
                      <div className="text-xs text-amber-300">
                        No hay mundos disponibles. Inicia el juego y crea un mundo primero.
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          className="w-full appearance-none bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-brand-accent"
                          value={selectedWorldId}
                          onChange={(e) => onSelectWorldId(e.target.value)}
                        >
                          {worlds.map((world) => (
                            <option key={world} value={world}>
                              {world}
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                          <IconChevronDown />
                        </div>
                      </div>
                    )}
                    {worldsError && (
                      <div className="text-xs text-red-300">Error cargando mundos: {worldsError}</div>
                    )}
                  </div>
                )}
                {projectType === "datapack" && (
                  <div className="space-y-2">
                    <label className="block text-[11px] uppercase tracking-widest text-gray-400">
                      Importar ZIP
                    </label>
                    <input
                      type="file"
                      accept=".zip,application/zip"
                      disabled={datapackImportDisabled || importingDatapack}
                      aria-disabled={datapackImportDisabled || importingDatapack}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          void onImportDatapack(file);
                        }
                        e.currentTarget.value = "";
                      }}
                      className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-info file:text-white hover:file:bg-brand-info/90 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    {datapackImportDisabledReason && (
                      <div className="text-[11px] text-amber-300">{datapackImportDisabledReason}</div>
                    )}
                    {!datapackImportDisabledReason && (
                      <div className="text-[11px] text-gray-500">
                        Solo archivos .zip. Se copiaran a la carpeta del mundo seleccionado.
                      </div>
                    )}
                  </div>
                )}
                <label className="block text-[11px] uppercase tracking-widest text-gray-400">
                  Versión disponible
                </label>
                <div className="relative">
                  <select
                    className="w-full appearance-none bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-brand-accent"
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

                <button
                  onClick={() => selectedVersionId && onInstall(selectedVersionId)}
                  type="button"
                  className="w-full px-4 py-2.5 rounded-xl bg-brand-accent hover:bg-brand-accent-deep text-white text-sm font-bold disabled:opacity-60"
                  disabled={installDisabled}
                >
                  {installButtonContent}
                </button>
                {projectType !== "datapack" && isProjectInstalled && (
                  <div className={`text-[11px] ${isProjectDisabled ? "text-amber-300" : "text-emerald-300"}`}>
                    {isVersionInstalled
                      ? "Ya instalado en esta instancia."
                      : isProjectDisabled
                        ? "Instalado pero desactivado."
                        : "Instalado con otra versión."}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
