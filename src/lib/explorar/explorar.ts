// ─────────────────────────────────────────────────────────────────────────────
// EXPLORAR (23-oct-2026, mockup docs/puerta-b-mockups/5-explorar.html): el mapa de TODOS los deptos que convienen para
// una búsqueda, con la evaluación de la noche. La parte pura, sin servidor ni navegador (la prueba el tier EXPLORAR).
//
//   · LOS FILTROS son el perfil de la persona al entrar (comunas, tipología, rango, pie y plazo) y se cambian en chips
//     arriba del mapa. Cambiarlos refresca el mapa y NO TOCA EL PERFIL GUARDADO: viven en la URL de la página y nada más.
//   · SOLO LOS COMPRAR: el pin es un depto que da Comprar con ese pie y ese plazo según la evaluación de anoche (a 25 años
//     las columnas del estándar de /deptos; a 30, las de la noche: por eso el chip de pie y plazo ofrece esas cuatro
//     combinaciones y no otras). `soloComprar` es la segunda red, después del SQL.
//   · EXPLORAR NO GASTA NADA; analizar sí: «Analizar este» abre el mismo aviso antes de gastar que la selección.
//   · LOS AGRUPADOS: donde hay muchos pines, un círculo con el número (agruparPines, por celdas en la proyección del mapa).
// ─────────────────────────────────────────────────────────────────────────────
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { PIE_DEPTOS, PLAZO_DEPTOS } from "@/lib/deptos/estandar";
import { ELECCIONES_POR_DEFECTO, lista, MAX_COMUNAS_PERFIL, RANGOS_UF, TIPOLOGIAS_DEPTOS } from "@/lib/deptos/respuesta";
import { marcaVisto } from "@/lib/guia/del-dia";
import { PLAN_ANALISIS_MES } from "@/lib/planes";
import type { EstadoSaldo } from "@/lib/casa-saldo";

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
/** Las tarjetas que el servidor dibuja antes del primer pintado; el resto llega con el mapa. Vive acá y no en el
 *  cliente: una constante exportada desde un módulo "use client" llega al servidor como referencia, no como número
 *  (visto el 23-oct-2026: `slice(0, referencia)` dejaba la hoja en «0 convienen» hasta que el mapa pedía el resto). */
export const TOPE_HOJA = 24;
/** El mapa quieto del primer pintado (el LCP del teléfono): una foto del mapa de Santiago con el estilo de Franco. En el
 *  teléfono va incrustada en el HTML (mapa-quieto.ts › MAPA_QUIETO_M); en escritorio, este archivo. En oscuro se invierte
 *  por CSS (sin una segunda foto). */
export const MAPA_QUIETO = { d: "/explorar/mapa-quieto-d.webp" } as const;

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

/** El pie de la lista más cercano al de la persona (sin pie, el estándar de 20 %) y el plazo (sin plazo, 25 años). */
const masCercano = <T extends number>(lista: readonly T[], v: number): T => lista.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
export function pieDeLista(piePct: number | null | undefined): PieExplorar { return piePct == null ? (PIE_DEPTOS as PieExplorar) : masCercano(PIES_EXPLORAR, piePct); }
export function plazoDeLista(plazoAnios: number | null | undefined): PlazoExplorar { return plazoAnios == null ? (PLAZO_DEPTOS as PlazoExplorar) : masCercano(PLAZOS_EXPLORAR, plazoAnios); }
/** El pie y el plazo de la NOCHE más cercanos (para contar rápido sin calcular: el botón del dashboard). */
export function pieDeLaNoche(piePct: number | null | undefined): (typeof PIES_NOCHE)[number] { return piePct != null && piePct >= 30 ? 30 : 20; }
export function plazoDeLaNoche(plazoAnios: number | null | undefined): (typeof PLAZOS_NOCHE)[number] { return plazoAnios != null && plazoAnios >= 30 ? 30 : 25; }

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
  const aMano = !!p.editado?.includes("precioMin");
  const ufMin = aMano && p.precioMinUf != null && p.precioMinUf < p.precioMaxUf ? Math.floor(p.precioMinUf) : 0;
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

