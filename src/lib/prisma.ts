import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

function connectionString(): string {
  const raw = process.env.DATABASE_URL ?? "";
  return raw.replace(/^"(.*)"$/, "$1").trim();
}

const pool = new pg.Pool({
  connectionString: connectionString(),
  ssl: {
    rejectUnauthorized: false,
  },
});

const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
