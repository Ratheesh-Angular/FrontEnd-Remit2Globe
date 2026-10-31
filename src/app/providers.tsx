"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { Toaster } from "@/components/ui/toast/Toaster";
import { WhatsAppFloatingButton } from "@/components/WhatsAppFloatingButton";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster />
      <WhatsAppFloatingButton />
    </SessionProvider>
  );
}
