import { invokeTyped } from "./core";

export function loginOffline(username: string): Promise<string> {
  return invokeTyped("login_offline", { username });
}

export function startMsLogin(): Promise<{
  user_code: string;
  device_code: string;
  verification_uri: string;
  message: string;
  interval: number;
}> {
  return invokeTyped("start_ms_login");
}

export function pollMsLogin(deviceCode: string): Promise<string> {
  return invokeTyped("poll_ms_login", { device_code: deviceCode });
}

export function restoreMsSession(): Promise<string> {
  return invokeTyped("restore_ms_session");
}

export function logoutSession(): Promise<void> {
  return invokeTyped("logout_session");
}

export function refreshMsProfile(): Promise<string> {
  return invokeTyped("refresh_ms_profile");
}
