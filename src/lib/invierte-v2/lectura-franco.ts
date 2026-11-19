// ─────────────────────────────────────────────────────────────────────────────
// «LO QUE VE FRANCO» (Invierte con Franco, entrega 4 de las láminas del 19-nov-2026; textos aprobados por Fabrizio el 19-nov-2026
// tras la prueba A/B y la v2). Puro: la instrucción, el esquema, el saneado y los textos de pantalla; lo usan el servidor, la
// pantalla y el tier.
//   · UNA lectura por depto, guardada (`lecturas_franco`): de ella salen la versión corta (tres líneas, el resultado) y la larga
//     (hasta cinco: Estado, Para arrendar, Edificio, Ubicación, Ojo; los detalles). Solo para quien firmó la orden.
//   · La lectura NO cita ni juzga el precio (decisión de Fabrizio): el descuento contra la zona es terreno del informe, que usa otra
//     referencia. Ninguna cifra del informe, sin excepciones; tampoco porcentajes ni comparaciones de precio, ni en la alerta ni en
//     la corta. En «Ojo» puede ir «La publicación no explica su precio: pregúntalo», sin número, solo si no da una razón.
//   · LA ALERTA («Lo que el puntaje no considera») sale solo de la evidencia de las fotos o del texto, nunca de un porcentaje:
//     grave (para remodelar o sin terminar, remate, venta de derechos o acciones, o ninguna foto del interior: no se recomienda
//     como alternativa) · revisar (datos que se contradicen —piso, baños, m² que no calzan con las fotos— o faltan fotos de partes
//     clave como baños o cocina) · ninguna (el resto). En el elegido y en sus detalles, grave y revisar van primero.
//   · Si la lectura no está lista, la tarjeta se muestra sin ese bloque y se completa sola; nunca se bloquea la pantalla.
// ─────────────────────────────────────────────────────────────────────────────

/** Sube con cada cambio de la instrucción: una lectura de otra versión se vuelve a generar. */
export const VERSION_LECTURA = 3;
export const MAX_FOTOS_LECTURA = 8;
/** Lecturas nuevas por hora, entre todas las personas (resguardo de costo: ~US$0,06 cada una). */
export const TOPE_LECTURAS_POR_HORA = 60;
/** Una lectura «generando» que lleva más de esto se da por caída y se puede reintentar. */
export const GENERANDO_VENCE_MS = 3 * 60 * 1000;

export type NivelAlerta = "ninguna" | "revisar" | "grave";
export const ETIQUETAS_LARGA = ["Estado", "Para arrendar", "Edificio", "Ubicación", "Ojo"] as const;
export type EtiquetaLarga = (typeof ETIQUETAS_LARGA)[number];
export type FuenteLinea = "fotos" | "publicacion" | "datos";

export interface LecturaFranco {
  alerta: { nivel: NivelAlerta; motivo: string | null };
  larga: { etiqueta: EtiquetaLarga; texto: string }[];
  corta: string[];
}

export const LECTURA_COPY = {
  rotulo: "Lo que ve Franco",
  alertaRotulo: "Lo que el puntaje no considera",
  alertaNivel: { revisar: "Revisar", grave: "Importante" } as Record<Exclude<NivelAlerta, "ninguna">, string>,
} as const;

