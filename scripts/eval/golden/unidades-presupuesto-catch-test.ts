// ─────────────────────────────────────────────────────────────────────────────
// Tier UNIDADES-PRESUPUESTO (13-oct-2026, 0 tokens) — el pase de unidades termina a tiempo y no deja a nadie atrás.
//
// El incidente: la corrida del 13-oct de `scrape-unidades-nuevas` murió con «Task timed out after 800 seconds». Medido
// en los logs y la observabilidad de Vercel: de 334 pedidos al portal, 235 sin respuesta (fetch failed, ~0,2 s) y 17
// con 403; de los 135 proyectos del tercio se leyeron 31, y el reintento —de a uno, 4 s de pausa, dos vueltas, sin
// reloj— se comió el resto. Las escrituras iban al final: no se guardó nada. Desde el 03-oct ya duraban 4–10 minutos.
//
// Fija: (1) el presupuesto de 240 s con 30 s para escribir, el techo de 280 s, la función de 300 s y el tiempo
// máximo de cada pedido; (2) con más trabajo del que cabe —un día normal o el portal caído del 13-oct—, ninguna
// lectura empieza pasados los 210 s y los que fallan alcanzan su reintento; (3) la corrida siguiente sigue por los
// que esta no leyó; (4) con los proyectos que hay, varios días de corridas dejan a todos con menos de 4 días sin
// leer, y con MÁS PROYECTOS DE LOS QUE CABEN la corrida cierra en rojo y lo dice; (5) el gate de capacidad contra la
// base: los proyectos de hoy caben en 4 días; (6) el cableado de la ruta; (7) el techo con un paso colgado.
//
// ACTA (13-oct-2026). Contra la ruta de antes del arreglo (con este módulo presente): ROJO con 13 fallas. Sobre el
// arreglo, 34/34 mutaciones en ROJO (este tier, CRONS o PRECHEQUEO-PRESUPUESTO), cada archivo restaurado byte a byte
// y verificado por hash: M1 presupuesto 300 s · M2 lotes sin reloj · M3 lotes sin reservar los reintentos · M4
// reintentos sin reloj · M5 reintento sin pausa · M6 orden solo por id · M7 no marca los leídos · M8 los vencidos
// no cuentan · M9 plazo de 40 días · M10 dos corridas al día · M11 cada proyecto cuesta 8 s · M12 MÁS PROYECTOS DE
// LOS QUE CABEN EN LA BASE (+400 con UNIDADES_PROYECTOS_EXTRA: 834 contra 800) · M13 el avance ignora la corrida
// anterior · M14 el plazo ignora el alta · M15 maxDuration 800 · M16 el trabajo sin techo · M17 lecturas hasta los
// 240 s · M18 leídos aunque la escritura falle · M19 un error al leer dónde quedó se ignora · M20 el ensayo guarda
// dónde quedó · M21 no guardarlo no es rojo · M22 el techo marca como leído · M23 el techo cuenta como exitosa · M24
// el cierre sin techo · M25 el log sin los vencidos · M26 el conteo sin los vencidos · M27 pedido sin tiempo máximo
// · M28 el reloj arranca después del latido · M29 una vez al día · M30 vigilado como diario · C1 sin un disponible
// no es falla total · C2 la ruta no pasa los reintentos · C3 sin tolerancia · C4 conTope dice listo sin estarlo.
// La primera tanda dio 33/34: M5 quedó VERDE porque el chequeo medía el hueco desde el primer intento del MISMO
// proyecto —siempre largo, la primera pasada queda muy atrás— y no la pausa antes de cada reintento, que es lo
// que pide la regla del 02-oct. Ahora mide el hueco con el pedido anterior al portal.
//
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/unidades-presupuesto-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import * as U from "../../../src/lib/services/scraper/unidades-presupuesto";
import { conTope } from "../../../src/lib/con-tope";
import { motivoDeFalla, resultadoCron } from "../../../src/lib/cron-resultado";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "");

const DIA = 24 * 3600e3;
/** El ritmo de la ruta (lo fija el tier CRONS). */
const RITMO = { concurrencia: 2, pausaLoteMs: 1500, pausaReintentoMs: 4000, reintentos: 2 };

