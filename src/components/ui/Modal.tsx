import React from "react";
import { cn } from "../../utils/cn";

export function Modal({
  open,
  title,
  onClose,
  children,
  className,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className={cn(
          "w-full max-w-lg rounded-2xl border border-white/10 bg-[#18181d] p-6 shadow-2xl",
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        {title && <h3 className="text-lg font-bold text-white mb-4">{title}</h3>}
        {children}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mt-6 text-xs font-semibold text-gray-400 hover:text-white"
          >
            Cerrar
          </button>
        )}
      </div>
    </div>
  );
}
