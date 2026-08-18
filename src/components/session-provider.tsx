"use client";

import { SessionProvider } from "next-auth/react";

export function NextAuthProvider({ children }: { children: React.ReactNode }) {
  // Poll every 5 min (and on window focus) so an actively-open tab keeps its
  // 30-min session refreshed and never expires mid-work; a closed tab isn't
  // polled, so it lapses and forces a fresh sign-in on return.
  return (
    <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus>
      {children}
    </SessionProvider>
  );
}
