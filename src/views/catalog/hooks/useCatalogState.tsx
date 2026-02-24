import { useCallback, useMemo, useRef, useState } from "react";
import type {
  CurseForgeMod,
  InstanceContentItem,
  InstanceSummary,
  ModrinthProject,
  ModrinthProjectHit,
  ModrinthVersion,
} from "../../../types";
import { useCatalogFilters } from "./useCatalogFilters";
import { useCatalogToast } from "./useCatalogToast";
import { useCatalogContext } from "./useCatalogContext";
import { useCatalogSearch } from "./useCatalogSearch";
import { useCatalogWorlds } from "./useCatalogWorlds";
import { useCatalogInstall } from "./useCatalogInstall";
import { useCatalogDerived } from "./useCatalogDerived";
import { useCatalogModalBehavior } from "./useCatalogModalBehavior";
import { useCatalogModalState } from "./useCatalogModalState";
import { useCatalogAutoSelection } from "./useCatalogAutoSelection";
import { type ProjectType, type SourceType } from "../constants";
import type { ConfirmOptions } from "../types";

export type CatalogStateArgs = {
  instances: InstanceSummary[];
  selectedInstanceId: string;
  onSelectInstance: (id: string) => void;
  onGoInstances?: () => void;
  onGoPlay?: () => void;
  onRefreshInstances?: () => void | Promise<void>;
  onConfirm: (opts: ConfirmOptions) => Promise<boolean>;
  progressLabel?: string;
  initialProjectType?: ProjectType;
  lockedProjectType?: ProjectType;
  title?: string;
  subtitle?: string;
  lockSource?: SourceType;
};

