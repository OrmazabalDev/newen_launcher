import type { InstanceSummary } from "../../types";
import type { ConfirmOptions } from "./types";
import { ManageInstanceModal } from "./ManageInstanceModal";

export function InstanceDetails({
  instance,
  onClose,
  onConfirm,
  onDeleteInstance,
}: {
  instance: InstanceSummary | null;
  onClose: () => void;
  onConfirm: (opts: ConfirmOptions) => Promise<boolean>;
  onDeleteInstance: (id: string) => void;
}) {
  if (!instance) return null;

  return (
    <ManageInstanceModal
      instance={instance}
      onClose={onClose}
      onConfirm={onConfirm}
      onDeleteInstance={onDeleteInstance}
    />
  );
}
