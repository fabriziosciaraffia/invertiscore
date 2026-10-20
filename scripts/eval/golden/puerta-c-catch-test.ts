// ─────────────────────────────────────────────────────────────────────────────
// Tier PUERTA-C (16-oct-2026, 0 tokens, sin red ni base) — el referido: una persona invita a alguien y, si entra, los dos
// reciben un análisis.
//
//   1 · EL ENLACE: el código (seis letras y números sin los confusos), uno de siempre y uno con nombre por persona, la
//       cookie de 30 días que deja el middleware al abrir «/i/CÓDIGO» (la primera gana).
//   2 · EL COBRO DEL CÓDIGO al registrarse, venga por donde venga (el reclamo, el callback, /deptos y la página del
//       invitado, el ticket, el dashboard): la cuenta nueva queda ligada a quien invitó y con la puerta C; la que YA
//       TENÍA CUENTA queda anotada y no cuenta; quien abre su propio enlace, nada.
//   3 · EL PREMIO cuando el invitado contesta el «cuándo» con sesión: un análisis más a quien invitó, vigente 60 días, con
//       su correo; una vez. TOPE de cinco por persona (también a la vez: el índice único del lugar). MISMO DISPOSITIVO: no.
//       El invitado no recibe un segundo análisis: el suyo es el regalo de cuenta nueva.
//   4 · LAS SUPERFICIES: «Invita a alguien» en el dashboard, en el pie del semanal y al compartir un informe; la página
//       del invitado con las mismas preguntas de /deptos o la dirección; la atribución C con el código.
//   5 · LA VISITA (20-oct-2026): toda visita a /i/CÓDIGO registra `invitacion_vista` en el servidor, con el código, con o
//       sin consentimiento (sin «si», un id de esa visita y sin perfil de persona); no los robots ni el refresco de Next; y
//       la cohorte de la puerta C del panel la lee. Acta de mutaciones (I1–I15) en su sección.
//
// ACTA DE MUTACIONES (16-oct-2026, scratchpad mutar-puerta-c.cjs, restauradas byte a byte): 51/51 en ROJO, y tres guardas
// redundantes VERDES a propósito (54/54 como se esperaba). Siete salieron del QA en el navegador: W9–W11 (la invitación
// cobrada queda «usada»; borrada, el refresh la volvía a dejar), K1 (dos regalos no son «un análisis de regalo») y S15–S17
// (el menú de compartir dentro de la pantalla a 390, «Más opciones», el campo del nombre que colapsaba). Primero quedaron verdes P3 (sin la guarda temprana del premio) y T1 (sin el tope de la
// decisión): las dos están cubiertas por una segunda guarda —el UPDATE condicional `estado = 'pendiente'` y el número del
// lugar `n > TOPE`—, así que cada una sola no cambia nada. Ahora P3 y T1 quitan las DOS a la vez (rojas), y P3b, P3c y T1b
// quitan una sola y se esperan verdes: así queda probado que cada guarda la cubre la otra, no que sobre.
//   Cobro del premio: P1 otra fuente · P2 vence a los 30 · P3 se paga dos veces · P4 el lote al invitado · P5 sin correo ·
//   P6 el «cuándo» del dashboard no paga · P7 el del informe no paga · P8 a la cuenta de prueba le sale el correo · P9 el
//   «cuándo» no cobra el código pendiente. Tope: T1 sin tope · T2 en seis · T3 a la vez pasa · T4 el choque no recuenta.
//   Mismo dispositivo: D1 sin mirar · D2 el del registro de quien invita no cuenta · D3 el cobro no guarda el del
//   invitado · D4 abrir el enlace no lo anota. Cuenta previa: V1 la de antes del enlace es nueva · V2 toda queda
//   pendiente · V3 sin la ventana de 30 días · V4 la previa con la puerta C · V5 quien invita se cobra su código.
//   Venga por donde venga: W1 el reclamo · W2 el callback · W3 /deptos deja la invitada en B · W4 el ticket · W5 el
//   dashboard · W6 el middleware pisa la primera · W7 no corre en /i/ · W8 la C sin la RPC que pisa. Superficies: S1 el
//   nombre sin pedirlo · S2 la página salta de modo · S3 Google vuelve a /deptos · S4 compartir sin invitar · S5 el pie
//   sin la línea · S6 el semanal sin el enlace · S7 una casa sin invitar · S8 el enlace sin sesión · S9 otro titular ·
//   S10 sin «un amigo» · S11 el Lead sin su puerta · S12 la página con la puerta B · S13 la dirección no va al wizard ·
//   S14 otro asunto.
//
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/puerta-c-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALFABETO_CODIGO, CODIGO_INVITACION, COOKIE_INVITACION, cuentaNuevaParaInvitacion, decidirPremio, DIAS_COOKIE_INVITACION, DIAS_VIGENCIA_PREMIO_REFERIDO,
  FUENTE_PREMIO_REFERIDO, generarCodigo, INVITACION_USADA, leerCookieInvitacion, normalizarCodigo, PREFIJO_DETALLE_INVITACION, REFERIDO_COPY, TOPE_PREMIOS_REFERIDO,
  VIDA_COOKIE_INVITACION_S, valorCookieInvitacion,
} from "../../../src/lib/referido";
import { asegurarInvitacion, pagarPremioReferido, vincularInvitacion } from "../../../src/lib/referido-servidor";
import { FUENTES_REGALO } from "../../../src/lib/regalo-alta";
import { datosSaldoDe, estadoSaldo } from "../../../src/lib/casa-saldo";
import { correoPremioReferido } from "../../../src/lib/email/correos";
import { correoSemanal, correoSemanalVacio } from "../../../src/lib/email/correo-semanal";
import { CATALOGO_CORREOS } from "../../../src/lib/email/catalogo";
import { esCargaDePagina, esRobot, eventoInvitacionVista, idPostHogDeCookies } from "../../../src/lib/invitacion-vista";
import { capturarServidor } from "../../../src/lib/posthog-servidor";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\*.*$/gm, "");
/** El índice de `aguja` en `pajar`, o Infinity si no está (así un «antes que» con un ausente no pasa). */
const pos = (pajar: string, aguja: string) => { const i = pajar.indexOf(aguja); return i < 0 ? Infinity : i; };

