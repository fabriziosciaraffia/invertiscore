// ─────────────────────────────────────────────────────────────────────────────
// EL TITULAR DE LA PORTADA, ESCRITO POR EL MOTOR (25-sep-2026)
//
// Decisión de Fabrizio: la portada deja de mostrar el titular de la IA y lee este, en TODAS las
// filas —viejas y anónimas incluidas—, porque se calcula al render desde la card de hoy.
// Contrato: docs/wireframes/rediseno-informe/titular-motor-vs-ia.html.
//
// EL TITULAR REPRODUCE LA CARD, NADA MÁS. No tiene reglas propias: nombra lo mismo que «La
// recomendación de Franco» (`card-recomendacion.ts`), con las mismas cifras y los mismos nombres
// de banda. Correcciones de la revisión línea por línea de Fabrizio:
//  · la palanca entera: «pie de 30%», «crédito a 30 años», «la tarifa por noche»;
//  · toda cifra con su dificultad, también en Buscar otro («y eso es muy difícil»);
//  · lo chico dicho chico: «un descuento mínimo» bajo el 1%, «aguanta apenas» bajo el 2%;
//  · arriendo y tarifa: «pero eso depende del mercado»;
//  · Comprar graduado por el margen de la card, con los cortes de la banda de margen del motor
//    (bajo 7%, «con cautela»; de 7 a 15%, «con margen acotado»; desde 15%, «el veredicto es
//    fuerte»);
//  · Buscar otro lleva la DISTANCIA de la card, no la causa («llegar a Comprar pediría…»), y
//    sobre el tope explorado, «ni con 70% menos de precio llega a Comprar».
//
// Formato del contrato (`validarTitular`): hasta 15 palabras, un solo plumón (`**…**`), sin
// montos en moneda. Medido sobre el parque el 25-sep: 0 fuera de 15 palabras, 0 contra su
// veredicto, 0 citando algo que la card no dice. Lo fija el tier TITULAR-MOTOR.
// ─────────────────────────────────────────────────────────────────────────────
import type { Veredicto } from "./types";
import type { CardRecomendacion } from "./card-recomendacion";
import { bandaDeDescuento, ETIQUETA_BANDA, BANDA_TOPE_ARGUMENTOS_PCT } from "./banda-esfuerzo";
import { SENS_CORTE_ADVERSO, SENS_CORTE_FAVORABLE } from "./sensibilidad-hallazgo";
import { pctCard } from "./lo-que-haria-yo";

/** La rama de la card de la que salió el titular (para la medición y el gate). */
export type RamaTitular =
  | "comprar_sin_margen" | "comprar_sin_colchon" | "comprar_cautela" | "comprar_acotado" | "comprar_fuerte"
  | "ajustar_mix_sin_descuento" | "ajustar_mix_minimo" | "ajustar_mix_descuento" | "ajustar_precio_minimo" | "ajustar_precio"
  | "ajustar_mercado" | "ajustar_sin_salida" | "ajustar_sin_card"
  | "buscar_distancia" | "buscar_distancia_mercado" | "buscar_fuera_de_tope" | "buscar_sin_distancia";

export type TitularMotor = { titular: string; rama: RamaTitular };

