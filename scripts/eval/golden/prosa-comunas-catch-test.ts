/**
 * TIER PROSA-COMUNAS — la prosa de las páginas de comuna se regenera sola (20-oct-2026, goal de Fabrizio).
 *
 *   1 · EL CASO: con una prosa DESFASADA (Maipú: el 2D se le dio vuelta) y una AL DÍA (Ñuñoa), el cron regenera la de
 *       Maipú —una llamada al modelo, una fila guardada con la foto nueva y el prompt vigente— y no toca la de Ñuñoa:
 *       ni una llamada, ni una escritura.
 *   2 · LOS CONTROLES: una cifra que no está en los datos se rechaza y se reintenta UNA vez diciendo qué se rechazó; si
 *       el reintento pasa, se guarda. Si vuelve a fallar (aquí, una comparación que no cuadra con el puesto), no se
 *       guarda nada —queda la anterior—, no hay tercer intento y la comuna sale como rechazada. Si el modelo no
 *       respondió, el reintento repite el pedido tal cual. Un ensayo genera y no guarda.
 *   3 · EL CABLEADO: la ruta del cron corre ese núcleo con los números vivos del roster, late y cierra como los demás,
 *       cuenta lo que quedó con la anterior como falla, revalida lo regenerado; corre el lunes después de la evaluación
 *       nocturna; está vigilada; el script a mano usa el mismo núcleo; su falla va al resumen del día (el camino entero
 *       lo prueba ALERTAS-CRONS §9).
 *
 * Todo con fixtures puros: un generador falso que devuelve lo que el caso pide y una escritura que anota. 0 tokens.
 * En rojo contra producción (master 5df840af, sin el núcleo) y con mutaciones, una regla por vez (acta al pie).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => (existsSync(join(RAIZ, p)) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
function cargar<T>(ruta: string): T | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(join(RAIZ, ruta)) as T;
  } catch {
    return null;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Stats = any;

/** Una tipología con los números del caso (la misma forma que scripts/test-drift-prosa-comuna.ts). */
function tip(over: Record<string, unknown> = {}) {
  const base = {
    dorms: 2, nArriendos: 400, nVentas: 500,
    arriendoCLP: 950_000, ventaCLP: 324_000_000, ventaUF: 7_942,
    rentabilidadBruta: 3.5, dividendoCLP: 1_239_700,
    brechaCLP: -289_700, cubre: false,
    precioCuotaCLP: 248_000_000, precioCuotaUF: 6_086,
    deltaPct: -23.4, pieNecesarioPct: 39, banda: "dificil", muestraChica: false,
    referencia: { fuente: "porTipologia", n: 400, medianaCLP: 950_000 },
  };
  const cubre = (over.cubre as boolean | undefined) ?? base.cubre;
  return { ...base, veredictoFila: cubre ? "sePagaSola" : "noSePagaSola", ...over };
}
function comuna(slug: string, nombre: string, enCalculo: number, tipologias: unknown[]): Stats {
  return {
    nombre, slug, totalPropiedades: enCalculo, arriendoRepresentativo: 950_000, rentabilidadBruta: 3.5, precioM2Promedio: 101.1, arriendoUFm2Mes: 0.2,
    nSegmentos: tipologias.length, tipologias,
    supuestos: { piePct: 20, plazoAnos: 30, tasaAnual: 4.1, tasaEsViva: true, ufCLP: 41_189 },
    procedencia: { activosTotales: enCalculo + 100, sinSuperficie: 50, fueraDeRango: 30, bajoUmbral: 0, ventasDescartadas: 20, enCalculo, ultimaActualizacion: "2026-10-19" },
  };
}

/** Un párrafo que pasa TODOS los controles con los números de Maipú (lo verifica el caso antes de usarlo). */
const VALIDO =
  "En Maipú el 2D no se paga solo con los supuestos de la página: el arriendo mediano de $950.000 no alcanza la cuota " +
  "del crédito de $1.239.700, y faltan $289.700 al mes. Para que el número cierre habría que comprarlo a UF 6.086, un " +
  "23,4% bajo la mediana, o poner un pie de 39%. La muestra es amplia, así que la lectura no depende de unos pocos avisos " +
  "sueltos. Esa distancia no se cierra regateando un poco en la visita: exige otra estructura de compra. Si buscas flujo " +
  "desde el primer mes, esta comuna no te lo da a precio de lista; solo sirve si tienes capital para cubrir la diferencia " +
  "o consigues un descuento real.";
