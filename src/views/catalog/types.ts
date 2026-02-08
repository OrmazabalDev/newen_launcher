import type { InstanceSummary } from "../../types";
import type { ProjectType, SourceType } from "./constants";

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

export type CatalogViewProps = {
  instances: InstanceSummary[];
  selectedInstanceId: string;
  onSelectInstance: (id: string) => void;
  onGoInstances?: () => void;
  onGoPlay?: () => void;
  onRefreshInstances?: () => void | Promise<void>;
  onConfirm: (opts: ConfirmOptions) => Promise<boolean>;
  progressLabel?: string;
  initialProjectType?: ProjectType;
  lockedProjectType?: ProjectType;
  title?: string;
  subtitle?: string;
  lockSource?: SourceType;
  hiddenProjectTypes?: ProjectType[];
};
