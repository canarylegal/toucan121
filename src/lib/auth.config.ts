import type { NextAuthConfig } from "next-auth";

/** Edge-safe Auth.js config (no Prisma / Node APIs). */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isHostArea = request.nextUrl.pathname.startsWith("/dash");
      if (isHostArea) return !!auth;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id!;
        token.hostId = user.hostId;
        token.hostSlug = user.hostSlug;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.hostId = token.hostId as string | undefined;
        session.user.hostSlug = token.hostSlug as string | undefined;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