// ── Una base en memoria: lo justo de supabase-js que usa el referido, con claves y únicos compuestos (parciales) ──────
type Fila = Record<string, unknown>;
function baseFalsa(o: { claves?: Record<string, string>; unicos?: Record<string, string[][]>; usuarios?: Record<string, { email: string | null; user_metadata?: Record<string, unknown> }> } = {}) {
  const tablas = new Map<string, Fila[]>();
  const tabla = (t: string) => { if (!tablas.has(t)) tablas.set(t, []); return tablas.get(t)!; };
  const rpcs: Array<{ nombre: string; args: Fila }> = [];
  let ids = 0;
  /** ¿Choca `v` con otra fila (que no sea `yo`) por la clave o por un único compuesto? Un único con algún null no choca. */
  const choca = (t: string, v: Fila, yo?: Fila) => {
    const filas = tabla(t).filter((f) => f !== yo);
    const clave = o.claves?.[t];
    if (clave && filas.some((f) => f[clave] === v[clave])) return true;
    for (const cols of o.unicos?.[t] ?? []) {
      if (cols.some((c) => v[c] == null)) continue;
      if (filas.some((f) => cols.every((c) => f[c] === v[c]))) return true;
    }
    return false;
  };
  const from = (t: string) => {
    const filtros: Array<(f: Fila) => boolean> = [];
    let op: { tipo: "select" | "insert" | "update" | "upsert" | "delete"; valor?: Fila; opts?: Record<string, unknown> } = { tipo: "select" };
    let cabeza = false, una: "single" | "maybe" | null = null, devolver = false;
    const b = {
      select(_c?: string, s?: { count?: string; head?: boolean }) { if (op.tipo === "select") cabeza = !!s?.head; else devolver = true; return b; },
      insert(v: Fila) { op = { tipo: "insert", valor: v }; return b; },
      update(v: Fila) { op = { tipo: "update", valor: v }; return b; },
      upsert(v: Fila, s?: Record<string, unknown>) { op = { tipo: "upsert", valor: v, opts: s }; return b; },
      delete() { op = { tipo: "delete" }; return b; },
      eq(c: string, v: unknown) { filtros.push((f) => f[c] === v); return b; },
      in(c: string, vs: unknown[]) { filtros.push((f) => vs.includes(f[c])); return b; },
      gte(c: string, v: string) { filtros.push((f) => String(f[c]) >= v); return b; },
      gt(c: string, v: unknown) { filtros.push((f) => (typeof v === "number" ? Number(f[c]) > v : String(f[c]) > String(v))); return b; },
      is(c: string, v: unknown) { filtros.push((f) => (f[c] ?? null) === v); return b; },
      order() { return b; },
      limit() { return b; },
      maybeSingle() { una = "maybe"; return b; },
      single() { una = "single"; return b; },
      then(ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) {
        try { return Promise.resolve(correr()).then(ok, ko); } catch (e) { return Promise.reject(e).then(ok, ko); }
      },
    };
    const duplicada = { data: null, error: { code: "23505", message: "duplicada" } };
    const correr = () => {
      const filas = tabla(t);
      if (op.tipo === "insert") {
        const v = { ...op.valor } as Fila;
        if (choca(t, v)) return duplicada;
        if (!("id" in v)) v.id = `id-${++ids}`;
        filas.push(v);
        return { data: devolver ? (una ? v : [v]) : null, error: null };
      }
      if (op.tipo === "upsert") {
        const v = op.valor!;
        const clave = o.claves?.[t];
        const i = clave ? filas.findIndex((f) => f[clave] === v[clave]) : -1;
        if (i >= 0) { if (!op.opts?.ignoreDuplicates) filas[i] = { ...filas[i], ...v }; } else filas.push({ ...v });
        return { data: null, error: null };
      }
      const elegidas = filas.filter((f) => filtros.every((p) => p(f)));
      if (op.tipo === "delete") {
        for (const f of elegidas) filas.splice(filas.indexOf(f), 1);
        return { data: null, error: null };
      }
      if (op.tipo === "update") {
        // Como Postgres: si una fila choca con un único, falla el UPDATE entero.
        if (elegidas.some((f) => choca(t, { ...f, ...op.valor }, f))) return duplicada;
        for (const f of elegidas) Object.assign(f, op.valor);
        return { data: devolver ? elegidas : null, error: null };
      }
      if (cabeza) return { data: null, count: elegidas.length, error: null };
      if (una) return { data: elegidas[0] ?? null, error: null };
      return { data: elegidas, error: null };
    };
    return b;
  };
  const rpc = async (nombre: string, args: Fila) => {
    rpcs.push({ nombre, args });
    if (nombre === "fijar_puerta_referido") {
      const ua = tabla("user_attribution");
      const f = ua.find((x) => x.user_id === args.p_user_id);
      if (f) Object.assign(f, { puerta: "C", puerta_detalle: args.p_detalle }); else ua.push({ user_id: args.p_user_id, puerta: "C", puerta_detalle: args.p_detalle });
    }
    return { data: null, error: null };
  };
  const auth = { admin: { getUserById: async (id: string) => ({ data: { user: o.usuarios?.[id] ? { id, ...o.usuarios[id] } : null }, error: null }) } };
  return { from, rpc, auth, tablas, tabla, rpcs };
}
const OPCIONES_BASE = {
  claves: { invitaciones: "codigo", referidos: "invitado_id", regalos_alta: "user_id", user_attribution: "user_id", test_accounts: "user_id" },
  unicos: { invitaciones: [["user_id", "con_nombre"]], referidos: [["invitador_id", "premio_n"]] },
};

