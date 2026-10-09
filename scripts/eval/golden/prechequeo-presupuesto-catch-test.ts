// ─────────────────────────────────────────────────────────────────────────────
// Tier PRECHEQUEO-PRESUPUESTO (09-oct-2026, 0 tokens) — el prechequeo semanal termina siempre a tiempo.
//
// El incidente: `/api/cron/semanal-prechequeo` llegó al corte de 300 s en 22 de 24 corridas (06–09 oct). Medido
// en solo lectura: 171 personas, 163 con lista; preparar a cada una y elegir su siguiente aviso costó 379 s
// en local (9.033 evaluaciones del motor, 3.054 consultas a la memoria de publicación) y solo 9 necesitaban
// un chequeo. El reloj se miraba entre chequeos, pero el «estado al cierre» volvía a recorrer a TODAS las
// personas preparadas sin reloj, y la corrida no guardaba dónde quedó (el punto de partida rotaba por hora).
//
// Fija: (1) el presupuesto de 240 s; (2) con más trabajo del que cabe, ningún paso empieza pasado el
// presupuesto y la corrida dice por quién seguir; (3) la siguiente corrida sigue desde ahí y entre las dos
// cubren a todos; (4) los turnos y el cupo de lecturas siguen como antes; (5) el cierre no vuelve a recorrer
// a nadie y el cron guarda y lee dónde quedó.
//
// ACTA (09-oct-2026). Contra el código de antes del arreglo: ROJO con 8 fallas. Sobre el arreglo, 20/20 mutaciones
// en ROJO (este tier o el §12 de SEMANAL), cada archivo restaurado byte a byte:
//   T1 sin reloj antes de preparar · T2 sin reloj antes de chequear · T3 el cursor es la primera no terminada ·
//   T4 ignora `desde` · T5 sin cupo · T6 presupuesto de 280 s · T7/T8 `desdeDondeQuedo` desde el principio o
//   exigiendo la misma persona · T9 corta sin decir que fue por tiempo · S1 vuelve el recorrido de cierre · S2 el
//   servidor sin reloj · S3 dónde quedó en `config` · S4 el servidor sin cupo · S5 el servidor ignora `desde` ·
//   S6 chequea sin el presupuesto de fichas · R1 sin orden estable · R2 vuelve el turno por hora · R3 no guarda
//   dónde quedó · R4 lo lee y no lo usa (lo caza SEMANAL) · R5 otro presupuesto en la ruta (lo caza SEMANAL).
//   La primera tanda dio 15/20: T1 y T9 quedaron VERDES porque el caso ponía el borde de los 240 s solo sobre una
//   persona que necesitaba chequeo (el reloj de antes de preparar nunca era el que cortaba): de ahí las dos
//   variantes del borde. S4, S5 y S6 quedaron VERDES porque nada fijaba qué le pasa el servidor al prechequeo:
//   de ahí el chequeo de los argumentos en orden.
//   Y antes de las mutaciones, este tier cazó un error de diseño de la primera versión: devolvía como cursor «la
//   primera no terminada», que ya había chequeado, y cada corrida habría vuelto a preparar a las mismas.
//   Segunda pasada (el mismo día): el cierre queda en los logs de la función —duración, cuánto tardó cada aviso,
//   dónde empezó y quedó como posición—, porque la verificación en producción no tenía otra ventana que la base.
//   24/24 en ROJO con L1 no mide cada chequeo · L2 el log sin lo de cada aviso · L3 el log con el id de la persona ·
//   L4 sin log de cierre (R2 y R4, reapuntadas a `const desde = …`).
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/prechequeo-presupuesto-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as S from "../../../src/lib/guia/semanal";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

type Avance = { chequeos: number; revisadas: number; siguiente: string | null; porTiempo: boolean; porCupo: boolean; msChequeos?: number[]; msPasoMax?: number };
type Prechequear = (
  personas: string[],
  desde: string | null,
  siguiente: (p: string) => Promise<string | null>,
  chequear: (aviso: string) => Promise<unknown>,
  quedaCupo: () => boolean,
  quedaTiempo: () => boolean,
) => Promise<Avance>;

