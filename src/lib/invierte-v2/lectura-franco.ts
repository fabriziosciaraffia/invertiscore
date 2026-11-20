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
//     como alternativa) · revisar (SOLO datos que se contradicen: las fotos o el texto contradicen un dato con que se calculó el
//     informe —dormitorios, baños, m², piso; p. ej. un «dormitorio» de 6,6 m²—, 19-nov-2026) · ninguna (el resto).
//   · LAS FOTOS (20-nov-2026, decisión de Fabrizio, tras su prueba en el preview): la lectura recibe TODAS las fotos de la publicación,
//     hasta MAX_FOTOS_LECTURA. Solo si las recibió todas puede decir que falta una foto de algo; y que falten fotos ya NO es alerta:
//     va como línea normal, en forma de pedido («Pide fotos del baño antes de ofertar.»). Si la publicación tiene más de las que
//     recibe, no lo afirma (instrucción + `sinAfirmarFaltantes` en el saneado).
//   · Si la lectura no está lista, la tarjeta se muestra sin ese bloque y se completa sola; nunca se bloquea la pantalla.
// ─────────────────────────────────────────────────────────────────────────────

/** Sube con cada cambio de la instrucción: una lectura de otra versión se vuelve a generar. */
export const VERSION_LECTURA = 7;
/** Todas las fotos de la publicación, hasta este tope (20-nov-2026; antes 8, y la lectura decía que faltaban fotos que sí estaban). */
export const MAX_FOTOS_LECTURA = 24;
/** Lecturas nuevas por hora, entre todas las personas (resguardo de costo). */
export const TOPE_LECTURAS_POR_HORA = 60;
/** La versión corta (20-nov-2026, Fabrizio): exactamente tres líneas, cada una UNA frase de unos 110 caracteres. Si el modelo pasa de
 *  este tope, la lectura se rehace (no se corta la frase a la mitad). 120 y no 110: los ejemplos de síntesis de Fabrizio llegan a 113. */
export const MAX_CARACTERES_CORTA = 120;
export const LINEAS_CORTA = 3;
/** Una lectura en error se vuelve a intentar cuando alguien vuelve a ver el depto, con espera creciente y un tope (20-nov-2026). */
export const TOPE_INTENTOS_LECTURA = 4;
export const ESPERA_REINTENTO_MS = 2 * 60 * 1000;
/** Una lectura «generando» que lleva más de esto se da por caída y se puede reintentar. */
export const GENERANDO_VENCE_MS = 3 * 60 * 1000;

export type NivelAlerta = "ninguna" | "revisar" | "grave";
export const ETIQUETAS_LARGA = ["Estado", "Para arrendar", "Edificio", "Ubicación", "Ojo"] as const;
export type EtiquetaLarga = (typeof ETIQUETAS_LARGA)[number];
export type FuenteLinea = "fotos" | "publicacion" | "datos";

/** Estado para arrendar (20-nov-2026, Fabrizio): campo interno de la lectura, que no se muestra. */
export const ESTADOS_ARRIENDO = ["listo", "arreglos_menores", "remodelacion"] as const;
export type EstadoArriendo = (typeof ESTADOS_ARRIENDO)[number];

export interface LecturaFranco {
  alerta: { nivel: NivelAlerta; motivo: string | null };
  larga: { etiqueta: EtiquetaLarga; texto: string }[];
  corta: string[];
  /** Interno (no se muestra): listo, arreglos menores o remodelación. */
  estadoArriendo?: EstadoArriendo | null;
  /** Las cifras de la tarjeta con que se escribió (se guardan con la lectura: al releerla, el saneado las sigue permitiendo). */
  cifras?: CifrasTarjeta | null;
}

/** Las cifras del motor que la lectura PUEDE citar, tal como las muestra la tarjeta (20-nov-2026, Fabrizio): el cap rate bruto y lo que
 *  deja o pide al mes. Sin al menos MIN_ARRIENDOS_COMPARABLES arriendos de su tamaño, el arriendo del motor no es confiable y no van. */
export interface CifrasTarjeta { capRatePct: number | null; flujoCLP: number | null }
export const MIN_ARRIENDOS_COMPARABLES = 6;

export const LECTURA_COPY = {
  rotulo: "Lo que ve Franco",
  alertaRotulo: "Lo que el puntaje no considera",
  // «Revisar» o «Grave» (20-nov-2026, Fabrizio): el chip dice el nivel con su nombre.
  alertaNivel: { revisar: "Revisar", grave: "Grave" } as Record<Exclude<NivelAlerta, "ninguna">, string>,
} as const;

