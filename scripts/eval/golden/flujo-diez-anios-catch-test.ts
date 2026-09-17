/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// GOLDEN · FLUJO A DIEZ AÑOS (capítulo II STR) — catch-test (16-sep-2026).
// 0 tokens, sin base.
// ============================================================================
// El capítulo II cambió tres cosas: salió la bajada con su rótulo, el flujo se rotula como
// mes estabilizado, y salió el cierre en prosa. En su lugar entró el gráfico de flujo mensual
// promedio por año. Este tier fija lo que ese gráfico NO puede dejar de cumplir.
//
// Los fixtures son SINTÉTICOS a propósito. Las filas vivas no ejercitan las tres ramas: solo
// 23 de 252 tienen un año parcial y solo 17 tienen años pre-entrega, así que un tier que
// dependiera del parque podría pasar sin haber tocado nunca el caso que importa. Es la misma
// razón por la que `decisividad-str` usa un fixture de cuatro campos sobre la función pura.
//
// Fija CUATRO cosas, todas sobre COMPORTAMIENTO:
//
//   1. EL PROMEDIO SE DIVIDE POR 12, incluso —y sobre todo— en los años parciales. Dividir
//      por los meses operados infla el punto entre 1,1× y 1,5× porque la estabilización y el
//      amoblamiento se restan ENTEROS mientras el NOI sí se prorratea.
//   2. LOS AÑOS SIN OPERACIÓN NO ENTRAN. Valen $0 y con color por signo saldrían neutros,
//      indistinguibles de un año que cierra justo.
//   3. EL CERO SIEMPRE ESTÁ EN EL DOMINIO de la curva, o el color por signo pierde contra
//      qué se lee.
//   4. `CierresStr` NO TRAE `flujo`: el cierre que reponía en prosa lo que la tabla mostraba
//      está retirado y no vuelve.
//      ⛔ OJO CON LEER ESTO COMO «EL CAPÍTULO II NO TIENE CIERRE»: eso fue cierto entre el
//      16 y el 17-sep-2026 y HOY ES FALSO. La fusión del capítulo V (17-sep) le devolvió un
//      cierre, pero es OTRO —`cierres.gestion`, el punto de quiebre de la comisión— y entra
//      por otra clave. Lo que este invariante protege es que no vuelva EL DE ANTES, el que
//      repetía la tabla. Se deja escrito porque un guard cuya razón caducó y nadie corrigió
//      es peor que no tenerlo: después no se sabe si el producto se rompió o si la regla se
//      derogó.
//
//   + PISO DE COBERTURA: los fixtures tienen que ejercitar las tres formas (cruza el cero /
//     todo de un signo / con años descartados). Sin eso, un `filter` que se coma todo dejaría
//     el tier verde sobre una serie vacía.
//
// Corre standalone:
//   node --import tsx scripts/eval/golden/flujo-diez-anios-catch-test.ts
// ============================================================================
import { serieFlujoMensualPorAnio, type YearProjectionSTR } from "../../../src/lib/engines/short-term-engine";
import { dominioCurvaAnios } from "../../../src/components/analysis/shared/CurvaAnios";
import type { CierresStr } from "../../../src/lib/cierres-str-ensamblador";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);

/** Un año de proyección con lo mínimo que la serie usa. */
const anio = (year: number, flujo: number, meses = 12): YearProjectionSTR =>
  ({
    year,
    valorDepto: 0,
    saldoCredito: 0,
    flujoOperacionalAnual: flujo,
    flujoAcumulado: 0,
    aporteMensualPromedio: 0,
    patrimonioNeto: 0,
    mesesOperativos: meses,
  }) as YearProjectionSTR;

// ── los tres casos ──────────────────────────────────────────────────────────
const CASOS = {
  // cruza el cero: arranca pidiendo plata y termina dejando
  cruza: [anio(1, -3_600_000), anio(2, -1_200_000), anio(3, 240_000), anio(4, 600_000)],
  // todo de un signo: nunca cierra
  unSigno: [anio(1, -3_600_000), anio(2, -2_400_000), anio(3, -1_800_000), anio(4, -1_200_000)],
  // con pre-entrega: dos años sin operar y uno PARCIAL con un cargo entero adentro
  preEntrega: [anio(1, 0, 0), anio(2, 0, 0), anio(3, -4_800_000, 8), anio(4, 600_000)],
};