export const INSTRUCCION_LECTURA_FRANCO = `Eres Franco, un analista de inversión inmobiliaria en Santiago de Chile. Escribes «Lo que ve Franco»: una lectura breve de un departamento usado en venta para alguien que lo evalúa como inversión para arrendar. Va junto a un informe que ya muestra todas las cifras y que juzga el precio; tu trabajo es decir lo que esas cifras no dicen, mirando las fotos y el texto de la publicación.

Recibes las fotos de la publicación, el texto que escribió quien publica (título y descripción) y algunos datos nuestros (comuna, dormitorios, baños, superficie, si la antigüedad viene informada y el metro más cercano).

Entregas tres cosas:

1. alerta: lo que el puntaje no considera. Se decide SOLO con lo que muestran las fotos o dice el texto de la publicación, nunca por el precio.
   - nivel «grave»: la publicación o las fotos muestran que es para remodelar o está sin terminar, que es un remate, que se venden derechos o acciones, o no hay ninguna foto del interior del departamento.
   - nivel «revisar»: datos que se contradicen (el piso, los baños o la superficie que dice la publicación no calzan con lo que se ve en las fotos), o faltan fotos de partes clave, como los baños o la cocina.
   - nivel «ninguna»: el resto; entonces motivo va null.
   - motivo: una frase corta que dice qué se ve o qué falta, sin cifras.

2. La versión larga: cinco líneas como máximo, con estas etiquetas, en este orden, sin repetir: Estado, Para arrendar, Edificio, Ubicación, Ojo.
   - Estado: cómo está el depto por dentro (terminaciones, cocina, baños, pisos) y si pide inversión antes de arrendar.
   - Para arrendar: qué tan fácil se arrienda. Tamaño de los dormitorios, baños para los dormitorios que tiene, distribución, si conviene arrendarlo amoblado. Nunca hables de precio ni de arriendo.
   - Edificio: lo que afecta costos o riesgos del edificio: ascensor, estacionamiento, bodega, estado de las áreas comunes; la antigüedad solo si viene informada.
   - Ubicación: hechos concretos que afecten el arriendo (que tiene metro cerca, que está sobre una avenida de alto tráfico), sin distancias.
   - Ojo: lo que falta saber antes de ofertar, como pregunta o acción («Pregunta si…», «Confirma…», «Pide fotos de…»). Si la antigüedad no viene informada, va aquí como pregunta. Si la publicación no da ninguna razón para su precio, puedes escribir «La publicación no explica su precio: pregúntalo», sin números.

3. La versión corta: tres líneas para la tarjeta del resultado, sin etiqueta. Si la alerta no es «ninguna», la primera línea es esa alerta. Las otras, lo que más pesa para la decisión.

Reglas:
- Nunca cites ni juzgues el precio: nada de precios, precio por m², porcentajes, «bajo su zona», «más barato», «buen precio» ni comparaciones con la zona o con otros deptos. Eso lo dice el informe, con otra referencia.
- Nunca cites una cifra del informe: precio, arriendo, flujo, gastos comunes, distancia al metro, superficie total. Solo puedes usar medidas que vengan de la publicación y sirvan para arrendar (por ejemplo, un dormitorio de 6,6 m²) y años de construcción informados.
- No repitas el marketing de quien publica: supermercados, colegios, clínicas, «excelente conectividad», «sector consolidado». No describas lo que no cambia la inversión: luz, vista, colores, decoración, juegos infantiles, quinchos.
- La antigüedad solo se afirma si viene informada. Nunca presentes una antigüedad supuesta como dato.
- Cada línea necesita evidencia en las fotos, en el texto de la publicación o en nuestros datos, y declara su fuente en «fuente»: «fotos», «publicacion» o «datos» (la que más pesa).
- Lo que afirma quien publica va marcado con «según la publicación». Lo que ves en las fotos lo dices como lo que se ve («En las fotos se ve…»), sin asegurar lo que una foto no permite.
- Si no hay evidencia para una etiqueta, omite esa línea. No inventes datos, años ni servicios.
- Nunca califiques el barrio, la comuna ni a sus vecinos como buenos o malos, seguros o peligrosos.
- Cada línea, una o dos frases cortas, de 30 palabras como máximo.
- Español de Chile neutro, tuteando (tú), sin voseo, sin chilenismos ni garabatos. No menciones portales ni sitios de avisos ni a quien publica por su nombre.`;

const FUENTE = { type: "string", enum: ["fotos", "publicacion", "datos"] } as const;
export const ESQUEMA_LECTURA_FRANCO = {
  type: "object",
  additionalProperties: false,
  required: ["alerta", "larga", "corta"],
  properties: {
    alerta: {
      type: "object",
      additionalProperties: false,
      required: ["nivel", "motivo"],
      properties: {
        nivel: { type: "string", enum: ["ninguna", "revisar", "grave"] },
        // Un valor con nulo va con anyOf (la API rechaza `type: [x, "null"]` junto a un enum; medido el 19-nov-2026).
        motivo: { anyOf: [{ type: "string" }, { type: "null" }] },
      },
    },
    larga: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["etiqueta", "texto", "fuente"],
        properties: { etiqueta: { type: "string", enum: [...ETIQUETAS_LARGA] }, texto: { type: "string" }, fuente: FUENTE },
      },
    },
    corta: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["texto", "fuente"], properties: { texto: { type: "string" }, fuente: FUENTE } },
    },
  },
} as const;

