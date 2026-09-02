// ─────────────────────────────────────────────────────────────────────────────
// AUDIT READ-ONLY · ¿Qué les pasa a las medianas si el backfill entra?
//
// Baja el universo vivo por GetProps (viewport Gran Santiago, 600 por página,
// SIN escribir nada) y compara, comuna por comuna:
//
//  (1) la mediana UF/m² de venta usada tal como la computa comuna-stats
//      (ventana 90→180 días, ±20% de superficie, dorms exacto, ≥15, factor de
//      cierre) — HOY sobre la tabla vs. MAÑANA sobre el universo vivo;
//  (2) la tipología líder de la página de comuna (comunas-seo: ≥20 arriendos y
//      ≥20 ventas por dorms, dividendo al 20% de pie y 30 años) y si su signo
//      "se paga sola" da vuelta — eso es lo que dispara detectarDrift.
//
// "Mañana" = solo lo que la fuente lista hoy, porque el refresco desactiva lo
// que ya no está. El sujeto de (1) es la superficie mediana del segmento HOY
// (la misma para los dos lados), así la comparación mide el universo y no el
// sujeto.
//
// Correr con cwd en el worktree (el alias @/ resuelve por el tsconfig del cwd):
//   node --env-file=.env.local \
//     --import "file:///C:/Users/fabri/invertiscore/node_modules/tsx/dist/loader.mjs" \
//     scripts/audit/medianas-backfill.ts
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import {
  fetchMapPaginado,
  ESTADO_USADO,
  ESTADO_TODO,
  type ScrapedProperty,
} from "@/lib/services/scraper/toctoc";
import { getFactorCierre, median, MIN_VENTAS_MEDIANA } from "@/lib/comuna-stats";
import { COMUNAS_ROSTER } from "@/lib/data/comunas-roster";
import { calcDividendo } from "@/lib/analysis";
import { esTasaPlausible, esUFPlausible } from "@/lib/uf";
import { TASA_MERCADO_FALLBACK } from "@/lib/constants/subsidio";

type Fila = {
  comuna: string;
  type: "arriendo" | "venta";
  dormitorios: number | null;
  precio: number;
  moneda: string | null;
  superficie_m2: number | null;
  scraped_at: string;
};

const DIA_MS = 24 * 60 * 60 * 1000;
const PIE_PCT = 20;
const PLAZO_ANOS = 30;
const MIN_PER_TYPE = 20;

// Mismos alias de encoding que comunas-seo normaliza al leer.
const CANON: Record<string, string> = {
  Conchali: "Conchalí",
  "Estacion Central": "Estación Central",
  Penalolen: "Peñalolén",
  "San Joaquin": "San Joaquín",
  Maipu: "Maipú",
  Nunoa: "Ñuñoa",
};
const canon = (c: string) => CANON[c] ?? c;

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function tablaActiva(type: "arriendo" | "venta"): Promise<Fila[]> {
  const cli = sb();
  const out: Fila[] = [];
  for (let off = 0; ; off += 1000) {
    let q = cli
      .from("scraped_properties")
      .select("comuna,type,dormitorios,precio,moneda,superficie_m2,scraped_at")
      .eq("type", type)
      .eq("is_active", true)
      .gt("precio", 0)
      .range(off, off + 999);
    if (type === "venta") q = q.or("condicion.is.null,condicion.eq.usado").not("source_id", "like", "%#%");
    const { data, error } = await q;
    if (error) throw new Error(`select ${type}: ${error.message}`);
    out.push(...((data ?? []) as Fila[]));
    if (!data || data.length < 1000) break;
  }
  return out.map((f) => ({ ...f, comuna: canon(f.comuna) }));
}

async function leerConfig(): Promise<{ uf: number; tasa: number; tasaViva: boolean }> {
  const { data } = await sb().from("config").select("key,value").in("key", ["uf_value", "tasa_hipotecaria"]);
  const get = (k: string) => parseFloat((data ?? []).find((r) => r.key === k)?.value ?? "");
  const ufRaw = get("uf_value");
  const tasaRaw = get("tasa_hipotecaria");
  const tasaViva = esTasaPlausible(tasaRaw);
  return { uf: esUFPlausible(ufRaw) ? ufRaw : 38800, tasa: tasaViva ? tasaRaw : TASA_MERCADO_FALLBACK, tasaViva };
}

function deUniverso(p: ScrapedProperty): Fila {
  return {
    comuna: canon(p.comuna),
    type: p.type,
    dormitorios: p.dormitorios ?? null,
    precio: p.precio,
    moneda: p.moneda,
    superficie_m2: p.superficieM2 ?? null,
    scraped_at: new Date().toISOString(),
  };
}

