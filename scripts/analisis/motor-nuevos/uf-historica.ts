// ─────────────────────────────────────────────────────────────────────────────
// LA UF Y LA TASA CON QUE SE EVALUÓ CADA FILA. avisos_evaluados no guarda ni la UF ni la tasa del día, y el flujo
// en pesos depende de las dos (el crédito es precio_uf × UF). Para reproducir una fila al peso hay que volver a
// ponerle su UF y su tasa:
//   · `update-market` corre a las 10:00 UTC y escribe en config `uf_value` = la UF DE ESE DÍA (serie F073.UFF.PRE.Z.D
//     del BCCh, redondeada a pesos enteros) y `tasa_hipotecaria` (promedio mensual del BCCh, cuando cambia).
//   · El cron de evaluación corre a las 04:20 y 08:20 UTC, ANTES de esa escritura: usa la UF del día anterior.
//     La carga por script (02 al 06-oct-2026) corrió a otras horas: después de las 10:00 UTC usa la del día.
//   · La UF por día sale de la tabla anual del SII (local no tiene credenciales del BCCh), con caché en
//     out/uf-por-dia.json para no pedirla dos veces.
//   · La tasa: 4,04 % hasta el 07-oct-2026 y 4,07 % desde el 08-oct (10:00 UTC). Lo dice la tabla `analisis`
//     (`input_data.tasaMercado` de los informes de cada día: 4,04 en los del 29-sep al 07-oct, 4,07 desde el 08-oct).
// Solo lectura: una llamada HTTP de lectura por fecha, nada en la base.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Config } from "./comun";

const CACHE = "scripts/analisis/motor-nuevos/out/uf-por-dia.json";
const HORA_UPDATE_MARKET_UTC = 10;

/** Cambios de `tasa_hipotecaria` en config (evidencia: `analisis.input_data.tasaMercado` por día). */
const TASA_POR_FECHA: Array<{ desde: string; tasa: number }> = [
  { desde: "2026-09-01T00:00:00Z", tasa: 4.04 },
  { desde: "2026-10-08T10:00:35Z", tasa: 4.07 },
];

let cache: Record<string, number> | null = null;
function leerCache(): Record<string, number> {
  if (cache) return cache;
  cache = existsSync(CACHE) ? (JSON.parse(readFileSync(CACHE, "utf8")) as Record<string, number>) : {};
  return cache;
}
function guardarCache() {
  mkdirSync("scripts/analisis/motor-nuevos/out", { recursive: true });
  writeFileSync(CACHE, JSON.stringify(cache, null, 1));
}

/** La tabla anual del SII (https://www.sii.cl/valores_y_fechas/uf/uf2026.htm): un GET por año, todos los días. */
async function tablaSii(anio: number): Promise<Record<string, number>> {
  const res = await fetch(`https://www.sii.cl/valores_y_fechas/uf/uf${anio}.htm`, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`SII uf${anio}: HTTP ${res.status}`);
  const html = Buffer.from(await res.arrayBuffer()).toString("latin1");
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const out: Record<string, number> = {};
  meses.forEach((m, k) => {
    const i = html.indexOf(`id='mes_${m}'`);
    if (i < 0) return;
    const seg = html.slice(i, html.indexOf("</table>", i));
    for (const [, d, v] of seg.matchAll(/<strong>(\d+)<\/strong><\/th>\s*<td width='200'>([\d.]+,\d+)<\/td>/g)) {
      out[`${anio}-${String(k + 1).padStart(2, "0")}-${d.padStart(2, "0")}`] = Number(v.replace(/\./g, "").replace(",", "."));
    }
  });
  if (Object.keys(out).length < 28) throw new Error(`SII uf${anio}: la tabla no se pudo leer (${Object.keys(out).length} días)`);
  return out;
}

/** La UF publicada para una fecha (YYYY-MM-DD), sin redondear. Fuente: la tabla del SII (mindicador.cl, el espejo
 *  del BCCh que se usó primero, se cayó el 05-nov-2026 a mitad de la medición; los días que alcanzó a dar calzan
 *  con el SII al centavo). */
export async function ufDelDia(fecha: string): Promise<number> {
  const c = leerCache();
  if (c[fecha]) return c[fecha];
  const anio = Number(fecha.slice(0, 4));
  Object.assign(c, await tablaSii(anio));
  guardarCache();
  const v = c[fecha];
  if (!(typeof v === "number" && v > 30000 && v < 60000)) throw new Error(`UF ${fecha}: sin valor plausible en la tabla del SII`);
  return v;
}

const diaUTC = (d: Date) => d.toISOString().slice(0, 10);

/** Días en que `update-market` escribió la UF TARDE (después de su hora): las filas evaluadas ese día después de las 10:00
 *  UTC calzan al peso con la UF del día anterior, y las del día siguiente antes de las 10:00 ya calzan con la del día
 *  (medido el 05-nov-2026: el 06-oct, filas de 11:39 a 12:35 UTC con la UF del 05-oct; una del 07-oct 04:25 UTC con la del
 *  06-oct). `DIAS_UPDATE_MARKET_TARDIO` (lista separada por comas) reemplaza la lista. */
const DIAS_UPDATE_MARKET_TARDIO = new Set((process.env.DIAS_UPDATE_MARKET_TARDIO ?? "2026-10-06").split(",").map((d) => d.trim()).filter(Boolean));

/** El día cuya UF tenía config en ese instante: el mismo si ya pasaron las 10:00 UTC, si no el anterior; y en un día de
 *  escritura tardía, el anterior durante todo ese día. */
export function diaDeLaUfVigente(instante: Date): string {
  const d = new Date(instante);
  const antesDeLaEscritura = d.getUTCHours() < HORA_UPDATE_MARKET_UTC || (d.getUTCHours() === HORA_UPDATE_MARKET_UTC && d.getUTCMinutes() === 0);
  if (antesDeLaEscritura || DIAS_UPDATE_MARKET_TARDIO.has(diaUTC(d))) d.setUTCDate(d.getUTCDate() - 1);
  return diaUTC(d);
}

export function tasaVigente(instante: Date): number {
  let t = TASA_POR_FECHA[0].tasa;
  for (const c of TASA_POR_FECHA) if (instante.getTime() >= new Date(c.desde).getTime()) t = c.tasa;
  return t;
}

/** La config (UF entera y tasa) con que la pasada evaluó una fila en `evaluado_at`. */
export async function configDeEvaluacion(evaluadoAt: string): Promise<Config> {
  const t = new Date(evaluadoAt);
  const uf = Math.round(await ufDelDia(diaDeLaUfVigente(t)));
  return { uf, tasa: tasaVigente(t) };
}

/** Precarga la UF de todos los días que hacen falta (una llamada por día distinto). */
export async function precargarUf(evaluadoAts: Iterable<string>): Promise<void> {
  const dias = new Set<string>();
  for (const e of evaluadoAts) dias.add(diaDeLaUfVigente(new Date(e)));
  for (const d of dias) await ufDelDia(d);
}
