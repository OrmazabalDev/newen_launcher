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

type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const messageId = useId();

  useModalFocus({ open, containerRef: dialogRef, initialFocusRef: confirmRef, onClose: onCancel });

  if (!open) return null;

  return (
    <div
      className={modalBackdrop()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={messageId}
    >
      <div ref={dialogRef} className={modalCard({ size: "sm", align: "center" })} tabIndex={-1}>
        <h3 className={modalTitle()} id={titleId}>
          {title}
        </h3>
        <p className={modalBody()} id={messageId}>
          {message}
        </p>
        <div className="space-y-3 mt-4">
          <button
            onClick={onConfirm}
            type="button"
            ref={confirmRef}
            className={cn(modalPrimaryButton({ tone: danger ? "danger" : "accent" }))}
          >
            {confirmLabel}
          </button>
          <button onClick={onCancel} type="button" className={modalSecondaryButton()}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
