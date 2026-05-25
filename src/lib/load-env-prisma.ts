/**
 * Loads `.env` files from the frontend package root so `prisma generate` / CLI
 * sees `DATABASE_URL` when run from `cbp-frontend/` (same idea as backend load-env).
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

const frontendRoot = path.resolve(__dirname, "../..");

function determineNodeEnv(): string {
  if (process.env.NODE_ENV) return process.env.NODE_ENV;

  const devLocal = path.join(frontendRoot, ".env.development.local");
  if (fs.existsSync(devLocal)) {
    const result = dotenv.config({ path: devLocal });
    if (result.parsed?.NODE_ENV) return result.parsed.NODE_ENV;
    return "development";
  }

  const prodLocal = path.join(frontendRoot, ".env.production.local");
  if (fs.existsSync(prodLocal)) {
    const result = dotenv.config({ path: prodLocal });
    if (result.parsed?.NODE_ENV) return result.parsed.NODE_ENV;
    return "production";
  }

  const baseEnv = path.join(frontendRoot, ".env");
  if (fs.existsSync(baseEnv)) {
    const result = dotenv.config({ path: baseEnv });
    if (result.parsed?.NODE_ENV) return result.parsed.NODE_ENV;
  }

  return "development";
}

const nodeEnv = determineNodeEnv();

dotenv.config({ path: path.join(frontendRoot, ".env") });

const envLocal = path.join(frontendRoot, ".env.local");
if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal, override: true });
}

const envSpecific = path.join(frontendRoot, `.env.${nodeEnv}`);
if (fs.existsSync(envSpecific)) {
  dotenv.config({ path: envSpecific, override: true });
}

const envSpecificLocal = path.join(frontendRoot, `.env.${nodeEnv}.local`);
if (fs.existsSync(envSpecificLocal)) {
  dotenv.config({ path: envSpecificLocal, override: true });
}