/** Un reloj de mentira: cada paso avanza lo que cuesta, y se anota a qué hora EMPEZÓ cada paso. */
function escenario(o: { personas: number; necesitan: Record<string, number>; msPreparar: number; msChequeo: number; presupuesto: number }) {
  const r = { t: 0 };
  const personas = Array.from({ length: o.personas }, (_, i) => `p${String(i).padStart(3, "0")}`);
  const faltan = { ...o.necesitan };
  const preparadas = new Set<string>();
  const inicios: Array<{ que: string; t: number }> = [];
  const siguiente = async (p: string) => {
    inicios.push({ que: `siguiente ${p}`, t: r.t });
    if (!preparadas.has(p)) { preparadas.add(p); r.t += o.msPreparar; } else r.t += 50;
    return (faltan[p] ?? 0) > 0 ? `${p}-aviso${faltan[p]}` : null;
  };
  const chequear = async (aviso: string) => {
    inicios.push({ que: `chequear ${aviso}`, t: r.t });
    const p = aviso.split("-")[0];
    faltan[p]--;
    r.t += o.msChequeo;
  };
  return { r, personas, faltan, preparadas, inicios, siguiente, chequear, quedaTiempo: () => r.t < o.presupuesto };
}

export async function runPrechequeoPresupuestoTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER PRECHEQUEO-PRESUPUESTO (el prechequeo semanal termina siempre a tiempo · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const pre = (S as unknown as { prechequearConPresupuesto?: Prechequear }).prechequearConPresupuesto;

  if ((S as unknown as { PRESUPUESTO_PRECHEQUEO_MS?: number }).PRESUPUESTO_PRECHEQUEO_MS !== 240_000) F("1 · el presupuesto del prechequeo no es 240 s");
  if (typeof pre !== "function") {
    F("2 · no existe `prechequearConPresupuesto`: con más trabajo del que cabe, la corrida llega al corte de 300 s sin decir dónde quedó");
  } else {
    // EL CASO: más trabajo del que cabe. 171 personas, preparar a cada una cuesta 2 s, y las que necesitan un
    // chequeo de 3 s son 9 (como en producción): 342 s de preparación contra 240 s de presupuesto. Dos bordes,
    // porque el reloj se mira en dos lugares: a los 240 s termina de prepararse p110, y en una variante p110 no
    // necesita (lo que no puede empezar es preparar a p111) y en la otra sí (lo que no puede empezar es su chequeo).
    for (const borde of ["no necesita", "necesita"] as const) {
      const necesitan: Record<string, number> = {};
      for (const i of [3, 17, 40, 41, 77, 100, 130, 150, 170]) necesitan[`p${String(i).padStart(3, "0")}`] = 1;
      if (borde === "necesita") necesitan.p110 = 1;
      const total = Object.keys(necesitan).length;
      const tag = `2 · (el borde ${borde})`;
      const e = escenario({ personas: 171, necesitan, msPreparar: 2000, msChequeo: 3000, presupuesto: 240_000 });
      const a1 = await pre(e.personas, null, e.siguiente, e.chequear, () => true, e.quedaTiempo);
      const tarde = e.inicios.filter((x) => x.t >= 240_000);
      if (tarde.length) F(`${tag} con más trabajo del que cabe, ${tarde.length} paso(s) EMPEZARON pasado el presupuesto (el primero: ${tarde[0].que} a los ${tarde[0].t / 1000} s)`);
      if (e.r.t > 240_000 + 3000) F(`${tag} la corrida terminó a los ${e.r.t / 1000} s (el presupuesto es 240 s y el paso más largo, 3 s)`);
      if (!a1.porTiempo) F(`${tag} con más trabajo del que cabe, la corrida no dice que cortó por tiempo`);
      // Cuánto tardó cada aviso: una medida por chequeo hecho (va al log del cierre).
      if (!Array.isArray(a1.msChequeos) || a1.msChequeos.length !== a1.chequeos || typeof a1.msPasoMax !== "number") F(`${tag} la corrida no mide cuánto tardó cada chequeo (${a1.msChequeos?.length} medidas para ${a1.chequeos} chequeos)`);
      // Por quién seguir: la primera a la que la corrida NO LLEGÓ (si llegó a todas, la primera que todavía
      // necesita). No una que ya chequeó y no alcanzó a confirmarse: con eso cada corrida re-prepararía a las
      // mismas y nunca avanzaría (la primera versión devolvía p003 con 110 personas ya revisadas).
      const primeraSinRevisar = e.personas.find((p) => !e.preparadas.has(p)) ?? e.personas.find((p) => (e.faltan[p] ?? 0) > 0) ?? null;
      if (a1.siguiente !== primeraSinRevisar) F(`${tag} la corrida no dice por quién seguir (dice ${a1.siguiente}, la primera sin revisar es ${primeraSinRevisar})`);
      // 3 · la corrida siguiente sigue desde ahí y entre las dos cubren a todos.
      e.r.t = 0;
      const a2 = await pre(e.personas, a1.siguiente, e.siguiente, e.chequear, () => true, e.quedaTiempo);
      const sinPreparar = e.personas.filter((p) => !e.preparadas.has(p));
      if (sinPreparar.length) F(`3 · (el borde ${borde}) entre dos corridas quedaron ${sinPreparar.length} personas sin revisar (la segunda no siguió desde donde quedó la primera)`);
      const pendientes = Object.entries(e.faltan).filter(([, n]) => n > 0).map(([p]) => p);
      if (pendientes.length) F(`3 · (el borde ${borde}) entre dos corridas quedaron avisos sin chequear (${pendientes.join(", ")})`);
      if (a2.siguiente !== null || a2.porTiempo) F(`3 · (el borde ${borde}) con todo cubierto, la corrida no dice que dio la vuelta (siguiente=${a2.siguiente}, porTiempo=${a2.porTiempo})`);
      if (a1.chequeos + a2.chequeos !== total) F(`3 · (el borde ${borde}) los chequeos de las dos corridas no son los ${total} que hacían falta (${a1.chequeos} + ${a2.chequeos})`);
    }
    // Empieza donde se le dice, no por el principio.
    const e3 = escenario({ personas: 5, necesitan: {}, msPreparar: 1, msChequeo: 1, presupuesto: 1e9 });
    await pre(e3.personas, "p003", e3.siguiente, e3.chequear, () => true, e3.quedaTiempo);
    if (e3.inicios[0]?.que !== "siguiente p003") F(`3 · la corrida no empieza por la persona donde quedó la anterior (empezó por ${e3.inicios[0]?.que})`);
    if (e3.preparadas.size !== 5) F("3 · empezando a mitad de la lista, la corrida no da la vuelta completa");
    // Dónde quedó → por quién empezar, sobre la lista ordenada: la misma persona; si ya no está, la que le sigue;
    // si quedó después de la última, o no hay dónde quedó, desde el principio.
    const dq = (S as unknown as { desdeDondeQuedo?: (p: Array<{ userId: string }>, s: string | null) => string | null }).desdeDondeQuedo;
    const lista = ["a1", "c3", "e5"].map((userId) => ({ userId }));
    const casos: Array<[string | null, string | null]> = [["c3", "c3"], ["b2", "c3"], ["f6", null], [null, null], ["a0", "a1"]];
    const malos = typeof dq !== "function" ? ["no existe"] : casos.filter(([s, x]) => dq(lista, s) !== x).map(([s, x]) => `${s}→${dq(lista, s)} (es ${x})`);
    if (malos.length) F(`3 · la corrida no empieza donde quedó la anterior: ${malos.join(", ")}`);

    // 4 · por turnos, como antes: a necesita 3 y b 1 → a, b, a, a.
    {
      const e4 = escenario({ personas: 2, necesitan: { p000: 3, p001: 1 }, msPreparar: 1, msChequeo: 1, presupuesto: 1e9 });
      await pre(e4.personas, null, e4.siguiente, e4.chequear, () => true, e4.quedaTiempo);
      const orden = e4.inicios.filter((x) => x.que.startsWith("chequear")).map((x) => x.que.slice(9, 13)).join(",");
      if (orden !== "p000,p001,p000,p000") F(`4 · los chequeos no van por turnos (${orden})`);
    }
    // 4 · sin cupo de lecturas, para, lo dice y deja dónde seguir.
    {
      const e5 = escenario({ personas: 6, necesitan: { p001: 2, p004: 1 }, msPreparar: 1, msChequeo: 1, presupuesto: 1e9 });
      let cupo = 1;
      const a5 = await pre(e5.personas, null, e5.siguiente, async (av) => { cupo--; await e5.chequear(av); }, () => cupo > 0, e5.quedaTiempo);
      if (!a5.porCupo || a5.chequeos !== 1) F(`4 · sin cupo de lecturas no para o no lo dice (porCupo=${a5.porCupo}, chequeos=${a5.chequeos})`);
      // La misma regla que con el reloj: sigue la primera a la que no llegó (p001 ya tuvo su turno).
      if (a5.siguiente !== "p002") F(`4 · sin cupo, la corrida no deja por quién seguir (${a5.siguiente}; la primera a la que no llegó es p002)`);
    }
  }

  // ── 5 · EL CABLEADO: el cierre no recorre de nuevo; el cron lee y guarda dónde quedó ──────────
  {
    const srv = sinComentarios(leer("src/lib/guia/semanal-servidor.ts"));
    const cuerpo = srv.slice(srv.indexOf("export async function prechequearSemana"), srv.indexOf("function candidatoDeFila"));
    if (!/prechequearConPresupuesto\(/.test(cuerpo)) F("5 · `prechequearSemana` no usa `prechequearConPresupuesto`");
    // Lo que el servidor le pasa, en orden: desde dónde, el chequeo que cuenta lecturas y se para con un bloqueo,
    // el cupo de lecturas por corrida, y el reloj. Sin el cupo, una persona sin lectura posible pediría el mismo
    // aviso vuelta tras vuelta hasta gastar el presupuesto entero.
    const args = /prechequearConPresupuesto\(\s*personas\.map\(\(x\) => x\.userId\),\s*opts\.desde,\s*async \(userId\) => \{[\s\S]*?\},\s*publicadoConPresupuesto\(admin, presupuesto\),\s*\(\) => !presupuesto\.bloqueada && presupuesto\.lecturas < LECTURAS_POR_CORRIDA_SEMANAL,\s*\(\) => Date\.now\(\) < opts\.hastaMs,\s*\)/;
    if (!args.test(cuerpo)) F("5 · `prechequearSemana` no le pasa al prechequeo dónde quedó, el chequeo con presupuesto de fichas, el cupo de lecturas y el reloj, en ese orden");
    if (/elegirSemanal\(|for \(const \[, p\] of Array\.from\(preps\)\)/.test(cuerpo)) F("5 · el cierre vuelve a recorrer a todas las personas preparadas (sin reloj)");
    if (!/Date\.now\(\) < opts\.hastaMs/.test(cuerpo)) F("5 · el prechequeo no mira el reloj del presupuesto");
    const ruta = sinComentarios(leer("src/app/api/cron/semanal-prechequeo/route.ts"));
    if (!/PRESUPUESTO_PRECHEQUEO_MS/.test(ruta)) F("5 · el cron no usa el presupuesto de 240 s");
    if (!/leerAvancePrechequeo\(admin\)/.test(ruta) || !/guardarAvancePrechequeo\(admin, /.test(ruta)) F("5 · el cron no lee ni guarda dónde quedó la corrida anterior");
    if (/Math\.floor\(t0 \/ 3_600_000\) \* 13/.test(ruta)) F("5 · el punto de partida sigue rotando por hora en vez de seguir donde quedó");
    if (!/\.sort\(/.test(ruta)) F("5 · las personas no van en un orden estable (el «dónde quedó» no sirve si el orden cambia)");
    // El cierre queda en los logs de la función con la duración, lo de cada aviso y dónde empezó y quedó, como
    // posición y no como id: la base no es el único lugar donde se puede ver si la corrida terminó a tiempo.
    const log = ruta.slice(ruta.indexOf("console.log(`[semanal-prechequeo] cierre"));
    if (!/^console\.log\(`\[semanal-prechequeo\] cierre \$\{JSON\.stringify\(\{[^}]*ms: Date\.now\(\) - t0,[^}]*empezoEn: posicion\(desde\), sigueEn: posicion\(r\.siguiente\)[^}]*msChequeos: r\.msChequeos, msPasoMax: r\.msPasoMax/.test(log) || /userId|siguiente: r\.siguiente/.test(log.slice(0, log.indexOf("})}`)")))) F("5 · el cierre no deja en los logs la duración, lo de cada aviso y dónde empezó y quedó (o deja el id de la persona)");
    // Dónde quedó lleva un id de usuario: va a `metrics_daily` (solo el servidor), nunca a `config`, que
    // `/api/config?key=` devuelve al público.
    const avanceSrv = srv.slice(srv.indexOf("export async function leerAvancePrechequeo"), srv.indexOf("function candidatoDeFila"));
    if (!/from\("metrics_daily"\)/.test(avanceSrv) || !/guardarMetrica\(admin, /.test(avanceSrv) || /from\("config"\)/.test(avanceSrv)) F("5 · dónde quedó no se guarda en `metrics_daily` (o se guarda en `config`, que es pública)");
  }

  if (fallas.length) {
    console.log(`  ✗ PRECHEQUEO-PRESUPUESTO · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — con más trabajo del que cabe, ningún paso empieza pasados los 240 s, la corrida dice por quién seguir y la siguiente sigue desde ahí hasta cubrir a todos; turnos y cupo como antes; el cierre no recorre de nuevo");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runPrechequeoPresupuestoTier().then((r) => process.exit(r.hard ? 1 : 0));
}
