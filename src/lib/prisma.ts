import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

/** node-pg no entiende parámetros propios de Prisma Dev; solo dejamos sslmode. */
function toPgConnectionString(raw: string): string {
  const url = new URL(raw);
  const sslmode = url.searchParams.get("sslmode") ?? "disable";
  url.search = "";
  url.searchParams.set("sslmode", sslmode);
  return url.toString();
}

function isConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as {
    code?: string;
    message?: string;
    cause?: unknown;
  };
  const msg = `${e.message ?? ""} ${String(e.cause ?? "")}`.toLowerCase();
  const codes = new Set(["P1001", "P1002", "P1017", "P2024", "57P01", "08006", "08003"]);
  if (e.code && codes.has(e.code)) return true;
  return (
    msg.includes("connection terminated") ||
    msg.includes("connection closed") ||
    msg.includes("cannot use a pool after calling end") ||
    msg.includes("client has encountered a connection error") ||
    msg.includes("server closed the connection") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("connection timeout")
  );
}

function createPool(connectionString: string) {
  const pool = new Pool({
    connectionString: toPgConnectionString(connectionString),
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
    keepAlive: true,
  });

  pool.on("error", (err) => {
    console.error("[pg] pool error:", err.message);
    void resetPrismaConnection();
  });

  return pool;
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL no está definida");
  }

  const pool = globalForPrisma.pgPool ?? createPool(connectionString);
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pgPool = pool;
  }

  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

/** Recrea el pool si Prisma Dev cortó las conexiones. */
export async function resetPrismaConnection() {
  const oldClient = globalForPrisma.prisma;
  const oldPool = globalForPrisma.pgPool;
  globalForPrisma.prisma = undefined;
  globalForPrisma.pgPool = undefined;

  try {
    await oldClient?.$disconnect();
  } catch {
    // ignore
  }
  try {
    await oldPool?.end();
  } catch {
    // ignore
  }
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!isConnectionError(error)) throw error;
    console.warn("[prisma] conexión caída; reintentando…", (error as Error).message);
    await resetPrismaConnection();
    return await fn();
  }
}

type Delegate = Record<string, unknown>;

function wrapDelegate(getDelegate: () => Delegate): Delegate {
  return new Proxy(
    {},
    {
      get(_t, prop) {
        return (...args: unknown[]) => {
          const run = () => {
            const delegate = getDelegate();
            const method = delegate[prop as string];
            if (typeof method !== "function") {
              throw new TypeError(`prisma.${String(prop)} is not a function`);
            }
            return (method as (...a: unknown[]) => unknown).apply(delegate, args);
          };

          const result = run();
          if (result && typeof result === "object" && "then" in (result as object)) {
            return withRetry(() => Promise.resolve(run()));
          }
          return result;
        };
      },
    }
  );
}

/**
 * Cliente Prisma que recrea el pool tras caídas de Prisma Dev
 * y reintenta una vez las queries afectadas.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (prop === "$connect" || prop === "$disconnect" || prop === "$transaction") {
      return (...args: unknown[]) =>
        withRetry(() => {
          const client = getClient();
          const value = client[prop as keyof PrismaClient];
          return (value as (...a: unknown[]) => Promise<unknown>).apply(client, args);
        });
    }

    if (typeof prop === "string" && !prop.startsWith("$") && !prop.startsWith("_")) {
      return wrapDelegate(() => getClient()[prop as keyof PrismaClient] as unknown as Delegate);
    }

    const client = getClient();
    const value = Reflect.get(client, prop, client);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
