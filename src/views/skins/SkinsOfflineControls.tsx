import { SectionCard } from "../../components/ui/SectionCard";
import { cn } from "../../utils/cn";
import { actionButton, fileInput, pillButton, statusBox, textInput } from "./styles";

type SkinModel = "steve" | "alex";

export function SkinsOfflineControls({
  model,
  onModelChange,
  isBusy,
  skinUrl,
  onSkinUrlChange,
  onApplySkinUrl,
  capeUrl,
  onCapeUrlChange,
  onApplyCapeUrl,
  onFileSelect,
  onCapeFileSelect,
  onClearSkin,
  onClearCape,
  status,
}: {
  model: SkinModel;
  onModelChange: (value: SkinModel) => void;
  isBusy: boolean;
  skinUrl: string;
  onSkinUrlChange: (value: string) => void;
  onApplySkinUrl: () => void | Promise<void>;
  capeUrl: string;
  onCapeUrlChange: (value: string) => void;
  onApplyCapeUrl: () => void | Promise<void>;
  onFileSelect: (file: File) => void | Promise<void>;
  onCapeFileSelect: (file: File) => void | Promise<void>;
  onClearSkin: () => void | Promise<void>;
  onClearCape: () => void | Promise<void>;
  status: string;
}) {
  return (
    <div className="space-y-6">
      <SectionCard title="Modelo">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onModelChange("steve")}
            className={pillButton({ active: model === "steve" })}
          >
            Steve (wide)
          </button>
          <button
            type="button"
            onClick={() => onModelChange("alex")}
            className={pillButton({ active: model === "alex" })}
          >
            Alex (slim)
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          En modo offline el modelo puede depender del UUID; si ves brazos raros, prueba el otro
          modelo.
        </p>
      </SectionCard>

      <SectionCard title="Subir skin">
        <input
          type="file"
          accept="image/png"
          disabled={isBusy}
          aria-disabled={isBusy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              void onFileSelect(file);
            }
          }}
          className={fileInput()}
        />
        <p className="text-xs text-gray-500 mt-2">Formato PNG 64x64 recomendado.</p>
      </SectionCard>

      <SectionCard title="Subir cape">
        <input
          type="file"
          accept="image/png"
          disabled={isBusy}
          aria-disabled={isBusy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              void onCapeFileSelect(file);
            }
          }}
          className={fileInput()}
        />
        <p className="text-xs text-gray-500 mt-2">Formato PNG 64x32 recomendado.</p>
      </SectionCard>

      <SectionCard title="URL">
        <div className="flex gap-2">
          <input
            type="text"
            value={skinUrl}
            onChange={(e) => onSkinUrlChange(e.target.value)}
            placeholder="https://..."
            disabled={isBusy}
            aria-disabled={isBusy}
            className={textInput()}
          />
          <button
            type="button"
            onClick={() => void onApplySkinUrl()}
            disabled={isBusy || !skinUrl.trim()}
            aria-disabled={isBusy || !skinUrl.trim()}
            className={actionButton({ tone: "info", size: "lg" })}
          >
            Aplicar
          </button>
        </div>
      </SectionCard>

      <SectionCard title="URL cape">
        <div className="flex gap-2">
          <input
            type="text"
            value={capeUrl}
            onChange={(e) => onCapeUrlChange(e.target.value)}
            placeholder="https://..."
            disabled={isBusy}
            aria-disabled={isBusy}
            className={textInput()}
          />
          <button
            type="button"
            onClick={() => void onApplyCapeUrl()}
            disabled={isBusy || !capeUrl.trim()}
            aria-disabled={isBusy || !capeUrl.trim()}
            className={actionButton({ tone: "info", size: "lg" })}
          >
            Aplicar
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Acciones">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void onClearSkin()}
            disabled={isBusy}
            aria-disabled={isBusy}
            className={actionButton({ tone: "neutral", size: "md" })}
          >
            Quitar skin
          </button>
          <button
            type="button"
            onClick={() => void onClearCape()}
            disabled={isBusy}
            aria-disabled={isBusy}
            className={actionButton({ tone: "neutral", size: "md" })}
          >
            Quitar cape
          </button>
        </div>
        {status && (
          <div className={cn(statusBox())} role="status" aria-live="polite">
            {status}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
