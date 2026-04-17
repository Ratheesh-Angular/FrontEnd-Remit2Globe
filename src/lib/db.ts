import { Pool } from "pg";

function connectionString(): string {
  const raw = process.env.DATABASE_URL ?? "";
  return raw.replace(/^"(.*)"$/, "$1").trim();
}

const pool = new Pool({
  connectionString: connectionString(),
});

export default pool;
