import { useEffect } from "react";
import type { RefObject } from "react";
import { useModalFocus } from "../../../hooks/useModalFocus";

type CatalogModalBehaviorArgs = {
  isModModalOpen: boolean;
  isCurseModalOpen: boolean;
  isModpackModalOpen: boolean;
  modModalRef: RefObject<HTMLDivElement>;
  modCloseRef: RefObject<HTMLButtonElement>;
  curseModalRef: RefObject<HTMLDivElement>;
  curseCloseRef: RefObject<HTMLButtonElement>;
  modpackModalRef: RefObject<HTMLDivElement>;
  modpackCloseRef: RefObject<HTMLButtonElement>;
  onCloseProjectModal: () => void;
  onCloseCurseModal: () => void;
};

export function useCatalogModalBehavior({
  isModModalOpen,
  isCurseModalOpen,
  isModpackModalOpen,
  modModalRef,
  modCloseRef,
  curseModalRef,
  curseCloseRef,
  modpackModalRef,
  modpackCloseRef,
  onCloseProjectModal,
  onCloseCurseModal,
}: CatalogModalBehaviorArgs) {
  useModalFocus({
    open: isModModalOpen,
    containerRef: modModalRef,
    initialFocusRef: modCloseRef,
    onClose: onCloseProjectModal,
  });

  useModalFocus({
    open: isCurseModalOpen,
    containerRef: curseModalRef,
    initialFocusRef: curseCloseRef,
    onClose: onCloseCurseModal,
  });

  useModalFocus({
    open: isModpackModalOpen,
    containerRef: modpackModalRef,
    initialFocusRef: modpackCloseRef,
    onClose: onCloseProjectModal,
  });

  useEffect(() => {
    if (!isModpackModalOpen && !isModModalOpen) return;
    const originalBody = document.body.style.overflow;
    const originalHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalBody;
      document.documentElement.style.overflow = originalHtml;
    };
  }, [isModpackModalOpen, isModModalOpen]);
}
