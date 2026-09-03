/**
 * Generador de la prosa de Franco por comuna (páginas /comunas/[slug]).
 *
 *   node --env-file=.env.local --import tsx scripts/data/generar-prosa-comunas.ts [--dry] [--todas] [--solo=slug]
 *
 * Genera UNA vez por comuna y persiste el párrafo junto al SNAPSHOT de las
 * cifras que narró (tabla `comuna_prosa`). Por defecto solo toca lo que hace
 * falta: comunas sin prosa, con bump de prompt, o con drift respecto de la foto
 * guardada. `--todas` fuerza el parque completo.
 *
 * NUNCA corre en render. La página lee la fila; si no hay, cae a su síntesis
 * calculada, que dice menos pero no miente.
 *
 * Costo: ~25 comunas × (~900 tokens in + ~200 out) con CLAUDE_MODEL. El lote
 * completo son centavos; el riesgo real no es la plata sino el drift
 * prosa↔números, que es lo que resuelve el snapshot.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { CLAUDE_MODEL } from "@/lib/ai-config";
import { COMUNAS_ROSTER } from "@/lib/data/comunas-roster";
import { getComunaStats, tipologiaLider, fmtCLP, type ComunaStats } from "@/lib/data/comunas-seo";
import {
  PROMPT_VERSION_COMUNA,
  detectarDrift,
  getTodasLasProsas,
  snapshotDe,
  validarCoherenciaNumerica,
  validarFuenteEstimada,
  validarRolesDeCifras,
  validarVeredictoRango,
} from "@/lib/data/comuna-prosa";
import { coberturaPlusvaliaDe, PLUSVALIA_ESTIMADO } from "@/lib/plusvalia-estimado.gen";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const TODAS = args.includes("--todas");
const SOLO = args.find((a) => a.startsWith("--solo="))?.split("=")[1];

const anthropic = new Anthropic();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─────────────────────────────────────────────────────────────────────────
// Prompt
// ─────────────────────────────────────────────────────────────────────────

const SYSTEM = `Eres Franco: análisis de inversión inmobiliaria en Chile, honesto y directo.

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
- El universo con que se compara la muestra son las comunas publicadas que te
  dice el bloque de datos, no el país ni la región. Así se hace bien: "la
  muestra más grande de las 25 comunas".
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

function bloqueDatos(stats: ComunaStats): string {
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
UNIVERSO DE COMPARACIÓN DE LA MUESTRA: las ${COMUNAS_ROSTER.length} comunas publicadas (esta y otras ${COMUNAS_ROSTER.length - 1}).
${plusvalia}`;
}

async function generar(
  stats: ComunaStats,
  instruccionExtra?: string
): Promise<{ texto: string; inTok: number; outTok: number }> {
  const contenido = instruccionExtra
    ? `${bloqueDatos(stats)}\n\n${instruccionExtra}`
    : bloqueDatos(stats);
  const r = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 400,
    system: SYSTEM,
    messages: [{ role: "user", content: contenido }],
  });
  const texto = r.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return { texto, inTok: r.usage.input_tokens, outTok: r.usage.output_tokens };
}

// ─────────────────────────────────────────────────────────────────────────
// Guards de salida: lo que no pasa, no se persiste.
// ─────────────────────────────────────────────────────────────────────────

const VOSEO = /\b(ten[ée]s|pod[ée]s|quer[ée]s|sab[ée]s|and[áa]|mir[áa]|fij[áa]te|vos)\b/i;
const CHILENISMOS = /\b(cach[áa]i|po'?|bac[áa]n|fome|weon|hueon)\b/i;

/**
 * Un párrafo que solo se pasó de largo merece una segunda pasada: el modelo se
 * para de forma sistemática cerca del techo y recortarlo no cambia el análisis.
 * Cualquier otra falla NO se reintenta — si inventó una cifra, insistir es
 * jugar a que la lotería salga bien, y esa comuna se queda sin prosa.
 */