/** Los filtros en la URL de la página (`?c=Ñuñoa,Macul&t=2&r=3000-4000&p=20&z=25`), para que recargar o volver los conserve. */
export function filtrosDeUrl(sp: { get(k: string): string | null }): FiltrosExplorar | null {
  const lista = (k: string) => (sp.get(k) ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const m = /^(\d+)-(\d+)$/.exec(sp.get("r") ?? "");
  return validarFiltros({ comunas: lista("c"), tipologias: lista("t"), ufMin: m ? Number(m[1]) : NaN, ufMax: m ? Number(m[2]) : NaN, pie: Number(sp.get("p")) as PieExplorar, plazo: Number(sp.get("z")) as PlazoExplorar });
}

export function urlDeFiltros(f: FiltrosExplorar): string {
  const p = new URLSearchParams({ c: f.comunas.join(","), t: f.tipologias.join(","), r: `${f.ufMin}-${f.ufMax}`, p: String(f.pie), z: String(f.plazo) });
  return p.toString();
}

/** Un cambio de chips: un filtro nuevo, sin tocar el anterior ni nada más (el perfil guardado queda como estaba). */
export function cambiarFiltro(f: FiltrosExplorar, parche: Partial<FiltrosExplorar>): FiltrosExplorar {
  return validarFiltros({ ...f, ...parche }) ?? f;
}

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

/** Lo que dice cada chip. */
export function etiquetaComunas(comunas: readonly string[]): string {
  return comunas.length <= 1 ? comunas[0] ?? "Comuna" : `${comunas[0]} +${comunas.length - 1}`;
}
export function etiquetaTipologias(tipologias: readonly string[]): string {
  const chips = TIPOLOGIAS_DEPTOS.filter((t) => tipologias.includes(t.id)).map((t) => t.chip);
  return chips.length === 0 ? "Tipología" : chips.length <= 2 ? chips.join(", ") : `${chips[0]} +${chips.length - 1}`;
}
export function etiquetaRango(f: Pick<FiltrosExplorar, "ufMin" | "ufMax">): string {
  const r = RANGOS_UF.find((x) => (x.min ?? 0) === f.ufMin && x.max === f.ufMax);
  if (r) return r.chip;
  return f.ufMin > 0 ? `UF ${miles(f.ufMin)} a ${miles(f.ufMax)}` : `Hasta UF ${miles(f.ufMax)}`;
}
export function etiquetaPiePlazo(f: Pick<FiltrosExplorar, "pie" | "plazo">): string {
  return `${f.pie} % · ${f.plazo} años`;
}
export const etiquetaPie = (f: Pick<FiltrosExplorar, "pie">): string => `Pie ${f.pie} %`;
export const etiquetaPlazo = (f: Pick<FiltrosExplorar, "plazo">): string => `${f.plazo} años`;
/** «Providencia · 2D · UF 3.000 a 4.000 · 20 % · 25 años»: la búsqueda entera, en una línea. */
export function lineaFiltros(f: FiltrosExplorar): string {
  return [lista(f.comunas), etiquetaTipologias(f.tipologias), etiquetaRango(f), etiquetaPiePlazo(f)].join(" · ");
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
}

/** SOLO SE MUESTRAN LOS COMPRAR: la segunda red, después del SQL. */
export function soloComprar<T extends { veredicto: string | null }>(filas: T[]): T[] {
  return filas.filter((f) => f.veredicto === "COMPRAR");
}

/** Por puntaje, el mejor primero (empate: el id, estable). */
export function porPuntaje<T extends { score: number | null; avisoId: string }>(pines: T[]): T[] {
  return [...pines].sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.avisoId.localeCompare(b.avisoId));
}

/** «312 convienen · 3 ya analizados»: la píldora sobre el mapa. */
export function pildora(convienen: number, analizados: number): string {
  const base = `${miles(convienen)} ${convienen === 1 ? "conviene" : "convienen"}`;
  return analizados > 0 ? `${base} · ${miles(analizados)} ya ${analizados === 1 ? "analizado" : "analizados"}` : base;
}

/** El título de la hoja de abajo. */
export function tituloHoja(convienen: number): string {
  if (convienen === 0) return "Ninguno conviene con estos filtros";
  return `${miles(convienen)} ${convienen === 1 ? "depto que conviene" : "deptos que convienen"}`;
}

