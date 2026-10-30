// ─────────────────────────────────────────────────────────────────────────────
// EXPLORAR (23-oct-2026, mockup docs/puerta-b-mockups/5-explorar.html): el mapa de TODOS los deptos que convienen para
// una búsqueda, con la evaluación de la noche. La parte pura, sin servidor ni navegador (la prueba el tier EXPLORAR).
// DESDE EL 28-OCT-2026 EXPLORAR ES UN PORTAL (portal.ts, 5b-explorar-portal.html): abre con la vista global y no con el
// perfil, y sus filtros, su URL y sus textos viven allá. Acá queda lo que comparten el portal, el mapa del dashboard
// (filtrosDePerfil, FiltrosExplorar) y el pop-up de siempre (las listas de pie y plazo, «Cambiar», el cap rate). Se
// retiraron los chips del 23-oct (filtrosDeUrl, cambiarFiltro, etiquetas), la hoja con «Revisado con…» y «Visto anoche»,
// «Explorar no gasta» y el mapa cerrado sin saldo del 24-oct (explorarCerrado, pinCerrado, el aviso E).
//
//   · LOS FILTROS DEL DASHBOARD: el perfil de la persona (comunas, tipología, rango, pie y plazo), para el mapa de su
//     selección (lib/casa/mapa-casa-servidor.ts).
//   · SOLO LOS COMPRAR: el pin es un depto que da Comprar con ese pie y ese plazo según la evaluación de anoche (a 25 o 30 años
//     las columnas del estándar de /deptos; a 30, las de la noche: por eso el chip de pie y plazo ofrece esas cuatro
//     combinaciones y no otras). `soloComprar` es la segunda red, después del SQL.
//   · ANALIZAR ES LO ÚNICO QUE GASTA: «Analizar este» abre el mismo aviso antes de gastar que la selección.
//   · LOS AGRUPADOS: donde hay muchos pines, un círculo con el número (agruparPines, por celdas en la proyección del mapa).
// ─────────────────────────────────────────────────────────────────────────────
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { PIE_DEPTOS, PLAZO_DEPTOS } from "@/lib/deptos/estandar";
import { ELECCIONES_POR_DEFECTO, MAX_COMUNAS_PERFIL, RANGOS_UF, TIPOLOGIAS_DEPTOS } from "@/lib/deptos/respuesta";
import type { EstadoSaldo } from "@/lib/casa-saldo";
import type { CondicionDepto } from "@/lib/guia/linea-depto";
/** «4,5», «4,07» (la tasa, en el pop-up). */
const tasaTxt = (t: number): string => t.toLocaleString("es-CL", { maximumFractionDigits: 2 });

/**
 * CUALQUIER PIE Y PLAZO (24-oct-2026, decisión de Fabrizio): los chips ofrecen pie de 10 a 50 % y plazo de 15 a 30 años.
 * Las cuatro combinaciones de la noche (PIES_NOCHE × PLAZOS_NOCHE) salen de sus columnas; cualquier otra se calcula en el
 * momento solo para los avisos de los filtros activos y se guarda 24 horas en `avisos_evaluados.combos` (servidor.ts).
 */
export const PIES_EXPLORAR = [10, 15, 20, 25, 30, 40, 50] as const;
export const PLAZOS_EXPLORAR = [15, 20, 25, 30] as const;
export type PieExplorar = (typeof PIES_EXPLORAR)[number];
export type PlazoExplorar = (typeof PLAZOS_EXPLORAR)[number];
/** Lo que la noche evaluó y tiene columna propia: pie 20/30 a 25 y 30 años (estandar-deptos.ts, evaluar-aviso.ts). */
export const PIES_NOCHE = [20, 30] as const;
export const PLAZOS_NOCHE = [25, 30] as const;
export function esCombinacionDeLaNoche(f: Pick<FiltrosExplorar, "pie" | "plazo">): boolean {
  return (PIES_NOCHE as readonly number[]).includes(f.pie) && (PLAZOS_NOCHE as readonly number[]).includes(f.plazo);
}
/** La clave de una combinación en `combos`: «15-20». */
export const claveCombo = (f: Pick<FiltrosExplorar, "pie" | "plazo">): string => `${f.pie}-${f.plazo}`;
/** Lo guardado por combinación: veredicto, puntaje, flujo y cuándo se calculó. Vale 24 horas, y solo si es posterior a la
 *  evaluación de la noche de esa fila (una reevaluación lo invalida sola). */
