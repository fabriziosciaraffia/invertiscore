// scripts/landing-deficit-monthly.ts
// SOLO LECTURA — calcula magnitudes monetarias del flujo negativo mensual
// para la línea técnica del landing s02 Problema:
//   "$XXX.XXX promedio al mes. $XX millones acumulados en 25 años."
//
// Metodología:
//   - Base: scraped_properties (TocToc) ventas + arriendos en 24 comunas Gran
//     Santiago. Mismo pipeline que scripts/landing-metrics-market.ts.
//   - Supuestos típicos: pie 20%, plazo 25 años, tasa 4.5% UF, gastos 31.7%
//     del arriendo bruto, precio ajustado -10% (publicado → transacción).
//   - Flujo mensual = arriendo - gastos - dividendo.
//   - Sobre los flujos NEGATIVOS calculamos: mean, P50, P25, P75, distribución
//     en buckets.
//   - Acumulado 25 años: a) flat (mensual × 300), b) con inflación 3% anual.

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: path.resolve(process.cwd(), '.env.local') });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const UF_CLP = 38800;

const COMUNAS_24 = new Set([
  'santiago', 'providencia', 'las-condes', 'nunoa', 'la-florida',
  'vitacura', 'lo-barnechea', 'san-miguel', 'macul', 'penalolen',
  'la-reina', 'estacion-central', 'independencia', 'recoleta',
  'maipu', 'puente-alto', 'san-joaquin', 'quinta-normal', 'conchali',
  'huechuraba', 'pedro-aguirre-cerda', 'cerrillos', 'la-granja',
  'el-bosque',
]);

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/ñ/g, 'n');
}

type ScrapedRow = {
  comuna: string | null;
  type: 'venta' | 'arriendo';
  precio: number;
  moneda: 'CLP' | 'UF';
  superficie_m2: number | null;
  dormitorios: number | null;
};

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (base + 1 < sorted.length) return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  return sorted[base];
}

function dividendo(creditoCLP: number, tasaAnual: number, plazoAnios: number): number {
  const r = tasaAnual / 100 / 12;
  const n = plazoAnios * 12;
  if (r === 0) return creditoCLP / n;
  return (creditoCLP * r) / (1 - Math.pow(1 + r, -n));
}

function fmtCLP(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CL');
}

