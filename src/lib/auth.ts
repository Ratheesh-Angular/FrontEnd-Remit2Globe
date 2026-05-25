import type { NextAuthOptions } from "next-auth";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

function normalizeUserWrite(data: Partial<AdapterUser>): Record<string, unknown> {
  const { emailVerified, ...rest } = data;
  const out: Record<string, unknown> = { ...rest };
  if (emailVerified === undefined) {
    /* omit — use column default */
  } else if (emailVerified instanceof Date) {
    out.emailVerified = true;
  } else if (emailVerified === null) {
    out.emailVerified = false;
  } else if (typeof emailVerified === "boolean") {
    out.emailVerified = emailVerified;
  }
  return out;
}

/** NextAuth passes `emailVerified` as `Date`; Prisma schema uses `Boolean`. */
function prismaAdapterWithBooleanEmailVerified(): Adapter {
  const base = PrismaAdapter(prisma);
  return {
    ...base,
    async createUser(data: Parameters<NonNullable<Adapter["createUser"]>>[0]) {
      const user = await prisma.user.create({
        data: normalizeUserWrite(data) as Prisma.UserCreateInput,
      });
      return user as unknown as AdapterUser;
    },
    async updateUser(
      input: Partial<AdapterUser> & Pick<AdapterUser, "id">,
    ) {
      const { id, ...data } = input;
      const user = await prisma.user.update({
        where: { id },
        data: normalizeUserWrite(data) as Prisma.UserUpdateInput,
      });
      return user as unknown as AdapterUser;
    },
  };
}

function buildIndividualDisplayName(
  ip: {
    fullName: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
  } | null,
): string | null {
  if (!ip) return null;
  const full = ip.fullName?.trim();
  if (full) return full;
  const parts = [ip.firstName, ip.middleName, ip.lastName]
    .map((s) => (s ?? "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

/** Display name: KYC profile first, then OAuth/account `User.name`. */
function resolveUserDisplayName(
  u: {
    name: string | null;
    role: string;
    individualProfile: {
      fullName: string | null;
      firstName: string | null;
      middleName: string | null;
      lastName: string | null;
    } | null;
    corporateProfile: { businessName: string | null } | null;
  },
): string | null {
  const accountName = u.name?.trim() || null;
  if (u.role === "CORPORATE") {
    return u.corporateProfile?.businessName?.trim() || accountName;
  }
  return buildIndividualDisplayName(u.individualProfile) || accountName;
}

export type AppUserRow = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  role: string;
  kycStatus: string;
  createdAt: Date;
  emailVerified: boolean;
  phoneVerified: boolean;
};

export async function loadAppUser(id: string): Promise<AppUserRow | null> {
  const u = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      kycStatus: true,
      createdAt: true,
      emailVerified: true,
      phoneVerified: true,
      individualProfile: {
        select: {
          fullName: true,
          firstName: true,
          middleName: true,
          lastName: true,
        },
      },
      corporateProfile: {
        select: { businessName: true },
      },
    },
  });
  if (!u) return null;
  const name = resolveUserDisplayName(u);
  return {
    id: u.id,
    email: u.email,
    name,
    image: u.image,
    role: u.role,
    kycStatus: u.kycStatus,
    createdAt: u.createdAt,
    emailVerified: u.emailVerified,
    phoneVerified: u.phoneVerified,
  };
}

export const authOptions: NextAuthOptions = {
  adapter: prismaAdapterWithBooleanEmailVerified(),
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
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }

      const sub = token.sub;
      if (!sub) return token;

      try {
        const u = await loadAppUser(sub);
        if (!u) {
          console.warn("[auth] jwt callback: user not found, invalidating session", {
            sub,
          });
          return {};
        }

        token.email = u.email ?? undefined;
        token.name = u.name ?? undefined;
        token.picture = u.image ?? undefined;
        token.role = u.role;
        token.kycStatus = u.kycStatus;
        token.createdAt = new Date(u.createdAt).toISOString();
        token.emailVerified = u.emailVerified ?? false;
        token.phoneVerified = u.phoneVerified;
      } catch (e) {
        console.error("[auth] jwt callback:", e);
      }

      return token;
    },
    async session({ session, token }) {
      if (!token.sub) {
        return {
          expires: "1970-01-01T00:00:00.000Z",
          user: undefined as never,
        };
      }

      if (!session.user) return session;

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
        await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: account.providerAccountId,
            ...(user.name != null ? { name: user.name } : {}),
            ...(user.image != null ? { image: user.image } : {}),
            emailVerified: true,
          },
        });
      } catch (e) {
        console.error("[auth] events.signIn google sync:", e);
      }
    },
  },
};
