import { cva } from "class-variance-authority";

export const textInput = cva(
  "flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-brand-accent"
);

export const fileInput = cva(
  "block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-brand-accent file:text-white hover:file:bg-brand-accent-deep"
);

export const pillButton = cva("px-4 py-2 rounded-xl text-xs font-bold border", {
  variants: {
    active: {
      true: "bg-brand-accent text-white border-brand-accent/70",
      false: "bg-gray-900 text-gray-300 border-gray-700",
    },
  },
});

export const actionButton = cva(
  "rounded-xl font-bold disabled:opacity-60 disabled:cursor-not-allowed",
  {
    variants: {
      tone: {
        neutral: "bg-gray-800 hover:bg-gray-700 text-white",
        info: "bg-brand-info text-white hover:bg-brand-info/90",
        accent: "bg-brand-accent hover:bg-brand-accent-deep text-white",
      },
      size: {
        sm: "px-4 py-2 text-xs",
        md: "px-4 py-2 text-sm",
        lg: "px-4 py-3 text-sm",
      },
    },
    defaultVariants: {
      tone: "neutral",
      size: "md",
    },
  }
);

export const statusBox = cva(
  "mt-3 text-xs text-gray-300 bg-gray-950/60 border border-gray-800 rounded-xl px-3 py-2"
);

export const capeButton = cva("border rounded-xl p-2", {
  variants: {
    active: {
      true: "border-brand-accent/60 bg-gray-900",
      false: "border-gray-800 bg-gray-950/40",
    },
  },
});
