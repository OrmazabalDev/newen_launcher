import { useId, useRef } from "react";
import { useModalFocus } from "../hooks/useModalFocus";
import {
  modalBackdrop,
  modalBody,
  modalCard,
  modalPrimaryButton,
  modalSecondaryButton,
  modalTitle,
} from "./modalStyles";

type JavaModalProps = {
  open: boolean;
  onRetryDownload: () => void;
  onClose: () => void;
};

export function JavaModal({ open, onRetryDownload, onClose }: JavaModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const retryRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const messageId = useId();

  useModalFocus({ open, containerRef: dialogRef, initialFocusRef: retryRef, onClose });

  if (!open) return null;

  return (
    <div
      className={modalBackdrop()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={messageId}
    >
      <div
        ref={dialogRef}
        className={modalCard({ size: "sm", align: "center" })}
        tabIndex={-1}
      >
        <h3 className={modalTitle()} id={titleId}>
          Java no disponible
        </h3>
        <p className={modalBody()} id={messageId}>
          No se pudo preparar Java automáticamente. Reintenta la descarga.
        </p>
        <div className="space-y-3 mt-4">
          <button
            onClick={onRetryDownload}
            type="button"
            ref={retryRef}
            className={modalPrimaryButton({ tone: "accent" })}
            aria-labelledby={titleId}
          >
            Reintentar descarga
          </button>
          <button onClick={onClose} type="button" className={modalSecondaryButton()}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