// ── 1 · el promedio se divide por 12, también en el año parcial ─────────────
for (const [k, proy] of Object.entries(CASOS)) {
  const serie = serieFlujoMensualPorAnio(proy);
  for (const p of serie) {
    const fuente = proy.find((q) => q.year === p.anio)!;
    const esperado = Math.round(fuente.flujoOperacionalAnual / 12);
    if (p.flujoMensualPromedio !== esperado) {
      F(`1 · ${k} año ${p.anio}: ${p.flujoMensualPromedio} ≠ ${esperado} (= ${fuente.flujoOperacionalAnual}/12)`);
    }
  }
}
// y el año parcial es EL caso: con /mesesOperativos daría 1,5× más
{
  const parcial = serieFlujoMensualPorAnio(CASOS.preEntrega).find((p) => p.anio === 3);
  const porMeses = Math.round(-4_800_000 / 8);
  if (!parcial) F("1 · el año parcial (8 meses) no salió en la serie");
  else if (parcial.flujoMensualPromedio === porMeses) {
    F(`1 · el año parcial se dividió por los MESES OPERATIVOS (${porMeses}), no por 12`);
  }
}

// ── 2 · los años sin operación no entran ────────────────────────────────────
{
  const serie = serieFlujoMensualPorAnio(CASOS.preEntrega);
  if (serie.length !== 2) F(`2 · preEntrega debía dejar 2 puntos, dejó ${serie.length}`);
  if (serie.some((p) => p.anio === 1 || p.anio === 2)) F("2 · entró un año sin meses operativos");
  if (serie[0]?.anio !== 3) F(`2 · la serie debía arrancar en el primer año operativo (3), arrancó en ${serie[0]?.anio}`);
}

// ── 3 · el cero siempre está en el dominio ──────────────────────────────────
for (const [k, proy] of Object.entries(CASOS)) {
  const vals = serieFlujoMensualPorAnio(proy).map((p) => p.flujoMensualPromedio);
  if (!vals.length) continue;
  const { min, max } = dominioCurvaAnios(vals);
  if (!(min <= 0 && max >= 0)) F(`3 · ${k}: el cero quedó fuera del dominio [${min}, ${max}]`);
}

// ── 4 · `CierresStr` no trae `flujo` ────────────────────────────────────────
{
  // Esto lo enforcea el TYPE-CHECKER, no el runtime, y está bien que así sea: si alguien
  // reintroduce `flujo` en `CierresStr`, `SinFlujo` pasa a "TIENE", la asignación de abajo
  // deja de compilar y `npm run typecheck:scripts` lo caza antes que este tier corra.
  // Se declara acá —y no solo en el componente— para que el invariante tenga UN lugar donde
  // esté escrito como invariante y no como ausencia.
  type SinFlujo = CierresStr extends { flujo: unknown } ? "TIENE" : "ok";
  const marca: SinFlujo = "ok";
  if ((marca as string) !== "ok") F("4 · `CierresStr` volvió a traer `flujo`: el cierre que repetía la tabla está retirado");
}

// ── PISO DE COBERTURA ───────────────────────────────────────────────────────
// ⛔ ESTE PISO SE VERIFICA POR FIXTURE, NO POR EL CONJUNTO. La primera versión pedía que
// ALGÚN fixture cruzara el cero, y pasaba igual con `cruza` mutado a todo-negativo — porque
// `preEntrega` cruza por casualidad. O sea: el fixture llamado `cruza` podía dejar de cruzar
// en silencio y el tier seguía verde. Cazado mutándolo. Ahora cada fixture tiene que hacer
// lo que su nombre declara.
{
  const forma = (proy: YearProjectionSTR[]) => {
    const v = serieFlujoMensualPorAnio(proy).map((p) => p.flujoMensualPromedio);
    return {
      n: v.length,
      cruza: v.some((x) => x < 0) && v.some((x) => x >= 0),
      unSigno: v.length > 0 && (v.every((x) => x < 0) || v.every((x) => x >= 0)),
      descarta: v.length < proy.length,
    };
  };
  const fCruza = forma(CASOS.cruza);
  const fUno = forma(CASOS.unSigno);
  const fPre = forma(CASOS.preEntrega);

  if (!fCruza.cruza) F("PISO · el fixture `cruza` NO cruza el cero — es el 15,9% del parque y nadie lo estaría ejercitando");
  if (!fUno.unSigno) F("PISO · el fixture `unSigno` dejó de ser de un solo signo");
  if (!fPre.descarta) F("PISO · el fixture `preEntrega` no perdió ningún año: el filtro no se ejercitó");
  for (const [k, f] of [["cruza", fCruza], ["unSigno", fUno], ["preEntrega", fPre]] as const) {
    if (f.n === 0) F(`PISO · el fixture \`${k}\` quedó en CERO puntos: la serie no se computó`);
  }
}

export function runFlujoDiezAniosTier(): { hard: number } {
  console.log("\n─── TIER FLUJO-DIEZ-AÑOS (el gráfico del capítulo II STR · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — el promedio se divide por 12 también en el año parcial, los años sin operación no entran, el cero está en el dominio de las tres formas, `CierresStr` no trae `flujo`, y los fixtures ejercitan cruce, signo único y descarte");
  } else {
    for (const m of fallas) console.log(`  ✗ ${m}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runFlujoDiezAniosTier();
  process.exit(hard ? 1 : 0);
}
