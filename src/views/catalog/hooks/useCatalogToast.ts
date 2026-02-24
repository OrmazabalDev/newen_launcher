import { useCallback, useEffect, useRef, useState } from "react";
import * as catalogApi from "../api";

export type CatalogToastAction =
  | { type: "open-content"; instanceId: string; kind: "mods" | "resourcepacks" | "shaderpacks" }
  | { type: "open-instance"; instanceId: string }
  | { type: "go-instances" }
  | { type: "open-datapacks"; instanceId: string; worldId: string };

export type CatalogToastState = {
  message: string;
  kind: "success" | "info" | "error";
  actionLabel?: string;
  action?: CatalogToastAction;
};

export function useCatalogToast(onGoInstances?: () => void) {
  const [toast, setToast] = useState<CatalogToastState | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        window.clearTimeout(toastTimer.current);
      }
    };
  }, []);

  const showToast = useCallback(
    (payload: Omit<CatalogToastState, "kind"> & { kind?: CatalogToastState["kind"] }) => {
      if (toastTimer.current) {
        window.clearTimeout(toastTimer.current);
      }
      setToast({
        message: payload.message,
        kind: payload.kind ?? "info",
        actionLabel: payload.actionLabel,
        action: payload.action,
      });
      toastTimer.current = window.setTimeout(() => setToast(null), 5500);
    },
    []
  );

  const handleToastAction = useCallback(async () => {
    if (!toast?.action) return;
    const action = toast.action;
    if (toastTimer.current) {
      window.clearTimeout(toastTimer.current);
    }
    setToast(null);
    try {
      if (action.type === "open-content") {
        await catalogApi.openInstanceContentFolder(action.instanceId, action.kind);
      } else if (action.type === "open-instance") {
        await catalogApi.openInstanceFolder(action.instanceId);
      } else if (action.type === "go-instances") {
        if (onGoInstances) {
          onGoInstances();
        }
      } else if (action.type === "open-datapacks") {
        await catalogApi.openWorldDatapacksFolder(action.instanceId, action.worldId);
      }
    } catch {
      showToast({ message: "No se pudo abrir la carpeta.", kind: "error" });
    }
  }, [onGoInstances, showToast, toast]);

  return { toast, showToast, handleToastAction };
}
