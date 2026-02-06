import React from "react";

export function GlobalProgress({
  isProcessing,
  status,
  progress,
  isActive,
}: {
  isProcessing: boolean;
  status: string;
  progress: number;
  isActive: boolean;
}) {
  const active = isActive || (isProcessing && progress > 0);
  if (!active) return null;

  const value = Math.round(progress);
  const label = status.trim() ? status : "Procesando...";

  return (
    <div className="fixed top-0 left-64 right-0 z-50">
      <div className="bg-gray-950/90 border-b border-gray-800 px-4 py-2 flex items-center gap-3">
        <div className="text-xs text-gray-300 truncate">{label}</div>
        <div className="ml-auto text-xs text-gray-400">{value}%</div>
      </div>
      <div className="h-1 bg-gray-800">
        <div
          className="h-1 bg-gradient-to-r from-brand-accent to-brand-accent-deep transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
