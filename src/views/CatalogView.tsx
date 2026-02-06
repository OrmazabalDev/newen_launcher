import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CurseForgeMod,
  InstanceContentItem,
  InstanceSummary,
  ModrinthProject,
  ModrinthProjectHit,
  ModrinthVersion,
} from "../types";
import { IconChevronDown } from "../icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import * as tauri from "../services/tauri";

const PROJECT_TYPES = [
  { id: "mod", label: "Mods" },
  { id: "resourcepack", label: "Resource Packs" },
  { id: "datapack", label: "Data Packs" },
  { id: "shader", label: "Shaders" },
  { id: "modpack", label: "Modpacks" },
] as const;

type ProjectType = (typeof PROJECT_TYPES)[number]["id"];
type SourceType = "modrinth" | "curseforge";

const CONTENT_KIND_BY_TYPE: Record<ProjectType, "mods" | "resourcepacks" | "shaderpacks" | null> = {
  mod: "mods",
  resourcepack: "resourcepacks",
  shader: "shaderpacks",
  datapack: null,
  modpack: null,
};

const MODPACK_LOADERS = [
  { id: "any", label: "Todos" },
  { id: "forge", label: "Forge" },
  { id: "neoforge", label: "NeoForge" },
  { id: "fabric", label: "Fabric" },
] as const;

type ModpackLoaderFilter = (typeof MODPACK_LOADERS)[number]["id"];

const CATEGORY_OPTIONS = [
  { id: "adventure", label: "Adventure" },
  { id: "cursed", label: "Cursed" },
  { id: "decoration", label: "Decoration" },
  { id: "economy", label: "Economy" },
  { id: "equipment", label: "Equipment" },
  { id: "food", label: "Food" },
  { id: "game-mechanics", label: "Game Mechanics" },
  { id: "library", label: "Library" },
  { id: "magic", label: "Magic" },
  { id: "management", label: "Management" },
  { id: "minigame", label: "Minigame" },
  { id: "mobs", label: "Mobs" },
  { id: "optimization", label: "Optimization" },
  { id: "social", label: "Social" },
  { id: "storage", label: "Storage" },
  { id: "technology", label: "Technology" },
  { id: "transportation", label: "Transportation" },
  { id: "utility", label: "Utility" },
  { id: "worldgen", label: "World Generation" },
] as const;

const MODRINTH_SANITIZE_SCHEMA: any = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    "img",
    "iframe",
    "center",
    "font",
  ],
  attributes: {
    ...defaultSchema.attributes,
    a: [...((defaultSchema.attributes || {}).a || []), "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    iframe: ["src", "width", "height", "allow", "allowfullscreen", "frameborder", "title"],
    font: ["size", "color", "face"],
    span: [...((defaultSchema.attributes || {}).span || [])],
    p: [...((defaultSchema.attributes || {}).p || [])],
    center: [],
  },
};

const formatLoaderLabel = (value?: string) => {
  if (!value) return "Cualquiera";
  const v = value.toLowerCase();
  if (v === "neoforge") return "NeoForge";
  if (v === "forge") return "Forge";
  if (v === "fabric") return "Fabric";
  if (v === "quilt" || v === "quilt-loader") return "Quilt";
  if (v === "snapshot") return "Snapshot";
  if (v === "vanilla") return "Vanilla";
  return value;
};


function extractGameVersion(versionId: string): string {
  if (versionId.includes("-forge-")) {
    return versionId.split("-forge-")[0] || versionId;
  }
  if (versionId.includes("-neoforge-")) {
    return versionId.split("-neoforge-")[0] || versionId;
  }
  if (versionId.startsWith("neoforge-")) {
    const token = versionId.split("-")[1] || "";
    const parts = token.split(".");
    const minor = Number(parts[0] || 0);
    const patch = Number(parts[1] || 0);
    if (minor > 0) {
      return patch > 0 ? `1.${minor}.${patch}` : `1.${minor}`;
    }
  }
  if (versionId.startsWith("fabric-loader-")) {
    const parts = versionId.split("-");
    return parts[parts.length - 1] || versionId;
  }
  return versionId.split("-")[0] || versionId;
}

type CatalogViewProps = {
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
  hiddenProjectTypes?: ProjectType[];
};

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

