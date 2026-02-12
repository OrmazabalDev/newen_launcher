import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CurseForgeMod,
  InstanceContentItem,
  InstanceSummary,
  ModrinthProject,
  ModrinthProjectHit,
  ModrinthVersion,
} from "../../types";
import * as tauri from "../../services/tauri";
import { useModalFocus } from "../../hooks/useModalFocus";
import {
  CONTENT_KIND_BY_TYPE,
  PROJECT_TYPES,
  type ModpackLoaderFilter,
  type ProjectType,
  type SourceType,
} from "./constants";
import { extractGameVersion, formatLoaderLabel } from "./utils";
import type { ConfirmOptions } from "./types";

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
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [results, setResults] = useState<ModrinthProjectHit[]>([]);
  const [curseResults, setCurseResults] = useState<CurseForgeMod[]>([]);
  const [selectedProject, setSelectedProject] = useState<ModrinthProjectHit | null>(null);
  const [modpackDetails, setModpackDetails] = useState<ModrinthProject | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [selectedCurse, setSelectedCurse] = useState<CurseForgeMod | null>(null);
  const [versions, setVersions] = useState<ModrinthVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [installedItems, setInstalledItems] = useState<InstanceContentItem[]>([]);
  const [worlds, setWorlds] = useState<string[]>([]);
  const [worldsLoading, setWorldsLoading] = useState(false);
  const [worldsError, setWorldsError] = useState("");
  const [selectedWorldId, setSelectedWorldId] = useState("");
  const [importingDatapack, setImportingDatapack] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [installingVersionId, setInstallingVersionId] = useState<string | null>(null);
  const [curseforgeNeedsKey, setCurseforgeNeedsKey] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    kind: "success" | "info" | "error";
    actionLabel?: string;
    action?:
      | { type: "open-content"; instanceId: string; kind: "mods" | "resourcepacks" | "shaderpacks" }
      | { type: "open-instance"; instanceId: string }
      | { type: "go-instances" }
      | { type: "open-datapacks"; instanceId: string; worldId: string };
  } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const modModalRef = useRef<HTMLDivElement | null>(null);
  const modCloseRef = useRef<HTMLButtonElement | null>(null);
  const curseModalRef = useRef<HTMLDivElement | null>(null);
  const curseCloseRef = useRef<HTMLButtonElement | null>(null);
  const modpackModalRef = useRef<HTMLDivElement | null>(null);
  const modpackCloseRef = useRef<HTMLButtonElement | null>(null);
  const [source, setSource] = useState<SourceType>(lockSource ?? "modrinth");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(24);
  const [index, setIndex] = useState<"relevance" | "downloads" | "newest" | "updated">("downloads");
  const [totalHits, setTotalHits] = useState(0);
  const [projectType, setProjectType] = useState<ProjectType>(lockedProjectType ?? initialProjectType);
  const [categories, setCategories] = useState<string[]>([]);
  const [showCategories, setShowCategories] = useState(false);
  const [modpackLoader, setModpackLoader] = useState<ModpackLoaderFilter>("any");
  const headerTitle = title ?? "Catálogo de contenido";
  const headerSubtitle =
    subtitle ?? "Explora Modrinth por tipo, categoría y versión. Puedes instalar mods, modpacks, resource packs y shaders.";
  const searchPlaceholder =
    projectType === "modpack"
      ? "Busca modpacks (ej: Better Minecraft)"
      : projectType === "datapack"
        ? "Busca datapacks (ej: Terralith, Vanilla Tweaks)"
        : "Busca mods (ej: Sodium, JEI, Journeymap)";
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
    return nonModpackInstances.filter((i) => i.loader === "forge" || i.loader === "neoforge" || i.loader === "fabric");
  }, [nonModpackInstances, projectType, requiresInstance]);
  const selectedInstance = useMemo(
    () => (requiresInstance ? eligibleInstances.find((i) => i.id === selectedInstanceId) || null : null),
    [eligibleInstances, selectedInstanceId, requiresInstance]
  );
  const loader = selectedInstance?.loader;
  const gameVersion = selectedInstance ? extractGameVersion(selectedInstance.version) : undefined;
  const loaderFilter = projectType === "mod" ? loader : undefined;
  const gameVersionFilter = projectType === "modpack" ? undefined : gameVersion;
  const projectTypeLabel = PROJECT_TYPES.find((t) => t.id === projectType)?.label ?? "Mods";
  const isDatapack = projectType === "datapack";
  const categoryFilters = useMemo(() => {
    if (projectType === "modpack") {
      return modpackLoader !== "any" ? [modpackLoader] : undefined;
    }
    if (projectType === "mod") {
      return categories.length > 0 ? categories : undefined;
    }
    return undefined;
  }, [categories, projectType, modpackLoader]);
  const selectedVersion = versions.find((v) => v.id === selectedVersionId) || null;
  const selectedGameVersion = selectedVersion?.game_versions?.[0];
  const availableLoaders = Array.isArray(selectedVersion?.loaders) ? selectedVersion!.loaders : [];
  const requiresForge = availableLoaders.includes("forge");
  const requiresNeoForge = availableLoaders.includes("neoforge");
  const requiresFabric =
    availableLoaders.includes("fabric") || availableLoaders.includes("quilt") || availableLoaders.includes("quilt-loader");
  const requiredLabels = [
    requiresForge ? "Forge" : null,
    requiresNeoForge ? "NeoForge" : null,
    requiresFabric ? "Fabric" : null,
  ].filter((v): v is string => !!v);
  const loaderLabel = requiredLabels.length > 0 ? requiredLabels.join(" / ") : "Cualquiera";
  const versionLabel = projectType === "modpack" ? selectedGameVersion || "varias" : gameVersion || "todas";
  const loaderChip = projectType === "modpack" ? formatLoaderLabel(modpackLoader) : formatLoaderLabel(loader);
  const versionChip =
    projectType === "modpack"
      ? "Versiones: varias"
      : `Versión: ${gameVersion || "todas"}`;
  const noEligibleInstances = requiresInstance && eligibleInstances.length === 0;
  const gateTitle =
    projectType === "mod"
      ? "Necesitas una instancia compatible"
      : projectType === "resourcepack"
        ? "Necesitas una instancia"
        : projectType === "shader"
          ? "Necesitas una instancia"
          : "Necesitas una instancia";
  const gateMessage =
    projectType === "mod"
      ? "Para instalar mods debes tener una instancia Forge, NeoForge o Fabric."
      : projectType === "resourcepack"
        ? "Crea una instancia para instalar resource packs."
        : projectType === "shader"
          ? "Crea una instancia para instalar shaders."
          : "Crea una instancia para instalar contenido.";
  const contentKind = CONTENT_KIND_BY_TYPE[projectType];
  const installedProjectIds = useMemo(() => {
    const out = new Set<string>();
    for (const item of installedItems) {
      if (item.project_id) out.add(item.project_id);
    }
    return out;
  }, [installedItems]);
  const installedVersionIds = useMemo(() => {
    const out = new Set<string>();
    for (const item of installedItems) {
      if (item.version_id) out.add(item.version_id);
    }
    return out;
  }, [installedItems]);
  const disabledProjectIds = useMemo(() => {
    const out = new Set<string>();
    for (const item of installedItems) {
      if (!item.enabled && item.project_id) out.add(item.project_id);
    }
    return out;
  }, [installedItems]);
  const showDetailPanel = false;
  const isModpackModalOpen = projectType === "modpack" && !!selectedProject;
  const isModModalOpen = projectType !== "modpack" && source === "modrinth" && !!selectedProject;
  const isCurseModalOpen = projectType === "mod" && source === "curseforge" && !!selectedCurse;
  const gallery = modpackDetails?.gallery ?? [];
  const galleryCount = gallery.length;
  const activeImage = galleryCount > 0 ? gallery[galleryIndex % galleryCount] : null;
  const modpackDescription = modpackDetails?.body ?? "";
  const modpackPreview = useMemo(() => {
    if (!modpackDescription) return "";
    const cleaned = modpackDescription
      .replace(/<[^>]*>/g, " ")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
      .replace(/\[[^\]]+\]\([^)]+\)/g, "$1")
      .replace(/[`*_>#-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned.length <= 600) return cleaned;
    return `${cleaned.slice(0, 600).trim()}…`;
  }, [modpackDescription]);
  const showDescriptionToggle = modpackDescription.length > 600;
  const progressText = progressLabel?.trim() || status;
  const isProjectInstalled = selectedProject ? installedProjectIds.has(selectedProject.project_id) : false;
  const isProjectDisabled = selectedProject ? disabledProjectIds.has(selectedProject.project_id) : false;
  const isVersionInstalled = selectedVersionId ? installedVersionIds.has(selectedVersionId) : false;
  const installLabel = isVersionInstalled
    ? "Instalado"
    : isProjectInstalled
      ? projectType === "datapack"
        ? "Actualizar datapack"
        : `Actualizar ${String(projectTypeLabel).toLowerCase()}`
      : projectType === "datapack"
        ? "Instalar datapack"
        : `Instalar ${String(projectTypeLabel).toLowerCase()}`;
  const isInstallingSelected = Boolean(installingVersionId && selectedVersionId && installingVersionId === selectedVersionId);
  const installCtaText =
    isInstallingSelected
      ? "Instalando..."
      : installLabel;
  const installButtonContent = isInstallingSelected ? (
    <span className="inline-flex items-center justify-center gap-2">
      <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
      {installCtaText}
    </span>
  ) : (
    installCtaText
  );
  const showCurseforgeBanner = source === "curseforge" && curseforgeNeedsKey;
  const modpackButtonContent = isInstallingSelected ? (
    <span className="inline-flex items-center justify-center gap-2">
      <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
      Instalando...
    </span>
  ) : (
    "Instalar modpack"
  );
  const needsWorld = isDatapack;
  const hasWorld = !needsWorld || Boolean(selectedWorldId);
  const installDisabled =
    !selectedVersionId ||
    loading ||
    (needsWorld && (worldsLoading || !hasWorld)) ||
    (!isDatapack && isVersionInstalled);
  const installDisabledReason = !selectedVersionId
    ? "Selecciona una version para instalar."
    : loading
      ? "Espera a que finalice la carga."
      : needsWorld && worldsLoading
        ? "Cargando mundos..."
        : needsWorld && worlds.length === 0
          ? "No hay mundos disponibles."
          : needsWorld && !selectedWorldId
            ? "Selecciona un mundo."
            : !isDatapack && isVersionInstalled
              ? "Esta version ya esta version ya esta instalada."
              : "";
  const datapackImportDisabled =
    !isDatapack ||
    !selectedInstance ||
    worldsLoading ||
    worlds.length === 0 ||
    !selectedWorldId ||
    importingDatapack;
  const datapackImportDisabledReason = !isDatapack
    ? ""
    : !selectedInstance
      ? "Selecciona una instancia."
      : worldsLoading
        ? "Cargando mundos..."
        : worlds.length === 0
          ? "No hay mundos disponibles."
          : !selectedWorldId
            ? "Selecciona un mundo."
            : "";

  const modpackInstallDisabledReason = !selectedVersionId
    ? "Selecciona una version para instalar."
    : loading
      ? "Espera a que finalice la carga."
      : "";
  const showCatalogSkeleton =
    loading &&
    ((source === "modrinth" && results.length === 0) || (source === "curseforge" && curseResults.length === 0));
  const hasNoResults = source === "modrinth" ? results.length === 0 : curseResults.length === 0;
  const showEmptyState = !loading && !showCatalogSkeleton && hasNoResults;
  const emptyTitle =
    source === "curseforge" && !activeQuery.trim()
      ? "Escribe para buscar"
      : activeQuery.trim()
        ? "Sin resultados"
        : "Sin contenido disponible";
  const emptyMessage =
    source === "curseforge" && !activeQuery.trim()
      ? "CurseForge requiere un texto de búsqueda para mostrar resultados."
      : "Prueba otros términos, cambia filtros o revisa la instancia seleccionada.";
  const instanceInfo =
    requiresInstance && selectedInstance
      ? projectType === "mod"
        ? `Loader: ${loader === "forge" ? "Forge" : loader === "neoforge" ? "NeoForge" : "Fabric"} · Versión: ${gameVersion || "todas"}`
        : `Versión: ${gameVersion || "todas"}`
      : "";

  useEffect(() => {
    const stored = localStorage.getItem("launcher_catalog_filters_v1");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed.categories)) {
        setCategories(parsed.categories.filter((c: any) => typeof c === "string"));
      }
      if (parsed.modpackLoader && ["any", "forge", "neoforge", "fabric"].includes(parsed.modpackLoader)) {
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

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        window.clearTimeout(toastTimer.current);
      }
    };
  }, []);

  const showToast = useCallback(
    (payload: {
      message: string;
      kind?: "success" | "info" | "error";
      actionLabel?: string;
      action?:
        | { type: "open-content"; instanceId: string; kind: "mods" | "resourcepacks" | "shaderpacks" }
        | { type: "open-instance"; instanceId: string }
        | { type: "go-instances" }
        | { type: "open-datapacks"; instanceId: string; worldId: string };
    }) => {
      if (toastTimer.current) {
        window.clearTimeout(toastTimer.current);
      }
      setToast({
        message: payload.message,
        kind: payload.kind ?? "info",
        actionLabel: payload.actionLabel,
        action: payload.action,
      });
      toastTimer.current = window.setTimeout(() => setToast(null), 5500);
    },
    []
  );

  const handleToastAction = useCallback(async () => {
    if (!toast?.action) return;
    const action = toast.action;
    if (toastTimer.current) {
      window.clearTimeout(toastTimer.current);
    }
    setToast(null);
    try {
      if (action.type === "open-content") {
        await tauri.openInstanceContentFolder(action.instanceId, action.kind);
      } else if (action.type === "open-instance") {
        await tauri.openInstanceFolder(action.instanceId);
      } else if (action.type === "go-instances") {
        if (onGoInstances) {
          onGoInstances();
        }
      } else if (action.type === "open-datapacks") {
        await tauri.openWorldDatapacksFolder(action.instanceId, action.worldId);
      }
    } catch {
      showToast({ message: "No se pudo abrir la carpeta.", kind: "error" });
    }
  }, [toast, showToast, onGoInstances]);

  useEffect(() => {
    if (source !== "modrinth") return;
    if (activeQuery.trim()) return;
    if (page !== 0) return;
    if (results.length > 0) return;
    const cacheKeyMap: Record<ProjectType, string> = {
      mod: loaderFilter ? `launcher_catalog_prefetch_mods_${loaderFilter}_v1` : "launcher_catalog_prefetch_mods_neoforge_v1",
      modpack: `launcher_catalog_prefetch_modpacks_${modpackLoader}_v1`,
      resourcepack: "launcher_catalog_prefetch_resourcepacks_any_v1",
      datapack: "launcher_catalog_prefetch_datapacks_any_v1",
      shader: "launcher_catalog_prefetch_shaders_any_v1",
    };
    const cacheKey = cacheKeyMap[projectType];
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.hits) || typeof parsed.ts !== "number") return;
      const age = Date.now() - parsed.ts;
      if (age > 15 * 60 * 1000) return;
      setResults(parsed.hits);
      setTotalHits(parsed.total || parsed.hits.length || 0);
    } catch {
      // ignore cache errors
    }
  }, [source, activeQuery, page, results.length, projectType, modpackLoader, loaderFilter]);

  const toggleCategory = (id: string) => {
    setPage(0);
    setCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const clearCategories = () => {
    setPage(0);
    setCategories([]);
  };

  const refreshInstalledItems = useCallback(async () => {
    if (!requiresInstance || !selectedInstance || !contentKind) {
      setInstalledItems([]);
      return;
    }
    try {
      const items = await tauri.listInstanceContent(selectedInstance.id, contentKind);
      setInstalledItems(items);
    } catch {
      setInstalledItems([]);
    }
  }, [requiresInstance, selectedInstance, contentKind]);

  useEffect(() => {
    void refreshInstalledItems();
  }, [refreshInstalledItems]);

  const handleSearch = () => {
    setPage(0);
    setSelectedProject(null);
    setSelectedCurse(null);
    setVersions([]);
    setModpackDetails(null);
    setActiveQuery(query);
  };

  const handleSelectProjectType = (id: ProjectType) => {
    setProjectType(id);
    setPage(0);
  };

  const handleSelectSource = (value: SourceType) => {
    setSource(value);
  };

  const handleToggleCategories = () => {
    setShowCategories((prev) => !prev);
  };

  const handleModpackLoader = (value: ModpackLoaderFilter) => {
    setModpackLoader(value);
    setPage(0);
  };

  const handleIndexChange = (value: "relevance" | "downloads" | "newest" | "updated") => {
    setIndex(value);
    setPage(0);
  };

  const handlePageSizeChange = (value: number) => {
    setPageSize(value);
    setPage(0);
  };

  const handleClearFilters = () => {
    setQuery("");
    setActiveQuery("");
    setPage(0);
    setCategories([]);
  };

  const handleShowPopular = () => {
    setActiveQuery("");
    setPage(0);
  };

  const handlePrevPage = () => {
    setPage((prev) => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setPage((prev) => prev + 1);
  };

  const handleGalleryPrev = () => {
    if (galleryCount <= 0) return;
    setGalleryIndex((prev) => (prev - 1 + galleryCount) % galleryCount);
  };

  const handleGalleryNext = () => {
    if (galleryCount <= 0) return;
    setGalleryIndex((prev) => (prev + 1) % galleryCount);
  };

  const handleGallerySelect = (value: number) => {
    if (galleryCount <= 0) return;
    setGalleryIndex(value);
  };

  const handleShowFullDescription = () => {
    setShowFullDescription(true);
  };

  const handleHideFullDescription = () => {
    setShowFullDescription(false);
  };

  const closeProjectModal = () => {
    setSelectedProject(null);
    setVersions([]);
    setSelectedVersionId("");
    setModpackDetails(null);
  };

  const closeCurseModal = () => {
    setSelectedCurse(null);
  };

  useModalFocus({
    open: isModModalOpen,
    containerRef: modModalRef,
    initialFocusRef: modCloseRef,
    onClose: closeProjectModal,
  });

  useModalFocus({
    open: isCurseModalOpen,
    containerRef: curseModalRef,
    initialFocusRef: curseCloseRef,
    onClose: closeCurseModal,
  });

  useModalFocus({
    open: isModpackModalOpen,
    containerRef: modpackModalRef,
    initialFocusRef: modpackCloseRef,
    onClose: closeProjectModal,
  });

  useEffect(() => {
    if (!isModModalOpen || !isDatapack || !selectedInstance) {
      setWorlds([]);
      setSelectedWorldId("");
      setWorldsError("");
      setWorldsLoading(false);
      return;
    }
    let cancelled = false;
    setWorldsLoading(true);
    setWorldsError("");
    tauri
      .listInstanceWorlds(selectedInstance.id)
      .then((list) => {
        if (cancelled) return;
        setWorlds(list);
        setSelectedWorldId((current) => {
          if (current && list.includes(current)) return current;
          return list[0] || "";
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setWorlds([]);
        setSelectedWorldId("");
        setWorldsError(String(e));
      })
      .finally(() => {
        if (!cancelled) setWorldsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isModModalOpen, isDatapack, selectedInstance?.id]);

  const handleSelectProject = async (project: ModrinthProjectHit) => {
    setSelectedProject(project);
    if (projectType === "modpack") {
      setModpackDetails(null);
    }
    setLoading(true);
    setStatus("Cargando versiones...");
    try {
      const list = await tauri.modrinthListVersions(project.project_id, loaderFilter, gameVersionFilter);
      setVersions(list);
      setSelectedVersionId(list[0]?.id || "");
      setStatus("");
    } catch (e: any) {
      setStatus("Error cargando versiones: " + String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (versionId: string) => {
    if (installingVersionId) return;
    if (projectType === "datapack") {
      if (!selectedInstance) {
        setStatus("Selecciona una instancia para instalar datapacks.");
        return;
      }
      if (!selectedWorldId) {
        if (worldsLoading) {
          setStatus("Cargando mundos...");
        } else if (worlds.length === 0) {
          setStatus("No hay mundos disponibles. Crea uno primero.");
        } else {
          setStatus("Selecciona un mundo para instalar el datapack.");
        }
        return;
      }
      setInstallingVersionId(versionId);
      setLoading(true);
      setStatus("Instalando datapack...");
      try {
        const msg = await tauri.modrinthInstallDatapack(selectedInstance.id, selectedWorldId, versionId);
        setStatus(msg);
        showToast({
          message: "Datapack instalado.",
          kind: "success",
          actionLabel: "Abrir carpeta",
          action: { type: "open-datapacks", instanceId: selectedInstance.id, worldId: selectedWorldId },
        });
      } catch (e: any) {
        setStatus("Error instalando datapack: " + String(e));
        showToast({ message: "No se pudo instalar el datapack.", kind: "error" });
      } finally {
        setLoading(false);
        setInstallingVersionId(null);
      }
      return;
    }
    if (projectType === "modpack") {

      if (!selectedProject) {
        setStatus("Selecciona un modpack primero.");
        return;
      }
      const ok = await onConfirm({
        title: "Instalar modpack",
        message: "Antes de instalar un modpack se recomienda hacer backup. Continuar?",
        confirmLabel: "Instalar",
        cancelLabel: "Cancelar",
      });
      if (!ok) {
        setStatus("Instalación cancelada.");
        return;
      }
      setInstallingVersionId(versionId);
      setLoading(true);
      setStatus("Creando instancia del modpack...");
      try {
        const created = await tauri.modrinthInstallModpackWithBackup(
          versionId,
          selectedProject.title,
          selectedProject.icon_url || undefined,
          true
        );
        if (onRefreshInstances) {
          await onRefreshInstances();
        }
        onSelectInstance(created.id);
        setStatus(`Modpack instalado en la instancia "${created.name}".`);
        showToast({
          message: "Modpack instalado.",
          kind: "success",
          actionLabel: "Abrir carpeta",
          action: { type: "open-instance", instanceId: created.id },
        });
        closeProjectModal();
        if (onGoPlay) {
          onGoPlay();
        } else if (onGoInstances) {
          onGoInstances();
        }
      } catch (e: any) {
        setStatus(
          "Error instalando modpack: " +
            String(e) +
            ". Prueba con otra versión, verifica tu conexión o revisa la carpeta de logs."
        );
        showToast({ message: "No se pudo instalar el modpack.", kind: "error" });
      } finally {
        setLoading(false);
        setInstallingVersionId(null);
      }
      return;
    }
    const instance = selectedInstance;
    if (!instance) {
      setStatus(
        projectType === "mod"
          ? "Selecciona una instancia Forge, NeoForge o Fabric para instalar mods."
          : "Selecciona una instancia para instalar contenido."
      );
      return;
    }
    const verb = projectType === "mod" ? "Instalando" : "Descargando";
    setInstallingVersionId(versionId);
    setLoading(true);
    setStatus(`${verb} ${String(projectTypeLabel).toLowerCase()}...`);
    try {
      const msg = await tauri.modrinthInstallVersion(
        instance.id,
        versionId,
        loader,
        gameVersionFilter,
        projectType
      );
      setStatus(msg);
      await refreshInstalledItems();
      if (contentKind) {
        showToast({
          message: "Instalación completada.",
          kind: "success",
          actionLabel: "Abrir carpeta",
          action: { type: "open-content", instanceId: instance.id, kind: contentKind },
        });
      } else {
        showToast({ message: "Instalación completada.", kind: "success" });
      }
    } catch (e: any) {
      const errorMessage = String(e);
      const available = availableLoaders.map((entry) => entry.toLowerCase());
      const hasFabricCompat = available.includes("fabric") || available.includes("quilt") || available.includes("quilt-loader");
      const isLoaderCompatible =
        !loader || available.length === 0
          ? null
          : loader === "fabric"
            ? hasFabricCompat
            : available.includes(loader);
      let suggestedLoader: string | null = null;
      if (isLoaderCompatible === false) {
        if (hasFabricCompat) suggestedLoader = "Fabric";
        else if (available.includes("neoforge")) suggestedLoader = "NeoForge";
        else if (available.includes("forge")) suggestedLoader = "Forge";
      }
      if (suggestedLoader) {
        const loaderLabelText = loader ? formatLoaderLabel(loader) : "este loader";
        setStatus(`No compatible con ${loaderLabelText}. Cambia a una instancia ${suggestedLoader}.`);
        if (onGoInstances) {
          showToast({
            message: `Cambia a una instancia ${suggestedLoader}.`,
            kind: "error",
            actionLabel: `Cambiar a ${suggestedLoader}`,
            action: { type: "go-instances" },
          });
        } else {
          showToast({ message: `Cambia a una instancia ${suggestedLoader}.`, kind: "error" });
        }
      } else {
        setStatus("Error instalando: " + errorMessage);
        showToast({ message: "No se pudo instalar.", kind: "error" });
      }
    } finally {
      setLoading(false);
      setInstallingVersionId(null);
    }
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
      reader.readAsDataURL(file);
    });

  const handleImportDatapack = async (file: File) => {
    if (!isDatapack) return;
    if (!selectedInstance) {
      setStatus("Selecciona una instancia para importar datapacks.");
      return;
    }
    if (!selectedWorldId) {
      if (worldsLoading) {
        setStatus("Cargando mundos...");
      } else if (worlds.length === 0) {
        setStatus("No hay mundos disponibles. Crea uno primero.");
      } else {
        setStatus("Selecciona un mundo para importar el datapack.");
      }
      return;
    }
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setStatus("Solo se permiten archivos .zip.");
      return;
    }
    setImportingDatapack(true);
    setStatus("Importando datapack...");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const base64 = dataUrl.split(",")[1] || "";
      const msg = await tauri.importDatapackZip(selectedInstance.id, selectedWorldId, file.name, base64);
      setStatus(msg);
      showToast({
        message: "Datapack importado.",
        kind: "success",
        actionLabel: "Abrir carpeta",
        action: { type: "open-datapacks", instanceId: selectedInstance.id, worldId: selectedWorldId },
      });
    } catch (e: any) {
      setStatus("Error importando datapack: " + String(e));
      showToast({ message: "No se pudo importar el datapack.", kind: "error" });
    } finally {
      setImportingDatapack(false);
    }
  };

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
    setInstalledItems([]);
  }, [source, selectedInstance?.id, loader, gameVersion, projectType, modpackLoader]);

  useEffect(() => {
    if (requiresInstance && !selectedInstance) return;
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
          const resp = await tauri.curseforgeSearch(q, pageSize, offset);
          if (cancelled) return;
          setCurseResults(resp.data);
          setSelectedCurse(null);
          setCurseforgeNeedsKey(false);
          setStatus("");
          return;
        }

        const resp = await tauri.modrinthSearch(
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
      } catch (e: any) {
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
    selectedInstance?.id,
    loader,
    gameVersion,
    projectType,
    categories,
    modpackLoader,
    requiresInstance,
    gameVersionFilter,
  ]);

  useEffect(() => {
    if (requiresInstance && !selectedInstance && eligibleInstances.length > 0) {
      onSelectInstance(eligibleInstances[0].id);
    }
  }, [eligibleInstances, selectedInstance, onSelectInstance, requiresInstance]);

  useEffect(() => {
    if (source !== "modrinth") return;
    if (!showDetailPanel) return;
    if (!selectedProject && results.length > 0) {
      void handleSelectProject(results[0]);
    }
  }, [results, selectedProject, source, projectType]);

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
        const info = await tauri.modrinthGetProject(selectedProject.project_id);
        if (!cancelled) setModpackDetails(info);
      } catch (e) {
        if (!cancelled) setModpackDetails(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectType, source, selectedProject]);

  useEffect(() => {
    if (!isModpackModalOpen && !isModModalOpen) return;
    const originalBody = document.body.style.overflow;
    const originalHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalBody;
      document.documentElement.style.overflow = originalHtml;
    };
  }, [isModpackModalOpen, isModModalOpen]);

  useEffect(() => {
    if (!isModpackModalOpen) return;
    setGalleryIndex(0);
  }, [isModpackModalOpen, modpackDetails?.gallery?.length]);

  useEffect(() => {
    if (!isModpackModalOpen) {
      setShowFullDescription(false);
    }
  }, [isModpackModalOpen]);

  useEffect(() => {
    if (!isModpackModalOpen || galleryCount <= 1) return;
    const id = setInterval(() => {
      setGalleryIndex((prev) => (prev + 1) % galleryCount);
    }, 4500);
    return () => clearInterval(id);
  }, [isModpackModalOpen, galleryCount]);

  useEffect(() => {
    if (versions.length === 0) {
      setSelectedVersionId("");
      return;
    }
    if (!versions.find((v) => v.id === selectedVersionId)) {
      setSelectedVersionId(versions[0].id);
    }
  }, [versions, selectedVersionId]);

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
    headerTitle,
    headerSubtitle,
    searchPlaceholder,
    showProjectTabs,
    showSourceToggle,
    requiresInstance,
    eligibleInstances,
    selectedInstance,
    loader,
    projectTypeLabel,
    selectedVersion,
    availableLoaders,
    loaderLabel,
    versionLabel,
    loaderChip,
    versionChip,
    noEligibleInstances,
    gateTitle,
    gateMessage,
    contentKind,
    installedProjectIds,
    installedVersionIds,
    disabledProjectIds,
    showDetailPanel,
    isModpackModalOpen,
    isModModalOpen,
    isCurseModalOpen,
    gallery,
    galleryCount,
    activeImage,
    modpackPreview,
    showDescriptionToggle,
    progressText,
    isProjectInstalled,
    isProjectDisabled,
    isVersionInstalled,
    installButtonContent,
    showCurseforgeBanner,
    modpackButtonContent,
    installDisabled,
    installDisabledReason,
    datapackImportDisabled,
    datapackImportDisabledReason,
    modpackInstallDisabledReason,
    showCatalogSkeleton,
    showEmptyState,
    emptyTitle,
    emptyMessage,
    instanceInfo,
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
