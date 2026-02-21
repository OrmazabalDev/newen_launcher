import { invoke } from "@tauri-apps/api/core";
import type {
  GameSettings,
  SystemJava,
  InstanceSummary,
  LoaderType,
  ModrinthSearchResponse,
  ModrinthVersion,
  CurseForgeSearchResponse,
  ModrinthProject,
  SkinInfo,
  InstanceContentItem,
  InstanceLogEntry,
  RuntimeMetrics,
} from "../types";

export async function detectSystemJava(): Promise<SystemJava> {
  return await invoke("detect_system_java");
}

export async function getInstalledVersions(): Promise<string[]> {
  return await invoke("get_installed_versions");
}

export async function getVersions(): Promise<string[]> {
  return await invoke("get_versions");
}

export async function getVersionMetadata(versionId: string): Promise<void> {
  await invoke("get_version_metadata", { versionId });
}

export async function downloadClient(versionId: string): Promise<void> {
  await invoke("download_client", { versionId });
}

export async function downloadGameFiles(versionId: string): Promise<void> {
  await invoke("download_game_files", { versionId });
}

export async function downloadJava(versionId?: string): Promise<void> {
  await invoke("download_java", { versionId });
}

export async function clearCache(): Promise<string> {
  return await invoke("clear_cache");
}

export async function closeSplash(): Promise<void> {
  await invoke("close_splash");
}

export async function repairInstance(instanceId: string): Promise<string> {
  return await invoke("repair_instance", { instanceId });
}

export async function generateDiagnosticReport(): Promise<string> {
  return await invoke("generate_diagnostic_report");
}

export async function uploadDiagnosticReport(
  reportPath?: string,
  instanceId?: string
): Promise<string> {
  return await invoke("upload_diagnostic_report", { reportPath, instanceId });
}

export async function launchGame(
  versionId: string,
  settings: GameSettings,
  instanceId?: string
): Promise<void> {
  await invoke("launch_game", { versionId, settings, instanceId });
}

export async function loginOffline(username: string): Promise<string> {
  return await invoke("login_offline", { username });
}

export async function startMsLogin(): Promise<{ user_code: string; device_code: string; verification_uri: string; message?: string; interval?: number }> {
  return await invoke("start_ms_login");
}

export async function pollMsLogin(deviceCode: string): Promise<string> {
  return await invoke("poll_ms_login", { device_code: deviceCode });
}

export async function restoreMsSession(): Promise<string> {
  return await invoke("restore_ms_session");
}

export async function logoutSession(): Promise<void> {
  await invoke("logout_session");
}

export async function refreshMsProfile(): Promise<string> {
  return await invoke("refresh_ms_profile");
}

export async function deleteVersion(versionId: string): Promise<void> {
  await invoke("delete_version", { versionId });
}


export async function listInstances(): Promise<InstanceSummary[]> {
  return await invoke("list_instances");
}

export async function createInstance(req: {
  name: string;
  version: string;
  loader: LoaderType;
  thumbnail?: string;
  tags?: string[];
}): Promise<InstanceSummary> {
  return await invoke("create_instance", { req });
}

export async function updateInstance(instanceId: string, req: {
  name?: string;
  thumbnail?: string;
  tags?: string[];
}): Promise<InstanceSummary> {
  return await invoke("update_instance", { instanceId, req });
}

export async function deleteInstance(instanceId: string): Promise<void> {
  await invoke("delete_instance", { instanceId });
}

export async function openInstanceFolder(instanceId: string): Promise<void> {
  await invoke("open_instance_folder", { instanceId });
}

export async function listInstanceContent(instanceId: string, kind: string): Promise<InstanceContentItem[]> {
  return await invoke("list_instance_content", { instanceId, kind });
}

export async function toggleInstanceContent(
  instanceId: string,
  kind: string,
  fileName: string,
  enabled: boolean
): Promise<void> {
  await invoke("toggle_instance_content", { instanceId, kind, fileName, enabled });
}

export async function deleteInstanceContent(
  instanceId: string,
  kind: string,
  fileName: string
): Promise<void> {
  await invoke("delete_instance_content", { instanceId, kind, fileName });
}

export async function openInstanceContentFolder(instanceId: string, kind: string): Promise<void> {
  await invoke("open_instance_content_folder", { instanceId, kind });
}

export async function listInstanceReports(instanceId: string): Promise<InstanceLogEntry[]> {
  return await invoke("list_instance_reports", { instanceId });
}

export async function readInstanceReport(instanceId: string, kind: string, name: string): Promise<string> {
  return await invoke("read_instance_report", { instanceId, kind, name });
}

export async function getRuntimeMetrics(pid?: number): Promise<RuntimeMetrics> {
  return await invoke("get_runtime_metrics", { pid });
}

export async function discordInit(): Promise<void> {
  await invoke("discord_init");
}

