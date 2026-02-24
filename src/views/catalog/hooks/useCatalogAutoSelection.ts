import { useEffect } from "react";
import type { InstanceSummary, ModrinthProjectHit } from "../../../types";
import type { ProjectType, SourceType } from "../constants";

type CatalogAutoSelectionArgs = {
  requiresInstance: boolean;
  selectedInstance: InstanceSummary | null;
  eligibleInstances: InstanceSummary[];
  onSelectInstance: (id: string) => void;
  source: SourceType;
  showDetailPanel: boolean;
  selectedProject: ModrinthProjectHit | null;
  results: ModrinthProjectHit[];
  handleSelectProject: (project: ModrinthProjectHit) => void | Promise<void>;
  projectType: ProjectType;
};

export function useCatalogAutoSelection({
  requiresInstance,
  selectedInstance,
  eligibleInstances,
  onSelectInstance,
  source,
  showDetailPanel,
  selectedProject,
  results,
  handleSelectProject,
  projectType,
}: CatalogAutoSelectionArgs) {
  useEffect(() => {
    if (requiresInstance && !selectedInstance && eligibleInstances.length > 0) {
      const first = eligibleInstances[0];
      if (first) {
        onSelectInstance(first.id);
      }
    }
  }, [eligibleInstances, selectedInstance, onSelectInstance, requiresInstance]);

  useEffect(() => {
    if (source !== "modrinth") return;
    if (!showDetailPanel) return;
    if (!selectedProject && results.length > 0) {
      const first = results[0];
      if (first) {
        void handleSelectProject(first);
      }
    }
  }, [results, selectedProject, source, projectType, handleSelectProject, showDetailPanel]);
}
