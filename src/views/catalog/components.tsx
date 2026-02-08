import type { ReactNode } from "react";
import type {
  CurseForgeMod,
  InstanceSummary,
  ModrinthProjectHit,
  ModrinthVersion,
} from "../../types";
import { IconChevronDown } from "../../icons";
import {
  CATEGORY_OPTIONS,
  MODPACK_LOADERS,
  PROJECT_TYPES,
  type ModpackLoaderFilter,
  type ProjectType,
  type SourceType,
} from "./constants";
import { CatalogEmptyState } from "./components/shared/EmptyState";

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
          <CatalogEmptyState
            title={emptyTitle}
            message={emptyMessage}
            onClearFilters={onClearFilters}
            onShowPopular={onShowPopular}
            showPopularAction={source === "modrinth"}
          />
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
  installButtonContent: ReactNode;
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

export {
  CatalogHeader,
  CatalogProjectTabs,
  CatalogToolbar,
  CatalogResultsGrid,
  CatalogDetailPanel,
};