export async function runPuertaCTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER PUERTA-C (el referido: el enlace, el cobro del código, el premio, el tope, el mismo dispositivo · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const posthog = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  try {
    // ── 1 · EL ENLACE ──
    {
      if (ALFABETO_CODIGO.length !== 31 || /[IL O01]/.test(ALFABETO_CODIGO)) F("1 · el alfabeto del código trae letras que se confunden (I, L, O, 0, 1)");
      for (const ch of ALFABETO_CODIGO) if (!CODIGO_INVITACION.test(ch.repeat(6))) F(`1 · la forma del código rechaza «${ch}», que el alfabeto usa`);
      let semilla = 7;
      const azar = (n: number) => { semilla = (semilla * 48271) % 2147483647; return semilla % n; };
      for (let i = 0; i < 200; i++) { const c = generarCodigo(azar); if (!CODIGO_INVITACION.test(c)) { F(`1 · se generó un código inválido: ${c}`); break; } }
      if (normalizarCodigo(" k7m2qx ") !== "K7M2QX" || normalizarCodigo("K7M2Q") !== null || normalizarCodigo("K7M2Q0") !== null) F("1 · el código no se normaliza (minúsculas, largo, letras confusas)");
      const t0 = Date.parse("2026-10-20T12:00:00Z");
      const ida = leerCookieInvitacion(valorCookieInvitacion("K7M2QX", t0));
      if (ida?.codigo !== "K7M2QX" || ida.visitaMs !== Math.floor(t0 / 1000) * 1000 || leerCookieInvitacion("no-es-un-codigo.123") !== null) F("1 · la cookie no va y vuelve con el código y la hora");
      if (DIAS_COOKIE_INVITACION !== 30 || VIDA_COOKIE_INVITACION_S !== 30 * 86400) F("1 · la cookie no dura 30 días");
      const mw = leer("src/middleware.ts");
      if (!/if \(invitacion && !request\.cookies\.has\(COOKIE_INVITACION\)\) \{\s*res\.cookies\.set\(COOKIE_INVITACION, valorCookieInvitacion\(invitacion, Date\.now\(\)\), \{ path: "\/", maxAge: VIDA_COOKIE_INVITACION_S,/.test(mw)) F("1 · el middleware no deja la cookie de la invitación (o pisa la primera, o la usada)");
      if (!/"\/i\/:path\*"/.test(mw)) F("1 · el middleware no corre en /i/");
      // UNA INVITACIÓN POR NAVEGADOR (visto en el QA, 16-oct-2026): la cobrada queda «usada» —no se borra—, porque el
      // `router.refresh()` de la misma página volvía a pedir /i/CÓDIGO y el middleware la dejaba de nuevo.
      if (INVITACION_USADA !== "usada" || leerCookieInvitacion(INVITACION_USADA) !== null) F("1 · la marca «usada» se lee como un código");
      for (const [n, f] of [["el callback", "src/app/auth/callback/route.ts"], ["el reclamo", "src/app/api/analisis/claim/route.ts"], ["el alta de /deptos", "src/app/api/deptos/alta/route.ts"]] as const) {
        const src = sinComentarios(leer(f));
        if (!/VINCULO_TERMINADO\.has\(vinculo\)\) (?:cookieStore|res\.cookies)\.set\(COOKIE_INVITACION_USADA\.name, COOKIE_INVITACION_USADA\.value, COOKIE_INVITACION_USADA\.options\);/.test(src) || /maxAge: 0/.test(src)) F(`1 · ${n} no deja la invitación cobrada como «usada» (otra cuenta de ese navegador se la cobraría)`);
      }

      // Uno de siempre y uno con nombre por persona; con nombre exige el nombre; el dispositivo queda anotado.
      const db = baseFalsa(OPCIONES_BASE);
      const a1 = await asegurarInvitacion(db as never, { userId: "inv", conNombre: false, dispositivo: "dA" });
      const a2 = await asegurarInvitacion(db as never, { userId: "inv", conNombre: false, dispositivo: "dB" });
      const n1 = await asegurarInvitacion(db as never, { userId: "inv", conNombre: true, nombre: "  Camila  " });
      const sinNombre = await asegurarInvitacion(db as never, { userId: "inv", conNombre: true, nombre: "   " });
      const filas = db.tabla("invitaciones");
      if (!a1 || a1.codigo !== a2?.codigo || filas.length !== 2 || !n1 || n1.codigo === a1.codigo || n1.nombre !== "Camila" || sinNombre !== null) F(`1 · los enlaces no son uno de siempre y uno con nombre (${filas.length} filas, nombre «${n1?.nombre}»)`);
      const disp = filas.find((f) => f.codigo === a1?.codigo)?.dispositivos as string[] | undefined;
      if (!disp?.includes("dA") || !disp.includes("dB")) F("1 · abrir el enlace desde un navegador no anota ese dispositivo");
      if (a1 && filas.find((f) => f.codigo === a1.codigo)?.con_nombre !== false) F("1 · el enlace de siempre dice el nombre");
    }

    // ── 2 · EL COBRO DEL CÓDIGO ──
    const ahora = new Date("2026-10-20T12:00:00Z");
    const visita = ahora.getTime() - 3600_000;
    const cookie = (codigo: string) => valorCookieInvitacion(codigo, visita);
    {
      // Una cuenta nueva (nació después de abrir el enlace): pendiente, con la puerta C y el código.
      if (!cuentaNuevaParaInvitacion({ creadaAt: new Date(visita + 600_000).toISOString(), visitaMs: visita, ahoraMs: ahora.getTime() })) F("2 · la cuenta nacida después de abrir el enlace no es nueva");
      if (cuentaNuevaParaInvitacion({ creadaAt: "2026-09-01T00:00:00Z", visitaMs: visita, ahoraMs: ahora.getTime() })) F("2 · una cuenta de antes del enlace (ya tenía cuenta) se da por nueva");
      if (cuentaNuevaParaInvitacion({ creadaAt: new Date(visita - 600_000).toISOString(), visitaMs: visita, ahoraMs: ahora.getTime() })) F("2 · una cuenta creada diez minutos antes de abrir el enlace se da por nueva");
      if (cuentaNuevaParaInvitacion({ creadaAt: new Date(ahora.getTime() - 5 * 3600_000).toISOString(), visitaMs: null, ahoraMs: ahora.getTime() })) F("2 · sin la hora de la visita, una cuenta de hace cinco horas se da por nueva");
      // La hora de la visita viene en la cookie: una visita «de hace 50 días» no vuelve nueva a una cuenta de hace 40.
      if (cuentaNuevaParaInvitacion({ creadaAt: new Date(ahora.getTime() - 40 * 864e5).toISOString(), visitaMs: ahora.getTime() - 50 * 864e5, ahoraMs: ahora.getTime() })) F("2 · una cuenta de hace 40 días se da por nueva con una visita vieja en la cookie");

      const db = baseFalsa(OPCIONES_BASE);
      const inv = await asegurarInvitacion(db as never, { userId: "invitador", conNombre: false });
      const codigo = inv!.codigo;
      const nueva = new Date(visita + 600_000).toISOString();
      const r1 = await vincularInvitacion(db as never, { userId: "nuevo", creadaAt: nueva, cookie: cookie(codigo), huella: { dispositivo: "dN", ip: null } }, ahora);
      const ref = db.tabla("referidos").find((f) => f.invitado_id === "nuevo");
      if (r1 !== "pendiente" || ref?.estado !== "pendiente" || ref.invitador_id !== "invitador" || ref.dispositivo_hash !== "dN") F(`2 · la cuenta nueva no queda ligada a quien invitó (${r1}, ${JSON.stringify(ref)})`);
      const ua = db.tabla("user_attribution").find((f) => f.user_id === "nuevo");
      if (ua?.puerta !== "C" || ua.puerta_detalle !== `${PREFIJO_DETALLE_INVITACION}${codigo}`) F(`2 · la cuenta invitada no queda con la puerta C y el código: ${JSON.stringify(ua)}`);
      const r2 = await vincularInvitacion(db as never, { userId: "nuevo", creadaAt: nueva, cookie: cookie(codigo), huella: { dispositivo: "dN", ip: null } }, ahora);
      if (r2 !== "ya" || db.tabla("referidos").length !== 1) F("2 · cobrar dos veces el código crea dos invitaciones");

      // EL INVITADO CON CUENTA PREVIA: queda anotado y no cuenta (ni puerta C).
      const r3 = await vincularInvitacion(db as never, { userId: "viejo", creadaAt: "2026-08-01T10:00:00Z", cookie: cookie(codigo), huella: { dispositivo: "dV", ip: null } }, ahora);
      const refV = db.tabla("referidos").find((f) => f.invitado_id === "viejo");
      if (r3 !== "cuenta_previa" || refV?.estado !== "cuenta_previa" || db.tabla("user_attribution").some((f) => f.user_id === "viejo")) F(`2 · un invitado que ya tenía cuenta cuenta como referido (${r3}, ${refV?.estado})`);
      // Quien abre su propio enlace: nada.
      const r4 = await vincularInvitacion(db as never, { userId: "invitador", creadaAt: nueva, cookie: cookie(codigo), huella: { dispositivo: "dA", ip: null } }, ahora);
      if (r4 !== "propio" || db.tabla("referidos").some((f) => f.invitado_id === "invitador")) F("2 · quien invita se cobra su propio código");
      const r5 = await vincularInvitacion(db as never, { userId: "otro", creadaAt: nueva, cookie: null, huella: { dispositivo: null, ip: null } }, ahora);
      if (r5 !== "sin_invitacion" || db.tabla("referidos").some((f) => f.invitado_id === "otro")) F("2 · sin la cookie se cobra un código");

      // VENGA POR DONDE VENGA: cada lugar donde nace una cuenta cobra el código; el reclamo y /deptos, antes que su puerta.
      const claim = sinComentarios(leer("src/app/api/analisis/claim/route.ts"));
      if (!/const vinculo = cookieInv\s*\? await vincularInvitacion\(createAdminServiceClient\(\), \{ userId: user\.id, creadaAt: user\.created_at, cookie: cookieInv, huella: huellaDeRequest\(request\) \}\)/.test(claim)
        || pos(claim, "await vincularInvitacion(") > pos(claim, "guardarAtribucion(")) F("2 · el reclamo (banner, /entrar, guía) no cobra el código antes de su puerta");
      const cb = sinComentarios(leer("src/app/auth/callback/route.ts"));
      if (!/const vinculo = await vincularInvitacion\(createAdminServiceClient\(\), \{\s*userId: user\.id, creadaAt: user\.created_at, cookie: cookieInv,/.test(cb) || pos(cb, "vincularInvitacion(") > pos(cb, "asegurarRegaloDeAlta(")) F("2 · el enlace del correo o Google no cobran el código");
      const alta = sinComentarios(leer("src/app/api/deptos/alta/route.ts"));
      if (!/const vinculo = cookieInv \? await vincularInvitacion\(admin, \{ userId: user\.id, creadaAt: user\.created_at, cookie: cookieInv, huella: huellaDeRequest\(request\) \}\) : null;/.test(alta)
        || !/const puerta = ref && ref\.estado !== "cuenta_previa" \? "C" : "B";/.test(alta)
        || !/if \(puerta === "B"\) waitUntil\(guardarAtribucion\(admin, user\.id, \{ puerta: "B", puerta_detalle: "deptos" \}\)/.test(alta)
        || pos(alta, "vincularInvitacion(") > pos(alta, "guardarAtribucion(")) F("2 · /deptos y la página del invitado no cobran el código antes de la puerta B (o la invitada queda en B)");
      if (!/if \(cookieInv\) await vincularInvitacion\(admin, \{ userId: user\.id, creadaAt: user\.created_at, cookie: cookieInv, huella: huellaDeRequest\(request\) \}\);\s*waitUntil\(guardarAtribucion\(admin, user\.id, \{ puerta: "A", puerta_detalle: "ticket"/.test(sinComentarios(leer("src/app/api/lo-que-sigue/pack/route.ts")))) F("2 · el ticket no cobra el código");
      if (!/if \(cookieInv\) \{\s*await vincularInvitacion\(createServiceClient\(\), \{/.test(sinComentarios(leer("src/app/dashboard/page.tsx")))) F("2 · el dashboard no es red del código");
      if (!/if \(nueva\) await fijarPuertaReferido\(admin, p\.userId, `\$\{PREFIJO_DETALLE_INVITACION\}\$\{invitacion\.codigo\}`\);/.test(leer("src/lib/referido-servidor.ts"))) F("2 · la cuenta invitada no queda con la puerta C");
      if (!/sb\.rpc\("fijar_puerta_referido", \{ p_user_id: userId, p_detalle: detalle\.slice\(0, 60\) \}\)/.test(leer("src/lib/attribution.ts"))) F("2 · la puerta C del referido no pasa por la RPC que pisa");
    }

    // ── 3 · EL PREMIO ──
    {
      const enviados: Array<{ to: string; p: { vence: string; pagados: number } }> = [];
      const enviar = async (to: string, p: { vence: string; pagados: number }) => { enviados.push({ to, p }); return true; };
      const escenario = (usuarios: Record<string, { email: string | null }> = { invitador: { email: "quien@invita.cl" } }) => baseFalsa({ ...OPCIONES_BASE, usuarios });
      const pendiente = (db: ReturnType<typeof baseFalsa>, invitado: string, dispositivo: string | null, invitador = "invitador") =>
        db.tabla("referidos").push({ invitado_id: invitado, invitador_id: invitador, codigo: "K7M2QX", estado: "pendiente", dispositivo_hash: dispositivo, premio_n: null });

      // EL COBRO DEL PREMIO: un análisis a quien invitó, vigente 60 días, su correo, una sola vez. El invitado, nada.
      const db = escenario();
      db.tabla("invitaciones").push({ codigo: "K7M2QX", user_id: "invitador", con_nombre: false, nombre: null, dispositivos: ["dA"] });
      pendiente(db, "nuevo", "dN");
      const ahora = new Date("2026-10-20T12:00:00Z");
      const p1 = await pagarPremioReferido(db as never, { invitadoId: "nuevo", enviar: enviar as never }, ahora);
      const p2 = await pagarPremioReferido(db as never, { invitadoId: "nuevo", enviar: enviar as never }, ahora);
      const lotes = db.tabla("credit_grants");
      const g = lotes[0];
      const vence = new Date(ahora.getTime() + 60 * 864e5).toISOString();
      if (p1.estado !== "pagar" || p2.estado !== "ya" || lotes.length !== 1) F(`3 · el premio no se paga una vez (${p1.estado}, ${p2.estado}, ${lotes.length} lotes)`);
      if (g?.user_id !== "invitador" || g.amount !== 1 || g.remaining !== 1 || g.source !== FUENTE_PREMIO_REFERIDO || g.expires_at !== vence) F(`3 · el premio no es un análisis para quien invitó que vence a los 60 días: ${JSON.stringify(g)}`);
      if (lotes.some((l) => l.user_id === "nuevo")) F("3 · el invitado recibe un segundo análisis (el suyo es el regalo de cuenta nueva)");
      const fila = db.tabla("referidos").find((f) => f.invitado_id === "nuevo");
      if (fila?.estado !== "pagado" || fila.premio_n !== 1 || fila.grant_id !== g?.id || fila.correo_estado !== "enviado") F(`3 · la invitación no queda pagada con su lugar, su lote y su correo: ${JSON.stringify(fila)}`);
      if (enviados.length !== 1 || enviados[0].to !== "quien@invita.cl" || enviados[0].p.vence !== vence || enviados[0].p.pagados !== 1) F(`3 · el correo «tu invitado entró» no sale a quien invitó: ${JSON.stringify(enviados)}`);
      if (DIAS_VIGENCIA_PREMIO_REFERIDO !== 60 || !FUENTES_REGALO.has(FUENTE_PREMIO_REFERIDO)) F("3 · el premio no vence a los 60 días o no se ve como regalo en el saldo");
      // El saldo con dos regalos (el de alta y el premio, visto en el QA): «Te quedan 2», no «Tienes un análisis de regalo».
      const dos = estadoSaldo(datosSaldoDe([{ remaining: 1, expires_at: "2026-11-15T00:00:00Z", source: "regalo_alta" }, { remaining: 1, expires_at: vence, source: FUENTE_PREMIO_REFERIDO }], null));
      const uno = estadoSaldo(datosSaldoDe([{ remaining: 1, expires_at: vence, source: FUENTE_PREMIO_REFERIDO }], null));
      if (dos.tipo !== "con" || dos.n !== 2 || !dos.proximoRegalo || uno.tipo !== "regalo" || uno.vence !== vence) F(`3 · el saldo con el premio no cuenta bien los regalos (${JSON.stringify(dos)}, ${JSON.stringify(uno)})`);
      const correo = correoPremioReferido({ nombre: "Camila", vence, pagados: 1, codigo: "K7M2QX" });
      if (correo.subject !== "Tu invitado entró: tienes un análisis más" || !correo.html.includes("Hola Camila, tienes un análisis más") || !correo.html.includes("Vence el")) F(`3 · el correo no dice «tu invitado entró, tienes un análisis más»: ${correo.subject}`);
      if (!CATALOGO_CORREOS.some((e) => e.id === "premio_referido" && e.tipo === "premio_referido")) F("3 · el correo del premio no está en el catálogo");

      // Quien invita es cuenta de prueba: el análisis sí, el correo no.
      const dbP = escenario();
      dbP.tabla("test_accounts").push({ user_id: "invitador", recibe_correos: false });
      pendiente(dbP, "nuevo", "dN");
      const nEnv = enviados.length;
      const pP = await pagarPremioReferido(dbP as never, { invitadoId: "nuevo", enviar: enviar as never }, ahora);
      if (pP.estado !== "pagar" || enviados.length !== nEnv || dbP.tabla("referidos")[0].correo_estado !== "omitido_prueba") F("3 · a una cuenta de prueba le sale el correo del premio");

      // EL TOPE: cinco por persona; el sexto no paga.
      const dbT = escenario();
      for (let i = 1; i <= 6; i++) pendiente(dbT, `i${i}`, `d${i}`);
      const rs = [];
      for (let i = 1; i <= 6; i++) rs.push((await pagarPremioReferido(dbT as never, { invitadoId: `i${i}`, enviar: enviar as never }, ahora)).estado);
      const lotesT = dbT.tabla("credit_grants").length;
      const sexto = dbT.tabla("referidos").find((f) => f.invitado_id === "i6");
      if (TOPE_PREMIOS_REFERIDO !== 5 || rs.slice(0, 5).some((e) => e !== "pagar") || rs[5] !== "tope" || lotesT !== 5 || sexto?.estado !== "tope" || sexto.premio_n != null) F(`3 · el tope de cinco no se respeta (${rs.join(", ")}, ${lotesT} lotes)`);
      // El tope a la vez: con cuatro pagados, dos premios al mismo tiempo no pasan de cinco (el lugar 5 es uno solo).
      const dbV = escenario();
      for (let i = 1; i <= 4; i++) dbV.tabla("referidos").push({ invitado_id: `p${i}`, invitador_id: "invitador", codigo: "K7M2QX", estado: "pagado", premio_n: i });
      pendiente(dbV, "a", "da");
      pendiente(dbV, "b", "db");
      const [ra, rb] = await Promise.all([
        pagarPremioReferido(dbV as never, { invitadoId: "a", enviar: enviar as never }, ahora),
        pagarPremioReferido(dbV as never, { invitadoId: "b", enviar: enviar as never }, ahora),
      ]);
      const pagadosV = dbV.tabla("referidos").filter((f) => f.estado === "pagado").length;
      if (pagadosV !== 5 || dbV.tabla("credit_grants").length !== 1 || [ra.estado, rb.estado].sort().join(",") !== "pagar,tope") F(`3 · dos premios a la vez pasan el tope (${ra.estado}, ${rb.estado}, ${pagadosV} pagados)`);

      // EL MISMO DISPOSITIVO: el invitado usa un navegador donde quien invita abrió su enlace (o se registró): no paga.
      const dbD = escenario();
      dbD.tabla("invitaciones").push({ codigo: "K7M2QX", user_id: "invitador", con_nombre: false, nombre: null, dispositivos: ["dA", "dB"] });
      pendiente(dbD, "mismo", "dB");
      const pD = await pagarPremioReferido(dbD as never, { invitadoId: "mismo", enviar: enviar as never }, ahora);
      if (pD.estado !== "mismo_dispositivo" || dbD.tabla("credit_grants").length !== 0 || dbD.tabla("referidos")[0].estado !== "mismo_dispositivo") F(`3 · el invitado en el mismo dispositivo que quien invita cobra el premio (${pD.estado})`);
      const dbR = escenario();
      dbR.tabla("regalos_alta").push({ user_id: "invitador", dispositivo_hash: "dR" });
      pendiente(dbR, "mismo", "dR");
      const pR = await pagarPremioReferido(dbR as never, { invitadoId: "mismo", enviar: enviar as never }, ahora);
      if (pR.estado !== "mismo_dispositivo" || dbR.tabla("credit_grants").length !== 0) F("3 · el dispositivo donde se registró quien invita no cuenta como suyo");
      if (decidirPremio({ dispositivoInvitado: "dX", dispositivosInvitador: ["dX"], pagados: 9 }) !== "mismo_dispositivo" || decidirPremio({ dispositivoInvitado: null, dispositivosInvitador: ["dX"], pagados: 0 }) !== "pagar") F("3 · la decisión del premio no mira primero el dispositivo");

      // EL INVITADO CON CUENTA PREVIA no cobra nada al contestar el «cuándo».
      const dbC = escenario();
      dbC.tabla("referidos").push({ invitado_id: "viejo", invitador_id: "invitador", codigo: "K7M2QX", estado: "cuenta_previa", dispositivo_hash: "dV", premio_n: null });
      const pC = await pagarPremioReferido(dbC as never, { invitadoId: "viejo", enviar: enviar as never }, ahora);
      if (pC.estado !== "ya" || dbC.tabla("credit_grants").length !== 0) F("3 · un invitado que ya tenía cuenta le paga el premio a quien lo invitó");

      // EL «CUÁNDO» CON SESIÓN: los dos lugares donde se contesta pagan el premio (después de validar el código).
      const pb = sinComentarios(leer("src/app/api/perfil-busqueda/route.ts"));
      if (!/if \(cuando\) waitUntil\(referidoAlContestarCuando\(admin, \{ userId: user\.id, creadaAt: user\.created_at, cookie: cookieInvitacionDeCabeceras\(request\.headers\), huella: huellaDeRequest\(request\) \}\)/.test(pb)) F("3 · contestar el «cuándo» en la página o el dashboard no paga el premio");
      const lqs = sinComentarios(leer("src/app/api/lo-que-sigue/perfil/route.ts"));
      if (!/if \(user && cambios\.horizonte_compra\) \{\s*waitUntil\(referidoAlContestarCuando\(admin, \{ userId: user\.id,/.test(lqs)) F("3 · contestar el «cuándo» en «Estás dentro» del informe no paga el premio (o lo paga sin sesión)");
      if (!/if \(p\.cookie\) await vincularInvitacion\(admin, p\);\s*return pagarPremioReferido\(admin, \{ invitadoId: p\.userId \}\);/.test(leer("src/lib/referido-servidor.ts"))) F("3 · el «cuándo» no cobra el código que quedó sin cobrar antes del premio");
    }

    // ── 4 · LAS SUPERFICIES ──
    {
      // La página del invitado: el titular y la bajada; las preguntas de /deptos con la puerta C y la vuelta a esta página.
      if (REFERIDO_COPY.titular !== "Te invitaron a Franco." || REFERIDO_COPY.bajada !== "Tu primer análisis va por cuenta de Franco.") F("4 · la página del invitado no dice «Te invitaron a Franco. Tu primer análisis va por cuenta de Franco.»");
      if (REFERIDO_COPY.quien(null) !== "Un amigo te invitó a Franco" || REFERIDO_COPY.quien("Camila") !== "Camila te invitó a Franco") F("4 · el invitado no ve «un amigo te invitó a Franco» por defecto (o el nombre cuando se pidió)");
      const cli = sinComentarios(leer("src/app/i/[codigo]/invitacion-cliente.tsx"));
      if (!/<DeptosCliente\s+sesion=\{sesion\}\s+pagina=\{codigo \? rutaInvitacion\(codigo\) : "\/deptos"\}\s+puerta=\{\{ puerta: "C", detalle: `\$\{PREFIJO_DETALLE_INVITACION\}\$\{codigo \?\? ""\}` \}\}\s+origenLead="invitado"/.test(cli)) F("4 · la página del invitado no usa las preguntas de /deptos con la puerta C");
      if (!/router\.push\(urlDeLlegada\(destino, "invitacion"\)\)/.test(cli) || !/<CampoEntrada/.test(cli)) F("4 · la dirección no lleva al wizard (el informe gratis)");
      if (!/const \[modo\] = useState\(modoInicial\);/.test(cli)) F("4 · al registrarse, la página salta a «ya tienes cuenta» en medio de «Estás dentro»");
      const pag = sinComentarios(leer("src/app/i/[codigo]/page.tsx"));
      if (!/const titulo = REFERIDO_COPY\.quien\(inv\?\.conNombre \? inv\.nombre : null\);/.test(pag) || !/nombre=\{inv\?\.conNombre \? inv\.nombre : null\}/.test(pag)) F("4 · el nombre de quien invita se muestra sin que lo haya pedido");
      const dc = sinComentarios(leer("src/app/deptos/deptos-cliente.tsx"));
      if (!/encodeURIComponent\(destinoGoogle\(d\.p, pagina\)\)/.test(dc) || !/encodeURIComponent\(`\$\{pagina\}\?entro=1`\)/.test(dc)) F("4 · desde la página del invitado, Google o el enlace del correo vuelven a /deptos");
      if (!/void avisarLead\(c, origenLead, puerta\.puerta\);/.test(dc)) F("4 · el Lead de la página del invitado no sale con su puerta");

      // «Invita a alguien»: el dashboard (las dos casas), el menú de compartir y el pie del semanal.
      const dash = sinComentarios(leer("src/app/dashboard/page.tsx"));
      if ((dash.match(/<InvitaAlguien \/>/g) ?? []).length !== 2) F("4 · el dashboard no tiene «Invita a alguien» (en las dos casas)");
      const sb = sinComentarios(leer("src/components/chrome/ShareButton.tsx"));
      if (!/fetch\("\/api\/invitacion"/.test(sb) || !/data-compartir="invitar"/.test(sb) || /if \(typeof navigator !== "undefined" && navigator\.share\) \{\s*try \{\s*await navigator\.share\(\{ title, text, url \}\);\s*return;/.test(sb)) F("4 · al compartir un informe no aparece «Invita a alguien» (o el teléfono se lo salta)");
      // Vistos en el QA a 390 (16-oct-2026): el menú colgado del botón se salía por la izquierda (ahora, en el teléfono, al
      // ancho de la pantalla); el menú nativo queda adentro como «Más opciones»; el campo del nombre colapsaba en columna.
      if (!/data-compartir="menu" className="fixed inset-x-4 top-16 z-50 rounded-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full/.test(sb)) F("4 · el menú de compartir se sale de la pantalla en el teléfono");
      if (!/\{nativo && \(\s*<button onClick=\{\(\) => void shareNativo\(\)\}/.test(sb)) F("4 · al abrir siempre el menú, el teléfono pierde su menú nativo («Más opciones»)");
      if (!/<input className="h-11 w-full min-w-0 shrink-0 rounded-xl/.test(sinComentarios(leer("src/components/invitacion/InvitaAlguien.tsx")))) F("4 · el campo del nombre colapsa en el teléfono");
      const ruta = sinComentarios(leer("src/app/api/invitacion/route.ts"));
      if (!/if \(!user\) return NextResponse\.json\(\{ error: "Sin sesión" \}, \{ status: 401 \}\);/.test(ruta)) F("4 · el enlace de invitación se entrega sin sesión (es solo para registrados)");
      const inv = { url: "https://refranco.ai/i/K7M2QX", texto: "refranco.ai/i/K7M2QX" };
      const base = { variante: "tarjetas" as const, nombre: "Camila", busca: "2 dormitorios, Ñuñoa", piePct: 20, plazoAnios: 25, deptos: [], saldo: 1, conRegalo: false, urlBoton: "x", urlTres: "x", urlBaja: "https://refranco.ai/semanal/baja" };
      const conPie = correoSemanal({ ...base, invitar: inv }).html;
      const vacio = correoSemanalVacio({ nombre: null, urlPerfil: "x", urlBaja: "x", invitar: inv }).html;
      for (const [n, h] of [["el semanal", conPie], ["el semanal vacío", vacio]] as const) {
        const i = h.indexOf('data-invitar="pie"');
        if (i < 0 || !h.includes(REFERIDO_COPY.pieSemanal) || !h.includes('href="https://refranco.ai/i/K7M2QX"') || i < h.indexOf("border-top: 1px solid")) F(`4 · el pie de ${n} no invita a alguien con su enlace`);
      }
      const ss = sinComentarios(leer("src/lib/guia/semanal-servidor.ts"));
      if ((ss.match(/enlaceInvitarDelCorreo\(admin, fila\.user_id, sitio\)/g) ?? []).length !== 2) F("4 · el semanal no lleva el enlace de la persona en el pie");
      if (COOKIE_INVITACION !== "franco_invitacion") F("4 · la cookie de la invitación cambió de nombre sin migrar");
    }

    // ── 5 · LA VISITA A /i/CÓDIGO SE MIDE EN EL SERVIDOR (20-oct-2026, Fabrizio) ──
    // Medido antes del arreglo: desde el lanzamiento PostHog tenía UNA `invitacion_vista` (de un código de una cuenta de
    // prueba): salía del navegador y se perdía si la persona se iba antes de que cargara el SDK (página quieta). Y las «4
    // aperturas» de la base eran dispositivos anotados por el dashboard (GET /api/invitacion), no visitas: esas cuentas no
    // pasaron por /i/ (sus sesiones en PostHog: /semanal → /dashboard → informe). Ahora la página la emite en el servidor.
    // ACTA (scratchpad mutar-invitacion.cjs, restauradas byte a byte): 16/16 en ROJO. I1 sin consentimiento no emite · I2 sin
    // el código · I3 sin consentimiento usa la cookie de PostHog · I4 crea perfil de persona · I5 manda geografía · I6 con
    // «si» no usa el id de PostHog · I7 los robots cuentan · I8a/I8b el refresco de Next cuenta (en la cabecera y en el
    // evento) · I9 la página no la emite · I10 la emite sin mirar el consentimiento · I11 el navegador la vuelve a mandar
    // (doble) · I12 el panel de la puerta C no filtra a los invitados · I13 sin marcar los enlaces de prueba · I14 la
    // espera en vez de `waitUntil` · I15 sin decir su consentimiento.
    {
      const CHROME_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1";
      const ROBOTS = [
        "WhatsApp/2.24.20.79 A",
        "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0",
        "TelegramBot (like TwitterBot)",
        "Twitterbot/1.0",
        "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "curl/8.4.0",
      ];
      const sinConsentimiento = {
        codigo: "K7M2QX", ruta: "/i/K7M2QX", modo: "invitado" as const, conNombre: false, invitadorPrueba: false, userId: null,
        consentimiento: null, idPostHog: "ph-de-este-navegador", visita: "11111111-1111-4111-8111-111111111111", esCarga: true, agente: CHROME_IPHONE,
      };
      const ev = eventoInvitacionVista(sinConsentimiento);
      if (!ev) F("5 · una visita sin consentimiento no registra nada");
      else {
        const props = (ev.properties ?? {}) as Record<string, unknown>;
        if (ev.event !== "invitacion_vista") F(`5 · la visita no se llama invitacion_vista: ${ev.event}`);
        if (props.codigo !== "K7M2QX" || props.valida !== true || props.$pathname !== "/i/K7M2QX") F("5 · la visita sin consentimiento no lleva el código");
        if (ev.distinctId !== `visita:${sinConsentimiento.visita}` || ev.uuid !== sinConsentimiento.visita) F(`5 · sin consentimiento la visita usa un id que queda en el dispositivo (${ev.distinctId}), no uno de esa visita`);
        if (props.$process_person_profile !== false) F("5 · sin consentimiento la visita crea un perfil de persona");
        if ("$ip" in props || props.$geoip_disable !== true) F("5 · la visita manda la IP o la geografía");
        if (props.consentimiento !== "no" || props.origen !== "servidor" || props.modo !== "invitado" || props.invitador_prueba !== false) F("5 · la visita no dice su consentimiento, su origen, su modo o si el enlace es de prueba");
        // Llega a PostHog con el código (capturarServidor con un fetch de mentira).
        let cuerpo: Record<string, unknown> | null = null;
        const ok = await capturarServidor(ev, {
          key: "phc_prueba", host: "https://ph.test",
          fetch: (async (_u: unknown, init?: { body?: unknown }) => { cuerpo = JSON.parse(String(init?.body)) as Record<string, unknown>; return new Response("{}", { status: 200 }); }) as unknown as typeof fetch,
        });
        const enviado = (cuerpo ?? {}) as Record<string, unknown>;
        const pEnv = (enviado.properties ?? {}) as Record<string, unknown>;
        if (!ok || enviado.event !== "invitacion_vista" || pEnv.codigo !== "K7M2QX" || enviado.distinct_id !== ev.distinctId || pEnv.$process_person_profile !== false) F("5 · la visita sin consentimiento no llega a PostHog con el código");
      }
      const otra = eventoInvitacionVista({ ...sinConsentimiento, visita: "22222222-2222-4222-8222-222222222222" });
      if (!otra || otra.distinctId === ev?.distinctId) F("5 · dos visitas sin consentimiento caen en la misma persona");
      const conNo = eventoInvitacionVista({ ...sinConsentimiento, consentimiento: "no" });
      if (!conNo || conNo.distinctId !== `visita:${sinConsentimiento.visita}`) F("5 · con «no» la visita no queda sin persona");
      const conSi = eventoInvitacionVista({ ...sinConsentimiento, consentimiento: "si" });
      if (!conSi || conSi.distinctId !== "ph-de-este-navegador" || (conSi.properties as Record<string, unknown>).$process_person_profile !== true || (conSi.properties as Record<string, unknown>).consentimiento !== "si")
        F("5 · con «si» la visita no cae en la persona de su navegador (el id de la cookie de PostHog)");
      const conSesion = eventoInvitacionVista({ ...sinConsentimiento, userId: "u-1", modo: "propio" });
      if (!conSesion || conSesion.distinctId !== "u-1") F("5 · con sesión la visita no es de la cuenta");
      for (const ua of [...ROBOTS, null]) if (eventoInvitacionVista({ ...sinConsentimiento, agente: ua })) F(`5 · una vista previa o un robot (${ua ?? "sin agente"}) cuenta como visita`);
      if (esRobot("Mozilla/5.0 (Linux; Android 11; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36")) F("5 · un teléfono CUBOT cuenta como robot");
      if (eventoInvitacionVista({ ...sinConsentimiento, esCarga: false })) F("5 · el refresco de Next (al registrarse) cuenta como otra visita");
      const h = (o: Record<string, string>) => ({ get: (n: string) => o[n.toLowerCase()] ?? null });
      if (!esCargaDePagina(h({ "sec-fetch-dest": "document" })) || !esCargaDePagina(h({}))) F("5 · la carga de la página no cuenta como visita");
      if (esCargaDePagina(h({ rsc: "1" })) || esCargaDePagina(h({ "next-router-prefetch": "1" })) || esCargaDePagina(h({ "sec-fetch-dest": "empty" })) || esCargaDePagina(h({ purpose: "prefetch" })))
        F("5 · el refresco, la navegación o un prefetch de Next cuentan como visita");
      const key = "phc_prueba";
      if (idPostHogDeCookies([{ name: `ph_${key}_posthog`, value: encodeURIComponent(JSON.stringify({ distinct_id: "abc" })) }], key) !== "abc"
        || idPostHogDeCookies([], key) !== null || idPostHogDeCookies([{ name: `ph_${key}_posthog`, value: "{roto" }], key) !== null || idPostHogDeCookies([{ name: `ph_${key}_posthog`, value: "{}" }], null) !== null)
        F("5 · no lee bien el id de la cookie de PostHog");
      // El cableado: la página la emite al pintarse —ya con el modo decidido—, con el consentimiento de la cookie y sin
      // demorar la respuesta (waitUntil); el navegador ya no la manda (contaría dos veces).
      const pag = sinComentarios(leer("src/app/i/[codigo]/page.tsx"));
      const iEv = pos(pag, "const ev = eventoInvitacionVista({");
      if (!/if \(esCargaDePagina\(cabeceras\) && !esRobot\(agente\)\) \{\s*const ev = eventoInvitacionVista\(\{/.test(pag) || !/if \(ev\) waitUntil\(capturarServidor\(ev\)\.catch\(\(\) => false\)\);/.test(pag) || iEv < pos(pag, 'else modo = "con_cuenta";') || iEv > pos(pag, "return (\n"))
        F("5 · la página /i/ no emite la visita en el servidor (o la emite antes de saber el modo, o esperándola)");
      if (!/consentimiento: consentimientoDeCookie\(cabeceras\.get\("cookie"\)\),/.test(pag) || !/idPostHog: idPostHogDeCookies\(cookies\(\)\.getAll\(\), process\.env\.NEXT_PUBLIC_POSTHOG_KEY\),/.test(pag)
        || !/invitadorPrueba: inv \? await invitadorDePrueba\(admin, inv\.userId\) : false,/.test(pag) || !/codigo,\s*ruta: `\/i\/\$\{params\.codigo\}`,\s*modo,/.test(pag))
        F("5 · la página emite la visita sin mirar el consentimiento, la cookie de PostHog, si el enlace es de prueba o el código");
      if (/capture\(\s*["'`]invitacion_vista/.test(sinComentarios(leer("src/app/i/[codigo]/invitacion-cliente.tsx")))) F("5 · el navegador también manda invitacion_vista: cada visita contaría dos veces");
      // El panel: la cohorte de la puerta C («Referidos por semana», el mismo SQL del insight 7aJ56Uij) lee las visitas.
      const doc = leer("docs/posthog-activacion-por-puerta.md");
      const sec = doc.slice(pos(doc, "## La cohorte de la puerta C"));
      if (!/where event = 'invitacion_vista'\s+and timestamp >= now\(\) - interval 30 week\s+and toString\(properties\.origen\) = 'servidor'\s+and toString\(properties\.modo\) = 'invitado'\s+and toString\(properties\.invitador_prueba\) != 'true'/.test(sec)
        || !/if\(visitas = 0, null, round\(invitados_nuevos \/ visitas, 3\)\) as registro_por_visita/.test(sec) || !/from vis full outer join reg on vis\.semana = reg\.semana/.test(sec))
        F("5 · la cohorte de la puerta C del panel no lee las visitas (invitacion_vista del servidor, de invitados, sin enlaces de prueba)");
    }
  } catch (e) {
    F(`excepción: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  } finally {
    if (posthog !== undefined) process.env.NEXT_PUBLIC_POSTHOG_KEY = posthog;
  }
  for (const f of fallas) console.log(`  · ${f}`);
  console.log(fallas.length === 0 ? "  ✓ PUERTA-C: todo en verde" : `  ✗ PUERTA-C: ${fallas.length} fallas`);
  return { hard: fallas.length };
}

if (require.main === module) {
  runPuertaCTier().then((r) => { process.exitCode = r.hard ? 1 : 0; });
}