export interface ComboGuardado { v: string | null; s: number | null; f: number | null; at: string }
export const VIDA_COMBO_MS = 24 * 3600_000;
export function comboVigente(c: unknown, evaluadoAt: string | null | undefined, ahora: Date = new Date()): c is ComboGuardado {
  if (!c || typeof c !== "object") return false;
  const at = Date.parse(String((c as { at?: unknown }).at ?? ""));
  if (!Number.isFinite(at)) return false;
  if (ahora.getTime() - at > VIDA_COMBO_MS) return false;
  const ev = evaluadoAt ? Date.parse(evaluadoAt) : NaN;
  return !(Number.isFinite(ev) && at < ev);
}
/** El tope de «Más de UF 5.500» (el de RANGOS_UF). */
export const UF_TOPE = 60000;
/** El mapa quieto del primer pintado (el LCP del teléfono): una foto del mapa de Santiago con el estilo de Franco. En el
 *  teléfono va incrustada en el HTML (mapa-quieto.ts › MAPA_QUIETO_M); en escritorio, este archivo. En oscuro (30-oct-2026),
 *  su versión con el estilo oscuro de Franco y el mismo encuadre (Static Maps registrado contra la clara): dos archivos que el
 *  CSS pone de fondo solo con el tema oscuro, así que quien navega en claro no los baja (explorar.css › .ex-mapa-quieto). */
export const MAPA_QUIETO = { d: "/explorar/mapa-quieto-d.webp", dOscuro: "/explorar/mapa-quieto-d-oscuro.webp", mOscuro: "/explorar/mapa-quieto-m-oscuro.webp" } as const;

export interface FiltrosExplorar {
  comunas: string[];
  /** Los ids de TIPOLOGIAS_DEPTOS («0» estudio … «4» cuatro o más). */
  tipologias: string[];
  ufMin: number;
  ufMax: number;
  pie: PieExplorar;
  plazo: PlazoExplorar;
}

export const FILTROS_POR_DEFECTO: FiltrosExplorar = {
  comunas: [...ELECCIONES_POR_DEFECTO.comunas], tipologias: [...ELECCIONES_POR_DEFECTO.tipologias],
  ufMin: RANGOS_UF.find((r) => r.id === ELECCIONES_POR_DEFECTO.rango)?.min ?? 3000, ufMax: RANGOS_UF.find((r) => r.id === ELECCIONES_POR_DEFECTO.rango)?.max ?? 4000,
  pie: PIE_DEPTOS as PieExplorar, plazo: PLAZO_DEPTOS as PlazoExplorar,
};

const COMUNAS_OK = new Set<string>(COMUNAS_DISPONIBLES as readonly string[]);
const esPie = (p: unknown): p is PieExplorar => (PIES_EXPLORAR as readonly number[]).includes(Number(p));
const esPlazo = (p: unknown): p is PlazoExplorar => (PLAZOS_EXPLORAR as readonly number[]).includes(Number(p));

/** El pie de la lista más cercano al de la persona y el plazo; sin pie o sin plazo, el financiamiento por defecto (deptos/estandar.ts). */
const masCercano = <T extends number>(lista: readonly T[], v: number): T => lista.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
export function pieDeLista(piePct: number | null | undefined): PieExplorar { return piePct == null ? (PIE_DEPTOS as PieExplorar) : masCercano(PIES_EXPLORAR, piePct); }
export function plazoDeLista(plazoAnios: number | null | undefined): PlazoExplorar { return plazoAnios == null ? (PLAZO_DEPTOS as PlazoExplorar) : masCercano(PLAZOS_EXPLORAR, plazoAnios); }
/** El pie y el plazo de la NOCHE más cercanos (para contar rápido sin calcular: el botón del dashboard). */
export function pieDeLaNoche(piePct: number | null | undefined): (typeof PIES_NOCHE)[number] { return piePct != null && piePct >= 30 ? 30 : 20; }
export function plazoDeLaNoche(plazoAnios: number | null | undefined): (typeof PLAZOS_NOCHE)[number] { return plazoAnios == null ? PLAZO_DEPTOS : plazoAnios >= 30 ? 30 : 25; }

