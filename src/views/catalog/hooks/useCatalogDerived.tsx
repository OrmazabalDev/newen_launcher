import { useMemo } from "react";
import type {
  CurseForgeMod,
  InstanceContentItem,
  InstanceSummary,
  ModrinthProject,
  ModrinthProjectHit,
  ModrinthVersion,
} from "../../../types";
import type { ModpackLoaderFilter, ProjectType, SourceType } from "../constants";
import { formatLoaderLabel } from "../utils";

type CatalogDerivedArgs = {
  title?: string;
  subtitle?: string;
  projectType: ProjectType;
  projectTypeLabel: string;
  source: SourceType;
  activeQuery: string;
  progressLabel?: string;
  status: string;
  loading: boolean;
  results: ModrinthProjectHit[];
  curseResults: CurseForgeMod[];
  selectedProject: ModrinthProjectHit | null;
  modpackDetails: ModrinthProject | null;
  versions: ModrinthVersion[];
  selectedVersionId: string;
  installedItems: InstanceContentItem[];
  requiresInstance: boolean;
  eligibleInstances: InstanceSummary[];
  selectedInstance: InstanceSummary | null;
  loader?: string;
  gameVersion?: string;
  modpackLoader: ModpackLoaderFilter;
  isDatapack: boolean;
  installingVersionId: string | null;
  worlds: string[];
  worldsLoading: boolean;
  selectedWorldId: string;
  importingDatapack: boolean;
  curseforgeNeedsKey: boolean;
};

export function useCatalogDerived({
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
}: CatalogDerivedArgs) {
  const headerTitle = title ?? "Catálogo de contenido";
  const headerSubtitle =
    subtitle ??
    "Explora Modrinth por tipo, categoría y versión. Puedes instalar mods, modpacks, resource packs y shaders.";
  const searchPlaceholder =
    projectType === "modpack"
      ? "Busca modpacks (ej: Better Minecraft)"
      : projectType === "datapack"
        ? "Busca datapacks (ej: Terralith, Vanilla Tweaks)"
        : "Busca mods (ej: Sodium, JEI, Journeymap)";

  const selectedVersion = versions.find((v) => v.id === selectedVersionId) || null;
  const selectedGameVersion = selectedVersion?.game_versions?.[0];
  const availableLoaders = Array.isArray(selectedVersion?.loaders) ? selectedVersion!.loaders : [];
  const requiresForge = availableLoaders.includes("forge");
  const requiresNeoForge = availableLoaders.includes("neoforge");
  const requiresFabric =
    availableLoaders.includes("fabric") ||
    availableLoaders.includes("quilt") ||
    availableLoaders.includes("quilt-loader");
  const requiredLabels = [
    requiresForge ? "Forge" : null,
    requiresNeoForge ? "NeoForge" : null,
    requiresFabric ? "Fabric" : null,
  ].filter((v): v is string => !!v);
  const loaderLabel = requiredLabels.length > 0 ? requiredLabels.join(" / ") : "Cualquiera";
  const versionLabel =
    projectType === "modpack" ? selectedGameVersion || "varias" : gameVersion || "todas";
  const loaderChip =
    projectType === "modpack" ? formatLoaderLabel(modpackLoader) : formatLoaderLabel(loader);
  const versionChip =
    projectType === "modpack" ? "Versiones: varias" : `Versión: ${gameVersion || "todas"}`;
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

  const gallery = modpackDetails?.gallery ?? [];
  const galleryCount = gallery.length;
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
    return `${cleaned.slice(0, 600).trim()}...`;
  }, [modpackDescription]);
  const showDescriptionToggle = modpackDescription.length > 600;
  const progressText = progressLabel?.trim() || status;

  const isProjectInstalled = selectedProject
    ? installedProjectIds.has(selectedProject.project_id)
    : false;
  const isProjectDisabled = selectedProject
    ? disabledProjectIds.has(selectedProject.project_id)
    : false;
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
  const isInstallingSelected = Boolean(
    installingVersionId && selectedVersionId && installingVersionId === selectedVersionId
  );
  const installCtaText = isInstallingSelected ? "Instalando..." : installLabel;
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
    ? "Selecciona una versión para instalar."
    : loading
      ? "Espera a que finalice la carga."
      : needsWorld && worldsLoading
        ? "Cargando mundos..."
        : needsWorld && worlds.length === 0
          ? "No hay mundos disponibles."
          : needsWorld && !selectedWorldId
            ? "Selecciona un mundo."
            : !isDatapack && isVersionInstalled
              ? "Esta versión ya está instalada."
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
    ? "Selecciona una versión para instalar."
    : loading
      ? "Espera a que finalice la carga."
      : "";
  const showCatalogSkeleton =
    loading &&
    ((source === "modrinth" && results.length === 0) ||
      (source === "curseforge" && curseResults.length === 0));
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

  return {
    headerTitle,
    headerSubtitle,
    searchPlaceholder,
    selectedVersion,
    availableLoaders,
    loaderLabel,
    versionLabel,
    loaderChip,
    versionChip,
    noEligibleInstances,
    gateTitle,
    gateMessage,
    installedProjectIds,
    installedVersionIds,
    disabledProjectIds,
    gallery,
    galleryCount,
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
  };
}
