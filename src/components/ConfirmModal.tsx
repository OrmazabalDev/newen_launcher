import React, { useId, useRef } from "react";
import { useModalFocus } from "../hooks/useModalFocus";

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
      className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-950/90 backdrop-blur-sm animate-fadeIn p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={messageId}
    >
      <div
        ref={dialogRef}
        className="bg-gray-900 p-8 rounded-2xl shadow-2xl border border-gray-700 max-w-sm w-full text-center"
        tabIndex={-1}
      >
        <h3 className="text-xl font-bold text-white mb-2" id={titleId}>
          {title}
        </h3>
        <p className="text-sm text-gray-300" id={messageId}>
          {message}
        </p>
        <div className="space-y-3 mt-4">
          <button
            onClick={onConfirm}
            type="button"
            ref={confirmRef}
            className={`w-full py-3 rounded-xl font-bold text-white transition active:scale-[0.98] ${
              danger ? "bg-red-600 hover:bg-red-500" : "bg-brand-accent hover:bg-brand-accent-deep"
            }`}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            type="button"
            className="w-full py-3 bg-gray-800 rounded-xl text-gray-300 transition hover:bg-gray-700"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
