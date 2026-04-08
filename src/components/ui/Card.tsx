import { cn } from "@/lib/utils";

interface CardProps {
  title?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Card({
  title,
  description,
  children,
  className,
  noPadding = false,
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-white border border-slate-200 rounded-xl shadow-sm",
        className,
      )}
    >
      {(title || description) && (
        <div className={cn("border-b border-slate-200", !noPadding && "px-6 py-4")}>
          {title && (
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          )}
          {description && (
            <p className="mt-0.5 text-sm text-slate-500">{description}</p>
          )}
        </div>
      )}
      <div className={cn(!noPadding && "p-6")}>{children}</div>
    </div>
  );
}