const enUF = (f: Fila, uf: number) => (f.moneda === "UF" ? f.precio : f.precio / uf);
const enCLP = (f: Fila, uf: number) => (f.moneda === "UF" ? f.precio * uf : f.precio);

/** (1) Mediana comuna-stats. `ventanas` null = sin filtro de fecha (universo vivo). */
function medianaComunaStats(
  filas: Fila[],
  comuna: string,
  dorms: number,
  superficie: number,
  uf: number,
  ventanas: number[] | null,
): { mediana: number | null; n: number; ventana: number | null } {
  const supMin = superficie * 0.8;
  const supMax = superficie * 1.2;
  const base = filas.filter(
    (f) =>
      f.comuna === comuna &&
      f.type === "venta" &&
      f.dormitorios === dorms &&
      f.superficie_m2 != null &&
      f.superficie_m2 >= supMin &&
      f.superficie_m2 <= supMax,
  );
  const calc = (rows: Fila[]) => {
    const m2 = rows.map((f) => (enUF(f, uf) * getFactorCierre(comuna)) / (f.superficie_m2 as number));
    return m2.length >= MIN_VENTAS_MEDIANA ? Math.round(median(m2) * 100) / 100 : null;
  };
  if (!ventanas) return { mediana: calc(base), n: base.length, ventana: null };
  let ultimo = { mediana: null as number | null, n: 0, ventana: null as number | null };
  for (const dias of ventanas) {
    const desde = Date.now() - dias * DIA_MS;
    const rows = base.filter((f) => new Date(f.scraped_at).getTime() >= desde);
    // OJO: PostgREST capa cada query en 1.000 filas (verificado 02-sep-2026);
    // acá no se reproduce el tope, se mide el dato completo.
    ultimo = { mediana: calc(rows), n: rows.length, ventana: dias };
    if (rows.length >= MIN_VENTAS_MEDIANA) return ultimo;
  }
  return { ...ultimo, ventana: null };
}

/** (2) Segmentos comunas-seo: tipología líder y si se paga sola. */
interface Tip {
  dorms: number;
  nArr: number;
  nVen: number;
  cubre: boolean;
  deltaPct: number;
}
function tipologias(filas: Fila[], comuna: string, uf: number, tasa: number): Tip[] {
  const out: Tip[] = [];
  for (let dorms = 1; dorms <= 4; dorms++) {
    const seg = filas.filter(
      (f) => f.comuna === comuna && f.dormitorios === dorms && f.superficie_m2 != null && f.superficie_m2 > 0 && f.superficie_m2 <= 300,
    );
    const arr = seg.filter((f) => f.type === "arriendo").map((f) => f.precio);
    const ven = seg.filter((f) => f.type === "venta").map((f) => enCLP(f, uf));
    if (arr.length < MIN_PER_TYPE || ven.length < MIN_PER_TYPE) continue;
    const medArr = median(arr);
    const medVen = median(ven);
    const dividendo = calcDividendo(medVen * (1 - PIE_PCT / 100), tasa, PLAZO_ANOS);
    // Aproximación del deltaPct de comunas-seo (precio de equilibrio vs mediana):
    // el dividendo es lineal en el precio, así que precioCuota/mediana = arriendo/dividendo.
    const deltaPct = dividendo > 0 ? (medArr / dividendo - 1) * 100 : 0;
    out.push({ dorms, nArr: arr.length, nVen: ven.length, cubre: medArr >= dividendo, deltaPct: Math.round(deltaPct * 10) / 10 });
  }
  return out;
}
function lider(t: Tip[]): Tip | null {
  if (!t.length) return null;
  const cubren = t.filter((x) => x.cubre);
  return (cubren.length ? cubren : t).reduce((a, b) => (b.deltaPct > a.deltaPct ? b : a));
}

const fmt = (n: number | null, d = 1) => (n == null ? "—" : n.toFixed(d));
const pad = (s: string, w: number) => s.padEnd(w);

