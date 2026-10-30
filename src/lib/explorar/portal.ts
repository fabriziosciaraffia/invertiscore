// ─────────────────────────────────────────────────────────────────────────────
// EXPLORAR COMO PORTAL (28-oct-2026, mockup docs/puerta-b-mockups/5b-explorar-portal.html, estados A, B, C y D). La parte
// pura: los filtros, la URL, el orden, los pines compactos y los textos. Sin servidor ni navegador (la prueba el tier
// EXPLORAR-PORTAL). Reemplaza la entrada con el perfil del /explorar del 23-oct.
//
//   · LA VISTA GLOBAL AL ENTRAR (A): todo Gran Santiago, arriendo tradicional, el financiamiento por defecto (pie 20 % y 30 años), todas las comunas,
//     tipologías y precios, solo los Comprar: los mismos supuestos del número de anoche (/deptos). NO ABRE CON EL PERFIL:
//     «Mi búsqueda» lo aplica de una vez, si la persona lo toca.
//   · LOS FILTROS (B) se aplican en el navegador sobre el universo cargado —el número de «Ver N deptos» se actualiza al
//     tocar— y viven en la URL. NO TOCAN EL PERFIL GUARDADO: lo único que lo escribe es «Avísame de nuevos», con su
//     confirmación.
//   · EL UNIVERSO: con un pie y un plazo de la noche y arriendo tradicional, todo Gran Santiago en un pedido; con otro pie
//     u otro plazo, o en renta corta, se calcula en el momento por comuna (lo calculado vale 24 horas).
//   · EL PIN (C): lejos, grupos con número; con zoom, el flujo mensual («+$142 mil»); los ya analizados por la cuenta en
//     azul con «✓ Analizado»; los aparecidos en las últimas 24 horas, «Nuevo hoy».
// ─────────────────────────────────────────────────────────────────────────────
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { PIE_POR_DEFECTO, PLAZO_POR_DEFECTO, tasaElegidaDe } from "@/lib/deptos/estandar";
import { MAX_COMUNAS_PERFIL, TIPOLOGIAS_DEPTOS } from "@/lib/deptos/respuesta";
import { PLAN_ANALISIS_MES, PLAN_PRECIO_CLP, RUTA_PLAN } from "@/lib/planes";
import { tipologiaDe } from "@/lib/lo-que-sigue/perfil";
import { condicionDe, type CondicionDepto } from "@/lib/guia/linea-depto";
import { capRatePct, esCombinacionDeLaNoche, pieDeLista, PIES_EXPLORAR, plazoDeLista, PLAZOS_EXPLORAR, tipologiaDeDorm, type PieExplorar, type PlazoExplorar } from "./explorar";
import type { PerfilBusqueda } from "@/lib/perfil-busqueda";

export type ModalidadPortal = "ltr" | "str";
export type Publicados = "todos" | "7d" | "hoy";
export type OrdenPortal = "puntaje" | "flujo" | "caprate" | "precio" | "recientes";
/** Una caja del mapa: sur, oeste, norte, este. */
export type Caja = [number, number, number, number];

export interface FiltrosPortal {
  /** Vacío = todas las comunas de Gran Santiago. */
  comunas: string[];
  /** Los ids de TIPOLOGIAS_DEPTOS; vacío = todas. */
  tipologias: string[];
  /** Precio desde y hasta, en UF; null = sin límite. */
  ufMin: number | null;
  ufMax: number | null;
  pie: PieExplorar;
  plazo: PlazoExplorar;
  /** La tasa elegida (30-oct-2026, con cuenta): una de TASAS_ELEGIBLES; null = «la de hoy», la del motor. */
  tasa: number | null;
  modalidad: ModalidadPortal;
  flujoPositivo: boolean;
  publicados: Publicados;
  /** «Buscar en esta zona»: la caja del mapa al tocarlo. */
  zona: Caja | null;
}

/** LA VISTA GLOBAL: lo que abre /explorar sin nada en la URL. Los supuestos del número de anoche. */
export const FILTROS_GLOBALES: FiltrosPortal = {
  comunas: [], tipologias: [], ufMin: null, ufMax: null, pie: PIE_POR_DEFECTO, plazo: PLAZO_POR_DEFECTO, tasa: null, modalidad: "ltr", flujoPositivo: false, publicados: "todos", zona: null,
};
export const ORDEN_POR_DEFECTO: OrdenPortal = "puntaje";
export const ORDENES: ReadonlyArray<{ id: OrdenPortal; etiqueta: string }> = [
  { id: "puntaje", etiqueta: "Puntaje" },
  { id: "flujo", etiqueta: "Mayor flujo" },
  { id: "caprate", etiqueta: "Cap rate" },
  { id: "precio", etiqueta: "Menor precio" },
  { id: "recientes", etiqueta: "Más recientes" },
];
export const PUBLICADOS: ReadonlyArray<{ id: Publicados; etiqueta: string }> = [
  { id: "todos", etiqueta: "Cualquier fecha" },
  { id: "7d", etiqueta: "Últimos 7 días" },
  { id: "hoy", etiqueta: "Hoy" },
];

