import type { GameSettings, SystemJava } from "../../types";
import { invokeTyped } from "./core";

export function detectSystemJava(): Promise<SystemJava> {
  return invokeTyped("detect_system_java");
}

export function getInstalledVersions(): Promise<string[]> {
  return invokeTyped("get_installed_versions");
}

export function getVersions(): Promise<string[]> {
  return invokeTyped("get_versions");
}

export function getVersionMetadata(versionId: string): Promise<void> {
  return invokeTyped("get_version_metadata", { versionId });
}

export function downloadClient(versionId: string): Promise<void> {
  return invokeTyped("download_client", { versionId });
}

export function downloadGameFiles(versionId: string): Promise<void> {
  return invokeTyped("download_game_files", { versionId });
}

export function downloadJava(versionId?: string): Promise<void> {
  return invokeTyped("download_java", { versionId });
}

export function launchGame(
  versionId: string,
  settings: GameSettings,
  instanceId?: string
): Promise<void> {
  return invokeTyped("launch_game", { versionId, settings, instanceId });
}

export function deleteVersion(versionId: string): Promise<void> {
  return invokeTyped("delete_version", { versionId });
}
