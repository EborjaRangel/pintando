import pg from "pg";

const c = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:51214/pintura_app?sslmode=disable",
});

await c.connect();
const r = await c.query(
  "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
);
console.log(r.rows);
await c.end();
