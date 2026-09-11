// Generador del mercado por comuna que consume la alternativa de comunas (§5).
//
//   node --env-file=.env.local --import tsx scripts/data/generar-comuna-mercado.ts
//
// Emite src/lib/comuna-mercado.gen.ts: por comuna × tipología × universo, el
// UF/m² mediano de VENTA; y por comuna, el UF/m²/mes mediano de ARRIENDO. Con eso
// `alternativa-comunas.ts` reconstruye el mismo depto en otra comuna SIN tocar la
// base — el cálculo en runtime es puro, y el catch-test corre sin credenciales.
//
// POR QUÉ PRECALCULADO Y NO VIVO. La alternativa se evalúa sobre las 23 comunas
// restantes del roster, o sea 23 recálculos del motor por informe. Hacerlo vivo
// serían además 46 queries por página. El mismo patrón que `plusvalia-estimado`:
// la tabla se lee en BUILD TIME y el runtime jamás la consulta.
//
// LOS MISMOS CORTES QUE EL MOTOR, no unos propios:
//   · ventana de frescura de 90 días (la primera de `getComunaMedianaVentaUF`)
//   · universo nuevo/usado separado y NUNCA mezclado — un nuevo comparado contra
//     usados da un sesgo sistemático de hasta +107% (ver comuna-stats.ts)
//   · umbral n >= MIN_VENTAS_MEDIANA para venta y MIN_ARRIENDOS_COMUNAL_ENTRA
//     para arriendo: una celda que no lo alcanza NO se emite, no se rellena
//   · el factor publicado→cierre NO se aplica acá: lo aplica el consumidor con
//     `getFactorCierre`, para que este módulo guarde lo que el mercado publica
//
// CADA CELDA DECLARA SU `n` Y EL MÓDULO SU FECHA para saber cuándo regenerar.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { median, MIN_VENTAS_MEDIANA, PAGINA_POSTGREST, normalizeComuna } from "../../src/lib/comuna-stats";
import { MIN_ARRIENDOS_COMUNAL_ENTRA } from "../../src/lib/referencia-arriendo";
import { COMUNAS_DISPONIBLES } from "../../src/lib/comunas-disponibles";
import { getUFValue } from "../../src/lib/uf";

const VENTANA_DIAS = 90;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** UF del dia de la generacion: normaliza las publicaciones que vienen en CLP.
 *  Sale de `getUFValue`, la MISMA fuente que usa el motor (mindicador.cl con su
 *  fallback). Se valida el rango y se deja escrita en el modulo: si la corrida
 *  tomo un valor raro, el numero queda a la vista en vez de esconderse en las
 *  medianas. */
async function ufDelDia(): Promise<number> {
  const v = await getUFValue();
  if (v > 30000 && v < 100000) return v;
  throw new Error(`UF fuera de rango: ${v}`);
}

async function traer(type: "venta" | "arriendo", desde: string) {
  const filas: any[] = [];
  for (let off = 0; ; off += PAGINA_POSTGREST) {
    const { data, error } = await sb
      .from("scraped_properties")
      .select("comuna, dormitorios, condicion, precio, moneda, superficie_m2")
      .eq("type", type)
      .eq("is_active", true)
      .gte("scraped_at", desde)
      .gt("superficie_m2", 0)
      .gt("precio", 0)
      .order("id", { ascending: true })
      .range(off, off + PAGINA_POSTGREST - 1);
    if (error) throw error;
    filas.push(...(data ?? []));
    if (!data || data.length < PAGINA_POSTGREST) break;
  }
  return filas;
}

