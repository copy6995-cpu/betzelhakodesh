import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Middleware runs on the Edge runtime, so we use the minimal authConfig only
// (no bcrypt, no Prisma). The NextAuth-created `auth` here performs the JWT
// check and runs the `authorized` callback defined in authConfig.
export const { auth: middleware } = NextAuth(authConfig);
export default middleware;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
