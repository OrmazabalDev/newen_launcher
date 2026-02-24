import { invokeTyped } from "./core";

export function clearCache(): Promise<string> {
  return invokeTyped("clear_cache");
}

export function closeSplash(): Promise<void> {
  return invokeTyped("close_splash");
}
