import type {
  CurseForgeSearchResponse,
  InstanceSummary,
  ModrinthProject,
  ModrinthSearchResponse,
  ModrinthVersion,
} from "../../types";
import { invokeTyped } from "./core";

export function modrinthSearch(
  query: string,
  limit = 20,
  offset = 0,
  loader?: string,
  gameVersion?: string,
  index = "downloads",
  projectType = "mod",
  categories?: string[]
): Promise<ModrinthSearchResponse> {
  return invokeTyped("modrinth_search", {
    query,
    limit,
    offset,
    loader,
    gameVersion,
    index,
    projectType,
    categories,
  });
}

export function modrinthListVersions(
  projectId: string,
  loader?: string,
  gameVersion?: string
): Promise<ModrinthVersion[]> {
  return invokeTyped("modrinth_list_versions", { projectId, loader, gameVersion });
}

export function modrinthGetProject(projectId: string): Promise<ModrinthProject> {
  return invokeTyped("modrinth_get_project", { projectId });
}

export function modrinthInstallVersion(
  instanceId: string,
  versionId: string,
  loader?: string,
  gameVersion?: string,
  projectType?: string
): Promise<string> {
  return invokeTyped("modrinth_install_version", {
    instanceId,
    versionId,
    loader,
    gameVersion,
    projectType,
  });
}

export function modrinthInstallModpack(
  versionId: string,
  name: string,
  thumbnail: string
): Promise<InstanceSummary> {
  return invokeTyped("modrinth_install_modpack", { versionId, name, thumbnail });
}

export function modrinthInstallModpackWithBackup(
  versionId: string,
  name: string,
  thumbnail: string | undefined,
  backup: boolean
): Promise<InstanceSummary> {
  return invokeTyped("modrinth_install_modpack_with_backup", {
    versionId,
    name,
    thumbnail,
    backup,
  });
}

export function importModpackMrpack(
  name: string | undefined,
  fileName: string,
  dataBase64: string
): Promise<InstanceSummary> {
  return invokeTyped("import_modpack_mrpack", { name, fileName, dataBase64 });
}

export function exportModpackMrpack(instanceId: string, destPath: string): Promise<string> {
  return invokeTyped("export_modpack_mrpack", { instanceId, destPath });
}

export function modrinthInstallDatapack(
  instanceId: string,
  worldId: string,
  versionId: string
): Promise<string> {
  return invokeTyped("modrinth_install_datapack", { instanceId, worldId, versionId });
}

export function applyOptimizationPack(
  instanceId: string,
  loader: string,
  gameVersion: string,
  preset?: string
): Promise<string> {
  return invokeTyped("apply_optimization_pack", {
    instanceId,
    loader,
    gameVersion,
    preset,
  });
}

export function rollbackOptimization(instanceId: string): Promise<string> {
  return invokeTyped("rollback_optimization", { instanceId });
}

export function curseforgeSearch(
  query: string,
  pageSize = 20,
  index = 0
): Promise<CurseForgeSearchResponse> {
  return invokeTyped("curseforge_search", { query, pageSize, index });
}

export function installForge(versionId: string): Promise<string> {
  return invokeTyped("install_forge", { versionId });
}

export function installFabric(versionId: string): Promise<string> {
  return invokeTyped("install_fabric", { versionId });
}

export function installNeoForge(versionId: string): Promise<string> {
  return invokeTyped("install_neoforge", { versionId });
}

export function listInstanceWorlds(instanceId: string): Promise<string[]> {
  return invokeTyped("list_instance_worlds", { instanceId });
}

export function openWorldDatapacksFolder(instanceId: string, worldId: string): Promise<void> {
  return invokeTyped("open_world_datapacks_folder", { instanceId, worldId });
}

export function importDatapackZip(
  instanceId: string,
  worldId: string,
  fileName: string,
  dataBase64: string
): Promise<string> {
  return invokeTyped("import_datapack_zip", { instanceId, worldId, fileName, dataBase64 });
}
