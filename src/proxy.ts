import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Proxy (Next 16's rename of middleware) runs on the Edge runtime, so we use
// the minimal authConfig only (no bcrypt, no Prisma). The NextAuth-created
// `auth` performs the JWT check and runs the `authorized` callback defined in
// authConfig.
export const { auth: proxy } = NextAuth(authConfig);
export default proxy;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
