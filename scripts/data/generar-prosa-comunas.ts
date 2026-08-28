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

REGLAS DE RAZONAMIENTO
- Eres asesor, no narrador. Si tu párrafo se puede reemplazar por la tabla sin
  perder nada, está mal. No recites los números: interpreta qué significan.
- Puedes citar UNA o DOS cifras, las que sostengan tu lectura. No más.
- Cierra con recomendación o posición, no con diagnóstico. La última frase le
  dice al lector qué hacer con esto o bajo qué condición le sirve la comuna.
- Solo puedes afirmar lo que está en los DATOS que recibes. Nada de metro,
  proyectos, barrios, seguridad, colegios ni plazos de obras: no los tienes.
- Si la muestra de una tipología es chica, no la celebres sin decirlo.

VOZ
- Español chileno, tuteo neutro. Nunca voseo ("tenés", "podés") ni chilenismos
  ("cachái", "po", "bacán") ni clichés de arranque ("Te voy a hablar claro").
- Sin adjetivos sin número: nada de "excelente zona" ni "gran oportunidad".
- Sin disclaimers de IA ni "consulta a un asesor".
- Separador de miles con punto. UF antes del número (UF 3.200).

FORMA
- 4 a 6 frases. Entre 70 y 110 palabras. Un solo párrafo, texto plano.
- No uses markdown, comillas de apertura ni títulos.
- Responde SOLO con el párrafo. Nada antes ni después.`;

function bloqueDatos(stats: ComunaStats): string {
  const s = stats.supuestos;
  const lider = tipologiaLider(stats.tipologias);
  const cubren = stats.tipologias.filter((t) => t.cubre).length;

  const filas = stats.tipologias
    .map((t) => {
      const equil = t.cubre
        ? `se paga sola; deja de hacerlo sobre UF ${t.precioCuotaUF} (${t.deltaPct.toFixed(1)}% sobre la mediana)`
        : `no se paga sola; se equilibraría a UF ${t.precioCuotaUF} (${Math.abs(t.deltaPct).toFixed(1)}% bajo la mediana)${t.pieNecesarioPct !== null ? ` o con pie de ${t.pieNecesarioPct}%` : ""}`;
      return `- ${t.dorms}D · muestra ${t.nArriendos} arriendos / ${t.nVentas} ventas${t.muestraChica ? " (MUESTRA CHICA)" : ""} · arriendo mediano ${fmtCLP(t.arriendoCLP)} · precio mediano UF ${t.ventaUF} (depto completo) · rentabilidad bruta ${t.rentabilidadBruta}% · cuota ${fmtCLP(t.dividendoCLP)} · diferencia ${t.brechaCLP >= 0 ? "+" : "−"}${fmtCLP(Math.abs(t.brechaCLP))} · ${equil}`;
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

TIPOLOGÍAS CON MUESTRA SUFICIENTE (${stats.tipologias.length} de 4; las que no aparecen no tienen datos suficientes y NO debes mencionarlas como si los tuvieran):
${filas}

RESUMEN: ${cubren} de ${stats.tipologias.length} tipologías se pagan solas.${lider ? ` La que encabeza es el ${lider.dorms}D.` : ""}
MUESTRA TOTAL: ${stats.procedencia.enCalculo} avisos entran en el cálculo, de ${stats.procedencia.activosTotales} activos.
${plusvalia}`;
}

async function generar(stats: ComunaStats): Promise<{ texto: string; inTok: number; outTok: number }> {
  const r = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 400,
    system: SYSTEM,
    messages: [{ role: "user", content: bloqueDatos(stats) }],
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

function validar(texto: string): string[] {
  const errores: string[] = [];
  const palabras = texto.split(/\s+/).filter(Boolean).length;
  if (palabras < 60 || palabras > 130) errores.push(`largo fuera de rango: ${palabras} palabras`);
  if (texto.includes("\n\n")) errores.push("más de un párrafo");
  if (/[*#_`]/.test(texto)) errores.push("trae markdown");
  if (VOSEO.test(texto)) errores.push("voseo");
  if (CHILENISMOS.test(texto)) errores.push("chilenismo");
  if (/como modelo de lenguaje|no constituye asesor|consulta a un (asesor|experto)/i.test(texto)) {
    errores.push("disclaimer de IA");
  }
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
      const { texto, inTok, outTok } = await generar(stats);
      inTot += inTok;
      outTot += outTok;
      const errores = validar(texto);
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
