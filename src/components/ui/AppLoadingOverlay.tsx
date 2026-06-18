"use client";

import { Loader } from "@/components/ui/Loader";

type AppLoadingOverlayProps = {
  show: boolean;
  label?: string;
  sublabel?: string;
};

export function AppLoadingOverlay({
  show,
  label = "Please wait…",
  sublabel,
}: AppLoadingOverlayProps) {
  if (!show) return null;
  return <Loader variant="overlay" label={label} sublabel={sublabel} />;
}
