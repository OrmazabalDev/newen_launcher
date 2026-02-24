import type { InstanceContentItem } from "../../types";
import type { ManageTab } from "./types";
import { formatDate, formatSize } from "./utils";

type ManageInstanceContentPanelProps = {
  tab: ManageTab;
  contentQuery: string;
  onContentQueryChange: (value: string) => void;
  sortMode: "recent" | "name" | "size";
  onSortModeChange: (value: "recent" | "name" | "size") => void;
  filterSource: "all" | "modrinth" | "local";
  onFilterSourceChange: (value: "all" | "modrinth" | "local") => void;
  bulkBusy: boolean;
  filteredItems: InstanceContentItem[];
  isModpack: boolean;
  isModded: boolean;
  loader: string;
  optimizing: boolean;
  onBulkToggle: (enabled: boolean) => void;
  onApplyOptimization: (preset: string) => void;
  onRollbackOptimization: () => void;
  onToggleItem: (item: InstanceContentItem) => void;
  onDeleteItem: (item: InstanceContentItem) => void;
};

export function ManageInstanceContentPanel({
  tab,
  contentQuery,
  onContentQueryChange,
  sortMode,
  onSortModeChange,
  filterSource,
  onFilterSourceChange,
  bulkBusy,
  filteredItems,
  isModpack,
  isModded,
  loader,
  optimizing,
  onBulkToggle,
  onApplyOptimization,
  onRollbackOptimization,
  onToggleItem,
  onDeleteItem,
}: ManageInstanceContentPanelProps) {
  return (
    <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <input
          value={contentQuery}
          onChange={(e) => onContentQueryChange(e.target.value)}
          placeholder={`Buscar ${tab}...`}
          className="flex-1 min-w-[180px] bg-[#1a1a1f] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-accent/60"
        />
        <select
          value={sortMode}
          onChange={(e) => onSortModeChange(e.target.value as "recent" | "name" | "size")}
          className="bg-[#1a1a1f] border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-200"
        >
          <option value="recent">Recientes</option>
          <option value="name">Nombre</option>
          <option value="size">Peso</option>
        </select>
        <select
          value={filterSource}
          onChange={(e) => onFilterSourceChange(e.target.value as "all" | "modrinth" | "local")}
          className="bg-[#1a1a1f] border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-200"
        >
          <option value="all">Todos</option>
          <option value="modrinth">Modrinth</option>
          <option value="local">Local</option>
        </select>
        <button
          type="button"
          onClick={() => onBulkToggle(true)}
          disabled={bulkBusy || filteredItems.length === 0}
          className="px-3 py-2 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700 text-xs disabled:opacity-60"
        >
          Activar todo
        </button>
        <button
          type="button"
          onClick={() => onBulkToggle(false)}
          disabled={bulkBusy || filteredItems.length === 0}
          className="px-3 py-2 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700 text-xs disabled:opacity-60"
        >
          Desactivar todo
        </button>
      </div>
      {tab === "mods" && !isModpack && (
        <div className="mb-4 bg-gradient-to-br from-brand-accent/10 via-gray-950/40 to-gray-950/40 border border-brand-accent/30 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-2xl">⚡</div>
            <div className="text-sm font-bold text-white">Optimización en 1 clic</div>
          </div>
          <div className="text-xs text-gray-300 mb-2">
            Instala mods de rendimiento y ajusta options.txt en esta instancia.
          </div>
          <div className="text-[11px] text-gray-400 mb-3">
            No toca tus mods existentes y se puede revertir.
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onApplyOptimization("competitive")}
              disabled={optimizing || !isModded || isModpack}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-gray-800 text-gray-200 hover:bg-gray-700 disabled:opacity-60"
            >
              Competitivo
            </button>
            <button
              type="button"
              onClick={() => onApplyOptimization("balanced")}
              disabled={optimizing || !isModded || isModpack}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-gray-800 text-gray-200 hover:bg-gray-700 disabled:opacity-60"
            >
              Balanceado
            </button>
            <button
              type="button"
              onClick={() => onApplyOptimization("quality")}
              disabled={optimizing || !isModded || isModpack}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-gray-800 text-gray-200 hover:bg-gray-700 disabled:opacity-60"
            >
              Calidad
            </button>
            <button
              type="button"
              onClick={onRollbackOptimization}
              disabled={optimizing || !isModded || isModpack}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-red-700/80 text-white hover:bg-red-700 disabled:opacity-60"
            >
              Revertir
            </button>
          </div>
          <div className="mt-3 text-[11px] text-gray-500">
            Mods incluidos:{" "}
            {loader === "fabric"
              ? "Sodium, Lithium, Starlight, FerriteCore, EntityCulling"
              : "ModernFix, FerriteCore, EntityCulling, Render mod (Rubidium/Embeddium)"}
            .
          </div>
          <div className="mt-3 text-[11px] text-gray-500">
            Nota: el rollback solo elimina mods instalados por el launcher.
          </div>
          {isModpack && (
            <div className="mt-3 text-xs text-amber-300">
              Los modpacks ya traen optimizaciones propias; no se puede aplicar este perfil.
            </div>
          )}
          {!isModded && !isModpack && (
            <div className="mt-3 text-xs text-amber-300">
              Necesitas una instancia Forge, NeoForge o Fabric para instalar mods de rendimiento.
            </div>
          )}
        </div>
      )}
      {filteredItems.length === 0 && (
        <div className="text-gray-500 text-center py-10">No hay archivos en esta sección.</div>
      )}
      <div className="space-y-3">
        {filteredItems.map((item) => (
          <div
            key={item.file_name}
            className="border border-gray-800 rounded-xl p-4 bg-gray-950/40 flex items-start gap-4"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-semibold text-white truncate">{item.name}</div>
                {!item.enabled && (
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-red-600/20 text-red-300 border border-red-600/40">
                    Desactivado
                  </span>
                )}
                {item.source && (
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 border border-gray-700">
                    {item.source}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {formatSize(item.size)} - {formatDate(item.modified)}
              </div>
              {item.required_by.length > 0 && (
                <div className="mt-2 text-xs text-amber-300">
                  Requerido por: {item.required_by.join(", ")}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onToggleItem(item)}
                type="button"
                className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700 text-xs"
              >
                {item.enabled ? "Desactivar" : "Activar"}
              </button>
              <button
                onClick={() => onDeleteItem(item)}
                type="button"
                className="px-3 py-1.5 rounded-lg bg-red-600/80 text-white hover:bg-red-600 text-xs"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
