import { useState } from "react";
import type { InstanceSummary } from "../types";
import { useInstanceActions } from "../hooks/instances/useInstanceActions";
import { useInstanceSelection } from "../hooks/instances/useInstanceSelection";
import { InstancesHeader } from "./instances/InstancesHeader";
import { InstanceList } from "./instances/InstanceList";
import { InstanceActions } from "./instances/InstanceActions";
import { InstanceDetails } from "./instances/InstanceDetails";
import { statusBox } from "./instances/styles";
import type { ConfirmOptions, CreatePayload } from "./instances/types";

export function InstancesView({
  instances,
  availableVersions,
  selectedInstanceId,
  errorInstanceIds,
  onSelectInstance,
  onCreateInstance,
  onPlayInstance,
  onOpenInstance,
  onDeleteInstance,
  onLoadVersions,
  onConfirm,
  onRefreshInstances,
  isProcessing,
  isLoading,
  globalStatus,
}: {
  instances: InstanceSummary[];
  availableVersions: { id: string; type: "release" | "snapshot" }[];
  selectedInstanceId: string;
  errorInstanceIds: Set<string>;
  onSelectInstance: (id: string) => void;
  onCreateInstance: (payload: CreatePayload) => void;
  onPlayInstance: (id: string) => void;
  onOpenInstance: (id: string) => void;
  onDeleteInstance: (id: string) => void;
  onLoadVersions: () => void;
  onConfirm: (opts: ConfirmOptions) => Promise<boolean>;
  onRefreshInstances?: () => void | Promise<void>;
  isProcessing: boolean;
  isLoading?: boolean;
  globalStatus: string;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [manageInstance, setManageInstance] = useState<InstanceSummary | null>(null);

  const { query, setQuery, filtered } = useInstanceSelection(instances);
  const { importingModpack, importStatus, handleImportModpack } = useInstanceActions({
    onRefreshInstances,
    onSelectInstance,
  });

  const showSkeleton = Boolean(isLoading) && instances.length === 0;

  return (
    <div className="absolute inset-0 z-20 bg-[#0f0f13] flex flex-col overflow-hidden animate-fadeIn">
      <InstancesHeader
        query={query}
        onQueryChange={setQuery}
        isProcessing={isProcessing}
        importingModpack={importingModpack}
        importStatus={importStatus}
        onCreateClick={() => setShowCreate(true)}
        onImportFile={handleImportModpack}
      />

      {globalStatus && (
        <div className="px-8 pt-4">
          <div className={statusBox()} role="status" aria-live="polite">
            {globalStatus}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-8">
          <InstanceList
            filtered={filtered}
            showSkeleton={showSkeleton}
            selectedInstanceId={selectedInstanceId}
            errorInstanceIds={errorInstanceIds}
            query={query}
            onSelectInstance={onSelectInstance}
            onPlayInstance={onPlayInstance}
            onOpenInstance={onOpenInstance}
            onManageInstance={setManageInstance}
            onCreateClick={() => setShowCreate(true)}
            onClearQuery={() => setQuery("")}
          />
        </div>
      </div>

      <InstanceActions
        open={showCreate}
        availableVersions={availableVersions}
        onClose={() => setShowCreate(false)}
        onLoadVersions={onLoadVersions}
        isProcessing={isProcessing}
        onCreate={(payload) => {
          onCreateInstance(payload);
          setShowCreate(false);
        }}
      />

      <InstanceDetails
        instance={manageInstance}
        onClose={() => setManageInstance(null)}
        onConfirm={onConfirm}
        onDeleteInstance={onDeleteInstance}
      />
    </div>
  );
}
