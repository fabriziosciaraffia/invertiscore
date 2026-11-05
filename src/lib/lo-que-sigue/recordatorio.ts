// ─────────────────────────────────────────────────────────────────────────────
// El recordatorio del pack (30-sep-2026): «Te quedan 3 análisis, con tus números ya cargados.», a
// quien pagó el pack hace tres días o más y no usó ninguno de los tres. En la plantilla clara, con el
// botón al wizard precargado. SALE UNA SOLA VEZ: el cron reclama la fila antes de enviar
// (`payments.recordatorio_pack_enviado_at` de NULL a fecha, con la condición en el WHERE) y solo
// manda si el reclamo tuvo efecto; una segunda corrida no encuentra la fila.
// Funciones puras: las prueba el tier sin red.
// ─────────────────────────────────────────────────────────────────────────────
import { escaparHtml, plantillaClara } from "@/lib/email/plantilla-clara";
import { CORREO_RECORDATORIO, CORREO_RECORDATORIO_SIN_INFORME } from "./copy";
import { PACK_ANALISIS, rutaPrecarga } from "./oferta-pack";

export const DIAS_RECORDATORIO = 3;
const DIA_MS = 24 * 60 * 60 * 1000;

export interface PagoPackRecordatorio {
  status: string;
  product: string;
  /** Cuándo quedó pagado (payments.updated_at al confirmar). */
  pagadoEl: string;
  recordatorioEnviadoEl: string | null;
  /** Lo que le queda al lote del pack (credit_grants.remaining por payment_id). */
  restantes: number | null;
}

/** ¿Le toca el recordatorio? Pagado, del pack, hace tres días o más, sin usar ninguno y sin correo previo. */
export function debeRecordar(p: PagoPackRecordatorio, ahora: Date = new Date()): boolean {
  if (p.status !== "paid" || p.product !== "pack3") return false;
  if (p.recordatorioEnviadoEl) return false;
  if (p.restantes !== PACK_ANALISIS) return false;
  const t = new Date(p.pagadoEl).getTime();
  if (!Number.isFinite(t)) return false;
  return ahora.getTime() - t >= DIAS_RECORDATORIO * DIA_MS;
}

/** El correo, en la plantilla clara. `sitio` sin barra final. */
export function correoRecordatorioPack(sitio: string, analysisId: string | null): { subject: string; html: string } {
  // Con informe, directo al wizard precargado (sin sesión, el wizard pide el código y vuelve al mismo lugar). Sin informe
  // (05-nov-2026), al mapa: no hay números que precargar.
  const destino = analysisId ? rutaPrecarga(analysisId) : DESTINO_SIN_INFORME;
  const c = analysisId ? CORREO_RECORDATORIO : CORREO_RECORDATORIO_SIN_INFORME;
  const url = `${sitio}${destino}`;
  return {
    subject: c.asunto,
    html: plantillaClara({
      titulo: c.asunto,
      preencabezado: c.cuerpo,
      titular: escaparHtml(c.asunto),
      parrafos: [escaparHtml(c.cuerpo)],
      boton: { texto: c.boton, url },
      despues: [escaparHtml(c.pie)],
    }),
  };
}

/** Adónde lleva el recordatorio de un pack sin informe: el mapa de Explorar, que abre con la búsqueda de la cuenta. */
export const DESTINO_SIN_INFORME = "/explorar";