function soloFallaElLargo(errores: string[]): boolean {
  return errores.length > 0 && errores.every((e) => e.startsWith("largo fuera de rango"));
}

function validar(texto: string, stats: ComunaStats): string[] {
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
  return errores;
}

// ─────────────────────────────────────────────────────────────────────────

async function main() {
  const prosas = await getTodasLasProsas();
  const objetivo = SOLO ? COMUNAS_ROSTER.filter((c) => c.slug === SOLO) : COMUNAS_ROSTER;
  if (SOLO && !objetivo.length) {
    console.error(`slug desconocido: ${SOLO}`);
    process.exit(1);
  }

  let generadas = 0, saltadas = 0, fallidas = 0, inTot = 0, outTot = 0;

  for (const c of objetivo) {
    const stats = await getComunaStats(c.slug);
    if (!stats) {
      console.log(`  ---  ${c.nombre.padEnd(18)} sin stats esta semana, no se genera`);
      saltadas++;
      continue;
    }
    const lider = tipologiaLider(stats.tipologias);
    const previa = prosas.get(c.slug) ?? null;
    const drift = detectarDrift(previa, stats, lider?.dorms ?? null);

    if (!TODAS && !drift.hayDrift) {
      console.log(`  skip ${c.nombre.padEnd(18)} al día`);
      saltadas++;
      continue;
    }

    const razon = TODAS && !drift.hayDrift ? "--todas" : drift.motivos.join(", ");
    process.stdout.write(`  gen  ${c.nombre.padEnd(18)} [${razon}] `);

    try {
      const primera = await generar(stats);
      inTot += primera.inTok;
      outTot += primera.outTok;
      let texto = primera.texto;
      let errores = validar(texto, stats);

      // UN solo reintento, y solo cuando el largo es lo único que falló. El
      // texto nuevo pasa por TODOS los guards otra vez: un párrafo más corto
      // puede introducir un error numérico que antes no estaba.
      if (soloFallaElLargo(errores)) {
        const palabras = texto.split(/\s+/).filter(Boolean).length;
        process.stdout.write(`(${palabras} palabras, reintento) `);
        const retry = await generar(
          stats,
          `Tu párrafo anterior tenía ${palabras} palabras y el máximo son 160. ` +
            `Escríbelo de nuevo más corto, entre 90 y 140 palabras, sin perder la ` +
            `recomendación del cierre. Mantén las mismas cifras exactas.`
        );
        inTot += retry.inTok;
        outTot += retry.outTok;
        const erroresRetry = validar(retry.texto, stats);
        if (erroresRetry.length === 0) {
          texto = retry.texto;
          errores = [];
        } else {
          errores = erroresRetry;
        }
      }

      if (errores.length) {
        console.log(`RECHAZADA — ${errores.join("; ")}`);
        console.log(`         "${texto.slice(0, 120)}…"`);
        fallidas++;
        continue;
      }
      if (DRY) {
        console.log(`OK (dry)\n         ${texto}`);
        generadas++;
        continue;
      }
      const { error } = await supabase.from("comuna_prosa").upsert(
        {
          slug: c.slug,
          comuna: stats.nombre,
          prosa: texto,
          snapshot: snapshotDe(stats, lider?.dorms ?? null),
          prompt_version: PROMPT_VERSION_COMUNA,
          modelo: CLAUDE_MODEL,
          actualizada_en: new Date().toISOString(),
        },
        { onConflict: "slug" }
      );
      if (error) {
        console.log(`ERROR DB — ${error.message}`);
        fallidas++;
        continue;
      }
      console.log("OK");
      generadas++;
    } catch (e) {
      console.log(`ERROR — ${e instanceof Error ? e.message : String(e)}`);
      fallidas++;
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`  generadas ${generadas} · saltadas ${saltadas} · fallidas ${fallidas}${DRY ? "  (DRY: nada se escribió)" : ""}`);
  console.log(`  tokens: ${inTot} in · ${outTot} out`);
  if (fallidas > 0) process.exit(1);
}

main();
