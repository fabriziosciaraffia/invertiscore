/**
 * Formateo y parseo compartido del Dashboard v2. Puro: lo usan tanto el Server
 * Component (page.tsx) como el island de cliente (archive.tsx).
 */

import { normalizeLegacyVerdict, type Veredicto } from "@/lib/types";
import { formatDireccionDisplay } from "@/lib/format-direccion";
import type {
  AnalisisDashboardRow,
  ModalidadFilter,
  VeredictoFilter,
  OrigenFilter,
  DashboardSortKey,
  SortDir,
} from "@/lib/dashboard-query";

// ─── searchParams → parámetros de consulta ──────────────────────────────────
// La URL es el estado: filtro, búsqueda, orden y página sobreviven al back del
// browser y son compartibles. Todo lo que entra se valida contra las uniones —
// un `?sort=drop table` cae al default, no llega a la query.

export const PAGE_SIZE = 25;

const MODALIDADES: ModalidadFilter[] = ["todas", "long-term", "short-term", "ambas"];
const VEREDICTOS: VeredictoFilter[] = ["todos", "COMPRAR", "AJUSTA SUPUESTOS", "BUSCAR OTRA"];
const ORIGENES: OrigenFilter[] = ["todos", "franco", "mios"];

/**
 * EL ARCHIVO, UNA SOLA LISTA (17-oct-2026, decisión de Fabrizio): por fecha, el más reciente arriba —sin orden por
 * columna—, y con el origen a la vista: la marca «Franco» en los informes que salieron de un aviso (la selección semanal,
 * el aviso inmediato o la guía) y el filtro «De Franco» / «Míos». Lo fija el tier CASA §11.
 */
export const ARCHIVO_COPY = {
  marca: "Franco",
  /** El título de la marca cuando no se sabe si fue la selección o la guía (el de cada una: textoOrigenArchivo). */
  desdeAviso: "Desde un depto que te mostró Franco",
  deFranco: "De Franco",
  mios: "Míos",
} as const;

export interface DashboardParams {
  q: string;
  mod: ModalidadFilter;
  v: VeredictoFilter;
  /** «De Franco» / «Míos» (`?o=franco|mios`). */
  origen: OrigenFilter;
  /** Siempre fecha, el más reciente arriba (17-oct-2026): la lista no se ordena por columna. Se conserva el campo porque
   *  la agrupación por propiedad lo lee. */
  sort: DashboardSortKey;
  dir: SortDir;
  page: number;
  /** Modo «Agrupar por propiedad». */
  group: boolean;
  /** Claves de grupo expandidas (solo aplica con `group`). */
  open: string[];
}

export function parseParams(sp: Record<string, string | string[] | undefined>): DashboardParams {
  const one = (k: string): string => {
    const raw = sp[k];
    return (Array.isArray(raw) ? raw[0] : raw) ?? "";
  };
  const mod = one("mod") as ModalidadFilter;
  const v = one("v") as VeredictoFilter;
  const origen = one("o") as OrigenFilter;
  const pageNum = Number.parseInt(one("page"), 10);

  return {
    q: one("q").slice(0, 80),
    mod: MODALIDADES.includes(mod) ? mod : "todas",
    v: VEREDICTOS.includes(v) ? v : "todos",
    origen: ORIGENES.includes(origen) ? origen : "todos",
    // Por fecha, el más reciente arriba, siempre: un `?sort=` viejo no cambia el orden.
    sort: "fecha",
    dir: "desc",
    page: Number.isFinite(pageNum) && pageNum > 0 ? Math.min(pageNum, 40) : 0,
    group: one("group") === "1",
    // Tope de 12 grupos abiertos: la URL es estado compartible, no un buffer.
    open: one("open").split("~").filter(Boolean).slice(0, 12),
  };
}

/**
 * Construye el href del archivo con los cambios aplicados sobre los params
 * actuales. Cualquier cambio de filtro/búsqueda/orden resetea la página: si no,
 * filtrar estando en la página 3 muestra una lista vacía sin explicación.
 */
export function buildHref(current: DashboardParams, patch: Partial<DashboardParams>): string {
  const next = { ...current, ...patch };
  if (patch.page === undefined) next.page = 0;

  const sp = new URLSearchParams();
  if (next.q) sp.set("q", next.q);
  if (next.mod !== "todas") sp.set("mod", next.mod);
  if (next.v !== "todos") sp.set("v", next.v);
  if (next.origen !== "todos") sp.set("o", next.origen);
  if (next.page > 0) sp.set("page", String(next.page));
  if (next.group) sp.set("group", "1");
  if (next.group && next.open.length > 0) sp.set("open", next.open.join("~"));

  const qs = sp.toString();
  return qs ? `/dashboard?${qs}#archivo` : "/dashboard";
}

