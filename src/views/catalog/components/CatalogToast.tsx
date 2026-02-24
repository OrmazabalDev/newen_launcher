import type { CatalogToastState } from "../hooks/useCatalogToast";
import { toast as toastClass, toastActionButton } from "../../../components/toastStyles";

type CatalogToastProps = {
  toast: CatalogToastState | null;
  onAction: () => void;
};

export function CatalogToast({ toast, onAction }: CatalogToastProps) {
  if (!toast) return null;

  return (
    <div
      className={toastClass({
        tone: toast.kind === "success" ? "success" : toast.kind === "error" ? "error" : "info",
        position: "bottomRight",
      })}
      role="status"
      aria-live="polite"
    >
      <div className="flex-1">{toast.message}</div>
      {toast.actionLabel && toast.action && (
        <button type="button" onClick={onAction} className={toastActionButton()}>
          {toast.actionLabel}
        </button>
      )}
    </div>
  );
}
