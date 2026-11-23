// ============================================================================
// GOLDEN · CORREO-VIVO (23-nov-2026) — catch-test · la FRESCURA del correo
// ============================================================================
//   El semanal y el inmediato elegían con la evaluación guardada de la noche, una foto que solo se rehace si cambia el precio; el
//   informe lee los comparables en vivo. El 23-nov, 19 de 293 avisos del semanal daban otro veredicto (caso e828d352). Ahora cada
//   depto que va a salir se confirma en vivo con la función del informe (guia/vivo.ts):
//   1 · LA REGLA: mismo veredicto → los números de hoy; otro veredicto o sin vivo → no sale.
//   2 · LA ELECCIÓN: en el semanal y en el inmediato, el depto que cambió no entra y entra el siguiente; el que sigue igual entra con
//       los números de hoy; el relleno también se confirma. Sin `confirmar` (renta corta), como siempre.
//   3 · EL CABLEADO: la preparación confirma con el evaluador compartido y la tasa de la persona; el armado de renta larga, el
//       inmediato y el correo del día lo usan; el evaluador usa la MISMA función del informe (cuerpoDelAviso, la misma mediana).
//   4 · LA RECOMPROBACIÓN DEL LUNES: armada antes de las 05:00 UTC del lunes → el reintento la rearma (forzada) y, si no alcanzó, el
//       envío la rearma sin leer fichas antes de mandar.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. 0 tokens, 0 lecturas.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/correo-vivo-catch-test.ts
// ============================================================================
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { confirmarConVivo, antiguedadDeCandidato } from "../../../src/lib/guia/vivo";
import { elegirSemanal, verificadaEnVivo, REGLA_LARGA, type CandidatoSemanal } from "../../../src/lib/guia/semanal";
import { elegirInmediato } from "../../../src/lib/guia/inmediato";
import type { Evaluado } from "../../../src/lib/guia/seleccion";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => (existsSync(join(RAIZ, p)) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));

type C = CandidatoSemanal & { nombre: string };
const cand = (avisoId: string, scoreCron: number): C => ({ avisoId, scoreCron, nombre: avisoId });
const E = (veredicto: string, score: number, flujo = 100_000): Evaluado => ({ veredicto, score, flujo });

