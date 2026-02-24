import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utils/cn";

const badgeStyles = cva(
  "inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-bold uppercase",
  {
    variants: {
      variant: {
        neutral: "bg-white/5 text-gray-300 border-white/10",
        accent: "bg-brand-accent/20 text-brand-accent border-brand-accent/40",
        success: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        warning: "bg-orange-500/20 text-orange-300 border-orange-500/40",
        danger: "bg-red-600/20 text-red-300 border-red-600/40",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeStyles>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeStyles({ variant }), className)} {...props} />;
}