/** El id de tipología de un dormitorio del perfil (4 o más → «4»). */
export const tipologiaDeDorm = (d: number): string => (d >= 4 ? "4" : String(Math.max(0, Math.round(d))));
/** Los dormitorios que buscan unos ids de tipología. */
export function dormsDe(tipologias: readonly string[]): number[] {
  return Array.from(new Set(TIPOLOGIAS_DEPTOS.filter((t) => tipologias.includes(t.id)).flatMap((t) => t.dorms))).sort((a, b) => a - b);
}

/** Con qué filtros abre el mapa: el perfil de la persona, tal cual. null si el perfil no alcanza (sin comuna, sin
 *  dormitorios o sin tope): ahí abre con la búsqueda por defecto y lo dice. */
export function filtrosDePerfil(p: { comunas: string[]; dormitorios: number[]; precioMinUf: number | null; precioMaxUf: number | null; piePct: number | null; plazoAnios: number | null; editado?: readonly string[] }): FiltrosExplorar | null {
  const comunas = p.comunas.filter((c) => COMUNAS_OK.has(c)).slice(0, MAX_COMUNAS_PERFIL);
  const tipologias = Array.from(new Set(p.dormitorios.map(tipologiaDeDorm))).sort();
  if (comunas.length === 0 || tipologias.length === 0 || p.precioMaxUf == null || p.precioMaxUf <= 0) return null;
  // El piso, tal cual: desde el 26-oct-2026 el inferido también es un chip de /deptos (perfil-busqueda.ts), como el elegido.
  const ufMin = p.precioMinUf != null && p.precioMinUf > 0 && p.precioMinUf < p.precioMaxUf ? Math.floor(p.precioMinUf) : 0;
  return { comunas, tipologias, ufMin, ufMax: Math.round(p.precioMaxUf), pie: pieDeLista(p.piePct), plazo: plazoDeLista(p.plazoAnios) };
}

/** Lo que valida cualquier filtro que llegue de afuera (la URL, la API): o es un filtro completo, o null. */
export function validarFiltros(f: Partial<FiltrosExplorar> | null | undefined): FiltrosExplorar | null {
  if (!f) return null;
  const comunas = Array.from(new Set((f.comunas ?? []).map((c) => String(c).trim()).filter((c) => COMUNAS_OK.has(c))));
  const tipologias = Array.from(new Set((f.tipologias ?? []).map(String).filter((t) => TIPOLOGIAS_DEPTOS.some((x) => x.id === t)))).sort();
  const ufMin = Number(f.ufMin), ufMax = Number(f.ufMax);
  if (comunas.length === 0 || comunas.length > MAX_COMUNAS_PERFIL || tipologias.length === 0) return null;
  if (!Number.isFinite(ufMin) || !Number.isFinite(ufMax) || ufMin < 0 || ufMax <= ufMin || ufMax > UF_TOPE) return null;
  if (!esPie(f.pie) || !esPlazo(f.plazo)) return null;
  return { comunas, tipologias, ufMin: Math.round(ufMin), ufMax: Math.round(ufMax), pie: Number(f.pie) as PieExplorar, plazo: Number(f.plazo) as PlazoExplorar };
}

/** Un depto del mapa: sin enlace ni textos del aviso (eso va en el informe). */
export interface PinExplorar {
  avisoId: string;
  comuna: string;
  lat: number;
  lng: number;
  m2: number;
  dormitorios: number;
  tipologia: string | null;
  precioUF: number;
  veredicto: string;
  score: number | null;
  flujo: number | null;
  /** El arriendo mensual con que Franco lo evaluó (CLP), para el cap rate. */
  arriendo: number | null;
  /** Cuándo se vio publicado (su último chequeo de ficha), si en la última semana; null = visto anoche sin ficha leída. */
  vistoAt: string | null;
  /** Nuevo o usado, como lo dice el aviso (28-oct-2026): «· Usado» al final de la línea de la tarjeta y de la hoja. */
  condicion?: CondicionDepto;
}

