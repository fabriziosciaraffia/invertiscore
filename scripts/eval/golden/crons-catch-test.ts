// ============================================================================
// GOLDEN · CRONS (29-sep-2026) — catch-test
// ============================================================================
//   scrape-unidades-nuevas no escribió una unidad del 03-ago al 29-sep y respondió 200 todos los días:
//   el GraphQL iba sin proxy, la fuente le devolvía el desafío del WAF (202, cuerpo vacío) y los errores
//   quedaban dentro del JSON. Este tier cuida las dos mitades del arreglo:
//   1 · EL SCRAPER: todo fetch a la fuente sale por el proxy; un 202 o un cuerpo vacío es un error
//       explícito; un proyecto despublicado no es falla; un batch sin una sola unidad es falla total.
//   2 · NINGÚN CRON FALLA EN SILENCIO: falla total o parcial → 500 (también con 0 procesados); todo cron
//       de vercel.json cierra por cerrarCron, late y está vigilado; el resultado queda para el panel y
//       manda a hola@ una alerta al día; el panel pinta rojo la falla, la corrida sin cierre y el dato
//       que dejó de escribirse; vigilar-crons corre cada 6 horas.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. Sin red y sin base: fetch y
// Supabase son dobles.
// Solo:  node --import tsx scripts/eval/golden/crons-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fallidosTolerados, fetchUnidadesProyecto, PREFIJO_VISTA_UNIDADES, TOLERANCIA_FALLA_PROYECTOS } from "../../../src/lib/services/scraper/toctoc-unidades";
import { cerrarCron, resultadoCron, statusCron, FUENTE_ALERTA, FUENTE_RESULTADO } from "../../../src/lib/cron-resultado";
import { CRONS_VIGILADOS, escrituraVencida, estaAtrasado, leerLatidos } from "../../../src/lib/cron-heartbeat";
import { fetchBCCH, INTENTOS_BCCH } from "../../../src/lib/bcch";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
// Solo bloques que abren al comienzo de la línea: un «*/*» dentro de un header Accept no es un comentario.
const sinComentarios = (s: string) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "");

// ── Doble de Supabase: registra escrituras y contesta lecturas según tabla + filtros ──
type Filtros = Record<string, unknown>;
function supabaseDoble(responder: (tabla: string, f: Filtros, unica: boolean) => unknown) {
  const escrituras: Array<{ tabla: string; fila: Record<string, unknown> }> = [];
  const sb = {
    from(tabla: string) {
      const f: Filtros = {};
      const b: Record<string, unknown> = {};
      const encadenar = (k: string) => (...a: unknown[]) => { f[k] = a.length === 1 ? a[0] : a; return b; };
      for (const m of ["select", "not", "order", "limit", "in", "like", "or", "gte", "lt"]) b[m] = encadenar(m);
      b.eq = (col: string, v: unknown) => { f[`eq:${col}`] = v; return b; };
      b.upsert = (fila: Record<string, unknown>) => { escrituras.push({ tabla, fila }); return Promise.resolve({ error: null }); };
      b.maybeSingle = () => Promise.resolve({ data: responder(tabla, f, true) ?? null, error: null });
      b.then = (ok: (v: unknown) => unknown) => ok({ data: responder(tabla, f, false) ?? [], error: null });
      return b;
    },
  };
  return { sb: sb as never, escrituras };
}

