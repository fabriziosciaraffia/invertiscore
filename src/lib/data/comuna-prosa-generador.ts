// ─────────────────────────────────────────────────────────────────────────
// La prosa de Franco por comuna: el prompt (v6), sus controles y la regeneración de las que quedaron desfasadas.
//
// Una sola lógica para el cron de los lunes (/api/cron/prosa-comunas, 20-oct-2026) y para el script que la corre a mano
// (scripts/data/generar-prosa-comunas.ts). Hasta el 20-oct-2026 vivía solo en el script y nadie lo corría: en siete
// semanas las 25 prosas quedaron desfasadas y en 10 una tipología había cambiado de lado.
//
// QUÉ SE REGENERA: solo lo que `detectarDrift` marca contra los números vivos (sin prosa, otro prompt, una cifra movida,
// una tipología dada vuelta...). Lo que está al día no se toca: ni una llamada al modelo.
// CÓMO: el párrafo pasa TODOS los controles (largo, voz, cifras que existen en los datos con su unidad, roles de cada
// cifra, estimados como rango, filas sin veredicto, comparaciones que cuadran con el puesto). Si no pasa, UN reintento
// con lo que se rechazó (decisión de Fabrizio); si vuelve a fallar, queda la prosa anterior —la página ya esconde la que
// contradice su tabla— y el cron lo cuenta como falla, que va al resumen del día de los crons.
// ─────────────────────────────────────────────────────────────────────────

import type Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL } from "@/lib/ai-config";
import { COMUNAS_ROSTER } from "@/lib/data/comunas-roster";
import { comparacionDe, fmtCLP, tipologiaLider, type ComunaStats } from "@/lib/data/comunas-seo";
import {
  PROMPT_VERSION_COMUNA,
  detectarDrift,
  snapshotDe,
  validarComparaciones,
  validarCoherenciaNumerica,
  validarFuenteEstimada,
  validarRolesDeCifras,
  validarVeredictoRango,
  type ComparacionComuna,
  type ProsaComuna,
  type SnapshotProsa,
} from "@/lib/data/comuna-prosa";
import { coberturaPlusvaliaDe, PLUSVALIA_ESTIMADO } from "@/lib/plusvalia-estimado.gen";

// ─────────────────────────────────────────────────────────────────────────
// Prompt
// ─────────────────────────────────────────────────────────────────────────