const COMUNAS_OK = new Set<string>(COMUNAS_DISPONIBLES as readonly string[]);
const TIPOS_OK = new Set(TIPOLOGIAS_DEPTOS.map((t) => t.id));
const ORDENES_OK = new Set(ORDENES.map((o) => o.id));
/** Los precios que se aceptan en «desde» y «hasta». */
export const UF_PORTAL_MIN = 0;
export const UF_PORTAL_MAX = 100000;

const esPie = (p: unknown): p is PieExplorar => (PIES_EXPLORAR as readonly number[]).includes(Number(p));
const esPlazo = (p: unknown): p is PlazoExplorar => (PLAZOS_EXPLORAR as readonly number[]).includes(Number(p));
const precio = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > UF_PORTAL_MIN && n <= UF_PORTAL_MAX ? n : null;
};
function caja(v: unknown): Caja | null {
  if (!Array.isArray(v) || v.length !== 4) return null;
  const [s, w, n, e] = v.map(Number);
  if (![s, w, n, e].every(Number.isFinite) || s >= n || w >= e || s < -34.2 || n > -32.9 || w < -71.3 || e > -70.2) return null;
  return [s, w, n, e].map((x) => Math.round(x * 1e5) / 1e5) as Caja;
}

/** Cualquier filtro que llegue de afuera (la URL, la API, un toque): siempre devuelve uno completo, con lo inválido en
 *  su valor global. Precio desde mayor que hasta: se dan vuelta. */
export function validarPortal(f: Partial<Record<keyof FiltrosPortal, unknown>> | null | undefined): FiltrosPortal {
  const g = FILTROS_GLOBALES;
  if (!f) return { ...g };
  const comunas = Array.isArray(f.comunas) ? Array.from(new Set(f.comunas.map((c) => String(c).trim()).filter((c) => COMUNAS_OK.has(c)))) : [];
  const tipologias = Array.isArray(f.tipologias) ? Array.from(new Set(f.tipologias.map(String).filter((t) => TIPOS_OK.has(t)))).sort() : [];
  let ufMin = precio(f.ufMin), ufMax = precio(f.ufMax);
  if (ufMin != null && ufMax != null && ufMin > ufMax) [ufMin, ufMax] = [ufMax, ufMin];
  return {
    // Todas las comunas marcadas es lo mismo que ninguna: la vista global.
    comunas: comunas.length === COMUNAS_OK.size ? [] : comunas,
    tipologias: tipologias.length === TIPOS_OK.size ? [] : tipologias,
    ufMin, ufMax,
    pie: esPie(f.pie) ? (Number(f.pie) as PieExplorar) : g.pie,
    plazo: esPlazo(f.plazo) ? (Number(f.plazo) as PlazoExplorar) : g.plazo,
    tasa: tasaElegidaDe(f.tasa),
    modalidad: f.modalidad === "str" ? "str" : "ltr",
    flujoPositivo: f.flujoPositivo === true,
    publicados: f.publicados === "7d" || f.publicados === "hoy" ? f.publicados : "todos",
    zona: caja(f.zona),
  };
}

/** Los filtros y el orden en la URL (`?c=Ñuñoa,Santiago&t=1,2&d=1500&h=3000&p=30&z=25&ta=4.5&m=str&f=1&pub=7d&o=flujo`).
 *  Solo lo que no es global; sin nada, la vista global. Sin `ta`, la tasa de hoy. */
