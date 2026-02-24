import { invoke } from "@tauri-apps/api/core";

export async function invokeTyped<T>(
  command: string,
  payload?: Record<string, unknown>
): Promise<T> {
  try {
    return await invoke<T>(command, payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(message);
  }
}
