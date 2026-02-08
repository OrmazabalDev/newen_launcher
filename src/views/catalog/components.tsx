import type { ReactNode, RefObject } from "react";
import type {
  CurseForgeMod,
  InstanceSummary,
  ModrinthProject,
  ModrinthProjectHit,
  ModrinthVersion,
} from "../../types";
import { IconChevronDown } from "../../icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import {
  CATEGORY_OPTIONS,
  MODPACK_LOADERS,
  MODRINTH_SANITIZE_SCHEMA,
  PROJECT_TYPES,
  type ModpackLoaderFilter,
  type ProjectType,
  type SourceType,
} from "./constants";

type CatalogHeaderProps = {
  headerTitle: string;
  headerSubtitle: string;
  requiresInstance: boolean;
  eligibleInstances: InstanceSummary[];
  selectedInstance: InstanceSummary | null;
  onSelectInstance: (id: string) => void;
};

function CatalogHeader({
  headerTitle,
  headerSubtitle,
  requiresInstance,
  eligibleInstances,
  selectedInstance,
  onSelectInstance,
}: CatalogHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-3xl font-bold text-white">{headerTitle}</h2>
        <p className="text-gray-300 text-sm">{headerSubtitle}</p>
      </div>
      {requiresInstance ? (
        <div className="min-w-[260px]">
          <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">Instancia</label>
          <div className="relative">
            <select
              className="w-full appearance-none bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-brand-accent"
              value={selectedInstance?.id || ""}
              onChange={(e) => onSelectInstance(e.target.value)}
            >
              {eligibleInstances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
              <IconChevronDown />
            </div>
          </div>
        </div>
      ) : (
        <div className="text-xs text-gray-400 bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-2">
          Al instalar un modpack se creará una instancia nueva automáticamente.
        </div>
      )}
    </div>
  );
}

type CatalogProjectTabsProps = {
  showProjectTabs: boolean;
  projectType: ProjectType;
  hiddenProjectTypes: ProjectType[];
  onSelectProjectType: (value: ProjectType) => void;
};

function CatalogProjectTabs({
  showProjectTabs,
  projectType,
  hiddenProjectTypes,
  onSelectProjectType,
}: CatalogProjectTabsProps) {
  if (!showProjectTabs) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {PROJECT_TYPES.filter((type) => !hiddenProjectTypes.includes(type.id)).map((type) => (
        <button
          key={type.id}
          type="button"
          onClick={() => onSelectProjectType(type.id)}
          className={`px-4 py-2 rounded-full text-xs font-bold border ${
            projectType === type.id
              ? "bg-brand-accent text-white border-brand-accent/70"
              : "bg-gray-900 text-gray-300 border-gray-700"
          }`}
        >
          {type.label}
        </button>
      ))}
    </div>
  );
}

type CatalogToolbarProps = {
  showSourceToggle: boolean;
  source: SourceType;
  onSelectSource: (value: SourceType) => void;
  projectType: ProjectType;
  showCategories: boolean;
  categoriesCount: number;
  onToggleCategories: () => void;
  modpackLoader: ModpackLoaderFilter;
  onSelectModpackLoader: (value: ModpackLoaderFilter) => void;
  index: "relevance" | "downloads" | "newest" | "updated";
  onChangeIndex: (value: "relevance" | "downloads" | "newest" | "updated") => void;
  pageSize: number;
  onChangePageSize: (value: number) => void;
  instanceInfo: string;
  searchPlaceholder: string;
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  loading: boolean;
  isSourceLocked: boolean;
};