export function portalDeUrl(sp: { get(k: string): string | null }): { filtros: FiltrosPortal; orden: OrdenPortal } {
  const lista = (k: string) => (sp.get(k) ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const zona = lista("zona").map(Number);
  const o = sp.get("o") ?? "";
  return {
    filtros: validarPortal({
      comunas: lista("c"), tipologias: lista("t"), ufMin: sp.get("d"), ufMax: sp.get("h"), pie: sp.get("p") ?? undefined, plazo: sp.get("z") ?? undefined,
      tasa: sp.get("ta"), modalidad: sp.get("m"), flujoPositivo: sp.get("f") === "1", publicados: sp.get("pub"), zona: zona.length === 4 ? zona : null,
    }),
    orden: ORDENES_OK.has(o as OrdenPortal) ? (o as OrdenPortal) : ORDEN_POR_DEFECTO,
  };
}

export function urlDePortal(f: FiltrosPortal, orden: OrdenPortal = ORDEN_POR_DEFECTO): string {
  const p = new URLSearchParams();
  if (f.comunas.length) p.set("c", f.comunas.join(","));
  if (f.tipologias.length) p.set("t", f.tipologias.join(","));
  if (f.ufMin != null) p.set("d", String(f.ufMin));
  if (f.ufMax != null) p.set("h", String(f.ufMax));
  if (f.pie !== FILTROS_GLOBALES.pie) p.set("p", String(f.pie));
  if (f.plazo !== FILTROS_GLOBALES.plazo) p.set("z", String(f.plazo));
  if (f.tasa != null) p.set("ta", String(f.tasa));
  if (f.modalidad === "str") p.set("m", "str");
  if (f.flujoPositivo) p.set("f", "1");
  if (f.publicados !== "todos") p.set("pub", f.publicados);
  if (f.zona) p.set("zona", f.zona.join(","));
  if (orden !== ORDEN_POR_DEFECTO) p.set("o", orden);
  return p.toString();
}

/** Cuántos filtros hay puestos («Filtros · 5»): cada grupo de la hoja cuenta uno; la zona del mapa también. */
export function filtrosActivos(f: FiltrosPortal): number {
  const g = FILTROS_GLOBALES;
  return [f.comunas.length > 0, f.tipologias.length > 0, f.ufMin != null || f.ufMax != null, f.pie !== g.pie || f.plazo !== g.plazo || f.tasa != null, f.modalidad !== g.modalidad, f.flujoPositivo, f.publicados !== g.publicados, f.zona != null].filter(Boolean).length;
}
export const esVistaGlobal = (f: FiltrosPortal): boolean => filtrosActivos(f) === 0;

// ── EL UNIVERSO ──────────────────────────────────────────────────────────────
/** Lo que hay que traer del servidor para unos filtros: la modalidad, el pie, el plazo y la tasa elegida (30-oct-2026: con
 *  `-t4.5` al final; sin ella, la de hoy). El resto se filtra acá. */
export const claveUniverso = (f: { modalidad: ModalidadPortal; pie: number; plazo: number; tasa?: number | null }): string => `${f.modalidad}-${f.pie}-${f.plazo}${f.tasa != null ? `-t${f.tasa}` : ""}`;
/** Arriendo tradicional con un pie y un plazo de la noche y la tasa de hoy: todo Gran Santiago sale de sus columnas, en un
 *  pedido. Con otra tasa, se calcula (30-oct-2026): la noche evaluó con la del motor. */
export const universoDeLaNoche = (f: { modalidad: ModalidadPortal; pie: number; plazo: number; tasa?: number | null }): boolean => f.modalidad === "ltr" && f.tasa == null && esCombinacionDeLaNoche(f as { pie: PieExplorar; plazo: PlazoExplorar });
/** Las comunas que hay que calcular cuando el universo no es de la noche: las elegidas o todas. */
export const comunasACalcular = (f: Pick<FiltrosPortal, "comunas">): string[] => (f.comunas.length ? [...f.comunas] : [...(COMUNAS_DISPONIBLES as readonly string[])]);

/** Un depto del mapa (solo los que dan Comprar). `arriendo`: el mensual con que se evaluó (renta corta: el ingreso
 *  mensual estimado por zona), para el cap rate. `alta`: cuándo apareció el aviso (segundos), para «Nuevo hoy». */
export interface PinMapa {
  avisoId: string;
  comuna: string;
  lat: number;
  lng: number;
  m2: number;
  dormitorios: number;
  banos: number | null;
  tipologia: string | null;
  precioUF: number;
  veredicto: string;
  score: number | null;
  flujo: number | null;
  arriendo: number | null;
  condicion?: CondicionDepto;
  alta: number | null;
}

/** Cómo viaja el universo: las comunas una vez y cada depto como un arreglo corto (650 kB → la mitad). */
export interface UniversoCompacto {
  comunas: string[];
  /** [id, comuna (índice), lat, lng, m2, dormitorios, baños, precio UF, puntaje, flujo, arriendo, condición (0 nada, 1 usado, 2 nuevo), alta] */
  filas: Array<[string, number, number, number, number, number, number | null, number, number | null, number | null, number | null, 0 | 1 | 2, number | null]>;
}

/** Una fila del servidor (la de explorar_mapa, o la armada para una combinación calculada) como pin. */
export function pinDeFila(r: { id: string; comuna: string; lat: unknown; lng: unknown; m2: unknown; dormitorios: unknown; banos: unknown; precio: unknown; score: unknown; flujo: unknown; arriendo: unknown; condicion: unknown; alta: unknown }): PinMapa {
  const n = (v: unknown): number | null => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  const dorm = Number(r.dormitorios) || 0;
  const cond = condicionDe(r.condicion);
  return {
    avisoId: r.id, comuna: r.comuna, lat: Number(r.lat), lng: Number(r.lng), m2: Math.round(Number(r.m2) || 0), dormitorios: dorm, banos: n(r.banos),
    tipologia: tipologiaDe(dorm, n(r.banos)), precioUF: Math.round(Number(r.precio) || 0), veredicto: "COMPRAR",
    score: n(r.score), flujo: n(r.flujo), arriendo: (n(r.arriendo) ?? 0) > 0 ? n(r.arriendo) : null, ...(cond ? { condicion: cond } : {}), alta: n(r.alta),
  };
}

export function compactar(pines: readonly PinMapa[]): UniversoCompacto {
  const comunas: string[] = [];
  const idx = new Map<string, number>();
  const filas: UniversoCompacto["filas"] = pines.map((p) => {
    let i = idx.get(p.comuna);
    if (i == null) { i = comunas.length; comunas.push(p.comuna); idx.set(p.comuna, i); }
    return [p.avisoId, i, Math.round(p.lat * 1e6) / 1e6, Math.round(p.lng * 1e6) / 1e6, p.m2, p.dormitorios, p.banos, p.precioUF, p.score, p.flujo, p.arriendo, p.condicion === "usado" ? 1 : p.condicion === "nuevo" ? 2 : 0, p.alta];
  });
  return { comunas, filas };
}

/** EL NÚMERO DE «CONVIENEN» (30-oct-2026): cuántos deptos hay en el universo que de verdad se ve en el mapa. Uno solo en
 *  todo el sitio —la landing, /explorar y su bienvenida, el botón «Explorar los N de Santiago» y la prueba de /deptos—: todos
 *  lo cuentan con esta función sobre el universo de la vista global (portal-cache.ts › convienenHoy). Null si no hay. */
export const cuantosConvienen = (u: UniversoCompacto | null | undefined): number | null =>
  u && Array.isArray(u.filas) && u.filas.length > 0 ? u.filas.length : null;

export function descompactar(u: UniversoCompacto | null | undefined): PinMapa[] {
  if (!u || !Array.isArray(u.filas)) return [];
  return u.filas.map(([id, ci, lat, lng, m2, dorm, banos, precioUF, score, flujo, arriendo, cond, alta]) => pinDeFila({
    id, comuna: u.comunas[ci] ?? "", lat, lng, m2, dormitorios: dorm, banos, precio: precioUF, score, flujo, arriendo, condicion: cond === 1 ? "usado" : cond === 2 ? "nuevo" : null, alta,
  }));
}

// ── EL FILTRO Y EL ORDEN (en el navegador) ──────────────────────────────────
const DIA_S = 86400;
/** Apareció en las últimas 24 horas. */
export const esNuevoHoy = (p: Pick<PinMapa, "alta">, ahora: Date = new Date()): boolean => p.alta != null && ahora.getTime() / 1000 - p.alta < DIA_S;

const dormsDeTipologias = (ids: readonly string[]): Set<number> => new Set(TIPOLOGIAS_DEPTOS.filter((t) => ids.includes(t.id)).flatMap((t) => t.dorms));

/** Un depto pasa los filtros (los del navegador: comunas, tipología, precio, flujo, publicados y zona). */
export function pasaFiltros(p: PinMapa, f: FiltrosPortal, ahora: Date = new Date()): boolean {
  if (f.comunas.length && !f.comunas.includes(p.comuna)) return false;
  if (f.tipologias.length) {
    const ds = dormsDeTipologias(f.tipologias);
    // «4D o más» incluye cualquier número de dormitorios desde 4.
    if (!ds.has(p.dormitorios) && !(f.tipologias.includes("4") && p.dormitorios >= 4)) return false;
  }
  if (f.ufMin != null && p.precioUF < f.ufMin) return false;
  if (f.ufMax != null && p.precioUF > f.ufMax) return false;
  if (f.flujoPositivo && !((p.flujo ?? 0) > 0)) return false;
  if (f.publicados !== "todos") {
    const dias = f.publicados === "hoy" ? 1 : 7;
    if (p.alta == null || ahora.getTime() / 1000 - p.alta >= dias * DIA_S) return false;
  }
  if (f.zona) {
    const [s, w, n, e] = f.zona;
    if (p.lat < s || p.lat > n || p.lng < w || p.lng > e) return false;
  }
  return true;
}

export const filtrar = (pines: readonly PinMapa[], f: FiltrosPortal, ahora: Date = new Date()): PinMapa[] => pines.filter((p) => pasaFiltros(p, f, ahora));

/** El orden de la lista: puntaje (por defecto), mayor flujo, cap rate, menor precio, más recientes. Empates: el id. */
export function ordenar(pines: readonly PinMapa[], orden: OrdenPortal, uf: number | null): PinMapa[] {
  const v = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? -Infinity : x);
  const clave: Record<OrdenPortal, (p: PinMapa) => number> = {
    puntaje: (p) => v(p.score),
    flujo: (p) => v(p.flujo),
    caprate: (p) => v(capRatePct(p.arriendo, p.precioUF, uf)),
    precio: (p) => -p.precioUF,
    recientes: (p) => v(p.alta),
  };
  const k = clave[orden] ?? clave.puntaje;
  return [...pines].sort((a, b) => k(b) - k(a) || a.avisoId.localeCompare(b.avisoId));
}

