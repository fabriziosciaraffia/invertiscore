// ─────────────────────────────────────────────────────────────────────────────
// La puerta a Explorar: los filtros del perfil en la URL de /explorar y a dónde aterriza el clic del correo (02-nov-2026; las
// reglas de la línea, en puerta-correos.ts, que no carga portal.ts porque «Estás dentro» la usa en el navegador). Solo el
// servidor usa este módulo: los envíos, la ruta del clic, el dashboard, /api/deptos/primeros y el catálogo.
// ─────────────────────────────────────────────────────────────────────────────
import { filtrosDeMiBusqueda, portalDeUrl, urlDePortal, type ModalidadPortal } from "./portal";
import { DESDE_CORREO } from "./puertas-landing";

/** Lo que el enlace necesita del perfil. Viene de la fila de la selección (un jsonb): todo puede faltar. */
export interface PerfilParaExplorar {
  comunas?: readonly string[] | null;
  dormitorios?: readonly number[] | null;
  precioMinUf?: number | null;
  precioMaxUf?: number | null;
  piePct?: number | null;
  plazoAnios?: number | null;
  tasaPct?: number | null;
  modalidad?: string | null;
}

/**
 * LOS FILTROS DEL PERFIL EN LA URL DE /explorar: los de «Mi búsqueda» (portal.ts › filtrosDeMiBusqueda) en la forma de la URL
 * (urlDePortal). Con la combinación con que se armó la selección, el pie, el plazo y la tasa son esos (los del correo); con
 * la modalidad del bloque, esa. Sin perfil con qué buscar, cadena vacía: la vista global.
 */
export function consultaExplorar(perfil: PerfilParaExplorar | null | undefined, o: { combo?: { piePct: number; plazoAnios: number; tasaPct?: number | null } | null; modalidad?: ModalidadPortal } = {}): string {
  if (!perfil) return "";
  const c = o.combo ?? null;
  const f = filtrosDeMiBusqueda({
    comunas: Array.isArray(perfil.comunas) ? [...perfil.comunas] : [],
    dormitorios: Array.isArray(perfil.dormitorios) ? [...perfil.dormitorios] : [],
    precioMinUf: perfil.precioMinUf ?? null,
    precioMaxUf: perfil.precioMaxUf ?? null,
    piePct: c?.piePct ?? perfil.piePct ?? null,
    plazoAnios: c?.plazoAnios ?? perfil.plazoAnios ?? null,
    tasaPct: c ? c.tasaPct ?? null : perfil.tasaPct ?? null,
    modalidad: o.modalidad ?? (perfil.modalidad === "str" ? "str" : "ltr"),
  });
  return f ? urlDePortal(f) : "";
}

/** A dónde aterriza el clic del correo: /explorar con los filtros que trae el enlace VALIDADOS DE NUEVO (nunca se reenvía lo
 *  que llega tal cual) y la llegada «correo». */
export function rutaExplorarDesdeCorreo(q: string | null | undefined): string {
  const { filtros, orden } = portalDeUrl(new URLSearchParams(q ?? ""));
  const consulta = urlDePortal(filtros, orden);
  return `/explorar?${consulta ? `${consulta}&` : ""}desde=${DESDE_CORREO}`;
}