/** SOLO SE MUESTRAN LOS COMPRAR: la segunda red, después del SQL. */
export function soloComprar<T extends { veredicto: string | null }>(filas: T[]): T[] {
  return filas.filter((f) => f.veredicto === "COMPRAR");
}

/** Por puntaje, el mejor primero (empate: el id, estable). */
export function porPuntaje<T extends { score: number | null; avisoId: string }>(pines: T[]): T[] {
  return [...pines].sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.avisoId.localeCompare(b.avisoId));
}

/** «Analizar este · usa 1 de tus 2»: el botón, con lo que usa. */
export function botonAnalizar(s: EstadoSaldo): string {
  const base = EXPLORAR_COPY.analizar;
  switch (s.tipo) {
    case "con": return s.proximoRegalo ? `${base} · usa tu análisis de regalo` : s.n === 1 ? `${base} · usa tu último análisis` : `${base} · usa 1 de tus ${s.n}`;
    case "regalo": return `${base} · usa tu análisis de regalo`;
    default: return base;
  }
}

/** El cap rate bruto: el arriendo del año sobre el precio, en puntos (5,8). null sin arriendo, UF o precio. */
export function capRatePct(arriendoMensual: number | null, precioUF: number, uf: number | null): number | null {
  if (arriendoMensual == null || arriendoMensual <= 0 || !uf || uf <= 0 || precioUF <= 0) return null;
  return (arriendoMensual * 12) / (precioUF * uf) * 100;
}
export function ufPorM2(precioUF: number, m2: number): number | null {
  return m2 > 0 && precioUF > 0 ? precioUF / m2 : null;
}
export const pctUno = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
export const flujoTexto = (flujo: number) => `${flujo < 0 ? "−" : "+"}$${miles(Math.abs(flujo))}`;

// ── LOS AGRUPADOS ────────────────────────────────────────────────────────────
export interface Grupo {
  lat: number;
  lng: number;
  n: number;
  ids: string[];
  /** Cuántos del grupo ya analizó esta cuenta. */
  analizados: number;
}

/** La proyección del mapa (Web Mercator), en píxeles del mundo a ese zoom. */
export function proyectar(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const escala = 256 * Math.pow(2, zoom);
  const sin = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return { x: ((lng + 180) / 360) * escala, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * escala };
}

/** Los pines agrupados por celdas de `celdaPx` píxeles a ese zoom: donde hay muchos, un número; donde hay uno, el pin. */
export function agruparPines(pines: ReadonlyArray<Pick<PinExplorar, "avisoId" | "lat" | "lng">>, zoom: number, analizados: ReadonlySet<string> = new Set(), celdaPx = 56): Grupo[] {
  const celdas = new Map<string, { sx: number; sy: number; ids: string[]; analizados: number }>();
  for (const p of pines) {
    const { x, y } = proyectar(p.lat, p.lng, zoom);
    const k = `${Math.floor(x / celdaPx)}:${Math.floor(y / celdaPx)}`;
    const c = celdas.get(k) ?? { sx: 0, sy: 0, ids: [], analizados: 0 };
    c.sx += p.lat; c.sy += p.lng; c.ids.push(p.avisoId);
    if (analizados.has(p.avisoId)) c.analizados++;
    celdas.set(k, c);
  }
  return Array.from(celdas.values()).map((c) => ({ lat: c.sx / c.ids.length, lng: c.sy / c.ids.length, n: c.ids.length, ids: c.ids, analizados: c.analizados }));
}

// ── EL POP-UP CON EL CAMBIO DE PIE Y PLAZO (4-ticket-y-popups.html, D1 y D2) ─────────────────────
/** Lo que ofrece «Cambiar» en el aviso antes de gastar: el pie y el plazo con que se analiza. */
export const PIES_POPUP = PIES_EXPLORAR;
export const PLAZOS_POPUP = PLAZOS_EXPLORAR;
export const esPiePopup = (p: unknown): p is (typeof PIES_POPUP)[number] => (PIES_POPUP as readonly number[]).includes(Number(p));
export const esPlazoPopup = (p: unknown): p is (typeof PLAZOS_POPUP)[number] => (PLAZOS_POPUP as readonly number[]).includes(Number(p));