export const SYSTEM_PROSA_COMUNA = `Eres Franco: análisis de inversión inmobiliaria en Chile, honesto y directo.

Escribes UN párrafo para la página pública de una comuna. Quien lo lee está
decidiendo si invertir en departamentos ahí, y ya tiene arriba una tabla con
todas las cifras por tipología.

UNIDADES — REGLA DURA, SE VERIFICA DESPUÉS
- Cada cifra del bloque de datos viene YA ESCRITA como debe aparecer. Cópiala
  TAL CUAL, con su símbolo: los pesos con "$", las UF con "UF", los porcentajes
  con "%". No conviertas, no redondees, no inventes cifras intermedias.
- NUNCA mezcles las unidades. Los arriendos, las cuotas y las diferencias
  mensuales van en PESOS. Los precios de compra y los precios de equilibrio van
  en UF del departamento completo. Escribir una diferencia mensual en UF es un
  error grave: "UF 174.210 al mes" son unos siete mil millones de pesos.
- Un mismo concepto tiene UN solo valor en tu párrafo. Si mencionas el precio de
  equilibrio de una tipología dos veces, tiene que ser el mismo número.
- Toda cifra que escribas se compara contra los datos. La que no exista con su
  unidad hace que el párrafo se descarte entero.

ROLES — CADA CIFRA RESPONDE UNA PREGUNTA DISTINTA, NO SON INTERCAMBIABLES
- El PRECIO DE EQUILIBRIO es un precio de compra, en UF. Responde "¿a cuánto
  tendría que comprarlo?". Nunca es un porcentaje ni un monto mensual.
- El MARGEN (o colchón, u holgura) es un PORCENTAJE sobre o bajo la mediana.
  Responde "¿cuánto espacio tengo antes de que el número se rompa?". Nunca es
  un precio: escribir "un margen de UF 2.883" no significa nada.
- La BRECHA o DIFERENCIA es un monto MENSUAL en pesos. Responde "¿cuánto pongo
  o me sobra cada mes?".
- El PIE es un porcentaje del precio; la RENTABILIDAD BRUTA es un porcentaje
  anual. No se mezclan entre sí ni con los anteriores.
- Antes de escribir una cifra, verifica que el sustantivo que la introduce sea
  el que le corresponde. Un número correcto con el rol equivocado es tan falso
  como un número inventado.

REGLAS DE RAZONAMIENTO
- Eres asesor, no narrador. Si tu párrafo se puede reemplazar por la tabla sin
  perder nada, está mal. No recites los números: interpreta qué significan.
- Puedes citar DOS o TRES cifras, las que sostengan tu lectura. No más.
- Cierra con recomendación o posición, no con diagnóstico. La última frase le
  dice al lector qué hacer con esto o bajo qué condición le sirve la comuna.
- Solo puedes afirmar lo que está en los DATOS que recibes. Nada de metro,
  proyectos, barrios, seguridad, colegios ni plazos de obras: no los tienes.
- Si comparas esta comuna con las otras, la comparación sale del bloque
  COMPARACIÓN, que trae los puestos reales entre las comunas publicadas (no el
  país ni la región). Así se hace bien, con el puesto que trae el bloque: "la
  tercera muestra más grande de las 25 comunas", o "una de las 8 comunas, de 25,
  donde todas las tipologías se pagan solas". Lo que el bloque no trae, no lo
  comparas: no tienes los datos de las otras.
- Si la muestra de una tipología es chica, no la celebres sin decirlo.
- Una tipología marcada ARRIENDO ESTIMADO no tiene mediana propia: su arriendo
  sale del metro cuadrado de la comuna y viene como RANGO. Si la citas, dilo
  como estimación y con su rango. Así se hace bien: "El 3D no tiene arriendos
  publicados propios; con el metro cuadrado de la comuna se estima entre
  $[mínimo] y $[máximo], y ni con el techo de ese rango cubre la cuota".
  Así NO: "el 3D tiene una mediana de $[punto medio]".
- Una tipología marcada DEPENDE DEL ARRIENDO REAL no tiene veredicto: su rango
  de arriendo cruza la cuota. Nunca escribas que "se paga sola" ni que "no se
  paga sola". Así se hace bien: "El 3D queda en el filo: con el piso del rango
  el arriendo no cubre la cuota y con el techo sí, así que depende del
  arriendo real que consigas". Así NO: "el 3D no se paga solo por $[cifra]".

VOZ
- Español chileno, tuteo neutro. Nunca voseo ("tenés", "podés") ni chilenismos
  ("cachái", "po", "bacán") ni clichés de arranque ("Te voy a hablar claro").
- Sin adjetivos sin número: nada de "excelente zona" ni "gran oportunidad".
- Sin disclaimers de IA ni "consulta a un asesor".
- Separador de miles con punto. UF antes del número (UF 3.200).

FORMA
- 4 a 6 frases. Entre 90 y 150 palabras. Un solo párrafo, texto plano.
- No uses markdown, comillas de apertura ni títulos.
- Responde SOLO con el párrafo. Nada antes ni después.`;

/** Los puestos de `comparacionDe` (comunas-seo.ts), escritos para el modelo (v6). */
export function bloqueComparacion(c: ComparacionComuna): string {
  return `COMPARACIÓN CON LAS ${c.total} COMUNAS PUBLICADAS (de mayor a menor; 1 = la mayor):
- muestra (avisos que entran en el cálculo): puesto ${c.puestoMuestra} de ${c.total}
- rentabilidad bruta del título de la página: puesto ${c.puestoRentabilidad} de ${c.total}
- comunas donde todas las tipologías con veredicto se pagan solas: ${c.todasSePaganSolas.n} de ${c.total} (esta ${c.todasSePaganSolas.estaEsUna ? "es una de ellas" : "no es una de ellas"})
- ${c.plusvalia ? `plusvalía de diez años: puesto ${c.plusvalia.puesto} de ${c.plusvalia.de} comunas con serie` : "plusvalía: esta comuna no tiene serie, así que no la compares"}`;
}

