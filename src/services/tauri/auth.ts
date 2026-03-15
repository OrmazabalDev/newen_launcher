import type { AuthProfileV2, DeviceCodeResponse } from "../../types";
import { invokeTyped } from "./core";

export function loginOffline(username: string): Promise<string> {
  return invokeTyped("login_offline", { username });
}

export function startMsLogin(): Promise<DeviceCodeResponse> {
  return invokeTyped("start_ms_login");
}

export function pollMsLogin(deviceCode: string): Promise<string> {
  return invokeTyped("poll_ms_login", { device_code: deviceCode });
}

export function loginOfflineV2(username: string): Promise<AuthProfileV2> {
  return invokeTyped("login_offline_v2", { username });
}

export function pollMsLoginV2(deviceCode: string): Promise<AuthProfileV2> {
  return invokeTyped("poll_ms_login_v2", { device_code: deviceCode });
}

export function restoreMsSession(): Promise<string> {
  return invokeTyped("restore_ms_session");
}

export function restoreMsSessionV2(): Promise<AuthProfileV2> {
  return invokeTyped("restore_ms_session_v2");
}

export function logoutSession(): Promise<void> {
  return invokeTyped("logout_session");
}

export function refreshMsProfile(): Promise<string> {
  return invokeTyped("refresh_ms_profile");
}

export function refreshMsProfileV2(): Promise<AuthProfileV2> {
  return invokeTyped("refresh_ms_profile_v2");
}
