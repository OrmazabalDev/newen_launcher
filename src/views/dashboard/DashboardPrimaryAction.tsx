import { Play } from "lucide-react";
import { createButton, playButton, playIcon } from "./styles";
import { cn } from "../../utils/cn";

export function DashboardPrimaryAction({
  hasInstance,
  isProcessing,
  launchLabel,
  onPlay,
  onGoInstances,
}: {
  hasInstance: boolean;
  isProcessing: boolean;
  launchLabel: string;
  onPlay: () => void;
  onGoInstances: () => void;
}) {
  if (!hasInstance) {
    return (
      <button onClick={onGoInstances} type="button" className={createButton()}>
        CREAR INSTANCIA
      </button>
    );
  }

  return (
    <button
      onClick={onPlay}
      disabled={isProcessing}
      type="button"
      aria-disabled={isProcessing}
      title={isProcessing ? "Procesando, espera un momento." : "Iniciar juego"}
      className={playButton({ state: isProcessing ? "busy" : "idle" })}
    >
      <div className={cn(playIcon({ interactive: !isProcessing }))}>
        {isProcessing ? (
          <div className="w-7 h-7 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Play size={28} fill="currentColor" />
        )}
      </div>
      <div className="text-left">
        <p className="text-xs font-bold uppercase tracking-wider text-orange-100 opacity-80 mb-0.5">
          {isProcessing ? "Inicializando..." : "Estado: Listo"}
        </p>
        <p className="text-3xl font-black text-white leading-none">{launchLabel}</p>
      </div>
    </button>
  );
}
