import type { InstanceSummary, LoaderType } from "../../types";
import { invokeTyped } from "./core";

export function listInstances(): Promise<InstanceSummary[]> {
  return invokeTyped("list_instances");
}

export function createInstance(req: {
  name: string;
  version: string;
  loader: LoaderType;
  thumbnail?: string;
  tags?: string[];
}): Promise<InstanceSummary> {
  const normalized = {
    ...req,
    thumbnail: req.thumbnail ?? "",
    tags: req.tags ?? [],
  };
  return invokeTyped("create_instance", { req: normalized });
}

export function updateInstance(
  instanceId: string,
  req: { name: string; thumbnail: string; tags: string[] }
): Promise<InstanceSummary> {
  return invokeTyped("update_instance", { instanceId, req });
}

export function deleteInstance(instanceId: string): Promise<void> {
  return invokeTyped("delete_instance", { instanceId });
}

export function openInstanceFolder(instanceId: string): Promise<void> {
  return invokeTyped("open_instance_folder", { instanceId });
}