export async function discordSetActivity(
  state: string,
  details: string,
  startTimestamp: number | undefined,
  showButtons: boolean
): Promise<void> {
  await invoke("discord_set_activity", { state, details, startTimestamp, showButtons });
}

export async function discordClearActivity(): Promise<void> {
  await invoke("discord_clear_activity");
}

export async function discordShutdown(): Promise<void> {
  await invoke("discord_shutdown");
}

export async function modrinthSearch(
  query: string,
  limit = 20,
  offset = 0,
  loader?: string,
  gameVersion?: string,
  index?: string,
  projectType?: string,
  categories?: string[]
): Promise<ModrinthSearchResponse> {
  return await invoke("modrinth_search", {
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

export async function modrinthListVersions(
  projectId: string,
  loader?: string,
  gameVersion?: string
): Promise<ModrinthVersion[]> {
  return await invoke("modrinth_list_versions", { projectId, loader, gameVersion });
}

export async function modrinthGetProject(projectId: string): Promise<ModrinthProject> {
  return await invoke("modrinth_get_project", { projectId });
}

export async function modrinthInstallVersion(
  instanceId: string,
  versionId: string,
  loader?: string,
  gameVersion?: string,
  projectType?: string
): Promise<string> {
  return await invoke("modrinth_install_version", { instanceId, versionId, loader, gameVersion, projectType });
}

export async function modrinthInstallModpack(
  versionId: string,
  name: string,
  thumbnail?: string
): Promise<InstanceSummary> {
  return await invoke("modrinth_install_modpack", { versionId, name, thumbnail });
}

export async function modrinthInstallModpackWithBackup(
  versionId: string,
  name: string,
  thumbnail: string | undefined,
  backup: boolean
): Promise<InstanceSummary> {
  return await invoke("modrinth_install_modpack_with_backup", {
    versionId,
    name,
    thumbnail,
    backup,
  });
}

export async function importModpackMrpack(
  name: string | undefined,
  fileName: string,
  dataBase64: string
): Promise<InstanceSummary> {
  return await invoke("import_modpack_mrpack", { name, fileName, dataBase64 });
}

export async function exportModpackMrpack(instanceId: string, destPath?: string): Promise<string> {
  return await invoke("export_modpack_mrpack", { instanceId, destPath });
}

export async function modrinthInstallDatapack(
  instanceId: string,
  worldId: string,
  versionId: string
): Promise<string> {
  return await invoke("modrinth_install_datapack", { instanceId, worldId, versionId });
}

export async function applyOptimizationPack(
  instanceId: string,
  loader: string,
  gameVersion: string,
  preset?: string
): Promise<string> {
  return await invoke("apply_optimization_pack", {
    instanceId,
    loader,
    gameVersion,
    preset,
  });
}

export async function rollbackOptimization(instanceId: string): Promise<string> {
  return await invoke("rollback_optimization", { instanceId });
}

export async function curseforgeSearch(query: string, pageSize = 20, index = 0): Promise<CurseForgeSearchResponse> {
  return await invoke("curseforge_search", { query, pageSize, index });
}

export async function installForge(versionId: string): Promise<string> {
  return await invoke("install_forge", { versionId });
}

export async function installFabric(versionId: string): Promise<string> {
  return await invoke("install_fabric", { versionId });
}

export async function installNeoForge(versionId: string): Promise<string> {
  return await invoke("install_neoforge", { versionId });
}

export async function listInstanceWorlds(instanceId: string): Promise<string[]> {
  return await invoke("list_instance_worlds", { instanceId });
}

export async function openWorldDatapacksFolder(instanceId: string, worldId: string): Promise<void> {
  await invoke("open_world_datapacks_folder", { instanceId, worldId });
}

export async function importDatapackZip(
  instanceId: string,
  worldId: string,
  fileName: string,
  dataBase64: string
): Promise<string> {
  return await invoke("import_datapack_zip", { instanceId, worldId, fileName, dataBase64 });
}


export async function getActiveSkin(): Promise<SkinInfo | null> {
  return await invoke("get_active_skin");
}

export async function setActiveSkinBase64(
  name: string,
  model: string,
  data: string
): Promise<SkinInfo> {
  return await invoke("set_active_skin_base64", { name, model, data });
}

export async function setActiveSkinUrl(
  url: string,
  name: string | undefined,
  model: string
): Promise<SkinInfo> {
  return await invoke("set_active_skin_url", { url, name, model });
}

export async function clearActiveSkin(): Promise<void> {
  await invoke("clear_active_skin");
}

export async function getActiveCape(): Promise<string | null> {
  return await invoke("get_active_cape");
}

export async function setActiveCapeBase64(data: string): Promise<string> {
  return await invoke("set_active_cape_base64", { data });
}

export async function setActiveCapeUrl(url: string): Promise<string> {
  return await invoke("set_active_cape_url", { url });
}

export async function clearActiveCape(): Promise<void> {
  await invoke("clear_active_cape");
}
