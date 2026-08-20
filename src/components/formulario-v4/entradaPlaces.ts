// ─────────────────────────────────────────────────────────────────────────────
// Decisiones puras de la pantalla de entrada (nodo `dir`).
//
// POR QUÉ ESTE ARCHIVO EXISTE
// ───────────────────────────
// El bug del 20-ago-2026 —el Autocomplete de Places atado a un `<input>` ya
// desmontado, que dejaba el camino principal bloqueado en producción— vivía
// dentro de un `useEffect`. El repo no tiene runner de componentes, así que
// mientras la decisión viviera ahí adentro no se podía probar: `tsc` no la ve
// (comparar un ref contra otro compila perfecto) y un test de réplica que se
// edita junto al arreglo no prueba nada.
//
// Así que la decisión sale del hook y se prueba de verdad
// (`scripts/test-entrada-places.ts`). El efecto queda como lo que debe ser: el
// cableado con el DOM, sin criterio propio.
//
// NO lleva "use client": es lógica neutra que importan un componente cliente y
// un script de node. Marcarlo lo volvería un proxy al importarlo desde el server.
// ─────────────────────────────────────────────────────────────────────────────

import { COMUNAS } from "@/lib/comunas";
import { isComunaDisponible } from "@/lib/comunas-disponibles";

/**
 * Qué hacer con el widget de Places según a qué nodo está atado.
 *
 *  · `sin-nodo`  — el input todavía no está en el DOM. No se hace nada.
 *  · `ya-atado`  — atado a ESTE nodo. No re-crear el widget en cada render.
 *  · `atar`      — primera vez.
 *  · `reatar`    — atado a OTRO nodo (el anterior se desmontó): hay que soltar
 *                  los listeners del instance viejo, limpiar su `.pac-container`
 *                  huérfano y volver a atar. Este es el caso que faltaba.
 */
export type AccionEnganche = "sin-nodo" | "ya-atado" | "atar" | "reatar";

export function decidirEnganche(args: {
  /** ¿Existe ya una instancia de Autocomplete creada? */
  tieneInstancia: boolean;
  /** Nodo al que esa instancia quedó atada (null si no hay). */
  nodoAtado: unknown | null;
  /** Nodo que está vivo en el DOM ahora (null si el input no está montado). */
  nodoVivo: unknown | null;
}): AccionEnganche {
  const { tieneInstancia, nodoAtado, nodoVivo } = args;
  if (!nodoVivo) return "sin-nodo";
  if (!tieneInstancia) return "atar";
  return nodoAtado === nodoVivo ? "ya-atado" : "reatar";
}

/** Minúsculas sin acentos. El rango va escapado a propósito: son combining
 *  marks invisibles y la versión literal es imposible de revisar (misma regla
 *  que `comunas-disponibles.ts`). */
export function plano(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export interface ComunaDerivada {
  comuna: string;
  ciudad: string;
  cubierta: boolean;
  /** true si la dirección desmiente al chip que el usuario había tocado. */
  corrigioAlChip: boolean;
}

/**
 * Comuna real de una dirección geocodificada.
 *
 * La dirección MANDA sobre el chip: quien tocó "Providencia" y escribió
 * Irarrázaval 2100 está en Ñuñoa, y el `formattedAddress` del geocodificador lo
 * dice. Es el mismo criterio que ya aplica el camino de Places con los
 * `address_components`; acá se deriva del texto porque `/api/geocode` no
 * devuelve componentes.
 *
 * Sin coincidencia se conserva la elegida: es mejor que inventar una.
 */
export function derivarComuna(formattedAddress: string, comunaElegida: string): ComunaDerivada {
  const fmt = plano(formattedAddress);
  // El match más LARGO gana: "Santiago" aparece dentro de casi toda dirección
  // de la RM ("…, Santiago, Región Metropolitana"), así que un match corto le
  // ganaría a la comuna real por puro orden de la lista.
  const candidatas = COMUNAS.filter((c) => fmt.includes(plano(c.comuna)))
    .sort((a, b) => b.comuna.length - a.comuna.length);
  const elegida = candidatas[0];
  const comuna = elegida?.comuna ?? comunaElegida;
  const ciudad = elegida?.ciudad ?? "Santiago";
  return {
    comuna,
    ciudad,
    cubierta: isComunaDisponible(comuna),
    corrigioAlChip: plano(comuna) !== plano(comunaElegida),
  };
}
