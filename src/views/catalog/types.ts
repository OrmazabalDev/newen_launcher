import type { InstanceSummary } from "../../types";
import type { ConfirmOptions } from "../../hooks/useConfirm";
import type { ProjectType, SourceType } from "./constants";

export type CatalogViewProps = {
  instances: InstanceSummary[];
  selectedInstanceId: string;
  onSelectInstance: (id: string) => void;
  onGoInstances: () => void;
  onGoPlay?: () => void;
  onRefreshInstances: () => void | Promise<void>;
  onConfirm: (opts: ConfirmOptions) => Promise<boolean>;
  progressLabel: string;
  initialProjectType?: ProjectType;
  lockedProjectType?: ProjectType;
  title?: string;
  subtitle?: string;
  lockSource?: SourceType;
  hiddenProjectTypes?: ProjectType[];
};

export type { ConfirmOptions } from "../../hooks/useConfirm";
