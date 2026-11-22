// ─────────────────────────────────────────────────────────────────────────────
// EL DOCUMENTO «OFERTA DE COMPRA» (etapa 3, B3, 22-nov-2026). TEXTO DE PRUEBA, marcado BORRADOR en el propio documento y en su versión
// (`texto_version`): la redacción la revisa un abogado; no es una redacción legal definitiva. Puro: lo usan la pantalla de firma (para
// «Leer») y el servidor (lo que se firma y su hash). Lo que se firma es exactamente este texto.
// ─────────────────────────────────────────────────────────────────────────────

export const VERSION_TEXTO_OFERTA = "borrador-20261122";
export const MARCA_BORRADOR = "BORRADOR · TEXTO DE PRUEBA · EN REVISIÓN LEGAL";

export interface DatosOferta {
  nombre: string;
  rut: string;
  depto: string;          // «Av. General Bustamante 150 · Metro Santa Isabel · Ñuñoa · 2D1B · 60 m²»
  montoUF: number;
  publicadoUF: number;
  pagas: string;          // «Pie de UF 540 y crédito hipotecario, con preaprobación de …»
  sujetaAVisita: boolean;
  vigenciaDias: number;
}

const uf = (n: number) => `UF ${Math.round(n).toLocaleString("es-CL")}`;

/** El texto completo, en párrafos. */
export function textoOferta(d: DatosOferta): string[] {
  return [
    MARCA_BORRADOR,
    "OFERTA DE COMPRA",
    `Yo, ${d.nombre}, RUT ${d.rut}, ofrezco comprar el departamento ${d.depto}, publicado en ${uf(d.publicadoUF)}, en ${uf(d.montoUF)}.`,
    `Forma de pago: ${d.pagas}.`,
    d.sujetaAVisita
      ? "Condición: esta oferta queda sujeta a la visita del departamento. Si quien vende la acepta, se formaliza recién cuando la confirmo después de la visita, o cuando decido confirmarla sin visitar. Si lo que veo no me convence, puedo retirarla o ajustarla sin costo."
      : "Condición: ya visité el departamento; si quien vende la acepta, la oferta queda formalizada.",
    `Vigencia: ${d.vigenciaDias} días desde que Franco la presenta por escrito a quien vende.`,
    "Franco presenta esta oferta en mi nombre y me informa la respuesta. Ninguna oferta se presenta, acepta o formaliza sin mi decisión.",
    "Firma electrónica simple: la acepto marcando la casilla «Leí la oferta y estoy de acuerdo» y el botón «Firmar mi oferta». Quedan registrados la fecha, la hora y desde dónde firmé.",
    MARCA_BORRADOR,
  ];
}

export const textoPlanoOferta = (d: DatosOferta) => textoOferta(d).join("\n\n");
