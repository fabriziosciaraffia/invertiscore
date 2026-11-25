// ─────────────────────────────────────────────────────────────────────────────
// EL LUGAR DE UN DEPTO EN LA TARJETA DEL MAPA (25-nov-2026, lámina 7 del canvas «La asesoría en el mapa», decisión 7 de Fabrizio).
// Debajo de la comuna va, en este orden:
//   · el METRO si hay una estación activa a menos de 1 km («Metro Parque Almagro»; las de las líneas futuras no cuentan);
//   · si no, el BARRIO O SECTOR de OpenStreetMap («Sector Lo Hermida»): el barrio (neighbourhood/quarter) más cercano a menos de
//     700 m o, si no hay, el sector (suburb) a menos de 1,5 km;
//   · si tampoco, la AVENIDA PRINCIPAL más cercana («Cerca de Avenida Grecia»): una troncal o primaria a menos de 800 m o, si no,
//     una secundaria a menos de 500 m.
//   · sin nada de eso, la línea sigue sin lugar (tipología y m²).
// El barrio y la avenida se calculan UNA VEZ por aviso y quedan en `aviso_lugar` (lugar-servidor.ts); el metro sale de la lista de
// estaciones del repo cada vez (no cambia por aviso). Puro: sin base ni red. Los datos de OpenStreetMap llegan por parámetro (el
// archivo pesa 723 kB y solo lo carga el servidor).
// ─────────────────────────────────────────────────────────────────────────────
import { METRO_STATIONS } from "@/lib/metro-stations";

export const METRO_MAX_M = 1000;
export const BARRIO_MAX_M = 700;
export const SECTOR_MAX_M = 1500;
export const AVENIDA_PRINCIPAL_MAX_M = 800;
export const AVENIDA_SECUNDARIA_MAX_M = 500;
/** El crédito que exige la licencia de OpenStreetMap (ODbL): visible en el mapa. */
export const CREDITO_OSM = "© OpenStreetMap";

/** Los datos compactos de OpenStreetMap (src/data/lugares-osm.json): barrios [nombre, 0 barrio | 1 sector, lat, lng] y avenidas
 *  [nombre, 0 troncal o primaria | 1 secundaria, tramos], cada tramo un arreglo plano lat,lng,lat,lng… */
export interface LugaresOsm {
  fuente: string;
  barrios: Array<[string, 0 | 1, number, number]>;
  avenidas: Array<[string, 0 | 1, number[][]]>;
}

/** Lo guardado por aviso (una fila de `aviso_lugar`). */
export interface LugarGuardado { barrio: string | null; avenida: string | null }

// Metros por grado en Santiago (latitud −33,45): lo bastante exacto para distancias de menos de 2 km.
const KY = 110950;
const KX = 92700;
const dist = (aLat: number, aLng: number, bLat: number, bLng: number) => Math.hypot((aLat - bLat) * KY, (aLng - bLng) * KX);

function distSegmento(lat: number, lng: number, aLat: number, aLng: number, bLat: number, bLng: number): number {
  const px = lng * KX, py = lat * KY, ax = aLng * KX, ay = aLat * KY, bx = bLng * KX, by = bLat * KY;
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** La estación activa más cercana a menos de 1 km, con su distancia; null si no hay. */
export function metroCercano(lat: number, lng: number, max = METRO_MAX_M): { nombre: string; m: number } | null {
  let mejor: { nombre: string; m: number } | null = null;
  for (const s of METRO_STATIONS) {
    if (s.status !== "active") continue;
    const m = dist(lat, lng, s.lat, s.lng);
    if (m < max && (!mejor || m < mejor.m)) mejor = { nombre: s.name, m: Math.round(m) };
  }
  return mejor;
}

/** El barrio o sector y la avenida principal de un punto, con los datos de OpenStreetMap: lo que se guarda en `aviso_lugar`. */
export function lugarDePunto(lat: number, lng: number, osm: LugaresOsm): LugarGuardado {
  let barrio: { n: string; m: number } | null = null, sector: { n: string; m: number } | null = null;
  for (const [n, tipo, bLat, bLng] of osm.barrios) {
    const m = dist(lat, lng, bLat, bLng);
    if (tipo === 0 && m < BARRIO_MAX_M && (!barrio || m < barrio.m)) barrio = { n, m };
    if (tipo === 1 && m < SECTOR_MAX_M && (!sector || m < sector.m)) sector = { n, m };
  }
  let principal: { n: string; m: number } | null = null, secundaria: { n: string; m: number } | null = null;
  for (const [n, nivel, tramos] of osm.avenidas) {
    const tope = nivel === 0 ? AVENIDA_PRINCIPAL_MAX_M : AVENIDA_SECUNDARIA_MAX_M;
    for (const t of tramos) {
      // Un descarte rápido: si el primer punto del tramo está a más de 6 km, ningún segmento queda cerca (los tramos son cortos).
      if (dist(lat, lng, t[0], t[1]) > 6000) continue;
      for (let i = 0; i + 3 < t.length; i += 2) {
        const m = distSegmento(lat, lng, t[i], t[i + 1], t[i + 2], t[i + 3]);
        if (m >= tope) continue;
        if (nivel === 0 && (!principal || m < principal.m)) principal = { n, m };
        if (nivel === 1 && (!secundaria || m < secundaria.m)) secundaria = { n, m };
      }
    }
  }
  return { barrio: (barrio ?? sector)?.n ?? null, avenida: (principal ?? secundaria)?.n ?? null };
}

/** Palabras con que un nombre de OpenStreetMap ya dice qué es: no se les antepone «Sector». */
const YA_DICE = /^(barrio|villa|población|poblacion|sector|condominio|parque|conjunto|ciudad|lomas|jardín|jardin)\b/i;

/** Lo que dice la tarjeta debajo de la comuna: el metro, el barrio o sector, o la avenida; null sin nada. */
export function textoLugar(metro: { nombre: string } | null, guardado: LugarGuardado | null): string | null {
  if (metro) return `Metro ${metro.nombre}`;
  if (guardado?.barrio) return YA_DICE.test(guardado.barrio) ? guardado.barrio : `Sector ${guardado.barrio}`;
  if (guardado?.avenida) return `Cerca de ${guardado.avenida}`;
  return null;
}