export const INSTRUCCION_LECTURA_FRANCO = `Eres Franco, un analista de inversión inmobiliaria en Santiago de Chile. Escribes «Lo que ve Franco»: una lectura breve de un departamento usado en venta para alguien que lo evalúa como inversión para arrendar. Va junto a un informe que ya muestra todas las cifras y que juzga el precio; tu trabajo es decir lo que esas cifras no dicen, mirando las fotos y el texto de la publicación.

Recibes las fotos de la publicación —todas, o las primeras 24 si tiene más; el mensaje te dice cuál es el caso—, el texto que escribió quien publica (título y descripción), algunos datos nuestros (comuna, dormitorios, baños, superficie, si la antigüedad viene informada y el metro más cercano) y, cuando el arriendo del motor es confiable, los números que muestra la tarjeta del depto: el cap rate bruto, lo que deja o pide al mes y el veredicto.

Los números de la tarjeta puedes citarlos tal cual vienen, en el mismo formato. No los recalcules, no los corrijas, no los redondees de otra forma ni propongas otro número. Si no vienen, no hables de cap rate ni de lo que deja al mes.

Entregas tres cosas:

1. alerta: lo que el puntaje no considera. Se decide SOLO con lo que muestran las fotos o dice el texto de la publicación, nunca por el precio.
   - nivel «grave»: la publicación o las fotos muestran que es para remodelar o está sin terminar, que es un remate, que se venden derechos o acciones, o —solo si recibiste todas las fotos— no hay ninguna foto del interior del departamento.
   - nivel «revisar»: SOLO cuando los datos se contradicen: las fotos o el texto contradicen un dato con que se calculó el informe —los dormitorios, los baños, la superficie o el piso de «nuestros datos»— (por ejemplo, un dormitorio tan chico que no sirve como dormitorio, o la publicación dice estudio y nuestros datos dicen un dormitorio).
   - Que falten fotos de algo (el baño, la cocina, un dormitorio) NUNCA es alerta: si corresponde, va como una línea normal en forma de pedido.
   - nivel «ninguna»: el resto; entonces motivo va null.
   - motivo: UNA frase de unos 110 caracteres que dice qué se ve o qué se contradice, sin cifras.

2. La versión larga: cinco líneas como máximo, con estas etiquetas, en este orden, sin repetir: Estado, Para arrendar, Edificio, Ubicación, Ojo.
   - Estado: cómo está el depto por dentro (terminaciones, cocina, baños, pisos) y si pide inversión antes de arrendar.
   - Para arrendar: qué tan fácil se arrienda. Tamaño de los dormitorios, baños para los dormitorios que tiene, distribución, si conviene arrendarlo amoblado. Nunca hables de precio ni de arriendo.
   - Edificio: lo que afecta costos o riesgos del edificio: ascensor, estacionamiento, bodega, estado de las áreas comunes; la antigüedad solo si viene informada.
   - Ubicación: hechos concretos que afecten el arriendo (que tiene metro cerca, que está sobre una avenida de alto tráfico), sin distancias.
   - Ojo: lo que falta saber antes de ofertar, como pregunta o acción («Pregunta si…», «Confirma…»). Si la antigüedad no viene informada, va aquí como pregunta. Si recibiste todas las fotos y falta alguna parte clave (el baño, la cocina, los dormitorios), va como pedido: «Pide fotos del baño antes de ofertar.» Si la publicación no da ninguna razón para su precio, puedes escribir «La publicación no explica su precio: pregúntalo», sin números.

3. La versión corta: EXACTAMENTE tres líneas para la tarjeta del resultado, sin etiqueta. Cada línea es UNA sola frase de unos 110 caracteres (nunca más de 120; no dos frases, no punto seguido).
   - La primera línea es la SÍNTESIS: cruza un número de la tarjeta (o el veredicto, si no vienen números) con lo que se ve en las fotos o dice la publicación, en una frase que diga qué significa para esta inversión. Tiene que notarse que alguien miró este depto: nada de plantillas ni frases fijas. Ejemplos del tono, no para copiar: «Cap rate de 5,8 %, pero la cocina y los baños son originales: parte de esa ventaja se va en dejarlo arrendable.» · «Deja $88 mil al mes y está listo para arrendar.» · «Buen número en el papel, pero es un quinto piso sin ascensor: se arrienda más lento de lo que supone el cálculo.»
   - Si la alerta no es «ninguna», la primera línea es esa alerta y la síntesis pasa a la segunda.
   - Las otras líneas respaldan la síntesis con lo que más pesa para la decisión.

4. estado_arriendo (interno, no se muestra): cómo está el depto para arrendar según las fotos y el texto: «listo» (se arrienda tal como está), «arreglos_menores» (pintura, alfombras, artefactos) o «remodelacion» (cocina, baños o terminaciones completas).

Reglas:
- Nunca cites ni juzgues el precio: nada de precios, precio por m², «bajo su zona», «más barato», «buen precio» ni comparaciones con la zona o con otros deptos. Eso lo dice el informe, con otra referencia.
- De las cifras del motor, solo las de la tarjeta (cap rate bruto, lo que deja o pide al mes y el veredicto), tal cual. Ninguna otra: ni precio, ni arriendo, ni gastos comunes en pesos, ni distancia al metro. Sí puedes usar medidas que vengan de la publicación y sirvan para arrendar (por ejemplo, un dormitorio de 6,6 m²), pisos, cantidades de dormitorios y años de construcción informados.
- No repitas el marketing de quien publica: supermercados, colegios, clínicas, «excelente conectividad», «sector consolidado». No describas lo que no cambia la inversión: luz, vista, colores, decoración, juegos infantiles, quinchos.
- La antigüedad solo se afirma si viene informada. Nunca presentes una antigüedad supuesta como dato.
- Solo puedes decir que no hay fotos de algo, o pedir fotos, si recibiste todas las fotos de la publicación. Si recibiste solo las primeras, nunca digas que falta una foto ni pidas fotos: puede estar entre las que no viste. Si el mensaje dice que no se pudo ver ninguna foto, no digas nada de las fotos.
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
  required: ["alerta", "larga", "corta", "estado_arriendo"],
  properties: {
    alerta: {
      type: "object",
      additionalProperties: false,
      required: ["nivel", "motivo"],
      properties: {
        nivel: { type: "string", enum: ["ninguna", "revisar", "grave"] },
        // Un valor con nulo va con anyOf (la API rechaza `type: [x, "null"]` junto a un enum; medido el 19-nov-2026).
        motivo: { anyOf: [{ type: "string", maxLength: MAX_CARACTERES_CORTA, description: "Una sola frase de unos 110 caracteres (nunca más de 120)." }, { type: "null" }] },
      },
    },
    estado_arriendo: { type: "string", enum: [...ESTADOS_ARRIENDO], description: "Interno: listo, arreglos_menores o remodelacion." },
    larga: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["etiqueta", "texto", "fuente"],
        properties: { etiqueta: { type: "string", enum: [...ETIQUETAS_LARGA] }, texto: { type: "string" }, fuente: FUENTE },
      },
    },
    // La API acepta minItems 0 o 1 y maxLength (medido el 20-nov-2026: minItems 3 da 400). Las tres líneas las exige el código.
    corta: {
      type: "array",
      minItems: 1,
      description: "Exactamente tres líneas; la primera, la síntesis (o la alerta y después la síntesis). Cada una, una sola frase de unos 110 caracteres.",
      items: { type: "object", additionalProperties: false, required: ["texto", "fuente"], properties: { texto: { type: "string", maxLength: MAX_CARACTERES_CORTA, description: "Una sola frase de unos 110 caracteres (nunca más de 120)." }, fuente: FUENTE } },
    },
  },
} as const;

/**
 * La red, por si el modelo se sale de la regla (reescrita el 20-nov-2026, decisión de Fabrizio: la de antes borraba también
 * distancias en metros y cualquier porcentaje, y se llevaba frases válidas). Solo borra una línea que cite PLATA o COMPARE EL PRECIO:
 *   · precio_uf      un monto en UF («UF 2.700»);
 *   · pesos          un monto en pesos («$80.000», «450 mil», «2 millones»): precio, arriendo, flujo o gastos comunes;
 *   · precio_m2      precio por m² («UF por m²», «/ m²»);
 *   · comparacion    una comparación de precio en palabras («bajo su zona», «más barato», «buen precio», «descuento»…);
 *   · porcentaje     un porcentaje que habla de precio («un 34 % bajo su zona», «subió un 20 %»).
 * Años, pisos, cantidades de dormitorios o baños, m² y distancias SE QUEDAN. La pregunta sin número de «Ojo» («La publicación no
 * explica su precio: pregúntalo») también pasa.
 */
export type ReglaDescarte = "precio_uf" | "pesos" | "precio_m2" | "comparacion" | "porcentaje" | "faltan_fotos";
/** Las formas en que la lectura puede escribir una cifra de la tarjeta: «5,8 %», «5,8%»; «$88.864», «$88 mil», «88 mil». */
export function formasPermitidas(c: CifrasTarjeta | null | undefined): string[] {
  if (!c) return [];
  const out: string[] = [];
  if (c.capRatePct != null) { const n = (Math.round(c.capRatePct * 10) / 10).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); out.push(`${n} %`, `${n}%`); }
  if (c.flujoCLP != null) { const v = Math.abs(c.flujoCLP); const miles = Math.round(v).toLocaleString("es-CL"); const k = Math.round(v / 1000); out.push(`$${miles}`, `$ ${miles}`, `$${k} mil`, `$ ${k} mil`, `${k} mil`); }
  return out;
}

export function reglaDescarte(texto: string, cifras: CifrasTarjeta | null = null): Exclude<ReglaDescarte, "faltan_fotos"> | null {
  // Las cifras de la tarjeta, tal cual, se permiten (20-nov-2026): se quitan antes de mirar; cualquier otra cifra de plata o de
  // rentabilidad sigue cayendo.
  let t = texto.toLowerCase();
  for (const f of formasPermitidas(cifras).sort((a, b) => b.length - a.length)) t = t.split(f.toLowerCase()).join(" ");
  if (/\buf\s*\d|\d[\d.,]*\s*uf\b/.test(t)) return "precio_uf";
  if (/\$\s?\d|\d\s*(?:mil|millones|mm)\b/.test(t)) return "pesos";
  if (/(?:uf|\$|pesos)\s*(?:por|\/)\s*m²|\bpor\s+m²|\/\s*m²/.test(t)) return "precio_m2";
  if (/(bajo|sobre|que)\s+(su|la)\s+zona|m[aá]s\s+barat|m[aá]s\s+car[oa]|buen\s+precio|precio\s+(bajo|alto|atractivo|conveniente|de\s+oportunidad)|bajo\s+(el\s+)?mercado|que\s+(los|sus)\s+parecidos|descuento/.test(t)) return "comparacion";
  if (/\d\s*%|%/.test(t) && /precio|zona|mercado|parecid|barat|car[oa]\b|descuento|tasaci|aval[uú]o|subi[oó]|baj[oó]|rebaj|cuesta|vale|valor|cap\s*rate|rentab|retorno|rinde/.test(t)) return "porcentaje";
  return null;
}

/** ¿La línea pasa la red de precio? */
export const lineaPermitida = (texto: string): boolean => reglaDescarte(texto) === null;

/** Una línea que el saneado borró: en qué campo estaba, el texto y la regla (20-nov-2026: queda registrada para verla después). */
export interface Descarte { campo: "alerta" | "larga" | "corta"; texto: string; regla: ReglaDescarte }

const limpio = (x: unknown) => (typeof x === "string" && x.trim() ? x.replace(/\s+/g, " ").trim().slice(0, 400) : null);

/** ¿Esta línea afirma que faltan fotos de algo, o pide fotos? Solo vale si la lectura recibió todas las fotos (20-nov-2026). */
export function afirmaFaltanFotos(texto: string): boolean {
  return /\b(?:no\s+(?:hay|se\s+ven?|aparecen?|muestran?|incluyen?|traen?)\s+(?:ninguna\s+)?fotos?|faltan?\s+fotos|sin\s+fotos|pide\s+(?:m[aá]s\s+)?fotos|pedir\s+fotos|no\s+(?:se\s+)?muestra[n]?\s+(?:el|la|los|las)\s+(?:baño|baños|cocina|dormitorio|dormitorios|living))/i.test(texto);
}

/** De la salida del modelo a la lectura que se guarda: solo lo permitido, en orden, sin repetir etiquetas. `fotosCompletas`
 *  (20-nov-2026): si la lectura no recibió todas las fotos, se cae toda línea que diga que falta una foto o que pida fotos, y una
 *  alerta por eso no queda como alerta. */
export function sanearLectura(j: unknown, opts: { fotosCompletas?: boolean; cifras?: CifrasTarjeta | null } = {}): LecturaFranco | null {
  return sanearConRegistro(j, opts).lectura;
}

/** Lo mismo, y además qué líneas borró y por qué regla (20-nov-2026, Fabrizio: «deja registro cada vez que el saneado borra una
 *  línea»). Quien genera la lectura lo guarda (`lecturas_franco.descartes`) y lo anota en el log. */
export function sanearConRegistro(j: unknown, opts: { fotosCompletas?: boolean; cifras?: CifrasTarjeta | null } = {}): { lectura: LecturaFranco | null; descartes: Descarte[] } {
  const descartes: Descarte[] = [];
  // Las cifras permitidas: las de quien genera, o las guardadas con la lectura (al releerla).
  const guardadas = j && typeof j === "object" ? ((j as { cifras?: unknown }).cifras as CifrasTarjeta | null | undefined) : null;
  const cifras: CifrasTarjeta | null = opts.cifras ?? (guardadas && typeof guardadas === "object" ? { capRatePct: typeof guardadas.capRatePct === "number" ? guardadas.capRatePct : null, flujoCLP: typeof guardadas.flujoCLP === "number" ? guardadas.flujoCLP : null } : null);
  const motivoDe = (t: string): ReglaDescarte | null => reglaDescarte(t, cifras) ?? (opts.fotosCompletas === false && afirmaFaltanFotos(t) ? "faltan_fotos" : null);
  const filtro = (campo: Descarte["campo"]) => (t: string) => { const r = motivoDe(t); if (r) descartes.push({ campo, texto: t, regla: r }); return !r; };
  const permitida = filtro("larga");
  if (!j || typeof j !== "object") return { lectura: null, descartes };
  const o = j as { alerta?: { nivel?: unknown; motivo?: unknown }; larga?: unknown; corta?: unknown; estado_arriendo?: unknown; estadoArriendo?: unknown };
  const estadoCrudo = o.estado_arriendo ?? o.estadoArriendo;
  const estadoArriendo: EstadoArriendo | null = (ESTADOS_ARRIENDO as readonly unknown[]).includes(estadoCrudo) ? (estadoCrudo as EstadoArriendo) : null;
  const motivoCrudo = limpio(o.alerta?.motivo);
  const nivelCrudo: NivelAlerta = o.alerta?.nivel === "grave" || o.alerta?.nivel === "revisar" ? o.alerta.nivel : "ninguna";
  // Sin todas las fotos, una alerta que dice que faltan fotos no se sostiene: no queda como alerta.
  const nivel: NivelAlerta = nivelCrudo !== "ninguna" && opts.fotosCompletas === false && motivoCrudo && afirmaFaltanFotos(motivoCrudo) ? "ninguna" : nivelCrudo;
  const motivo = nivel === "ninguna" ? null : motivoCrudo && filtro("alerta")(motivoCrudo) ? motivoCrudo : null;
  const vistas = new Set<string>();
  const larga = (Array.isArray(o.larga) ? o.larga : [])
    .map((l) => ({ etiqueta: (l as { etiqueta?: unknown }).etiqueta, texto: limpio((l as { texto?: unknown }).texto) }))
    .filter((l): l is { etiqueta: EtiquetaLarga; texto: string } => (ETIQUETAS_LARGA as readonly unknown[]).includes(l.etiqueta) && !!l.texto && permitida(l.texto) && !vistas.has(l.etiqueta as string) && !!vistas.add(l.etiqueta as string))
    .sort((a, b) => ETIQUETAS_LARGA.indexOf(a.etiqueta) - ETIQUETAS_LARGA.indexOf(b.etiqueta))
    .slice(0, 5);
  // La corta llega del modelo como { texto, fuente } y se guarda como texto: se aceptan las dos (20-nov-2026: al releer una lectura
  // guardada, la corta se perdía entera y el resultado mostraba solo la alerta).
  const corta = (Array.isArray(o.corta) ? o.corta : []).map((l) => limpio(typeof l === "string" ? l : (l as { texto?: unknown } | null)?.texto)).filter((t): t is string => !!t && filtro("corta")(t)).slice(0, 3);
  if (!larga.length && !corta.length) return { lectura: null, descartes };
  // Una alerta sin motivo legible no se muestra como alerta (queda el nivel para decidir si se recomienda).
  return { lectura: { alerta: { nivel, motivo }, larga, corta, estadoArriendo, cifras }, descartes };
}

/** ¿Esta línea es UNA frase? Un punto, signo de cierre o exclamación seguido de otra frase la parte en dos. */
export const unaFrase = (t: string) => !/[.!?…]\s+[A-ZÁÉÍÓÚÑ¿¡«]/.test(t.trim());

/** ¿La versión corta cumple la regla (20-nov-2026, Fabrizio)? Tres líneas, cada una UNA frase de MAX_CARACTERES_CORTA o menos, y el
 *  motivo de la alerta igual. Devuelve el problema, o null. Una corta que no cumple se REHACE, no se recorta: las dos lecturas con la
 *  corta vacía del 20-nov-2026 eran del modelo (escribió menos de tres líneas), no del saneado. */
export function problemaCorta(l: LecturaFranco): string | null {
  if (l.corta.length !== LINEAS_CORTA) return `la corta tiene ${l.corta.length} líneas`;
  const largas = [...l.corta, ...(l.alerta.motivo ? [l.alerta.motivo] : [])].filter((t) => t.length > MAX_CARACTERES_CORTA);
  if (largas.length) return `una línea pasa de ${MAX_CARACTERES_CORTA} caracteres (${largas[0].length})`;
  const dobles = [...l.corta, ...(l.alerta.motivo ? [l.alerta.motivo] : [])].filter((t) => !unaFrase(t));
  if (dobles.length) return "una línea tiene más de una frase";
  return null;
}

/** Sin ninguna foto que se pueda ver (20-nov-2026, decisión de Fabrizio): la publicación no trae fotos, o todas las que nombra ya no
 *  existen en la fuente (b20a316f: 19 de 19 en 404). Para la persona es un depto sin fotos: alerta grave, que no se recomienda como
 *  alternativa, igual que el 7022b35a. La pone el CÓDIGO, no el modelo (al modelo se le dice que no hable de fotos). */
export const MOTIVO_SIN_FOTOS = "La publicación no tiene ninguna foto del interior que se pueda ver.";
export function conAlertaSinFotos(l: LecturaFranco): LecturaFranco {
  const resto = l.corta.filter((t) => t !== MOTIVO_SIN_FOTOS && t !== l.alerta.motivo);
  return { ...l, alerta: { nivel: "grave", motivo: MOTIVO_SIN_FOTOS }, corta: [MOTIVO_SIN_FOTOS, ...resto].slice(0, LINEAS_CORTA) };
}

/** ¿Se puede recomendar como alternativa? Con alerta grave, no. */
export const recomendable = (l: Pick<LecturaFranco, "alerta"> | null | undefined) => l?.alerta.nivel !== "grave";
/** ¿La alerta va primero (en el elegido y en sus detalles)? */
export const alertaPrimero = (l: Pick<LecturaFranco, "alerta"> | null | undefined) => !!l && l.alerta.nivel !== "ninguna" && !!l.alerta.motivo;

/** Las líneas de la corta para el elegido: si la alerta va arriba en su bloque, no se repite como primera línea. */
export function cortaSinRepetirAlerta(l: LecturaFranco): string[] {
  return alertaPrimero(l) && l.corta.length > 1 ? l.corta.slice(1) : l.corta;
}

/** El elegido en el resultado (20-nov-2026, Fabrizio): UN bloque «Lo que ve Franco» con tres líneas; si hay alerta, es la primera
 *  (con su chip) y las otras dos son de la corta, sin repetirla. */
export function lineasElegido(l: LecturaFranco): string[] {
  return (alertaPrimero(l) ? [l.alerta.motivo as string, ...cortaSinRepetirAlerta(l)] : l.corta).slice(0, 3);
}

/** Una alternativa (20-nov-2026, Fabrizio): una sola línea, la alerta si existe; si no, la primera de la corta. */
export function lineaAlternativa(l: LecturaFranco): string | null {
  return alertaPrimero(l) ? (l.alerta.motivo as string) : l.corta[0] ?? null;
}

/** «**Cocina y baños renovados:** se arrienda tal como está.»: lo que va antes de los dos puntos, en negrita (lámina 3.2). */
export function partirLinea(t: string): { fuerte: string | null; resto: string } {
  const i = t.indexOf(":");
  return i > 0 && i < 70 ? { fuerte: t.slice(0, i + 1), resto: t.slice(i + 1) } : { fuerte: null, resto: t };
}
