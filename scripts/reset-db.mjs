import pg from "pg";

const admin = new pg.Client({
  connectionString:
    "postgresql://postgres:postgres@localhost:51214/template1?sslmode=disable",
});

await admin.connect();
await admin.query(`
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = 'pintura_app' AND pid <> pg_backend_pid()
`);
await admin.query("DROP DATABASE IF EXISTS pintura_app");
await admin.query("CREATE DATABASE pintura_app TEMPLATE template0");
console.log("pintura_app recreada desde template0");
await admin.end();
