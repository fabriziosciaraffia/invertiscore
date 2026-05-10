// QA del prompt STR post-fix (Prompt A — voz tuteo).
// Genera 1 output usando SYSTEM_PROMPT_STR + userPrompt actualizados, sin
// tocar la base. Guarda el JSON en audit/str-voice-design/ y corre regex de
// voseo sobre el resultado para validar que la salida está limpia.
//
// Uso: npx tsx scripts/qa-str-prompt-tuteo.ts [analysisId]
// Default: 8e006a98 (seed Providencia VIABLE — el output más rico).

import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT_STR } from '../src/lib/ai-generation-str';
import type { ShortTermResult, STRVerdict } from '../src/lib/engines/short-term-engine';
import type { FrancoScoreSTR } from '../src/lib/engines/short-term-score';
import type { AIAnalysisSTRv2 } from '../src/lib/types';

config({ path: path.resolve(process.cwd(), '.env.local') });

const ANALYSIS_ID = process.argv[2] ?? '8e006a98-4005-4178-b043-c85d1081a3f3';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function fmtCLP(n: number) { return '$' + Math.round(Math.abs(n)).toLocaleString('es-CL'); }
function fmtUF(n: number) { return 'UF ' + (Math.round(n * 10) / 10).toLocaleString('es-CL'); }
function fmtCLPSigned(n: number) {
  if (n === 0) return '$0';
  const abs = Math.abs(Math.round(n));
  const f = '$' + abs.toLocaleString('es-CL');
  return n < 0 ? '-' + f : f;
}

const RX = {
  voseoAS: /\b\w+ás\b/gi,
  voseoES: /\b\w+és\b/gi,
  voseoIS: /\b\w+ís\b/gi,
  imperVos: /\b(comprá|mirá|dale|pegá|andá|fijate|elegí|pedí|poné|hacé|hací|vení|sentate|empezá|cerrá|abrí|sumá|restá|negociá|verificá|cotizá|chequeá|completá|aplicá|devolvé|releé|conjugá|sugerí|usá|dejá|mencionalo|copialo)\b/gi,
  vos: /\bvos\b/gi,
  chilenismos: /\b(cachái|wei?ón|po\b|bacán|fome|filete|altiro)\b/gi,
};

const FALSE_POS = {
  voseoAS: /^(además|atrás|jamás|demás|quizás|verás|verán|allá|acá|estarás|tendrás|podrás|darás|harás|querrás|sabrás|saldrás|vendrás|irás|serás|comerás|vivirás|hablarás|recibirás|comprarás|operarás|asumirás|aprenderás|escucharás|gastarás|invertirás|trabajarás|firmarás|llegarás|necesitarás|partirás|renunciarás|terminarás|ganarás|perderás|alcanzarás)$/i,
  voseoES: /^(después|interés|francés|inglés|cortés|revés|través|estrés|también|según|mes|pies|res)$/i,
  voseoIS: /^(país|raíz|maíz)$/i,
  vos: /^(vosotros|voseo|voz)$/i,
};

interface Match { kind: keyof typeof RX; word: string; }

function scanText(text: string): Match[] {
  const matches: Match[] = [];
  for (const k of Object.keys(RX) as (keyof typeof RX)[]) {
    const re = RX[k];
    re.lastIndex = 0;
    const found = text.match(re) ?? [];
    for (const m of found) {
      const w = m.toLowerCase();
      const fpRe = (FALSE_POS as Record<string, RegExp | undefined>)[k];
      if (fpRe && fpRe.test(w)) continue;
      matches.push({ kind: k, word: m });
    }
  }
  return matches;
}

function scanObject(obj: unknown, p: string, out: { path: string; matches: Match[] }[]) {
  if (typeof obj === 'string') {
    const ms = scanText(obj);
    if (ms.length > 0) out.push({ path: p, matches: ms });
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => scanObject(v, `${p}[${i}]`, out));
    return;
  }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      scanObject(v, p ? `${p}.${k}` : k, out);
    }
  }
}

