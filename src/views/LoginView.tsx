import { useEffect, useRef, useState } from "react";
import type { AuthMode, DeviceCodeResponse, MinecraftProfile } from "../types";
import * as tauri from "../services/tauri";
import { cn } from "../utils/cn";
import { actionButton, card, errorBox, input, page, panel, tabButton, tabGroup } from "./login/styles";

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
  const [isPolling, setIsPolling] = useState(false);

  const stopPolling = () => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    isPollingRef.current = false;
    setIsPolling(false);
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
      setMsStatus("Generando código de inicio...");
      setIsPolling(true);
      const device = await tauri.startMsLogin();
      setDeviceInfo(device);
      setAuthMode("microsoft");
      setMsStatus("Ingresa el código en tu navegador para continuar.");

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
          } catch (err) {
            const message = String(err);
            if (message.includes("authorization_pending") || message.includes("slow_down")) {
              setMsStatus("Esperando confirmación en Microsoft...");
              return;
            }
            stopPolling();
            setMsStatus("");
            setAuthError(message);
          }
        }, intervalMs);
      }
    } catch (err) {
      setMsStatus("");
      setIsPolling(false);
      setAuthError(String(err));
    }
  };

  return (
    <div className={page()} aria-busy={isPolling}>
      <div className={card()}>
        <h1 className="text-4xl font-black text-center mb-8 text-white">
          NEWEN <span className="text-brand-accent">LAUNCHER</span>
        </h1>

        <div className={tabGroup()}>
          <button
            type="button"
            onClick={startMicrosoftLogin}
            disabled={isPolling}
            className={cn(tabButton({ active: authMode === "microsoft" }), isPolling && "opacity-60 cursor-not-allowed")}
          >
            {isPolling ? "Conectando..." : "Microsoft"}
          </button>
          <button
            onClick={() => setAuthMode("offline")}
            type="button"
            disabled={isPolling}
            className={cn(tabButton({ active: authMode === "offline" }), isPolling && "opacity-60 cursor-not-allowed")}
          >
            Offline
          </button>
        </div>

        <div className="space-y-4">
          {authMode === "microsoft" && deviceInfo ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-300">{deviceInfo.message || msStatus}</p>
              <div className={panel()}>
                <div className="text-xs text-gray-500 mb-2">Código</div>
                <div className="text-2xl font-bold tracking-widest text-white">
                  {deviceInfo.user_code}
                </div>
                <div className="text-xs text-gray-500 mt-2">URL</div>
                <div className="text-sm text-gray-300 break-all">{deviceInfo.verification_uri}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(deviceInfo.user_code).catch(() => undefined);
                }}
                className={actionButton({ tone: "secondary" })}
              >
                Copiar código
              </button>
              {msStatus && (
                <div className="text-xs text-gray-400" role="status" aria-live="polite">
                  {msStatus}
                </div>
              )}
            </div>
          ) : (
            <>
              <label className="sr-only" htmlFor="offline-username">
                Nombre de usuario
              </label>
              <input
                id="offline-username"
                className={input()}
                placeholder="Nombre de Usuario"
                value={offlineUsername}
                onChange={(e) => setOfflineUsername(e.target.value)}
              />
              <p className="text-xs text-gray-400">
                En modo offline no necesitas cuenta Microsoft. Tu nombre aparecerá en el juego.
              </p>
              <button
                onClick={onLoginOffline}
                disabled={!offlineUsername.trim() || isPolling}
                type="button"
                className={cn(actionButton({ tone: "primary" }), "py-3.5")}
              >
                Entrar
              </button>
            </>
          )}

          {authError && (
            <div className={errorBox()} role="alert" aria-live="assertive">
              {authErrorLabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
