// ─────────────────────────────────────────────────────────────────────────────
// LOS DETALLES DE UN DEPTO, ABIERTOS DESDE INVIERTE (láminas del 19-nov-2026, 3.x-detalles-desde-invierte). Puro: lo usan el
// servidor, la pantalla y el tier.
//   · La página es el informe de siempre (/analisis/[id]): no hay una ficha aparte. «Ver detalles» y «Abrir» del flujo agregan
//     `?desde=invierte` (DESDE_INVIERTE); el servidor activa el modo solo si además la persona es dueña del informe y firmó la
//     orden, y decide QUÉ es ese depto para ella por su base, nunca por el enlace. Desde el mapa o el dashboard se ve como hoy.
//   · Arriba, una barra fija con «← Mi inversión» y un chip: «Uno de tus deptos» o «Te lo recomendamos». Abajo, en vez de la
//     franja «Invierte con Franco», la acción que corresponde: si es suyo, su estado y «Escribirle a Franco»; si es una
//     recomendación, por qué y el botón rojo «Seguir con este», que lo suma sin firmar de nuevo.
//   · El indicador contra el suyo (`indicadorContraElegido`) es el mismo del resultado (entrega 2): una sola regla.
// ─────────────────────────────────────────────────────────────────────────────
import type { Objetivo, Preocupacion } from "./perfil";
import { fmtCLP, fmtUF } from "./opciones";

/** El parámetro que ponen «Ver detalles» y «Abrir» del flujo. Solo dice de dónde se abrió: el resto lo decide el servidor. */
export const DESDE_INVIERTE = "invierte";

export const DETALLES_COPY = {
  miInversion: "Mi inversión",
  chipSuyo: "Uno de tus deptos",
  chipRecomendado: "Te lo recomendamos",
  estadoSuyo: "Ya sigues con este depto. Franco lo está gestionando.",
  escribirle: "Escribirle a Franco",
  seguir: "Seguir con este",
  recomienda: (por: string) => `Franco te lo recomienda: ${por}.`,
} as const;

/** Lo que va arriba del informe en modo Invierte (entrega 3): el depto en una línea, su veredicto y cuántas fotos tiene. */
export interface CabezaDetalles { avisoId: string; nombre: string; veredicto: string | null; score: number | null; fotos: number }

export type ModoDetalles = { cabeza: CabezaDetalles } & (
  | { relacion: "suyo"; whatsapp: string | null }
  | { relacion: "recomendado"; avisoId: string; linea: string; activos: { avisoId: string; datos: Record<string, unknown> }[] });

/** «Ñuñoa · 2D2B · 58 m²», como la lámina. */
export function nombreDeDatos(d: { comuna?: string | null; dormitorios?: number | null; banos?: number | null; m2?: number | null }): string {
  return [d.comuna ?? null, d.dormitorios != null ? `${d.dormitorios}D${d.banos ?? 1}B` : null, d.m2 ? `${Math.round(d.m2)} m²` : null].filter(Boolean).join(" · ");
}

/** ¿El modo Invierte? Solo con `?desde=invierte`, dueño del informe y orden firmada (el resto lo decide el servidor). */
export function abiertoDesdeInvierte(p: { desde: unknown; esDueno: boolean; firmo: boolean }): boolean {
  return p.desde === DESDE_INVIERTE && p.esDueno && p.firmo;
}

/** Distancia en metros entre dos puntos (haversine). */
export function metrosEntre(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const r = (g: number) => (g * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * A qué distancia está del suyo. Cerca, en cuadras (una cuadra ≈ 100 m): «a 4 cuadras del tuyo». Lejos (desde 1,5 km, o siempre
 * en «Donde más convenga», decisión de Fabrizio del 19-nov-2026), la comuna y los kilómetros: «en La Florida, a 12 km del tuyo».
 */
export function distanciaDelTuyo(metros: number, comuna: string | null, enKm = false): string {
  if (!enKm && metros < 1500) {
    const cuadras = Math.max(1, Math.round(metros / 100));
    return cuadras === 1 ? "a 1 cuadra del tuyo" : `a ${cuadras} cuadras del tuyo`;
  }
  const km = metros / 1000;
  const txt = km < 10 ? km.toLocaleString("es-CL", { maximumFractionDigits: 1 }) : String(Math.round(km));
  return comuna ? `en ${comuna}, a ${txt} km del tuyo` : `a ${txt} km del tuyo`;
}

/** Diferencias bajo esto no se dicen: no hacen diferencia. */
export const UMBRAL_MES_CLP = 5_000;
export const UMBRAL_PRECIO_UF = 50;

/**
 * EL INDICADOR ÚNICO contra el suyo (LEEME del 19-nov-2026): por reglas, solo lo que favorece a la alternativa, y de eso, lo que
 * más pesa según lo que la persona dijo que busca. «Lo que deja o pide al mes» manda si busca arriendo o le preocupa poner plata
 * cada mes o que no se arriende; el precio, si busca plusvalía; con «las dos», el que haya, el mes primero. El pie es el 20 % del
 * precio: dice lo mismo que el precio contra el suyo (el «pie más bajo» del grupo es del resultado, entrega 2).
 * Devuelve la frase en minúscula, sin «que el tuyo» (el resultado la completa): «te pide $40.000 menos al mes».
 */
export function indicadorContraElegido(
  alt: { precioUF: number | null; flujoCLP: number | null },
  ele: { precioUF: number | null; flujoCLP: number | null },
  perfil: { objetivo: Objetivo | null; preocupaciones: readonly Preocupacion[] },
): { tipo: "mes" | "precio"; frase: string } | null {
  let mes: { tipo: "mes"; frase: string } | null = null;
  if (alt.flujoCLP != null && ele.flujoCLP != null && alt.flujoCLP - ele.flujoCLP >= UMBRAL_MES_CLP) {
    const d = Math.round((alt.flujoCLP - ele.flujoCLP) / 1000) * 1000;
    if (alt.flujoCLP < 0) mes = { tipo: "mes", frase: `te pide ${fmtCLP(d)} menos al mes` };
    else if (ele.flujoCLP < 0) mes = { tipo: "mes", frase: `te deja ${fmtCLP(Math.round(alt.flujoCLP / 1000) * 1000)} al mes` };
    else mes = { tipo: "mes", frase: `te deja ${fmtCLP(d)} más al mes` };
  }
  let precio: { tipo: "precio"; frase: string } | null = null;
  if (alt.precioUF != null && ele.precioUF != null && ele.precioUF - alt.precioUF >= UMBRAL_PRECIO_UF) {
    precio = { tipo: "precio", frase: `cuesta UF ${fmtUF(ele.precioUF - alt.precioUF)} menos` };
  }
  const porMes = perfil.objetivo === "arriendo" || perfil.preocupaciones.includes("poner_plata") || perfil.preocupaciones.includes("no_arriende");
  if (perfil.objetivo === "plusvalia" && !porMes) return precio ?? mes;
  return mes ?? precio;
}

/** La línea de la acción de una recomendación: «Franco te lo recomienda: a 4 cuadras del tuyo y te pide $40.000 menos al mes.» */
export function lineaRecomendado(distancia: string, indicador: string | null): string {
  return DETALLES_COPY.recomienda(indicador ? `${distancia} y ${indicador}` : distancia);
}
