import type { SkinInfo } from "../../types";
import { invokeTyped } from "./core";

export function getActiveSkin(): Promise<SkinInfo | null> {
  return invokeTyped("get_active_skin");
}

export function setActiveSkinBase64(name: string, model: string, data: string): Promise<SkinInfo> {
  return invokeTyped("set_active_skin_base64", { name, model, data });
}

export function setActiveSkinUrl(
  url: string,
  name: string | undefined,
  model: string
): Promise<SkinInfo> {
  return invokeTyped("set_active_skin_url", { url, name, model });
}

export function clearActiveSkin(): Promise<void> {
  return invokeTyped("clear_active_skin");
}

export function getActiveCape(): Promise<string | null> {
  return invokeTyped("get_active_cape");
}

export function setActiveCapeBase64(data: string): Promise<string> {
  return invokeTyped("set_active_cape_base64", { data });
}

export function setActiveCapeUrl(url: string): Promise<string> {
  return invokeTyped("set_active_cape_url", { url });
}

export function clearActiveCape(): Promise<void> {
  return invokeTyped("clear_active_cape");
}
