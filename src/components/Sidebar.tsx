import React, { useEffect, useState } from "react";
import type { MinecraftProfile, View } from "../types";
import { IconDownload, IconFolder, IconPlay, IconSearch, IconSettings, IconUser } from "../icons";
import * as tauri from "../services/tauri";

export function Sidebar({
  currentView,
  onNavigate,
  userProfile,
  onLogout,
  isProcessing,
  isGameRunning,
}: {
  currentView: View;
  onNavigate: (v: View) => void;
  userProfile: MinecraftProfile;
  onLogout: () => void;
  isProcessing: boolean;
  isGameRunning: boolean;
}) {
  const [offlineSkinUrl, setOfflineSkinUrl] = useState("");
  const defaultSteveHead = "https://mc-heads.net/avatar/Steve/64";
  useEffect(() => {
    let alive = true;
    if (!userProfile.is_offline) {
      setOfflineSkinUrl("");
      return;
    }
    (async () => {
      try {
        const skin = await tauri.getActiveSkin();
        if (alive) setOfflineSkinUrl(skin?.data_url || "");
      } catch {
        if (alive) setOfflineSkinUrl("");
      }
    })();
    return () => {
      alive = false;
    };
  }, [userProfile.is_offline]);

  const skinUrl = userProfile.is_offline ? offlineSkinUrl : userProfile.skin_url || "";
  const headUrl = skinUrl || defaultSteveHead;
  const headSize = 40;
  const headScale = headSize / 8;
  const textureSize = 64 * headScale;
  const headX = -8 * headScale;
  const headY = -8 * headScale;
  const hatX = -40 * headScale;

  return (
    <div
      className={`w-64 bg-gray-900 border-r border-gray-800 flex flex-col justify-between p-4 z-20 shadow-2xl transition ${
        isGameRunning ? "opacity-80" : "opacity-100"
      }`}
    >
      <div>
        <div className="flex items-center gap-4 mb-8 px-2">
          <div className="w-16 h-16">
            <img src="/newen_icono.png" alt="Newen Launcher" className="w-full h-full object-contain" />
          </div>
          <span className="font-bold text-2xl leading-tight">
            Newen <span className="text-brand-accent">Launcher</span>
          </span>
        </div>
        {isGameRunning && (
          <div className="mb-4 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
            Juego en ejecución. Algunas acciones pueden tardar en responder.
          </div>
        )}

        <div className="space-y-1">
          <button
            onClick={() => onNavigate("dashboard")}
            type="button"
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${
              currentView === "dashboard"
                ? "bg-gray-800 text-white shadow-sm border border-brand-accent/60"
                : "text-gray-300 hover:bg-gray-800/50 hover:text-white"
            }`}
            aria-current={currentView === "dashboard" ? "page" : undefined}
          >
            <span className={isProcessing && currentView === "dashboard" ? "animate-pulse text-brand-accent" : ""}>
              <IconPlay />
            </span>
            <span>Jugar</span>
          </button>

          <button
            onClick={() => onNavigate("instances")}
            type="button"
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${
              currentView === "instances"
                ? "bg-gray-800 text-white shadow-sm border border-brand-accent/60"
                : "text-gray-300 hover:bg-gray-800/50 hover:text-white"
            }`}
            aria-current={currentView === "instances" ? "page" : undefined}
          >
            <IconFolder /> <span>Instancias</span>
          </button>

          <button
            onClick={() => onNavigate("catalog")}
            type="button"
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${
              currentView === "catalog"
                ? "bg-gray-800 text-white shadow-sm border border-brand-accent/60"
                : "text-gray-300 hover:bg-gray-800/50 hover:text-white"
            }`}
            aria-current={currentView === "catalog" ? "page" : undefined}
          >
            <IconSearch /> <span>Catalogo mods</span>
          </button>

          <button
            onClick={() => onNavigate("modpacks")}
            type="button"
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${
              currentView === "modpacks"
                ? "bg-gray-800 text-white shadow-sm border border-brand-accent/60"
                : "text-gray-300 hover:bg-gray-800/50 hover:text-white"
            }`}
            aria-current={currentView === "modpacks" ? "page" : undefined}
          >
            <IconDownload /> <span>Modpacks</span>
          </button>

          <button
            onClick={() => onNavigate("skins")}
            type="button"
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${
              currentView === "skins"
                ? "bg-gray-800 text-white shadow-sm border border-brand-accent/60"
                : "text-gray-300 hover:bg-gray-800/50 hover:text-white"
            }`}
            aria-current={currentView === "skins" ? "page" : undefined}
          >
            <IconUser /> <span>Skins</span>
          </button>

          <button
            onClick={() => onNavigate("settings")}
            type="button"
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${
              currentView === "settings"
                ? "bg-gray-800 text-white shadow-sm border border-brand-accent/60"
                : "text-gray-300 hover:bg-gray-800/50 hover:text-white"
            }`}
            aria-current={currentView === "settings" ? "page" : undefined}
          >
            <IconSettings /> <span>Ajustes</span>
          </button>
        </div>
      </div>

      <div className="bg-gray-950/50 p-3 rounded-xl border border-gray-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-800 border border-gray-700">
          <div
            className="w-full h-full"
            style={{
              backgroundImage: `url("${headUrl}"), url("${headUrl}")`,
              backgroundSize: `${textureSize}px ${textureSize}px, ${textureSize}px ${textureSize}px`,
              backgroundPosition: `${headX}px ${headY}px, ${hatX}px ${headY}px`,
              backgroundRepeat: "no-repeat",
              imageRendering: "pixelated",
            }}
            aria-label={`Avatar de ${userProfile.name}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate">{userProfile.name}</div>
          <div className="text-xs text-gray-500">{userProfile.is_offline ? "Offline" : "Microsoft"}</div>
        </div>
        <button
          onClick={onLogout}
          type="button"
          className="text-gray-500 hover:text-red-400"
          aria-label="Cerrar sesion"
        >
          Salir
        </button>
      </div>
    </div>
  );
}
