import { cva } from "class-variance-authority";

export const toast = cva(
  "fixed rounded-xl border px-4 py-3 text-sm shadow-lg flex items-center gap-3",
  {
    variants: {
      tone: {
        success: "bg-emerald-900/80 border-emerald-700 text-emerald-100",
        error: "bg-red-900/80 border-red-700 text-red-100",
        info: "bg-gray-900/80 border-gray-700 text-gray-100",
      },
      position: {
        topRight: "right-6 top-6 z-50",
        bottomRight: "right-6 bottom-6 z-[60]",
      },
    },
    defaultVariants: {
      tone: "info",
      position: "topRight",
    },
  }
);

export const toastActionButton = cva(
  "px-3 py-1 rounded-full border border-white/20 text-xs font-semibold hover:bg-white/10"
);