/** Los pines más cercanos a uno (él primero): la tarjeta se desliza de lado entre ellos. */
export function cercanos(pines: readonly PinMapa[], avisoId: string, max = 8): PinMapa[] {
  const p = pines.find((x) => x.avisoId === avisoId);
  if (!p) return [];
  const d = (q: PinMapa) => (q.lat - p.lat) ** 2 + ((q.lng - p.lng) * Math.cos(p.lat * Math.PI / 180)) ** 2;
  return [p, ...pines.filter((x) => x.avisoId !== avisoId).sort((a, b) => d(a) - d(b) || a.avisoId.localeCompare(b.avisoId)).slice(0, max - 1)];
}

// ── LOS TEXTOS ───────────────────────────────────────────────────────────────
const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

/** «+$142 mil»: el flujo mensual en el pin, redondeado a miles. */
export function flujoCorto(flujo: number): string {
  const k = Math.round(Math.abs(flujo) / 1000);
  const signo = flujo < 0 ? "−" : "+";
  return k === 0 ? `${signo}$${miles(Math.abs(flujo))}` : `${signo}$${miles(k)} mil`;
}

/** Lo que dice cada pin con zoom: el ya analizado manda, después lo nuevo, si no el flujo. */
export function textoPin(p: Pick<PinMapa, "flujo" | "alta">, o: { analizado: boolean; ahora?: Date }): { texto: string; tipo: "analizado" | "nuevo" | "flujo" } {
  if (o.analizado) return { texto: PORTAL_COPY.analizado, tipo: "analizado" };
  if (esNuevoHoy(p, o.ahora)) return { texto: PORTAL_COPY.nuevoHoy, tipo: "nuevo" };
  return { texto: p.flujo != null ? flujoCorto(p.flujo) : "Comprar", tipo: "flujo" };
}

