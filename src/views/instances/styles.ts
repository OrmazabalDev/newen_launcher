import { cva } from "class-variance-authority";

export const searchInput = cva(
  "bg-[#1a1a1f] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/40 transition-all w-64"
);

export const primaryButton = cva(
  "flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-xl font-bold hover:bg-brand-accent hover:text-white transition-all shadow-lg shadow-white/5 hover:shadow-brand-accent/20 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
);

export const secondaryButton = cva(
  "flex items-center gap-2 bg-gray-800 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-gray-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
);

export const statusBox = cva(
  "text-sm text-gray-200 bg-white/5 border border-white/10 rounded-xl px-4 py-2"
);

export const skeletonCard = cva(
  "rounded-2xl border border-white/5 bg-[#18181d] p-5 shadow-xl animate-pulse"
);

export const instanceCard = cva(
  "group relative bg-[#18181d] rounded-2xl overflow-hidden border border-white/5 hover:border-brand-accent/30 transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 hover:-translate-y-1 p-5 flex flex-col",
  {
    variants: {
      active: {
        true: "ring-1 ring-brand-accent/50 border-brand-accent/60",
        false: "",
      },
    },
  }
);

export const loaderBadge = cva(
  "text-[10px] font-bold px-2 py-1 rounded-md border bg-white/5",
  {
    variants: {
      loader: {
        fabric: "text-emerald-300 border-emerald-500/30",
        forge: "text-blue-300 border-blue-500/30",
        neoforge: "text-orange-300 border-orange-500/30",
        snapshot: "text-purple-300 border-purple-500/30",
        vanilla: "text-gray-300 border-gray-500/30",
      },
    },
  }
);

export const statusBadge = cva(
  "text-[10px] uppercase font-bold px-2 py-1 rounded-md border",
  {
    variants: {
      tone: {
        active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        error: "bg-red-600/20 text-red-300 border-red-600/40",
        modpack: "bg-brand-info/20 text-brand-info border-brand-info/40",
        multiplayer: "bg-blue-500/20 text-blue-200 border-blue-500/40",
      },
    },
  }
);

export const playButton = cva(
  "col-span-3 py-3 rounded-xl bg-[#25252b] border border-white/5 group-hover:bg-brand-accent group-hover:border-brand-accent group-hover:text-white flex items-center justify-center gap-2 transition-all font-bold text-gray-300 shadow-lg"
);

export const openButton = cva(
  "col-span-1 rounded-xl bg-[#25252b] border border-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
);

export const emptyActionButton = cva("px-4 py-2 rounded-xl font-bold", {
  variants: {
    tone: {
      primary: "bg-brand-accent hover:bg-brand-accent-deep text-white",
      secondary: "bg-gray-800 hover:bg-gray-700 text-white",
    },
  },
});
