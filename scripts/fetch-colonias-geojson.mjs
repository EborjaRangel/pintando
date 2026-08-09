import fs from "fs";
import path from "path";

const base =
  "https://serviciosatlas.sgirpc.cdmx.gob.mx/arcgis/rest/services/Hosted/Catalogo_Colonias_CDMX/FeatureServer/0/query";

const queries = [
  "alc='Coyoacán'",
  "UPPER(alc) LIKE '%COYOAC%'",
  "cve_alc='09003'",
  "cve_alc='003'",
];

async function tryQuery(where) {
  const params = new URLSearchParams({
    where,
    outFields: "colonia,alc,cve_col,cve_alc,clasif",
    outSR: "4326",
    f: "geojson",
    resultRecordCount: "2000",
  });
  const url = `${base}?${params}`;
  console.log("Trying:", where);
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    console.log("  status", res.status, text.slice(0, 200));
    return null;
  }
  const data = JSON.parse(text);
  console.log("  features", data.features?.length ?? 0);
  if (data.features?.length) {
    console.log(
      "  sample",
      data.features.slice(0, 5).map((f) => f.properties)
    );
  }
  return data.features?.length ? data : null;
}

let geo = null;
for (const where of queries) {
  try {
    geo = await tryQuery(where);
    if (geo) break;
  } catch (err) {
    console.error("  error", err.message);
  }
}

if (!geo) {
  // Fallback: filter IECM UTs for Coyoacán from control
  const utPath = path.resolve(
    "../control/back/data/geo/raw/iecm-uts.json"
  );
  console.log("Fallback IECM UTs from", utPath);
  const raw = JSON.parse(fs.readFileSync(utPath, "utf8"));
  const features = raw.features
    .filter((f) => {
      const dem = String(f.properties?.dem_territ || "").toUpperCase();
      const cve = String(f.properties?.cve_demarc || "");
      return dem.includes("COYOAC") || cve === "003" || cve === "09003";
    })
    .map((f) => ({
      type: "Feature",
      properties: {
        name: String(f.properties.nombre || "")
          .replace(/\s+/g, " ")
          .trim()
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .replace(/\b(De|Del|La|Las|Los|Y|En)\b/g, (w) => w.toLowerCase())
          .replace(/^\w/, (c) => c.toUpperCase()),
        id: String(f.properties.cve_ut || f.properties.nombre || ""),
        fuente: "IECM UT",
      },
      geometry: f.geometry,
    }));
  geo = { type: "FeatureCollection", features };
  console.log("IECM filtered features", features.length);
}

// Normalize property to `name` for the map
geo.features = geo.features.map((f, i) => {
  const props = f.properties || {};
  const name = props.colonia || props.name || props.nombre || `Colonia ${i + 1}`;
  return {
    type: "Feature",
    properties: {
      name: String(name).trim(),
      id: String(props.cve_col || props.id || props.cve_ut || i + 1),
      alc: props.alc || "Coyoacán",
      clasif: props.clasif || null,
      fuente: props.fuente || "SGIRPC CDMX",
    },
    geometry: f.geometry,
  };
});

const out = path.resolve("public/data/coyoacan-colonias.geojson");
fs.writeFileSync(out, JSON.stringify(geo));
console.log("Wrote", out, "features:", geo.features.length);
console.log(
  "Names sample:",
  geo.features.slice(0, 10).map((f) => f.properties.name)
);
