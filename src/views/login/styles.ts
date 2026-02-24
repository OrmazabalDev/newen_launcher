import { cva } from "class-variance-authority";

export const page = cva(
  "min-h-screen bg-gray-950 text-white flex items-center justify-center p-6 relative overflow-hidden"
);

export const card = cva(
  "w-full max-w-md bg-gray-900/80 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-gray-800 z-10"
);

export const tabGroup = cva("flex bg-gray-800 p-1 rounded-lg mb-6");

export const tabButton = cva("flex-1 py-2 rounded-md text-sm transition-colors", {
  variants: {
    active: {
      true: "bg-gray-700 text-white",
      false: "text-gray-400 hover:text-white",
    },
  },
});

export const input = cva(
  "w-full px-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-white outline-none focus:border-brand-accent"
);

export const panel = cva("bg-gray-950 border border-gray-700 rounded-xl p-4");

export const actionButton = cva(
  "w-full py-3 rounded-xl text-sm transition disabled:opacity-60 disabled:cursor-not-allowed",
  {
    variants: {
      tone: {
        primary: "bg-brand-accent hover:bg-brand-accent-deep text-white font-bold",
        secondary: "bg-gray-800 hover:bg-gray-700 text-gray-200",
      },
    },
    defaultVariants: {
      tone: "secondary",
    },
  }
);

export const errorBox = cva(
  "text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-xl p-3"
);