export function bloqueDatos(stats: ComunaStats, comparacion: ComparacionComuna): string {
  const s = stats.supuestos;
  const lider = tipologiaLider(stats.tipologias);
  const cubren = stats.tipologias.filter((t) => t.veredictoFila === "sePagaSola").length;
  const dependen = stats.tipologias.filter((t) => t.veredictoFila === "dependeDelArriendoReal");
  const decididas = stats.tipologias.length - dependen.length;

  const filas = stats.tipologias
    .map((t) => {
      const pctTxt = (n: number) => `${Math.abs(n).toFixed(1).replace(".", ",")}%`;
      // Las UF se formatean igual que los pesos: el modelo copia lo que se le
      // da, y sin separador de miles salían "UF 2883" contra la regla de la casa.
      const ufTxt = (n: number) => `UF ${n.toLocaleString("es-CL")}`;
      const equil = t.cubre
        ? `deja de pagarse sola sobre ${ufTxt(t.precioCuotaUF)} [UF, PRECIO de compra] — el margen es ${pctTxt(t.deltaPct)} sobre la mediana [PORCENTAJE, no un precio]`
        : `se equilibraría a ${ufTxt(t.precioCuotaUF)} [UF, PRECIO de compra] — está ${pctTxt(t.deltaPct)} bajo la mediana [PORCENTAJE]${t.pieNecesarioPct !== null ? `, o con pie de ${t.pieNecesarioPct}%` : ""}`;
      return [
        t.referencia.fuente === "comunalPorM2"
          ? `- ${t.dorms}D (ARRIENDO ESTIMADO: solo ${t.nArriendos} arriendos propios publicados; se estima desde el m² de los ${t.referencia.nComunal} arriendos de la comuna) · ${t.nVentas} ventas publicadas`
          : `- ${t.dorms}D${t.muestraChica ? " (MUESTRA CHICA)" : ""} · ${t.nArriendos} arriendos / ${t.nVentas} ventas publicadas`,
        t.referencia.fuente === "comunalPorM2"
          ? `    arriendo estimado: entre ${fmtCLP(t.referencia.rangoCLP.min)} y ${fmtCLP(t.referencia.rangoCLP.max)} [PESOS, mensual, RANGO estimado: NO es una mediana]; la cuota y la diferencia de abajo usan el punto medio ${fmtCLP(t.arriendoCLP)}`
          : `    arriendo mediano: ${fmtCLP(t.arriendoCLP)} [PESOS, mensual]`,
        `    precio mediano: ${ufTxt(t.ventaUF)} [UF, depto completo]`,
        `    cuota del crédito: ${fmtCLP(t.dividendoCLP)} [PESOS, mensual]`,
        `    diferencia arriendo − cuota: ${t.brechaCLP >= 0 ? "sobran " : "faltan "}${fmtCLP(Math.abs(t.brechaCLP))} [PESOS, mensual]`,
        `    rentabilidad bruta: ${pctTxt(t.rentabilidadBruta)}`,
        t.referencia.fuente === "comunalPorM2"
          ? t.veredictoFila === "dependeDelArriendoReal"
            ? `    VEREDICTO: DEPENDE DEL ARRIENDO REAL — con el piso del rango (${fmtCLP(t.referencia.rangoCLP.min)}) el arriendo NO cubre la cuota (${fmtCLP(t.dividendoCLP)}); con el techo (${fmtCLP(t.referencia.rangoCLP.max)}) SÍ. No escribas que se paga sola ni que no se paga sola: escribe que depende del arriendo real. [equilibrio al punto medio: ${equil}]`
            : t.veredictoFila === "sePagaSola"
              ? `    SE PAGA SOLA incluso con el piso del rango (${fmtCLP(t.referencia.rangoCLP.min)} ≥ cuota ${fmtCLP(t.dividendoCLP)}); ${equil}`
              : `    NO se paga sola ni con el techo del rango (${fmtCLP(t.referencia.rangoCLP.max)} < cuota ${fmtCLP(t.dividendoCLP)}); ${equil}`
          : `    ${t.cubre ? "SE PAGA SOLA" : "NO se paga sola"}; ${equil}`,
      ].join("\n");
    })
    .join("\n");

  const cob = coberturaPlusvaliaDe(stats.nombre);
  const pv = PLUSVALIA_ESTIMADO[stats.nombre];
  const plusvalia =
    (cob === "trayectoria_gfk" || cob === "nivel_mas_ac" || cob === "solo_ac") && pv
      ? `Plusvalía observada ${pv.rangoHist}: ${pv.plusvalia10a}% acumulado (${pv.anualizada}% anual). Es historia, no proyección.`
      : `Sin serie histórica de plusvalía para esta comuna: NO afirmes nada sobre cómo se ha valorizado.`;

  return `COMUNA: ${stats.nombre}

SUPUESTOS DE LA CUOTA (los mismos que muestra la página): pie ${s.piePct}%, plazo ${s.plazoAnos} años, tasa ${s.tasaAnual}% anual. La cuota es SOLO el crédito: no incluye gastos comunes, contribuciones ni seguros.

TIPOLOGÍAS PUBLICADAS (${stats.tipologias.length} de 4; las que no aparecen no tienen ni arriendos propios ni muestra comunal para estimar, y NO debes mencionarlas como si los tuvieran):
${filas}

RESUMEN: ${cubren} de ${decididas} tipologías con veredicto se pagan solas${dependen.length ? `; ${dependen.map((t) => `${t.dorms}D`).join(" y ")} DEPENDE${dependen.length > 1 ? "N" : ""} del arriendo real y no cuenta${dependen.length > 1 ? "n" : ""} en ese conteo` : ""}.${lider ? ` La que encabeza es el ${lider.dorms}D.` : " Ninguna tipología encabeza: todas dependen del arriendo real."}
MUESTRA TOTAL: ${stats.procedencia.enCalculo} avisos entran en el cálculo, de ${stats.procedencia.activosTotales} activos.
${plusvalia}

${bloqueComparacion(comparacion)}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Controles de salida: lo que no pasa, no se persiste.
// ─────────────────────────────────────────────────────────────────────────

const VOSEO = /\b(ten[ée]s|pod[ée]s|quer[ée]s|sab[ée]s|and[áa]|mir[áa]|fij[áa]te|vos)\b/i;
const CHILENISMOS = /\b(cach[áa]i|po'?|bac[áa]n|fome|weon|hueon)\b/i;

/**
 * Un párrafo que solo se pasó de largo merece una segunda pasada: el modelo se
 * para de forma sistemática cerca del techo y recortarlo no cambia el análisis.
 * Cualquier otra falla NO se reintenta — si inventó una cifra, insistir es
 * jugar a que la lotería salga bien, y esa comuna se queda sin prosa.
 */
export function soloFallaElLargo(errores: string[]): boolean {
  return errores.length > 0 && errores.every((e) => e.startsWith("largo fuera de rango"));
}

export function validarProsa(texto: string, stats: ComunaStats, comparacion: ComparacionComuna): string[] {
  const errores: string[] = [];
  // Rango calibrado contra el comportamiento real: en el primer lote el modelo
  // se paró de forma sistemática en ~140 palabras y el techo de 130 rechazó 8
  // de 17 párrafos, incluidos Providencia y Ñuñoa — las dos comunas que este
  // trabajo existe para rescatar. Las de 135-145 no venían infladas, así que se
  // sube el techo en vez de pelear contra el modelo.
  const palabras = texto.split(/\s+/).filter(Boolean).length;
  if (palabras < 60 || palabras > 160) errores.push(`largo fuera de rango: ${palabras} palabras`);
  if (texto.includes("\n\n")) errores.push("más de un párrafo");
  if (/[*#_`]/.test(texto)) errores.push("trae markdown");
  if (VOSEO.test(texto)) errores.push("voseo");
  if (CHILENISMOS.test(texto)) errores.push("chilenismo");
  if (/como modelo de lenguaje|no constituye asesor|consulta a un (asesor|experto)/i.test(texto)) {
    errores.push("disclaimer de IA");
  }
  // Coherencia numérica: toda cifra en $, UF o % tiene que existir en los datos
  // CON SU UNIDAD. El guard de forma no veía los errores de unidad del primer
  // lote (Macul publicó una brecha mensual en UF; Cerrillos, dos precios de
  // equilibrio distintos para la misma tipología).
  errores.push(...validarCoherenciaNumerica(texto, stats));
  errores.push(...validarRolesDeCifras(texto));
  errores.push(...validarFuenteEstimada(texto, stats));
  errores.push(...validarVeredictoRango(texto, stats));
  errores.push(...validarComparaciones(texto, comparacion));
  return errores;
}

