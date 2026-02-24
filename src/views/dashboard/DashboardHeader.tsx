import { HardDrive } from "lucide-react";

export function DashboardHeader({
  ramDisplay,
  launcherReserved,
}: {
  ramDisplay: string;
  launcherReserved: string;
}) {
  return (
    <header className="relative z-10 flex justify-end p-6">
      <div className="flex flex-col items-end gap-2">
        <div className="flex gap-4 bg-black/40 backdrop-blur-md border border-white/5 px-4 py-2 rounded-full text-xs font-mono text-gray-300">
          <div className="flex items-center gap-2">
            <HardDrive size={14} className="text-blue-400" />
            <span className="hidden md:inline">RAM: {ramDisplay}</span>
            <span className="md:hidden">RAM {ramDisplay}</span>
          </div>
        </div>
        <div className="text-[11px] text-gray-400 bg-black/30 border border-white/5 rounded-full px-3 py-1 font-mono">
          Launcher reservada: {launcherReserved}
        </div>
      </div>
    </header>
  );
}
