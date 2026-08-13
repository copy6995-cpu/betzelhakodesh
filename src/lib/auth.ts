import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { authConfig } from "@/auth.config";
import { parseSections } from "./sections";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email as string;
        const password = credentials.password as string;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        // A "rep" login is bound to one Representative; carry its kind so the
        // edge layer can route/lock them to the right single page.
        let repKind: string | null = null;
        if (user.role === "rep" && user.repId) {
          const rep = await prisma.representative.findUnique({
            where: { id: user.repId },
            select: { kind: true },
          });
          repKind = rep?.kind ?? null;
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          sections: parseSections(user.sections),
          repId: user.repId ?? null,
          repKind,
        };
      },
    }),
  ],
});
