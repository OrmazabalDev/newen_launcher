type CatalogEmptyStateProps = {
  title: string;
  message: string;
  onClearFilters: () => void;
  onShowPopular?: () => void;
  showPopularAction?: boolean;
};

export function CatalogEmptyState({
  title,
  message,
  onClearFilters,
  onShowPopular,
  showPopularAction = false,
}: CatalogEmptyStateProps) {
  return (
    <div className="col-span-full rounded-2xl border border-gray-800 bg-gray-900/60 p-6 text-center">
      <div className="text-lg font-bold text-white">{title}</div>
      <div className="text-sm text-gray-400 mt-2">{message}</div>
      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onClearFilters}
          className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold"
        >
          Limpiar filtros
        </button>
        {showPopularAction && onShowPopular && (
          <button
            type="button"
            onClick={onShowPopular}
            className="px-4 py-2 rounded-xl bg-brand-accent hover:bg-brand-accent-deep text-white font-bold"
          >
            Ver populares
          </button>
        )}
      </div>
    </div>
  );
}
