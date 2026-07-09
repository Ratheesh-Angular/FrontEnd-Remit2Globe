"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useToast, type ToastVariant } from "@/hooks/useToast";
import { cn } from "@/lib/utils";

const variantStyles: Record<
  ToastVariant,
  { wrap: string; icon: typeof CheckCircle2; iconClass: string }
> = {
  success: {
    wrap: "border-red-200 bg-red-50 text-red-900",
    icon: CheckCircle2,
    iconClass: "text-red-600",
  },
  error: {
    wrap: "border-red-200 bg-red-50 text-red-900",
    icon: AlertTriangle,
    iconClass: "text-red-600",
  },
  info: {
    wrap: "border-sky-200 bg-sky-50 text-sky-900",
    icon: Info,
    iconClass: "text-sky-600",
  },
};

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastPrimitive.Provider swipeDirection="up" duration={5000}>
      {toasts.map((t) => {
        const v = variantStyles[t.variant];
        const Icon = v.icon;
        return (
          <ToastPrimitive.Root
            key={t.id}
            open
            onOpenChange={(open) => {
              if (!open) dismiss(t.id);
            }}
            className={cn(
              "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-lg border px-4 py-3 shadow-lg shadow-slate-900/10",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-top-full",
              "data-[state=closed]:slide-out-to-top-full",
              v.wrap,
            )}
          >
            <Icon
              className={cn("mt-0.5 h-5 w-5 shrink-0", v.iconClass)}
              aria-hidden
            />
            <div className="flex-1 min-w-0 pr-6">
              <ToastPrimitive.Title className="text-sm font-semibold leading-snug">
                {t.title}
              </ToastPrimitive.Title>
              {t.description ? (
                <ToastPrimitive.Description className="mt-0.5 text-sm opacity-90 leading-snug">
                  {t.description}
                </ToastPrimitive.Description>
              ) : null}
            </div>
            <ToastPrimitive.Close
              className="absolute right-2 top-2 rounded-md p-1 text-slate-500 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-500/30"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        );
      })}
      <ToastPrimitive.Viewport
        aria-live="polite"
        className={cn(
          "fixed z-[100] flex max-h-screen flex-col gap-2 p-4 outline-none",
          "top-4 left-1/2 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2",
          "md:left-auto md:right-4 md:translate-x-0 md:w-96",
        )}
      />
    </ToastPrimitive.Provider>
  );
}
