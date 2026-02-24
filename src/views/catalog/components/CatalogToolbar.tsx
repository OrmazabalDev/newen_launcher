import type { ModpackLoaderFilter, ProjectType, SourceType } from "../constants";
import { MODPACK_LOADERS } from "../constants";
import { cn } from "../../../utils/cn";
import {
  chipButton,
  primaryButton,
  selectCompact,
  sourceButton,
  textInput,
} from "../styles";

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

export function CatalogToolbar({
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
            className={sourceButton({ active: source === "modrinth" })}
          >
            Modrinth
          </button>
          <button
            onClick={() => onSelectSource("curseforge")}
            type="button"
            className={sourceButton({ active: source === "curseforge" })}
          >
            CurseForge
          </button>
        </div>
      )}
      {source === "modrinth" && projectType === "mod" && (
        <button
          type="button"
          onClick={onToggleCategories}
          className={chipButton({ active: showCategories })}
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
              className={chipButton({ active: modpackLoader === opt.id })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400">Orden</label>
        <select
          className={selectCompact()}
          value={index}
          onChange={(e) =>
            onChangeIndex(e.target.value as "relevance" | "downloads" | "newest" | "updated")
          }
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
          className={selectCompact()}
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
        className={textInput()}
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
        className={cn(primaryButton({ tone: "info" }), "px-6 py-3")}
        disabled={loading}
      >
        Buscar
      </button>
    </div>
  );
}