export function useCatalogState({
  instances,
  selectedInstanceId,
  onSelectInstance,
  onGoInstances,
  onGoPlay,
  onRefreshInstances,
  onConfirm,
  progressLabel,
  initialProjectType = "mod",
  lockedProjectType,
  title,
  subtitle,
  lockSource,
}: CatalogStateArgs) {
  const [results, setResults] = useState<ModrinthProjectHit[]>([]);
  const [curseResults, setCurseResults] = useState<CurseForgeMod[]>([]);
  const [selectedProject, setSelectedProject] = useState<ModrinthProjectHit | null>(null);
  const [modpackDetails, setModpackDetails] = useState<ModrinthProject | null>(null);
  const [selectedCurse, setSelectedCurse] = useState<CurseForgeMod | null>(null);
  const [versions, setVersions] = useState<ModrinthVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [installedItems, setInstalledItems] = useState<InstanceContentItem[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [curseforgeNeedsKey, setCurseforgeNeedsKey] = useState(false);
  const [totalHits, setTotalHits] = useState(0);
  const clearInstalledItems = useCallback(() => setInstalledItems([]), []);

  const modModalRef = useRef<HTMLDivElement>(null);
  const modCloseRef = useRef<HTMLButtonElement>(null);
  const curseModalRef = useRef<HTMLDivElement>(null);
  const curseCloseRef = useRef<HTMLButtonElement>(null);
  const modpackModalRef = useRef<HTMLDivElement>(null);
  const modpackCloseRef = useRef<HTMLButtonElement>(null);

  const resetSelection = useCallback(() => {
    setSelectedProject(null);
    setSelectedCurse(null);
    setVersions([]);
    setModpackDetails(null);
  }, []);

  const {
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
  } = useCatalogFilters({
    initialProjectType,
    lockedProjectType,
    lockSource,
    onResetSelection: resetSelection,
  });

  const { toast, showToast, handleToastAction } = useCatalogToast(onGoInstances);

  const {
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
  } = useCatalogContext({ instances, selectedInstanceId, projectType });
  const showDetailPanel = false;

  const { closeProjectModal, closeCurseModal, handleSelectProject } = useCatalogSearch(
    {
      results,
      setResults,
      curseResults,
      setCurseResults,
      selectedProject,
      setSelectedProject,
      selectedCurse,
      setSelectedCurse,
      versions,
      setVersions,
      selectedVersionId,
      setSelectedVersionId,
      modpackDetails,
      setModpackDetails,
      totalHits,
      setTotalHits,
      curseforgeNeedsKey,
      setCurseforgeNeedsKey,
      clearInstalledItems,
    },
    {
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
      selectedInstanceId: selectedInstance?.id,
      projectTypeLabel,
      loader,
      gameVersion,
      setPage,
      setStatus,
      setLoading,
    }
  );

  const {
    isModpackModalOpen,
    isModModalOpen,
    isCurseModalOpen,
    galleryIndex,
    showFullDescription,
    activeImage,
    handleGalleryPrev,
    handleGalleryNext,
    handleGallerySelect,
    handleShowFullDescription,
    handleHideFullDescription,
  } = useCatalogModalState({
    projectType,
    source,
    selectedProject,
    selectedCurse,
    modpackDetails,
  });

  const {
    worlds,
    worldsLoading,
    worldsError,
    selectedWorldId,
    setSelectedWorldId,
    importingDatapack,
    handleImportDatapack,
  } = useCatalogWorlds({
    isModModalOpen,
    isDatapack,
    selectedInstance,
    showToast,
    setStatus,
  });

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) || null,
    [versions, selectedVersionId]
  );
  const availableLoaders = useMemo(
    () => (Array.isArray(selectedVersion?.loaders) ? selectedVersion!.loaders : []),
    [selectedVersion]
  );

  const { installingVersionId, handleInstall } = useCatalogInstall({
    projectType,
    projectTypeLabel,
    selectedProject,
    selectedInstance,
    loader,
    gameVersionFilter,
    availableLoaders,
    contentKind,
    requiresInstance,
    selectedWorldId,
    worlds,
    worldsLoading,
    onConfirm,
    onRefreshInstances,
    onSelectInstance,
    onGoPlay,
    onGoInstances,
    showToast,
    closeProjectModal,
    setStatus,
    setLoading,
    setInstalledItems,
  });

  const derived = useCatalogDerived({
    title,
    subtitle,
    projectType,
    projectTypeLabel,
    source,
    activeQuery,
    progressLabel,
    status,
    loading,
    results,
    curseResults,
    selectedProject,
    modpackDetails,
    versions,
    selectedVersionId,
    installedItems,
    requiresInstance,
    eligibleInstances,
    selectedInstance,
    loader,
    gameVersion,
    modpackLoader,
    isDatapack,
    installingVersionId,
    worlds,
    worldsLoading,
    selectedWorldId,
    importingDatapack,
    curseforgeNeedsKey,
  });

  useCatalogModalBehavior({
    isModModalOpen,
    isCurseModalOpen,
    isModpackModalOpen,
    modModalRef,
    modCloseRef,
    curseModalRef,
    curseCloseRef,
    modpackModalRef,
    modpackCloseRef,
    onCloseProjectModal: closeProjectModal,
    onCloseCurseModal: closeCurseModal,
  });

  useCatalogAutoSelection({
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
  });

  return {
    query,
    setQuery,
    results,
    curseResults,
    selectedProject,
    modpackDetails,
    galleryIndex,
    showFullDescription,
    selectedCurse,
    versions,
    selectedVersionId,
    status,
    loading,
    worlds,
    worldsLoading,
    worldsError,
    selectedWorldId,
    importingDatapack,
    curseforgeNeedsKey,
    toast,
    modModalRef,
    modCloseRef,
    curseModalRef,
    curseCloseRef,
    modpackModalRef,
    modpackCloseRef,
    source,
    page,
    pageSize,
    index,
    totalHits,
    projectType,
    categories,
    showCategories,
    modpackLoader,
    ...derived,
    showProjectTabs,
    showSourceToggle,
    requiresInstance,
    eligibleInstances,
    selectedInstance,
    loader,
    projectTypeLabel,
    // derived values
    contentKind,
    showDetailPanel,
    isModpackModalOpen,
    isModModalOpen,
    isCurseModalOpen,
    activeImage,
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
    handleGalleryPrev,
    handleGalleryNext,
    handleGallerySelect,
    handleShowFullDescription,
    handleHideFullDescription,
    closeProjectModal,
    closeCurseModal,
    handleSelectProject,
    handleInstall,
    handleImportDatapack,
    handleToastAction,
    setSelectedCurse,
    setSelectedVersionId,
    setSelectedWorldId,
  };
}
