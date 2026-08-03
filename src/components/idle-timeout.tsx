"use client";

import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";

/** Sign the user out after this long with no interaction. */
const IDLE_MS = 30 * 60 * 1000;

/**
 * Auto-logout on inactivity. Any mouse/keyboard/touch/scroll activity resets a
 * 30-minute timer; when it fires the session is ended and the user is sent to
 * the sign-in page. Mounted once in the admin layout.
 */
export function IdleTimeout() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const logout = () =>
      signOut({ callbackUrl: "/auth/signin?reason=idle" });

    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(logout, IDLE_MS);
    };

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];
    for (const e of events)
      window.addEventListener(e, reset, { passive: true });
    reset();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      for (const e of events) window.removeEventListener(e, reset);
    };
  }, []);

  return null;
}
