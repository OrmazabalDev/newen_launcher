import type { InstanceSummary } from "../../../types";
import { IconChevronDown } from "../../../icons";
import { inlineInfo, selectInput } from "../styles";

type CatalogHeaderProps = {
  headerTitle: string;
  headerSubtitle: string;
  requiresInstance: boolean;
  eligibleInstances: InstanceSummary[];
  selectedInstance: InstanceSummary | null;
  onSelectInstance: (id: string) => void;
};

export function CatalogHeader({
  headerTitle,
  headerSubtitle,
  requiresInstance,
  eligibleInstances,
  selectedInstance,
  onSelectInstance,
}: CatalogHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-3xl font-bold text-white">{headerTitle}</h2>
        <p className="text-gray-300 text-sm">{headerSubtitle}</p>
      </div>
      {requiresInstance ? (
        <div className="min-w-[260px]">
          <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">
            Instancia
          </label>
          <div className="relative">
            <select
              className={selectInput()}
              value={selectedInstance?.id || ""}
              onChange={(e) => onSelectInstance(e.target.value)}
            >
              {eligibleInstances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
              <IconChevronDown />
            </div>
          </div>
        </div>
      ) : (
        <div className={inlineInfo()}>
          Al instalar un modpack se creará una instancia nueva automáticamente.
        </div>
      )}
    </div>
  );
}
