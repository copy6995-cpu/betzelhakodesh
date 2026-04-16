import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config. No bcrypt, no Prisma, no Node-only imports. This
 * file is imported by middleware.ts, which runs on the Edge runtime. The
 * full config with the Credentials `authorize` callback (which needs bcrypt
 * + Prisma) lives in `src/lib/auth.ts` and is used by the API route handlers
 * and server components only.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/auth/signin" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "admin";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isAuthRoute =
        pathname.startsWith("/auth") || pathname.startsWith("/api/auth");
      if (isAuthRoute) return true;
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