// ─────────────────────────────────────────────────────────────────────────
// La llamada al modelo
// ─────────────────────────────────────────────────────────────────────────

/** Una llamada: el system y el contenido, y lo que volvió. Inyectable: el tier PROSA-COMUNAS la reemplaza. */
export type GeneradorProsa = (system: string, contenido: string) => Promise<{ texto: string; inTok: number; outTok: number }>;

/** El generador de verdad: CLAUDE_MODEL, 400 tokens de salida. */
export function generadorAnthropic(cliente: Anthropic): GeneradorProsa {
  return async (system, contenido) => {
    const r = await cliente.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: contenido }],
    });
    const texto = r.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return { texto, inTok: r.usage.input_tokens, outTok: r.usage.output_tokens };
  };
}

/**
 * El reintento (20-oct-2026, decisión de Fabrizio): UNO, diciendo qué se rechazó. Si solo se pasó de largo, la misma
 * frase de siempre; si citó una cifra que no está en los datos o comparó sin el dato, la lista de lo rechazado. El
 * texto nuevo pasa por TODOS los controles otra vez: un párrafo corregido puede traer un error nuevo.
 */
export function instruccionDeReintento(texto: string, errores: string[]): string {
  const palabras = texto.split(/\s+/).filter(Boolean).length;
  if (soloFallaElLargo(errores)) {
    return (
      `Tu párrafo anterior tenía ${palabras} palabras y el máximo son 160. ` +
      `Escríbelo de nuevo más corto, entre 90 y 140 palabras, sin perder la ` +
      `recomendación del cierre. Mantén las mismas cifras exactas.`
    );
  }
  return (
    `Tu párrafo anterior se rechazó por esto: ${errores.join("; ")}. ` +
    `Escríbelo de nuevo corrigiéndolo: copia cada cifra tal cual viene en el bloque de datos, con su unidad, ` +
    `y si comparas con otras comunas usa solo lo que trae COMPARACIÓN. Entre 90 y 140 palabras, un solo párrafo.`
  );
}

