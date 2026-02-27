import { useCallback, useEffect, useMemo } from "react";
import type {
  CurseForgeMod,
  ModrinthProject,
  ModrinthProjectHit,
  ModrinthVersion,
} from "../../../types";
import * as catalogApi from "../api";
import type { ModpackLoaderFilter, ProjectType, SourceType } from "../constants";

type ModrinthCacheEntry = {
  ts: number;
  hits: ModrinthProjectHit[];
  total: number;
};

const MODRINTH_CACHE_TTL_MS = 15 * 60 * 1000;
const PREFETCH_TTL_MS = 30 * 60 * 1000;
const MODRINTH_CACHE_KEY_PREFIX = "launcher_catalog_cache_v1_";

const hashKey = (input: string): string => {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
};

const readCache = (key: string, maxAgeMs: number): ModrinthCacheEntry | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ModrinthCacheEntry>;
    if (!parsed || typeof parsed.ts !== "number") return null;
    if (Date.now() - parsed.ts > maxAgeMs) return null;
    if (!Array.isArray(parsed.hits)) return null;
    return {
      ts: parsed.ts,
      hits: parsed.hits as ModrinthProjectHit[],
      total: typeof parsed.total === "number" ? parsed.total : parsed.hits.length,
    };
  } catch {
    return null;
  }
};

const writeCache = (key: string, hits: ModrinthProjectHit[], total: number): void => {
  try {
    const payload: ModrinthCacheEntry = { ts: Date.now(), hits, total };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Si el storage no esta disponible o esta lleno, se ignora.
  }
};

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

    if (source === "modrinth") {
      const prefetchKey =
        projectType === "modpack" && !q && page === 0
          ? modpackLoader !== "any"
            ? `launcher_catalog_prefetch_modpacks_${modpackLoader}_v1`
            : "launcher_catalog_prefetch_modpacks_any_v1"
          : null;
      if (prefetchKey) {
        const prefetched = readCache(prefetchKey, PREFETCH_TTL_MS);
        if (prefetched && prefetched.hits.length > 0) {
          setResults(prefetched.hits);
          setTotalHits(prefetched.total);
          setStatus("");
        }
      }

      const cachePayload = {
        query: q,
        offset,
        pageSize,
        index,
        projectType,
        loaderFilter,
        gameVersionFilter,
        categories: categoryFilters ?? [],
      };
      const cacheKey =
        MODRINTH_CACHE_KEY_PREFIX + hashKey(JSON.stringify(cachePayload));
      const cached = readCache(cacheKey, MODRINTH_CACHE_TTL_MS);
      if (cached && cached.hits.length > 0) {
        setResults(cached.hits);
        setTotalHits(cached.total);
        setStatus("");
      }
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
        const cachePayload = {
          query: q,
          offset,
          pageSize,
          index,
          projectType,
          loaderFilter,
          gameVersionFilter,
          categories: categoryFilters ?? [],
        };
        const cacheKey =
          MODRINTH_CACHE_KEY_PREFIX + hashKey(JSON.stringify(cachePayload));
        writeCache(cacheKey, resp.hits, resp.total_hits || 0);
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
