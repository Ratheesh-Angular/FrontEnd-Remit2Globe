This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

**Full local stack:** Pages that load Flex country lists (register, beneficiaries, etc.) call Next **BFF** routes such as `GET /api/public-flex/countries`, which proxy to the Express API. Run **`cbp-backend`** as well (default **`http://localhost:8000`**) or set **`BACKEND_API_URL`** / **`NEXT_PUBLIC_API_URL`** to a reachable **`…/api`** root; otherwise those routes return **502** (`ECONNREFUSED`).

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Copy [`.env.example`](./.env.example) to **`.env`** and set variables before running in production. Use **`.env`** only (this repo standardizes on `.env` + `.env.example`).

**Prisma (NextAuth):** This app uses [`prisma/schema.prisma`](./prisma/schema.prisma) only to generate `@prisma/client` for Google OAuth (`PrismaAdapter`). Migrations are owned by **`cbp-backend`**. When you change the backend schema, copy/sync `cbp-backend/prisma/schema.prisma` into `cbp-frontend/prisma/schema.prisma` (keep `generator output = "../src/generated/prisma"`), then run **`npm run prisma:generate`** (also runs on **`postinstall`**).

## Production on AWS EC2

1. **Environment:** Set the same variables as `.env.example` on the instance (systemd `EnvironmentFile`, PM2 `env`, or shell). Never commit real `.env`. Use `NODE_ENV=production`.
2. **Build and start:** `npm ci && npm run build` then `npm run start` (listens on port **3000** by default; override with `PORT` if needed). Pass production **`NEXT_PUBLIC_*`** values at **build** time (or in the CI env before `next build`); the browser bundle does not pick up new `NEXT_PUBLIC_*` from the server’s `.env` after a build unless you rebuild.
3. **TLS and domain:** Prefer a reverse proxy (nginx, Caddy) or ALB in front with HTTPS. Set **`NEXTAUTH_URL`** and **`NEXT_PUBLIC_SITE_URL`** to the **public** URL users use (scheme + host, no trailing path unless that is your app root).
4. **`NEXT_PUBLIC_API_URL`:** Must be reachable from the browser (public Express `/api` root). It is inlined into client JS at **`next build`** — set it to your production API (for example `http://<api-host>/api`) when building the image or artifact. If it still points at `localhost` in the bundle, country/bank lists use `GET /api/public-flex/*`, which must exist on the Next server (and your reverse proxy must forward those paths to Node, not only to Express). Server-side fetches prefer **`BACKEND_INTERNAL_API_URL`** then **`BACKEND_API_URL`** then **`NEXT_PUBLIC_API_URL`** — avoid pointing the API at the same hostname as the Next app unless they are truly the same service.
5. **Google OAuth:** In Google Cloud Console, add authorized JavaScript origins and redirect URI `https://<your-domain>/api/auth/callback/google` (or `http://…` for non-TLS dev only).
6. **Database:** **`DATABASE_URL`** must be reachable from EC2 (security groups / VPC). **`DATABASE_URL`**, **`NEXTAUTH_SECRET`**, and **`INTERNAL_FRONTEND_AUTH_SECRET`** must stay server-only.
7. **Proxy issues:** If NextAuth reports untrusted host behind a reverse proxy, set **`AUTH_TRUST_HOST=true`** and ensure the proxy forwards `Host` (and `X-Forwarded-Proto` for HTTPS).

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
