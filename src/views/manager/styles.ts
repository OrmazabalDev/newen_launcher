import { cva } from "class-variance-authority";

export const toggleBox = cva(
  "flex items-center gap-3 bg-gray-900 p-2 rounded-lg border border-gray-800"
);

export const versionRow = cva(
  "bg-gray-900/50 border border-gray-800 p-4 rounded-xl flex items-center justify-between hover:bg-gray-900 transition group"
);

export const installedBadge = cva(
  "ml-2 bg-gray-700 text-gray-300 text-[10px] px-2 py-0.5 rounded uppercase"
);

export const installButton = cva(
  "px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2",
  {
    variants: {
      state: {
        installed: "bg-gray-800 text-gray-400 cursor-default",
        ready: "bg-brand-accent hover:bg-brand-accent-deep text-white shadow-lg",
      },
    },
  }
);

export const outlineButton = cva("px-4 py-2 rounded-lg font-bold text-sm border", {
  variants: {
    disabled: {
      true: "border-gray-800 text-gray-700 cursor-not-allowed",
      false: "border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white",
    },
  },
});
