import { useEffect, useMemo, useRef, useState } from "react";
import type { MinecraftProfile, SkinInfo } from "../types";
import * as tauri from "../services/tauri";
import { SkinViewer } from "skinview3d";
import { SkinsHeader } from "./skins/SkinsHeader";
import { SkinsPreviewCard } from "./skins/SkinsPreviewCard";
import { SkinsOfflineControls } from "./skins/SkinsOfflineControls";
import { SkinsOnlineControls } from "./skins/SkinsOnlineControls";

type SkinModel = "steve" | "alex";

export function SkinsView({
  userProfile,
  onRefreshOnline,
}: {
  userProfile: MinecraftProfile;
  onRefreshOnline?: () => void;
}) {
  const [skin, setSkin] = useState<SkinInfo | null>(null);
  const [model, setModel] = useState<SkinModel>("steve");
  const [skinUrl, setSkinUrl] = useState("");
  const [status, setStatus] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [capeUrl, setCapeUrl] = useState("");
  const [officialCape, setOfficialCape] = useState<string | null>(null);
  const [offlineCape, setOfflineCape] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<SkinViewer | null>(null);

  const offline = Boolean(userProfile?.is_offline);
  const officialSkinUrl = userProfile?.skin_url || "";
  const capeUrls = useMemo(() => userProfile?.cape_urls || [], [userProfile?.cape_urls]);

  useEffect(() => {
    if (!offline) return;
    (async () => {
      try {
        const current = await tauri.getActiveSkin();
        if (current) {
          setSkin(current);
          if (current.model === "alex" || current.model === "steve") {
            setModel(current.model as SkinModel);
          }
        }
        const cape = await tauri.getActiveCape();
        if (cape) {
          setOfflineCape(cape);
        }
      } catch (e) {
        setStatus("No se pudo cargar la skin guardada.");
      }
    })();
  }, [offline]);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (!viewerRef.current) {
      viewerRef.current = new SkinViewer({
        canvas: canvasRef.current,
        width: 280,
        height: 360,
      });
      viewerRef.current.zoom = 0.9;
      if (viewerRef.current.controls) {
        viewerRef.current.controls.enableZoom = true;
        viewerRef.current.controls.enablePan = false;
      }
    }
    if (offline) {
      if (skin?.data_url) {
        viewerRef.current.loadSkin(skin.data_url);
      }
      if (offlineCape) {
        viewerRef.current.loadCape(offlineCape);
      } else {
        viewerRef.current.loadCape(null);
      }
    } else {
      if (officialSkinUrl) {
        viewerRef.current.loadSkin(officialSkinUrl);
      }
      if (officialCape) {
        viewerRef.current.loadCape(officialCape);
      } else {
        viewerRef.current.loadCape(null);
      }
    }
    return () => {
      viewerRef.current?.dispose();
      viewerRef.current = null;
    };
  }, [skin?.data_url, offline, officialSkinUrl, officialCape, offlineCape]);

  useEffect(() => {
    if (!offline && capeUrls.length > 0 && !officialCape) {
      const firstCape = capeUrls[0];
      if (firstCape) {
        setOfficialCape(firstCape);
      }
    }
  }, [offline, capeUrls, officialCape]);

  const handleFile = async (file: File) => {
    setIsBusy(true);
    try {
      setStatus("Cargando skin...");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Error leyendo el archivo"));
        reader.readAsDataURL(file);
      });
      const saved = await tauri.setActiveSkinBase64(file.name, model, dataUrl);
      setSkin(saved);
      setStatus("Skin aplicada.");
    } catch (e) {
      setStatus("Error guardando skin: " + String(e));
    } finally {
      setIsBusy(false);
    }
  };

  const handleUrl = async () => {
    if (!skinUrl.trim()) return;
    setIsBusy(true);
    try {
      setStatus("Descargando skin...");
      const saved = await tauri.setActiveSkinUrl(skinUrl.trim(), "Skin URL", model);
      setSkin(saved);
      setStatus("Skin aplicada.");
    } catch (e) {
      setStatus("Error con la URL: " + String(e));
    } finally {
      setIsBusy(false);
    }
  };

  const handleCapeFile = async (file: File) => {
    setIsBusy(true);
    try {
      setStatus("Cargando cape...");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Error leyendo el archivo"));
        reader.readAsDataURL(file);
      });
      const saved = await tauri.setActiveCapeBase64(dataUrl);
      setOfflineCape(saved);
      setStatus("Cape aplicada.");
    } catch (e) {
      setStatus("Error guardando cape: " + String(e));
    } finally {
      setIsBusy(false);
    }
  };

  const handleCapeUrl = async () => {
    if (!capeUrl.trim()) return;
    setIsBusy(true);
    try {
      setStatus("Descargando cape...");
      const saved = await tauri.setActiveCapeUrl(capeUrl.trim());
      setOfflineCape(saved);
      setStatus("Cape aplicada.");
    } catch (e) {
      setStatus("Error con la URL: " + String(e));
    } finally {
      setIsBusy(false);
    }
  };

  const handleClearCape = async () => {
    setIsBusy(true);
    try {
      await tauri.clearActiveCape();
      setOfflineCape(null);
      setStatus("Cape eliminada.");
    } catch (e) {
      setStatus("No se pudo eliminar la cape.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleClear = async () => {
    setIsBusy(true);
    try {
      await tauri.clearActiveSkin();
      setSkin(null);
      setStatus("Skin eliminada.");
    } catch (e) {
      setStatus("No se pudo eliminar la skin.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-20 bg-gray-950 flex flex-col p-8 overflow-y-auto animate-fadeIn"
      aria-busy={isBusy}
    >
      <SkinsHeader offline={offline} />

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        <SkinsPreviewCard
          offline={offline}
          skin={skin}
          userProfile={userProfile}
          canvasRef={canvasRef}
        />

        {offline ? (
          <SkinsOfflineControls
            model={model}
            onModelChange={setModel}
            isBusy={isBusy}
            skinUrl={skinUrl}
            onSkinUrlChange={setSkinUrl}
            onApplySkinUrl={handleUrl}
            capeUrl={capeUrl}
            onCapeUrlChange={setCapeUrl}
            onApplyCapeUrl={handleCapeUrl}
            onFileSelect={handleFile}
            onCapeFileSelect={handleCapeFile}
            onClearSkin={handleClear}
            onClearCape={handleClearCape}
            status={status}
          />
        ) : (
          <SkinsOnlineControls
            officialSkinUrl={officialSkinUrl}
            capeUrls={capeUrls}
            officialCape={officialCape}
            onSelectCape={setOfficialCape}
            onRefreshOnline={onRefreshOnline}
            isBusy={isBusy}
          />
        )}
      </div>
    </div>
  );
}