export function CatalogView({
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
  hiddenProjectTypes = [],
}: CatalogViewProps) {
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
      | { type: "go-instances" };
  } | null>(null);
  const toastTimer = useRef<number | null>(null);
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
    projectType === "modpack" ? "Busca modpacks (ej: Better Minecraft)" : "Busca mods (ej: Sodium, JEI, Journeymap)";
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
    if (projectType === "resourcepack" || projectType === "shader") {
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
  const isModModalOpen =
    projectType !== "modpack" && ((source === "modrinth" && !!selectedProject) || (source === "curseforge" && !!selectedCurse));
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
      ? `Actualizar ${String(projectTypeLabel).toLowerCase()}`
      : `Instalar ${String(projectTypeLabel).toLowerCase()}`;
  const isInstallingSelected = Boolean(installingVersionId && selectedVersionId && installingVersionId === selectedVersionId);
  const installCtaText =
    projectType === "datapack"
      ? "Próximamente"
      : isInstallingSelected
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
  const installDisabled =
    !selectedVersionId ||
    loading ||
    projectType === "datapack" ||
    isVersionInstalled;
  const showCatalogSkeleton =
    loading &&
    ((source === "modrinth" && results.length === 0) || (source === "curseforge" && curseResults.length === 0));

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
        | { type: "go-instances" };
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

  const closeProjectModal = () => {
    setSelectedProject(null);
    setVersions([]);
    setSelectedVersionId("");
    setModpackDetails(null);
  };

  const closeCurseModal = () => {
    setSelectedCurse(null);
  };

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
    if (projectType !== "modpack" && !selectedInstance) {
      setStatus("Selecciona una instancia Forge, NeoForge o Fabric para instalar mods.");
      return;
    }
    if (projectType === "datapack") {
      setStatus("Los Data Packs requieren elegir un mundo. Próximamente.");
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
    const verb = projectType === "mod" || projectType === "modpack" ? "Instalando" : "Descargando";
    setInstallingVersionId(versionId);
    setLoading(true);
    setStatus(`${verb} ${String(projectTypeLabel).toLowerCase()}...`);
    try {
      const msg = await tauri.modrinthInstallVersion(
        selectedInstance.id,
        versionId,
        loader,
        gameVersionFilter,
        projectType
      );
      setStatus(msg);
      await refreshInstalledItems();
      if (selectedInstance && contentKind) {
        showToast({
          message: "Instalación completada.",
          kind: "success",
          actionLabel: "Abrir carpeta",
          action: { type: "open-content", instanceId: selectedInstance.id, kind: contentKind },
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

  if (noEligibleInstances) {
    return (
      <div className="absolute inset-0 z-20 bg-gray-950 flex flex-col items-center justify-center p-8 overflow-hidden animate-fadeIn text-center">
        <div className="max-w-lg bg-gray-900/70 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white mb-3">{headerTitle}</h2>
          <div className="text-lg font-bold text-white mb-2">{gateTitle}</div>
          <p className="text-gray-300 text-sm">{gateMessage}</p>
          {onGoInstances && (
            <button
              onClick={onGoInstances}
              type="button"
              className="mt-5 px-4 py-2 rounded-xl bg-brand-accent hover:bg-brand-accent-deep text-white font-bold"
            >
              Ir a instancias
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="absolute inset-0 z-20 bg-gray-950 flex flex-col p-8 overflow-hidden animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-white">{headerTitle}</h2>
          <p className="text-gray-300 text-sm">{headerSubtitle}</p>
        </div>
        {requiresInstance ? (
          <div className="min-w-[260px]">
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">Instancia</label>
            <div className="relative">
              <select
                className="w-full appearance-none bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-brand-accent"
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
          <div className="text-xs text-gray-400 bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-2">
            Al instalar un modpack se creará una instancia nueva automáticamente.
          </div>
        )}
      </div>

      {source === "modrinth" && showProjectTabs && (
        <div className="flex flex-wrap gap-2 mb-4">
          {PROJECT_TYPES.filter((type) => !hiddenProjectTypes.includes(type.id)).map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => {
                setProjectType(type.id);
                setPage(0);
              }}
              className={`px-4 py-2 rounded-full text-xs font-bold border ${
                projectType === type.id
                  ? "bg-brand-accent text-white border-brand-accent/70"
                  : "bg-gray-900 text-gray-300 border-gray-700"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-4 mb-5 items-center">
        {showSourceToggle && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSource("modrinth")}
              type="button"
              className={`px-3 py-2 rounded-xl text-xs font-bold ${
                source === "modrinth" ? "bg-brand-accent text-white" : "bg-gray-900 text-gray-300 border border-gray-700"
              }`}
            >
              Modrinth
            </button>
            <button
              onClick={() => setSource("curseforge")}
              type="button"
              className={`px-3 py-2 rounded-xl text-xs font-bold ${
                source === "curseforge" ? "bg-brand-accent text-white" : "bg-gray-900 text-gray-300 border border-gray-700"
              }`}
            >
              CurseForge
            </button>
          </div>
        )}
        {source === "modrinth" && projectType === "mod" && (
          <button
            type="button"
            onClick={() => setShowCategories((prev) => !prev)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border ${
              showCategories
                ? "bg-brand-accent text-white border-brand-accent/70"
                : "bg-gray-900 text-gray-300 border-gray-700"
            }`}
          >
            Categorías {categories.length > 0 ? `(${categories.length})` : ""}
          </button>
        )}
        {source === "modrinth" && projectType === "modpack" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Loader</span>
            {MODPACK_LOADERS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setModpackLoader(opt.id);
                  setPage(0);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold border ${
                  modpackLoader === opt.id
                    ? "bg-brand-accent text-white border-brand-accent/70"
                    : "bg-gray-900 text-gray-300 border-gray-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">Orden</label>
          <select
            className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white"
            value={index}
            onChange={(e) => {
              setIndex(e.target.value as any);
              setPage(0);
            }}
            disabled={source !== "modrinth"}
          >
            <option value="downloads">Más descargados</option>
            <option value="relevance">Relevancia</option>
            <option value="newest">Más nuevos</option>
            <option value="updated">Actualizados</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">Resultados</label>
          <select
            className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
          >
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={48}>48</option>
          </select>
        </div>
        {requiresInstance && selectedInstance && (
          <div className="text-xs text-gray-400">
            {projectType === "mod"
              ? `Loader: ${loader === "forge" ? "Forge" : loader === "neoforge" ? "NeoForge" : "Fabric"} · Versión: ${gameVersion || "todas"}`
              : `Versión: ${gameVersion || "todas"}`}
          </div>
        )}
        <input
          className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white outline-none focus:border-brand-accent"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
        />
        <button
          onClick={handleSearch}
          type="button"
          className="px-6 py-3 rounded-xl bg-brand-info hover:bg-brand-info/90 text-white font-bold"
          disabled={loading}
        >
          Buscar
        </button>
      </div>

      {showCurseforgeBanner && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
          <span className="uppercase tracking-widest font-bold text-amber-200">CurseForge</span>
          <span>Solo búsqueda. Agrega CURSEFORGE_API_KEY para habilitar instalación.</span>
        </div>
      )}

      {status && (
        <div className="text-sm text-gray-200 bg-gray-900/70 border border-gray-800 rounded-xl px-4 py-2 mb-4">
          {status}
        </div>
      )}

      <div className={`flex-1 grid grid-cols-1 gap-4 overflow-hidden ${showDetailPanel ? "lg:grid-cols-[1.2fr_1fr]" : ""}`}>
        <div className="overflow-y-auto pr-2 custom-scrollbar">
          {source === "modrinth" && projectType === "mod" && showCategories && (
            <div className="mb-4 bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold text-white">Categorías</div>
                {categories.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCategories}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    Limpiar
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {CATEGORY_OPTIONS.map((cat) => {
                  const active = categories.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border text-left ${
                        active
                          ? "bg-brand-accent text-white border-brand-accent"
                          : "bg-gray-900 text-gray-300 border-gray-800 hover:border-gray-600"
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {showCatalogSkeleton &&
              Array.from({ length: 8 }).map((_, idx) => (
                <div
                  key={`catalog-skeleton-${idx}`}
                  className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 animate-pulse"
                >
                  <div className="flex gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gray-800" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-800 rounded w-3/4" />
                      <div className="h-3 bg-gray-800 rounded w-full" />
                      <div className="h-3 bg-gray-800 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            {source === "modrinth" &&
              results.map((hit) => {
                const isInstalled = installedProjectIds.has(hit.project_id);
                const isDisabled = disabledProjectIds.has(hit.project_id);
                return (
                <button
                  key={hit.project_id}
                  onClick={() => handleSelectProject(hit)}
                  type="button"
                  className={`text-left rounded-2xl border p-4 bg-gray-900/70 hover:bg-gray-900 transition ${
                    selectedProject?.project_id === hit.project_id ? "border-brand-accent/70" : "border-gray-800"
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gray-800 overflow-hidden">
                      {hit.icon_url ? (
                        <img src={hit.icon_url} alt={hit.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold">
                          {hit.title.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-white">{hit.title}</div>
                        {isInstalled && (
                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                              isDisabled
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            }`}
                          >
                            {isDisabled ? "Desactivado" : "Instalado"}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 line-clamp-2">{hit.description}</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-gray-300">
                        {projectType === "mod" && (
                          <span className="px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700">
                            Loader: {loaderChip}
                          </span>
                        )}
                        {projectType !== "modpack" && (
                          <span className="px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700">
                            {versionChip}
                          </span>
                        )}
                        {projectType === "modpack" && (
                          <>
                            <span className="px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700">
                              Loader: {loaderChip}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700">
                              {versionChip}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-2">
                        {hit.downloads.toLocaleString()} descargas
                      </div>
                    </div>
                  </div>
                </button>
              )})}

            {source === "curseforge" &&
              curseResults.map((hit) => (
                <button
                  key={hit.id}
                  onClick={() => setSelectedCurse(hit)}
                  type="button"
                  className={`text-left rounded-2xl border p-4 bg-gray-900/70 hover:bg-gray-900 transition ${
                    selectedCurse?.id === hit.id ? "border-brand-accent/70" : "border-gray-800"
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gray-800 overflow-hidden">
                      {hit.logo?.thumbnail_url ? (
                        <img src={hit.logo.thumbnail_url} alt={hit.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold">
                          {hit.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-white">{hit.name}</div>
                      <div className="text-xs text-gray-400 line-clamp-2">{hit.summary}</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-gray-300">
                        {projectType === "mod" && (
                          <span className="px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700">
                            Loader: {loaderChip}
                          </span>
                        )}
                        {projectType !== "modpack" && (
                          <span className="px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700">
                            {versionChip}
                          </span>
                        )}
                        {projectType === "modpack" && (
                          <>
                            <span className="px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700">
                              Loader: {loaderChip}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700">
                              {versionChip}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-2">
                        {Math.round(hit.download_count).toLocaleString()} descargas
                      </div>
                    </div>
                  </div>
                </button>
              ))}
          </div>
          {source === "modrinth" && totalHits > 0 && (
            <div className="flex items-center justify-between mt-4 text-xs text-gray-400">
              <span>
                Página {page + 1} de {Math.max(1, Math.ceil(totalHits / pageSize))}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-gray-300 disabled:opacity-50"
                  disabled={page === 0 || loading}
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-gray-300 disabled:opacity-50"
                  disabled={loading || (page + 1) * pageSize >= totalHits}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>

        {showDetailPanel && (
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 overflow-y-auto custom-scrollbar">
          {source === "modrinth" && selectedProject ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-gray-800 overflow-hidden">
                  {selectedProject.icon_url ? (
                    <img
                      src={selectedProject.icon_url}
                      alt={selectedProject.title}
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>
                <div>
                  <div className="text-lg font-bold text-white">{selectedProject.title}</div>
                  <div className="text-xs text-gray-400">{selectedProject.description}</div>
                </div>
              </div>

              <div className="text-xs text-gray-400 mb-3">
                Tipo: {projectTypeLabel} · Versiones compatibles: {versionLabel}
                {projectType === "mod" ? ` · Loader: ${loader || "cualquiera"}` : ""}
              </div>
              {projectType === "modpack" && selectedVersion && (
                <div className="text-xs mb-3 text-brand-accent">
                  Loader requerido: {loaderLabel}
                </div>
              )}

              <div className="space-y-3">
                {versions.length === 0 && <div className="text-gray-500 text-sm">Sin versiones encontradas.</div>}
                {versions.length > 0 && (
                  <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-3 space-y-3">
                    <div>
                      <label className="block text-[11px] uppercase tracking-widest text-gray-400 mb-2">
                        Versión disponible
                      </label>
                      <div className="relative">
                        <select
                          className="w-full appearance-none bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-brand-accent"
                          value={selectedVersionId}
                          onChange={(e) => setSelectedVersionId(e.target.value)}
                        >
                          {versions.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} · {v.version_number}
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                          <IconChevronDown />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => selectedVersionId && handleInstall(selectedVersionId)}
                      type="button"
                      className="w-full px-4 py-2.5 rounded-xl bg-brand-accent hover:bg-brand-accent-deep text-white text-sm font-bold disabled:opacity-60"
                      disabled={installDisabled}
                    >
                      {installButtonContent}
                    </button>
                    {projectType !== "datapack" && isProjectInstalled && (
                      <div className={`text-[11px] ${isProjectDisabled ? "text-amber-300" : "text-emerald-300"}`}>
                        {isVersionInstalled
                          ? "Ya instalado en esta instancia."
                          : isProjectDisabled
                            ? "Instalado pero desactivado."
                            : "Instalado con otra versión."}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : source === "curseforge" && selectedCurse ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gray-800 overflow-hidden">
                  {selectedCurse.logo?.thumbnail_url ? (
                    <img
                      src={selectedCurse.logo.thumbnail_url}
                      alt={selectedCurse.name}
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>
                <div>
                  <div className="text-lg font-bold text-white">{selectedCurse.name}</div>
                  <div className="text-xs text-gray-400">{selectedCurse.summary}</div>
                </div>
              </div>
              <div className="text-sm text-gray-300 bg-gray-950/60 border border-gray-800 rounded-xl p-3">
                Integración de CurseForge: búsqueda disponible. Instalación y dependencias se implementarán con API key.
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-sm">
              {projectType === "modpack" ? "Selecciona un modpack para ver detalles." : "Selecciona un mod para ver detalles."}
            </div>
          )}
          </div>
        )}
      </div>
    </div>

      {toast && (
        <div
          className={`fixed right-6 bottom-6 z-[60] rounded-xl border px-4 py-3 text-sm shadow-lg flex items-center gap-3 ${
            toast.kind === "success"
              ? "bg-emerald-900/80 border-emerald-700 text-emerald-100"
              : toast.kind === "error"
                ? "bg-red-900/80 border-red-700 text-red-100"
                : "bg-gray-900/80 border-gray-700 text-gray-100"
          }`}
        >
          <div className="flex-1">{toast.message}</div>
          {toast.actionLabel && toast.action && (
            <button
              type="button"
              onClick={handleToastAction}
              className="px-3 py-1 rounded-full border border-white/20 text-xs font-semibold hover:bg-white/10"
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}

      {projectType !== "modpack" && source === "modrinth" && selectedProject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/90 backdrop-blur-sm p-6 overscroll-contain"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeProjectModal();
            }
          }}
        >
          <div className="w-full max-w-3xl bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gray-800 overflow-hidden">
                  {selectedProject.icon_url ? (
                    <img src={selectedProject.icon_url} alt={selectedProject.title} className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div>
                  <div className="text-lg font-bold text-white">{selectedProject.title}</div>
                  <div className="text-xs text-gray-400">{selectedProject.description}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={closeProjectModal}
                className="text-gray-400 hover:text-white"
                aria-label="Cerrar"
              >
                X
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6 p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-3">
                <div className="text-xs text-gray-400">
                  Tipo: {projectTypeLabel} · Versiones compatibles: {versionLabel}
                  {projectType === "mod" ? ` · Loader: ${loader || "cualquiera"}` : ""}
                </div>
                {projectType === "mod" && selectedVersion && availableLoaders.length > 0 && loaderLabel !== "Cualquiera" && (
                  <div className="text-xs text-brand-accent">Loader requerido: {loaderLabel}</div>
                )}
                <div className="text-sm text-gray-300">
                  {selectedProject.description}
                </div>
              </div>

                <div className="space-y-3">
                  {versions.length === 0 && <div className="text-gray-500 text-sm">Sin versiones encontradas.</div>}
                  {versions.length > 0 && (
                    <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-4 space-y-3">
                    <label className="block text-[11px] uppercase tracking-widest text-gray-400">
                      Versión disponible
                    </label>
                    <div className="relative">
                      <select
                        className="w-full appearance-none bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-brand-accent"
                        value={selectedVersionId}
                        onChange={(e) => setSelectedVersionId(e.target.value)}
                      >
                        {versions.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} - {v.version_number}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                        <IconChevronDown />
                      </div>
                    </div>

                    <button
                      onClick={() => selectedVersionId && handleInstall(selectedVersionId)}
                      type="button"
                      className="w-full px-4 py-2.5 rounded-xl bg-brand-accent hover:bg-brand-accent-deep text-white text-sm font-bold disabled:opacity-60"
                      disabled={installDisabled}
                    >
                      {installButtonContent}
                    </button>
                    {projectType !== "datapack" && isProjectInstalled && (
                      <div className={`text-[11px] ${isProjectDisabled ? "text-amber-300" : "text-emerald-300"}`}>
                        {isVersionInstalled
                          ? "Ya instalado en esta instancia."
                          : isProjectDisabled
                            ? "Instalado pero desactivado."
                            : "Instalado con otra versión."}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {projectType === "mod" && source === "curseforge" && selectedCurse && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/90 backdrop-blur-sm p-6 overscroll-contain"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeCurseModal();
            }
          }}
        >
          <div className="w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gray-800 overflow-hidden">
                  {selectedCurse.logo?.thumbnail_url ? (
                    <img src={selectedCurse.logo.thumbnail_url} alt={selectedCurse.name} className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div>
                  <div className="text-lg font-bold text-white">{selectedCurse.name}</div>
                  <div className="text-xs text-gray-400">{selectedCurse.summary}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={closeCurseModal}
                className="text-gray-400 hover:text-white"
                aria-label="Cerrar"
              >
                X
              </button>
            </div>
            <div className="p-6">
              <div className="text-sm text-gray-300 bg-gray-950/60 border border-gray-800 rounded-xl p-4">
                Integración de CurseForge: búsqueda disponible. Instalación y dependencias se implementarán con API key.
              </div>
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-800 text-gray-400 text-sm font-bold cursor-not-allowed"
                >
                  Instalación no disponible
                </button>
                {showCurseforgeBanner && (
                  <div className="text-xs text-amber-300">
                    Agrega CURSEFORGE_API_KEY para habilitar instalación.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {projectType === "modpack" && selectedProject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/90 backdrop-blur-sm p-6 overscroll-contain"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeProjectModal();
            }
          }}
        >
          <div className="w-full max-w-4xl bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gray-800 overflow-hidden">
                  {selectedProject.icon_url ? (
                    <img src={selectedProject.icon_url} alt={selectedProject.title} className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div>
                  <div className="text-lg font-bold text-white">{selectedProject.title}</div>
                  <div className="text-xs text-gray-400">{selectedProject.description}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={closeProjectModal}
                className="text-gray-400 hover:text-white"
                aria-label="Cerrar"
              >
                X
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.9fr] gap-6 p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <div className="text-xs text-gray-400">
                  Tipo: {projectTypeLabel} - Versiones compatibles: {versionLabel}
                </div>

                {activeImage && (
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-widest mb-2">Galeria</div>
                    <div className="relative rounded-2xl overflow-hidden border border-gray-800 bg-gray-950">
                      <img
                        src={activeImage.url}
                        alt={activeImage.title || selectedProject.title}
                        className="w-full h-56 object-cover"
                      />
                      {galleryCount > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setGalleryIndex((prev) => (prev - 1 + galleryCount) % galleryCount)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-gray-950/70 text-white flex items-center justify-center hover:bg-gray-950/90"
                            aria-label="Anterior"
                          >
                            <span className="text-lg">&lt;</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setGalleryIndex((prev) => (prev + 1) % galleryCount)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-gray-950/70 text-white flex items-center justify-center hover:bg-gray-950/90"
                            aria-label="Siguiente"
                          >
                            <span className="text-lg">&gt;</span>
                          </button>
                          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                            {gallery.map((_, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setGalleryIndex(idx)}
                                className={`w-2.5 h-2.5 rounded-full ${idx === (galleryIndex % galleryCount) ? "bg-white" : "bg-white/40"}`}
                                aria-label={`Ir a imagen ${idx + 1}`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    {(activeImage.title || activeImage.description) && (
                      <div className="text-xs text-gray-400 mt-2">
                        {activeImage.title || activeImage.description}
                      </div>
                    )}
                  </div>
                )}

                {modpackDetails?.body && (
                  <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-4">
                    {!showFullDescription ? (
                      <>
                        <div className="text-sm text-gray-200 leading-relaxed">{modpackPreview}</div>
                        {showDescriptionToggle && (
                          <button
                            type="button"
                            onClick={() => setShowFullDescription(true)}
                            className="mt-3 text-xs font-bold text-brand-info hover:text-brand-accent"
                          >
                            Ver descripción completa
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw, [rehypeSanitize, MODRINTH_SANITIZE_SCHEMA]]}
                          components={{
                            h1: ({node, ...props}) => <h3 className="text-lg font-bold text-white mt-4 mb-2" {...props} />,
                            h2: ({node, ...props}) => <h4 className="text-base font-bold text-white mt-4 mb-2" {...props} />,
                            h3: ({node, ...props}) => <h5 className="text-sm font-bold text-white mt-3 mb-2" {...props} />,
                            p: ({node, ...props}) => <div className="text-sm text-gray-200 leading-relaxed mb-3" {...props} />,
                            li: ({node, ...props}) => <li className="text-sm text-gray-200 list-disc ml-5 mb-1" {...props} />,
                            a: ({node, ...props}) => (
                              <a className="text-brand-info underline" target="_blank" rel="noreferrer" {...props} />
                            ),
                            center: ({node, ...props}) => <div className="text-center" {...props} />,
                            img: ({node, className, style, width, height, ...props}) => (
                              <div className="w-full flex justify-center my-3">
                                <img
                                  {...props}
                                  className="rounded-lg border border-gray-800 w-full max-w-[560px] max-h-72 object-contain"
                                  style={{ maxHeight: 288, height: "auto" }}
                                />
                              </div>
                            ),
                            iframe: ({node, className, style, width, height, ...props}) => (
                              <div className="w-full max-w-[720px] mx-auto aspect-video overflow-hidden rounded-lg border border-gray-800 my-3 bg-gray-950">
                                <iframe {...props} className="w-full h-full" allowFullScreen />
                              </div>
                            ),
                            blockquote: ({node, ...props}) => (
                              <blockquote className="border-l-2 border-gray-700 pl-3 text-gray-300 italic mb-3" {...props} />
                            ),
                            code: ({node, ...props}) => (
                              <code className="text-xs bg-gray-800 px-1 py-0.5 rounded" {...props} />
                            ),
                          }}
                        >
                          {modpackDetails.body}
                        </ReactMarkdown>
                        <button
                          type="button"
                          onClick={() => setShowFullDescription(false)}
                          className="mt-2 text-xs font-bold text-gray-400 hover:text-white"
                        >
                          Ver menos
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {versions.length === 0 && <div className="text-gray-500 text-sm">Sin versiones encontradas.</div>}
                {versions.length > 0 && (
                  <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-4 space-y-3">
                    <label className="block text-[11px] uppercase tracking-widest text-gray-400">
                      Versión disponible
                    </label>
                    <div className="relative">
                      <select
                        className="w-full appearance-none bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-brand-accent"
                        value={selectedVersionId}
                        onChange={(e) => setSelectedVersionId(e.target.value)}
                      >
                        {versions.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} - {v.version_number}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                        <IconChevronDown />
                      </div>
                    </div>

                    {selectedVersion && (
                      <div className="text-xs text-brand-accent">
                        Loader requerido: {loaderLabel}
                      </div>
                    )}

                    <button
                      onClick={() => selectedVersionId && handleInstall(selectedVersionId)}
                      type="button"
                      className="w-full px-4 py-2.5 rounded-xl bg-brand-accent hover:bg-brand-accent-deep text-white text-sm font-bold disabled:opacity-60"
                      disabled={!selectedVersionId || loading}
                    >
                      {modpackButtonContent}
                    </button>
                    {loading && (
                      <div className="text-xs text-gray-400">{progressText || "Instalando modpack..."}</div>
                    )}
                  </div>
                )}

                <div className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                  Backup recomendado: se crea una copia automática del modpack instalado (se guardan hasta 5).
                </div>

                <div className="text-xs text-gray-400">
                  Al instalar se creará una instancia nueva automáticamente.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
