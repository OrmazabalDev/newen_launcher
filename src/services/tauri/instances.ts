import type { InstanceSummary, LoaderType } from "../../types";
import { invokeTyped } from "./core";

function normalizeThumbnail(thumbnail?: string | null): string | null {
  return thumbnail?.trim() ? thumbnail : null;
}

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
    thumbnail: normalizeThumbnail(req.thumbnail),
    tags: req.tags ?? [],
  };
  return invokeTyped("create_instance", { req: normalized });
}

export function createInstanceV2(req: {
  name: string;
  version: string;
  loader: LoaderType;
  thumbnail?: string;
  tags?: string[];
}): Promise<InstanceSummary> {
  const normalized = {
    ...req,
    thumbnail: normalizeThumbnail(req.thumbnail),
    tags: req.tags ?? [],
  };
  return invokeTyped("create_instance_v2", { req: normalized });
}

export function updateInstance(
  instanceId: string,
  req: { name: string; thumbnail?: string | null; tags: string[] }
): Promise<InstanceSummary> {
  return invokeTyped("update_instance", {
    instanceId,
    req: {
      ...req,
      thumbnail: normalizeThumbnail(req.thumbnail),
    },
  });
}

export function deleteInstance(instanceId: string): Promise<void> {
  return invokeTyped("delete_instance", { instanceId });
}

export function openInstanceFolder(instanceId: string): Promise<void> {
  return invokeTyped("open_instance_folder", { instanceId });
}
