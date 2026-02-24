import { useId, useRef } from "react";
import { useModalFocus } from "../hooks/useModalFocus";
import { cn } from "../utils/cn";
import {
  modalBackdrop,
  modalBody,
  modalCard,
  modalPrimaryButton,
  modalSecondaryButton,
  modalTitle,
} from "./modalStyles";

type UpdateModalProps = {
  open: boolean;
  version: string;
  notes?: string | null;
  date?: string | null;
  isDownloading?: boolean;
  error?: string | null;
  onUpdate: () => void;
  onLater: () => void;
};

const formatDate = (value?: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString();
};

export function UpdateModal({
  open,
  version,
  notes,
  date,
  isDownloading = false,
  error,
  onUpdate,
  onLater,
}: UpdateModalProps) {
  const prettyDate = formatDate(date);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const updateRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const summaryId = useId();

  useModalFocus({ open, containerRef: dialogRef, initialFocusRef: updateRef, onClose: onLater });

  if (!open) return null;

  return (
    <div
      className={modalBackdrop()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={summaryId}
    >
      <div ref={dialogRef} className={modalCard({ size: "md" })} tabIndex={-1}>
        <h3 className={modalTitle()} id={titleId}>
          Actualización disponible
        </h3>
        <div className={cn(modalBody(), "space-y-2")} id={summaryId}>
          <div>
            Versión nueva: <span className="text-white font-semibold">{version}</span>
          </div>
          {prettyDate && <div>Publicada: {prettyDate}</div>}
          {notes && (
            <div className="mt-3 bg-gray-950/60 border border-gray-800 rounded-xl p-3 max-h-40 overflow-auto whitespace-pre-wrap text-gray-200">
              {notes}
            </div>
          )}
          {error && <div className="text-red-300">{error}</div>}
        </div>
        <div className="mt-5 space-y-3">
          <button
            onClick={onUpdate}
            type="button"
            disabled={isDownloading}
            ref={updateRef}
            className={cn(
              modalPrimaryButton({ tone: "accent" }),
              isDownloading && "bg-brand-accent/60 hover:bg-brand-accent/60"
            )}
          >
            {isDownloading && (
              <span className="inline-block h-4 w-4 rounded-full border-2 border-white/60 border-t-white animate-spin" />
            )}
            {isDownloading ? "Actualizando..." : "Actualizar ahora"}
          </button>
          <button
            onClick={onLater}
            type="button"
            disabled={isDownloading}
            className={modalSecondaryButton()}
          >
            Actualizar más tarde
          </button>
        </div>
      </div>
    </div>
  );
}
