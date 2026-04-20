import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __emsAdminPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Missing DATABASE_URL");
}

export const adminDb =
  global.__emsAdminPool ??
  new Pool({
    connectionString,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  });

if (process.env.NODE_ENV !== "production") {
  global.__emsAdminPool = adminDb;
}