import { cva } from "class-variance-authority";

export const modalBackdrop = cva(
  "fixed inset-0 flex items-center justify-center bg-gray-950/90 backdrop-blur-sm",
  {
    variants: {
      context: {
        default: "z-[80] animate-fadeIn p-4",
        catalog: "z-50 p-6 overscroll-contain",
      },
    },
    defaultVariants: {
      context: "default",
    },
  }
);

export const modalCard = cva("w-full rounded-2xl shadow-2xl border bg-gray-900", {
  variants: {
    size: {
      sm: "max-w-sm",
      md: "max-w-lg",
      lg: "max-w-2xl",
      xl: "max-w-3xl",
      "2xl": "max-w-4xl",
    },
    padding: {
      roomy: "p-8",
      dense: "p-6",
      none: "p-0",
    },
    tone: {
      default: "border-gray-700",
      subtle: "border-gray-800",
    },
    align: {
      left: "",
      center: "text-center",
    },
    overflow: {
      visible: "",
      hidden: "overflow-hidden",
    },
  },
  defaultVariants: {
    size: "md",
    padding: "roomy",
    tone: "default",
    align: "left",
    overflow: "visible",
  },
});

export const modalTitle = cva("text-xl font-bold text-white mb-2");

export const modalBody = cva("text-sm text-gray-300");

export const modalPrimaryButton = cva(
  "w-full py-3 rounded-xl font-bold text-white transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed",
  {
    variants: {
      tone: {
        accent: "bg-brand-accent hover:bg-brand-accent-deep",
        danger: "bg-red-600 hover:bg-red-500",
      },
    },
    defaultVariants: {
      tone: "accent",
    },
  }
);

export const modalSecondaryButton = cva(
  "w-full py-3 bg-gray-800 rounded-xl text-gray-300 transition hover:bg-gray-700 disabled:opacity-60"
);
