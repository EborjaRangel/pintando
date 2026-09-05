import { config as loadEnv } from "dotenv";
import pg from "pg";

loadEnv();
loadEnv({ path: ".env.local", override: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL no está definida");
  process.exit(1);
}

const isLocal = /localhost|127\.0\.0\.1/i.test(url);
const client = new pg.Client({
  connectionString: url,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});
await client.connect();

const host = new URL(url.replace(/^prisma\+/, "")).hostname;
console.log(`Aplicando consecutivo en ${host}`);

await client.query(`
  ALTER TABLE "House"
  ADD COLUMN IF NOT EXISTS consecutivo INTEGER NOT NULL DEFAULT 0
`);

await client.query(`DROP INDEX IF EXISTS "House_colonia_consecutivo_key"`);

const result = await client.query(`
  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY colonia
        ORDER BY "createdAt" ASC, id ASC
      )::int AS n
    FROM "House"
  )
  UPDATE "House" AS house
  SET consecutivo = ranked.n
  FROM ranked
  WHERE house.id = ranked.id
`);

await client.query(`
  CREATE UNIQUE INDEX IF NOT EXISTS "House_colonia_consecutivo_key"
  ON "House" ("colonia", "consecutivo")
`);

const check = await client.query(`
  SELECT
    count(*)::int AS total,
    count(*) FILTER (WHERE consecutivo <= 0)::int AS zeros,
    min(consecutivo) AS min_n,
    max(consecutivo) AS max_n
  FROM "House"
`);
const sample = await client.query(`
  SELECT colonia, count(*)::int AS n, min(consecutivo) AS min_n, max(consecutivo) AS max_n
  FROM "House"
  GROUP BY colonia
  ORDER BY n DESC
  LIMIT 5
`);

console.log(`Registros numerados: ${result.rowCount ?? 0}`);
console.log(JSON.stringify(check.rows[0]));
console.log(JSON.stringify(sample.rows));

await client.end();