/** «4,07»: la tasa con coma y hasta dos decimales. */
export const tasaTexto = (t: number): string => t.toLocaleString("es-CL", { maximumFractionDigits: 2 });

/** La tasa del motor (config.tasa_hipotecaria), que el servidor lee (portal-cache.ts › tasaDelMotor) y baja a /explorar. */
export interface TasaDelMotor {
  tasa: number;
}

/** LA HOJA «¿CÓMO SE CALCULA?» (30-oct-2026; el texto es el del recorrido real de Fabrizio del 30-oct): tres párrafos y
 *  «Entendido», con y sin cuenta. Los números salen de la constante del financiamiento por defecto (deptos/estandar.ts) y del
 *  motor (la tasa), nunca escritos a mano. «Un depto lleva [✓ Comprar]» es el chip de siempre (ChipVeredicto), con la regla
 *  del motor (analysis.ts › evalVeredicto): el Franco Score desde 70, o el depto que se paga solo (flujo ≥ 0, rentabilidad
 *  neta ≥ 4 % y no sobre el precio de su zona), y ninguna señal grave lo baja. «Algunos te piden poner un poco cada mes»
 *  porque uno de cada cinco Comprar tiene flujo negativo (1.113 de 5.176, medido el 30-oct-2026). Sin cuenta el flujo de la
 *  tarjeta va borroso: esa frase dice «con tu cuenta gratis», y cambiar el perfil pide registrarse. */
export const COMO_SE_CALCULA = {
  enlace: "¿Cómo se calcula?",
  titulo: "¿Cómo se calcula?",
  estandar: (tasa: number | null) =>
    `Cada noche Franco revisa los deptos en venta de Santiago y calcula cuáles convienen con un perfil de búsqueda estándar: pie de ${PIE_POR_DEFECTO} %, crédito a ${PLAZO_POR_DEFECTO} años y ${
      tasa != null && tasa > 0 ? `tasa de ${tasaTexto(tasa)} %, el promedio` : "la tasa promedio"
    } de los créditos hipotecarios según el Banco Central.`,
  cambiar: { antes: "Puedes cambiar ese perfil en ", fuerte: "Filtros", despues: (sinCuenta: boolean) => (sinCuenta ? ", registrándote gratis con tu correo." : ".") },
  chip: {
    antes: "Un depto lleva ",
    despues: " cuando su nota de 1 a 100 llega a 70, o cuando el arriendo lo paga solo sin estar caro para su zona. Y nunca tiene señales graves, como perder mucha plata todos los meses. Algunos te piden poner un poco cada mes: ",
  },
  cuanto: (sinCuenta: boolean) => (sinCuenta ? "con tu cuenta gratis, cada tarjeta te dice cuánto." : "cada tarjeta te dice cuánto."),
  /** Con una tasa elegida (30-oct-2026), tras «Puedes cambiar ese perfil en Filtros.»: la elegida y la de hoy. */
  tuTasa: (elegida: number, hoy: number | null) => ` Ahora el mapa calcula con tu tasa, ${tasaTexto(elegida)} %${hoy != null ? `; la de hoy es ${tasaTexto(hoy)} %` : ""}.`,
  boton: "Entendido",
} as const;