export interface Recalculo {
  veredicto: string;
  score: number | null;
  flujo: number | null;
  cuota: number | null;
}

/** Con pie 10 % este depto da Ajustar. / Flujo mensual −$45.120 de tu bolsillo. Con 20 % daba Comprar 88 y +$88.363. */
export function textoCambio(p: { antes: { pie: number; plazo?: number; tasa?: number | null; veredicto: string; score: number | null; flujo: number | null }; despues: { pie: number; plazo: number; tasa?: number | null; veredicto: string; score: number | null; flujo: number | null } }, etiqueta: (v: string) => string): { titulo: string; detalle: string; empeora: boolean } {
  const d = p.despues, a = p.antes;
  const empeora = d.veredicto !== "COMPRAR" && a.veredicto === "COMPRAR";
  // Solo la tasa (30-oct-2026): «Con tasa 4,5 % este depto da…» y «Con la tasa de hoy daba…».
  const soloTasa = a.pie === d.pie && (a.plazo == null || a.plazo === d.plazo) && (a.tasa ?? null) !== (d.tasa ?? null);
  const tasaDe = (t: number | null | undefined) => (t != null ? `tasa ${tasaTxt(t)} %` : "la tasa de hoy");
  const con = a.pie !== d.pie ? `pie ${d.pie} %` : soloTasa ? tasaDe(d.tasa) : `plazo ${d.plazo} años`;
  const titulo = `Con ${con} este depto da ${etiqueta(d.veredicto)}${d.score != null && d.veredicto === "COMPRAR" ? ` ${d.score}` : ""}.`;
  const flujo = d.flujo == null ? "" : `Flujo mensual ${flujoTexto(d.flujo)} ${d.flujo < 0 ? "de tu bolsillo" : "te queda"}.`;
  const antes = `Con ${soloTasa ? tasaDe(a.tasa) : `${a.pie} %`} daba ${etiqueta(a.veredicto)}${a.score != null ? ` ${a.score}` : ""}${a.flujo != null ? ` y ${flujoTexto(a.flujo)}` : ""}.`;
  return { titulo, detalle: [flujo, antes].filter(Boolean).join(" "), empeora };
}

export const EXPLORAR_COPY = {
  analizar: "Analizar este",
  /** Lo que ofrece «Cambiar» en el pop-up (24-oct-2026). */
  cambiar: "Cambiar",
  analizarIgual: "Analizar igual",
  /** Con una tasa elegida (30-oct-2026) la casilla la nombra; con la de hoy, como siempre. */
  guardarPerfil: (pie: number, plazo: number, tasa: number | null = null) =>
    tasa != null ? `Guardar ${pie} %, ${plazo} años y tasa ${tasaTxt(tasa)} % como mi perfil de búsqueda` : `Guardar ${pie} % y ${plazo} años como mi perfil de búsqueda`,
  pie: "Pie",
  plazo: "Plazo",
  /** En el pop-up: «Con pie de 20 %, plazo de 30 años y tasa de 4,07 %» (los de la persona; sin ellos, el financiamiento por
   *  defecto). La tasa (30-oct-2026) es la elegida o la de hoy; sin conocerla, «Con pie de 20 % y plazo de 30 años». */
  conPieYPlazo: (pie: number, plazo: number, tasa: number | null = null) => (tasa != null
    ? { antes: "Con pie de ", pie: `${pie} %`, medio: ", plazo de ", plazo: `${plazo} años`, fin: " y tasa de ", tasa: `${tasaTxt(tasa)} %` }
    : { antes: "Con pie de ", pie: `${pie} %`, medio: " y plazo de ", plazo: `${plazo} años`, fin: "", tasa: "" }),
  tasa: "Tasa",
  /** La primera opción: la de hoy, que sigue al motor. */
  tasaHoy: (t: number | null) => (t != null ? `La de hoy (${tasaTxt(t)} %)` : "La de hoy"),
  recalculando: "Recalculando…",
} as const;
