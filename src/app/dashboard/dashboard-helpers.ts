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
const SORTS: DashboardSortKey[] = ["fecha", "score", "flujo", "cap", "multiplicador"];

export interface DashboardParams {
  q: string;
  mod: ModalidadFilter;
  v: VeredictoFilter;
  sort: DashboardSortKey;
  dir: SortDir;
  page: number;
}

export function parseParams(sp: Record<string, string | string[] | undefined>): DashboardParams {
  const one = (k: string): string => {
    const raw = sp[k];
    return (Array.isArray(raw) ? raw[0] : raw) ?? "";
  };
  const mod = one("mod") as ModalidadFilter;
  const v = one("v") as VeredictoFilter;
  const sort = one("sort") as DashboardSortKey;
  const pageNum = Number.parseInt(one("page"), 10);

  return {
    q: one("q").slice(0, 80),
    mod: MODALIDADES.includes(mod) ? mod : "todas",
    v: VEREDICTOS.includes(v) ? v : "todos",
    sort: SORTS.includes(sort) ? sort : "fecha",
    dir: one("dir") === "asc" ? "asc" : "desc",
    page: Number.isFinite(pageNum) && pageNum > 0 ? Math.min(pageNum, 40) : 0,
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
  if (next.sort !== "fecha") sp.set("sort", next.sort);
  if (next.dir !== "desc") sp.set("dir", next.dir);
  if (next.page > 0) sp.set("page", String(next.page));

  const qs = sp.toString();
  return qs ? `/dashboard?${qs}#archivo` : "/dashboard";
}

/** Click en un header de columna: misma columna alterna dirección, otra empieza desc. */
export function sortHref(current: DashboardParams, key: DashboardSortKey): string {
  const dir: SortDir = current.sort === key && current.dir === "desc" ? "asc" : "desc";
  return buildHref(current, { sort: key, dir });
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

/** Cap rate — ya viene en porcentaje desde la vista. NULL en filas legacy. */
export function fmtCap(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1).replace(".", ",")}%`;
}

/** Multiplicador de capital. NULL en filas sin exitScenario. */
export function fmtMultiplicador(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1).replace(".", ",")}×`;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Fecha corta para la tabla: `26 jul` · `26 jul 25` si es de otro año. */
export function fmtFechaCorta(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const base = `${d.getDate()} ${MESES[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${String(d.getFullYear()).slice(2)}`;
}

/**
 * Fecha relativa para las cards de CONTINUAR. Se calcula sobre días de
 * calendario, no sobre milisegundos: algo de anoche a las 23:00 es "ayer",
 * no "hace 10 horas".
 */
export function fmtFechaRelativa(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dias = Math.round((b.getTime() - a.getTime()) / 86_400_000);

  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;
  if (dias < 14) return "hace una semana";
  if (dias < 31) return `hace ${Math.floor(dias / 7)} semanas`;
  if (dias < 61) return "hace un mes";
  if (dias < 365) return `hace ${Math.floor(dias / 30)} meses`;
  if (dias < 730) return "hace un año";
  return `hace ${Math.floor(dias / 365)} años`;
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

/** ¿La fila tiene dirección real o estamos mostrando el nombre autogenerado? */
export function sinDireccion(row: Pick<AnalisisDashboardRow, "direccion">): boolean {
  return !row.direccion || !row.direccion.trim();
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

/** Endpoint de PDF según modalidad (ambos ya existen). */
export function hrefPdf(row: AnalisisDashboardRow): string {
  return row.tipo_analisis === "short-term"
    ? `/api/analisis/renta-corta/${row.id}/pdf`
    : `/api/analisis/${row.id}/pdf`;
}

/**
 * Primera frase de un texto. NO se puede cortar en el primer punto: en formato
 * chileno el separador de miles ES un punto, así que «El arriendo genera
 * $1.234.567 al mes.» se cortaba en «El arriendo genera $1.» (bug heredado del
 * dashboard viejo, visible en producción). Un punto solo cierra frase si viene
 * seguido de espacio o del final del texto.
 */
export function primeraFrase(texto: string | null | undefined): string | null {
  const t = (texto ?? "").trim();
  if (!t) return null;
  const m = t.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return (m ? m[0] : t).trim();
}

export const DEMO_ID = "6db7a9ac-f030-4ccf-b5a8-5232ae997fb1";

/** Etiqueta corta de modalidad para el chip de la tabla. */
export function modalidadLabel(row: AnalisisDashboardRow): "LARGA" | "CORTA" | "AMBAS" {
  if (row.ambas_group_id) return "AMBAS";
  return row.tipo_analisis === "short-term" ? "CORTA" : "LARGA";
}
