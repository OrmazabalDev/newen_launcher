import { alertBox } from "../styles";

type CatalogAlertsProps = {
  showCurseforgeBanner: boolean;
  status: string;
};

export function CatalogAlerts({ showCurseforgeBanner, status }: CatalogAlertsProps) {
  return (
    <>
      {showCurseforgeBanner && (
        <div className={alertBox({ tone: "warning" })}>
          <span className="uppercase tracking-widest font-bold text-amber-200">CurseForge</span>
          <span>Solo búsqueda. Agrega CURSEFORGE_API_KEY para habilitar instalación.</span>
        </div>
      )}

      {status && <div className={alertBox({ tone: "info" })}>{status}</div>}
    </>
  );
}