type P = { idProyecto: number };
type R = { idProyecto: number; error?: string };

/** Un portal de mentira con reloj de mentira. Cada pedido anota a qué hora EMPEZÓ; los de un lote corren en
 *  paralelo (el lote dura lo que el más lento). `resultado(id, intento)` dice cuánto tarda y si falla. */
function portal(resultado: (id: number, intento: number) => { ms: number; error?: string }) {
  const r = { t: 0 };
  const intentos = new Map<number, number>();
  const inicios: Array<{ id: number; t: number; n: number }> = [];
  const leerP = async (p: P): Promise<R> => {
    const n = intentos.get(p.idProyecto) ?? 0;
    intentos.set(p.idProyecto, n + 1);
    const inicio = r.t;
    inicios.push({ id: p.idProyecto, t: inicio, n });
    const x = resultado(p.idProyecto, n);
    await Promise.resolve();
    r.t = Math.max(r.t, inicio + x.ms);
    return x.error ? { idProyecto: p.idProyecto, error: x.error } : { idProyecto: p.idProyecto };
  };
  const reloj = (hastaMs: number) => ({ ahora: () => r.t, dormir: async (ms: number) => { r.t += ms; }, hastaMs });
  return { r, inicios, intentos, leerP, reloj };
}

/** Un día normal, medido del 10 al 12-oct: un GET sano tarda 0,4 s de mediana y 0,7–0,9 s de promedio, así que un
 *  proyecto (dos GETs) tarda entre 1,0 y 2,3 s; ~30% de los proyectos da 403 en la primera pasada (0,8 s) y sale en
 *  el reintento. Determinista: el mismo id falla en todas las corridas. */
const sano = (id: number) => ({ ms: 1000 + ((id * 37) % 1300) });
const diaNormal = (id: number, intento: number) => (intento === 0 && id % 10 < 3 ? { ms: 800, error: "http 403" } : sano(id));
/** El 13-oct: el 77% de los pedidos sin respuesta (fetch failed, 0,2 s), también al reintentar. */
const portalCaido = (id: number) => (id % 100 < 77 ? { ms: 200, error: "TypeError: fetch failed" } : sano(id));

/** Una corrida como la arma la ruta: completar el avance → ordenar → leer con reloj → marcar los leídos → los
 *  vencidos → el conteo. El cableado de la ruta lo fija el §6. */
async function corrida(o: {
  ids: number[]; avance: U.AvanceUnidades | null; inicio: number; resultado: (id: number, intento: number) => { ms: number; error?: string };
}) {
  const p = portal(o.resultado);
  p.r.t = o.inicio + U.ARRANQUE_MS;
  const avance = U.completarAvance(o.avance, o.ids, new Map(), new Date(o.inicio));
  const cola = U.ordenDeLectura(o.ids.map((idProyecto) => ({ idProyecto })), avance);
  const hastaMs = o.inicio + U.PRESUPUESTO_UNIDADES_MS - U.RESERVA_ESCRITURA_MS;
  const l = await U.leerConPresupuesto(cola, p.leerP, RITMO, p.reloj(hastaMs));
  const fin = new Date(p.r.t);
  const leidos = l.resultados.filter((x) => !x.error).map((x) => (x as R).idProyecto);
  const nuevo = U.marcarLeidos(avance, leidos, fin);
  const { vencidos, horasMax } = U.sinLeerHace(nuevo, fin);
  const intentados = l.resultados.map((x) => (x as R).idProyecto);
  const conError = l.resultados.filter((x) => x.error).map((x) => (x as R).idProyecto);
  const conteo = U.conteoUnidades({ intentados, conError, conDisponibles: leidos.length, escrituraFallo: false, reconFallo: false, vencidos });
  return { l, p, cola, hastaMs, leidos, avance: nuevo, vencidos, horasMax, conteo, fin: p.r.t };
}

