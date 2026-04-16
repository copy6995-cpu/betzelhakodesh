"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/auth/signin" })}
      className="px-3 py-1.5 text-sm rounded-md border border-white/20 text-white/80 hover:text-white hover:border-white/40 transition-colors"
    >
      יציאה
    </button>
  );
}
