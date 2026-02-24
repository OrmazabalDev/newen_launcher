import { cva } from "class-variance-authority";

export const label = cva(
  "block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest"
);

export const textInput = cva(
  "flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-brand-accent"
);

export const selectInput = cva(
  "w-full appearance-none bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-brand-accent"
);

export const rangeInput = cva("w-full accent-brand-accent");

export const pillButton = cva("px-3 py-1.5 rounded-full text-xs font-bold border", {
  variants: {
    active: {
      true: "bg-brand-accent text-white border-brand-accent/70",
      false: "bg-gray-900 text-gray-300 border-gray-700",
    },
  },
});

export const actionButton = cva(
  "px-4 py-2 rounded-xl font-bold disabled:opacity-60 disabled:cursor-not-allowed",
  {
    variants: {
      tone: {
        accent: "bg-brand-accent text-white hover:bg-brand-accent-deep",
        primary: "bg-brand-info text-white hover:bg-brand-info/90",
        secondary: "bg-gray-800 hover:bg-gray-700 text-white",
        muted: "bg-gray-800 text-gray-400 cursor-not-allowed",
      },
      size: {
        sm: "text-xs",
        md: "text-sm",
      },
    },
    defaultVariants: {
      tone: "secondary",
      size: "md",
    },
  }
);

export const toggleRow = cva(
  "flex items-center gap-3 bg-gray-950/60 border border-gray-800 rounded-xl px-4 py-3 cursor-pointer"
);
