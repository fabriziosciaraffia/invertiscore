// Los candidatos del semanal como los devuelven las RPC (`semanal_candidatos`, `inmediato_candidatos` y, desde el
// 14-oct-2026, `semanal_candidatos_str`), y su forma de candidato de la guía. Vivían en semanal-servidor.ts; se
// separaron para que el lado de renta corta (semanal-str-servidor.ts) los use sin importar en círculo.
import type { CandidatoGuia } from "./guia-servidor";
import type { CandidatoSemanal } from "./semanal";

export type Candidato = CandidatoGuia & CandidatoSemanal;

export type FilaRpc = {
  id: string; comuna: string; lat: number; lng: number; superficie_m2: number; dormitorios: number; banos: number | null;
  condicion: string; direccion: string | null; fecha_entrega: string | null; url: string | null; precio_uf: number;
  antiguedad_anios: number | null; antiguedad_origen: string | null; arriendo: CandidatoGuia["arriendo"]; venta: CandidatoGuia["venta"];
  gastos_comunes: number | null; mediana_comuna: unknown | null; score_cron: number | null;
};

/** «Santiago Centro» (el nombre del dataset viejo) es «Santiago» en los avisos. */
export const comunaDeAviso = (c: string) => (c === "Santiago Centro" ? "Santiago" : c);

export function candidatoDeFila(f: FilaRpc): Candidato {
  return {
    avisoId: f.id, distanciaM: 0, scoreCron: f.score_cron, comuna: f.comuna, lat: Number(f.lat), lng: Number(f.lng),
    m2: Number(f.superficie_m2), dormitorios: Number(f.dormitorios), banos: Number(f.banos) || 1,
    condicion: f.condicion === "nuevo" ? "nuevo" : "usado", direccion: f.direccion, fechaEntrega: f.fecha_entrega, url: f.url,
    precioUF: Number(f.precio_uf), antiguedadAnios: f.antiguedad_origen === "ficha" ? f.antiguedad_anios : null,
    antiguedadOrigen: f.antiguedad_origen, arriendo: f.arriendo, venta: f.venta, gastosComunes: f.gastos_comunes, medianaComuna: f.mediana_comuna ?? null,
  };
}
