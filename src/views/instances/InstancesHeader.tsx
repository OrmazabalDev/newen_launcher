import { useRef } from "react";
import { IconDownload, IconPlus, IconSearch } from "../../icons";
import { primaryButton, secondaryButton, searchInput } from "./styles";

export function InstancesHeader({
  query,
  onQueryChange,
  isProcessing,
  importingModpack,
  importStatus,
  onCreateClick,
  onImportFile,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  isProcessing: boolean;
  importingModpack: boolean;
  importStatus: string;
  onCreateClick: () => void;
  onImportFile: (file: File) => void | Promise<void>;
}) {
  const importInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="sticky top-0 z-20 bg-[#0f0f13]/80 backdrop-blur-xl border-b border-white/5 px-8 py-6">
      <div className="flex items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-white">Mis instancias</h2>
          <p className="text-gray-400 text-sm mt-1">Gestiona y organiza tus perfiles de juego</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-brand-accent transition-colors">
              <IconSearch />
            </span>
            <input
              className={searchInput()}
              placeholder="Buscar instancia..."
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
          </div>
          <button
            onClick={onCreateClick}
            type="button"
            disabled={isProcessing}
            aria-disabled={isProcessing}
            title={
              isProcessing ? "Espera a que termine el proceso actual." : "Crear nueva instancia"
            }
            className={primaryButton()}
          >
            <IconPlus />
            <span>Nueva instancia</span>
          </button>
          <button
            onClick={() => importInputRef.current?.click()}
            type="button"
            disabled={isProcessing || importingModpack}
            aria-disabled={isProcessing || importingModpack}
            title={importingModpack ? "Importando..." : "Importar modpack (.mrpack)"}
            className={secondaryButton()}
          >
            <IconDownload />
            <span>{importingModpack ? "Importando..." : "Importar modpack"}</span>
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".mrpack,.zip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void onImportFile(file);
              }
              if (importInputRef.current) {
                importInputRef.current.value = "";
              }
            }}
          />
        </div>
      </div>
      {isProcessing && (
        <div className="mt-3 text-xs text-gray-500">Acciones bloqueadas por tarea en curso.</div>
      )}
      {importStatus && <div className="mt-3 text-xs text-gray-400">{importStatus}</div>}
    </div>
  );
}