/** «4.770 deptos» (la barra de abajo y la cabecera de la lista, con el chip ✓ Comprar al lado); sin ninguno, la frase. */
export function deptosN(n: number): string {
  if (n === 0) return "Ninguno conviene con estos filtros";
  return n === 1 ? "1 depto" : `${miles(n)} deptos`;
}

/** La píldora negra del PC (30-oct-2026): «Ver lista · 4.770» y el chip; con cero, lo mismo que la barra del teléfono. */
export function pildoraLista(n: number): string {
  return `Ver lista · ${n > 0 ? miles(n) : deptosN(n)}`;
}

// (30-oct-2026, recorrido real de Fabrizio) Se retiraron con la tarjeta del número `numeroDelMapa` («4.807 convienen en Gran
// Santiago»), `tituloLista` y `dondeDe` («en Gran Santiago», que solo leían esas dos): abajo y en la lista va `deptosN` con el
// chip ✓ Comprar.

/** «Ver 1.236 deptos»: el botón de la hoja de filtros. */
export function botonVer(n: number | null): string {
  if (n == null) return "Ver deptos";
  if (n === 0) return "Ninguno con estos filtros";
  return `Ver ${miles(n)} ${n === 1 ? "depto" : "deptos"}`;
}

/** «☰ Filtros · 5». */
export const etiquetaFiltros = (f: FiltrosPortal): string => (filtrosActivos(f) ? `${PORTAL_COPY.filtros} · ${filtrosActivos(f)}` : PORTAL_COPY.filtros);

// ── «MI BÚSQUEDA» Y «AVÍSAME DE NUEVOS» ─────────────────────────────────────
/** «Mi búsqueda»: el perfil de la persona aplicado de una vez —comunas, tipología, rango, pie, plazo y modalidad—, sobre la
 *  vista global (lo demás vuelve a su valor). null si el perfil no tiene con qué buscar. */
export function filtrosDeMiBusqueda(p: (Pick<PerfilBusqueda, "comunas" | "dormitorios" | "precioMinUf" | "precioMaxUf" | "piePct" | "plazoAnios" | "modalidad"> & { tasaPct?: number | null }) | null | undefined): FiltrosPortal | null {
  if (!p) return null;
  const comunas = p.comunas.filter((c) => COMUNAS_OK.has(c));
  const tipologias = Array.from(new Set(p.dormitorios.map(tipologiaDeDorm)));
  if (comunas.length === 0 && tipologias.length === 0 && p.precioMaxUf == null) return null;
  return validarPortal({
    ...FILTROS_GLOBALES, comunas, tipologias,
    ufMin: p.precioMinUf != null && p.precioMinUf > 0 ? p.precioMinUf : null,
    // El tope que guarda «Avísame» sin «hasta» (TOPE_PERFIL_UF) es «cualquier precio», no un filtro.
    ufMax: p.precioMaxUf != null && p.precioMaxUf > 0 && p.precioMaxUf < TOPE_PERFIL_UF ? p.precioMaxUf : null,
    pie: pieDeLista(p.piePct), plazo: plazoDeLista(p.plazoAnios), tasa: p.tasaPct ?? null, modalidad: p.modalidad === "str" ? "str" : "ltr",
  });
}

/** Los dormitorios del perfil para unas tipologías (vacío = todas). */
function dormitoriosDePerfil(tipologias: readonly string[]): number[] {
  const ids = tipologias.length ? tipologias : TIPOLOGIAS_DEPTOS.map((t) => t.id);
  return Array.from(dormsDeTipologias(ids)).sort((a, b) => a - b);
}

/** EL PRECIO QUE NO SE PUSO: el perfil necesita un tope; sin «hasta», el máximo que acepta. */
export const TOPE_PERFIL_UF = 60000;

/** «Avísame de nuevos»: los filtros activos como perfil de búsqueda (lo que recibe PUT /api/perfil-busqueda). El perfil
 *  necesita entre una y ocho comunas: con todas (o con más de ocho) no se puede guardar y lo dice. La zona del mapa, el
 *  flujo positivo y la fecha de publicación no son parte del perfil. */
export function perfilDeFiltros(f: FiltrosPortal): { ok: true; cambios: { comunas: string[]; dormitorios: number[]; precioMinUf: number | null; precioMaxUf: number; piePct: number; plazoAnios: number; tasaPct: number | null; modalidad: ModalidadPortal } } | { ok: false; motivo: "comunas" } {
  if (f.comunas.length === 0 || f.comunas.length > MAX_COMUNAS_PERFIL) return { ok: false, motivo: "comunas" };
  const ufMax = f.ufMax != null && f.ufMax >= 500 ? Math.min(f.ufMax, TOPE_PERFIL_UF) : TOPE_PERFIL_UF;
  const ufMin = f.ufMin != null && f.ufMin >= 500 && f.ufMin < ufMax ? f.ufMin : null;
  return { ok: true, cambios: { comunas: [...f.comunas], dormitorios: dormitoriosDePerfil(f.tipologias), precioMinUf: ufMin, precioMaxUf: ufMax, piePct: f.pie, plazoAnios: f.plazo, tasaPct: f.tasa, modalidad: f.modalidad } };
}

