import type { PrismaClient } from "@prisma/client";

type HouseDelegate = Pick<PrismaClient, "house">;

export function formatConsecutivo(value: number): string {
  return String(value);
}

export async function loadConsecutivosById(
  db: Pick<PrismaClient, "$queryRaw">
): Promise<Map<string, number>> {
  const rows = await db.$queryRaw<Array<{ id: string; consecutivo: number | string }>>`
    SELECT id, consecutivo FROM "House"
  `;
  return new Map(
    rows.map((row) => [row.id, Number(row.consecutivo)])
  );
}

export async function findDuplicateHouse(
  db: Pick<PrismaClient, "$queryRaw">,
  colonia: string,
  address: string,
  excludeId?: string
): Promise<{ id: string; folio: number; consecutivo: number } | null> {
  const rows = excludeId
    ? await db.$queryRaw<Array<{ id: string; folio: number; consecutivo: number }>>`
        SELECT id, folio, consecutivo
        FROM "House"
        WHERE colonia = ${colonia}
          AND lower(trim(address)) = lower(trim(${address}))
          AND id <> ${excludeId}
        LIMIT 1
      `
    : await db.$queryRaw<Array<{ id: string; folio: number; consecutivo: number }>>`
        SELECT id, folio, consecutivo
        FROM "House"
        WHERE colonia = ${colonia}
          AND lower(trim(address)) = lower(trim(${address}))
        LIMIT 1
      `;
  return rows[0] ?? null;
}

export async function nextConsecutivoForColonia(
  tx: HouseDelegate,
  colonia: string
): Promise<number> {
  const agg = await tx.house.aggregate({
    where: { colonia },
    _max: { consecutivo: true },
  });
  return (agg._max.consecutivo ?? 0) + 1;
}

export function isConsecutivoUniqueError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; meta?: { target?: string[] | string } };
  if (e.code !== "P2002") return false;
  const target = e.meta?.target;
  if (Array.isArray(target)) {
    return target.includes("colonia") && target.includes("consecutivo");
  }
  return typeof target === "string" && target.includes("consecutivo");
}

export async function withConsecutivoRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isConsecutivoUniqueError(error)) throw error;
    }
  }
  throw lastError;
}