/**
 * Estado de expansión de un grupo. La clave viaja en `?open=` y el prefijo `*`
 * significa «además, mostrame todos los hijos».
 *
 * Por qué un prefijo y no una búsqueda por dirección: los miembros de un grupo
 * tienen strings de dirección DISTINTOS que normalizan a la misma clave («Av.
 * Providencia 1234» y «Avenida Providencia 1234»). Un `?q=` recuperaría solo
 * una parte del grupo, y el link diría «ver los 59 restantes» para mostrar 28.
 */
export function grupoAbierto(p: DashboardParams, key: string): boolean {
  return p.open.includes(key) || p.open.includes(`*${key}`);
}

export function grupoMuestraTodos(p: DashboardParams, key: string): boolean {
  return p.open.includes(`*${key}`);
}

/** Href que alterna la expansión de un grupo, conservando el resto del estado. */
export function toggleGrupoHref(current: DashboardParams, key: string): string {
  const abierto = grupoAbierto(current, key);
  const sinEste = current.open.filter((k) => k !== key && k !== `*${key}`);
  const open = abierto ? sinEste : [...sinEste, key];
  // La expansión no debe resetear la página: el usuario está mirando esta.
  return buildHref(current, { open, page: current.page });
}

/** Href que expande un grupo a TODOS sus hijos. */
export function verTodosHref(current: DashboardParams, key: string): string {
  const sinEste = current.open.filter((k) => k !== key && k !== `*${key}`);
  return buildHref(current, { open: [...sinEste, `*${key}`], page: current.page });
}

// ─── Formato ────────────────────────────────────────────────────────────────

/** CLP con signo explícito y separador de miles chileno: `+$84.200` / `−$118.400`. */
export function fmtCLPSigned(n: number): string {
  const v = Math.round(n);
  const abs = Math.abs(v).toLocaleString("es-CL");
  if (v > 0) return `+$${abs}`;
  if (v < 0) return `−$${abs}`;
  return `$0`;
}

/** Precio de compra en UF, formato chileno: `UF 5.480` (símbolo antes). */
export function fmtUF(n: number | null | undefined): string {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "—";
  return `UF ${Math.round(v).toLocaleString("es-CL")}`;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Fecha corta para la tabla: `26 jul` · `26 jul 25` si es de otro año. */
export function fmtFechaCorta(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const base = `${d.getDate()} ${MESES[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${String(d.getFullYear()).slice(2)}`;
}

/**
 * Lo que se muestra en la columna dirección. `direccion` es nullable (12 filas
 * reales hoy): esas caen al `nombre` autogenerado por el wizard.
 * NO se sanea el contenido — el demo tiene comillas literales en `nombre` y eso
 * se arregla en la data, no en el render.
 */
export function displayDireccion(row: Pick<AnalisisDashboardRow, "direccion" | "nombre" | "comuna">): string {
  const limpia = formatDireccionDisplay(row.direccion, null);
  return limpia || row.nombre;
}

/** Veredicto listo para pintar. La vista ya normaliza; esto blinda filas raras. */
export function veredictoDisplay(row: Pick<AnalisisDashboardRow, "veredicto" | "veredicto_norm">): Veredicto {
  return normalizeLegacyVerdict(row.veredicto) ?? row.veredicto_norm;
}

/** Ruta del informe según modalidad. Un par AMBAS abre la comparativa. */
export function hrefAnalisis(row: AnalisisDashboardRow, strSiblingId?: string): string {
  if (row.ambas_group_id && strSiblingId) {
    return `/analisis/comparativa?ltr=${row.id}&str=${strSiblingId}`;
  }
  return row.tipo_analisis === "short-term"
    ? `/analisis/renta-corta/${row.id}`
    : `/analisis/${row.id}`;
}

/**
 * Endpoint de PDF según modalidad, o null si esa modalidad no tiene PDF. Hoy ninguna: el LTR
 * salió de la UI en T5 (03-sep-2026) y el STR el 25-sep-2026, al salir la IA del informe; los
 * dos responden 410. Un par AMBAS entra por su fila LTR, así que tampoco. Con null la fila no
 * ofrece «Descargar PDF».
 */
export function hrefPdf(): string | null {
  return null;
}

// El demo público vive en `src/lib/demo.ts` (dos filas, una por modalidad) desde el 25-sep-2026.

/** Etiqueta corta de modalidad para el chip de la tabla. */
export function modalidadLabel(row: AnalisisDashboardRow): "LARGA" | "CORTA" | "AMBAS" {
  if (row.ambas_group_id) return "AMBAS";
  return row.tipo_analisis === "short-term" ? "CORTA" : "LARGA";
}
