import "dotenv/config";
import pg from "pg";
import { execSync } from "child_process";

const url =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:51214/template1?sslmode=disable";

const c = new pg.Client({ connectionString: url });
await c.connect();

// Limpia residuos de otras apps en el Postgres local de Prisma Dev
await c.query(`DROP TABLE IF EXISTS "Contact" CASCADE`);
await c.query(`DROP TABLE IF EXISTS "NewsletterSubscriber" CASCADE`);
console.log("Tablas residuales eliminadas");
await c.end();

execSync("npx prisma db push", { stdio: "inherit" });
execSync("npm run db:seed", { stdio: "inherit" });
