import type { CreatePayload } from "./types";
import { CreateInstanceModal } from "./CreateInstanceModal";

export function InstanceActions({
  open,
  availableVersions,
  isProcessing,
  onClose,
  onCreate,
  onLoadVersions,
}: {
  open: boolean;
  availableVersions: { id: string; type: "release" | "snapshot" }[];
  isProcessing: boolean;
  onClose: () => void;
  onCreate: (payload: CreatePayload) => void;
  onLoadVersions: () => void;
}) {
  if (!open) return null;

  return (
    <CreateInstanceModal
      availableVersions={availableVersions}
      onClose={onClose}
      onCreate={onCreate}
      onLoadVersions={onLoadVersions}
      isProcessing={isProcessing}
    />
  );
}
