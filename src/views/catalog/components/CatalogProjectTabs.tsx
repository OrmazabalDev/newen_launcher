import { PROJECT_TYPES, type ProjectType } from "../constants";
import { pillButton } from "../styles";

type CatalogProjectTabsProps = {
  showProjectTabs: boolean;
  projectType: ProjectType;
  hiddenProjectTypes: ProjectType[];
  onSelectProjectType: (value: ProjectType) => void;
};

export function CatalogProjectTabs({
  showProjectTabs,
  projectType,
  hiddenProjectTypes,
  onSelectProjectType,
}: CatalogProjectTabsProps) {
  if (!showProjectTabs) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {PROJECT_TYPES.filter((type) => !hiddenProjectTypes.includes(type.id)).map((type) => (
        <button
          key={type.id}
          type="button"
          onClick={() => onSelectProjectType(type.id)}
          className={pillButton({ active: projectType === type.id })}
        >
          {type.label}
        </button>
      ))}
    </div>
  );
}
