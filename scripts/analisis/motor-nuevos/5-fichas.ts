// ─────────────────────────────────────────────────────────────────────────────
// FASE 2.3 · LAS FICHAS DE HASTA 12 PROYECTOS, por el camino del cruce nocturno (toctoc-unidades.ts): los dos GET de
// `api-ficha` por proyecto (/property/<id> y /property/<id>/floors-units), con los mismos headers y el mismo proxy
// (PROXY_URL, si está), de a uno y con pausa de 4 s. Nada de HTML. Guarda los JSON crudos en out/fichas/ (no se commitean)
// y arma el inventario de campos: qué trae la ficha que hoy no se guarda. La muestra sale de out/4-proyectos.json.
// Solo lectura: nada va a la base.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fmt, mediana, tablaMd } from "./comun";
import { createServiceClient } from "../../../src/lib/supabase/service";
import { idProyectoDeUrl, parsearDisponibles, parsearProyecto } from "../../../src/lib/services/scraper/toctoc-unidades";
import { proxyDispatcher } from "../../../src/lib/services/scraper/toctoc";

const API_FICHA = "https://www.toctoc.com/propiedades/1.0/api-ficha";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "es-CL,es;q=0.9",
  Referer: "https://www.toctoc.com/",
};
const PAUSA_MS = 4000;
const DIR = "scripts/analisis/motor-nuevos/out/fichas";

async function leer(url: string, archivo: string): Promise<unknown> {
  if (existsSync(archivo)) return JSON.parse(readFileSync(archivo, "utf8"));
  const r = await fetch(url, { headers: HEADERS, dispatcher: proxyDispatcher, signal: AbortSignal.timeout(10_000) } as RequestInit & { dispatcher?: unknown });
  const texto = await r.text();
  let json: unknown = null;
  try { json = JSON.parse(texto); } catch { json = { _noJson: texto.slice(0, 300) }; }
  const out = { _http: r.status, ...(json as object) };
  writeFileSync(archivo, JSON.stringify(out, null, 1));
  await new Promise((res) => setTimeout(res, PAUSA_MS));
  return out;
}

/** Todas las rutas de claves del JSON (hasta 4 niveles), para buscar campos por nombre. */
function claves(o: unknown, prefijo = "", prof = 0, out = new Set<string>()): Set<string> {
  if (prof > 5 || o == null || typeof o !== "object") return out;
  if (Array.isArray(o)) { for (const x of o.slice(0, 3)) claves(x, prefijo + "[]", prof + 1, out); return out; }
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) { out.add(prefijo + "." + k); claves(v, prefijo + "." + k, prof + 1, out); }
  return out;
}
const buscar = (texto: string, re: RegExp) => { const m = texto.match(re); return m ? m[0].slice(0, 80) : null; };

