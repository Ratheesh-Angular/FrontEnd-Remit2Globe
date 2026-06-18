import type { ReactNode } from "react";
import { FieldSelectChevron } from "./FieldSelectChevron";

/** Positions the standard field chevron over a native `<select>`. */
export function NativeSelectShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center"
        aria-hidden
      >
        <FieldSelectChevron />
      </span>
    </div>
  );
}
