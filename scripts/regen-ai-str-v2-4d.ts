// Ronda 4d — regenera ai_analysis v2 sobre el seed STR (8e006a98).
// Replica el path del endpoint sin pasar por auth: lee análisis, construye
// USER prompt con datos reales, llama Anthropic con SYSTEM_PROMPT_STR
// extraído de lib/, parsea JSON v2, persiste en BD.
//
// Uso: npx tsx scripts/regen-ai-str-v2-4d.ts <analysisId>

import { config } from 'dotenv';
import path from 'path';
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

async function main() {
  console.log('Regenerando ai_analysis v2 para:', ANALYSIS_ID);

  // 1. Limpiar ai_analysis previo
  const { error: clearErr } = await supabase
    .from('analisis')
    .update({ ai_analysis: null })
    .eq('id', ANALYSIS_ID);
  if (clearErr) throw clearErr;
  console.log('  - ai_analysis previo limpiado');

  // 2. Cargar análisis
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

  // 3. Construir USER prompt (mismo shape que el endpoint)
  const base = r.escenarios.base;
  const cons = r.escenarios.conservador;
  const agr = r.escenarios.agresivo;
  const comp = r.comparativa;
  const precioCompraCLP = (inp.precioCompra as number) ?? 0;
  const precioCompraUF = (inp.precioCompraUF as number) ?? 0;
  const superficie = (inp.superficie as number) ?? (analysis.superficie as number) ?? 0;
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

  const fs = r.francoScore;
  const score = fs?.score ?? 50;
  const engineSignal: STRVerdict = (fs?.veredicto as STRVerdict) ?? r.veredicto;

  const projY10 = r.projections && r.projections.length >= 10 ? r.projections[9] : null;
  const exit = r.exitScenario;

  const userPrompt = `Analiza esta inversión inmobiliaria en renta corta (Airbnb). Aplicá doctrina §1-§13 del system prompt y devolvé el JSON v2.

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

1. Aplicá la doctrina §1-§13 del system prompt sin excepción.
2. \`engineSignal\` = "${engineSignal}" — copialo EXACTO al JSON output.
3. \`francoVerdict\` por default = "${engineSignal}". Diverge solo si §7 lo justifica. Si diverge, completá \`francoVerdictRationale\`.
4. Cierre obligatorio en \`riesgos.cajaAccionable\` con posición personal (§9), NO checklist.
5. Voz tuteo neutro chileno (§10). Ningún verbo voseo (-ás/-és/-ís).
6. \`riesgos.contenido\`: 3 riesgos en prosa, separados por \\n\\n. Sin bullets, sin **bold**.

Responde SOLO con el JSON.`;

  // 4. Llamar Anthropic
  console.log('  - llamando Anthropic claude-sonnet-4...');
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{ role: 'user', content: userPrompt }],
    system: SYSTEM_PROMPT_STR,
  });

  const rawText = msg.content[0].type === 'text' ? msg.content[0].text : '';
  console.log('  - respuesta length:', rawText.length, 'chars');

  // 5. Parsear
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
    console.log('Raw output:', rawText.substring(0, 1000));
    process.exit(1);
  }

  if (!aiResult.engineSignal) aiResult.engineSignal = engineSignal;
  if (!aiResult.francoVerdict) aiResult.francoVerdict = aiResult.engineSignal;

  // 6. Persistir
  const { error: saveErr } = await supabase
    .from('analisis')
    .update({ ai_analysis: aiResult })
    .eq('id', ANALYSIS_ID);
  if (saveErr) throw saveErr;

  // 7. Validación schema v2
  const checks = {
    has_siendoFrancoHeadline_clp: typeof aiResult.siendoFrancoHeadline_clp === 'string',
    has_siendoFrancoHeadline_uf: typeof aiResult.siendoFrancoHeadline_uf === 'string',
    has_conviene_respuestaDirecta: typeof aiResult.conviene?.respuestaDirecta === 'string',
    has_rentabilidad_contenido: typeof aiResult.rentabilidad?.contenido === 'string',
    has_vsLTR_contenido: typeof aiResult.vsLTR?.contenido === 'string',
    has_operacion_contenido: typeof aiResult.operacion?.contenido === 'string',
    has_largoPlazo_contenido: typeof aiResult.largoPlazo?.contenido === 'string',
    has_riesgos_contenido: typeof aiResult.riesgos?.contenido === 'string',
    riesgos_3_blocks: (aiResult.riesgos?.contenido?.match(/\n\n+/g)?.length ?? 0) >= 2,
    engineSignal_eq_motor: aiResult.engineSignal === engineSignal,
    has_francoVerdict: typeof aiResult.francoVerdict === 'string',
  };

  console.log('\n=== SCHEMA v2 CHECKS ===');
  console.log(JSON.stringify(checks, null, 2));
  const allPass = Object.values(checks).every(Boolean);
  console.log('all_checks_pass:', allPass);

  console.log('\n=== HEADLINE ===');
  console.log('  CLP:', aiResult.siendoFrancoHeadline_clp);
  console.log('  UF :', aiResult.siendoFrancoHeadline_uf);

  console.log('\n=== VEREDICTO ===');
  console.log('  engineSignal:', aiResult.engineSignal);
  console.log('  francoVerdict:', aiResult.francoVerdict);
  console.log('  rationale:', aiResult.francoVerdictRationale || '(coincide con motor — no diverge)');

  console.log('\n=== PERSISTIDO ===');
  console.log('  URL:', `http://localhost:3000/analisis/renta-corta/${ANALYSIS_ID}`);
  console.log('\nPara legibilidad, sample completo:');
  console.log(JSON.stringify(aiResult, null, 2).substring(0, 2500));

  if (!allPass) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
