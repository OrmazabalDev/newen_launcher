import { useMemo } from "react";
import type { InstanceSummary } from "../../../types";
import { CONTENT_KIND_BY_TYPE, PROJECT_TYPES, type ProjectType } from "../constants";
import { extractGameVersion } from "../utils";

type CatalogContextArgs = {
  instances: InstanceSummary[];
  selectedInstanceId: string;
  projectType: ProjectType;
};

export function useCatalogContext({
  instances,
  selectedInstanceId,
  projectType,
}: CatalogContextArgs) {
  const requiresInstance = projectType !== "modpack";
  const nonModpackInstances = useMemo(
    () => instances.filter((inst) => !inst.tags?.includes("modpack")),
    [instances]
  );
  const eligibleInstances = useMemo(() => {
    if (!requiresInstance) return nonModpackInstances;
    if (projectType === "resourcepack" || projectType === "shader" || projectType === "datapack") {
      return nonModpackInstances;
    }
    return nonModpackInstances.filter(
      (i) => i.loader === "forge" || i.loader === "neoforge" || i.loader === "fabric"
    );
  }, [nonModpackInstances, projectType, requiresInstance]);
  const selectedInstance = useMemo(
    () =>
      requiresInstance ? eligibleInstances.find((i) => i.id === selectedInstanceId) || null : null,
    [eligibleInstances, selectedInstanceId, requiresInstance]
  );
  const loader = selectedInstance?.loader;
  const gameVersion = selectedInstance ? extractGameVersion(selectedInstance.version) : undefined;
  const loaderFilter = projectType === "mod" ? loader : undefined;
  const gameVersionFilter = projectType === "modpack" ? undefined : gameVersion;
  const projectTypeLabel = PROJECT_TYPES.find((t) => t.id === projectType)?.label ?? "Mods";
  const isDatapack = projectType === "datapack";
  const contentKind = CONTENT_KIND_BY_TYPE[projectType];

  return {
    requiresInstance,
    eligibleInstances,
    selectedInstance,
    loader,
    gameVersion,
    loaderFilter,
    gameVersionFilter,
    projectTypeLabel,
    isDatapack,
    contentKind,
  };
}
