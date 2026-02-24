import { useEffect, useRef, useState } from "react";
import { Edit3 } from "lucide-react";
import { IconChevronDown } from "../../icons";
import type { InstanceSummary } from "../../types";
import { instanceButton, instanceOption } from "./styles";

export function DashboardInstancePicker({
  instances,
  selectedInstanceId,
  selectedInstance,
  instanceInitial,
  loaderLabel,
  loaderDotClass,
  canSelect,
  onSelectInstance,
  onGoInstances,
}: {
  instances: InstanceSummary[];
  selectedInstanceId: string;
  selectedInstance: InstanceSummary | null;
  instanceInitial: string;
  loaderLabel: string;
  loaderDotClass: string;
  canSelect: boolean;
  onSelectInstance: (id: string) => void;
  onGoInstances: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-gray-500 font-bold uppercase tracking-widest pl-1">
        Instancia activa
      </span>
      <div className="relative group" ref={containerRef}>
        <button
          type="button"
          onClick={() => {
            if (!canSelect) return;
            setIsOpen((prev) => !prev);
          }}
          disabled={!canSelect}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={instanceButton({ disabled: !canSelect })}
        >
          <div className="w-12 h-12 rounded-lg bg-[#25252b] flex items-center justify-center overflow-hidden border border-white/10 shadow-inner p-1">
            {selectedInstance?.thumbnail ? (
              <img
                src={selectedInstance.thumbnail}
                alt={selectedInstance.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm font-black text-gray-300">{instanceInitial}</span>
            )}
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="font-bold text-base text-gray-200 truncate max-w-[160px]">
              {selectedInstance ? selectedInstance.name : "Sin instancia"}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${loaderDotClass}`}></span>
              <p className="text-xs text-gray-400">
                {loaderLabel} {selectedInstance?.version || "N/A"}
              </p>
            </div>
          </div>
          <IconChevronDown />
        </button>

        {isOpen && (
          <div
            role="listbox"
            className="absolute mt-2 w-full min-w-[260px] bg-[#141419] border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden"
          >
            <div className="max-h-64 overflow-y-auto custom-scrollbar">
              {instances.map((inst) => (
                <button
                  key={inst.id}
                  role="option"
                  aria-selected={inst.id === selectedInstanceId}
                  type="button"
                  onClick={() => {
                    onSelectInstance(inst.id);
                    setIsOpen(false);
                  }}
                  className={instanceOption({ active: inst.id === selectedInstanceId })}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#25252b] flex items-center justify-center overflow-hidden border border-white/10 p-1">
                      {inst.thumbnail ? (
                        <img
                          src={inst.thumbnail}
                          alt={inst.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-black text-gray-300">
                          {inst.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{inst.name}</div>
                      <div className="text-xs text-gray-500">
                        {inst.loader} · {inst.version}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onGoInstances}
          className="absolute -right-3 -top-3 w-8 h-8 bg-[#1e1e24] border border-white/10 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:border-brand-accent hover:bg-brand-accent/10 transition-all opacity-0 group-hover:opacity-100 shadow-lg scale-90 group-hover:scale-100"
          title="Editar instancia"
        >
          <Edit3 size={14} />
        </button>
      </div>
    </div>
  );
}
