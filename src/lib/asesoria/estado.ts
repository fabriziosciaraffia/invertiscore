// ─────────────────────────────────────────────────────────────────────────────
// EL ESTADO DE LA ASESORÍA (27-nov-2026): vive en sessionStorage —las respuestas no salen del navegador sin cuenta— y se adopta al
// crear la cuenta (POST /api/asesoria/perfil). Al adoptarlo: COPIAR PRIMERO, BORRAR DESPUÉS (regla del repo): el estado se queda
// hasta que el servidor confirma el perfil, y entonces pasa a «perfil» con lo que devolvió.
// ─────────────────────────────────────────────────────────────────────────────
import type { Aporte } from "./aporte";
import type { Experiencia, Numeros, ObjetivoAsesoria } from "./capacidad";

export const CLAVE_ESTADO = "franco_asesoria";
export const VERSION_ESTADO = 1;

/** Los pasos, en el orden del recorrido (P0 a P7 de las láminas; P4, usado o proyecto, va escondido tras PROYECTOS_VISIBLE). */
export const PASOS = ["gancho", "objetivo", "numeros", "formula", "proyecto", "aporte", "donde", "lupa", "cierre", "perfil"] as const;
export type Paso = (typeof PASOS)[number];

/** P4 (usado o proyecto) está construido pero escondido: hoy la asesoría es solo de usados. */
export const PROYECTOS_VISIBLE = false;

/** La barra: «Qué buscas» (experiencia y objetivo) · «Hasta dónde llegas» (números y aporte) · «Dónde» (dónde y lupa). Cada
 *  segmento con su avance 0, 0,5 o 1. */
export function avanceBarra(paso: Paso): [number, number, number] {
  switch (paso) {
    case "gancho": return [0, 0, 0];
    case "objetivo": return [0.5, 0, 0];
    case "numeros": case "formula": return [1, 0.5, 0];
    case "proyecto": case "aporte": return [1, 0.5, 0];
    case "donde": return [1, 1, 0.5];
    case "lupa": return [1, 1, 0.5];
    default: return [1, 1, 1];
  }
}

// «Cerca de mi pega» se retiró el 27-nov-2026 (C6, decisión de Fabrizio): el chip, el radio de 3 km y el toque en el mapa.
export type ModoDonde = "comunas" | "metro" | "rinde";
export interface Donde { modo: ModoDonde; comunas: string[] }
export type Lupa = "si" | "no" | "prefiero";

export interface EstadoAsesoria {
  v: typeof VERSION_ESTADO;
  paso: Paso;
  /** La burbuja cerrada: queda chica con «Retomar». */
  cerrada: boolean;
  experiencia: Experiencia | null;
  objetivo: ObjetivoAsesoria | null;
  numeros: Partial<Numeros>;
  aporte: Aporte | null;
  donde: Donde | null;
  lupa: Lupa | null;
  /** «Avísame» de los deptos nuevos (27-nov-2026): una salida, no una pregunta; true si lo tocó. */
  interesNuevos?: boolean | null;
  /** Cerrada la hoja, la persona quitó el filtro de su perfil desde el botón Filtros (F22): el mapa vuelve entero hasta «Retomar». */
  sinFiltro?: boolean | null;
}

export const ESTADO_INICIAL: EstadoAsesoria = {
  v: VERSION_ESTADO, paso: "gancho", cerrada: false, experiencia: null, objetivo: null, numeros: {}, aporte: null, donde: null, lupa: null, interesNuevos: null,
};

type Almacen = Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;

export function leerEstado(a: Almacen): EstadoAsesoria | null {
  try {
    const s = a?.getItem(CLAVE_ESTADO);
    if (!s) return null;
    const e = JSON.parse(s) as Partial<EstadoAsesoria>;
    if (e.v !== VERSION_ESTADO || !e.paso || !(PASOS as readonly string[]).includes(e.paso)) return null;
    // Un estado guardado con «Cerca de mi pega» (retirado): vuelve a preguntar dónde.
    const donde = e.donde && (["comunas", "metro", "rinde"] as string[]).includes(e.donde.modo) ? { modo: e.donde.modo, comunas: e.donde.comunas ?? [] } : null;
    return { ...ESTADO_INICIAL, ...e, donde } as EstadoAsesoria;
  } catch {
    return null;
  }
}

export function guardarEstado(a: Almacen, e: EstadoAsesoria): void {
  try { a?.setItem(CLAVE_ESTADO, JSON.stringify(e)); } catch { /* sin almacenamiento, el recorrido sigue en memoria */ }
}

/** Lo que viaja al crear el perfil (con cuenta): las respuestas, nunca el estado de la pantalla. */
export function pedidoPerfil(e: EstadoAsesoria): Record<string, unknown> {
  return { experiencia: e.experiencia, objetivo: e.objetivo, numeros: e.numeros, aporte: e.aporte, donde: e.donde, lupa: e.lupa, interesNuevos: e.interesNuevos === true };
}

/** ¿Está todo para crear el perfil? */
export const listoParaPerfil = (e: EstadoAsesoria): boolean =>
  !!e.experiencia && !!e.objetivo && e.aporte != null && !!e.donde && !!e.lupa && Object.keys(e.numeros).length === 6;

/** CUÁNDO APARECE LA BURBUJA (plan del 27-nov-2026, «cuando ya miró deptos»): después de abrir 2 tarjetas, o a los 20 segundos con al
 *  menos 2 movimientos del mapa, lo que pase primero. Nunca al cargar. */
export const MIRO_TARJETAS = 2;
export const MIRO_MOVIMIENTOS = 2;
export const MIRO_MS = 20_000;
