import React, { useEffect, useRef, useState } from "react";
import type { MinecraftProfile, SkinInfo } from "../types";
import * as tauri from "../services/tauri";
import { SkinViewer } from "skinview3d";

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerRef = useRef<SkinViewer | null>(null);

  const offline = Boolean(userProfile?.is_offline);
  const officialSkinUrl = userProfile?.skin_url || "";
  const capeUrls = userProfile?.cape_urls || [];

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
      } catch (e: any) {
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
      viewerRef.current.loadCape(offlineCape ?? null);
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
      setOfficialCape(capeUrls[0]);
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
    } catch (e: any) {
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
    } catch (e: any) {
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
    } catch (e: any) {
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
    } catch (e: any) {
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
    } catch (e: any) {
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
    } catch (e: any) {
      setStatus("No se pudo eliminar la skin.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-20 bg-gray-950 flex flex-col p-8 overflow-y-auto animate-fadeIn" aria-busy={isBusy}>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white">Skins</h2>
        <p className="text-gray-300 text-sm">
          {offline
            ? "Carga una skin local o desde URL. Se aplicará al jugar en modo offline."
            : "Vista de skin y cape oficial asociada a tu cuenta Microsoft."}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
          <div className="text-sm font-bold text-white mb-4">Vista 3D</div>
          <div className="bg-gray-950 border border-gray-800 rounded-2xl flex items-center justify-center p-4">
            <canvas ref={canvasRef} className="rounded-xl" />
          </div>
          {offline && skin && (
            <div className="mt-4 text-xs text-gray-400">
              Skin activa: <span className="text-gray-200">{skin.name}</span> · Modelo{" "}
              <span className="text-gray-200">{skin.model}</span>
            </div>
          )}
          {!offline && (
            <div className="mt-4 text-xs text-gray-400">
              Cuenta: <span className="text-gray-200">{userProfile.name}</span>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {offline ? (
            <>
              <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-lg font-bold text-white mb-2">Modelo</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModel("steve")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border ${
                      model === "steve"
                        ? "bg-brand-accent text-white border-brand-accent/70"
                        : "bg-gray-900 text-gray-300 border-gray-700"
                    }`}
                  >
                    Steve (wide)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModel("alex")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border ${
                      model === "alex"
                        ? "bg-brand-accent text-white border-brand-accent/70"
                        : "bg-gray-900 text-gray-300 border-gray-700"
                    }`}
                  >
                    Alex (slim)
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  En modo offline el modelo puede depender del UUID; si ves brazos raros, prueba el otro modelo.
                </p>
              </section>

              <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-lg font-bold text-white mb-2">Subir skin</h3>
                <input
                  type="file"
                  accept="image/png"
                  disabled={isBusy}
                  aria-disabled={isBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void handleFile(file);
                    }
                  }}
                  className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-brand-accent file:text-white hover:file:bg-brand-accent-deep"
                />
                <p className="text-xs text-gray-500 mt-2">Formato PNG 64x64 recomendado.</p>
              </section>

              <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-lg font-bold text-white mb-2">Subir cape</h3>
                <input
                  type="file"
                  accept="image/png"
                  disabled={isBusy}
                  aria-disabled={isBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void handleCapeFile(file);
                    }
                  }}
                  className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-brand-accent file:text-white hover:file:bg-brand-accent-deep"
                />
                <p className="text-xs text-gray-500 mt-2">Formato PNG 64x32 recomendado.</p>
              </section>

              <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-lg font-bold text-white mb-2">URL</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={skinUrl}
                    onChange={(e) => setSkinUrl(e.target.value)}
                    placeholder="https://..."
                    disabled={isBusy}
                    aria-disabled={isBusy}
                    className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-brand-accent"
                  />
                  <button
                    type="button"
                    onClick={handleUrl}
                    disabled={isBusy || !skinUrl.trim()}
                    aria-disabled={isBusy || !skinUrl.trim()}
                    className="px-4 py-3 rounded-xl bg-brand-info text-white font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Aplicar
                  </button>
                </div>
              </section>

              <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-lg font-bold text-white mb-2">URL cape</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={capeUrl}
                    onChange={(e) => setCapeUrl(e.target.value)}
                    placeholder="https://..."
                    disabled={isBusy}
                    aria-disabled={isBusy}
                    className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-brand-accent"
                  />
                  <button
                    type="button"
                    onClick={handleCapeUrl}
                    disabled={isBusy || !capeUrl.trim()}
                    aria-disabled={isBusy || !capeUrl.trim()}
                    className="px-4 py-3 rounded-xl bg-brand-info text-white font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Aplicar
                  </button>
                </div>
              </section>

              <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-lg font-bold text-white mb-2">Acciones</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={isBusy}
                    aria-disabled={isBusy}
                    className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Quitar skin
                  </button>
                  <button
                    type="button"
                    onClick={handleClearCape}
                    disabled={isBusy}
                    aria-disabled={isBusy}
                    className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Quitar cape
                  </button>
                </div>
                {status && (
                  <div
                    className="mt-3 text-xs text-gray-300 bg-gray-950/60 border border-gray-800 rounded-xl px-3 py-2"
                    role="status"
                    aria-live="polite"
                  >
                    {status}
                  </div>
                )}
              </section>
            </>
          ) : (
            <>
              <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-lg font-bold text-white mb-2">Skin oficial</h3>
                {officialSkinUrl ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={officialSkinUrl}
                      alt="Skin oficial"
                      className="w-14 h-14 rounded-xl border border-gray-800 object-cover"
                    />
                    <div className="text-sm text-gray-300">
                      <div className="font-bold text-white">Skin activa</div>
                      <div className="text-xs text-gray-500">Se sincroniza con tu cuenta Microsoft</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">No se encontró skin oficial.</div>
                )}
              </section>

              <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-lg font-bold text-white mb-2">Sincronizar</h3>
                <p className="text-xs text-gray-400 mb-3">
                  Actualiza skin y capes desde la cuenta Microsoft sin reiniciar.
                </p>
                <button
                  type="button"
                  onClick={() => onRefreshOnline?.()}
                  disabled={!onRefreshOnline || isBusy}
                  aria-disabled={!onRefreshOnline || isBusy}
                  className="px-4 py-2 rounded-xl bg-brand-accent hover:bg-brand-accent-deep text-white font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Actualizar skin/cape
                </button>
              </section>

              <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-lg font-bold text-white mb-2">Capes oficiales</h3>
                {capeUrls.length === 0 && (
                  <div className="text-sm text-gray-400">No hay capes asociadas a esta cuenta.</div>
                )}
                {capeUrls.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {capeUrls.map((url) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setOfficialCape(url)}
                        className={`border rounded-xl p-2 ${
                          officialCape === url
                            ? "border-brand-accent/60 bg-gray-900"
                            : "border-gray-800 bg-gray-950/40"
                        }`}
                      >
                        <img src={url} alt="Cape" className="w-full h-20 object-cover rounded-lg" />
                        <div className="text-[10px] text-gray-400 mt-1">Ver en 3D</div>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
