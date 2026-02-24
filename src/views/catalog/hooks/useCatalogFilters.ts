import { useCallback, useEffect, useState } from "react";
import type { ModpackLoaderFilter, ProjectType, SourceType } from "../constants";

type CatalogFiltersArgs = {
  initialProjectType: ProjectType;
  lockedProjectType?: ProjectType;
  lockSource?: SourceType;
  onResetSelection: () => void;
};

export function useCatalogFilters({
  initialProjectType,
  lockedProjectType,
  lockSource,
  onResetSelection,
}: CatalogFiltersArgs) {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [source, setSource] = useState<SourceType>(lockSource ?? "modrinth");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(24);
  const [index, setIndex] = useState<"relevance" | "downloads" | "newest" | "updated">("downloads");
  const [projectType, setProjectType] = useState<ProjectType>(
    lockedProjectType ?? initialProjectType
  );
  const [categories, setCategories] = useState<string[]>([]);
  const [showCategories, setShowCategories] = useState(false);
  const [modpackLoader, setModpackLoader] = useState<ModpackLoaderFilter>("any");
  const showProjectTabs = !lockedProjectType;
  const showSourceToggle = !lockSource;

  useEffect(() => {
    if (lockedProjectType && projectType !== lockedProjectType) {
      setProjectType(lockedProjectType);
    }
  }, [lockedProjectType, projectType]);

  useEffect(() => {
    if (lockSource && source !== lockSource) {
      setSource(lockSource);
    }
  }, [lockSource, source]);

  useEffect(() => {
    const stored = localStorage.getItem("launcher_catalog_filters_v1");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed.categories)) {
        setCategories(parsed.categories.filter((c: unknown) => typeof c === "string"));
      }
      if (
        parsed.modpackLoader &&
        ["any", "forge", "neoforge", "fabric"].includes(parsed.modpackLoader)
      ) {
        setModpackLoader(parsed.modpackLoader);
      }
    } catch {
      // ignore invalid storage
    }
  }, []);

  useEffect(() => {
    const payload = {
      categories,
      modpackLoader,
    };
    localStorage.setItem("launcher_catalog_filters_v1", JSON.stringify(payload));
  }, [categories, modpackLoader]);

  const toggleCategory = useCallback((id: string) => {
    setPage(0);
    setCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }, []);

  const clearCategories = useCallback(() => {
    setPage(0);
    setCategories([]);
  }, []);

  const handleSearch = useCallback(() => {
    setPage(0);
    onResetSelection();
    setActiveQuery(query);
  }, [onResetSelection, query]);

  const handleSelectProjectType = useCallback((id: ProjectType) => {
    setProjectType(id);
    setPage(0);
  }, []);

  const handleSelectSource = useCallback((value: SourceType) => {
    setSource(value);
  }, []);

  const handleToggleCategories = useCallback(() => {
    setShowCategories((prev) => !prev);
  }, []);

  const handleModpackLoader = useCallback((value: ModpackLoaderFilter) => {
    setModpackLoader(value);
    setPage(0);
  }, []);

  const handleIndexChange = useCallback(
    (value: "relevance" | "downloads" | "newest" | "updated") => {
      setIndex(value);
      setPage(0);
    },
    []
  );

  const handlePageSizeChange = useCallback((value: number) => {
    setPageSize(value);
    setPage(0);
  }, []);

  const handleClearFilters = useCallback(() => {
    setQuery("");
    setActiveQuery("");
    setPage(0);
    setCategories([]);
  }, []);

  const handleShowPopular = useCallback(() => {
    setActiveQuery("");
    setPage(0);
  }, []);

  const handlePrevPage = useCallback(() => {
    setPage((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setPage((prev) => prev + 1);
  }, []);

  return {
    query,
    setQuery,
    activeQuery,
    source,
    page,
    pageSize,
    index,
    projectType,
    categories,
    showCategories,
    modpackLoader,
    showProjectTabs,
    showSourceToggle,
    setPage,
    toggleCategory,
    clearCategories,
    handleSearch,
    handleSelectProjectType,
    handleSelectSource,
    handleToggleCategories,
    handleModpackLoader,
    handleIndexChange,
    handlePageSizeChange,
    handleClearFilters,
    handleShowPopular,
    handlePrevPage,
    handleNextPage,
  };
}
