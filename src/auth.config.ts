import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config. No bcrypt, no Prisma, no Node-only imports. This
 * file is imported by middleware.ts, which runs on the Edge runtime. The
 * full config with the Credentials `authorize` callback (which needs bcrypt
 * + Prisma) lives in `src/lib/auth.ts` and is used by the API route handlers
 * and server components only.
 */
export const authConfig = {
  // We run behind a proxy (Vercel / Traefik set the Host header), so NextAuth's
  // default strict host check would reject the request with `UntrustedHost`.
  // Enabling trustHost tells it to use the proxied Host/X-Forwarded-* values.
  trustHost: true,
  // NextAuth v5 defaults to reading AUTH_SECRET; accept the classic
  // NEXTAUTH_SECRET too so the same env var works everywhere. Without a secret
  // in production it throws "There is a problem with the server configuration".
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
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
