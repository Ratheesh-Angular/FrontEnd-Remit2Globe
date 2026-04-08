import { cn } from "@/lib/utils";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "pending";
type BadgeSize = "sm" | "md";

interface BadgeProps {
  variant: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, { badge: string; dot: string }> = {
  success: { badge: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  warning: { badge: "bg-amber-50 text-amber-700",     dot: "bg-amber-500"   },
  danger:  { badge: "bg-red-50 text-red-700",          dot: "bg-red-500"     },
  info:    { badge: "bg-blue-50 text-blue-700",         dot: "bg-blue-500"    },
  neutral: { badge: "bg-slate-100 text-slate-600",      dot: "bg-slate-400"   },
  pending: { badge: "bg-orange-50 text-orange-700",     dot: "bg-orange-500"  },
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
};

const dotSizeClasses: Record<BadgeSize, string> = {
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
};

export function Badge({
  variant,
  size = "md",
  dot = false,
  children,
  className,
}: BadgeProps) {
  const { badge, dot: dotColor } = variantClasses[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        badge,
        sizeClasses[size],
        className,
      )}
    >
      {dot && (
        <span
          className={cn("rounded-full flex-shrink-0", dotColor, dotSizeClasses[size])}
        />
      )}
      {children}
    </span>
  );
}
