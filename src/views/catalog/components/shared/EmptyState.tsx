import { cn } from "../../../../utils/cn";
import { panel, primaryButton } from "../../styles";

type CatalogEmptyStateProps = {
  title: string;
  message: string;
  onClearFilters: () => void;
  onShowPopular: () => void;
  showPopularAction: boolean;
};

export function CatalogEmptyState({
  title,
  message,
  onClearFilters,
  onShowPopular,
  showPopularAction = false,
}: CatalogEmptyStateProps) {
  return (
    <div className={cn(panel({ size: "md" }), "col-span-full text-center")}>
      <div className="text-lg font-bold text-white">{title}</div>
      <div className="text-sm text-gray-400 mt-2">{message}</div>
      <div className="mt-4 flex items-center justify-center gap-3">
        <button type="button" onClick={onClearFilters} className={primaryButton({ tone: "gray" })}>
          Limpiar filtros
        </button>
        {showPopularAction && onShowPopular && (
          <button type="button" onClick={onShowPopular} className={primaryButton({ tone: "accent" })}>
            Ver populares
          </button>
        )}
      </div>
    </div>
  );
}