async function main() {
  console.log(`=== QA prompt STR post-fix · análisis ${ANALYSIS_ID} ===\n`);

  // 1. Cargar análisis (READ-ONLY)
  const { data: analysis, error: loadErr } = await supabase
    .from('analisis')
    .select('*')
    .eq('id', ANALYSIS_ID)
    .single();
  if (loadErr) throw loadErr;
  if (!analysis) throw new Error('Análisis no encontrado');

  const inp = (analysis.input_data as Record<string, unknown> | null) ?? {};
  const r = analysis.results as ShortTermResult & { francoScore?: FrancoScoreSTR };
  if (!r || !r.escenarios) throw new Error('Análisis sin results 4b/4c válidos');

  // 2. Construir userPrompt — mismo contenido que route.ts post-fix
  const base = r.escenarios.base;
  const cons = r.escenarios.conservador;
  const agr = r.escenarios.agresivo;
  const comp = r.comparativa;
  const precioCompraCLP = (inp.precioCompra as number) ?? 0;
  const precioCompraUF = (inp.precioCompraUF as number) ?? 0;
  const superficie = (inp.superficie as number) ?? 0;
  const dormitorios = (inp.dormitorios as number) ?? 0;
  const banos = (inp.banos as number) ?? 0;
  const direccion = (inp.direccion as string) ?? '';
  const comuna = (analysis.comuna as string) ?? '';
  const piePct = Math.round(((inp.piePercent as number) ?? 0.2) * 100);
  const tasa = ((inp.tasaCredito as number) ?? 0.045) * 100;
  const plazo = (inp.plazoCredito as number) ?? 25;
  const modoGestion = (inp.modoGestion as string) ?? 'auto';
  const comisionPct = modoGestion === 'auto' ? 3 : Math.round(((inp.comisionAdministrador as number) ?? 0.2) * 100);
  const regulacion = (inp.edificioPermiteAirbnb as string) ?? (inp.regulacionEdificio as string) ?? 'no_seguro';
  const costoAmoblamiento = (inp.costoAmoblamiento as number) ?? 0;
  const dividendo = r.dividendoMensual;
  const capitalInv = r.capitalInvertido;
  const pieCLP = Math.round(precioCompraCLP * ((inp.piePercent as number) ?? 0.2));

  const fScore = r.francoScore;
  const score = fScore?.score ?? 50;
  const engineSignal: STRVerdict = (fScore?.veredicto as STRVerdict) ?? r.veredicto;

  const projY10 = r.projections && r.projections.length >= 10 ? r.projections[9] : null;
  const exit = r.exitScenario;

  const userPrompt = `Analiza esta inversión inmobiliaria en renta corta (Airbnb). Aplica doctrina §1-§13 del system prompt y devuelve el JSON v2.

=== DATOS DE LA PROPIEDAD ===
Dirección: ${direccion || '—'}
Comuna: ${comuna}
Superficie: ${superficie} m²
Dormitorios: ${dormitorios}, Baños: ${banos}
Precio compra: ${fmtUF(precioCompraUF)} (${fmtCLP(precioCompraCLP)})
Pie: ${piePct}% = ${fmtCLP(pieCLP)}
Tasa crédito: ${tasa.toFixed(1)}%, Plazo: ${plazo} años
Dividendo: ${fmtCLP(dividendo)}/mes
Capital invertido inicial: ${fmtCLP(capitalInv)}
Modo gestión seleccionado: ${modoGestion} (comisión: ${comisionPct}%)
Edificio permite Airbnb: ${regulacion}
Amoblamiento: ${fmtCLP(costoAmoblamiento)}

=== FRANCO SCORE STR: ${score}/100 ===
engineSignal del motor: ${engineSignal}

=== ESCENARIO BASE (P50) ===
Revenue anual: ${fmtCLP(base.revenueAnual)}
ADR: ${fmtCLP(base.adrReferencia)}/noche, Ocupación: ${Math.round(base.ocupacionReferencia * 100)}%
Ingreso bruto mensual: ${fmtCLP(base.ingresoBrutoMensual)}
NOI mensual: ${fmtCLPSigned(base.noiMensual)}
Flujo de caja mensual: ${fmtCLPSigned(base.flujoCajaMensual)}
CAP rate: ${(base.capRate * 100).toFixed(2)}%
Cash-on-Cash: ${(base.cashOnCash * 100).toFixed(1)}%

=== ESCENARIOS POR PERCENTIL ===
Conservador (P25): NOI ${fmtCLPSigned(cons.noiMensual)}/mes, Flujo ${fmtCLPSigned(cons.flujoCajaMensual)}/mes
Base (P50):        NOI ${fmtCLPSigned(base.noiMensual)}/mes, Flujo ${fmtCLPSigned(base.flujoCajaMensual)}/mes
Agresivo (P75):    NOI ${fmtCLPSigned(agr.noiMensual)}/mes, Flujo ${fmtCLPSigned(agr.flujoCajaMensual)}/mes

=== COMPARATIVA STR vs LTR ===
LTR: NOI ${fmtCLPSigned(comp.ltr.noiMensual)}/mes, Flujo ${fmtCLPSigned(comp.ltr.flujoCaja)}/mes
STR base: NOI ${fmtCLPSigned(base.noiMensual)}/mes, Flujo ${fmtCLPSigned(base.flujoCajaMensual)}/mes
Sobre-renta: ${fmtCLPSigned(comp.sobreRenta)}/mes (${comp.sobreRentaPct >= 0 ? '+' : ''}${Math.round(comp.sobreRentaPct * 100)}%)
Payback amoblamiento: ${comp.paybackMeses > 0 ? comp.paybackMeses + ' meses' : 'no se recupera'}

=== BREAK-EVEN + RAMP-UP ===
Revenue anual necesario: ${fmtCLP(r.breakEvenRevenueAnual)} (${Math.round(r.breakEvenPctDelMercado * 100)}% del P50)
Pérdida ramp-up 3 meses: ${fmtCLP(r.perdidaRampUp)}

=== PROYECCIÓN LARGO PLAZO ===
${projY10 && exit ? `Patrimonio neto al año ${exit.yearVenta}: ${fmtCLP(projY10.patrimonioNeto)}
Ganancia neta al vender año ${exit.yearVenta}: ${fmtCLPSigned(exit.gananciaNeta)}
TIR @ ${exit.yearVenta} años: ${exit.tirAnual.toFixed(1)}%
Multiplicador capital: ${exit.multiplicadorCapital.toFixed(2)}x` : '(no disponible)'}

═══════════════════════════════════════════════════════════════════
INSTRUCCIÓN FINAL
═══════════════════════════════════════════════════════════════════

1. Aplica la doctrina §1-§13 del system prompt sin excepción.
2. \`engineSignal\` = "${engineSignal}" — cópialo EXACTO al JSON output.
3. \`francoVerdict\` por default = "${engineSignal}". Diverge solo si §7 lo justifica. Si diverge, completa \`francoVerdictRationale\`.
4. Cierre obligatorio en \`riesgos.cajaAccionable\` con posición personal (§9), NO checklist.
5. Voz tuteo neutro chileno (§10). Ningún verbo voseo (-ás/-és/-ís).
6. \`riesgos.contenido\`: 3 riesgos en prosa, separados por \\n\\n. Sin bullets, sin **bold**.

Responde SOLO con el JSON.`;

  console.log('  - llamando Anthropic claude-sonnet-4 (DRY-RUN, sin escribir BD)...');
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{ role: 'user', content: userPrompt }],
    system: SYSTEM_PROMPT_STR,
  });

  const rawText = msg.content[0].type === 'text' ? msg.content[0].text : '';
  console.log('  - respuesta length:', rawText.length, 'chars');

  let aiResult: AIAnalysisSTRv2;
  try {
    let cleanText = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    const f = cleanText.indexOf('{');
    const l = cleanText.lastIndexOf('}');
    if (f !== -1 && l !== -1) cleanText = cleanText.substring(f, l + 1);
    cleanText = cleanText.replace(/,(\s*[}\]])/g, '$1');
    aiResult = JSON.parse(cleanText) as AIAnalysisSTRv2;
  } catch (e) {
    console.error('Parse error:', e);
    console.log('Raw output:', rawText.substring(0, 1500));
    process.exit(1);
  }

  if (!aiResult.engineSignal) aiResult.engineSignal = engineSignal;
  if (!aiResult.francoVerdict) aiResult.francoVerdict = aiResult.engineSignal;

  // 3. Guardar artefacto
  const outDir = path.resolve(process.cwd(), 'audit/str-voice-design');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `qa-tuteo-${ANALYSIS_ID}.json`);
  fs.writeFileSync(outFile, JSON.stringify(aiResult, null, 2));
  console.log('  - JSON persistido en:', outFile);

  // 4. Regex de voseo sobre el output
  const findings: { path: string; matches: Match[] }[] = [];
  scanObject(aiResult, '', findings);

  console.log('\n=== REGEX SCAN — voseo / chilenismos ===');
  if (findings.length === 0) {
    console.log('  ✓ 0 matches (output limpio)');
  } else {
    for (const f of findings) {
      console.log(`  ✗ ${f.path}: ${f.matches.map((m) => `${m.kind}:${m.word}`).join(', ')}`);
    }
  }

  // 5. Pegar 2 párrafos para review humano
  console.log('\n=== HEADLINES ===');
  console.log('  CLP:', aiResult.siendoFrancoHeadline_clp);
  console.log('  UF :', aiResult.siendoFrancoHeadline_uf);

  console.log('\n=== conviene.respuestaDirecta ===');
  console.log(aiResult.conviene?.respuestaDirecta);

  console.log('\n=== riesgos.cajaAccionable (cierre) ===');
  console.log(aiResult.riesgos?.cajaAccionable);

  console.log('\n=== preguntas (verifica que no hay voseo hardcoded) ===');
  console.log('  conviene:', aiResult.conviene?.pregunta);
  console.log('  rentabilidad:', aiResult.rentabilidad?.pregunta);
  console.log('  vsLTR:', aiResult.vsLTR?.pregunta);
  console.log('  operacion:', aiResult.operacion?.pregunta);
  console.log('  largoPlazo:', aiResult.largoPlazo?.pregunta);
  console.log('  riesgos:', aiResult.riesgos?.pregunta);

  console.log('\n=== VEREDICTOS ===');
  console.log('  engineSignal:', aiResult.engineSignal);
  console.log('  francoVerdict:', aiResult.francoVerdict);
  console.log('  rationale:', aiResult.francoVerdictRationale || '(coincide con motor — no diverge)');

  if (findings.length > 0) {
    console.log('\n✗ HAY MATCHES — el prompt sigue produciendo voseo. Revisar.');
    process.exit(1);
  }
  console.log('\n✓ QA pasa.');
}

main().catch((e) => { console.error(e); process.exit(1); });
