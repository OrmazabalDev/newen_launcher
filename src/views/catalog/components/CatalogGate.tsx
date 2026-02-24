import { panel, primaryButton } from "../styles";

type CatalogGateProps = {
  open: boolean;
  headerTitle: string;
  gateTitle: string;
  gateMessage: string;
  onGoInstances?: () => void;
};

export function CatalogGate({
  open,
  headerTitle,
  gateTitle,
  gateMessage,
  onGoInstances,
}: CatalogGateProps) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-20 bg-gray-950 flex flex-col items-center justify-center p-8 overflow-hidden animate-fadeIn text-center">
      <div className={panel({ tone: "glass", size: "lg" })}>
        <h2 className="text-2xl font-bold text-white mb-3">{headerTitle}</h2>
        <div className="text-lg font-bold text-white mb-2">{gateTitle}</div>
        <p className="text-gray-300 text-sm">{gateMessage}</p>
        {onGoInstances && (
          <button onClick={onGoInstances} type="button" className={primaryButton()}>
            Ir a instancias
          </button>
        )}
      </div>
    </div>
  );
}
