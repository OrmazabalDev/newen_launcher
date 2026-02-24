import { cva } from "class-variance-authority";

export const panel = cva("border border-gray-800 rounded-2xl", {
  variants: {
    tone: {
      soft: "bg-gray-900/60",
      glass: "bg-gray-900/70",
      dark: "bg-gray-950/60",
    },
    size: {
      sm: "p-4",
      md: "p-6",
      lg: "p-8",
    },
  },
  defaultVariants: {
    tone: "soft",
    size: "sm",
  },
});

export const panelCompact = cva("bg-gray-950/60 border border-gray-800 rounded-xl p-3");

export const inlineInfo = cva(
  "text-xs text-gray-400 bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-2"
);

export const selectInput = cva(
  "w-full appearance-none bg-gray-900 border border-gray-700 rounded-xl text-white outline-none focus:border-brand-accent",
  {
    variants: {
      size: {
        md: "px-4 py-2.5",
        sm: "px-3 py-2.5 text-sm",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

export const selectCompact = cva(
  "bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white"
);

export const textInput = cva(
  "flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white outline-none focus:border-brand-accent"
);

export const pillButton = cva("px-4 py-2 rounded-full text-xs font-bold border", {
  variants: {
    active: {
      true: "bg-brand-accent text-white border-brand-accent/70",
      false: "bg-gray-900 text-gray-300 border-gray-700",
    },
  },
});

export const chipButton = cva("px-3 py-2 rounded-xl text-xs font-bold border", {
  variants: {
    active: {
      true: "bg-brand-accent text-white border-brand-accent/70",
      false: "bg-gray-900 text-gray-300 border-gray-700",
    },
  },
});

export const sourceButton = cva("px-3 py-2 rounded-xl text-xs font-bold", {
  variants: {
    active: {
      true: "bg-brand-accent text-white",
      false: "bg-gray-900 text-gray-300 border border-gray-700",
    },
  },
});

export const primaryButton = cva(
  "px-4 py-2 rounded-xl font-bold text-white disabled:opacity-60 disabled:cursor-not-allowed",
  {
  variants: {
    tone: {
      accent: "bg-brand-accent hover:bg-brand-accent-deep",
      info: "bg-brand-info hover:bg-brand-info/90",
      gray: "bg-gray-800 hover:bg-gray-700",
    },
  },
  defaultVariants: {
    tone: "accent",
  },
  }
);

export const resultsCard = cva(
  "text-left rounded-2xl border p-4 bg-gray-900/70 hover:bg-gray-900 transition",
  {
    variants: {
      active: {
        true: "border-brand-accent/70",
        false: "border-gray-800",
      },
    },
  }
);

export const skeletonCard = cva(
  "rounded-2xl border border-gray-800 bg-gray-900/70 p-4 animate-pulse"
);

export const tagPill = cva("px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700", {
  variants: {
    size: {
      sm: "text-[10px]",
    },
  },
  defaultVariants: {
    size: "sm",
  },
});

export const installedBadge = cva(
  "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border",
  {
    variants: {
      tone: {
        active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        disabled: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      },
    },
  }
);

export const paginationButton = cva(
  "px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-gray-300 disabled:opacity-50"
);

export const alertBox = cva(
  "mb-4 flex flex-wrap items-center gap-2 rounded-xl border px-4 py-2 text-xs",
  {
    variants: {
      tone: {
        warning: "border-amber-500/40 bg-amber-500/10 text-amber-200",
        info: "text-gray-200 bg-gray-900/70 border-gray-800",
      },
    },
  }
);

export const toast = cva(
  "fixed right-6 bottom-6 z-[60] rounded-xl border px-4 py-3 text-sm shadow-lg flex items-center gap-3",
  {
    variants: {
      tone: {
        success: "bg-emerald-900/80 border-emerald-700 text-emerald-100",
        error: "bg-red-900/80 border-red-700 text-red-100",
        info: "bg-gray-900/80 border-gray-700 text-gray-100",
      },
    },
  }
);

export const textButton = cva("text-gray-400 hover:text-white");