export async function runCorreoVivoTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER CORREO-VIVO (cada depto del semanal y del inmediato se confirma en vivo con la función del informe antes de salir · 0 tokens) ───");

  // ══ §1 · LA REGLA ═══════════════════════════════════════════════════════════
  {
    const r = confirmarConVivo(E("COMPRAR", 80, 225_000), E("COMPRAR", 74, 150_000));
    if (!r || r.score !== 74 || r.flujo !== 150_000) F("1 · con el mismo veredicto no salen los números de hoy");
    if (confirmarConVivo(E("COMPRAR", 80), E("AJUSTA SUPUESTOS", 63)) !== null) F("1 · un depto que pasó de Comprar a Ajustar igual sale (el caso e828d352)");
    if (confirmarConVivo(E("AJUSTA SUPUESTOS", 66), E("COMPRAR", 72)) !== null) F("1 · el cambio hacia arriba igual sale: distinto es en cualquier dirección");
    if (confirmarConVivo(E("COMPRAR", 80), null) !== null) F("1 · sin poder confirmarlo en vivo, sale igual con el número de la noche");
    if (confirmarConVivo(E("COMPRAR", 80), { veredicto: null, score: null, flujo: null }) !== null) F("1 · un vivo sin veredicto cuenta como confirmado");
    const usado = antiguedadDeCandidato({ condicion: "usado", antiguedadAnios: null } as never);
    const conAnio = antiguedadDeCandidato({ condicion: "usado", antiguedadAnios: 31 } as never);
    if (usado.origen !== "supuesta" || usado.anios !== null || conAnio.origen !== "ficha" || conAnio.anios !== 31) F("1 · la edad del vivo no es la del informe (la conocida o la supuesta)");
  }

  // ══ §2 · LA ELECCIÓN ════════════════════════════════════════════════════════
  {
    // Cinco Comprar de la noche; el primero cambió en vivo a Ajustar, el tercero bajó su puntaje.
    const cands = [cand("a", 90), cand("b", 85), cand("c", 80), cand("d", 75), cand("e", 70), cand("f", 65)];
    const noche: Record<string, Evaluado> = { a: E("COMPRAR", 90), b: E("COMPRAR", 85), c: E("COMPRAR", 80), d: E("COMPRAR", 75), e: E("COMPRAR", 70), f: E("COMPRAR", 65) };
    const vivo: Record<string, Evaluado> = { a: E("AJUSTA SUPUESTOS", 62), b: E("COMPRAR", 84), c: E("COMPRAR", 71, 50_000), d: E("COMPRAR", 75), e: E("COMPRAR", 70), f: E("COMPRAR", 66) };
    const confirmados: string[] = [];
    const confirmar = async (c: C, ev: Evaluado) => { confirmados.push(c.avisoId); return confirmarConVivo(ev, vivo[c.avisoId] ?? null); };
    const g = await elegirSemanal(cands, async (c) => noche[c.avisoId], async () => "publicado", undefined, REGLA_LARGA, () => null, confirmar);
    const ids = g.items.map((x) => x.c.avisoId);
    if (ids.includes("a")) F("2 · el semanal manda un depto que cambió de veredicto en vivo");
    if (!ids.includes("f") || ids.length !== 5) F(`2 · el semanal no completa con el siguiente candidato (${ids.join(",")})`);
    const c = g.items.find((x) => x.c.avisoId === "c");
    if (!c || c.ev.score !== 71 || c.ev.flujo !== 50_000) F("2 · el semanal no manda los números de hoy del que sigue igual");
    if (!confirmados.includes("a")) F("2 · el semanal no confirma en vivo antes de tomar");
    // Sin confirmar (renta corta): como siempre, con lo de la noche.
    const g0 = await elegirSemanal(cands, async (x) => noche[x.avisoId], async () => "publicado", undefined, REGLA_LARGA, () => null);
    if (!g0.items.some((x) => x.c.avisoId === "a")) F("2 · sin `confirmar`, la elección deja de ser la de siempre");
    // El relleno (sin ficha confirmada) también se confirma: el que cambió no entra.
    const gR = await elegirSemanal([cand("x", 90), cand("y", 80)], async (k) => ({ x: E("COMPRAR", 90), y: E("COMPRAR", 80) } as Record<string, Evaluado>)[k.avisoId], async () => "sin-chequeo", undefined, REGLA_LARGA, () => null,
      async (k, ev) => confirmarConVivo(ev, ({ x: E("AJUSTA SUPUESTOS", 60), y: E("COMPRAR", 79) } as Record<string, Evaluado>)[k.avisoId]));
    const rel = (gR.relleno ?? []).map((x) => x.c.avisoId);
    if (rel.includes("x") || !rel.includes("y")) F(`2 · el relleno manda un depto que cambió de veredicto (${rel.join(",")})`);
    // El inmediato: lo mismo.
    const i = await elegirInmediato(cands, new Set(), async (x) => noche[x.avisoId], async () => "publicado", confirmar);
    const iIds = i.map((x) => x.c.avisoId);
    if (iIds.includes("a") || !iIds.includes("f")) F(`2 · el inmediato manda un depto que cambió o no entra el siguiente (${iIds.join(",")})`);
    if (i.find((x) => x.c.avisoId === "c")?.ev.score !== 71) F("2 · el inmediato no manda los números de hoy");
  }

  // ══ §3 · EL CABLEADO ════════════════════════════════════════════════════════
  {
    const srv = codigo("src/lib/guia/semanal-servidor.ts");
    if (!/confirmar: \(c, ev\) => evaluadorVivoCompartido\(admin, cfg\)\.confirmar\(c, ev, \{ origen: \{ \.\.\.o, tasa \}, combo \}\),/.test(srv)) F("3 · la preparación no confirma con el evaluador compartido y la tasa de la persona");
    if (!/const g = await elegirSemanal\(candidatos, evaluar, publicado, respaldo, REGLA_LARGA, visto, prep\.p\.confirmar\);/.test(srv)) F("3 · el armado del semanal (renta larga) no confirma en vivo");
    if (!/elegirInmediato\(prep\.candidatos, fuera, prep\.evaluar, deps\.publicado, prep\.confirmar\)/.test(codigo("src/lib/guia/inmediato-servidor.ts"))) F("3 · el inmediato no confirma en vivo");
    if (!/elegirSemanal\(prep\.p\.candidatos, prep\.p\.evaluar, publicado, prep\.p\.respaldo, REGLA_DEL_DIA, undefined, prep\.p\.confirmar\)/.test(codigo("src/lib/guia/del-dia-servidor.ts"))) F("3 · el correo del día no confirma en vivo");
    const viv = codigo("src/lib/guia/vivo.ts");
    if (!/const body = await cuerpoDelAviso\(c, p\.origen, p\.combo, antiguedad, cfg, sug\)/.test(viv) || !/prefetchMedianaComunaVenta\(admin, body, cfg\.uf\)/.test(viv) || !/const r = runAnalysis\(body, cfg\.uf, mediana\);/.test(viv)) F("3 · el vivo no usa la función del informe (cuerpoDelAviso, su mediana y runAnalysis)");
    if (!/const \{ arr, vta \} = sugLeidas \?\? await sugerenciasDeAviso\(a\);/.test(codigo("src/lib/guia/analizar-servidor.ts"))) F("3 · cuerpoDelAviso no usa las sugerencias compartidas (o dejó de leerlas en vivo sin ellas)");
  }

  // ══ §4 · LA RECOMPROBACIÓN DEL LUNES ════════════════════════════════════════
  {
    if (verificadaEnVivo("2026-11-29T23:25:00Z", "2026-11-30") || verificadaEnVivo("2026-11-30T04:59:00Z", "2026-11-30")) F("4 · una selección armada el domingo (o antes de las 05:00 UTC del lunes) cuenta como confirmada con los datos del lunes");
    if (!verificadaEnVivo("2026-11-30T05:00:00Z", "2026-11-30") || !verificadaEnVivo("2026-11-30T09:05:12+00:00", "2026-11-30")) F("4 · una selección rearmada el lunes en la mañana no cuenta como confirmada");
    if (verificadaEnVivo(null, "2026-11-30")) F("4 · sin fecha de armado cuenta como confirmada");
    const re = codigo("src/app/api/cron/semanal-reintento/route.ts");
    if (!/r\.estado === "pendiente" \|\| !verificadaEnVivo\(r\.armada_at as string \| null, semana\)/.test(re) || !/\{ forzar: forzar\.has\(userId\) \}/.test(re)) F("4 · el reintento del lunes no rearma las armadas sin confirmar");
    const env = codigo("src/lib/guia/semanal-servidor.ts");
    if (!/if \(fila\.estado === "armada" && fila\.perfil && fila\.combinacion && !verificadaEnVivo\(fila\.armada_at, fila\.semana\)\) \{\s*await armarSeleccion\(admin, fila\.user_id, fila\.semana, await leerConfigGuia\(admin\), \{ lecturas: 0, bloqueada: true \}, undefined, \{ forzar: true \}\);/.test(env)) F("4 · el envío manda una armada sin confirmar con los datos del lunes (o la rearma leyendo fichas)");
    if (!/const rearmable = !!previa && previa\.tipo !== "del_dia" && !previa\.enviada_at && \(previa\.estado === "pendiente" \|\| \(opts\.forzar === true && previa\.estado === "armada"\)\);/.test(env)) F("4 · el armado forzado puede pisar una selección ya enviada o un correo del día");
    if (!/"schedule": "5,35 8-11 \* \* 1"/.test(leer("vercel.json"))) F("4 · el reintento no corre cada media hora el lunes antes del envío");
  }

  if (fallas.length === 0) console.log("  ✓ CORREO-VIVO: todo en orden");
  for (const f of fallas) console.log(`  ✗ ${f}`);
  if (fallas.length) console.log(`  ${fallas.length} falla(s) dura(s)`);
  return { hard: fallas.length };
}

if (require.main === module) {
  runCorreoVivoTier().then((r) => process.exit(r.hard ? 1 : 0));
}

// ============================================================================
// ACTA DE VERIFICACIÓN EN ROJO (23-nov-2026) — cada mutación, revertida después, puso el tier en rojo:
//   M1 la elección del semanal ignora `confirmar` ............ §2 «el semanal manda un depto que cambió de veredicto en vivo»
//   M2 confirmarConVivo acepta otro veredicto ................ §1 «un depto que pasó de Comprar a Ajustar igual sale»
//   M3 el relleno sin confirmar .............................. §2 «el relleno manda un depto que cambió de veredicto»
//   M4 el inmediato ignora `confirmar` ....................... §2
//   M5 el armado de renta larga sin `prep.p.confirmar` ......... §3
//   M6 verificadaEnVivo siempre true .......................... §4
//   M7 el envío sin la red de la recomprobación ................ §4
//   M8 el reintento sin forzar ................................. §4
//   8/8 en rojo (runner local scripts/of-mutar-correo-vivo.mjs, untracked).
// ============================================================================
