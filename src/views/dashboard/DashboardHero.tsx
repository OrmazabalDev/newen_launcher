import { heroBadge } from "./styles";

export function DashboardHero({
  loaderLabel,
  modsLabel,
  version,
  hasInstance,
  instanceName,
}: {
  loaderLabel: string;
  modsLabel: string;
  version: string;
  hasInstance: boolean;
  instanceName: string;
}) {
  return (
    <div className="space-y-4 mb-10">
      <div className="flex items-center gap-3">
        <span className={heroBadge({ tone: "loader" })}>
          {loaderLabel} {version || "N/A"}
        </span>
        <span className={heroBadge({ tone: "mods" })}>{modsLabel}</span>
      </div>

      <h1 className="text-6xl font-black text-white tracking-tight drop-shadow-2xl max-w-3xl leading-tight">
        {hasInstance ? instanceName : "Sin instancia"}
      </h1>
      <p className="text-gray-400 max-w-lg text-lg">
        Tu aventura está lista. Newen gestiona los recursos en segundo plano para una experiencia
        fluida.
      </p>

      {!hasInstance && (
        <div className="text-sm text-gray-200 bg-white/5 border border-white/10 rounded-xl px-4 py-3 max-w-2xl">
          Crea tu primera instancia para empezar. Puedes elegir Vanilla, Forge, NeoForge o Fabric.
        </div>
      )}
    </div>
  );
}
