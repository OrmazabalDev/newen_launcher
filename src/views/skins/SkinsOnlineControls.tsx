import { SectionCard } from "../../components/ui/SectionCard";
import { cn } from "../../utils/cn";
import { actionButton, capeButton } from "./styles";

export function SkinsOnlineControls({
  officialSkinUrl,
  capeUrls,
  officialCape,
  onSelectCape,
  onRefreshOnline,
  isBusy,
}: {
  officialSkinUrl: string;
  capeUrls: string[];
  officialCape: string | null;
  onSelectCape: (url: string) => void;
  onRefreshOnline?: () => void;
  isBusy: boolean;
}) {
  return (
    <div className="space-y-6">
      <SectionCard title="Skin oficial">
        {officialSkinUrl ? (
          <div className="flex items-center gap-3">
            <img
              src={officialSkinUrl}
              alt="Skin oficial"
              className="w-14 h-14 rounded-xl border border-gray-800 object-cover"
            />
            <div className="text-sm text-gray-300">
              <div className="font-bold text-white">Skin activa</div>
              <div className="text-xs text-gray-500">
                Se sincroniza con tu cuenta Microsoft
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-400">No se encontró skin oficial.</div>
        )}
      </SectionCard>

      <SectionCard
        title="Sincronizar"
        description="Actualiza skin y capes desde la cuenta Microsoft sin reiniciar."
      >
        <button
          type="button"
          onClick={() => onRefreshOnline?.()}
          disabled={!onRefreshOnline || isBusy}
          aria-disabled={!onRefreshOnline || isBusy}
          className={actionButton({ tone: "accent", size: "md" })}
        >
          Actualizar skin/cape
        </button>
      </SectionCard>

      <SectionCard title="Capes oficiales">
        {capeUrls.length === 0 && (
          <div className="text-sm text-gray-400">No hay capes asociadas a esta cuenta.</div>
        )}
        {capeUrls.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {capeUrls.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => onSelectCape(url)}
                className={cn(capeButton({ active: officialCape === url }))}
              >
                <img src={url} alt="Cape" className="w-full h-20 object-cover rounded-lg" />
                <div className="text-[10px] text-gray-400 mt-1">Ver en 3D</div>
              </button>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