async function main() {
  const t0 = Date.now();
  console.log("Bajando universo vivo por GetProps (viewport Gran Santiago, 600/pág)…");
  const venta = await fetchMapPaginado({ type: "venta", estado: ESTADO_USADO, pausaMs: 1000 });
  const arriendo = await fetchMapPaginado({ type: "arriendo", estado: ESTADO_TODO, pausaMs: 1000 });
  console.log(`  venta usada: total fuente ${venta.total} · páginas ${venta.paginas} · parseadas ${venta.properties.length} · errores ${venta.errors.length}`);
  console.log(`  arriendo:    total fuente ${arriendo.total} · páginas ${arriendo.paginas} · parseadas ${arriendo.properties.length} · errores ${arriendo.errors.length}`);
  if (venta.errors.length || arriendo.errors.length) console.log("  errores:", [...venta.errors, ...arriendo.errors].slice(0, 5));
  const nuevo: Fila[] = [...venta.properties, ...arriendo.properties].map(deUniverso);

  console.log("Leyendo tabla activa…");
  const actual: Fila[] = [...(await tablaActiva("venta")), ...(await tablaActiva("arriendo"))];
  const cfg = await leerConfig();
  console.log(`  tabla: ${actual.length} filas activas (venta usada + arriendo) · UF ${cfg.uf} · tasa ${cfg.tasa}% (${cfg.tasaViva ? "viva" : "fallback"})\n`);

  // ── Tabla 1: mediana comuna-stats por comuna × dorms (1D, 2D, 3D) ──
  console.log(
    "TABLA 1 · Mediana UF/m² venta usada (criterio comuna-stats: ±20% superficie sobre la superficie mediana del segmento hoy, dorms exacto, ≥15, factor de cierre)",
  );
  console.log(pad("comuna", 18) + ["1D", "2D", "3D"].map((d) => pad(`${d}: hoy(n) → mañana(n) Δ%`, 34)).join(""));
  const deltas2D: number[] = [];
  for (const { nombre } of COMUNAS_ROSTER) {
    let linea = pad(nombre, 18);
    for (const dorms of [1, 2, 3]) {
      const hoySeg = actual.filter((f) => f.comuna === nombre && f.type === "venta" && f.dormitorios === dorms && f.superficie_m2);
      const supRef = hoySeg.length
        ? median(hoySeg.map((f) => f.superficie_m2 as number))
        : median(
            nuevo
              .filter((f) => f.comuna === nombre && f.type === "venta" && f.dormitorios === dorms && f.superficie_m2)
              .map((f) => f.superficie_m2 as number),
          );
      if (!supRef) {
        linea += pad("sin segmento", 34);
        continue;
      }
      const hoy = medianaComunaStats(actual, nombre, dorms, supRef, cfg.uf, [90, 180]);
      const man = medianaComunaStats(nuevo, nombre, dorms, supRef, cfg.uf, null);
      const delta = hoy.mediana && man.mediana ? ((man.mediana - hoy.mediana) / hoy.mediana) * 100 : null;
      if (dorms === 2 && delta != null) deltas2D.push(delta);
      const deltaTxt = delta == null ? "—" : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;
      linea += pad(`${fmt(hoy.mediana)}(${hoy.n}${hoy.ventana === 180 ? "*" : ""}) → ${fmt(man.mediana)}(${man.n}) ${deltaTxt}`, 34);
    }
    console.log(linea);
  }
  console.log("  (* = necesitó la ventana de 180 días; — = no junta 15)");
  if (deltas2D.length) {
    const abs = deltas2D.map(Math.abs).sort((a, b) => a - b);
    console.log(
      `  2D: Δ mediano con signo ${fmt(median(deltas2D))}% · |Δ| p50 ${fmt(abs[Math.floor(abs.length / 2)])}% · max ${fmt(abs[abs.length - 1])}% · n=${deltas2D.length}\n`,
    );
  }

  // ── Tabla 2: página de comuna (comunas-seo): líder y flip ──
  console.log("TABLA 2 · Página de comuna: tipología líder y si se paga sola (≥20 arr y ≥20 ventas por dorms, pie 20%, 30 años)");
  console.log(pad("comuna", 18) + pad("líder hoy", 28) + pad("líder mañana", 28) + "flip");
  let flips = 0;
  for (const { nombre } of COMUNAS_ROSTER) {
    const th = tipologias(actual, nombre, cfg.uf, cfg.tasa);
    const tm = tipologias(nuevo, nombre, cfg.uf, cfg.tasa);
    const lh = lider(th);
    const lm = lider(tm);
    const desc = (l: Tip | null, t: Tip[]) =>
      l ? `${l.dorms}D ${l.cubre ? "cubre" : "no cubre"} (${l.deltaPct >= 0 ? "+" : ""}${l.deltaPct}%) [${t.length} tip]` : "sin datos";
    const cambioTip =
      th.length !== tm.length ||
      th.some((a) => {
        const b = tm.find((x) => x.dorms === a.dorms);
        return b && b.cubre !== a.cubre;
      });
    const flip = (!!lh && !!lm && (lh.dorms !== lm.dorms || lh.cubre !== lm.cubre)) || !!lh !== !!lm || cambioTip;
    if (flip) flips++;
    console.log(pad(nombre, 18) + pad(desc(lh, th), 28) + pad(desc(lm, tm), 28) + (flip ? "SÍ" : "no"));
  }
  console.log(`\n  comunas con drift esperado (líder, signo o set de tipologías): ${flips}/25`);
  console.log(`\nListo en ${Math.round((Date.now() - t0) / 1000)} s. No se escribió nada.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