/** Una cifra que no está en los datos. */
const INVENTADA = VALIDO.replace("$289.700", "$999.999");
/** Una comparación que no cuadra: Maipú es la 2.ª muestra de 2. */
const COMPARA_MAL = VALIDO.replace("La muestra es amplia,", "Maipú tiene la muestra más grande de las 25 comunas,");

export async function runProsaComunasTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER PROSA-COMUNAS (la prosa de las comunas se regenera sola: solo la desfasada, con sus controles · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  const gen = cargar<{
    regenerarProsas: (o: Record<string, unknown>) => Promise<any>;
    validarProsa: (t: string, s: Stats, c: unknown) => string[];
    SYSTEM_PROSA_COMUNA: string;
  }>("src/lib/data/comuna-prosa-generador");
  const cp = cargar<{ PROMPT_VERSION_COMUNA: number; snapshotDe: (s: Stats, lider: number | null) => unknown }>("src/lib/data/comuna-prosa");
  const cs = cargar<{ comparacionDe: (s: Stats, parque: Stats[]) => unknown }>("src/lib/data/comunas-seo");

  if (!gen?.regenerarProsas || !cp || !cs?.comparacionDe) {
    F("1 · no existe el núcleo de la regeneración (comuna-prosa-generador.ts › regenerarProsas)");
  } else {
    // ── 1 · EL CASO ─────────────────────────────────────────────────────────────
    const maipu = comuna("maipu", "Maipú", 300, [tip()]);
    const nunoa = comuna("nunoa", "Ñuñoa", 2700, [tip({ dorms: 1 })]);
    const parque = [maipu, nunoa];
    // Que el fixture sea coherente ANTES de medir con él: el válido pasa, los otros dos fallan por lo que dicen.
    const c = cs.comparacionDe(maipu, parque);
    const eV = gen.validarProsa(VALIDO, maipu, c), eI = gen.validarProsa(INVENTADA, maipu, c), eC = gen.validarProsa(COMPARA_MAL, maipu, c);
    if (eV.length || !eI.some((e) => /\$999\.999/.test(e)) || !eC.some((e) => /comparación falsa/.test(e)))
      F(`1 · el fixture no es coherente (válido: ${eV.join("; ") || "ok"} · inventada: ${eI.length} · comparación: ${eC.length})`);
    // Maipú: la foto guardada decía que el 2D se pagaba solo; hoy no. Ñuñoa: la foto es la de hoy, con el prompt vigente.
    const fotoVieja = cp.snapshotDe(comuna("maipu", "Maipú", 300, [tip({ cubre: true, brechaCLP: 50_000 })]), 2);
    const prosas = new Map<string, unknown>([
      ["maipu", { slug: "maipu", comuna: "Maipú", prosa: "la de antes", snapshot: fotoVieja, promptVersion: cp.PROMPT_VERSION_COMUNA, modelo: "x", generadaEn: "2026-09-03" }],
      ["nunoa", { slug: "nunoa", comuna: "Ñuñoa", prosa: "la de Ñuñoa", snapshot: cp.snapshotDe(nunoa, 1), promptVersion: cp.PROMPT_VERSION_COMUNA, modelo: "x", generadaEn: "2026-10-20" }],
    ]);
    const correr = async (respuestas: Array<string | Error>, extra: Record<string, unknown> = {}) => {
      const pedidos: Array<{ system: string; contenido: string }> = [];
      const filas: any[] = [];
      const cola = [...respuestas];
      const r = await gen.regenerarProsas({
        parque, prosas,
        generar: async (system: string, contenido: string) => {
          pedidos.push({ system, contenido });
          const x = cola.shift() ?? VALIDO;
          if (x instanceof Error) throw x;
          return { texto: x, inTok: 1000, outTok: 100 };
        },
        guardar: async (fila: unknown) => { filas.push(fila); },
        concurrencia: 1,
        ...extra,
      });
      return { r, pedidos, filas };
    };

    const uno = await correr([VALIDO]);
    if (uno.pedidos.length !== 1 || !/^COMUNA: Maipú\n/.test(uno.pedidos[0].contenido) || uno.pedidos[0].system !== gen.SYSTEM_PROSA_COMUNA)
      F(`1 · la desfasada no se pidió una vez, con su bloque y el prompt v6 (${uno.pedidos.length} pedidos)`);
    if (uno.filas.length !== 1 || uno.filas[0].slug !== "maipu" || uno.filas[0].prosa !== VALIDO || uno.filas[0].prompt_version !== cp.PROMPT_VERSION_COMUNA
      || JSON.stringify(uno.filas[0].snapshot) !== JSON.stringify(cp.snapshotDe(maipu, 2)))
      F("1 · la desfasada no quedó guardada con el párrafo, la foto de hoy y el prompt vigente");
    if (uno.pedidos.some((p) => /COMUNA: Ñuñoa/.test(p.contenido)) || uno.filas.some((f) => f.slug === "nunoa") || !uno.r.intactas.includes("nunoa"))
      F("1 · la que está al día se tocó (Ñuñoa se pidió o se escribió)");
    if (uno.r.regeneradas.join() !== "maipu" || uno.r.rechazadas.length || uno.r.llamadas !== 1 || uno.r.tokens.entrada !== 1000)
      F(`1 · el resultado no dice lo que pasó (${JSON.stringify({ regeneradas: uno.r.regeneradas, llamadas: uno.r.llamadas })})`);

    // ── 2 · LOS CONTROLES ───────────────────────────────────────────────────────
    const reintento = await correr([INVENTADA, VALIDO]);
    if (reintento.pedidos.length !== 2 || reintento.filas.length !== 1 || reintento.filas[0].prosa !== VALIDO)
      F(`2 · una cifra inventada no se rechazó y reintentó una vez (${reintento.pedidos.length} pedidos, ${reintento.filas.length} filas)`);
    else if (!reintento.pedidos[1].contenido.startsWith(reintento.pedidos[0].contenido) || !/se rechazó/.test(reintento.pedidos[1].contenido) || !/\$999\.999/.test(reintento.pedidos[1].contenido))
      F("2 · el reintento no dice qué se rechazó");
    const dosVeces = await correr([INVENTADA, COMPARA_MAL, VALIDO]);
    if (dosVeces.filas.length !== 0) F("2 · una prosa rechazada dos veces pisó la anterior");
    if (dosVeces.pedidos.length !== 2) F(`2 · hubo ${dosVeces.pedidos.length} intentos: es uno y un reintento`);
    if (dosVeces.r.rechazadas.length !== 1 || dosVeces.r.rechazadas[0].slug !== "maipu" || !dosVeces.r.rechazadas[0].errores.some((e: string) => /comparación falsa/.test(e)) || dosVeces.r.regeneradas.length)
      F("2 · la rechazada dos veces no sale como rechazada con su motivo");
    const caido = await correr([new Error("overloaded_error"), VALIDO]);
    if (caido.filas.length !== 1 || caido.pedidos.length !== 2 || caido.pedidos[1].contenido !== caido.pedidos[0].contenido)
      F("2 · si el modelo no respondió, el reintento no repite el pedido tal cual");
    const ensayo = await correr([VALIDO], { dry: true });
    if (ensayo.filas.length || ensayo.r.ensayo.length !== 1) F("2 · un ensayo guardó o no devolvió lo generado");
    const todas = await correr([VALIDO, VALIDO], { todas: true });
    if (todas.pedidos.length !== 2) F("2 · `todas` no regenera también las que están al día");
  }

  // ── 3 · EL CABLEADO ───────────────────────────────────────────────────────────
  const ruta = sinComentarios(leer("src/app/api/cron/prosa-comunas/route.ts"));
  if (!ruta) F("3 · no existe la ruta del cron (/api/cron/prosa-comunas)");
  else {
    if (!/\[parque, prosas\] = await Promise\.all\(\[getAllComunasStats\(\), getTodasLasProsas\(\)\]\);\s*parque = parque\.filter\(\(s\) => esComunaDelRoster\(s\.slug\)\);/.test(ruta)
      || !/const r = await regenerarProsas\(\{\s*parque,\s*prosas,\s*generar: generadorAnthropic\(new Anthropic\(\)\),/.test(ruta))
      F("3 · la ruta no corre el núcleo con los números vivos del roster");
    if (!/await sb\.from\("comuna_prosa"\)\.upsert\(fila, \{ onConflict: "slug" \}\);\s*if \(error\) throw new Error\(error\.message\);/.test(ruta)) F("3 · la ruta no guarda en comuna_prosa (o traga el error de la escritura)");
    if (!/latirCron\(sb, "prosa-comunas"\)/.test(ruta) || !/fallidos: r\.rechazadas\.length \+ r\.sinTiempo\.length \}/.test(ruta)) F("3 · la ruta no late, o lo que quedó con la anterior no cuenta como falla");
    if (/todas,\s*solo,\s*dry,/.test(ruta) === false || !/const dry = url\.searchParams\.get\("dry"\) === "1";/.test(ruta)) F("3 · la ruta no se puede ensayar ni correr a mano (dry, solo, todas)");
    if (!/if \(!dry\) for \(const slug of r\.regeneradas\) revalidatePath\(`\/comunas\/\$\{slug\}`\);/.test(ruta)) F("3 · lo regenerado no se revalida (la página es ISR de un día y mostraría la anterior)");
    if (!/presupuestoMs: PRESUPUESTO_MS/.test(ruta) || !(Number((ruta.match(/export const maxDuration = (\d+);/) ?? [])[1]) >= 600)) F("3 · sin presupuesto o sin tiempo para las 25 (medido: 88 s con 4 a la vez)");
  }
  const vj = JSON.parse(leer("vercel.json") || "{\"crons\":[]}") as { crons: Array<{ path: string; schedule: string }> };
  const cron = vj.crons.find((x) => x.path === "/api/cron/prosa-comunas");
  const eval_ = vj.crons.find((x) => x.path === "/api/cron/evaluar-avisos");
  if (!cron) F("3 · el cron no está en vercel.json");
  else {
    const [min, hora, , , dia] = cron.schedule.split(/\s+/);
    const primeraEval = eval_ ? Math.min(...eval_.schedule.split(/\s+/)[1].split(",").map(Number)) * 60 + Number(eval_.schedule.split(/\s+/)[0]) : 260;
    // La evaluación de la noche dura hasta su maxDuration (800 s ≈ 14 min): después de eso.
    if (dia !== "1" || !(/^\d+$/.test(min) && /^\d+$/.test(hora)) || Number(hora) * 60 + Number(min) < primeraEval + 14) F(`3 · el cron no corre el lunes después de la evaluación nocturna (${cron.schedule})`);
  }
  const hb = cargar<{ CRONS_VIGILADOS: Array<{ nombre: string; intervaloHoras: number }> }>("src/lib/cron-heartbeat");
  if (hb?.CRONS_VIGILADOS.find((x) => x.nombre === "prosa-comunas")?.intervaloHoras !== 168) F("3 · el cron no está vigilado como semanal (CRONS_VIGILADOS, 168 h)");
  const al = cargar<{ CRONS_AL_RESUMEN?: ReadonlySet<string>; esperaResumen: (n: string) => boolean }>("src/lib/cron-alertas");
  if (!al?.CRONS_AL_RESUMEN?.has("prosa-comunas") || !al.esperaResumen("prosa-comunas")) F("3 · la falla del cron no va al resumen del día de los crons");
  const scr = sinComentarios(leer("scripts/data/generar-prosa-comunas.ts"));
  if (!/const r = await regenerarProsas\(\{/.test(scr) || /messages\.create\(/.test(scr) || /const SYSTEM = `/.test(scr)) F("3 · el script a mano tiene su propia lógica (dos lugares que pueden separarse)");

  if (fallas.length) {
    console.log(`  ✗ PROSA-COMUNAS · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — la desfasada se regenera y la al día no se toca; cifra inventada o comparación que no cuadra, un reintento con lo rechazado y, si vuelve a fallar, queda la anterior; el lunes después de la evaluación, vigilado, con la falla al resumen del día");
  }
  return { hard: fallas.length };
}

/*
 * ⚠ ACTA (20-oct-2026) · verificado EN ROJO de dos maneras. (1) Contra producción: sobre master 5df840af —antes de este
 * cambio— el tier falla en las tres partes (no hay núcleo, ni ruta, ni cron). (2) Con mutaciones, una regla por vez y
 * restaurando por sha1 (runner del scratchpad de la sesión).
 */

if (require.main === module) {
  runProsaComunasTier().then(({ hard }) => process.exit(hard ? 1 : 0));
}
