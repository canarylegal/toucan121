import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authConfig } from "@/lib/auth.config";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase();
        const user = await prisma.user.findUnique({
          where: { email },
          include: { host: true },
        });
        if (!user) return null;

        const ok = await compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          hostId: user.host?.id,
          hostSlug: user.host?.slug,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      if (user) {
        token.userId = user.id!;
        token.hostId = user.hostId;
        token.hostSlug = user.hostSlug;
      }

      if (trigger === "update" && token.userId) {
        const host = await prisma.host.findUnique({
          where: { userId: token.userId as string },
          select: { id: true, slug: true },
        });
        token.hostId = host?.id;
        token.hostSlug = host?.slug;
      }

      return token;
    },
  },
});
