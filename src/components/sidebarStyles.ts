import { cva } from "class-variance-authority";

export const sidebar = cva(
  "w-64 bg-gray-900 border-r border-gray-800 flex flex-col justify-between p-4 z-20 shadow-2xl transition",
  {
    variants: {
      running: {
        true: "opacity-80",
        false: "opacity-100",
      },
    },
  }
);

export const navButton = cva(
  "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition",
  {
    variants: {
      active: {
        true: "bg-gray-800 text-white shadow-sm border border-brand-accent/60",
        false: "text-gray-300 hover:bg-gray-800/50 hover:text-white",
      },
    },
  }
);

export const gameAlert = cva(
  "mb-4 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200"
);

export const profileCard = cva(
  "bg-gray-950/50 p-3 rounded-xl border border-gray-800 flex items-center gap-3"
);

export const logoutButton = cva("text-gray-500 hover:text-red-400");