async function main() {
  mkdirSync(DIR, { recursive: true });
  const sb = createServiceClient();
  const uf = Number((await sb.from("config").select("value").eq("key", "uf_value").single()).data?.value);
  const muestra = (JSON.parse(readFileSync("scripts/analisis/motor-nuevos/out/4-proyectos.json", "utf8")) as { muestraLecturas: Array<{ url: string; motivo: string; comuna: string; idsUnidades: string[]; unidadesActivas: number }> }).muestraLecturas.slice(0, 12);
  const filasInv: (string | number)[][] = [];
  const filasPrecio: (string | number)[][] = [];
  const resumen: Array<{ id: number; comuna: string; motivo: string; disponibles: number; conocidas: number; desde: number | null; hasta: number | null; desdeNuestro: number | null; medNuestro: number | null }> = [];
  for (const p of muestra) {
    const id = idProyectoDeUrl(p.url);
    if (!id) { console.log(`sin id de proyecto en ${p.url}`); continue; }
    const proyecto = await leer(`${API_FICHA}/property/${id}`, `${DIR}/${id}-property.json`);
    const unidades = await leer(`${API_FICHA}/property/${id}/floors-units`, `${DIR}/${id}-floors-units.json`);
    const texto = JSON.stringify(proyecto) + JSON.stringify(unidades);
    const ks = [...claves(proyecto), ...claves(unidades)].join(" ");
    const { rango, fechaEntrega } = parsearProyecto(proyecto);
    const disp = parsearDisponibles(unidades);
    const caracteristicas = ((proyecto as { data?: { characteristics?: Array<{ name?: string; value?: unknown }> } })?.data?.characteristics ?? []).map((c) => `${c.name}: ${String(c.value).slice(0, 30)}`);
    // Nuestras unidades de ese proyecto: precios reales (GraphQL viejo) y estimados.
    const { data: nuestras } = await sb.from("scraped_properties").select("precio, moneda, superficie_m2, precio_estimado_uf, dormitorios").in("id", p.idsUnidades.slice(0, 300)).order("id").limit(300);
    const precios = (nuestras ?? []).map((u) => (u.moneda === "UF" ? Number(u.precio) : Number(u.precio) / uf)).filter((x) => x > 300);
    const si = (re: RegExp) => (re.test(texto) ? "sí" : "no");
    const ej = (re: RegExp) => buscar(texto, re) ?? "—";
    filasInv.push([
      `${id} · ${p.comuna}`, p.motivo,
      disp.length ? `sí (${disp.length})` : "no",
      si(/"(price|precio|valor)[^"]*":\s*[1-9]/i) === "sí" && /floors/.test(JSON.stringify(unidades)) && /"(price|precio)[^"]*":\s*[1-9]/i.test(JSON.stringify(unidades)) ? "sí" : "no",
      rango ? `sí (UF ${fmt(rango.desdeUF)}–${fmt(rango.hastaUF)})` : "no",
      fechaEntrega ?? "no",
      si(/pie[^"]{0,40}cuota|cuota[^"]{0,40}pie|bono\s*pie/i) + (ej(/[^"]{0,30}(pie[^"]{0,40}cuota|bono\s*pie)[^"]{0,30}/i) !== "—" ? ` («${ej(/[^"]{0,30}(pie[^"]{0,40}cuota|bono\s*pie)[^"]{0,30}/i)}»)` : ""),
      si(/gastos?\s*comun/i) + (ej(/[^"]{0,20}gastos?\s*comun[^"]{0,30}/i) !== "—" ? ` («${ej(/[^"]{0,20}gastos?\s*comun[^"]{0,30}/i)}»)` : ""),
      si(/recepci[oó]n|permiso de edificaci|año de construc/i) + (ej(/[^"]{0,15}(recepci[oó]n|permiso de edificaci|año de construc)[^"]{0,25}/i) !== "—" ? ` («${ej(/[^"]{0,15}(recepci[oó]n|permiso de edificaci|año de construc)[^"]{0,25}/i)}»)` : ""),
      si(/estacionamiento/i) + " / " + si(/bodega/i),
      si(/descuento|promoci|oferta/i) + (ej(/[^"]{0,20}(descuento|promoci[oó]n)[^"]{0,30}/i) !== "—" ? ` («${ej(/[^"]{0,20}(descuento|promoci[oó]n)[^"]{0,30}/i)}»)` : ""),
      si(/subsidio/i) + (ej(/[^"]{0,20}subsidio[^"]{0,30}/i) !== "—" ? ` («${ej(/[^"]{0,20}subsidio[^"]{0,30}/i)}»)` : ""),
    ]);
    filasPrecio.push([`${id} · ${p.comuna}`, disp.length, p.unidadesActivas, rango ? fmt(rango.desdeUF) : "—", rango ? fmt(rango.hastaUF) : "—", precios.length ? fmt(Math.min(...precios)) : "—", precios.length ? fmt(mediana(precios)) : "—", precios.length && rango ? fmt((mediana(precios)! / rango.desdeUF - 1) * 100, 1) + " %" : "—"]);
    resumen.push({ id, comuna: p.comuna, motivo: p.motivo, disponibles: disp.length, conocidas: p.unidadesActivas, desde: rango?.desdeUF ?? null, hasta: rango?.hastaUF ?? null, desdeNuestro: precios.length ? Math.min(...precios) : null, medNuestro: precios.length ? mediana(precios) : null });
    writeFileSync(`${DIR}/${id}-resumen.txt`, `claves:\n${ks.split(" ").join("\n")}\n\ncaracterísticas del proyecto:\n${caracteristicas.join("\n")}\n\nprimera unidad:\n${JSON.stringify(disp[0] ?? null)}\n`);
    console.log(`${id} · ${p.comuna} · ${p.motivo}: disponibles ${disp.length} (conocidas ${p.unidadesActivas}) · rango ${rango ? `UF ${fmt(rango.desdeUF)}–${fmt(rango.hastaUF)}` : "—"} · entrega ${fechaEntrega ?? "—"} · características: ${caracteristicas.join(" | ").slice(0, 200)}`);
  }
  console.log("\nInventario de lo que trae la ficha (api-ficha) por proyecto:");
  console.log(tablaMd(["proyecto", "motivo", "unidades disponibles", "precio por unidad", "precio desde / hasta", "fecha de entrega", "pie en cuotas / bono pie", "gastos comunes", "año de recepción o permiso", "estacionamiento / bodega", "descuento", "subsidio"], filasInv));
  console.log("\nPrecio desde contra la unidad mediana (nuestros precios reales por unidad, GraphQL de sept) y disponibles contra conocidas:");
  console.log(tablaMd(["proyecto", "disponibles (ficha hoy)", "unidades activas (base)", "desde (ficha)", "hasta (ficha)", "desde (base)", "mediana (base)", "mediana / desde ficha"], filasPrecio));
  const ratios = resumen.filter((r) => r.conocidas > 0).map((r) => r.disponibles / r.conocidas);
  console.log(`\n2.4 · disponibles / conocidas: mediana ${fmt(mediana(ratios), 2)} (min ${fmt(Math.min(...ratios), 2)} · máx ${fmt(Math.max(...ratios), 2)}, n ${ratios.length}); suma disponibles ${resumen.reduce((s, r) => s + r.disponibles, 0)} contra conocidas ${resumen.reduce((s, r) => s + r.conocidas, 0)}`);
  writeFileSync("scripts/analisis/motor-nuevos/out/5-fichas.json", JSON.stringify({ uf, calculadoAt: new Date().toISOString(), resumen }, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