/**
 * La red, por si el modelo se sale de la regla: una línea con una cifra de precio o una comparación de precio NO se muestra.
 * Porcentajes, montos en UF o en pesos, distancias en metros o kilómetros, precio por m², «bajo su zona», «más barato», «buen
 * precio», «que los parecidos». La pregunta sin número de «Ojo» («La publicación no explica su precio: pregúntalo») sí pasa.
 */
export function lineaPermitida(texto: string): boolean {
  const t = texto.toLowerCase();
  if (/%|\buf\b|\$\s?\d|\d\s*(?:mil|millones)\b|\d+(?:[.,]\d+)?\s*(?:metros|mts|m|km|kil[oó]metros)\b(?!²)|por\s+m²|\/\s*m²/.test(t)) return false;
  if (/(bajo|sobre|que)\s+(su|la)\s+zona|m[aá]s\s+barat|m[aá]s\s+car[oa]|buen\s+precio|precio\s+(bajo|alto|atractivo|conveniente|de\s+oportunidad)|bajo\s+(el\s+)?mercado|que\s+(los|sus)\s+parecidos|descuento/.test(t)) return false;
  return true;
}

const limpio = (x: unknown) => (typeof x === "string" && x.trim() ? x.replace(/\s+/g, " ").trim().slice(0, 400) : null);

/** De la salida del modelo a la lectura que se guarda: solo lo permitido, en orden, sin repetir etiquetas. */
export function sanearLectura(j: unknown): LecturaFranco | null {
  if (!j || typeof j !== "object") return null;
  const o = j as { alerta?: { nivel?: unknown; motivo?: unknown }; larga?: unknown; corta?: unknown };
  const nivel: NivelAlerta = o.alerta?.nivel === "grave" || o.alerta?.nivel === "revisar" ? o.alerta.nivel : "ninguna";
  const motivoCrudo = limpio(o.alerta?.motivo);
  const motivo = nivel === "ninguna" ? null : motivoCrudo && lineaPermitida(motivoCrudo) ? motivoCrudo : null;
  const vistas = new Set<string>();
  const larga = (Array.isArray(o.larga) ? o.larga : [])
    .map((l) => ({ etiqueta: (l as { etiqueta?: unknown }).etiqueta, texto: limpio((l as { texto?: unknown }).texto) }))
    .filter((l): l is { etiqueta: EtiquetaLarga; texto: string } => (ETIQUETAS_LARGA as readonly unknown[]).includes(l.etiqueta) && !!l.texto && lineaPermitida(l.texto) && !vistas.has(l.etiqueta as string) && !!vistas.add(l.etiqueta as string))
    .sort((a, b) => ETIQUETAS_LARGA.indexOf(a.etiqueta) - ETIQUETAS_LARGA.indexOf(b.etiqueta))
    .slice(0, 5);
  const corta = (Array.isArray(o.corta) ? o.corta : []).map((l) => limpio((l as { texto?: unknown }).texto)).filter((t): t is string => !!t && lineaPermitida(t)).slice(0, 3);
  if (!larga.length && !corta.length) return null;
  // Una alerta sin motivo legible no se muestra como alerta (queda el nivel para decidir si se recomienda).
  return { alerta: { nivel, motivo }, larga, corta };
}

/** ¿Se puede recomendar como alternativa? Con alerta grave, no. */
export const recomendable = (l: Pick<LecturaFranco, "alerta"> | null | undefined) => l?.alerta.nivel !== "grave";
/** ¿La alerta va primero (en el elegido y en sus detalles)? */
export const alertaPrimero = (l: Pick<LecturaFranco, "alerta"> | null | undefined) => !!l && l.alerta.nivel !== "ninguna" && !!l.alerta.motivo;

/** Las líneas de la corta para el elegido: si la alerta va arriba en su bloque, no se repite como primera línea. */
export function cortaSinRepetirAlerta(l: LecturaFranco): string[] {
  return alertaPrimero(l) && l.corta.length > 1 ? l.corta.slice(1) : l.corta;
}

/** «**Cocina y baños renovados:** se arrienda tal como está.»: lo que va antes de los dos puntos, en negrita (lámina 3.2). */
export function partirLinea(t: string): { fuerte: string | null; resto: string } {
  const i = t.indexOf(":");
  return i > 0 && i < 70 ? { fuerte: t.slice(0, i + 1), resto: t.slice(i + 1) } : { fuerte: null, resto: t };
}
