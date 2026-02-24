import React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../utils/cn";

const sectionCardStyles = cva("bg-gray-900/60 border border-gray-800 rounded-2xl p-5");
const sectionTitleStyles = cva("text-lg font-bold text-white mb-2");
const sectionDescriptionStyles = cva("text-xs text-gray-400 mb-4");

type SectionCardProps = React.HTMLAttributes<HTMLElement> & {
  as?: "section" | "div";
  title?: string;
  description?: string;
  titleClassName?: string;
  descriptionClassName?: string;
};

export function SectionCard({
  as = "section",
  title,
  description,
  titleClassName,
  descriptionClassName,
  className,
  children,
  ...props
}: SectionCardProps) {
  const Component = as;

  return (
    <Component className={cn(sectionCardStyles(), className)} {...props}>
      {title ? <h3 className={cn(sectionTitleStyles(), titleClassName)}>{title}</h3> : null}
      {description ? (
        <p className={cn(sectionDescriptionStyles(), descriptionClassName)}>{description}</p>
      ) : null}
      {children}
    </Component>
  );
}
