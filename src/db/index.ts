import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Reuse the connection across hot reloads in dev / serverless invocations.
const globalForDb = globalThis as unknown as { _pgClient?: ReturnType<typeof postgres> };

// Volume 8 / SECURITY.md: TLS 1.2+ is required for all service-database connections in
// production. Enforced explicitly here (not just relied on via a `sslmode=require` query
// param on DATABASE_URL, which is easy to omit by accident) — local/dev Postgres commonly
// has no TLS listener at all, so this only enforces it when NODE_ENV === "production".
// Exception: Neon pooler requires SSL even in development, so detect it and force SSL.
const isNeonPooler = connectionString.includes("pooler.neon.tech") || connectionString.includes("c-5.us-east");
const client =
  globalForDb._pgClient ??
  postgres(connectionString, {
    max: process.env.NODE_ENV === "production" ? 5 : 1,
    ssl: process.env.NODE_ENV === "production" || isNeonPooler ? "require" : false,
  });

if (process.env.NODE_ENV !== "production") globalForDb._pgClient = client;

export const db = drizzle(client, { schema });
