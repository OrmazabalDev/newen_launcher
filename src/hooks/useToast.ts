import { useCallback, useEffect, useRef, useState } from "react";

export type ToastKind = "success" | "info" | "error";

export interface ToastState {
  message: string;
  kind: ToastKind;
}

/**
 * Maneja notificaciones temporales (toast) con autocierre.
 * Expone el estado actual y una funcion para mostrar mensajes.
 */
export function useToast(autoHideMs = 4500): {
  toast: ToastState | null;
  showToast: (message: string, kind?: ToastKind) => void;
  clearToast: () => void;
} {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  const showToast = useCallback(
    (message: string, kind: ToastKind = "info") => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      setToast({ message, kind });
      timerRef.current = window.setTimeout(() => {
        clearToast();
      }, autoHideMs);
    },
    [autoHideMs, clearToast]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { toast, showToast, clearToast };
}
