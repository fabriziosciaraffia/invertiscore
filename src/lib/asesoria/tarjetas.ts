// ─────────────────────────────────────────────────────────────────────────────
// LAS TARJETAS DE «TUS DEPTOS» (decisiones de Fabrizio, 27-nov-2026). Los 3 se eligen como antes (tres.ts: el que mejor rinde, el que
// deja más al mes y uno distinto), pero se MUESTRAN ordenados por lo que dejan al mes y sin aquellas etiquetas («El que pide menos al
// mes» llegaba a dejar menos que «El que mejor rinde»). Solo dos etiquetas posibles, y solo cuando son verdad y tienen dato:
//   · «El más barato»: estrictamente el de menor precio entre los que se muestran (con un solo depto, no hay comparación);
//   · «A X m del metro»: la estación más cercana a 1 km o menos (la misma de la tarjeta del mapa: explorar/lugar.ts).
// Cada tarjeta lleva su prueba de tasa (capacidad.ts › pruebaTasa): «Aguanta si la tasa sube 1 punto» o «Con un punto más de tasa,
// pones $X al mes». Puro. Tier ASESORIA.
// ─────────────────────────────────────────────────────────────────────────────
import { metroCercano } from "@/lib/explorar/lugar";
import { pruebaTasa } from "./capacidad";

export interface DeptoElegido { id: string; comuna: string; dormitorios: number; precioUF: number; flujo: number | null; cap: number | null; lat: number; lng: number }
export interface TarjetaDepto extends DeptoElegido {
  masBarato: boolean;
  metro: { nombre: string; m: number } | null;
  tasa: { aguanta: boolean; poneCLP: number } | null;
}

export function tarjetasDelPerfil(ds: readonly DeptoElegido[], cfg: { plazo: number; tasaPct: number; uf: number }): TarjetaDepto[] {
  const precios = ds.map((d) => d.precioUF);
  const min = Math.min(...precios);
  const unico = ds.length >= 2 && precios.filter((x) => x === min).length === 1;
  return [...ds]
    .sort((a, b) => (b.flujo ?? -Infinity) - (a.flujo ?? -Infinity) || (a.id < b.id ? -1 : 1))
    .map((d) => {
      const m = metroCercano(d.lat, d.lng);
      return {
        ...d,
        masBarato: unico && d.precioUF === min,
        metro: m ? { nombre: m.nombre, m: m.m } : null,
        tasa: d.flujo == null ? null : pruebaTasa({ precioUF: d.precioUF, flujoCLP: d.flujo, plazo: cfg.plazo, tasaPct: cfg.tasaPct, uf: cfg.uf }),
      };
    });
}
