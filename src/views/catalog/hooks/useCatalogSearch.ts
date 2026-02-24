import { useCallback, useEffect, useMemo } from "react";
import type {
  CurseForgeMod,
  ModrinthProject,
  ModrinthProjectHit,
  ModrinthVersion,
} from "../../../types";
import * as catalogApi from "../api";
import type { ModpackLoaderFilter, ProjectType, SourceType } from "../constants";

export type CatalogSearchState = {
  results: ModrinthProjectHit[];
  setResults: (items: ModrinthProjectHit[]) => void;
  curseResults: CurseForgeMod[];
  setCurseResults: (items: CurseForgeMod[]) => void;
  selectedProject: ModrinthProjectHit | null;
  setSelectedProject: (project: ModrinthProjectHit | null) => void;
  selectedCurse: CurseForgeMod | null;
  setSelectedCurse: (project: CurseForgeMod | null) => void;
  versions: ModrinthVersion[];
  setVersions: (items: ModrinthVersion[]) => void;
  selectedVersionId: string;
  setSelectedVersionId: (id: string) => void;
  modpackDetails: ModrinthProject | null;
  setModpackDetails: (project: ModrinthProject | null) => void;
  totalHits: number;
  setTotalHits: (value: number) => void;
  curseforgeNeedsKey: boolean;
  setCurseforgeNeedsKey: (value: boolean) => void;
  clearInstalledItems: () => void;
};

type CatalogSearchArgs = {
  source: SourceType;
  activeQuery: string;
  page: number;
  pageSize: number;
  index: "relevance" | "downloads" | "newest" | "updated";
  projectType: ProjectType;
  categories: string[];
  modpackLoader: ModpackLoaderFilter;
  loaderFilter?: string;
  gameVersionFilter?: string;
  requiresInstance: boolean;
  selectedInstanceId?: string;
  projectTypeLabel: string;
  loader?: string;
  gameVersion?: string;
  setPage: (page: number) => void;
  setStatus: (value: string) => void;
  setLoading: (value: boolean) => void;
};

