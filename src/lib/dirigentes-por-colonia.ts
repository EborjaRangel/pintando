import { Pool } from "pg";
import { normalizeColoniaKey } from "@/lib/colonias";

export type DirigenteBusqueda = {
  nombre: string;
  primerApellido: string;
  segundoApellido: string;
};

type Cache = {
  at: number;
  data: Record<string, DirigenteBusqueda[]>;
};

const globalForDirigentes = globalThis as unknown as {
  dirigentesPool?: Pool;
  dirigentesCache?: Cache;
};

const CACHE_MS = 60_000;

function pool() {
  const connectionString = process.env.CONTROL_DATABASE_URL?.trim();
  if (!connectionString) return null;
  if (!globalForDirigentes.dirigentesPool) {
    globalForDirigentes.dirigentesPool = new Pool({
      connectionString,
      max: 2,
      connectionTimeoutMillis: 4_000,
    });
  }
  return globalForDirigentes.dirigentesPool;
}

/** Dirigentes activos agrupados por colonia, para buscarlos desde Casas. */
export async function loadDirigentesByColonia(): Promise<Record<string, DirigenteBusqueda[]>> {
  const cached = globalForDirigentes.dirigentesCache;
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;

  const db = pool();
  if (!db) return {};

  try {
    const result = await db.query<{
      nombre: string;
      primerApellido: string;
      segundoApellido: string | null;
      colonia: string;
    }>(`
      SELECT nombre, "primerApellido", "segundoApellido", colonia
      FROM "Dirigente"
      WHERE activo = true
        AND status = 'ACTIVO'
        AND btrim(colonia) <> ''
    `);

    const data: Record<string, DirigenteBusqueda[]> = {};
    for (const row of result.rows) {
      const key = normalizeColoniaKey(row.colonia);
      if (!key) continue;
      const person: DirigenteBusqueda = {
        nombre: row.nombre.trim(),
        primerApellido: row.primerApellido.trim(),
        segundoApellido: (row.segundoApellido ?? "").trim(),
      };
      if (!person.nombre && !person.primerApellido) continue;
      const list = data[key] ?? [];
      list.push(person);
      data[key] = list;
    }

    globalForDirigentes.dirigentesCache = { at: Date.now(), data };
    return data;
  } catch (error) {
    console.error("No se pudieron cargar los dirigentes por colonia", error);
    return cached?.data ?? {};
  }
}
