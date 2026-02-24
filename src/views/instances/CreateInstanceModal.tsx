import { useEffect, useMemo, useRef, useState } from "react";
import type { LoaderType } from "../../types";
import { IconChevronDown } from "../../icons";
import { useModalFocus } from "../../hooks/useModalFocus";
import { Box, Code, Coffee, Wrench, Zap } from "lucide-react";
import type { CreatePayload } from "./types";

export function CreateInstanceModal({
  availableVersions,
  onClose,
  onCreate,
  onLoadVersions,
  isProcessing,
}: {
  availableVersions: { id: string; type: "release" | "snapshot" }[];
  onClose: () => void;
  onCreate: (payload: CreatePayload) => void;
  onLoadVersions: () => void;
  isProcessing: boolean;
}) {
  const [name, setName] = useState("");
  const [loader, setLoader] = useState<LoaderType>("vanilla");
  const [multiplayer, setMultiplayer] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useModalFocus({ open: true, containerRef: dialogRef, initialFocusRef: nameRef, onClose });

  useEffect(() => {
    onLoadVersions();
  }, [onLoadVersions]);

  const versionOptions = useMemo(() => {
    if (loader === "snapshot")
      return availableVersions.filter((v) => v.type === "snapshot").map((v) => v.id);
    const releases = availableVersions.filter((v) => v.type === "release").map((v) => v.id);
    if (loader === "forge") return releases;
    if (loader === "neoforge") return releases;
    if (loader === "fabric") return releases;
    return releases;
  }, [availableVersions, loader]);

  const [version, setVersion] = useState(versionOptions[0] || "");
  const latestRelease = useMemo(
    () => availableVersions.find((v) => v.type === "release")?.id || "",
    [availableVersions]
  );

  useEffect(() => {
    setVersion((prev) => (versionOptions.includes(prev) ? prev : versionOptions[0] || ""));
  }, [versionOptions]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fadeIn p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-instance-title"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-xl bg-[#141419] rounded-3xl border border-white/10 shadow-2xl p-8 relative"
        tabIndex={-1}
      >
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 text-gray-500 hover:text-white"
          aria-label="Cerrar"
        >
          X
        </button>

        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-white" id="create-instance-title">
            Nueva instancia
          </h3>
          <p className="text-gray-400 text-sm mt-1">Personaliza tu versión y gestor de mods</p>
        </div>

        {availableVersions.length === 0 && (
          <div className="text-sm text-gray-300 bg-[#1e1e24] border border-white/10 rounded-xl p-4 mb-4">
            Cargando lista de versiones disponibles...
          </div>
        )}

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">
                Nombre
              </label>
              <input
                className="w-full bg-[#1e1e24] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent placeholder:text-gray-600 transition-all"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mi mundo survival"
                ref={nameRef}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">
                Versi?n
              </label>
              <div className="relative">
                <select
                  className="w-full appearance-none bg-[#1e1e24] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-brand-accent cursor-pointer font-mono text-sm"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  disabled={versionOptions.length === 0}
                >
                  {versionOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                  <IconChevronDown />
                </div>
              </div>
              {versionOptions.length === 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  No hay versiones disponibles para este loader.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">
              Mod Loader
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {[
                {
                  id: "fabric",
                  label: "Fabric",
                  icon: <Box size={22} />,
                  active: "bg-emerald-500/10 border-emerald-500/40 text-emerald-200",
                },
                {
                  id: "forge",
                  label: "Forge",
                  icon: <Wrench size={22} />,
                  active: "bg-blue-500/10 border-blue-500/40 text-blue-200",
                },
                {
                  id: "neoforge",
                  label: "NeoForge",
                  icon: <Code size={22} />,
                  active: "bg-orange-500/10 border-orange-500/40 text-orange-200",
                },
                {
                  id: "vanilla",
                  label: "Vanilla",
                  icon: <Coffee size={22} />,
                  active: "bg-gray-500/10 border-gray-500/40 text-gray-200",
                },
                {
                  id: "snapshot",
                  label: "Snapshot",
                  icon: <Zap size={22} />,
                  active: "bg-purple-500/10 border-purple-500/40 text-purple-200",
                },
              ].map((option) => {
                const isActive = loader === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setLoader(option.id as LoaderType);
                      if (option.id !== "snapshot" && latestRelease) {
                        setVersion(latestRelease);
                      }
                    }}
                    className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border transition-all duration-200 h-28 ${
                      isActive
                        ? option.active
                        : "bg-[#1e1e24] border-white/5 text-gray-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {option.icon}
                    <span className="text-xs font-bold uppercase tracking-wide">
                      {option.label}
                    </span>
                    {isActive && <div className="w-2 h-2 rounded-full bg-current shadow-lg mt-1" />}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 text-center mt-2 min-h-[1rem]">
              {loader === "fabric" &&
                "Ligero y rápido. Recomendado para optimización y mods modernos."}
              {loader === "forge" &&
                "El estándar clásico. Mayor compatibilidad con grandes modpacks."}
              {loader === "neoforge" &&
                "La nueva evolución de Forge. Compatible con nuevos estándares."}
              {loader === "vanilla" && "Sin mods. La experiencia original de Minecraft."}
              {loader === "snapshot" && "Versiones experimentales para probar contenido nuevo."}
            </p>
          </div>

          <div className="pt-2 border-t border-white/5">
            <label className="flex items-center gap-3 bg-[#1e1e24] border border-white/10 rounded-xl px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                className="accent-brand-accent"
                checked={multiplayer}
                onChange={(e) => setMultiplayer(e.target.checked)}
              />
              <span className="text-sm text-gray-100">Marcar como multijugador</span>
            </label>
          </div>

          <button
            onClick={() =>
              onCreate({
                name,
                version,
                loader,
                tags: multiplayer ? ["multiplayer"] : [],
              })
            }
            disabled={!name.trim() || !version || isProcessing}
            type="button"
            className="w-full bg-gradient-to-r from-brand-accent to-orange-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-brand-accent/20 hover:shadow-brand-accent/40 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Crear instancia
          </button>
        </div>
      </div>
    </div>
  );
}
