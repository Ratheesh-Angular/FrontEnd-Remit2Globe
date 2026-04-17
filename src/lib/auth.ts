import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import PostgresAdapter from "@auth/pg-adapter";
import pool from "@/lib/db";

type AppUserRow = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  role: string;
  kycStatus: string;
  createdAt: Date;
  emailVerified: boolean | null;
  phoneVerified: boolean;
};

async function loadAppUser(id: string) {
  const { rows } = await pool.query<AppUserRow>(
    `SELECT id, email, name, image, role, "kycStatus", "createdAt",
            "emailVerified", "phoneVerified"
     FROM "User" WHERE id = $1`,
    [id],
  );
  return rows[0];
}

export const authOptions: NextAuthOptions = {
  adapter: PostgresAdapter(pool),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/register",
    error: "/register",
  },
  // JWT avoids adapter `createSession` / Session table issues while User + Account stay in Postgres.
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user?.id) {
        token.sub = user.id;
      }

      const sub = token.sub;
      if (!sub) return token;

      const shouldRefresh = Boolean(user) || trigger === "update";
      if (!shouldRefresh) return token;

      try {
        const u = await loadAppUser(sub);
        if (u) {
          token.email = u.email ?? undefined;
          token.name = u.name ?? undefined;
          token.picture = u.image ?? undefined;
          token.role = u.role;
          token.kycStatus = u.kycStatus;
          token.createdAt = new Date(u.createdAt).toISOString();
          token.emailVerified = u.emailVerified ?? false;
          token.phoneVerified = u.phoneVerified;
        }
      } catch (e) {
        console.error("[auth] jwt callback:", e);
      }

      return token;
    },
    async session({ session, token }) {
      if (!session.user || !token.sub) return session;

      session.user.id = token.sub;
      session.user.email = (token.email as string | null | undefined) ?? null;
      session.user.name = (token.name as string | null | undefined) ?? null;
      session.user.image = (token.picture as string | null | undefined) ?? null;
      session.user.role = token.role as string | undefined;
      session.user.kycStatus = token.kycStatus as string | undefined;
      session.user.createdAt = token.createdAt as string | undefined;
      session.user.emailVerified = token.emailVerified as boolean | undefined;
      session.user.phoneVerified = token.phoneVerified as boolean | undefined;

      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user?.id) return;

      try {
        await pool.query(
          `UPDATE "User"
           SET "googleId" = $1,
               name = COALESCE($2, name),
               image = COALESCE($3, image),
               "emailVerified" = true
           WHERE id = $4`,
          [
            account.providerAccountId,
            user.name ?? null,
            user.image ?? null,
            user.id,
          ],
        );
      } catch (e) {
        console.error("[auth] events.signIn google sync:", e);
      }
    },
  },
};