export function useCatalogSearch(state: CatalogSearchState, args: CatalogSearchArgs) {
  const {
    setResults,
    setCurseResults,
    selectedProject,
    setSelectedProject,
    setSelectedCurse,
    setVersions,
    setSelectedVersionId,
    setModpackDetails,
    setTotalHits,
    setCurseforgeNeedsKey,
    clearInstalledItems,
  } = state;
  const {
    source,
    activeQuery,
    page,
    pageSize,
    index,
    projectType,
    categories,
    modpackLoader,
    loaderFilter,
    gameVersionFilter,
    requiresInstance,
    selectedInstanceId,
    projectTypeLabel,
    loader,
    gameVersion,
    setPage,
    setStatus,
    setLoading,
  } = args;

  const categoryFilters = useMemo(() => {
    if (projectType === "modpack") {
      return modpackLoader !== "any" ? [modpackLoader] : undefined;
    }
    if (projectType === "mod") {
      return categories.length > 0 ? categories : undefined;
    }
    return undefined;
  }, [categories, projectType, modpackLoader]);

  const closeProjectModal = useCallback(() => {
    setSelectedProject(null);
    setVersions([]);
    setSelectedVersionId("");
    setModpackDetails(null);
  }, [setModpackDetails, setSelectedProject, setSelectedVersionId, setVersions]);

  const closeCurseModal = useCallback(() => {
    setSelectedCurse(null);
  }, [setSelectedCurse]);

  const handleSelectProject = useCallback(
    async (project: ModrinthProjectHit) => {
      setSelectedProject(project);
      if (projectType === "modpack") {
        setModpackDetails(null);
      }
      setLoading(true);
      setStatus("Cargando versiones...");
      try {
        const list = await catalogApi.modrinthListVersions(
          project.project_id,
          loaderFilter,
          gameVersionFilter
        );
        setVersions(list);
        setSelectedVersionId(list[0]?.id || "");
        setStatus("");
      } catch (e: unknown) {
        setStatus("Error cargando versiones: " + String(e));
      } finally {
        setLoading(false);
      }
    },
    [
      gameVersionFilter,
      loaderFilter,
      projectType,
      setLoading,
      setModpackDetails,
      setSelectedProject,
      setSelectedVersionId,
      setStatus,
      setVersions,
    ]
  );

  useEffect(() => {
    setResults([]);
    setCurseResults([]);
    setSelectedProject(null);
    setSelectedCurse(null);
    setVersions([]);
    setModpackDetails(null);
    setTotalHits(0);
    setStatus("");
    setPage(0);
    clearInstalledItems();
  }, [
    source,
    selectedInstanceId,
    loader,
    gameVersion,
    projectType,
    modpackLoader,
    setCurseResults,
    setModpackDetails,
    setPage,
    setResults,
    setSelectedCurse,
    setSelectedProject,
    setStatus,
    setTotalHits,
    setVersions,
    clearInstalledItems,
  ]);

  useEffect(() => {
    if (requiresInstance && !selectedInstanceId) return;
    const q = activeQuery.trim();
    const offset = page * pageSize;
    let cancelled = false;

    if (source === "curseforge" && !q) {
      setCurseResults([]);
      setLoading(false);
      setStatus("Escribe para buscar en CurseForge.");
      return;
    }

    const run = async () => {
      setLoading(true);
      setStatus(
        source === "modrinth"
          ? q
            ? `Buscando ${String(projectTypeLabel).toLowerCase()} en Modrinth...`
            : `Cargando ${String(projectTypeLabel).toLowerCase()} populares...`
          : "Buscando en CurseForge..."
      );
      try {
        if (source !== "modrinth") {
          const resp = await catalogApi.curseforgeSearch(q, pageSize, offset);
          if (cancelled) return;
          setCurseResults(resp.data);
          setSelectedCurse(null);
          setCurseforgeNeedsKey(false);
          setStatus("");
          return;
        }

        const resp = await catalogApi.modrinthSearch(
          q,
          pageSize,
          offset,
          loaderFilter,
          gameVersionFilter,
          index,
          projectType,
          categoryFilters
        );
        if (cancelled) return;
        setResults(resp.hits);
        setTotalHits(resp.total_hits || 0);
        setSelectedProject(null);
        setVersions([]);
        setStatus("");
      } catch (e: unknown) {
        if (cancelled) return;
        if (source !== "modrinth") {
          const message = String(e);
          const needsKey = /api key|curseforge_api_key/i.test(message);
          setCurseforgeNeedsKey(needsKey);
          setStatus(
            needsKey
              ? "CurseForge requiere API key (CURSEFORGE_API_KEY)."
              : "Error en CurseForge: " + message
          );
        } else {
          setStatus("Error al buscar: " + String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    activeQuery,
    page,
    pageSize,
    index,
    source,
    selectedInstanceId,
    loader,
    gameVersion,
    projectType,
    categories,
    modpackLoader,
    requiresInstance,
    gameVersionFilter,
    loaderFilter,
    categoryFilters,
    projectTypeLabel,
    setCurseResults,
    setCurseforgeNeedsKey,
    setLoading,
    setResults,
    setSelectedCurse,
    setSelectedProject,
    setStatus,
    setTotalHits,
    setVersions,
  ]);

  useEffect(() => {
    if (projectType !== "modpack") {
      setModpackDetails(null);
      return;
    }
    if (source !== "modrinth") return;
    if (!selectedProject) return;
    let cancelled = false;
    (async () => {
      try {
        const info = await catalogApi.modrinthGetProject(selectedProject.project_id);
        if (!cancelled) setModpackDetails(info);
      } catch {
        if (!cancelled) setModpackDetails(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectType, source, selectedProject, setModpackDetails]);

  useEffect(() => {
    if (state.versions.length === 0) {
      setSelectedVersionId("");
      return;
    }
    if (!state.versions.find((v) => v.id === state.selectedVersionId)) {
      const first = state.versions[0];
      if (first) {
        setSelectedVersionId(first.id);
      }
    }
  }, [state.selectedVersionId, state.versions, setSelectedVersionId]);

  return {
    closeProjectModal,
    closeCurseModal,
    handleSelectProject,
  };
}
