// ─────────────────────────────────────────────────────────────────────────────
// Qué avisos se evalúan y cuáles tocan en esta corrida (30-sep-2026). Puro: lo usan el cron semanal y el
// censo, y lo prueba el tier AVISOS.
//   · Evaluable: completo (precio, m², dormitorios, baños, coordenadas), plausible (UF 700–60.000 y
//     UF 20–300 por m²) y sin duplicado exacto (misma comuna, m², dormitorios, baños, precio y punto).
//   · Pendiente: evaluable y visto en los últimos 3 días, que no tiene evaluación, o cuyo precio cambió,
//     o cuya evaluación tiene más de 7 días o es de otra versión del motor. Primero los nunca evaluados.
// ─────────────────────────────────────────────────────────────────────────────
import type { AvisoParaEvaluar } from "./evaluar-aviso";

export const VENTANA_VISTOS_DIAS = 3;
export const REEVALUAR_DIAS = 7;

export interface FilaAviso {
  id: string;
  comuna: string | null;
  lat: number | string | null;
  lng: number | string | null;
  precio: number | string | null;
  moneda: string | null;
  superficie_m2: number | string | null;
  dormitorios: number | null;
  banos: number | null;
  condicion: string | null;
  direccion: string | null;
  fecha_entrega?: string | null;
  scraped_at: string;
}

export function avisosEvaluables(filas: FilaAviso[], uf: number): Array<AvisoParaEvaluar & { scrapedAt: string }> {
  const vistos = new Set<string>();
  const out: Array<AvisoParaEvaluar & { scrapedAt: string }> = [];
  for (const a of filas) {
    const precio = Number(a.precio), m2 = Number(a.superficie_m2);
    if (!(precio > 0 && m2 >= 15 && m2 <= 400 && a.dormitorios != null && a.banos != null && a.lat != null && a.lng != null && a.comuna)) continue;
    const precioUF = a.moneda === "UF" ? precio : precio / uf;
    const ufm2 = precioUF / m2;
    if (!(precioUF >= 700 && precioUF <= 60000 && ufm2 >= 20 && ufm2 <= 300)) continue;
    const clave = [a.comuna, Math.round(m2), a.dormitorios, a.banos, Math.round(precioUF), Number(a.lat).toFixed(3), Number(a.lng).toFixed(3)].join("|");
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push({
      id: a.id, comuna: a.comuna, lat: Number(a.lat), lng: Number(a.lng), precioUF, m2,
      dormitorios: Number(a.dormitorios), banos: Number(a.banos),
      condicion: a.condicion === "nuevo" ? "nuevo" : "usado",
      direccion: a.direccion ?? null, fechaEntrega: a.fecha_entrega ?? null, antiguedadAnios: null,
      scrapedAt: a.scraped_at,
    });
  }
  return out;
}

export interface EvaluacionGuardada {
  aviso_id: string;
  precio_uf: number | string;
  evaluado_at: string;
  motor_version: string;
}

export function avisosPendientes<T extends AvisoParaEvaluar & { scrapedAt: string }>(
  evaluables: T[],
  guardadas: EvaluacionGuardada[],
  motorVersion: string,
  ahora: Date = new Date(),
): T[] {
  const desde = ahora.getTime() - VENTANA_VISTOS_DIAS * 864e5;
  const vieja = ahora.getTime() - REEVALUAR_DIAS * 864e5;
  const porId = new Map(guardadas.map((g) => [g.aviso_id, g]));
  const nunca: T[] = [];
  const otra: T[] = [];
  for (const a of evaluables) {
    if (new Date(a.scrapedAt).getTime() < desde) continue;
    const g = porId.get(a.id);
    if (!g) { nunca.push(a); continue; }
    const cambioPrecio = Math.abs(Number(g.precio_uf) - a.precioUF) > 0.5;
    if (cambioPrecio || new Date(g.evaluado_at).getTime() < vieja || g.motor_version !== motorVersion) otra.push(a);
  }
  return [...nunca, ...otra];
}