/** Varios días de corridas, cada 24/CORRIDAS_POR_DIA horas. Devuelve lo peor que vio. */
async function dias(n: number, ids: number[], resultado: (id: number, intento: number) => { ms: number; error?: string }) {
  let avance: U.AvanceUnidades | null = null;
  let horasMax = 0, primeraRoja: number | null = null, conMotivo = "";
  const base = Date.parse("2026-10-14T02:00:00Z");
  for (let k = 0; k < n * U.CORRIDAS_POR_DIA; k++) {
    const c = await corrida({ ids, avance, inicio: base + k * (DIA / U.CORRIDAS_POR_DIA), resultado });
    avance = c.avance;
    horasMax = Math.max(horasMax, c.horasMax);
    if (c.vencidos.length && primeraRoja === null) {
      primeraRoja = k;
      conMotivo = resultadoCron(c.conteo) === "ok" ? "" : motivoDeFalla(c.conteo, { unidad: "proyectos", erroresPorTipo: { [`más de ${U.MAX_DIAS_SIN_LEER} días sin leer`]: c.vencidos.length } });
    }
  }
  return { horasMax, primeraRoja, conMotivo };
}

export async function runUnidadesPresupuestoTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER UNIDADES-PRESUPUESTO (el pase de unidades termina a tiempo y nadie queda 4 días sin leer · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const ruta = sinComentarios(leer("src/app/api/data/scrape-unidades-nuevas/route.ts"));
  const uniLib = sinComentarios(leer("src/lib/services/scraper/toctoc-unidades.ts"));
  const lib = sinComentarios(leer("src/lib/services/scraper/unidades-presupuesto.ts"));

  // ── 1 · los números ──────────────────────────────────────────────────────────
  if (U.PRESUPUESTO_UNIDADES_MS !== 240_000) F(`1 · el presupuesto no es 240 s (${U.PRESUPUESTO_UNIDADES_MS})`);
  if (!(U.TOPE_DURO_UNIDADES_MS > U.PRESUPUESTO_UNIDADES_MS && U.TOPE_DURO_UNIDADES_MS <= 285_000)) F(`1 · el techo no queda entre el presupuesto y 285 s (le deja 15 s para responder antes de los 300): ${U.TOPE_DURO_UNIDADES_MS}`);
  // Escribir lo leído costó 15 s desde Vercel (~25 consultas, 11 y 12-oct): la reserva es al menos el doble.
  if (!(U.RESERVA_ESCRITURA_MS >= 30_000 && U.RESERVA_ESCRITURA_MS < U.PRESUPUESTO_UNIDADES_MS / 2)) F(`1 · la reserva para escribir no cubre el doble de lo medido (15 s): ${U.RESERVA_ESCRITURA_MS}`);
  if (U.MAX_DIAS_SIN_LEER !== 4) F(`1 · el plazo no es 4 días (${U.MAX_DIAS_SIN_LEER})`);
  if (!/export const maxDuration = 300;/.test(ruta)) F("1 · la función no tiene 300 s: el techo se mide contra eso (tenía 800 s y murió en el corte)");
  const tGet = Number((uniLib.match(/export const TIEMPO_MAX_GET_MS = ([\d_]+);/) ?? [])[1]?.replace(/_/g, ""));
  if (!(tGet > 0 && tGet <= 15_000) || !/signal: AbortSignal\.timeout\(TIEMPO_MAX_GET_MS\)/.test(uniLib)) F(`1 · un pedido al portal no tiene tiempo máximo (o pasa de 15 s): ${tGet}`);

  // ── 2 · más trabajo del que cabe: nada empieza tarde, y los que fallan alcanzan su reintento ───────────────
  for (const [nombre, resultado, n] of [["un día normal (434 proyectos)", diaNormal, 434], ["el portal caído del 13-oct (135 proyectos)", portalCaido, 135]] as const) {
    const ids = Array.from({ length: n }, (_, i) => 1000 + i);
    const c = await corrida({ ids, avance: null, inicio: 0, resultado });
    const tarde = c.p.inicios.filter((x) => x.t >= c.hastaMs);
    if (tarde.length) F(`2 · (${nombre}) ${tarde.length} pedido(s) EMPEZARON pasados los ${c.hastaMs / 1000} s (el primero a los ${tarde[0].t / 1000} s)`);
    if (c.fin > c.hastaMs + 2 * tGet) F(`2 · (${nombre}) la lectura terminó a los ${c.fin / 1000} s (el corte de lecturas es ${c.hastaMs / 1000} s y un paso dura como mucho ${2 * tGet / 1000} s)`);
    if (!c.l.porTiempo || c.l.noAlcanzados <= 0) F(`2 · (${nombre}) con más trabajo del que cabe, la corrida no dice que cortó por tiempo ni cuántos quedaron`);
    if (c.l.resultados.length + c.l.noAlcanzados !== n) F(`2 · (${nombre}) intentados + no alcanzados no son los ${n} de la cola`);
    if (typeof c.l.msPasoMax !== "number" || c.l.msPasoMax <= 0) F(`2 · (${nombre}) la corrida no mide su paso más largo`);
    if (nombre.startsWith("un día")) {
      // Los que fallan en la primera pasada alcanzan su reintento: con la reserva, nadie queda sin él.
      const quedaron = c.l.resultados.filter((x) => x.error).length;
      if (quedaron) F(`2 · (${nombre}) ${quedaron} proyecto(s) quedaron sin reintento: las lecturas se comieron el tiempo de los reintentos`);
      if (c.l.reintentos !== c.l.fallidosPrimera) F(`2 · (${nombre}) ${c.l.reintentos} reintentos para ${c.l.fallidosPrimera} fallidos de la primera pasada`);
      // Lo que cabe de verdad, con lo medido, no es menos que lo que supone el gate de capacidad.
      if (c.l.resultados.length < U.proyectosPorCorrida()) F(`2 · (${nombre}) la corrida leyó ${c.l.resultados.length} proyectos y el gate supone ${U.proyectosPorCorrida()} por corrida`);
      // Cada reintento, después de su pausa: entre él y el pedido anterior al portal pasan al menos 4 s (el
      // reintento pegado vuelve a dar 403; 02-oct-2026).
      const pegados = c.p.inicios.filter((x, k) => x.n > 0 && k > 0 && x.t - c.p.inicios[k - 1].t < RITMO.pausaReintentoMs);
      if (c.l.reintentos === 0 || pegados.length) F(`2 · (${nombre}) ${pegados.length} de ${c.l.reintentos} reintento(s) sin su pausa de ${RITMO.pausaReintentoMs / 1000} s`);
    } else {
      // El portal caído: los lotes paran antes para dejar lugar a los reintentos, y los reintentos ocurren.
      if (c.l.reintentos === 0) F(`2 · (${nombre}) ningún fallido alcanzó su reintento: las lecturas se comieron todo el tiempo`);
      if (resultadoCron(c.conteo) === "ok") F(`2 · (${nombre}) con el portal caído la corrida no queda en rojo`);
    }
  }

  // ── 3 · la corrida siguiente sigue por los que esta no leyó ─────────────────────────────────────────
  {
    const ids = Array.from({ length: 434 }, (_, i) => 1000 + i);
    const c1 = await corrida({ ids, avance: null, inicio: 0, resultado: diaNormal });
    const c2 = await corrida({ ids, avance: c1.avance, inicio: DIA / U.CORRIDAS_POR_DIA, resultado: diaNormal });
    const leidos1 = new Set(c1.leidos);
    const repetidos = c2.cola.slice(0, c2.l.resultados.length).filter((p) => leidos1.has(p.idProyecto)).length;
    if (repetidos) F(`3 · la segunda corrida volvió a leer ${repetidos} proyecto(s) que la primera ya leyó, con otros sin leer`);
    if (c2.leidos.length === 0 || c1.leidos.length + c2.leidos.length !== new Set([...c1.leidos, ...c2.leidos]).size) F("3 · las dos corridas no suman proyectos distintos");
    // Un proyecto que falló (también en sus reintentos) sigue adelante en la cola: lo toma la corrida siguiente, no
    // la vuelta siguiente, que es lo que haría un cursor de una posición.
    const conFalla = await corrida({ ids, avance: null, inicio: 0, resultado: (id) => (id === 1001 ? { ms: 300, error: "http 403" } : { ms: 1600 }) });
    const sig = U.ordenDeLectura(ids.map((idProyecto) => ({ idProyecto })), conFalla.avance);
    if (conFalla.leidos.includes(1001) || sig[0]?.idProyecto !== 1001) F(`3 · un proyecto que falló no queda primero para la corrida siguiente (queda ${sig.findIndex((p) => p.idProyecto === 1001)}º)`);
    // El avance: el que no estaba entra con su alta (y su marca, si tiene); el que ya no está, sale; el resto queda.
    const ahora = new Date("2026-10-14T02:00:00Z");
    const av = U.completarAvance({ "1": { leido: "2026-10-12T14:00:00.000Z", alta: "2026-10-01T00:00:00.000Z" }, "9": { leido: null, alta: "2026-10-01T00:00:00.000Z" } }, [1, 2, 3], new Map([[2, "2026-10-10T14:00:00.000Z"]]), ahora);
    const ok = av["1"]?.leido === "2026-10-12T14:00:00.000Z" && av["2"]?.leido === "2026-10-10T14:00:00.000Z" && av["2"]?.alta === ahora.toISOString()
      && av["3"]?.leido === null && !("9" in av) && U.ordenDeLectura([{ idProyecto: 1 }, { idProyecto: 2 }, { idProyecto: 3 }], av).map((p) => p.idProyecto).join() === "3,2,1";
    if (!ok) F(`3 · el avance no se completa ni ordena bien: ${JSON.stringify(av)}`);
  }

  // ── 4 · ningún proyecto más de 4 días sin leer; con MÁS PROYECTOS DE LOS QUE CABEN, la corrida queda en rojo ──
  {
    const hoy = Array.from({ length: 434 }, (_, i) => 1000 + i);
    const sano = await dias(8, hoy, diaNormal);
    if (sano.primeraRoja !== null || sano.horasMax > U.MAX_DIAS_SIN_LEER * 24) F(`4 · con los 434 proyectos de hoy, alguno pasó ${sano.horasMax} h sin leer (la primera corrida en rojo fue la ${sano.primeraRoja})`);
    const demasiados = Array.from({ length: Math.round(U.capacidadEnPlazo() * 1.25) }, (_, i) => 1000 + i);
    const lleno = await dias(8, demasiados, diaNormal);
    if (lleno.primeraRoja === null) F(`4 · con ${demasiados.length} proyectos (caben ${U.capacidadEnPlazo()} en 4 días) ninguna corrida quedó en rojo: el atraso pasa en silencio`);
    else if (!/más de 4 días sin leer/.test(lleno.conMotivo)) F(`4 · con más proyectos de los que caben, la corrida en rojo no dice por qué (${lleno.conMotivo || "queda verde"})`);
    // Un vencido es un fallido aunque todo lo demás haya salido bien.
    const c = U.conteoUnidades({ intentados: [1, 2], conError: [], conDisponibles: 2, escrituraFallo: false, reconFallo: false, vencidos: [7] });
    if (resultadoCron(c) === "ok" || c.fallidos !== 1 || c.procesados !== 3) F(`4 · un proyecto pasado de plazo no tumba la corrida (${JSON.stringify(c)})`);
    // El plazo cuenta desde la última lectura o, si nunca se leyó, desde que entró a la lista.
    const ahora = new Date("2026-10-20T00:00:00Z");
    const s = U.sinLeerHace({
      "1": { leido: "2026-10-15T23:00:00.000Z", alta: "2026-10-01T00:00:00.000Z" },
      "2": { leido: "2026-10-16T01:00:00.000Z", alta: "2026-10-01T00:00:00.000Z" },
      "3": { leido: null, alta: "2026-10-17T00:00:00.000Z" },
      "4": { leido: "2026-10-01T00:00:00.000Z", alta: "2026-10-18T00:00:00.000Z" },
    }, ahora);
    if (s.vencidos.join() !== "1" || s.horasMax !== 97) F(`4 · el plazo no se cuenta desde la última lectura o el alta (${JSON.stringify(s)})`);
  }

  // ── 5 · EL GATE: los proyectos de hoy caben en 4 días ────────────────────────────────────────────────
  {
    const sched = (JSON.parse(leer("vercel.json")) as { crons: { path: string; schedule: string }[] }).crons.find((c) => c.path === "/api/data/scrape-unidades-nuevas")?.schedule ?? "";
    const corridas = (/^0 ([\d,]+) \* \* \*$/.exec(sched)?.[1] ?? "").split(",").filter(Boolean).length;
    if (corridas !== U.CORRIDAS_POR_DIA) F(`5 · vercel.json corre el pase ${corridas} veces al día y la capacidad supone ${U.CORRIDAS_POR_DIA}`);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) F("5 · NO CORRIÓ: faltan las variables de Supabase (correr con --env-file=.env.local)");
    else {
      const { proyectos, error } = await U.leerProyectosDelCiclo(createClient(url, key));
      const extra = Number(process.env.UNIDADES_PROYECTOS_EXTRA ?? 0);
      const n = proyectos.length + extra;
      if (error || proyectos.length === 0) F(`5 · NO CORRIÓ: no se pudieron leer los proyectos (${error ?? "cero filas"})`);
      else if (n > U.capacidadEnPlazo()) F(`5 · hay ${n} proyectos y en ${U.MAX_DIAS_SIN_LEER} días caben ${U.capacidadEnPlazo()} (${U.proyectosPorCorrida()} por corrida × ${U.CORRIDAS_POR_DIA} al día): alguno quedaría más de ${U.MAX_DIAS_SIN_LEER} días sin leer`);
      else console.log(`  · capacidad: ${n} proyectos, caben ${U.capacidadEnPlazo()} en ${U.MAX_DIAS_SIN_LEER} días (${U.proyectosPorCorrida()} por corrida × ${U.CORRIDAS_POR_DIA} al día)`);
    }
  }

  // ── 6 · el cableado de la ruta ──────────────────────────────────────────────────────────────────────
  {
    if (!/const corrida = await conTope\(correr\(supabase, dry, t0, progreso\), t0 \+ TOPE_DURO_UNIDADES_MS - Date\.now\(\)\);/.test(ruta)) F("6 · el trabajo de la corrida no va entero bajo el techo de 280 s");
    if (ruta.indexOf("const t0 = Date.now();") < 0 || ruta.indexOf("const t0 = Date.now();") > ruta.indexOf("latirCron(")) F("6 · el reloj de la corrida no arranca antes del latido");
    if (!/hastaMs: t0 \+ PRESUPUESTO_UNIDADES_MS - RESERVA_ESCRITURA_MS,/.test(ruta)) F("6 · las lecturas no paran a tiempo para escribir (el corte no es presupuesto − reserva desde el inicio)");
    const i = (re: RegExp) => ruta.search(re);
    const pasos = [
      i(/if \(!anterior\.ok\) return \{ conteo: CORRIDA_FALLIDA/),
      i(/const avance = completarAvance\(anterior\.avance, proyectos\.map\(\(p\) => p\.idProyecto\), ultimaMarca, new Date\(\)\);/),
      i(/const cola = ordenDeLectura\(proyectos, avance\);/),
      i(/const lectura = await leerConPresupuesto\(cola, /),
      i(/const leidos = escrituraFallo \? \[\] : resultados\.filter\(\(r\) => !r\.error\)\.map\(\(r\) => r\.idProyecto\);/),
      i(/const avanceNuevo = marcarLeidos\(avance, leidos, ahora\);/),
      i(/const \{ vencidos, horasMax \} = sinLeerHace\(avanceNuevo, ahora\);/),
      i(/const guardado = await guardarAvanceUnidades\(supabase, avanceNuevo, \{/),
      i(/const conteo = conteoUnidades\(\{[\s\S]{0,200}?vencidos,\s*\}\);/),
    ];
    if (pasos.some((x) => x < 0) || pasos.some((x, k) => k > 0 && x < pasos[k - 1])) F(`6 · la ruta no arma la corrida en orden (dónde quedó → completar → ordenar → leer → leídos con todo escrito → marcar → vencidos → guardar → conteo): ${pasos.join(",")}`);
    if (!/if \(!dry\) \{\s*const guardado = await guardarAvanceUnidades/.test(ruta)) F("6 · el ensayo (?dry=1) guarda dónde quedó");
    if (!/if \(!guardado\) \{[^}]*escrituraFallo = true;/.test(ruta)) F("6 · si no se guarda dónde quedó, la corrida no queda en rojo (la siguiente empezaría por los mismos sin que nadie lo sepa)");
    const techo = ruta.slice(ruta.indexOf("if (!corrida.listo) {"), ruta.indexOf("return cerrarConTope(supabase, corrida.valor.conteo"));
    if (!/return cerrarConTope\(supabase, CORRIDA_FALLIDA, \{ cortadoPorTecho: true/.test(techo) || /guardarAvanceUnidades|marcarLeidos/.test(techo)) F("6 · cortada por el techo, la corrida no queda como fallida (o marca como leído lo que no se sabe si se escribió)");
    if (/return cerrarCron\(/.test(ruta) || !/conTope\(cerrarCron\(sb, NOMBRE, conteo, extra, opts\), Math\.max\(1_000, t0 \+ 295_000 - Date\.now\(\)\)\)/.test(ruta)) F("6 · el cierre no tiene techo (si la base no responde, la respuesta llega pasado el corte)");
    const log = ruta.slice(ruta.indexOf("console.log(`[${NOMBRE}] cierre"));
    if (!/^console\.log\(`\[\$\{NOMBRE\}\] cierre \$\{JSON\.stringify\(\{[^`]*ms: timing\.total_ms,[^`]*intentados: intentados\.length,[^`]*noAlcanzados: lectura\.noAlcanzados,[^`]*msPasoMax: lectura\.msPasoMax,[^`]*vencidos: vencidos\.length,/.test(log)) F("6 · el cierre no deja en los logs la duración, cuántos leyó y cuántos quedaron, el paso más largo y los vencidos");
    if (/CICLO_DIAS|% CICLO|searchParams\.has\("batch"\)/.test(ruta)) F("6 · vuelve la rotación por tercios (sin reloj ni memoria de lo leído)");
    // Dónde quedó va a `metrics_daily` (solo el servidor), nunca a `config`, que cualquiera lee con la anon key.
    const avanceLib = lib.slice(lib.indexOf("export async function leerAvanceUnidades"), lib.indexOf("export async function leerProyectosDelCiclo"));
    if (!/from\("metrics_daily"\)/.test(avanceLib) || !/guardarMetrica\(sb, /.test(avanceLib) || /from\("config"\)/.test(avanceLib)) F("6 · dónde quedó no se guarda en `metrics_daily` (o se guarda en `config`, que es pública)");
  }

  // ── 7 · el techo: un paso que no vuelve no lleva la corrida al corte ────────────────────────────────────
  {
    const nunca = new Promise<never>(() => {});
    const progreso = { intentados: 0, leidos: 0 };
    const p = portal(() => ({ ms: 100 }));
    const leerColgado = async (x: P): Promise<R> => (x.idProyecto === 4 ? nunca : p.leerP(x));
    const t = Date.now();
    const c = await conTope(U.leerConPresupuesto([1, 2, 3, 4, 5, 6].map((idProyecto) => ({ idProyecto })), leerColgado, RITMO, p.reloj(1e9), progreso), 40);
    if (c.listo || Date.now() - t > 1000) F("7 · con un pedido colgado, el techo no corta la espera");
    if (progreso.intentados !== 2 || progreso.leidos !== 2) F(`7 · cortada por el techo, la corrida no sabe hasta dónde llegó (${JSON.stringify(progreso)})`);
  }

  if (fallas.length) {
    console.log(`  ✗ UNIDADES-PRESUPUESTO · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — ninguna lectura empieza pasados los 210 s y los que fallan alcanzan su reintento (también con el portal caído del 13-oct); la siguiente corrida sigue por los que esta no leyó; con los proyectos de hoy nadie pasa 4 días sin leer y con más de los que caben la corrida queda en rojo y lo dice; techo de 280 s");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runUnidadesPresupuestoTier().then((r) => process.exit(r.hard ? 1 : 0));
}