/** «Tienes 2 análisis. Explorar no gasta; analizar sí.»: la línea al pie de la hoja. */
export function lineaSaldo(s: EstadoSaldo): string {
  const cola = EXPLORAR_COPY.noGasta;
  switch (s.tipo) {
    case "plan": return `Tu plan Ilimitado está activo. ${EXPLORAR_COPY.noGastaPlan}`;
    case "regalo": return `Tienes un análisis de regalo. ${cola}`;
    case "con": return `Tienes ${s.n === 1 ? "1 análisis" : `${s.n} análisis`}. ${cola}`;
    default: return `No te quedan análisis. ${cola}`;
  }
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

/** «Revisado con pie 20 % y 25 años. El informe completo incluye el enlace a la publicación.» */
export function textoRevisado(f: Pick<FiltrosExplorar, "pie" | "plazo">): { antes: string; enlace: string } {
  return { antes: `Revisado con pie ${f.pie} % y ${f.plazo} años. El informe completo incluye `, enlace: "el enlace a la publicación" };
}

/** La marca de cada depto: cuándo se vio publicado, o «Visto anoche» si la noche lo vio en el portal sin leer la ficha. */
export function marcaDePin(p: Pick<PinExplorar, "vistoAt">, ahora: Date = new Date()): string {
  return p.vistoAt ? marcaVisto(p.vistoAt, ahora) : EXPLORAR_COPY.vistoAnoche;
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
export const flujoTexto = (flujo: number) => `${flujo < 0 ? "−" : "+"}$${miles(Math.abs(flujo))}`;

/** Al entrar sin saldo: el mapa se ve igual, y encima el aviso E (4-ticket-y-popups.html). */
export function estadoDeEntrada(s: EstadoSaldo): { mapa: true; aviso: boolean } {
  return { mapa: true, aviso: s.tipo === "sin" };
}

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
export function textoCambio(p: { antes: { pie: number; veredicto: string; score: number | null; flujo: number | null }; despues: { pie: number; plazo: number; veredicto: string; score: number | null; flujo: number | null } }, etiqueta: (v: string) => string): { titulo: string; detalle: string; empeora: boolean } {
  const d = p.despues, a = p.antes;
  const empeora = d.veredicto !== "COMPRAR" && a.veredicto === "COMPRAR";
  const con = a.pie !== d.pie ? `pie ${d.pie} %` : `plazo ${d.plazo} años`;
  const titulo = `Con ${con} este depto da ${etiqueta(d.veredicto)}${d.score != null && d.veredicto === "COMPRAR" ? ` ${d.score}` : ""}.`;
  const flujo = d.flujo == null ? "" : `Flujo mensual ${flujoTexto(d.flujo)} ${d.flujo < 0 ? "de tu bolsillo" : "te queda"}.`;
  const antes = `Con ${a.pie} % daba ${etiqueta(a.veredicto)}${a.score != null ? ` ${a.score}` : ""}${a.flujo != null ? ` y ${flujoTexto(a.flujo)}` : ""}.`;
  return { titulo, detalle: [flujo, antes].filter(Boolean).join(" "), empeora };
}

export const EXPLORAR_COPY = {
  titulo: "Explorar",
  /** La etiqueta de la pestaña. */
  pestana: "Explorar · los deptos que convienen",
  volver: "Dashboard",
  analizar: "Analizar este",
  noGasta: "Explorar no gasta; analizar sí.",
  noGastaPlan: "Explorar no gasta nada.",
  ordenados: "Ordenados por puntaje",
  vistoAnoche: "Visto anoche",
  cerrar: "Cerrar",
  flujo: "Flujo mensual",
  capRate: "Cap rate",
  ufM2: "Precio por m²",
  teQueda: "te queda",
  saleDeTuBolsillo: "de tu bolsillo",
  yaAnalizado: "Ya lo analizaste",
  verInforme: "Ver informe",
  cargando: "Buscando los que convienen…",
  error: "No pudimos traer el mapa. Intenta de nuevo.",
  reintentar: "Reintentar",
  sinMapa: "El mapa no cargó, pero la lista de abajo es la misma.",
  vacia: "Con estos filtros ninguno conviene hoy. Prueba con otra comuna, otro rango o pie 30 %.",
  /** El perfil no alcanzaba para abrir con él: se abre con la búsqueda por defecto. */
  sinPerfil: "Tu perfil no tiene comuna, tipología o tope todavía: el mapa abre con una búsqueda de ejemplo. Cámbiala en los chips.",
  /** Los chips, como diálogos. */
  chips: { comuna: "Comuna", tipologia: "Tipología", rango: "Rango de precio", piePlazo: "Pie y plazo", pie: "Pie", plazo: "Plazo", listo: "Listo", hasta: (n: number) => `Hasta ${n} comunas.` },
  /** Mientras el servidor calcula una combinación que la noche no tiene (24-oct-2026). */
  calculando: "Calculando con tu pie…",
  cambiar: "Cambiar",
  analizarIgual: "Analizar igual",
  guardarPerfil: (pie: number, plazo: number) => `Guardar ${pie} % y ${plazo} años como mi perfil de búsqueda`,
  pie: "Pie",
  plazo: "Plazo",
  /** En el pop-up: «Con pie de 20 % y plazo de 25 años». */
  conPieYPlazo: (pie: number, plazo: number) => ({ antes: "Con pie de ", pie: `${pie} %`, medio: " y plazo de ", plazo: `${plazo} años` }),
  recalculando: "Recalculando…",
} as const;

/** El aviso E (4-ticket-y-popups.html): «Explorar los 312» sin saldo. El mapa se ve igual; esto va encima y se cierra. */
export const AVISO_SIN_SALDO = {
  sobre: "Explorar el mapa",
  titulo: (n: number) => (n > 0 ? `Para explorar los ${miles(n)} necesitas análisis disponibles.` : "Para explorar el mapa necesitas análisis disponibles."),
  cuerpo: "Con un pack, uno suelto o el plan entras al mapa completo: ves todos los que convienen para tu búsqueda y gastas un análisis solo cuando analizas uno.",
  soloNuevas: "Solo para cuentas nuevas",
  /** En la misma fila que «Solo para cuentas nuevas» (24-oct-2026, el aviso cabe en 390 × 740). */
  vence: (cuando: string) => `· vence ${cuando}`,
  /** La tarjeta roja dice «3 análisis por $14.990» (mockup E; 24-oct-2026), no el botón del pack. */
  packTicket: (precio: string) => `3 análisis por ${precio}`,
  aprovechar: (precio: string) => `Aprovechar · 3 por ${precio}`,
  plan: `Ver el plan de ${PLAN_ANALISIS_MES} al mes`,
  ahoraNo: "Ahora no",
} as const;
