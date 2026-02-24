import { cva } from "class-variance-authority";

export const heroBadge = cva(
  "px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider border",
  {
    variants: {
      tone: {
        loader: "bg-blue-500/10 text-blue-300 border-blue-500/20",
        mods: "bg-purple-500/10 text-purple-300 border-purple-500/20",
      },
    },
  }
);

export const playButton = cva(
  "group relative px-10 py-6 rounded-2xl flex items-center gap-5 shadow-2xl transition-all duration-300 transform min-w-[280px]",
  {
    variants: {
      state: {
        idle:
          "bg-gradient-to-r from-brand-accent to-orange-500 hover:from-orange-500 hover:to-orange-400 hover:scale-105 hover:shadow-brand-accent/40 active:scale-95",
        busy: "bg-gray-800 cursor-wait scale-95",
      },
    },
  }
);

export const playIcon = cva(
  "p-3 bg-white/20 rounded-xl backdrop-blur-sm transition-transform",
  {
    variants: {
      interactive: {
        true: "group-hover:rotate-12",
        false: "",
      },
    },
  }
);

export const createButton = cva(
  "px-10 py-6 rounded-2xl bg-gradient-to-r from-brand-accent to-orange-500 text-white font-black text-2xl shadow-2xl hover:from-orange-500 hover:to-orange-400 transition-all"
);

export const instanceButton = cva(
  "flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 backdrop-blur-md pr-10 pl-3 py-3 rounded-xl transition-all min-w-[260px] text-left",
  {
    variants: {
      disabled: {
        true: "opacity-60 cursor-not-allowed",
        false: "",
      },
    },
  }
);

export const instanceOption = cva(
  "w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors",
  {
    variants: {
      active: {
        true: "bg-white/5 text-white",
        false: "text-gray-300",
      },
    },
  }
);

export const statusBox = cva("text-sm px-4 py-3 rounded-xl border", {
  variants: {
    tone: {
      error: "text-red-200 border-red-800 bg-red-950/50",
      success: "text-brand-accent border-brand-accent/40 bg-brand-accent/10",
      neutral: "text-gray-200 border-white/10 bg-white/5",
    },
  },
});

export const statusActionButton = cva("px-4 py-2 rounded-xl text-sm", {
  variants: {
    tone: {
      neutral: "bg-white/5 text-gray-200 hover:bg-white/10",
      info: "bg-brand-info text-white hover:bg-brand-info/90",
    },
  },
});
