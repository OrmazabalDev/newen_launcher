import React from "react";
import { cn } from "../../utils/cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border border-white/10 bg-[#18181d] shadow-xl", className)}
      {...props}
    />
  );
}
