import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions, loadAppUser } from "@/lib/auth";

/** NextAuth session only when the user row still exists in Postgres. */
export async function getValidatedServerSession(): Promise<Session | null> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id?.trim();
  if (!userId) return null;

  const row = await loadAppUser(userId);
  if (!row) return null;

  return session;
}
