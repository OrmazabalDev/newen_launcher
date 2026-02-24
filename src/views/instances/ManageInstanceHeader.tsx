import type { RefObject } from "react";
import type { InstanceSummary } from "../../types";

type ManageInstanceHeaderProps = {
  instance: InstanceSummary;
  closeRef: RefObject<HTMLButtonElement>;
  onClose: () => void;
};

export function ManageInstanceHeader({
  instance,
  closeRef,
  onClose,
}: ManageInstanceHeaderProps) {
  return (
    <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#18181d]">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#25252b] flex items-center justify-center overflow-hidden border border-white/10 p-2">
          {instance.thumbnail ? (
            <img
              src={instance.thumbnail}
              alt={instance.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-sm font-black text-gray-300">
              {instance.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <h3 className="text-xl font-bold text-white" id="manage-instance-title">
            Gestionar: {instance.name}
          </h3>
          <p className="text-xs text-gray-400 font-mono">
            {instance.version} - {instance.loader}
          </p>
        </div>
      </div>
      <button
        ref={closeRef}
        onClick={onClose}
        type="button"
        className="text-gray-400 hover:text-white"
        aria-label="Cerrar"
      >
        X
      </button>
    </div>
  );
}
