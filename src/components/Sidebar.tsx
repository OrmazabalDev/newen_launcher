import { useEffect, useState } from "react";
import type { MinecraftProfile, View } from "../types";
import { IconDownload, IconFolder, IconPlay, IconSearch, IconSettings, IconUser } from "../icons";
import * as tauri from "../services/tauri";
import { cn } from "../utils/cn";
import { gameAlert, logoutButton, navButton, profileCard, sidebar } from "./sidebarStyles";

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
    <div className={sidebar({ running: isGameRunning })}>
      <div>
        <div className="flex items-center gap-4 mb-8 px-2">
          <div className="w-16 h-16">
            <img
              src="/newen_icono.png"
              alt="Newen Launcher"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="font-bold text-2xl leading-tight">
            Newen <span className="text-brand-accent">Launcher</span>
          </span>
        </div>
        {isGameRunning && (
          <div className={gameAlert()}>
            Juego en ejecución. Algunas acciones pueden tardar en responder.
          </div>
        )}

        <div className="space-y-1">
          <button
            onClick={() => onNavigate("dashboard")}
            type="button"
            className={navButton({ active: currentView === "dashboard" })}
            aria-current={currentView === "dashboard" ? "page" : undefined}
          >
            <span
              className={cn(
                isProcessing && currentView === "dashboard" && "animate-pulse text-brand-accent"
              )}
            >
              <IconPlay />
            </span>
            <span>Jugar</span>
          </button>

          <button
            onClick={() => onNavigate("instances")}
            type="button"
            className={navButton({ active: currentView === "instances" })}
            aria-current={currentView === "instances" ? "page" : undefined}
          >
            <IconFolder /> <span>Instancias</span>
          </button>

          <button
            onClick={() => onNavigate("catalog")}
            type="button"
            className={navButton({ active: currentView === "catalog" })}
            aria-current={currentView === "catalog" ? "page" : undefined}
          >
            <IconSearch /> <span>Catálogo mods</span>
          </button>

          <button
            onClick={() => onNavigate("modpacks")}
            type="button"
            className={navButton({ active: currentView === "modpacks" })}
            aria-current={currentView === "modpacks" ? "page" : undefined}
          >
            <IconDownload /> <span>Modpacks</span>
          </button>

          <button
            onClick={() => onNavigate("skins")}
            type="button"
            className={navButton({ active: currentView === "skins" })}
            aria-current={currentView === "skins" ? "page" : undefined}
          >
            <IconUser /> <span>Skins</span>
          </button>

          <button
            onClick={() => onNavigate("settings")}
            type="button"
            className={navButton({ active: currentView === "settings" })}
            aria-current={currentView === "settings" ? "page" : undefined}
          >
            <IconSettings /> <span>Ajustes</span>
          </button>
        </div>
      </div>

      <div className={profileCard()}>
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
          <div className="text-xs text-gray-500">
            {userProfile.is_offline ? "Offline" : "Microsoft"}
          </div>
        </div>
        <button
          onClick={onLogout}
          type="button"
          className={logoutButton()}
          aria-label="Cerrar sesión"
        >
          Salir
        </button>
      </div>
    </div>
  );
}
