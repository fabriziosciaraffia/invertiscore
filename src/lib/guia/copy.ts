// ─────────────────────────────────────────────────────────────────────────────
// «Por dónde seguir buscando» (FASE 2 de los avisos evaluados, 30-sep-2026): el copy, fijado por
// Fabrizio. Los parecidos son una GUÍA de búsqueda —avisos publicados, revisados con los números de
// la persona—, no el portafolio de Franco: para describirlos nunca «portafolio», «exclusivo» ni
// «oportunidad» (VEDADAS_GUIA). El tier GUIA-BUSQUEDA fija cada frase y barre las vedadas.
// ─────────────────────────────────────────────────────────────────────────────

/** Palabras que no describen a los parecidos: quedan para el portafolio, que es otra cosa. */
export const VEDADAS_GUIA = ["portafolio", "exclusivo", "oportunidad"] as const;

// La línea de la selección y la urgencia que iban en el ticket del pack (02-oct-2026) salieron el
// 08-oct-2026 con el copy nuevo del ticket: lo que se recibe cada semana lo dice ahora el ticket
// («recibes cada semana oportunidades…») y la urgencia el titular del banner («Los deptos que convienen
// como inversión se van rápido…», `OFERTA_REGISTRO.titular`). La medición de escasez del 15-oct, si da
// cifras, va a ese titular.

// 01-oct-2026: después de pagar, una sola idea —«compraste 3 análisis; empieza por estos»—. El título
// y el cuerpo se funden; «ajustada» y «ninguno» van debajo del título en lugar del cuerpo.
// 02-oct-2026: el título y «usa 1 de tus N» dicen el SALDO REAL (GUIA_SALDO, abajo), no «3» fijo: quien
// ya usó uno, o tenía saldo de antes, leía un número falso.
export const GUIA = {
  cuerpo: "Deptos publicados hoy, parecidos y cercanos al que analizaste. Franco los revisó con tu pie y tu plazo: estos son los mejores.",
  ajustada: "Ajustamos tu pie y tu plazo porque ninguno calzaba con esa combinación; estos son los mejores.",
  ninguno: "Ninguno conviene, ni con más plazo ni con más pie. Mejor sigue buscando en otra zona.",
  analizar: "Analizar este",
  analizando: "Generando…",
  otroDepto: "¿Tienes otro depto en mente?",
  otroDeptoEnlace: "Analízalo con tus números ya cargados",
  registroTitulo: "Entra con el correo con que pagaste y lo analizamos.",
  registroEnviado: (correo: string) => `Te mandamos un código a ${correo}.`,
  entrarYAnalizar: "Entrar y analizar",
  otraCuenta: "Esa cuenta no es la del pago. Entra con el correo con que pagaste.",
  error: "No pudimos generar el informe. Intenta de nuevo.",
  // 01-oct-2026: el aviso se despublicó entre la guía y el clic. No se descuenta nada y la guía lo reemplaza.
  despublicado: "Este aviso ya no está publicado.",
  flujo: "Flujo mensual",
  veredicto: "Veredicto",
  teQueda: "te queda",
  saleDeTuBolsillo: "sale de tu bolsillo",
  chipComo: "Como el tuyo:",
  chipRadio: "A menos de",
  chipCombinacion: "Con pie",
  antiguedad: "Calculado con una antigüedad prudente de 25 años; el informe usa la real si el aviso la tiene.",
  pie: "Vistos en los últimos 7 días. Los precios son los publicados; el arriendo es el que Franco estima para cada uno en su zona.",
} as const;

/** Con el saldo real de la cuenta (`null` = no se pudo leer: la frase no inventa un número). En cero, lo
 *  dice: la guía sigue, pero no promete análisis que no hay. */
export const GUIA_SALDO = {
  titulo: (n: number | null): string =>
    n == null ? "Tus análisis ya están en tu cuenta. Empieza por estos." : n <= 0 ? "Ya usaste tus análisis. Estos son los que mejor calzan contigo." : `Tienes ${n} análisis. Empieza por estos.`,
  /** Junto a «Analizar este». `null` en cero: no hay de dónde usar uno. */
  usaUno: (n: number | null): string | null => (n == null ? "usa 1 de tus análisis" : n <= 0 ? null : n === 1 ? "usa el último que te queda" : `usa 1 de tus ${n}`),
} as const;

/**
 * El informe que sale de un aviso publicado. «Quiero verlo» en banner desde el 17-oct-2026 (decisión de Fabrizio: es lo que
 * la persona pagó y pasaba desapercibido): «Este depto conviene con tus números.» —solo con COMPRAR,
 * quiero-verlo-estado.ts › dicesQueConviene— y «Franco te manda el aviso al correo para que lo veas.»; al tocar, «Mandando
 * el aviso…» con el indicador; después «Listo: te lo mandamos a [correo]» con el visto, o «No pudimos mandarlo.» y
 * «Reintentar».
 */
export const INFORME_DE_AVISO = {
  origen: "Este análisis sale de un aviso publicado.",
  antiguedadSupuesta: "El aviso no dice la antigüedad; Franco supuso 25 años, lo más prudente.",
  boton: "Quiero verlo",
  conviene: "Este depto conviene con tus números.",
  bajada: "Franco te manda el aviso al correo para que lo veas.",
  enviando: "Mandando el aviso…",
  listo: (correo: string | null) => (correo ? `Listo: te lo mandamos a ${correo}` : "Listo: te lo mandamos a tu correo"),
  /** El toque repetido (19-oct-2026): el aviso había salido antes y no se vuelve a mandar. `cuando`: «hoy», «ayer» o
   *  «el 17 de octubre»; `asunto`, el del correo, para que lo encuentre. */
  ya: (correo: string | null, cuando: string | null, asunto: string | null) =>
    `Ya te lo mandamos${cuando ? ` ${cuando}` : ""} a ${correo ?? "tu correo"}${asunto ? `, con el asunto «${asunto}»` : ""}.`,
  despublicado: "Este aviso ya no está publicado.",
  error: "No pudimos mandarlo.",
  reintentar: "Reintentar",
} as const;
