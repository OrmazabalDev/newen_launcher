import type { InstanceContentItem, InstanceLogEntry } from "../../types";
import { invokeTyped } from "./core";

export function listInstanceContent(
  instanceId: string,
  kind: string
): Promise<InstanceContentItem[]> {
  return invokeTyped("list_instance_content", { instanceId, kind });
}

export function toggleInstanceContent(
  instanceId: string,
  kind: string,
  fileName: string,
  enabled: boolean
): Promise<void> {
  return invokeTyped("toggle_instance_content", { instanceId, kind, fileName, enabled });
}

export function deleteInstanceContent(
  instanceId: string,
  kind: string,
  fileName: string
): Promise<void> {
  return invokeTyped("delete_instance_content", { instanceId, kind, fileName });
}

export function openInstanceContentFolder(instanceId: string, kind: string): Promise<void> {
  return invokeTyped("open_instance_content_folder", { instanceId, kind });
}

export function listInstanceReports(instanceId: string): Promise<InstanceLogEntry[]> {
  return invokeTyped("list_instance_reports", { instanceId });
}

export function readInstanceReport(
  instanceId: string,
  kind: string,
  name: string
): Promise<string> {
  return invokeTyped("read_instance_report", { instanceId, kind, name });
}