export async function runCronsTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER CRONS (ningún cron falla en silencio · 0 tokens) ───");

  // ── 1 · el scraper de unidades ──
  const base = { idProyecto: 4347128, url: "https://x/propiedades/compranuevo/departamento/macul/edificio/4347128", comuna: "Macul", lat: null, lng: null, direccion: null };
  const fetchReal = globalThis.fetch;
  // La ficha nueva (02-oct-2026): dos GETs por proyecto, el proyecto y sus disponibles. El doble contesta
  // según la dirección: `/floors-units` lleva los disponibles, la otra el proyecto.
  const conFetch = async (proyecto: [number, string], disponibles: [number, string] = [200, "{}"]) => {
    globalThis.fetch = (async (u: string) => {
      const [status, cuerpo] = String(u).endsWith("/floors-units") ? disponibles : proyecto;
      return new Response(cuerpo || null, { status });
    }) as typeof fetch;
    try { return await fetchUnidadesProyecto(base); } finally { globalThis.fetch = fetchReal; }
  };
  const proyectoSano = JSON.stringify({ status: "ok", data: { minimunPricesUF: 3000, maximunPricesUF: 4200, characteristics: [{ name: "Fecha de entrega: ", value: "2° Semestre 2027" }] } });
  const waf = await conFetch([202, ""]);
  if (!waf.error || !/202/.test(waf.error)) F(`1 · el desafío del WAF (202 sin cuerpo) no sale como error explícito (${waf.error ?? "sin error"})`);
  const vacio = await conFetch([200, ""]);
  if (!vacio.error || !/sin cuerpo/.test(vacio.error)) F(`1 · un 200 sin cuerpo no sale como error legible para la alerta (${vacio.error ?? "sin error"})`);
  const app = await conFetch([200, proyectoSano], [200, "<!DOCTYPE html><html>la app</html>"]);
  if (!app.error || !/no JSON/.test(app.error)) F(`1 · la app en vez del JSON (la dirección cambió, como el 02-oct) no sale como error (${app.error ?? "sin error"})`);
  const despub = await conFetch([404, ""]);
  if (despub.error || despub.disponibles.length !== 0) F(`1 · un proyecto que la ficha ya no tiene cuenta como falla (${despub.error})`);
  const bien = await conFetch([200, proyectoSano], [200, JSON.stringify({ status: "ok", data: { floors: [{ model: [{ units: [{ number: "101", characteristics: [{ name: "Dormitorios: ", value: 2 }, { name: "Baños: ", value: 1 }, { name: "Piso: ", value: 1 }, { name: "M2 útiles: ", value: "50.5 m2" }] }] }] }] } })]);
  if (bien.error || bien.disponibles.length !== 1 || bien.disponibles[0].m2Utiles !== 50.5 || bien.rango?.desdeUF !== 3000 || bien.rango?.hastaUF !== 4200 || bien.fechaEntrega !== "2° Semestre 2027") F("1 · una respuesta sana no trae su depto disponible, el rango y la entrega");

  for (const p of ["src/lib/services/scraper/toctoc.ts", "src/lib/services/scraper/toctoc-unidades.ts"]) {
    const s = sinComentarios(leer(p));
    const fetches = s.match(/await fetch\(/g)?.length ?? 0;
    const conProxy = s.match(/dispatcher: proxyDispatcher/g)?.length ?? 0;
    if (fetches === 0 || conProxy < fetches) F(`1 · ${p}: ${fetches - conProxy} fetch a la fuente sin el proxy (desde Vercel, la fuente contesta el desafío del WAF)`);
  }
  if (!/export const proxyDispatcher = process\.env\.PROXY_URL/.test(leer("src/lib/services/scraper/toctoc.ts"))) F("1 · el proxy no está exportado desde toctoc.ts");
  const uni = sinComentarios(leer("src/app/api/data/scrape-unidades-nuevas/route.ts"));
  if (!/const sinNinguna = delBatch\.length > 0 && conDisponibles\.length === 0;/.test(uni) || !/escrituraFallo \|\| sinNinguna\s*\? \{ procesados: delBatch\.length, exitosos: 0, fallidos: delBatch\.length \}/.test(uni)) F("1 · un batch sin un solo depto disponible (o con una escritura caída) no es falla total");

  // ── 1 · el reintento y la tolerancia (30-sep-2026): cada proyecto fallido se reintenta una vez; la
  // corrida es falla solo si después falla más del 5% ──
  if (TOLERANCIA_FALLA_PROYECTOS !== 0.05 || fallidosTolerados(4, 140) !== 0 || fallidosTolerados(7, 140) !== 0 || fallidosTolerados(8, 140) !== 8 || fallidosTolerados(1, 0) !== 0) F(`1 · la tolerancia no es «más del 5% tras el reintento» (4/140→${fallidosTolerados(4, 140)}, 8/140→${fallidosTolerados(8, 140)})`);
  if (!/for \(let intento = 0; intento < REINTENTOS; intento\+\+\) for \(let k = 0; k < resultados\.length; k\+\+\) \{\s*if \(!resultados\[k\]\.error\) continue;\s*const base = delBatch\.find\(\(p\) => p\.idProyecto === resultados\[k\]\.idProyecto\);\s*if \(!base\) continue;\s*await new Promise\(\(r\) => setTimeout\(r, PAUSA_REINTENTO_MS\)\);\s*resultados\[k\] = await fetchUnidadesProyecto\(base\);/.test(uni)) F("1 · los proyectos fallidos no se reintentan una vez, con pausa");
  // El ritmo de la ficha nueva (02-oct-2026): con 8 GETs en vuelo dio 403 en 42% de los proyectos.
  const ritmo = { conc: Number((uni.match(/const CONCURRENCIA = (\d+);/) ?? [])[1]), pausa: Number((uni.match(/const PAUSA_LOTE_MS = (\d+);/) ?? [])[1]), re: Number((uni.match(/const PAUSA_REINTENTO_MS = (\d+);/) ?? [])[1]) };
  if (!(ritmo.conc <= 2 && ritmo.pausa >= 1500 && ritmo.re >= 4000 && Number((uni.match(/const REINTENTOS = (\d+);/) ?? [])[1]) >= 2)) F(`1 · el pase de unidades va más rápido que lo que la ficha nueva tolera (${JSON.stringify(ritmo)})`);
  if (!/fallidos: fallidosTolerados\(conError\.length, delBatch\.length\)/.test(uni)) F("1 · la corrida no cuenta los fallidos con la tolerancia");

  // ── 2 · el status ──
  const casos: Array<[number, number, number, string, number]> = [
    [0, 0, 0, "ok", 200], [5, 5, 0, "ok", 200], [5, 3, 2, "parcial", 500], [5, 0, 5, "fallo", 500], [0, 0, 1, "fallo", 500],
  ];
  for (const [procesados, exitosos, fallidos, r, st] of casos) {
    const c = { procesados, exitosos, fallidos };
    if (resultadoCron(c) !== r || statusCron(c) !== st) F(`2 · ${JSON.stringify(c)} da ${resultadoCron(c)}/${statusCron(c)}, no ${r}/${st}`);
  }

  // ── 2 · todo cron de vercel.json cierra por cerrarCron, late y está vigilado ──
  const vj = JSON.parse(leer("vercel.json")) as { crons: { path: string; schedule: string }[] };
  const vigilados = new Set(CRONS_VIGILADOS.map((c) => c.nombre));
  for (const c of vj.crons) {
    const ruta = c.path.split("?")[0];
    const nombre = ruta.split("/").pop()!;
    const s = sinComentarios(leer(`src/app${ruta}/route.ts`));
    if (!vigilados.has(nombre)) F(`2 · ${nombre} no está en CRONS_VIGILADOS: el panel no lo ve`);
    if (!new RegExp(`latirCron\\([^,]+, "${nombre}"\\)`).test(s) && !(nombre === "vigilar-crons" && /latirCron\(sb, NOMBRE\)/.test(s))) F(`2 · ${nombre} no late`);
    if (!/cerrarCron\(/.test(s) || /respuestaCron\(/.test(s)) F(`2 · ${nombre} no cierra por cerrarCron`);
    // Toda otra respuesta es de auth, de parámetros (400) o de un ensayo.
    const lineas = s.split("\n");
    lineas.forEach((l, i) => {
      if (!/return NextResponse\.json\(/.test(l)) return;
      const ventana = lineas.slice(i, i + 4).join(" ");
      if (/Unauthorized|misconfigured|status: 400/.test(ventana)) return;
      if (/dry: true|errores\.length \? 207 : 200/.test(ventana)) return; // ensayos: no son corridas
      F(`2 · ${nombre}:${i + 1} responde sin pasar por cerrarCron: ${l.trim().slice(0, 70)}`);
    });
  }
  const vigilar = vj.crons.find((c) => c.path === "/api/cron/vigilar-crons");
  if (!vigilar || !/^\d+ \*\/6 \* \* \*$/.test(vigilar.schedule)) F("2 · vigilar-crons no corre cada 6 horas");

  // ── 2 · cerrarCron deja el resultado y alerta una vez al día ──
  {
    const { sb, escrituras } = supabaseDoble((tabla, f) => (tabla === "metrics_daily" && f["eq:fuente"] === FUENTE_ALERTA ? { valor: 1 } : null));
    const r = await cerrarCron(sb, "prueba", { procesados: 3, exitosos: 0, fallidos: 3 }, { error: "x" });
    const fila = escrituras.find((e) => e.fila.fuente === FUENTE_RESULTADO);
    if (r.status !== 500 || !fila || fila.fila.valor !== 2 || fila.fila.metrica !== "prueba") F("2 · una corrida fallida no queda registrada como falla (valor 2) o no responde 500");
    if (escrituras.some((e) => e.fila.fuente === FUENTE_ALERTA)) F("2 · con la alerta del día ya enviada, vuelve a alertar");
    const ok = supabaseDoble(() => null);
    const r2 = await cerrarCron(ok.sb, "prueba", { procesados: 2, exitosos: 2, fallidos: 0 });
    if (r2.status !== 200 || ok.escrituras.find((e) => e.fila.fuente === FUENTE_RESULTADO)?.fila.valor !== 0 || ok.escrituras.some((e) => e.fila.fuente === FUENTE_ALERTA)) F("2 · una corrida sana no queda en verde o alerta igual");
    const dry = supabaseDoble(() => null);
    await cerrarCron(dry.sb, "prueba", { procesados: 1, exitosos: 0, fallidos: 1 }, {}, { registrar: false });
    if (dry.escrituras.length) F("2 · un ensayo (dry) deja resultado o alerta");
  }
  const cr = sinComentarios(leer("src/lib/cron-resultado.ts"));
  if (!/await guardarMetrica\(sb, \{ fecha: hoy, fuente: FUENTE_ALERTA, metrica, valor: 1 \}\);\s*const \{ sendAlertaCronInterna \}/.test(cr)) F("2 · la alerta no se anota antes de mandarse (se repetiría por corrida)");
  if (!/enviarCorreo\("alerta_cron", null, \{ from: FROM_EMAIL, to: 'hola@refranco\.ai'/.test(leer("src/lib/email.ts"))) F("2 · la alerta no va a hola@");

  // ── 2 · el panel pinta rojo la falla, la corrida sin cierre y el dato que dejó de escribirse ──
  {
    const ahora = Date.now();
    const hace = (h: number) => new Date(ahora - h * 3600e3).toISOString();
    const latidos = CRONS_VIGILADOS.map((c) => ({ metrica: c.nombre, medido_at: hace(c.nombre === "reconcile-subscriptions" ? 1 : 0.5) }));
    const resultados = CRONS_VIGILADOS.map((c) => ({
      metrica: c.nombre,
      valor: c.nombre === "monthly-grants" ? 2 : c.nombre === "expire-grace" ? 1 : 0,
      medido_at: c.nombre === "reconcile-subscriptions" ? hace(2) : hace(0.49),
    }));
    const { sb } = supabaseDoble((tabla, f, unica) => {
      if (tabla === "metrics_daily" && !unica) return f["eq:fuente"] === "cron" ? latidos : f["eq:fuente"] === FUENTE_RESULTADO ? resultados : [];
      if (unica) {
        // Frescura: todo fresco salvo las métricas de Meta Ads, que dejaron de escribirse hace 57 días (el
        // caso del 03-ago, con las unidades de obra nueva; ese cron quedó congelado el 02-oct).
        const col = String(f.select);
        return { [col]: f["eq:fuente"] === "meta_ads" ? hace(24 * 57) : hace(1) };
      }
      return [];
    });
    const estado = await leerLatidos(sb);
    const de = (n: string) => estado.find((e) => e.nombre === n)!;
    if (!de("monthly-grants").enRojo || de("monthly-grants").ultimoResultado !== "fallo") F("2 · una corrida fallida no se pinta en rojo");
    if (!de("expire-grace").enRojo || de("expire-grace").ultimoResultado !== "parcial") F("2 · una corrida con falla parcial no se pinta en rojo");
    if (!de("reconcile-subscriptions").sinCierre || !de("reconcile-subscriptions").enRojo) F("2 · una corrida que latió y no cerró no se pinta en rojo");
    if (!de("meta-ads").sinEscribir || !de("meta-ads").enRojo) F("2 · un cron que dejó de escribir lo que escribía (57 días) no se pinta en rojo");
    const sanos = estado.filter((e) => !["monthly-grants", "expire-grace", "reconcile-subscriptions", "meta-ads"].includes(e.nombre));
    const falsos = sanos.filter((e) => e.enRojo).map((e) => `${e.nombre}: ${e.motivo}`);
    if (falsos.length) F(`2 · crons sanos en rojo: ${falsos.join(" · ")}`);
    for (const n of ["scrape-nuevos", "scrape-unidades-nuevas", "backfill-toctoc", "update-market", "sentry-metrics", "meta-ads", "evaluar-avisos"]) {
      if (!CRONS_VIGILADOS.find((c) => c.nombre === n)?.frescura) F(`2 · ${n} escribe en cada corrida y no tiene frescura vigilada`);
    }
  }
  // ── 2 · el pase de unidades vuelve (02-oct-2026, congelado ese mismo día): diario, vigilado, y su
  // frescura mide la marca de vista —lo que escribe en cada corrida—, no scraped_at, que es la fecha del precio. ──
  {
    if (vj.crons.find((c) => c.path === "/api/data/scrape-unidades-nuevas")?.schedule !== "0 14 * * *") F("2 · el pase de unidades no corre cada día");
    const vu = CRONS_VIGILADOS.find((c) => c.nombre === "scrape-unidades-nuevas");
    if (!vu || vu.intervaloHoras !== 24 || vu.frescura?.maxHoras !== 48) F("2 · el pase de unidades no está vigilado como diario (24 h, frescura 48 h)");
    const lectura = { sel: "", like: "" };
    const visto = await vu?.frescura?.leer({ from: () => {
      const q: Record<string, unknown> = {};
      q.select = (c: string) => { lectura.sel = c; return q; };
      q.like = (_: string, v: string) => { lectura.like = v; return q; };
      q.order = () => q; q.limit = () => q;
      q.maybeSingle = () => Promise.resolve({ data: { seen_pass_id: "unidades@2026-10-03T14:01:00.000Z" }, error: null });
      return q;
    } } as never);
    if (lectura.sel !== "seen_pass_id" || lectura.like !== "unidades@%" || visto !== "2026-10-03T14:01:00.000Z") F(`2 · la frescura de unidades no lee la marca de vista (${lectura.sel} · ${visto})`);
    if (PREFIJO_VISTA_UNIDADES !== "unidades@") F("2 · el prefijo de la marca de vista no es el que lee la vigilancia");
  }
  // ── 3 · update-market (30-sep-2026): el BCCh falla de a ratos; se reintenta y la razón llega al correo ──
  {
    const credReal = [process.env.BCCH_API_USER, process.env.BCCH_API_PASS];
    process.env.BCCH_API_USER = "prueba"; process.env.BCCH_API_PASS = "prueba";
    const respuestas = (lista: Array<[number, unknown]>) => {
      let k = 0;
      globalThis.fetch = (async () => { const [st, body] = lista[Math.min(k++, lista.length - 1)]; return new Response(JSON.stringify(body), { status: st }); }) as typeof fetch;
      return () => k;
    };
    const ok = { Codigo: 0, Series: { Obs: [{ value: "41057.2", statusCode: "OK" }] } };
    try {
      let n = respuestas([[503, {}], [503, {}], [200, ok]]);
      const r1 = await fetchBCCH("S", "a", "b", [0, 0, 0]);
      if (!r1.obs || n() !== 3) F(`3 · el BCCh no se reintenta hasta ${INTENTOS_BCCH} veces (${n()} llamadas, ${r1.error ?? "ok"})`);
      n = respuestas([[503, {}]]);
      const r2 = await fetchBCCH("S", "a", "b", [0, 0, 0]);
      if (r2.obs || !/http 503/.test(r2.error ?? "") || !/tras 3 intentos/.test(r2.error ?? "")) F(`3 · una falla del BCCh no dice por qué (${r2.error})`);
      respuestas([[200, { Codigo: -5, Descripcion: "Invalid username or password" }]]);
      const r3 = await fetchBCCH("S", "a", "b", [0, 0, 0]);
      if (!/Codigo -5: Invalid username/.test(r3.error ?? "")) F(`3 · el Codigo del BCCh no llega al motivo (${r3.error})`);
      delete process.env.BCCH_API_USER;
      n = respuestas([[200, ok]]);
      const r4 = await fetchBCCH("S", "a", "b", [0, 0, 0]);
      if (r4.obs || n() !== 0 || !/sin credenciales/.test(r4.error ?? "") || /tras/.test(r4.error ?? "")) F(`3 · sin credenciales igual llama o reintenta (${r4.error})`);
    } finally {
      globalThis.fetch = fetchReal;
      process.env.BCCH_API_USER = credReal[0]; process.env.BCCH_API_PASS = credReal[1];
      if (credReal[0] === undefined) delete process.env.BCCH_API_USER;
      if (credReal[1] === undefined) delete process.env.BCCH_API_PASS;
    }
    const um = sinComentarios(leer("src/app/api/data/update-market/route.ts"));
    if (!/import \{ fetchBCCH \} from "@\/lib\/bcch";/.test(um) || /async function fetchBCCH/.test(um)) F("3 · update-market no usa el fetchBCCH con reintento");
    if (!/\{ success: escritos === 2, results, errors \}\);/.test(um)) F("3 · el motivo de la falla no viaja al correo (errors)");
  }

  // ── 3 · la vigilancia: un cron nuevo no está atrasado antes de su primera corrida, y la falla de ayer
  // no se re-avisa al cambiar el día (ya avisó cerrarCron) ──
  {
    const t0 = Date.parse("2026-09-29T13:00:00Z");
    const nuevo = { intervaloHoras: 24, desde: "2026-09-29T13:00:00Z" };
    if (estaAtrasado(nuevo, null, t0 + 20 * 3600e3)) F("3 · un cron nuevo figura atrasado antes de su primera corrida");
    if (!estaAtrasado(nuevo, null, t0 + 49 * 3600e3)) F("3 · un cron nuevo que nunca corrió en 2 intervalos no figura atrasado");
    if (!estaAtrasado({ intervaloHoras: 24 }, null) || !estaAtrasado(nuevo, 49) || estaAtrasado(nuevo, 30)) F("3 · la regla de atraso cambió para los crons que ya corrieron o sin fecha de alta");
    // El ritmo se cuenta desde el deploy que lo cambió (02-oct-2026): el 01-oct a las 18:45 backfill-toctoc
    // llevaba 88 h desde su última corrida semanal, 4 h después de pasar a diario. No estaba atrasado.
    const cambio = Date.parse("2026-10-01T14:27:00Z");
    const diario = { intervaloHoras: 24, cadenciaDesde: "2026-10-01T14:27:00Z" };
    if (estaAtrasado(diario, 88, cambio + 4.3 * 3600e3)) F("3 · un cron que cambió de ritmo figura atrasado por la corrida que se esperó con el ritmo viejo");
    if (!estaAtrasado(diario, 49, cambio + 61 * 3600e3)) F("3 · con el ritmo nuevo, saltarse dos corridas no figura atrasado");
    if (escrituraVencida(diario, "2026-09-28T03:00:00Z", 48, cambio + 4.3 * 3600e3) || !escrituraVencida(diario, "2026-10-02T03:00:00Z", 48, Date.parse("2026-10-04T04:00:00Z"))) F("3 · la frescura no cuenta desde el cambio de ritmo");
    for (const n of ["backfill-toctoc", "evaluar-avisos"]) if (CRONS_VIGILADOS.find((c) => c.nombre === n)?.cadenciaDesde !== "2026-10-01T14:27:00Z") F(`3 · ${n} no cuenta su ritmo desde el deploy que lo pasó a diario`);
    if (!/sinEscribir = escrituraVencida\(cron, ultimaEscritura, cron\.frescura\.maxHoras\);/.test(sinComentarios(leer("src/lib/cron-heartbeat.ts")))) F("3 · el panel mide la frescura sin el cambio de ritmo");
    const vg = sinComentarios(leer("src/app/api/cron/vigilar-crons/route.ts"));
    const cuerpo = (vg.match(/function motivoDeAlerta[\s\S]*?\n\}/) ?? [""])[0];
    if (!cuerpo || /falla|ultimoResultado/.test(cuerpo) || !/if \(motivo === null\) continue;/.test(vg)) F("3 · la vigilancia vuelve a avisar la falla de una corrida (ya avisó cerrarCron)");
  }

  if (!/const cronsAtrasados = latidos\.filter\(\(l\) => l\.enRojo\);/.test(leer("src/app/admin/operacion/page.tsx"))) F("2 · el panel no pinta con enRojo (solo con «no corrió»)");

  if (fallas.length) {
    console.log(`  ✗ CRONS · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el scraper sale por el proxy y el 202 es error; toda falla responde 500, queda en rojo en el panel y alerta a hola@ una vez al día; la vigilancia ve el cron que no cierra y el que dejó de escribir");
  }
  return { hard: fallas.length };
}

// ── ACTA DE MUTACIONES ─────────────────────────────────────────────────────────
// 29-sep-2026, scratchpad mutar.py: 20/20 en rojo, restauradas byte a byte.
//   M1  el GraphQL sin proxy (el bug del 03-ago) ............... 1 · fetch a la fuente sin el proxy
//   M2  `!r.ok` en vez de `status !== 200` (el 202 pasa) ........ 1 · el desafío del WAF no sale como error
//   M3  sin chequeo de cuerpo vacío ............................ 1 · no sale como error legible (quedó VERDE
//       al principio: el JSON.parse revienta igual; el tier pasó a exigir el mensaje)
//   M4  proyecto despublicado como falla ....................... 1 · despublicado cuenta como falla
//   M5  batch sin unidades no es falla ......................... 1 · no es falla total
//   M6  el parcial vuelve a 2xx ................................ 2 · parcial/200
//   M7  0 procesados con 1 fallido es ok ....................... 2 · ok/200
//   M8  sentry sin config responde 200 a mano .................. 2 · responde sin pasar por cerrarCron
//   M9  meta-ads fuera de CRONS_VIGILADOS ...................... 2 · el panel no lo ve
//   M10 scrape-nuevos responde a mano .......................... 2 · no cierra por cerrarCron
//   M11 el ensayo (dry) registra ............................... 2 · deja resultado o alerta
//   M12 alerta sin deduplicar .................................. 2 · vuelve a alertar
//   M13 el rojo ignora el resultado ............................ 2 · una corrida fallida no se pinta en rojo
//   M14 sin «latió y no cerró» ................................. 2 · no se pinta en rojo
//   M15 unidades sin frescura .................................. 2 · 57 días sin escribir no se pinta en rojo
//   M16 el panel vuelve a mirar solo el atraso ................. 2 · el panel no pinta con enRojo
//   M17 vigilar-crons diario ................................... 2 · no corre cada 6 horas
//   M18 la alerta a otro correo ................................ 2 · no va a hola@
//   M19 expire-grace responde 500 a mano ....................... 2 · responde sin pasar por cerrarCron
//   M20 un fetch del listado sin proxy ......................... 1 · fetch a la fuente sin el proxy
// 02-oct-2026 (unidades congeladas; el chequeo se dio vuelta el mismo día al volver el pase): 4/4 en rojo.
// 02-oct-2026 (la ficha nueva: disponibles, sin precio): 8/8 en rojo.
//   F1 la app (HTML) pasa como JSON vacío ........................ 1 · no sale como error
//   F2 el 202 no es error ........................................ 1 · el desafío del WAF no sale como error
//   F3 el 404 es falla ........................................... 1 · un proyecto que la ficha ya no tiene cuenta como falla
//   F4 la ficha sin proxy ........................................ 1 · fetch a la fuente sin el proxy
//   F5 el pase semanal ........................................... 2 · no corre cada día
//   F6 la frescura por scraped_at (la fecha del precio) ........... 2 · no lee la marca de vista
//   F7 fuera de la vigilancia .................................... 2 · no está vigilado
//   F8 la entrega no se escribe (en AVISOS §1; re-corrida sobre la llamada de las vistas, con F9:
//      la función ignora la entrega; 2/2) ........................... 1 · no pasa la fecha de entrega
// 02-oct-2026 (el ritmo de la ficha nueva: 403 en 57 de 137 proyectos con 8 GETs en vuelo): 3/3 en rojo.
//   R1 el reintento sin pausa .................................... 1 · no se reintentan con pausa
//   R2 sin reintento ............................................. 1 · ídem
//   R3 de vuelta a 4 proyectos en vuelo .......................... 1 · más rápido de lo que tolera
//   (segundo ensayo: 403 en 18 de 137 con 2 en vuelo y 600 ms → 1,5 s entre lotes y dos reintentos a 4 s;
//   R4 un solo reintento, R5 la pausa de 600 ms: 2/2 en rojo)
//   Z1 vuelve al calendario de vercel.json .................... 2 · sigue en el calendario
//   Z2 vuelve a la vigilancia .................................. 2 · alertaría todos los días
//   Z3 la ruta no dice que está congelada ...................... 2 · no dice que está congelada
//   Z4 el panel deja de ver lo que no escribe (el ejemplo pasó a meta-ads) . 2 · 57 días sin escribir no se pinta en rojo
// 30-sep-2026 (reintento y tolerancia): 4/4 en rojo.
//   C1 sin reintento ........................................... 1 · los fallidos no se reintentan
//   C2 tolerancia 10% .......................................... 1 · la tolerancia no es «más del 5%»
//   C3 toda falla cuenta (sin tolerancia) ...................... 1 · ídem
//   C4 la corrida ignora la tolerancia ......................... 1 · no cuenta con la tolerancia
// 30-sep-2026 (update-market y vigilancia): 7/7 en rojo.
//   U1 sin reintento del BCCh .................................. 3 · no se reintenta hasta 3 veces
//   U2 la falla HTTP vuelve a ser muda ......................... 3 · no dice por qué
//   U3 el Codigo del BCCh no llega ............................. 3 · el Codigo no llega al motivo
//   U4 sin credenciales reintenta (quedó VERDE al principio: sin credenciales no hay fetch que contar;
//      el tier pasó a exigir que el motivo no diga «tras N intentos»)
//   U5 el motivo no viaja al correo ............................ 3 · errors no llega a cerrarCron
//   U6 un cron nuevo atrasado de entrada ....................... 3 · figura atrasado antes de su 1ª corrida
//   U7 la vigilancia re-avisa la falla de ayer ................. 3 · vuelve a avisar la falla de una corrida
// 02-oct-2026 (el ritmo cuenta desde el deploy que lo cambió): 5/5 en rojo.
//   K1 el atraso ignora el cambio de ritmo ...................... 3 · atrasado por la corrida del ritmo viejo
//   K2 el ritmo nuevo nunca atrasa .............................. 3 · saltarse dos corridas no figura atrasado
//   K3 la frescura ignora el cambio de ritmo .................... 3 · la frescura no cuenta desde el cambio
//   K4 backfill-toctoc sin cadenciaDesde ........................ 3 · no cuenta desde el deploy
//   K5 el panel vuelve a la cuenta vieja de la frescura ......... 3 · el panel mide sin el cambio de ritmo

if (require.main === module) {
  runCronsTier().then(({ hard }) => process.exit(hard ? 1 : 0));
}