function CatalogToolbar({
  showSourceToggle,
  source,
  onSelectSource,
  projectType,
  showCategories,
  categoriesCount,
  onToggleCategories,
  modpackLoader,
  onSelectModpackLoader,
  index,
  onChangeIndex,
  pageSize,
  onChangePageSize,
  instanceInfo,
  searchPlaceholder,
  query,
  onQueryChange,
  onSearch,
  loading,
  isSourceLocked,
}: CatalogToolbarProps) {
  return (
    <div className="flex flex-wrap gap-4 mb-5 items-center">
      {showSourceToggle && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSelectSource("modrinth")}
            type="button"
            className={`px-3 py-2 rounded-xl text-xs font-bold ${
              source === "modrinth" ? "bg-brand-accent text-white" : "bg-gray-900 text-gray-300 border border-gray-700"
            }`}
          >
            Modrinth
          </button>
          <button
            onClick={() => onSelectSource("curseforge")}
            type="button"
            className={`px-3 py-2 rounded-xl text-xs font-bold ${
              source === "curseforge" ? "bg-brand-accent text-white" : "bg-gray-900 text-gray-300 border border-gray-700"
            }`}
          >
            CurseForge
          </button>
        </div>
      )}
      {source === "modrinth" && projectType === "mod" && (
        <button
          type="button"
          onClick={onToggleCategories}
          className={`px-3 py-2 rounded-xl text-xs font-bold border ${
            showCategories
              ? "bg-brand-accent text-white border-brand-accent/70"
              : "bg-gray-900 text-gray-300 border-gray-700"
          }`}
        >
          Categorías {categoriesCount > 0 ? `(${categoriesCount})` : ""}
        </button>
      )}
      {source === "modrinth" && projectType === "modpack" && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Loader</span>
          {MODPACK_LOADERS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelectModpackLoader(opt.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border ${
                modpackLoader === opt.id
                  ? "bg-brand-accent text-white border-brand-accent/70"
                  : "bg-gray-900 text-gray-300 border-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400">Orden</label>
        <select
          className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white"
          value={index}
          onChange={(e) => onChangeIndex(e.target.value as "relevance" | "downloads" | "newest" | "updated")}
          disabled={isSourceLocked}
        >
          <option value="downloads">Más descargados</option>
          <option value="relevance">Relevancia</option>
          <option value="newest">Más nuevos</option>
          <option value="updated">Actualizados</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400">Resultados</label>
        <select
          className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white"
          value={pageSize}
          onChange={(e) => onChangePageSize(Number(e.target.value))}
        >
          <option value={12}>12</option>
          <option value={24}>24</option>
          <option value={48}>48</option>
        </select>
      </div>
      {instanceInfo && <div className="text-xs text-gray-400">{instanceInfo}</div>}
      <input
        className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white outline-none focus:border-brand-accent"
        placeholder={searchPlaceholder}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSearch();
        }}
      />
      <button
        onClick={onSearch}
        type="button"
        className="px-6 py-3 rounded-xl bg-brand-info hover:bg-brand-info/90 text-white font-bold"
        disabled={loading}
      >
        Buscar
      </button>
    </div>
  );
}

type CatalogResultsGridProps = {
  source: SourceType;
  projectType: ProjectType;
  showCategories: boolean;
  categories: string[];
  onToggleCategory: (id: string) => void;
  onClearCategories: () => void;
  showCatalogSkeleton: boolean;
  showEmptyState: boolean;
  emptyTitle: string;
  emptyMessage: string;
  onClearFilters: () => void;
  onShowPopular: () => void;
  results: ModrinthProjectHit[];
  curseResults: CurseForgeMod[];
  selectedProjectId: string | null;
  selectedCurseId: number | null;
  onSelectProject: (hit: ModrinthProjectHit) => void | Promise<void>;
  onSelectCurse: (hit: CurseForgeMod) => void;
  installedProjectIds: Set<string>;
  disabledProjectIds: Set<string>;
  loaderChip: string;
  versionChip: string;
  totalHits: number;
  page: number;
  pageSize: number;
  loading: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
};