const num = (s: string | null | undefined): number => {
  const m = String(s ?? "").match(/[\d.]*\d(?:,\d+)?/);
  return m ? Number(m[0].replace(/\./g, "").replace(",", ".")) : NaN;
};
const lista = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}` : xs[0]);

export function titularMotor(p: { veredicto: Veredicto; modalidad: "ltr" | "str"; card: CardRecomendacion }): TitularMotor {
  const { veredicto: v, card } = p;
  const str = p.modalidad === "str";
  const mercado = str ? "la tarifa por noche" : "el arriendo";
  const bloque = card.bloque;

  // ── COMPRAR: el margen de la card, graduado ─────────────────────────────────
  if (v === "COMPRAR") {
    const m = bloque?.filas.find((f) => f.rotuloCorto === "Margen");
    if (!m) return { titular: "Conviene: **cierra al precio pedido**.", rama: "comprar_sin_margen" };
    const x = Math.abs(num(m.cifra));
    const firme = /o más/.test(m.cifra);
    if (x === 0) return { titular: `Conviene, sin colchón: **si ${mercado} baja, deja de convenir**.`, rama: "comprar_sin_colchon" };
    if (firme || x >= SENS_CORTE_FAVORABLE) {
      // «o más» en renta corta pasa de 15 palabras con la frase entera: va la forma corta.
      const cabeza = firme && str ? "Conviene, veredicto fuerte" : "Conviene, y el veredicto es fuerte";
      return { titular: `${cabeza}: **${mercado} aguanta ${pctCard(x)}% menos${firme ? " o más" : ""}**.`, rama: "comprar_fuerte" };
    }
    if (x >= SENS_CORTE_ADVERSO) return { titular: `Conviene, con margen acotado: **${mercado} aguanta hasta ${pctCard(x)}% menos**.`, rama: "comprar_acotado" };
    return { titular: `Conviene, con cautela: **${mercado} ${x < 2 ? "aguanta apenas" : "solo aguanta"} ${pctCard(x)}% menos**.`, rama: "comprar_cautela" };
  }

  // ── BUSCAR OTRA: la distancia de la card ─────────────────────────────────────
  if (v === "BUSCAR OTRA") {
    const d = card.buscar?.distancia ?? null;
    if (!d) {
      // Sin distancia la card dice solo la causa; la única causa sin distancia es no haber
      // declarado arriendo. Cualquier otra, sin cifra, dice que no cierra.
      if (/no declaraste arriendo/.test(card.buscar?.causa ?? "")) {
        return { titular: "No conviene: **no declaraste arriendo**, y sin ingreso no hay con qué pagar la cuota.", rama: "buscar_sin_distancia" };
      }
      return { titular: "No conviene: **los números no cierran a este precio**.", rama: "buscar_sin_distancia" };
    }
    const sobreTope = d.match(/más de un (\d+)% menos de precio/);
    if (sobreTope) return { titular: `No conviene: **ni con ${sobreTope[1]}% menos de precio llega a Comprar**.`, rama: "buscar_fuera_de_tope" };
    const m = d.match(/pediría un ([\d,]+)% (menos de precio|más de (?:arriendo|tarifa(?: por noche)?))/);
    if (!m) return { titular: "No conviene: **los números no cierran a este precio**.", rama: "buscar_sin_distancia" };
    const x = num(m[1]);
    const dificil = x > BANDA_TOPE_ARGUMENTOS_PCT;
    if (m[2] !== "menos de precio") {
      // «más de tarifa por noche» no cabe en 15 palabras con la dificultad: «más por noche».
      const que = m[2].startsWith("más de tarifa") ? "más por noche" : "más de arriendo";
      return {
        titular: `No conviene: **llegar a Comprar pediría ${pctCard(x)}% ${que}**, ${dificil ? "y eso es muy difícil" : "pero eso depende del mercado"}.`,
        rama: "buscar_distancia_mercado",
      };
    }
    return {
      titular: `No conviene: **llegar a Comprar pediría ${pctCard(x)}% menos de precio**, ${dificil ? "y eso es muy difícil" : ETIQUETA_BANDA[bandaDeDescuento(x)]}.`,
      rama: "buscar_distancia",
    };
  }

  // ── AJUSTAR: en el orden de LoQueHariaYoBloque ───────────────────────────────
  if (!bloque) return { titular: "Así no cierra al precio pedido: **Ajusta los supuestos**.", rama: "ajustar_sin_card" };
  const mix = bloque.mix;
  if (mix && mix.destino === "COMPRAR") {
    const partes: string[] = [];
    if (mix.movimiento.pie) partes.push(`pie de ${pctCard(mix.movimiento.pie.a)}%`);
    if (mix.movimiento.plazo) partes.push(`crédito a ${mix.movimiento.plazo.a} años`);
    if (!mix.descuento) return { titular: `Para Comprar: **${lista(partes)}**, sin pedir descuento.`, rama: "ajustar_mix_sin_descuento" };
    const d = num(mix.descuento);
    // Lo chico dicho chico: bajo 1% no es una negociación.
    if (d < 1) return { titular: `Para Comprar: ${partes.length ? `${partes.join(", ")} y ` : ""}**un descuento mínimo de ${pctCard(d)}%**.`, rama: "ajustar_mix_minimo" };
    const pide = `**descuento de ${pctCard(d)}%, ${ETIQUETA_BANDA[bandaDeDescuento(d)]}**`;
    // Con pie Y plazo, la «y» antes del descuento lo lleva a 16 palabras: va sin ella.
    if (!partes.length) return { titular: `Para Comprar: ${pide}.`, rama: "ajustar_mix_descuento" };
    return { titular: `Para Comprar: ${partes.join(", ")}${partes.length > 1 ? "," : " y"} ${pide}.`, rama: "ajustar_mix_descuento" };
  }
  const precio = bloque.filas.find((f) => f.nombre === "precio");
  if (precio) {
    const d = Math.abs(num(precio.cifra));
    if (d < 1) return { titular: `Para Comprar: **un descuento mínimo de ${pctCard(d)}%**.`, rama: "ajustar_precio_minimo" };
    return { titular: `Para Comprar: **descuento de ${pctCard(d)}%, ${ETIQUETA_BANDA[bandaDeDescuento(d)]}**.`, rama: "ajustar_precio" };
  }
  const mer = bloque.filas.find((f) => f.quien === "mercado");
  if (mer) {
    const x = Math.abs(num(mer.cifra));
    return { titular: `Llega a Comprar si **${mer.nombre === "tarifa" || str ? "la tarifa por noche" : "el arriendo"} sube ${pctCard(x)}%**, pero eso depende del mercado.`, rama: "ajustar_mercado" };
  }
  return { titular: "Así no cierra, y **ninguna combinación lo lleva a Comprar**.", rama: "ajustar_sin_salida" };
}
