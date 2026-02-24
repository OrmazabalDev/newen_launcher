import type { ReactNode } from "react";
import type { CurseForgeMod, ModrinthProjectHit, ModrinthVersion } from "../../../types";
import { IconChevronDown } from "../../../icons";
import type { ProjectType, SourceType } from "../constants";
import { cn } from "../../../utils/cn";
import { panel, panelCompact, primaryButton, selectInput } from "../styles";

type CatalogDetailPanelProps = {
  show: boolean;
  source: SourceType;
  projectType: ProjectType;
  projectTypeLabel: string;
  versionLabel: string;
  loader: string | undefined;
  loaderLabel: string;
  selectedProject: ModrinthProjectHit | null;
  selectedCurse: CurseForgeMod | null;
  versions: ModrinthVersion[];
  selectedVersion: ModrinthVersion | null;
  selectedVersionId: string;
  onSelectVersionId: (value: string) => void;
  onInstall: (versionId: string) => void | Promise<void>;
  installDisabled: boolean;
  installButtonContent: ReactNode;
  installDisabledReason: string;
  isProjectInstalled: boolean;
  isProjectDisabled: boolean;
  isVersionInstalled: boolean;
};

export function CatalogDetailPanel({
  show,
  source,
  projectType,
  projectTypeLabel,
  versionLabel,
  loader,
  loaderLabel,
  selectedProject,
  selectedCurse,
  versions,
  selectedVersion,
  selectedVersionId,
  onSelectVersionId,
  onInstall,
  installDisabled,
  installButtonContent,
  installDisabledReason,
  isProjectInstalled,
  isProjectDisabled,
  isVersionInstalled,
}: CatalogDetailPanelProps) {
  if (!show) return null;

  return (
    <div className={cn(panel(), "overflow-y-auto custom-scrollbar")}>
      {source === "modrinth" && selectedProject ? (
        <>
          <div className="flex items-center gap-3 mb-4">
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
              <div className="text-lg font-bold text-white">{selectedProject.title}</div>
              <div className="text-xs text-gray-400">{selectedProject.description}</div>
            </div>
          </div>

          <div className="text-xs text-gray-400 mb-3">
            Tipo: {projectTypeLabel} · Versiones compatibles: {versionLabel}
            {projectType === "mod" ? ` · Loader: ${loader || "cualquiera"}` : ""}
          </div>
          {projectType === "modpack" && selectedVersion && (
            <div className="text-xs mb-3 text-brand-accent">Loader requerido: {loaderLabel}</div>
          )}

          <div className="space-y-3">
            {versions.length === 0 && (
              <div className="text-gray-500 text-sm">Sin versiones encontradas.</div>
            )}
            {versions.length > 0 && (
              <div className={cn(panelCompact(), "space-y-3")}>
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-gray-400 mb-2">
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
                          {v.name} · {v.version_number}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                      <IconChevronDown />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => selectedVersionId && onInstall(selectedVersionId)}
                  type="button"
                  className={cn(primaryButton(), "w-full px-4 py-2.5 text-sm")}
                  disabled={installDisabled}
                >
                  {installButtonContent}
                </button>
                {installDisabled && installDisabledReason && (
                  <div className="text-[11px] text-amber-300">{installDisabledReason}</div>
                )}
                {projectType !== "datapack" && isProjectInstalled && (
                  <div
                    className={`text-[11px] ${isProjectDisabled ? "text-amber-300" : "text-emerald-300"}`}
                  >
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
        </>
      ) : source === "curseforge" && selectedCurse ? (
        <div className="space-y-3">
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
              <div className="text-lg font-bold text-white">{selectedCurse.name}</div>
              <div className="text-xs text-gray-400">{selectedCurse.summary}</div>
            </div>
          </div>
          <div className={panelCompact()}>
            Integración de CurseForge: búsqueda disponible. Instalación y dependencias se
            implementarán con API key.
          </div>
        </div>
      ) : (
        <div className="text-gray-500 text-sm">
          {projectType === "modpack"
            ? "Selecciona un modpack para ver detalles."
            : "Selecciona un mod para ver detalles."}
        </div>
      )}
    </div>
  );
}
