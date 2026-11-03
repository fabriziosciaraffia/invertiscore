// ─────────────────────────────────────────────────────────────────────────────
// LAS CIFRAS DE LA NOCHE EN LA PÁGINA (03-nov-2026): lo que /explorar cuenta en el servidor para el primer pintado —el número
// de los filtros, el de todo el sitio para la bienvenida, los − Ajustar de la vista global y los de la barra—, todo de UNA
// noche (portal-cache.ts › nocheExplorar: un sello, una edad). Con la misma noche, el navegador cuenta lo mismo con los pines
// que le trae la API (filtrar y negociadosVisibles, las mismas funciones): lo fija el tier EXPLORAR-PASADA §9.
// Pura: sin base ni Next, para que el tier la corra.
// ─────────────────────────────────────────────────────────────────────────────
import { cuantosConvienen, descompactar, filtrar, FILTROS_GLOBALES, universoDeLaNoche, type FiltrosPortal, type UniversoCompacto } from "./portal";
import { capaVisible, descompactarNegociados, negociadosVisibles, type NegociadosCompactos } from "./capa-negociar";

export interface CifrasNoche {
  /** Cuántos ✓ Comprar con estos filtros (null: estos filtros no son de la noche, o no se leyó). */
  n: number | null;
  /** Los ✓ Comprar de todo el sitio (la bienvenida). */
  convienen: number | null;
  /** Los − Ajustar de la vista global, aparte (la bienvenida: «y 3.238 más si negocias el precio»). */
  negociadosGlobal: number | null;
  /** Los − Ajustar con estos filtros (la barra); 0 si la capa no se ve con ellos. */
  nAjustar: number | null;
}

export function cifrasDeLaNoche(noche: { universo: UniversoCompacto; negociados: NegociadosCompactos | null } | null, filtros: FiltrosPortal, ahora: Date = new Date()): CifrasNoche {
  const deLaNoche = !!noche && universoDeLaNoche(filtros);
  const pines = noche ? descompactar(noche.universo) : [];
  const ids = new Set(pines.map((p) => p.avisoId));
  const capa = noche?.negociados ? descompactarNegociados(noche.negociados) : null;
  return {
    n: deLaNoche ? filtrar(pines, filtros, ahora).length : null,
    convienen: noche ? cuantosConvienen(noche.universo) : null,
    negociadosGlobal: noche && capa ? negociadosVisibles(capa, FILTROS_GLOBALES, ids, ahora).length : null,
    nAjustar: !capaVisible(filtros) ? 0 : deLaNoche && capa ? negociadosVisibles(capa, filtros, ids, ahora).length : null,
  };
}
