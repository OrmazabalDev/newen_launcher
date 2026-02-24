import type { InstanceSummary } from "../../types";
import { IconFolder, IconPlay, IconSettings } from "../../icons";
import {
  emptyActionButton,
  instanceCard,
  loaderBadge,
  openButton,
  playButton,
  skeletonCard,
  statusBadge,
} from "./styles";

export function InstanceList({
  filtered,
  showSkeleton,
  selectedInstanceId,
  errorInstanceIds,
  query,
  onSelectInstance,
  onPlayInstance,
  onOpenInstance,
  onManageInstance,
  onCreateClick,
  onClearQuery,
}: {
  filtered: InstanceSummary[];
  showSkeleton: boolean;
  selectedInstanceId: string;
  errorInstanceIds: Set<string>;
  query: string;
  onSelectInstance: (id: string) => void;
  onPlayInstance: (id: string) => void;
  onOpenInstance: (id: string) => void;
  onManageInstance: (instance: InstanceSummary) => void;
  onCreateClick: () => void;
  onClearQuery: () => void;
}) {
  const formatLastPlayed = (ts?: number | null) => {
    if (!ts) return "Nunca";
    const date = new Date(ts);
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (showSkeleton) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={`skeleton-${idx}`} className={skeletonCard()}>
            <div className="flex justify-between items-start mb-4">
              <div className="w-16 h-16 rounded-2xl bg-[#25252b]" />
              <div className="h-5 w-16 bg-[#25252b] rounded" />
            </div>
            <div className="space-y-2 mb-6">
              <div className="h-4 bg-[#25252b] rounded w-3/4" />
              <div className="h-3 bg-[#25252b] rounded w-1/2" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="h-10 col-span-3 bg-[#25252b] rounded-xl" />
              <div className="h-10 col-span-1 bg-[#25252b] rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="text-gray-400 text-center py-12">
        <div className="text-lg font-bold text-white">No hay instancias que coincidan</div>
        <div className="text-sm mt-2">
          Ajusta la búsqueda o crea una nueva instancia para continuar.
        </div>
        <div className="mt-4 flex items-center justify-center gap-3">
          <button type="button" onClick={onCreateClick} className={emptyActionButton({ tone: "primary" })}>
            Crear instancia
          </button>
          {query.trim() && (
            <button type="button" onClick={onClearQuery} className={emptyActionButton({ tone: "secondary" })}>
              Limpiar búsqueda
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {filtered.map((inst) => {
        const loaderLabel =
          inst.loader === "neoforge"
            ? "NEOFORGE"
            : inst.loader === "forge"
              ? "FORGE"
              : inst.loader === "fabric"
                ? "FABRIC"
                : inst.loader === "snapshot"
                  ? "SNAPSHOT"
                  : "VANILLA";
        const loaderKey: "fabric" | "forge" | "neoforge" | "snapshot" | "vanilla" =
          inst.loader === "fabric"
            ? "fabric"
            : inst.loader === "forge"
              ? "forge"
              : inst.loader === "neoforge"
                ? "neoforge"
                : inst.loader === "snapshot"
                  ? "snapshot"
                  : "vanilla";
        const instanceInitial = inst.name.slice(0, 1).toUpperCase();

        return (
          <div
            key={inst.id}
            className={instanceCard({ active: inst.id === selectedInstanceId })}
            onClick={() => onSelectInstance(inst.id)}
            role="button"
            tabIndex={0}
            aria-pressed={inst.id === selectedInstanceId}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectInstance(inst.id);
              }
            }}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-16 h-16 rounded-2xl bg-[#25252b] border border-white/5 shadow-lg flex items-center justify-center overflow-hidden p-2 group-hover:scale-105 transition-transform duration-300">
                {inst.thumbnail ? (
                  <img src={inst.thumbnail} alt={inst.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-xl font-black text-gray-300">{instanceInitial}</div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className={loaderBadge({ loader: loaderKey })}>{loaderLabel}</span>
                {inst.id === selectedInstanceId && (
                  <span className={statusBadge({ tone: "active" })}>Activa</span>
                )}
                {errorInstanceIds.has(inst.id) && (
                  <span className={statusBadge({ tone: "error" })}>Error</span>
                )}
                {inst.tags?.includes("modpack") && (
                  <span className={statusBadge({ tone: "modpack" })}>Modpack</span>
                )}
                {inst.tags?.includes("multiplayer") && (
                  <span className={statusBadge({ tone: "multiplayer" })}>Multiplayer</span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onManageInstance(inst);
                  }}
                  type="button"
                  className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                  title="Configurar"
                >
                  <IconSettings />
                </button>
              </div>
            </div>

            <div className="flex-1 mb-6">
              <h3 className="text-xl font-bold text-white mb-1 truncate">{inst.name}</h3>
              <div className="flex items-center gap-3 text-xs text-gray-500 font-mono">
                <span>{inst.version}</span>
                <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                <span>{inst.mods_count} mods</span>
                <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                <span>{formatLastPlayed(inst.last_played)}</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayInstance(inst.id);
                }}
                type="button"
                className={playButton()}
              >
                <IconPlay />
                <span>Jugar</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenInstance(inst.id);
                }}
                type="button"
                className={openButton()}
                title="Abrir carpeta"
              >
                <IconFolder />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
