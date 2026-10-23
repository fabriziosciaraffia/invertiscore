// ============================================================================
// TIER REGISTRO-META — CompleteRegistration al crear la cuenta, IntencionCompra al contestar (22-oct-2026, Fabrizio)
//
// Lo que pasó: CompleteRegistration dependía de contestar «¿Cuándo piensas comprar?» y no salía nunca (desde el 16-oct, 7
// cuentas reales, 1 con el evento). Ahora:
//   1 · SALE AL CREAR LA CUENTA, POR CUALQUIER PUERTA, con la puerta y el «cuándo» como propiedad SI lo contestó: un
//       registro SIN «cuándo» sale igual. EN ROJO CON EL CÓDIGO DE HOY: no existía esa emisión.
//   2 · Cuando contesta después, un evento propio «IntencionCompra» (`ic-<cuenta>-<respuesta>`), con la respuesta y la
//       puerta; sale con trackCustom en el pixel (es propio), deduplicado con el servidor por el id.
//   3 · El cableado: el alta de /deptos y del invitado, el reclamo del informe anónimo y el callback (Google y el enlace)
//       emiten al crear y dejan el espejo en la respuesta; las rutas del «cuándo» emiten la intención (y el registro si la
//       cuenta nació sin él); el relleno manda la hora del alta (`event_time`, Meta acepta 7 días).
// Verificado EN ROJO contra el código de hoy y por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/registro-meta-catch-test.ts
// ============================================================================
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EVENTOS_META, EVENTOS_PROPIOS, idIntencion, idRegistro } from "../../../src/lib/meta/ids";
import { envioMeta, type ContextoMeta } from "../../../src/lib/meta/servidor";
import type { MetaCapiEventInput } from "../../../src/lib/meta/capi";

const RAIZ = join(__dirname, "..", "..", "..");
const existe = (p: string) => existsSync(join(RAIZ, p));
const leer = (p: string) => (existe(p) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));
function cargar<T>(ruta: string): T | null {
  try { return require(join(RAIZ, ruta)) as T; } catch { return null; }
}
type RegistroMod = typeof import("../../../src/lib/meta/registro");

const NAVEGADOR: ContextoMeta = { ip: "1.2.3.4", ua: "Mozilla/5.0 prueba", fbp: "fb.1.1.1", fbc: null, url: "https://refranco.ai/deptos", prueba: false, consentimiento: true };

/** Una base de mentira: la atribución y el perfil que se le den, la marca de meta_eventos nueva siempre, nadie es de prueba. */
function baseFalsa(p: { puerta?: string | null; cuando?: string | null }) {
  const filas: Array<{ tabla: string; op: string; valores: unknown }> = [];
  const respuesta = (tabla: string, op: string, valores: unknown) => {
    filas.push({ tabla, op, valores });
    if (tabla === "user_attribution") return { data: p.puerta ? { puerta: p.puerta } : null, error: null };
    if (tabla === "perfil_busqueda") return { data: p.cuando ? { horizonte_compra: p.cuando } : null, error: null };
    if (tabla === "meta_eventos" && op === "upsert") return { data: [{ id: filas.length }], error: null };
    return { data: null, error: null };
  };
  const cadena = (tabla: string, op: string, valores: unknown = null): unknown => new Proxy({}, {
    get: (_t, k) => (k === "then"
      ? (ok: (v: unknown) => void) => ok(respuesta(tabla, op, valores))
      : (...a: unknown[]) => cadena(tabla, op === "select" && typeof k === "string" && ["upsert", "update", "insert"].includes(k) ? k : op, op === "select" && k === "upsert" ? a[0] : valores)),
  });
  const sb = {
    from: (tabla: string) => new Proxy({}, { get: (_t, k) => (...a: unknown[]) => cadena(tabla, String(k), a[0]) }),
    rpc: async () => ({ data: false, error: null }),
  } as unknown as SupabaseClient;
  return { sb, filas };
}

