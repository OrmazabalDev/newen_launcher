import { useEffect } from "react";
import type { RefObject } from "react";

type ModalFocusOptions = {
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onClose?: () => void;
};

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

const getFocusableElements = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden")
  );

const focusElement = (element?: HTMLElement | null) => {
  element?.focus?.();
};

/**
 * Maneja foco y Escape en modales para mejorar accesibilidad.
 */
export function useModalFocus({ open, containerRef, initialFocusRef, onClose }: ModalFocusOptions): void {
  useEffect(() => {
    if (!open) return;

    const container = containerRef.current;
    if (!container) return;

    const previousActive = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const focusInitial = () => {
      const focusables = getFocusableElements(container);
      const initial = initialFocusRef?.current ?? focusables[0] ?? container;
      focusElement(initial);
    };

    const focusFrame = window.requestAnimationFrame(focusInitial);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose?.();
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = getFocusableElements(container);
      if (focusables.length === 0) {
        event.preventDefault();
        focusElement(container);
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const isInside = active ? container.contains(active) : false;

      if (event.shiftKey) {
        if (!isInside || active === first) {
          event.preventDefault();
          focusElement(last);
        }
        return;
      }

      if (!isInside || active === last) {
        event.preventDefault();
        focusElement(first);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousActive && document.body.contains(previousActive)) {
        focusElement(previousActive);
      }
    };
  }, [open, containerRef, initialFocusRef, onClose]);
}
