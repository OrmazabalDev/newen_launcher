import { invokeTyped } from "./core";

export function discordInit(): Promise<void> {
  return invokeTyped("discord_init");
}

export function discordSetActivity(
  state: string,
  details: string,
  startTimestamp: number | undefined,
  showButtons: boolean
): Promise<void> {
  return invokeTyped("discord_set_activity", { state, details, startTimestamp, showButtons });
}

export function discordClearActivity(): Promise<void> {
  return invokeTyped("discord_clear_activity");
}

export function discordShutdown(): Promise<void> {
  return invokeTyped("discord_shutdown");
}
