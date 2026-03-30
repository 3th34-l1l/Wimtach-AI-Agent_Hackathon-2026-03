import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __glipPool: Pool | undefined;
}

const user = "glip";
const password = "glippass";
const host = "localhost";
const port = 5432;
const database = "glip";

export const db =
  global.__glipPool ??
  new Pool({
    user,
    password,
    host,
    port,
    database,
  });

if (process.env.NODE_ENV !== "production") {
  global.__glipPool = db;
}