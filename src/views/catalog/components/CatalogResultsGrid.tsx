import type { CurseForgeMod, ModrinthProjectHit } from "../../../types";
import type { ProjectType, SourceType } from "../constants";
import { CATEGORY_OPTIONS } from "../constants";
import { CatalogEmptyState } from "./shared/EmptyState";
import { cn } from "../../../utils/cn";
import {
  chipButton,
  installedBadge,
  paginationButton,
  panel,
  resultsCard,
  skeletonCard,
  tagPill,
} from "../styles";

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

export function CatalogResultsGrid({
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
        <div className={cn(panel(), "mb-4")}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-white">Categorías</div>
            {categories.length > 0 && (
              <button
                type="button"
                onClick={onClearCategories}
                className="text-xs text-gray-400 hover:text-white"
              >
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
                  className={cn(
                    chipButton({ active }),
                    "text-left font-semibold",
                    active ? "border-brand-accent" : "border-gray-800 hover:border-gray-600"
                  )}
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
            <div key={`catalog-skeleton-${idx}`} className={skeletonCard()}>
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
                className={resultsCard({ active: selectedProjectId === hit.project_id })}
              >
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-lg bg-gray-800 overflow-hidden">
                    {hit.icon_url ? (
                      <img
                        src={hit.icon_url}
                        alt={hit.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
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
                          className={installedBadge({ tone: isDisabled ? "disabled" : "active" })}
                        >
                          {isDisabled ? "Desactivado" : "Instalado"}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 line-clamp-2">{hit.description}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-gray-300">
                      {projectType === "mod" && (
                        <span className={tagPill()}>Loader: {loaderChip}</span>
                      )}
                      {projectType !== "modpack" && <span className={tagPill()}>{versionChip}</span>}
                      {projectType === "modpack" && (
                        <>
                          <span className={tagPill()}>Loader: {loaderChip}</span>
                          <span className={tagPill()}>{versionChip}</span>
                        </>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-2">
                      {hit.downloads.toLocaleString()} descargas
                    </div>
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
              className={resultsCard({ active: selectedCurseId === hit.id })}
            >
              <div className="flex gap-3">
                <div className="w-12 h-12 rounded-lg bg-gray-800 overflow-hidden">
                  {hit.logo?.thumbnail_url ? (
                    <img
                      src={hit.logo.thumbnail_url}
                      alt={hit.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
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
                      <span className={tagPill()}>Loader: {loaderChip}</span>
                    )}
                    {projectType !== "modpack" && <span className={tagPill()}>{versionChip}</span>}
                    {projectType === "modpack" && (
                      <>
                        <span className={tagPill()}>Loader: {loaderChip}</span>
                        <span className={tagPill()}>{versionChip}</span>
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
              className={paginationButton()}
              disabled={page === 0 || loading}
            >
              Anterior
            </button>
            <button
              onClick={onNextPage}
              type="button"
              className={paginationButton()}
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