(async () => {
  // ─── Cargar BASE ─────────────────────────────────
  const PAGE = 1000;
  let from = 0;
  const all: ScrapedRow[] = [];
  while (true) {
    const { data, error } = await sb
      .from('scraped_properties')
      .select('comuna, type, precio, moneda, superficie_m2, dormitorios')
      .eq('is_active', true)
      .gt('precio', 0)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as unknown as ScrapedRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const filtered = all.filter((r) => r.comuna && COMUNAS_24.has(slug(r.comuna)));
  const ventas = filtered.filter((r) => r.type === 'venta');
  const arriendos = filtered.filter((r) => r.type === 'arriendo');

  function toClp(r: ScrapedRow): number {
    return r.moneda === 'UF' ? r.precio * UF_CLP : r.precio;
  }
  function rentaClp(r: ScrapedRow): number {
    return r.moneda === 'UF' ? r.precio * UF_CLP : r.precio;
  }

  // ─── Arriendo mediano por (comuna, dorm) ─────────
  const arriendoBuckets = new Map<string, number[]>();
  for (const r of arriendos) {
    const k = `${slug(r.comuna!)}|${r.dormitorios ?? 'null'}`;
    if (!arriendoBuckets.has(k)) arriendoBuckets.set(k, []);
    arriendoBuckets.get(k)!.push(rentaClp(r));
  }
  const arriendoComunaGeneral = new Map<string, number[]>();
  for (const r of arriendos) {
    const k = slug(r.comuna!);
    if (!arriendoComunaGeneral.has(k)) arriendoComunaGeneral.set(k, []);
    arriendoComunaGeneral.get(k)!.push(rentaClp(r));
  }

  function medianaArriendo(comunaSlug: string, dorm: number | null): number | null {
    if (dorm != null) {
      const k = `${comunaSlug}|${dorm}`;
      const arr = arriendoBuckets.get(k);
      if (arr && arr.length >= 3) return quantile([...arr].sort((a, b) => a - b), 0.5);
    }
    const arrGen = arriendoComunaGeneral.get(comunaSlug);
    if (arrGen && arrGen.length >= 3) return quantile([...arrGen].sort((a, b) => a - b), 0.5);
    return null;
  }

  // ─── Calcular flujo por propiedad ────────────────
  const flujosMensuales: number[] = [];
  let skipped = 0;

  for (const v of ventas) {
    const comunaSlug = slug(v.comuna!);
    const precioCLP = toClp(v);
    if (!precioCLP || precioCLP < 10_000_000 || precioCLP > 5_000_000_000) {
      skipped++;
      continue;
    }
    const arriendoMes = medianaArriendo(comunaSlug, v.dormitorios ?? null);
    if (arriendoMes == null || arriendoMes <= 0) {
      skipped++;
      continue;
    }
    const precioAjustado = precioCLP * 0.90;
    const credito = precioAjustado * 0.8;
    const div = dividendo(credito, 4.5, 25);
    const gastosMensuales = arriendoMes * 0.317;
    const flujo = arriendoMes - gastosMensuales - div;
    if (Math.abs(flujo) > 50_000_000) {
      skipped++;
      continue;
    }
    flujosMensuales.push(flujo);
  }

  console.log('=== BASE ===');
  console.log(`Ventas procesadas:           ${ventas.length}`);
  console.log(`Arriendos en pool:           ${arriendos.length}`);
  console.log(`Flujos calculados:           ${flujosMensuales.length}`);
  console.log(`Skipped (sin pareo / outlier): ${skipped}`);
  console.log('');

  const nTot = flujosMensuales.length;
  const negativos = flujosMensuales.filter((v) => v < 0);
  const positivos = flujosMensuales.filter((v) => v >= 0);
  const pctNeg = (negativos.length / nTot) * 100;
  const pctPos = (positivos.length / nTot) * 100;

  console.log('=== % NEGATIVO vs POSITIVO ===');
  console.log(`Negativos: ${negativos.length} (${pctNeg.toFixed(1)}%)`);
  console.log(`Positivos: ${positivos.length} (${pctPos.toFixed(1)}%)`);
  console.log('');

  // ─── Stats sobre flujos NEGATIVOS (aportes mensuales) ───
  const aportes = negativos.map((v) => -v); // convertir a positivo (= aporte de bolsillo)
  const sortedAportes = [...aportes].sort((a, b) => a - b);
  const meanAporte = aportes.reduce((a, b) => a + b, 0) / aportes.length;
  const p25 = quantile(sortedAportes, 0.25);
  const p50 = quantile(sortedAportes, 0.5);
  const p75 = quantile(sortedAportes, 0.75);
  const p90 = quantile(sortedAportes, 0.9);

  console.log('=== APORTE MENSUAL (sobre flujos negativos) ===');
  console.log(`n=${aportes.length}`);
  console.log(`Promedio:   ${fmtCLP(meanAporte)}`);
  console.log(`Mediana:    ${fmtCLP(p50)}`);
  console.log(`P25:        ${fmtCLP(p25)}`);
  console.log(`P75:        ${fmtCLP(p75)}`);
  console.log(`P90:        ${fmtCLP(p90)}`);
  console.log('');

  // ─── Distribución por bucket ──────────────────────
  console.log('=== DISTRIBUCIÓN (sobre TOTAL de flujos, no solo negativos) ===');
  const buckets = [
    { label: 'Negativo > $500K  (pone más de $500K/mes)',          test: (v: number) => v < -500_000 },
    { label: 'Negativo $200K-$500K (pone $200K-$500K/mes)',         test: (v: number) => v >= -500_000 && v < -200_000 },
    { label: 'Negativo $0-$200K  (pone hasta $200K/mes)',           test: (v: number) => v >= -200_000 && v < 0 },
    { label: 'Positivo o cero  (flujo positivo)',                    test: (v: number) => v >= 0 },
  ];
  for (const b of buckets) {
    const n = flujosMensuales.filter(b.test).length;
    const pctOfTot = (n / nTot) * 100;
    console.log(`  ${b.label}: ${n} (${pctOfTot.toFixed(1)}% del total)`);
  }
  console.log('');

  // ─── Aporte mensual ponderado usando buckets ─────
  console.log('=== APORTE PONDERADO USANDO BUCKETS (sólo negativos, sobre subpoblación) ===');
  // Para cada bucket, usamos el promedio dentro del bucket y la fracción
  // dentro de la subpoblación negativa.
  const negSubTot = negativos.length;
  const subBuckets = [
    { label: '>500K',  test: (v: number) => v < -500_000 },
    { label: '200-500K', test: (v: number) => v >= -500_000 && v < -200_000 },
    { label: '0-200K',  test: (v: number) => v >= -200_000 && v < 0 },
  ];
  let weighted = 0;
  for (const b of subBuckets) {
    const sub = negativos.filter(b.test);
    if (sub.length === 0) continue;
    const meanInBucket = -(sub.reduce((a, c) => a + c, 0) / sub.length);
    const weight = sub.length / negSubTot;
    const pctOfNeg = (sub.length / negSubTot) * 100;
    weighted += meanInBucket * weight;
    console.log(
      `  ${b.label}: n=${sub.length} (${pctOfNeg.toFixed(1)}% de negativos), ` +
      `mean en bucket = ${fmtCLP(meanInBucket)}`,
    );
  }
  console.log(`  → Promedio ponderado: ${fmtCLP(weighted)}`);
  console.log('');

  // ─── Acumulado 25 años ────────────────────────────
  const meses = 25 * 12;
  const acumFlat = meanAporte * meses;

  // Con inflación 3% anual: el aporte mensual crece anualmente con inflación
  // si asumimos que se ajusta. Modelo: año 1 aporte = meanAporte, año 2 =
  // meanAporte * 1.03, ... Suma = meanAporte * 12 * sum(1.03^k for k=0..24)
  const inflAnual = 0.03;
  let acumInfl = 0;
  for (let anio = 0; anio < 25; anio++) {
    acumInfl += meanAporte * 12 * Math.pow(1 + inflAnual, anio);
  }

  console.log('=== ACUMULADO 25 AÑOS ===');
  console.log(`Aporte mensual base:       ${fmtCLP(meanAporte)}`);
  console.log(`Acumulado FLAT (300 cuotas iguales):       ${fmtCLP(acumFlat)}`);
  console.log(`  → en millones:                              ${(acumFlat / 1_000_000).toFixed(1)}M`);
  console.log(`Acumulado CON INFLACIÓN 3% anual:           ${fmtCLP(acumInfl)}`);
  console.log(`  → en millones:                              ${(acumInfl / 1_000_000).toFixed(1)}M`);
  console.log('');

  // ─── Mediana (más robusta a outliers) ─────────────
  const acumFlatMediana = p50 * meses;
  let acumInflMediana = 0;
  for (let anio = 0; anio < 25; anio++) {
    acumInflMediana += p50 * 12 * Math.pow(1 + inflAnual, anio);
  }
  console.log('=== ACUMULADO 25 AÑOS (usando MEDIANA en vez de mean) ===');
  console.log(`Aporte mensual MEDIANO:    ${fmtCLP(p50)}`);
  console.log(`Acumulado FLAT (con MEDIANA):              ${fmtCLP(acumFlatMediana)}  (${(acumFlatMediana / 1_000_000).toFixed(1)}M)`);
  console.log(`Acumulado INFLACIÓN 3% (con MEDIANA):      ${fmtCLP(acumInflMediana)}  (${(acumInflMediana / 1_000_000).toFixed(1)}M)`);
  console.log('');

  // ─── Sugerencias copy ─────────────────────────────
  console.log('=== SUGERENCIA COPY ===');
  const aporteRedondo = Math.round(meanAporte / 10_000) * 10_000;
  const acumMillones = Math.round(acumFlat / 1_000_000);
  console.log(`"${fmtCLP(aporteRedondo)} promedio al mes. $${acumMillones} millones acumulados en 25 años."`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