// ─────────────────────────────────────────────────────────────────────────
// La regeneración
// ─────────────────────────────────────────────────────────────────────────

/** La fila que se guarda en `comuna_prosa`: el párrafo y la foto de las cifras que narró. */
export interface FilaProsaNueva {
  slug: string;
  comuna: string;
  prosa: string;
  snapshot: SnapshotProsa;
  prompt_version: number;
  modelo: string;
  actualizada_en: string;
}

export interface OpcionesRegeneracion {
  /** Las comunas del roster con sus números vivos (de ahí salen también los puestos de COMPARACIÓN). */
  parque: ComunaStats[];
  /** Las prosas guardadas, por slug. */
  prosas: Map<string, ProsaComuna>;
  generar: GeneradorProsa;
  /** Escribe la fila; si lanza, la prosa nueva no quedó y cuenta como rechazada. */
  guardar: (fila: FilaProsaNueva) => Promise<void>;
  /** Regenerar también las que están al día (un bump del prompt a mano). */
  todas?: boolean;
  /** Una sola comuna. */
  solo?: string | null;
  /** Un ensayo: genera y controla, no guarda. */
  dry?: boolean;
  concurrencia?: number;
  /** Corte voluntario (ms desde el comienzo): lo que no empezó queda para la próxima corrida. */
  presupuestoMs?: number;
  ahora?: () => number;
  /** Una línea por comuna terminada (el script la imprime). */
  informar?: (linea: string) => void;
}

export interface ResultadoRegeneracion {
  regeneradas: string[];
  /** Al día: no se tocaron. */
  intactas: string[];
  /** Rechazadas en los dos intentos (o sin guardar): quedó la anterior. */
  rechazadas: Array<{ slug: string; comuna: string; errores: string[] }>;
  /** Desfasadas que no alcanzaron a empezar dentro del presupuesto: quedan para la próxima. */
  sinTiempo: string[];
  /** Del roster sin números esta semana: no se generan. */
  sinStats: string[];
  llamadas: number;
  tokens: { entrada: number; salida: number };
  /** Lo generado en un ensayo, que no se guardó. */
  ensayo: Array<{ slug: string; texto: string }>;
}