/** Una búsqueda en una línea, para la confirmación: «Ñuñoa y Santiago · 1D y 2D · UF 1.500 a 3.000 · pie 20 % · 30 años ·
 *  arriendo tradicional». */
export function lineaBusqueda(b: { comunas: readonly string[]; dormitorios: readonly number[]; precioMinUf: number | null; precioMaxUf: number | null; piePct: number | null; plazoAnios: number | null; tasaPct?: number | null; modalidad: ModalidadPortal | null }): string {
  const y = (xs: readonly string[]) => (xs.length <= 1 ? xs[0] ?? "" : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
  const tipos = TIPOLOGIAS_DEPTOS.filter((t) => t.dorms.some((d) => b.dormitorios.includes(d))).map((t) => t.chip);
  const todas = tipos.length === TIPOLOGIAS_DEPTOS.length;
  const precio = b.precioMaxUf == null || b.precioMaxUf >= TOPE_PERFIL_UF
    ? (b.precioMinUf ? `desde UF ${miles(b.precioMinUf)}` : "cualquier precio")
    : b.precioMinUf ? `UF ${miles(b.precioMinUf)} a ${miles(b.precioMaxUf)}` : `hasta UF ${miles(b.precioMaxUf)}`;
  return [
    b.comunas.length ? y([...b.comunas]) : "Sin comunas",
    todas || tipos.length === 0 ? "todas las tipologías" : y(tipos),
    precio,
    b.piePct != null ? `pie ${b.piePct} %` : null,
    b.plazoAnios != null ? `${b.plazoAnios} años` : null,
    b.tasaPct != null ? `tasa ${tasaTexto(b.tasaPct)} %` : null,
    b.modalidad === "str" ? "renta corta" : "arriendo tradicional",
  ].filter(Boolean).join(" · ");
}

// ── EL PLAN DONDE SE USA ─────────────────────────────────────────────────────
/** Desde cuántos análisis hechos desde Explorar en 30 días el pop-up de confirmación sugiere el plan. */
export const PLAN_DESDE_N = 3;
export const VENTANA_PLAN_DIAS = 30;
/** La línea del pop-up, sin frenar: solo si ya hizo 3 o más desde Explorar en 30 días y no tiene una suscripción. */
export function lineaPlan(hechos: number, suscrito: boolean): { texto: string; href: string } | null {
  if (suscrito || hechos < PLAN_DESDE_N) return null;
  return { texto: `Llevas ${hechos} este mes. Con el Plan Franco, ${PLAN_ANALISIS_MES} al mes por $${miles(PLAN_PRECIO_CLP)}.`, href: RUTA_PLAN };
}

export const PORTAL_COPY = {
  filtros: "Filtros",
  ordenar: "Ordenar",
  sinMiBusqueda: "Todavía no tienes una búsqueda guardada.",
  buscarZona: "Buscar en esta zona",
  verLista: "Ver lista",
  mapa: "Mapa",
  avisame: "Avísame de nuevos",
  limpiar: "Limpiar",
  cerrar: "Cerrar",
  analizado: "✓ Analizado",
  nuevoHoy: "Nuevo hoy",
  analizar: "Analizar este",
  verInforme: "Ver informe",
  guardar: "Guardar",
  guardado: "Guardado",
  capRate: "Cap rate",
  alMes: "al mes",
  porM2: "UF/m²",
  usado: "Usado",
  nuevo: "Nuevo",
  /** La hoja de filtros. */
  hoja: {
    comunas: "Comunas", masComunas: (n: number) => `+ ${n} más`, menosComunas: "Ver menos", tipologia: "Tipología", precio: "Precio", desde: "Desde UF", hasta: "Hasta UF",
    piePlazo: "Con qué pie y plazo", pie: "Pie", plazo: "Plazo", arriendo: "Arriendo", tradicional: "Tradicional", corta: "Renta corta",
    cortaNota: "Estimado por zona; se mide al analizar.", flujo: "Solo con flujo positivo", publicados: "Publicados", zona: "Zona del mapa", quitarZona: "Quitar",
  },
  /** Mientras se calcula una combinación que la noche no tiene, o la renta corta. */
  calculando: "Calculando…",
  calculandoComunas: (hechas: number, total: number) => `Calculando… ${hechas} de ${total} comunas`,
  /** Con una tasa elegida (30-oct-2026): lo que dice abajo mientras calcula. */
  calculandoTasa: "Calculando con tu tasa…",
  calculandoTasaComunas: (hechas: number, total: number) => `Calculando con tu tasa… ${hechas} de ${total} comunas`,
  /** La primera opción de la tasa: la de hoy, que sigue al motor. */
  tasaHoy: (t: number | null) => (t != null ? `La de hoy (${tasaTexto(t)} %)` : "La de hoy"),
  /** La tasa elegida, cerrada (sin cuenta) o en la línea: «4,5 % · la elegiste». */
  tasaElegida: (t: number) => `${tasaTexto(t)} % · la elegiste`,
  error: "No pudimos traer los deptos. Intenta de nuevo.",
  reintentar: "Reintentar",
  sinMapa: "El mapa no cargó, pero la lista es la misma.",
  vacia: "Con estos filtros ninguno conviene hoy. Prueba con otra comuna, otro precio u otro pie.",
  /** Filtros en dos bloques (30-oct-2026): el depto y el financiamiento; la tasa, fija por ahora (la del motor). */
  elDepto: "El depto",
  tuFinanciamiento: "Tu financiamiento",
  tasa: "Tasa",
  tasaFija: (t: number) => `${tasaTexto(t)} % · promedio de los bancos`,
  usarMiBusqueda: "Usar mi búsqueda",
  /** La vuelta del registro desde un pin (30-oct-2026): la tarjeta desbloqueada con su banda, sin abrir el pop-up sola. */
  vuelta: { listo: "Listo, ya tienes tu cuenta.", regalo: "Tu análisis de regalo está listo para este depto.", analizarRegalo: "Analizar este · usa tu regalo" },
  anterior: "Depto anterior",
  siguiente: "Depto siguiente",
  /** La confirmación de «Avísame de nuevos». */
  aviso: {
    titulo: "Avísame de nuevos",
    cuerpo: "Desde ahora tu selección diaria y el correo semanal buscan con esto:",
    reemplaza: "Reemplaza tu búsqueda de ahora:",
    sinAntes: "Todavía no tenías una búsqueda guardada.",
    guardar: "Guardar y avisarme",
    cancelar: "Cancelar",
    listo: "Listo. Te avisamos de los nuevos que convengan.",
    faltanComunas: `Para avisarte, elige entre 1 y ${MAX_COMUNAS_PERFIL} comunas en Filtros.`,
    elegir: "Elegir comunas",
    error: "No pudimos guardar tu búsqueda. Intenta de nuevo.",
  },
  pestana: "Explorar · los deptos que convienen",
} as const;

/** Los eventos de Explorar (PostHog). «explorar_vista» y «explorar_analiza» también salen del servidor. */
export const EVENTOS_PORTAL = {
  vista: "explorar_vista",
  filtro: "explorar_filtro",
  pin: "explorar_pin",
  guardar: "explorar_guardar",
  avisame: "explorar_avisame",
  analiza: "explorar_analiza",
  planVisto: "explorar_plan_visto",
  /** Abrió «¿Cómo se calcula?» (30-oct-2026), con y sin cuenta. */
  comoSeCalcula: "explorar_como_se_calcula",
  /** Eligió una tasa (30-oct-2026), en Filtros o en el pop-up: la elegida, o «la de hoy». */
  tasa: "explorar_tasa",
} as const;

/** «explorar_tasa» (30-oct-2026): la tasa elegida (null = la de hoy), la de hoy y dónde se eligió. */
export function propsDeTasa(elegida: number | null, hoy: number | null, donde: "filtros" | "popup"): Record<string, unknown> {
  return { tasa: elegida, la_de_hoy: elegida == null, tasa_hoy: hoy, tasa_usada: elegida ?? hoy, donde };
}

/** Las propiedades de los filtros y el orden en un evento. */
export function propsDeFiltros(f: FiltrosPortal, orden: OrdenPortal): Record<string, unknown> {
  return {
    comunas: f.comunas, tipologias: f.tipologias, uf_min: f.ufMin, uf_max: f.ufMax, pie: f.pie, plazo: f.plazo, tasa: f.tasa, modalidad: f.modalidad,
    flujo_positivo: f.flujoPositivo, publicados: f.publicados, zona: !!f.zona, orden, filtros_activos: filtrosActivos(f), global: esVistaGlobal(f),
  };
}

/** Qué grupos de filtros cambiaron entre dos estados (para «explorar_filtro»). */
export function filtrosCambiados(a: FiltrosPortal, b: FiltrosPortal): string[] {
  const out: string[] = [];
  if (a.comunas.join() !== b.comunas.join()) out.push("comunas");
  if (a.tipologias.join() !== b.tipologias.join()) out.push("tipologia");
  if (a.ufMin !== b.ufMin || a.ufMax !== b.ufMax) out.push("precio");
  if (a.pie !== b.pie || a.plazo !== b.plazo) out.push("pie_plazo");
  if (a.tasa !== b.tasa) out.push("tasa");
  if (a.modalidad !== b.modalidad) out.push("modalidad");
  if (a.flujoPositivo !== b.flujoPositivo) out.push("flujo");
  if (a.publicados !== b.publicados) out.push("publicados");
  if ((a.zona ?? []).join() !== (b.zona ?? []).join()) out.push("zona");
  return out;
}
