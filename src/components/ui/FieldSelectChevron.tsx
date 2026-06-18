import { cn } from "@/lib/utils";

/** Chevron used on searchable select triggers and native `<select>` fields. */
export function FieldSelectChevron({ className }: { className?: string }) {
  return (
    <svg
      className={cn("w-4 h-4 text-slate-400 shrink-0", className)}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}