async function main() {
  const uf = await ufDelDia();
  const desde = new Date(Date.now() - VENTANA_DIAS * 864e5).toISOString();
  const enUF = (r: any) => (r.moneda === "UF" ? Number(r.precio) : Number(r.precio) / uf);
  const roster = new Set<string>(COMUNAS_DISPONIBLES);

  // ── VENTA: comuna × dorms × universo ──────────────────────────────────────
  const acV = new Map<string, number[]>();
  for (const r of await traer("venta", desde)) {
    const comuna = normalizeComuna(String(r.comuna ?? ""));
    if (!roster.has(comuna)) continue;
    const d = Number(r.dormitorios);
    if (!Number.isFinite(d) || d < 1 || d > 4) continue;
    const sup = Number(r.superficie_m2);
    const ufM2 = enUF(r) / sup;
    if (!(ufM2 > 0)) continue;
    const k = `${comuna}|${d}|${r.condicion === "nuevo" ? "nuevo" : "usado"}`;
    (acV.get(k) ?? acV.set(k, []).get(k)!).push(ufM2);
  }

  // ── ARRIENDO: comuna, pooled (todas las tipologías) ───────────────────────
  // Es la MISMA forma que consume `resolverReferenciaArriendo` por la vía
  // comunal, que después le aplica el factor de la tipología.
  const acA = new Map<string, number[]>();
  for (const r of await traer("arriendo", desde)) {
    const comuna = normalizeComuna(String(r.comuna ?? ""));
    if (!roster.has(comuna)) continue;
    const sup = Number(r.superficie_m2);
    const ufM2Mes = enUF(r) / sup;
    if (!(ufM2Mes > 0)) continue;
    (acA.get(comuna) ?? acA.set(comuna, []).get(comuna)!).push(ufM2Mes);
  }

  const r4 = (x: number) => Math.round(x * 10000) / 10000;
  const ventas = [...acV.entries()]
    .filter(([, v]) => v.length >= MIN_VENTAS_MEDIANA)
    .map(([k, v]) => [k, { ufM2: r4(median(v)), n: v.length }] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));
  const arriendos = [...acA.entries()]
    .filter(([, v]) => v.length >= MIN_ARRIENDOS_COMUNAL_ENTRA)
    .map(([c, v]) => [c, { ufM2Mes: r4(median(v)), n: v.length }] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));

  const hoy = new Date().toISOString().slice(0, 10);
  const cuerpo = `// GENERADO — no editar a mano. Regenerar con:
//   node --env-file=.env.local --import tsx scripts/data/generar-comuna-mercado.ts
//
// Mercado por comuna que consume la ALTERNATIVA DE COMUNAS (contrato §5): dado un
// depto que no cierra en su comuna, en cuáles del roster sí cerraría. Con este
// módulo el cálculo en runtime es PURO — ninguna query — y el catch-test corre sin
// credenciales.
//
// LOS CORTES SON LOS DEL MOTOR: ventana de ${VENTANA_DIAS} días, universo nuevo/usado
// separado y nunca mezclado, y los umbrales de muestra de \`comuna-stats\` y
// \`referencia-arriendo\`. Una celda bajo el umbral NO se emite: no hay relleno.
//
// EL PRECIO ES PUBLICADO, no de cierre. El factor publicado→cierre lo aplica el
// consumidor con \`getFactorCierre\`, igual que el resto del motor.
//
// CUÁNDO REGENERAR: cada celda trae su \`n\` y el módulo su fecha. El scraper corre
// seguido, así que la ventana se mueve sola; regenerar cuando la fecha quede a más
// de un par de meses, o cuando una comuna entre o salga del roster.

/** Una celda de venta: UF/m² mediano publicado y el n que lo sostiene. */
export interface CeldaVentaComuna {
  ufM2: number;
  n: number;
}

/** El arriendo pooled de una comuna, en UF/m² al mes. */
export interface CeldaArriendoComuna {
  ufM2Mes: number;
  n: number;
}

/** Fecha de la corrida que produjo este módulo (YYYY-MM-DD). */
export const COMUNA_MERCADO_FECHA = ${JSON.stringify(hoy)};
/** UF con que se normalizaron las publicaciones en CLP. */
export const COMUNA_MERCADO_UF = ${uf};
/** Ventana de frescura, en días. */
export const COMUNA_MERCADO_VENTANA_DIAS = ${VENTANA_DIAS};

/** Clave: \`\${comuna}|\${dormitorios}|\${"nuevo"|"usado"}\`. */
export const VENTA_POR_COMUNA: Record<string, CeldaVentaComuna> = {
${ventas.map(([k, v]) => `  ${JSON.stringify(k)}: { ufM2: ${v.ufM2}, n: ${v.n} },`).join("\n")}
};

/** Clave: nombre canónico de la comuna. */
export const ARRIENDO_POR_COMUNA: Record<string, CeldaArriendoComuna> = {
${arriendos.map(([c, v]) => `  ${JSON.stringify(c)}: { ufM2Mes: ${v.ufM2Mes}, n: ${v.n} },`).join("\n")}
};
`;

  const destino = join(__dirname, "..", "..", "src", "lib", "comuna-mercado.gen.ts");
  writeFileSync(destino, cuerpo, "utf8");
  console.log(`escrito ${destino}`);
  console.log(`  UF ${uf} · ventana ${VENTANA_DIAS}d · fecha ${hoy}`);
  console.log(`  celdas de venta: ${ventas.length} (umbral n>=${MIN_VENTAS_MEDIANA})`);
  console.log(`  comunas con arriendo: ${arriendos.length} (umbral n>=${MIN_ARRIENDOS_COMUNAL_ENTRA})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
