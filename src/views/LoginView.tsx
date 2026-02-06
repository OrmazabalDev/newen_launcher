import React, { useEffect, useRef, useState } from "react";
import type { AuthMode, DeviceCodeResponse, MinecraftProfile } from "../types";
import * as tauri from "../services/tauri";

export function LoginView({
  authMode,
  setAuthMode,
  offlineUsername,
  setOfflineUsername,
  onLoginOffline,
  onLoginMicrosoft,
  authError,
  setAuthError,
}: {
  authMode: AuthMode;
  setAuthMode: (m: AuthMode) => void;
  offlineUsername: string;
  setOfflineUsername: (v: string) => void;
  onLoginOffline: () => void;
  onLoginMicrosoft: (profile: MinecraftProfile) => void;
  authError: string;
  setAuthError: (v: string) => void;
}) {
  const [deviceInfo, setDeviceInfo] = useState<DeviceCodeResponse | null>(null);
  const [msStatus, setMsStatus] = useState<string>("");
  const pollingRef = useRef<number | null>(null);
  const isPollingRef = useRef(false);

  const stopPolling = () => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    isPollingRef.current = false;
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  useEffect(() => {
    if (authMode !== "microsoft") {
      stopPolling();
      setDeviceInfo(null);
      setMsStatus("");
    }
  }, [authMode]);

  const formatAuthError = (raw: string) => {
    const message = raw.trim();
    const lower = message.toLowerCase();
    if (lower.includes("invalid_grant") || lower.includes("expired")) {
      return "Error: el código expiró. Genera uno nuevo e intenta otra vez.";
    }
    if (lower.includes("network") || lower.includes("fetch") || lower.includes("connection")) {
      return "Error: no se pudo conectar. Revisa tu conexión e intenta otra vez.";
    }
    if (message.toLowerCase().startsWith("error")) return message;
    return `Error: ${message}`;
  };

  const authErrorLabel = authError ? formatAuthError(authError) : "";

  const startMicrosoftLogin = async () => {
    try {
      setAuthError("");
      setMsStatus("Generando c\u00f3digo de inicio...");
      const device = await tauri.startMsLogin();
      setDeviceInfo(device);
      setAuthMode("microsoft");
      setMsStatus("Ingresa el c\u00f3digo en tu navegador para continuar.");

      if (!isPollingRef.current) {
        const intervalMs = Math.max(3, device.interval || 5) * 1000;
        isPollingRef.current = true;
        pollingRef.current = window.setInterval(async () => {
          try {
            const result = await tauri.pollMsLogin(device.device_code);
            const parsed = JSON.parse(result) as MinecraftProfile;
            stopPolling();
            setDeviceInfo(null);
            setMsStatus("");
            onLoginMicrosoft(parsed);
          } catch (err: any) {
            const message = String(err);
            if (message.includes("authorization_pending") || message.includes("slow_down")) {
              setMsStatus("Esperando confirmaci\u00f3n en Microsoft...");
              return;
            }
            stopPolling();
            setMsStatus("");
            setAuthError(message);
          }
        }, intervalMs);
      }
    } catch (err: any) {
      setMsStatus("");
      setAuthError(String(err));
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6 relative overflow-hidden">
      <div className="w-full max-w-md bg-gray-900/80 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-gray-800 z-10">
        <h1 className="text-4xl font-black text-center mb-8 text-white">
          NEWEN <span className="text-brand-accent">LAUNCHER</span>
        </h1>

        <div className="flex bg-gray-800 p-1 rounded-lg mb-6">
          <button
            type="button"
            onClick={startMicrosoftLogin}
            className={`flex-1 py-2 rounded-md text-sm ${
              authMode === "microsoft" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            Microsoft
          </button>
          <button
            onClick={() => setAuthMode("offline")}
            type="button"
            className={`flex-1 py-2 rounded-md text-sm ${
              authMode === "offline" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            Offline
          </button>
        </div>

        <div className="space-y-4">
          {authMode === "microsoft" && deviceInfo ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-300">{deviceInfo.message || msStatus}</p>
              <div className="bg-gray-950 border border-gray-700 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-2">C\u00f3digo</div>
                <div className="text-2xl font-bold tracking-widest text-white">{deviceInfo.user_code}</div>
                <div className="text-xs text-gray-500 mt-2">URL</div>
                <div className="text-sm text-gray-300 break-all">{deviceInfo.verification_uri}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(deviceInfo.user_code).catch(() => undefined);
                }}
                className="w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm"
              >
                Copiar c\u00f3digo
              </button>
              {msStatus && <div className="text-xs text-gray-400">{msStatus}</div>}
            </div>
          ) : (
            <>
              <label className="sr-only" htmlFor="offline-username">
                Nombre de usuario
              </label>
              <input
                id="offline-username"
                className="w-full px-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-white outline-none focus:border-brand-accent"
                placeholder="Nombre de Usuario"
                value={offlineUsername}
                onChange={(e) => setOfflineUsername(e.target.value)}
              />
              <p className="text-xs text-gray-400">
                En modo offline no necesitas cuenta Microsoft. Tu nombre aparecer\u00e1 en el juego.
              </p>
              <button
                onClick={onLoginOffline}
                disabled={!offlineUsername.trim()}
                type="button"
                className="w-full py-3.5 bg-brand-accent hover:bg-brand-accent-deep rounded-xl font-bold text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Entrar
              </button>
            </>
          )}

          {authError && (
            <div
              className="text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-xl p-3"
              role="alert"
              aria-live="assertive"
            >
              {authErrorLabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
