import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]",
        secondary: "border-transparent bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]/80",
        destructive: "border-transparent bg-[var(--danger)] text-white hover:bg-[var(--danger)]/80",
        outline: "text-[var(--text-primary)] border-[var(--border)]",
        success: "border-transparent bg-[var(--success)]/10 text-[var(--success)]",
        warning: "border-transparent bg-[var(--warning)]/10 text-[var(--warning)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