function CatalogResultsGrid({
  source,
  projectType,
  showCategories,
  categories,
  onToggleCategory,
  onClearCategories,
  showCatalogSkeleton,
  showEmptyState,
  emptyTitle,
  emptyMessage,
  onClearFilters,
  onShowPopular,
  results,
  curseResults,
  selectedProjectId,
  selectedCurseId,
  onSelectProject,
  onSelectCurse,
  installedProjectIds,
  disabledProjectIds,
  loaderChip,
  versionChip,
  totalHits,
  page,
  pageSize,
  loading,
  onPrevPage,
  onNextPage,
}: CatalogResultsGridProps) {
  return (
    <div className="overflow-y-auto pr-2 custom-scrollbar">
      {showCategories && (
        <div className="mb-4 bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-white">Categorías</div>
            {categories.length > 0 && (
              <button type="button" onClick={onClearCategories} className="text-xs text-gray-400 hover:text-white">
                Limpiar
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {CATEGORY_OPTIONS.map((cat) => {
              const active = categories.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onToggleCategory(cat.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border text-left ${
                    active
                      ? "bg-brand-accent text-white border-brand-accent"
                      : "bg-gray-900 text-gray-300 border-gray-800 hover:border-gray-600"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {showCatalogSkeleton &&
          Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={`catalog-skeleton-${idx}`}
              className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 animate-pulse"
            >
              <div className="flex gap-3">
                <div className="w-12 h-12 rounded-lg bg-gray-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-800 rounded w-3/4" />
                  <div className="h-3 bg-gray-800 rounded w-full" />
                  <div className="h-3 bg-gray-800 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        {showEmptyState && (
          <div className="col-span-full rounded-2xl border border-gray-800 bg-gray-900/60 p-6 text-center">
            <div className="text-lg font-bold text-white">{emptyTitle}</div>
            <div className="text-sm text-gray-400 mt-2">{emptyMessage}</div>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onClearFilters}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold"
              >
                Limpiar filtros
              </button>
              {source === "modrinth" && (
                <button
                  type="button"
                  onClick={onShowPopular}
                  className="px-4 py-2 rounded-xl bg-brand-accent hover:bg-brand-accent-deep text-white font-bold"
                >
                  Ver populares
                </button>
              )}
            </div>
          </div>
        )}
        {source === "modrinth" &&
          results.map((hit) => {
            const isInstalled = installedProjectIds.has(hit.project_id);
            const isDisabled = disabledProjectIds.has(hit.project_id);
            return (
              <button
                key={hit.project_id}
                onClick={() => onSelectProject(hit)}
                type="button"
                className={`text-left rounded-2xl border p-4 bg-gray-900/70 hover:bg-gray-900 transition ${
                  selectedProjectId === hit.project_id ? "border-brand-accent/70" : "border-gray-800"
                }`}
              >
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-lg bg-gray-800 overflow-hidden">
                    {hit.icon_url ? (
                      <img src={hit.icon_url} alt={hit.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold">
                        {hit.title.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-white">{hit.title}</div>
                      {isInstalled && (
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                            isDisabled
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          }`}
                        >
                          {isDisabled ? "Desactivado" : "Instalado"}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 line-clamp-2">{hit.description}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-gray-300">
                      {projectType === "mod" && (
                        <span className="px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700">
                          Loader: {loaderChip}
                        </span>
                      )}
                      {projectType !== "modpack" && (
                        <span className="px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700">
                          {versionChip}
                        </span>
                      )}
                      {projectType === "modpack" && (
                        <>
                          <span className="px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700">
                            Loader: {loaderChip}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700">
                            {versionChip}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-2">{hit.downloads.toLocaleString()} descargas</div>
                  </div>
                </div>
              </button>
            );
          })}

        {source === "curseforge" &&
          curseResults.map((hit) => (
            <button
              key={hit.id}
              onClick={() => onSelectCurse(hit)}
              type="button"
              className={`text-left rounded-2xl border p-4 bg-gray-900/70 hover:bg-gray-900 transition ${
                selectedCurseId === hit.id ? "border-brand-accent/70" : "border-gray-800"
              }`}
            >
              <div className="flex gap-3">
                <div className="w-12 h-12 rounded-lg bg-gray-800 overflow-hidden">
                  {hit.logo?.thumbnail_url ? (
                    <img src={hit.logo.thumbnail_url} alt={hit.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold">
                      {hit.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-white">{hit.name}</div>
                  <div className="text-xs text-gray-400 line-clamp-2">{hit.summary}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-gray-300">
                    {projectType === "mod" && (
                      <span className="px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700">
                        Loader: {loaderChip}
                      </span>
                    )}
                    {projectType !== "modpack" && (
                      <span className="px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700">
                        {versionChip}
                      </span>
                    )}
                    {projectType === "modpack" && (
                      <>
                        <span className="px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700">
                          Loader: {loaderChip}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700">
                          {versionChip}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-2">
                    {Math.round(hit.download_count).toLocaleString()} descargas
                  </div>
                </div>
              </div>
            </button>
          ))}
      </div>
      {source === "modrinth" && totalHits > 0 && (
        <div className="flex items-center justify-between mt-4 text-xs text-gray-400">
          <span>
            Página {page + 1} de {Math.max(1, Math.ceil(totalHits / pageSize))}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onPrevPage}
              type="button"
              className="px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-gray-300 disabled:opacity-50"
              disabled={page === 0 || loading}
            >
              Anterior
            </button>
            <button
              onClick={onNextPage}
              type="button"
              className="px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-gray-300 disabled:opacity-50"
              disabled={loading || (page + 1) * pageSize >= totalHits}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
  installButtonContent: React.ReactNode;
  installDisabledReason: string;
  isProjectInstalled: boolean;
  isProjectDisabled: boolean;
  isVersionInstalled: boolean;
};

function CatalogDetailPanel({
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
    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 overflow-y-auto custom-scrollbar">
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
            <div className="text-xs mb-3 text-brand-accent">
              Loader requerido: {loaderLabel}
            </div>
          )}

          <div className="space-y-3">
            {versions.length === 0 && <div className="text-gray-500 text-sm">Sin versiones encontradas.</div>}
            {versions.length > 0 && (
              <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-3 space-y-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-gray-400 mb-2">
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
                  className="w-full px-4 py-2.5 rounded-xl bg-brand-accent hover:bg-brand-accent-deep text-white text-sm font-bold disabled:opacity-60"
                  disabled={installDisabled}
                >
                  {installButtonContent}
                </button>
                {installDisabled && installDisabledReason && (
                  <div className="text-[11px] text-amber-300">{installDisabledReason}</div>
                )}
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
          <div className="text-sm text-gray-300 bg-gray-950/60 border border-gray-800 rounded-xl p-3">
            Integración de CurseForge: búsqueda disponible. Instalación y dependencias se implementarán con API key.
          </div>
        </div>
      ) : (
        <div className="text-gray-500 text-sm">
          {projectType === "modpack" ? "Selecciona un modpack para ver detalles." : "Selecciona un mod para ver detalles."}
        </div>
      )}
    </div>
  );
}

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
  onInstall: (versionId: string) => void | Promise<void>;
  installDisabled: boolean;
  installButtonContent: React.ReactNode;
  isProjectInstalled: boolean;
  isProjectDisabled: boolean;
  isVersionInstalled: boolean;
  onClose: () => void;
  modalRef: React.RefObject<HTMLDivElement>;
  closeRef: React.RefObject<HTMLButtonElement>;
};

function CatalogModrinthModal({
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

type CatalogCurseforgeModalProps = {
  open: boolean;
  selectedCurse: CurseForgeMod | null;
  showCurseforgeBanner: boolean;
  onClose: () => void;
  modalRef: React.RefObject<HTMLDivElement>;
  closeRef: React.RefObject<HTMLButtonElement>;
};

function CatalogCurseforgeModal({
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
  modpackButtonContent: React.ReactNode;
  modpackInstallDisabledReason: string;
  loading: boolean;
  progressText: string;
  onClose: () => void;
  modalRef: React.RefObject<HTMLDivElement>;
  closeRef: React.RefObject<HTMLButtonElement>;
};

function CatalogModpackModal({
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/90 backdrop-blur-sm p-6 overscroll-contain"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-4xl bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden"
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
                <img src={selectedProject.icon_url} alt={selectedProject.title} className="w-full h-full object-cover" />
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
            className="text-gray-400 hover:text-white"
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
                <div className="text-xs text-gray-400 uppercase tracking-widest mb-2">Galeria</div>
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
                              idx === (galleryIndex % galleryCount) ? "bg-white" : "bg-white/40"
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
              <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-4">
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
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw, [rehypeSanitize, MODRINTH_SANITIZE_SCHEMA]]}
                      components={{
                        h1: ({node, ...props}) => <h3 className="text-lg font-bold text-white mt-4 mb-2" {...props} />,
                        h2: ({node, ...props}) => <h4 className="text-base font-bold text-white mt-4 mb-2" {...props} />,
                        h3: ({node, ...props}) => <h5 className="text-sm font-bold text-white mt-3 mb-2" {...props} />,
                        p: ({node, ...props}) => <div className="text-sm text-gray-200 leading-relaxed mb-3" {...props} />,
                        li: ({node, ...props}) => <li className="text-sm text-gray-200 list-disc ml-5 mb-1" {...props} />,
                        a: ({node, ...props}) => (
                          <a className="text-brand-info underline" target="_blank" rel="noreferrer" {...props} />
                        ),
                        center: ({node, ...props}) => <div className="text-center" {...props} />,
                        img: ({node, className, style, width, height, ...props}) => (
                          <div className="w-full flex justify-center my-3">
                            <img
                              {...props}
                              className="rounded-lg border border-gray-800 w-full max-w-[560px] max-h-72 object-contain"
                              style={{ maxHeight: 288, height: "auto" }}
                            />
                          </div>
                        ),
                        iframe: ({node, className, style, width, height, ...props}) => (
                          <div className="w-full max-w-[720px] mx-auto aspect-video overflow-hidden rounded-lg border border-gray-800 my-3 bg-gray-950">
                            <iframe {...props} className="w-full h-full" allowFullScreen />
                          </div>
                        ),
                        blockquote: ({node, ...props}) => (
                          <blockquote className="border-l-2 border-gray-700 pl-3 text-gray-300 italic mb-3" {...props} />
                        ),
                        code: ({node, ...props}) => (
                          <code className="text-xs bg-gray-800 px-1 py-0.5 rounded" {...props} />
                        ),
                      }}
                    >
                      {modpackDetails.body}
                    </ReactMarkdown>
                    <button
                      type="button"
                      onClick={onHideFullDescription}
                      className="mt-2 text-xs font-bold text-gray-400 hover:text-white"
                    >
                      Ver menos
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {versions.length === 0 && <div className="text-gray-500 text-sm">Sin versiones encontradas.</div>}
            {versions.length > 0 && (
              <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-4 space-y-3">
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

                {selectedVersion && (
                  <div className="text-xs text-brand-accent">
                    Loader requerido: {loaderLabel}
                  </div>
                )}

                <button
                  onClick={() => selectedVersionId && onInstall(selectedVersionId)}
                  type="button"
                  className="w-full px-4 py-2.5 rounded-xl bg-brand-accent hover:bg-brand-accent-deep text-white text-sm font-bold disabled:opacity-60"
                  disabled={!selectedVersionId || loading}
                >
                  {modpackButtonContent}
                </button>
                {(!selectedVersionId || loading) && modpackInstallDisabledReason && (
                  <div className="text-[11px] text-amber-300">{modpackInstallDisabledReason}</div>
                )}
                {loading && (
                  <div className="text-xs text-gray-400">{progressText || "Instalando modpack..."}</div>
                )}
              </div>
            )}

            <div className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
              Backup recomendado: se crea una copia automática del modpack instalado (se guardan hasta 5).
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

export {
  CatalogHeader,
  CatalogProjectTabs,
  CatalogToolbar,
  CatalogResultsGrid,
  CatalogDetailPanel,
  CatalogModrinthModal,
  CatalogCurseforgeModal,
  CatalogModpackModal,
};
