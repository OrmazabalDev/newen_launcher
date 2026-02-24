import type { ManageTab } from "./types";

type ManageInstanceSidebarProps = {
  tab: ManageTab;
  counts: {
    mods: number;
    resourcepacks: number;
    shaderpacks: number;
    logs: number;
  };
  onTabChange: (tab: ManageTab) => void;
  onRepair: () => void;
  onOpenFolder: () => void;
  onExportModpack: () => void;
  onDeleteInstance: () => void;
  repairing: boolean;
  exportingPack: boolean;
  showContentActions: boolean;
};

export function ManageInstanceSidebar({
  tab,
  counts,
  onTabChange,
  onRepair,
  onOpenFolder,
  onExportModpack,
  onDeleteInstance,
  repairing,
  exportingPack,
  showContentActions,
}: ManageInstanceSidebarProps) {
  return (
    <div className="w-64 bg-[#18181d] border-r border-white/5 p-4 space-y-2">
      <button
        type="button"
        onClick={() => onTabChange("mods")}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
          tab === "mods"
            ? "bg-white/10 text-white font-medium"
            : "text-gray-400 hover:text-white hover:bg-white/5"
        }`}
      >
        <span>Mods</span>
        <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded text-gray-300">
          {counts.mods}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onTabChange("resourcepacks")}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
          tab === "resourcepacks"
            ? "bg-white/10 text-white font-medium"
            : "text-gray-400 hover:text-white hover:bg-white/5"
        }`}
      >
        <span>Resourcepacks</span>
        <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded text-gray-300">
          {counts.resourcepacks}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onTabChange("shaderpacks")}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
          tab === "shaderpacks"
            ? "bg-white/10 text-white font-medium"
            : "text-gray-400 hover:text-white hover:bg-white/5"
        }`}
      >
        <span>Shaders</span>
        <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded text-gray-300">
          {counts.shaderpacks}
        </span>
      </button>
      <div className="h-px bg-white/5 my-2" />
      <button
        type="button"
        onClick={() => onTabChange("logs")}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
          tab === "logs"
            ? "bg-white/10 text-white font-medium"
            : "text-gray-400 hover:text-white hover:bg-white/5"
        }`}
      >
        <span>Logs / Crash</span>
        <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded text-gray-300">
          {counts.logs}
        </span>
      </button>
      <div className="h-px bg-white/5 my-2" />
      <button
        type="button"
        onClick={onRepair}
        disabled={repairing}
        aria-disabled={repairing}
        title={repairing ? "Reparando..." : "Reparar instancia"}
        className="w-full px-3 py-2 rounded-lg bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 disabled:opacity-60"
      >
        Reparar
      </button>
      {showContentActions && (
        <>
          <button
            type="button"
            onClick={onOpenFolder}
            className="w-full px-3 py-2 rounded-lg bg-white/5 text-gray-300 hover:text-white hover:bg-white/10"
          >
            Abrir carpeta
          </button>
          <button
            type="button"
            onClick={onExportModpack}
            disabled={exportingPack}
            aria-disabled={exportingPack}
            className="w-full px-3 py-2 rounded-lg bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 disabled:opacity-60"
          >
            {exportingPack ? "Exportando..." : "Exportar modpack"}
          </button>
          <button
            type="button"
            onClick={onDeleteInstance}
            className="w-full px-3 py-2 rounded-lg bg-red-600/20 text-red-200 hover:bg-red-600/30"
          >
            Eliminar instancia
          </button>
        </>
      )}
    </div>
  );
}
