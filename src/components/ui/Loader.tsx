"use client";

import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

export type LoaderVariant = "inline" | "centered" | "page" | "overlay";

export type LoaderProps = {
  /** Layout: inline (row), centered block, full page section, or fixed overlay. */
  variant?: LoaderVariant;
  /** Optional message under the spinner. */
  label?: string;
  /** Smaller secondary line. */
  sublabel?: string;
  className?: string;
  /** Spinner size (not used for overlay card default). */
  size?: "sm" | "md" | "lg" | "xl";
};

/**
 * Theme-aligned loading indicator (red accent, slate text).
 * Use `overlay` for blocking operations (e.g. save/delete in flight).
 */
export function Loader({
  variant = "centered",
  label,
  sublabel,
  className,
  size = "lg",
}: LoaderProps) {
  const core = (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="relative">
        <div
          className="absolute inset-0 rounded-full bg-red-500/15 blur-md scale-150"
          aria-hidden
        />
        <Spinner
          size={variant === "overlay" ? "xl" : size}
          className="relative text-red-600"
        />
      </div>
      {label ? (
        <p className="text-sm font-medium text-slate-700 max-w-xs">{label}</p>
      ) : null}
      {sublabel ? (
        <p className="text-xs text-slate-500 max-w-xs">{sublabel}</p>
      ) : null}
    </div>
  );

  if (variant === "inline") {
    return (
      <div
        className={cn("inline-flex items-center gap-2 text-red-600", className)}
        role="status"
        aria-live="polite"
      >
        <Spinner size={size === "xl" ? "lg" : size} className="text-red-600" />
        {label ? (
          <span className="text-sm text-slate-600">{label}</span>
        ) : null}
      </div>
    );
  }

  if (variant === "page") {
    return (
      <div
        className={cn(
          "flex min-h-[40vh] w-full flex-col items-center justify-center px-4",
          className,
        )}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        {core}
      </div>
    );
  }

  if (variant === "overlay") {
    return (
      <div
        className={cn(
          "fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/35 backdrop-blur-[2px] p-4",
          className,
        )}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="rounded-2xl border border-slate-200/80 bg-white px-10 py-9 shadow-xl shadow-slate-900/10">
          {core}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("flex flex-col items-center justify-center py-8", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {core}
    </div>
  );
}