export async function runRegistroMetaTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER REGISTRO-META (CompleteRegistration al crear la cuenta, con o sin «cuándo»; IntencionCompra al contestar; servidor y pixel con el mismo id · 0 tokens) ───");
  const reg = cargar<RegistroMod>("src/lib/meta/registro.ts");
  const guardado = { enviar: envioMeta.enviar, env: { ...process.env } };
  for (const k of ["META_TRACKING_ENABLED", "META_CAPI_TOKEN", "META_TEST_EVENT_CODE"]) delete process.env[k];
  const envios: MetaCapiEventInput[] = [];
  envioMeta.enviar = async (input) => { envios.push(input); return { ok: true, status: 200 }; };
  const cuenta = { id: "u-nueva", email: "nueva@prueba.cl", created_at: new Date(Date.now() - 60_000).toISOString() };

  try {
    // ── 1 · al crear, con o sin «cuándo» ──
    if (!reg?.emitirRegistroAlCrear || !reg.datosRegistro) F("1 · falta emitirRegistroAlCrear / datosRegistro en src/lib/meta/registro.ts");
    else {
      const sinCuando = reg.datosRegistro({ puerta: "B", cuando: null });
      if (sinCuando.status !== "completo" || sinCuando.puerta !== "B" || "cuando" in sinCuando) F(`1 · sin «cuándo» los datos no son {status, puerta}: ${JSON.stringify(sinCuando)}`);
      const conCuando = reg.datosRegistro({ puerta: "A", cuando: "ya" });
      if (conCuando.cuando !== "ya" || conCuando.puerta !== "A") F("1 · con «cuándo» no va como propiedad");
      if ("puerta" in reg.datosRegistro({ puerta: null, cuando: null })) F("1 · sin puerta inventa la clave");
      // La emisión, sin «cuándo» contestado: sale igual, con la puerta, el id de la cuenta y el espejo.
      const { sb, filas } = baseFalsa({ puerta: "B", cuando: null });
      envios.length = 0;
      const e = await reg.emitirRegistroAlCrear(sb, cuenta, NAVEGADOR, { origen: "alta" });
      await e?.envio;
      const enviado = envios[0];
      if (!e || e.estado !== "enviando" || !enviado) F(`1 · un registro sin «cuándo» no sale (${e?.estado}, ${envios.length} envíos)`);
      if (enviado && (enviado.eventName !== EVENTOS_META.registro || enviado.eventId !== idRegistro("u-nueva") || enviado.email !== "nueva@prueba.cl" || enviado.externalId !== "u-nueva")) F(`1 · el registro no va como CompleteRegistration reg-<cuenta> con el correo y el id: ${JSON.stringify({ n: enviado.eventName, id: enviado.eventId })}`);
      if (enviado && (enviado.datos?.status !== "completo" || enviado.datos?.puerta !== "B" || "cuando" in (enviado.datos ?? {}))) F(`1 · los datos del registro sin «cuándo» no son {status, puerta}: ${JSON.stringify(enviado.datos)}`);
      if (enviado && enviado.eventTime != null) F("1 · al crear la cuenta, el evento lleva una hora que no es «ahora»");
      if (!e?.espejo || e.espejo.eventId !== idRegistro("u-nueva") || e.espejo.evento !== EVENTOS_META.registro) F("1 · el pixel no recibe el espejo con el mismo id");
      if (!filas.some((f) => f.tabla === "meta_eventos" && f.op === "upsert" && (f.valores as { origen?: string })?.origen === "alta")) F("1 · la fila de meta_eventos no dice de dónde salió (origen)");
      // Con el «cuándo» ya contestado, va como propiedad; la puerta que trae el alta le gana a la leída.
      const { sb: sb2 } = baseFalsa({ puerta: "D", cuando: "meses" });
      envios.length = 0;
      await (await reg.emitirRegistroAlCrear(sb2, cuenta, NAVEGADOR, { puerta: "C" }))?.envio;
      if (envios[0]?.datos?.cuando !== "meses" || envios[0]?.datos?.puerta !== "C") F(`1 · con el «cuándo» contestado y la puerta del alta, los datos salen mal: ${JSON.stringify(envios[0]?.datos)}`);
      // Una cuenta vieja no es un registro de la campaña.
      if ((await reg.emitirRegistroAlCrear(baseFalsa({}).sb, { ...cuenta, created_at: "2026-08-01T00:00:00Z" }, NAVEGADOR)) !== null) F("1 · una cuenta de hace meses manda el registro");
      // El relleno: la hora del alta viaja como event_time.
      const { sb: sb3 } = baseFalsa({ puerta: "B" });
      envios.length = 0;
      const t = Math.floor(Date.parse(cuenta.created_at) / 1000);
      await (await reg.emitirRegistroAlCrear(sb3, cuenta, null, { origen: "relleno", eventTime: t }))?.envio;
      if (envios[0]?.eventTime !== t) F(`1 · el relleno no manda la hora del alta (event_time ${envios[0]?.eventTime} ≠ ${t})`);
    }

    // ── 2 · la intención ──
    if (!reg?.emitirIntencionCompra || !reg.datosIntencion) F("2 · falta emitirIntencionCompra / datosIntencion");
    else {
      if (EVENTOS_META.intencion !== "IntencionCompra" || !EVENTOS_PROPIOS.has(EVENTOS_META.intencion)) F("2 · IntencionCompra no es un evento propio (saldría con track en vez de trackCustom)");
      if (idIntencion("u-nueva", "ya") !== "ic-u-nueva-ya" || idIntencion("u-nueva", "ya") === idIntencion("u-nueva", "mirando")) F("2 · el id de la intención no es por cuenta y respuesta");
      const { sb } = baseFalsa({ puerta: "B" });
      envios.length = 0;
      const e = await reg.emitirIntencionCompra(sb, cuenta, "ya", NAVEGADOR);
      await e?.envio;
      if (!e || envios[0]?.eventName !== "IntencionCompra" || envios[0]?.eventId !== "ic-u-nueva-ya" || envios[0]?.datos?.cuando !== "ya" || envios[0]?.datos?.puerta !== "B") F(`2 · la intención no sale como IntencionCompra ic-<cuenta>-<respuesta> con la respuesta y la puerta: ${JSON.stringify(envios[0])}`);
      if (!e?.espejo || e.espejo.evento !== "IntencionCompra" || e.espejo.eventId !== "ic-u-nueva-ya") F("2 · el pixel no recibe el espejo de la intención");
      if (reg.datosIntencion({ puerta: null, cuando: "mirando" }).cuando !== "mirando" || "puerta" in reg.datosIntencion({ puerta: null, cuando: "mirando" })) F("2 · los datos de la intención sin puerta salen mal");
    }
  } finally {
    envioMeta.enviar = guardado.enviar;
    for (const k of ["META_TRACKING_ENABLED", "META_CAPI_TOKEN", "META_TEST_EVENT_CODE"]) if (guardado.env[k] !== undefined) process.env[k] = guardado.env[k];
  }

  // ── 3 · el cableado ──
  const alta = codigo("src/lib/deptos/alta-servidor.ts");
  if (!/const registro = await emitirRegistroAlCrear\(admin, user, contextoDeRequest\(request\), \{ origen: "alta", puerta \}\);\s*if \(registro\) waitUntil\(registro\.envio\);/.test(alta) || !/espejos: registro\?\.espejo \? \[registro\.espejo\] : \[\]/.test(alta)) F("3 · el alta de /deptos (y del invitado) no emite el registro al crear la cuenta ni devuelve su espejo");
  if (!/conEspejo\(NextResponse\.json\(r\.cuerpo, r\.status \? \{ status: r\.status \} : undefined\), r\.espejos, request\)/.test(codigo("src/app/api/deptos/alta/route.ts"))) F("3 · /api/deptos/alta no deja el espejo en la respuesta");
  const entrar = codigo("src/app/api/deptos/entrar/route.ts");
  if (!/espejos = a\.espejos;/.test(entrar) || !/conEspejo\(NextResponse\.json\(\{ \.\.\.r\.cuerpo, via: r\.via \}, r\.status \? \{ status: r\.status \} : undefined\), espejos, request\)/.test(entrar)) F("3 · /api/deptos/entrar no deja el espejo en la respuesta");
  const claim = codigo("src/app/api/analisis/claim/route.ts");
  if (!/const registro = await emitirRegistroAlCrear\(createAdminServiceClient\(\), user, contextoDeRequest\(request\), \{ origen: "claim", puerta: esPuerta\(cuerpo\?\.puerta\) \? cuerpo\.puerta : null \}\);/.test(claim) || !/return conEspejo\(cerrarInvitacion\(NextResponse\.json\(result\), vinculo\), \[registro\?\.espejo\], request\);/.test(claim)) F("3 · el reclamo del informe anónimo (la puerta A) no emite el registro al crear la cuenta");
  const cb = codigo("src/app/auth/callback/route.ts");
  if (!/const registro = await emitirRegistroAlCrear\(createAdminServiceClient\(\), user, contextoDeRequest\(request\), \{ origen: "callback" \}\);/.test(cb) || !/return conEspejo\(NextResponse\.redirect\(new URL\(destinoRecienDentro\(dest, recienDentro\), request\.url\)\), \[espejoRegistro\], request\);/.test(cb)) F("3 · el callback (Google y el enlace del correo) no emite el registro al crear la cuenta");
  for (const [p, cuando] of [["src/app/api/perfil-busqueda/route.ts", "cuando"], ["src/app/api/lo-que-sigue/perfil/route.ts", "cambios\\.horizonte_compra"]] as const) {
    const s = codigo(p);
    if (!new RegExp(`const reg = await emitirRegistroAlCrear\\(admin, user, ctx, \\{ origen: "cuando" \\}\\);\\s*const ic = await emitirIntencionCompra\\(admin, user, ${cuando}, ctx\\);`).test(s) || /emitirRegistroCompletado/.test(s)) F(`3 · ${p} no manda la intención (y el registro si faltaba) al contestar el «cuándo»`);
  }
  const capi = codigo("src/lib/meta/capi.ts");
  if (!/event_time: typeof input\.eventTime === "number" && Number\.isFinite\(input\.eventTime\) \? Math\.floor\(input\.eventTime\) : Math\.floor\(Date\.now\(\) \/ 1000\),/.test(capi)) F("3 · la API de conversiones no acepta la hora del relleno (event_time)");
  if (!/eventTime: e\.eventTime \?\? null,/.test(codigo("src/lib/meta/servidor.ts"))) F("3 · emitirEventoMeta no pasa la hora del relleno a la API");
  const relleno = codigo("src/app/api/admin/meta-registros-pendientes/route.ts");
  if (!relleno) F("3 · falta la ruta del relleno (/api/admin/meta-registros-pendientes)");
  else if (!/authorization"\) !== `Bearer \$\{cronSecret\}`/.test(relleno) || !/eventTime: Math\.floor\(Date\.parse\(u\.created_at!\) \/ 1000\)/.test(relleno) || !/VENTANA_RELLENO_MS = 7 \* 24 \* 3600_000/.test(relleno)) F("3 · el relleno no va con el secreto del cron, con la hora del alta y dentro de los 7 días de Meta");

  if (fallas.length) {
    console.log(`  ✗ REGISTRO-META · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — CompleteRegistration sale al crear la cuenta por cualquier puerta, con la puerta y el «cuándo» si existe (sin él, igual); IntencionCompra al contestar; el pixel repite los dos con el mismo id; el relleno manda la hora del alta");
  }
  return { hard: fallas.length };
}

// ACTA DE MUTACIÓN (22-oct-2026). CONTRA EL CÓDIGO DE HOY (HEAD 26eba2a0, `src/` del goal de vuelta a HEAD y los módulos nuevos
// apartados): 12 fallas —faltan emitirRegistroAlCrear, datosRegistro, emitirIntencionCompra y datosIntencion; el alta, el
// reclamo y el callback no emiten; las rutas del «cuándo» no mandan la intención; la API no acepta event_time; falta la ruta
// del relleno—. Y 9 mutaciones, cada una restaurada byte a byte, todas ROJAS: R1 el registro vuelve a exigir el «cuándo» ·
// R2 IntencionCompra deja de ser propio · R3 el alta no emite · R4 el callback sin el espejo · R5 el reclamo no emite · R6
// la ruta del «cuándo» sin la intención · R7 la API ignora event_time · R8 la puerta del alta no manda · R9 la intención sin
// la respuesta. MEDICION-META §1 (los propios) y su cableado de las dos rutas del «cuándo» se reescribieron con su acta.

if (require.main === module) {
  runRegistroMetaTier().then(({ hard }) => process.exit(hard ? 1 : 0));
}