/** Los dos intentos de UNA comuna: el texto que pasó todos los controles, o lo que se rechazó en el último. */
async function dosIntentos(o: OpcionesRegeneracion, stats: ComunaStats, comparacion: ComparacionComuna, r: ResultadoRegeneracion): Promise<{ texto: string; errores: string[] }> {
  const contenido = bloqueDatos(stats, comparacion);
  let texto = "";
  let errores: string[] = [];
  let caido = false;
  for (let intento = 0; intento < 2; intento++) {
    // El reintento dice qué se rechazó; si el modelo no respondió, se repite tal cual.
    const pedido = intento === 0 || caido ? contenido : `${contenido}\n\n${instruccionDeReintento(texto, errores)}`;
    try {
      const g = await o.generar(SYSTEM_PROSA_COMUNA, pedido);
      r.llamadas++;
      r.tokens.entrada += g.inTok;
      r.tokens.salida += g.outTok;
      texto = g.texto;
      caido = false;
      errores = validarProsa(texto, stats, comparacion);
    } catch (e) {
      caido = true;
      errores = [`el modelo no respondió: ${e instanceof Error ? e.message : String(e)}`.slice(0, 240)];
    }
    if (errores.length === 0) break;
  }
  return { texto, errores };
}

/**
 * Regenera las prosas desfasadas del roster (o una, o todas) y guarda las que pasan los controles. Nunca toca una que
 * está al día salvo con `todas`, y nunca pisa la anterior con una rechazada.
 */
export async function regenerarProsas(o: OpcionesRegeneracion): Promise<ResultadoRegeneracion> {
  const ahora = o.ahora ?? Date.now;
  const t0 = ahora();
  const r: ResultadoRegeneracion = { regeneradas: [], intactas: [], rechazadas: [], sinTiempo: [], sinStats: [], llamadas: 0, tokens: { entrada: 0, salida: 0 }, ensayo: [] };
  const porSlug = new Map(o.parque.map((s) => [s.slug, s]));
  const cola: Array<{ slug: string; stats: ComunaStats; liderDorms: number | null; motivos: string }> = [];
  for (const c of COMUNAS_ROSTER) {
    if (o.solo && c.slug !== o.solo) continue;
    const stats = porSlug.get(c.slug);
    if (!stats) { r.sinStats.push(c.slug); continue; }
    const liderDorms = tipologiaLider(stats.tipologias)?.dorms ?? null;
    const drift = detectarDrift(o.prosas.get(c.slug) ?? null, stats, liderDorms);
    if (!drift.hayDrift && !o.todas) { r.intactas.push(c.slug); continue; }
    cola.push({ slug: c.slug, stats, liderDorms, motivos: drift.hayDrift ? drift.motivos.join(", ") : "todas" });
  }

  let i = 0;
  await Promise.all(Array.from({ length: Math.max(1, o.concurrencia ?? 4) }, async () => {
    while (i < cola.length) {
      if (o.presupuestoMs !== undefined && ahora() - t0 > o.presupuestoMs) return;
      const c = cola[i++];
      const { texto, errores } = await dosIntentos(o, c.stats, comparacionDe(c.stats, o.parque), r);
      if (errores.length) {
        r.rechazadas.push({ slug: c.slug, comuna: c.stats.nombre, errores });
        o.informar?.(`  ✗    ${c.stats.nombre.padEnd(18)} [${c.motivos}] RECHAZADA dos veces, queda la anterior — ${errores.join("; ")}`);
        continue;
      }
      if (o.dry) {
        r.ensayo.push({ slug: c.slug, texto });
        r.regeneradas.push(c.slug);
        o.informar?.(`  gen  ${c.stats.nombre.padEnd(18)} [${c.motivos}] OK (ensayo, no se guarda)\n         ${texto}`);
        continue;
      }
      try {
        await o.guardar({
          slug: c.slug,
          comuna: c.stats.nombre,
          prosa: texto,
          snapshot: snapshotDe(c.stats, c.liderDorms),
          prompt_version: PROMPT_VERSION_COMUNA,
          modelo: CLAUDE_MODEL,
          actualizada_en: new Date(ahora()).toISOString(),
        });
        r.regeneradas.push(c.slug);
        o.informar?.(`  gen  ${c.stats.nombre.padEnd(18)} [${c.motivos}] OK`);
      } catch (e) {
        r.rechazadas.push({ slug: c.slug, comuna: c.stats.nombre, errores: [`no se pudo guardar: ${e instanceof Error ? e.message : String(e)}`.slice(0, 240)] });
        o.informar?.(`  ✗    ${c.stats.nombre.padEnd(18)} no se pudo guardar, queda la anterior`);
      }
    }
  }));
  r.sinTiempo = cola.slice(i).map((c) => c.slug);
  for (const lista of [r.regeneradas, r.sinTiempo]) lista.sort();
  r.rechazadas.sort((a, b) => a.slug.localeCompare(b.slug));
  return r;
}
