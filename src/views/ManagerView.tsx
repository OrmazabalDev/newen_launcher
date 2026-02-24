import type { VersionItem } from "../types";
import { IconDownload } from "../icons";
import { installButton, installedBadge, outlineButton, toggleBox, versionRow } from "./manager/styles";
import { cn } from "../utils/cn";

export function ManagerView({
  mojangVersions,
  installedVersions,
  showSnapshots,
  setShowSnapshots,
  onInstallVanilla,
  onInstallForge,
  onInstallNeoForge,
  onInstallFabric,
}: {
  mojangVersions: VersionItem[];
  installedVersions: string[];
  showSnapshots: boolean;
  setShowSnapshots: (v: boolean) => void;
  onInstallVanilla: (versionId: string) => void;
  onInstallForge: (versionId: string, isSnapshot: boolean) => void;
  onInstallNeoForge: (versionId: string, isSnapshot: boolean) => void;
  onInstallFabric: (versionId: string, isSnapshot: boolean) => void;
}) {
  return (
    <div className="absolute inset-0 z-20 bg-gray-950 flex flex-col p-8 overflow-hidden animate-fadeIn">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-white">Gestor de versiones</h2>
          <p className="text-gray-300 text-sm">Instala nuevas versiones desde Mojang</p>
          <p className="text-gray-500 text-xs mt-1">
            Forge/NeoForge/Fabric solo están disponibles para versiones release.
          </p>
        </div>

        <div className={toggleBox()}>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300 select-none">
            <input
              type="checkbox"
              className="accent-brand-accent"
              checked={showSnapshots}
              onChange={(e) => setShowSnapshots(e.target.checked)}
            />
            Mostrar snapshots
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="grid grid-cols-1 gap-3">
          {mojangVersions.length === 0 && (
            <div className="text-gray-500 text-center py-10">Cargando lista remota...</div>
          )}

          {mojangVersions
            .filter((v) => showSnapshots || v.type === "release")
            .map((v) => {
              const isInstalled = installedVersions.includes(v.id);
              const isSnapshot = v.type === "snapshot";

              return (
                <div key={v.id} className={versionRow()}>
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        isSnapshot ? "bg-brand-info" : "bg-brand-accent"
                      )}
                    />
                    <div>
                      <div className="font-bold text-lg text-white">{v.id}</div>
                      <div className="text-xs text-gray-400 uppercase font-bold tracking-wider">
                        {v.type}
                      </div>
                    </div>
                    {isInstalled && <span className={installedBadge()}>Instalada</span>}
                  </div>

                  <div className="flex gap-2 opacity-100 sm:opacity-50 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onInstallVanilla(v.id)}
                      type="button"
                      className={installButton({ state: isInstalled ? "installed" : "ready" })}
                      disabled={isInstalled}
                      aria-disabled={isInstalled}
                      title={isInstalled ? "Versión instalada" : `Instalar Vanilla ${v.id}`}
                      aria-label={isInstalled ? "Versión instalada" : `Instalar Vanilla ${v.id}`}
                    >
                      <IconDownload /> {isInstalled ? "Instalada" : "Vanilla"}
                    </button>

                    <button
                      onClick={() => onInstallForge(v.id, isSnapshot)}
                      type="button"
                      disabled={isSnapshot}
                      aria-disabled={isSnapshot}
                      className={outlineButton({ disabled: isSnapshot })}
                      title={isSnapshot ? "Forge no disponible para snapshots" : "Instalar Forge"}
                      aria-label={
                        isSnapshot ? "Forge no disponible para snapshots" : `Instalar Forge ${v.id}`
                      }
                    >
                      Forge
                    </button>

                    <button
                      onClick={() => onInstallNeoForge(v.id, isSnapshot)}
                      type="button"
                      disabled={isSnapshot}
                      aria-disabled={isSnapshot}
                      className={outlineButton({ disabled: isSnapshot })}
                      title={
                        isSnapshot ? "NeoForge no disponible para snapshots" : "Instalar NeoForge"
                      }
                      aria-label={
                        isSnapshot
                          ? "NeoForge no disponible para snapshots"
                          : `Instalar NeoForge ${v.id}`
                      }
                    >
                      NeoForge
                    </button>

                    <button
                      onClick={() => onInstallFabric(v.id, isSnapshot)}
                      type="button"
                      disabled={isSnapshot}
                      aria-disabled={isSnapshot}
                      className={outlineButton({ disabled: isSnapshot })}
                      title={isSnapshot ? "Fabric no disponible para snapshots" : "Instalar Fabric"}
                      aria-label={
                        isSnapshot
                          ? "Fabric no disponible para snapshots"
                          : `Instalar Fabric ${v.id}`
                      }
                    >
                      Fabric
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
