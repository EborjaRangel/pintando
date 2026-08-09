import { spawn } from "child_process";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB_PORT = 51214;

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, "127.0.0.1");
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

function run(command, args, opts = {}) {
  return spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    ...opts,
  });
}

async function waitForDb(timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await portOpen(DB_PORT)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

console.log("→ Revisando Postgres (Prisma Dev) en :51214…");
if (!(await portOpen(DB_PORT))) {
  console.log("→ Arrancando: npx prisma dev --name default");
  const db = run("npx", ["prisma", "dev", "--name", "default"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  db.stdout.on("data", (d) => process.stdout.write(d));
  db.stderr.on("data", (d) => process.stderr.write(d));
  db.on("exit", (code) => {
    console.error(`Prisma Dev se detuvo (code ${code}). La app necesita la BD.`);
  });

  const ok = await waitForDb();
  if (!ok) {
    console.error("No se pudo iniciar Postgres en :51214");
    process.exit(1);
  }
  console.log("√ Postgres listo");
} else {
  console.log("√ Postgres ya estaba en marcha");
}

console.log("→ Arrancando Next.js…");
const next = run("npm", ["run", "dev:next"]);
next.on("exit", (code) => process.exit(code ?? 0));

process.on("SIGINT", () => {
  next.kill("SIGINT");
  process.exit(0);
});
