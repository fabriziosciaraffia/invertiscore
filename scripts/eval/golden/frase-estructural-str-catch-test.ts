// ─────────────────────────────────────────────────────────────────────────────
// FRASE ESTRUCTURAL STR · catch-test del fix del signo (02-sep-2026, espejo de LTR).
//
// `deltaMinimoFueraDeTope` es lo MÍNIMO que SÍ cruza; la frase decía "Ni cerrando un X%
// bajo el precio… llega". Sobre dos estructurales reales del parque, recomputados por la
// MISMA cadena que la página STR (recomputeShortTermForLegacy con UF y fecha congeladas y
// la mediana prefetcheada):
//   · 5dc42a82 Santiago — mínimo por PRECIO (−33,6%), pie 10% explorado, plazo 25
//   · d043ebfc Las Condes — mínimo por TARIFA (+38,3%), pie 20% explorado hasta 30% (T0
//     CONGELADO: vias), plazo 25
// Invariantes: sin "Ni cerrando/cobrando"; cita los dos topes; cita el mínimo como lo que
// recién cruzaría; plazo/pie/gestión solo si el builder los probó; cierre de brecha.
//
// Corre: node --env-file=.env.local --import tsx scripts/eval/golden/frase-estructural-str-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { recomputeShortTermForLegacy } from "../../../src/lib/analysis/recompute-short-term-for-legacy";
import { prefetchMedianaComunaVenta } from "../../../src/lib/api-helpers/analisis-pipeline";
import { DIST_STR_TOPE_ADR_PCT, topeStrParaVeredicto } from "../../../src/lib/distancia-veredicto-str-hallazgo";
import { DIST_PIE_TOPE_PCT, DIST_PLAZO_TOPE_ANIOS } from "../../../src/lib/distancia-veredicto-hallazgo";
import type { HallazgoDistanciaVeredicto } from "../../../src/lib/types";
import type { ShortTermResult } from "../../../src/lib/engines/short-term-engine";

const CASOS: { id: string; dmPalanca: "precio" | "adr" }[] = [
  { id: "5dc42a82-69d8-4aeb-84c8-1e8b908ca474", dmPalanca: "precio" },
  { id: "d043ebfc-b8e0-491f-abae-118f048933c9", dmPalanca: "adr" },
];
const fmtPct = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  const fallas: string[] = [];
  for (const caso of CASOS) {
    const tag = caso.id.slice(0, 8);
    const f = (m: string) => fallas.push(`${tag} · ${m}`);
    const { data, error } = await sb.from("analisis").select("input_data, results, created_at").eq("id", caso.id).single();
    if (error || !data) { f(`no cargó: ${error?.message}`); continue; }
    const input = data.input_data as Record<string, unknown> | null;
    const persisted = data.results as ShortTermResult | null;
    if (!input || !persisted) { f("sin input o results"); continue; }
    const precioUF = Number(input.precioCompraUF) || 0;
    const precioCLP = Number(input.precioCompra) || 0;
    const uf = precioUF > 0 ? precioCLP / precioUF : 39000;
    const mediana = await prefetchMedianaComunaVenta(
      sb,
      {
        comuna: (input.comuna as string) ?? "",
        superficie: Number(input.superficieUtil) || 0,
        dormitorios: Number(input.dormitorios) || 0,
        esNuevo: input.tipoPropiedad === "nuevo",
        antiguedad: typeof input.antiguedad === "number" ? input.antiguedad : undefined,
      },
      uf,
    );
    const r = recomputeShortTermForLegacy(input, persisted, uf, new Date(data.created_at), mediana) ?? persisted;
    const dv = ((r.hallazgos ?? []) as { id: string }[]).find((h) => h.id === "distancia_veredicto") as HallazgoDistanciaVeredicto | undefined;
    if (!dv) { f("sin distancia_veredicto"); continue; }
    const v = dv.valor;
    const fr = dv.fraseCanonica;
    console.log(`\n── ${tag} · ${v.veredictoBase} · estructural=${v.esEstructural} · dm=${v.deltaMinimoFueraDeTope?.palanca} ${v.deltaMinimoFueraDeTope?.deltaPct} · plazo ${input.plazoCredito} · pie ${v.piePctActual} · pieExplorado=${v.pieEsPalanca}\n   ${fr}`);
    if (!v.esEstructural) { f("debía ser estructural"); continue; }
    if (/Ni cerrando|Ni cobrando/.test(fr)) f("sigue con el signo invertido");
    const tope = topeStrParaVeredicto(v.veredictoBase);
    if (!fr.includes(`hasta −${fmtPct(tope)}% bajo el precio`)) f(`no cita el tope del precio −${tope}%`);
    if (!fr.includes(`hasta +${fmtPct(DIST_STR_TOPE_ADR_PCT)}% más por noche`)) f(`no cita el tope de la tarifa +${DIST_STR_TOPE_ADR_PCT}%`);
    const dm = v.deltaMinimoFueraDeTope;
    if (!dm) f("el caso debía traer mínimo fuera de tope");
    else {
      if (dm.palanca !== caso.dmPalanca) f(`mínimo por ${dm.palanca}, se esperaba ${caso.dmPalanca}`);
      const cifra = fmtPct(Math.abs(dm.deltaPct));
      const esperado = dm.palanca === "precio" ? `recién con −${cifra}% de precio` : `recién cobrando +${cifra}% por noche`;
      if (!fr.includes(esperado)) f(`no cita el mínimo como lo que recién cruzaría ("${esperado}")`);
    }
    const plazo = Number(input.plazoCredito) || 0;
    const plazoProbado = plazo > 0 && plazo < DIST_PLAZO_TOPE_ANIOS;
    if (plazoProbado !== fr.includes(`a ${DIST_PLAZO_TOPE_ANIOS} años`)) f(`plazo ${plazo}: la frase ${plazoProbado ? "debía" : "no debía"} citar los ${DIST_PLAZO_TOPE_ANIOS} años`);
    // T0 CONGELADO: el pie se explora hasta 30% siempre que exista y no esté en el techo; el
    // estado vive en `vias` (noAplica = no se probó).
    const vPie = v.vias?.find((x) => x.palanca === "pie");
    const pieProbado = vPie ? vPie.estado !== "noAplica" : !!v.pieEsPalanca;
    if (pieProbado !== fr.includes(`con pie ${DIST_PIE_TOPE_PCT}%`)) f(`pie ${v.piePctActual}: la frase ${pieProbado ? "debía" : "no debía"} citar el pie ${DIST_PIE_TOPE_PCT}%`);
    if (!/(con administrador|autogestionando)/.test(fr)) f("no cita la gestión, que el builder siempre prueba");
    if (!/La brecha (es del negocio|no es de este departamento)/.test(fr)) f("sin cierre de brecha");
  }
  console.log("\nFRASE ESTRUCTURAL STR · catch-test");
  for (const x of fallas) console.log(`  ✗ ${x}`);
  if (fallas.length) { console.log("\n✗ ROJO"); process.exit(1); }
  console.log("\n✓ VERDE");
}

main().catch((e) => { console.error(e); process.exit(1); });
