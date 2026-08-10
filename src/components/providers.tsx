"use client";

import { SessionProvider } from "next-auth/react";
import { AuthSessionGuard } from "@/components/auth-session-guard";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus refetchInterval={60}>
      <AuthSessionGuard>{children}</AuthSessionGuard>
    </SessionProvider>
  );
}
