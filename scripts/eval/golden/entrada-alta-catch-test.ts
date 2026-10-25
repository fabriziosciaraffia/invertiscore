// ============================================================================
// TIER ENTRADA-ALTA — «Entrar» en /deptos no puede quedar girando (22-oct-2026, pedido de Fabrizio tras el QA)
//
//   1 · UN ALTA QUE NO RESPONDE: todo pedido del paso tiene tope de 8 s y se repite solo una vez; si tampoco responde,
//       termina —nunca queda esperando— y el botón dice «No pudimos entrar, intenta de nuevo», activo, con el mismo
//       código. Probado con un pedido que NUNCA responde. EN ROJO CON EL CÓDIGO DE HOY: no había tope.
//   2 · EL MISMO CÓDIGO REPONE LA SESIÓN: el código se verifica en el servidor junto con el alta; si la respuesta se
//       perdió, el reintento con el mismo código (ya usado en Supabase) repone la sesión una vez, dentro de 3 minutos, y
//       devuelve el alta ya hecha sin correrla dos veces. Otro código, tarde o dos veces: no.
//   3 · `alta_perdida`: una entrada verificada (código, enlace o Google) sin alta pasado el minuto sale a PostHog una vez,
//       con la puerta y el camino, desde el cron de /deptos.
//   4 · El pedido de /api/invitacion se corta al salir de la página, sin error en la consola.
// Verificado EN ROJO contra el código de hoy y por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/entrada-alta-catch-test.ts
// ============================================================================
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

const RAIZ = join(__dirname, "..", "..", "..");
const existe = (p: string) => existsSync(join(RAIZ, p));
const leer = (p: string) => (existe(p) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));
const entre = (s: string, desde: string, hasta: string) => {
  const i = s.indexOf(desde);
  const j = i < 0 ? -1 : s.indexOf(hasta, i + desde.length);
  return i < 0 || j < 0 ? "" : s.slice(i, j);
};
function cargar<T>(ruta: string): T | null {
  try { return require(join(RAIZ, ruta)) as T; } catch { return null; }
}
/** Un vigía propio: si lo probado se cuelga, devuelve «colgado» en vez de esperar. Sin él, un pedido que nunca responde
 *  deja a Node sin nada pendiente y el proceso termina con 0 ANTES del veredicto (visto en la mutación E1). */
function conVigia<T>(p: Promise<T>, ms = 3000): Promise<T | "colgado"> {
  let h: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([p.finally(() => clearTimeout(h)), new Promise<"colgado">((ok) => { h = setTimeout(() => ok("colgado"), ms); })]);
}
type Entrada = typeof import("../../../src/lib/deptos/entrada");
type EntradaSrv = typeof import("../../../src/lib/deptos/entrada-servidor");

/** Un cliente de Supabase de mentira para la tabla de entradas: devuelve `filas` en toda lectura y anota las escrituras. */
function baseDeEntradas(filas: Array<Record<string, unknown>>) {
  const escrituras: Array<{ op: string; valores: unknown; filtros: string[] }> = [];
  const cadena = (op: string, valores: unknown = null) => {
    const c = { op, valores, filtros: [] as string[] };
    if (op !== "select") escrituras.push(c);
    const q: unknown = new Proxy({}, {
      get: (_t, k) => (k === "then"
        ? (ok: (v: unknown) => void) => ok(op === "select" ? { data: filas, error: null } : { error: null })
        : (...a: unknown[]) => { c.filtros.push(`${String(k)}(${a.map((x) => JSON.stringify(x)).join(",")})`); return q; }),
    });
    return q;
  };
  const admin = { from: () => ({ select: () => cadena("select"), update: (v: unknown) => cadena("update", v), insert: (v: unknown) => cadena("insert", v) }) } as unknown as SupabaseClient;
  return { admin, escrituras };
}

export async function runEntradaAltaTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER ENTRADA-ALTA («Entrar» con tope y un reintento, el mismo código repone la sesión, alta_perdida · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const en = cargar<Entrada>("src/lib/deptos/entrada.ts");

  // ── 1 · UN ALTA QUE NO RESPONDE ──
  try {
    if (!en) throw new Error("falta lib/deptos/entrada");
    // ⚠ ACTA (25-oct-2026, recorrido de Fabrizio con +qadeptos4) · el tope sube de 8 a 20 s: en producción el alta tarda unos
    // 10 s y a los 8 el reintento era casi seguro (y el reintento, antes de este goal, mandaba al dashboard).
    if (en.TOPE_ENTRAR_MS !== 20_000 || en.REINTENTOS_ENTRAR !== 1) F(`1 · el tope no es 20 s con un reintento (${en.TOPE_ENTRAR_MS} ms, ${en.REINTENTOS_ENTRAR})`);
    if (en.ENTRAR_COPY.noPudimos !== "No pudimos entrar, intenta de nuevo") F(`1 · el botón no dice «No pudimos entrar, intenta de nuevo» («${en.ENTRAR_COPY.noPudimos}»)`);
    // Un pedido que NUNCA responde (ni escucha la señal): termina igual, después de dos intentos.
    let llamados = 0;
    const senales: AbortSignal[] = [];
    const t0 = Date.now();
    const nunca = await conVigia(en.conTopeYReintento((s) => { llamados++; senales.push(s); return new Promise<never>(() => {}); }, { tope: 40 }));
    const ms = Date.now() - t0;
    if (nunca === "colgado") F("1 · un alta que no responde deja esperando para siempre (el botón quedaría girando)");
    else {
      if (nunca.ok || nunca.motivo !== "tope" || nunca.intentos !== 2 || llamados !== 2) F(`1 · un alta que no responde no termina en «tope» tras dos intentos: ${JSON.stringify(nunca)}, ${llamados} pedidos`);
      if (ms > 1000) F(`1 · un alta que no responde deja esperando (${ms} ms con tope de 40)`);
      if (!senales.every((s) => s.aborted)) F("1 · el pedido sin respuesta no se corta (la señal no se aborta)");
    }
    // El primero no responde y el reintento sí: entra.
    let n = 0;
    const segundo = await conVigia(en.conTopeYReintento(() => (++n === 1 ? new Promise<never>(() => {}) : Promise.resolve({ estado: "nueva" })), { tope: 40 }));
    if (segundo === "colgado" || !segundo.ok || segundo.intentos !== 2 || (segundo.valor as { estado: string }).estado !== "nueva") F(`1 · el reintento que responde no entra: ${JSON.stringify(segundo)}`);
    // Un corte de red también se reintenta; una respuesta, aunque sea un error del servidor, no.
    let m = 0;
    const red = await en.conTopeYReintento(() => (++m === 1 ? Promise.reject(new TypeError("Failed to fetch")) : Promise.resolve("ok")), { tope: 40 });
    if (!red.ok || red.intentos !== 2) F("1 · un corte de red no se reintenta");
    let k = 0;
    const errorServidor = await en.conTopeYReintento(() => { k++; return Promise.resolve({ status: 500 }); }, { tope: 40 });
    if (!errorServidor.ok || k !== 1) F("1 · una respuesta del servidor se repite como si no hubiera llegado");
  } catch (e) {
    F(`1 · no corrió: ${(e as Error).message}`);
  }
  try {
    // La pantalla: el paso usa el tope, no verifica contra Supabase, y sin respuesta deja el botón activo con el aviso.
    const dc = codigo("src/app/deptos/deptos-cliente.tsx");
    const entrar = entre(dc, "async function entrar(e: FormEvent)", "\n  }\n");
    if (!/const r = await conTopeYReintento\(async \(senal\) => \{\s*const res = await fetch\("\/api\/deptos\/entrar", \{[^\n]*body: JSON\.stringify\(\{ correo: enviado, codigo: t \}\), signal: senal \}\);/.test(entrar)) F("1 · «Entrar» no pide la entrada al servidor con tope y señal");
    if (!/if \(!r\.ok \|\| r\.valor\.status >= 500 \|\| r\.valor\.status === 401\) \{ setFalloEntrar\(true\); return; \}/.test(entrar) || !/\} finally \{\s*setOcupado\(false\);\s*\}/.test(entrar)) F("1 · sin respuesta, «Entrar» no avisa o no vuelve a quedar activo");
    if (/verifyOtp/.test(dc)) F("1 · /deptos verifica el código contra Supabase desde el navegador (la respuesta se puede perder sin tope)");
    // ⚠ ACTA (22-oct-2026, estándar de carga · tier CARGA) · el presionado ya no se escribe a mano: `{...botonOcupado(x)}` deja
    // el botón presionado y con el aro; y toda ida por código tras el servidor enciende la barra con iniciarCarga(claveActual()).
    if (!/disabled=\{!!ocupado\} \{\.\.\.botonOcupado\(ocupado === "entrar"\)\} data-deptos="entrar" data-fallo=\{falloEntrar \? "1" : undefined\}>\{falloEntrar \? ENTRAR_COPY\.noPudimos : REGISTRO_UN_PASO\.entrar\}<\/button>/.test(dc)) F("1 · el botón no dice «No pudimos entrar, intenta de nuevo» cuando falló (o no se ve ocupado mientras entra)");
    if (/setCodigo\(""\)|setEnviado\(null\)/.test(entrar)) F("1 · al fallar se pierde el código o el correo (habría que pedir otro)");
    const terminar = entre(dc, "const terminarAlta = useCallback(", "}, [aplicarAlta]);");
    if (!/const r = await conTopeYReintento\(async \(senal\) => \{\s*const res = await fetch\("\/api\/deptos\/alta"/.test(terminar) || !/if \(!r\.ok\) \{ setAltaPorReintentar\(\{ clave, metodo \}\); return; \}/.test(terminar)) F("1 · al volver por el enlace o por Google, el alta no tiene tope ni salida");
    // ⚠ ACTA (23-oct-2026, goal «puerta B, parte 1», mockup 1b) · el reintento va fuera de la banda, con el botón en tinta (dp-fin).
    if (!/\{altaPorReintentar && \(\s*<div className="dp-fin dp-fin-izq" data-deptos="alta-fallida">\s*<button type="button" className="dp-boton dp-boton-tinta" onClick=\{\(\) => void terminarAlta\(altaPorReintentar\.clave, altaPorReintentar\.metodo\)\} disabled=\{altaEnCurso\} \{\.\.\.botonOcupado\(altaEnCurso\)\}>\{ENTRAR_COPY\.noPudimos\}<\/button>/.test(dc)) F("1 · sin alta al volver por el enlace o por Google, no hay cómo reintentarla");
  } catch (e) {
    F(`1 · no corrió: ${(e as Error).message}`);
  }

  // ── 2 · EL MISMO CÓDIGO REPONE LA SESIÓN ──
  try {
    if (!en) throw new Error("falta lib/deptos/entrada");
    const ahora = new Date("2026-10-22T15:00:00Z");
    const hace = (s: number) => new Date(ahora.getTime() - s * 1000).toISOString();
    const yo = { id: "u-1", email: "a@b.cl" };
    const correr = async (o: { sesion?: typeof yo | null; verifica?: boolean; previa?: Partial<import("../../../src/lib/deptos/entrada").EntradaRegistrada> | null; repone?: boolean; codigo?: string }) => {
      const log: string[] = [];
      const r = await en.entrarConCodigo("a@b.cl", o.codigo ?? "123456", {
        sesionActual: async () => o.sesion ?? null,
        verificar: async () => { log.push("verificar"); return o.verifica ? yo : null; },
        hash: (c, t) => `h:${c}:${t}`,
        ultimaEntrada: async () => (o.previa === null || o.previa === undefined ? null : { id: "e-1", userId: "u-1", codigoHash: "h:a@b.cl:123456", verificadoAt: hace(30), alta: null, recuperadaAt: null, ...o.previa }),
        registrar: async (p) => { log.push(`registrar:${p.codigoHash}`); },
        reponerSesion: async () => { log.push("reponer"); return o.repone === false ? null : yo; },
        marcarRepuesta: async () => { log.push("repuesta"); },
        alta: async () => { log.push("alta"); return { cuerpo: { estado: "nueva" } }; },
        marcarAlta: async () => { log.push("marcar-alta"); },
        ahora: () => ahora,
      });
      return { r, log };
    };
    const normal = await correr({ verifica: true });
    if (normal.r.tipo !== "alta" || normal.log.join() !== "verificar,registrar:h:a@b.cl:123456,alta,marcar-alta") F(`2 · la entrada normal no verifica, registra, da de alta y marca: ${normal.log.join()}`);
    const guardada = await correr({ verifica: false, previa: { alta: { estado: "nueva", regaloVence: "x" } } });
    if (guardada.r.tipo !== "alta" || (guardada.r.tipo === "alta" && guardada.r.via !== "alta-guardada") || guardada.log.includes("alta") || !guardada.log.includes("reponer") || !guardada.log.includes("repuesta")) F(`2 · el reintento con el mismo código no repone la sesión o corre el alta dos veces: ${guardada.log.join()}`);
    const sinAlta = await correr({ verifica: false, previa: { alta: null } });
    if (sinAlta.r.tipo !== "alta" || sinAlta.log.filter((x) => x === "alta").length !== 1) F(`2 · si el alta no alcanzó a correr, el reintento no la corre: ${sinAlta.log.join()}`);
    const otro = await correr({ verifica: false, previa: { alta: null }, codigo: "999999" });
    if (otro.r.tipo !== "codigo" || otro.log.includes("reponer")) F("2 · otro código repone la sesión");
    const tarde = await correr({ verifica: false, previa: { verificadoAt: hace(4 * 60) } });
    if (tarde.r.tipo !== "codigo" || tarde.log.includes("reponer")) F("2 · el mismo código repone la sesión pasados 3 minutos");
    const dosVeces = await correr({ verifica: false, previa: { recuperadaAt: hace(10) } });
    if (dosVeces.r.tipo !== "codigo") F("2 · el mismo código repone la sesión dos veces");
    const conSesion = await correr({ sesion: yo });
    if (conSesion.r.tipo !== "alta" || conSesion.log.includes("verificar")) F("2 · con la sesión ya puesta, verifica de nuevo (el código ya se usó)");
    // Visto en el QA: la cookie llegó y la respuesta no. Con la sesión puesta y el alta ya hecha, la misma respuesta —no un
    // alta nueva, que diría «sin-pendiente» y mandaría al dashboard—; con un alta vieja o de otra cuenta, el alta de siempre.
    const cookieSinRespuesta = await correr({ sesion: yo, previa: { alta: { estado: "nueva" } } });
    if (cookieSinRespuesta.r.tipo !== "alta" || (cookieSinRespuesta.r.tipo === "alta" && cookieSinRespuesta.r.via !== "alta-guardada") || cookieSinRespuesta.log.includes("alta")) F(`2 · con la cookie puesta y el alta ya hecha, corre el alta otra vez (iría al dashboard): ${cookieSinRespuesta.log.join()}`);
    const altaVieja = await correr({ sesion: yo, previa: { alta: { estado: "nueva" }, verificadoAt: hace(10 * 60) } });
    const altaAjena = await correr({ sesion: yo, previa: { alta: { estado: "nueva" }, userId: "otra" } });
    if (!altaVieja.log.includes("alta") || !altaAjena.log.includes("alta")) F("2 · devuelve un alta guardada vieja o de otra cuenta");
    // ── 2b · EL REINTENTO NO LE GANA AL PRIMER PEDIDO (25-oct-2026, +qadeptos4 saltó al dashboard) ──
    // El caso real: el primero verificó (14:02:29,97), sigue corriendo y todavía no guardó su alta; el reintento llega a los
    // 8 s, el código ya se usó, repone la sesión. Si corre el alta, el alta dice «sin-pendiente» (lo elegido ya se usó) y la
    // pantalla se va al dashboard. Tiene que esperar a que el primero guarde la suya («nueva») y devolver esa.
    {
      const log: string[] = [];
      let miradas = 0, esperas = 0;
      const enCurso = await en.entrarConCodigo("a@b.cl", "123456", {
        sesionActual: async () => null,
        verificar: async () => { log.push("verificar"); return null; },
        hash: (c, t) => `h:${c}:${t}`,
        // Las dos primeras miradas, sin alta (el primero corre); a la tercera, el primero ya guardó «nueva».
        ultimaEntrada: async () => ({ id: "e-1", userId: "u-1", codigoHash: "h:a@b.cl:123456", verificadoAt: hace(8), alta: ++miradas >= 4 ? { estado: "nueva", regaloVence: "2026-11-24T00:00:00Z" } : null, recuperadaAt: null }),
        registrar: async () => { log.push("registrar"); },
        reponerSesion: async () => { log.push("reponer"); return yo; },
        marcarRepuesta: async () => { log.push("repuesta"); },
        alta: async () => { log.push("alta"); return { cuerpo: { estado: "sin-pendiente" } }; },
        marcarAlta: async () => { log.push("marcar-alta"); },
        ahora: () => ahora,
        esperar: async () => { esperas++; },
      });
      const cuerpo = enCurso.tipo === "alta" ? enCurso.cuerpo : null;
      if (cuerpo?.estado !== "nueva" || log.includes("alta") || log.includes("marcar-alta") || esperas < 1) F(`2b · el reintento corre el alta mientras el primero sigue (respondería ${JSON.stringify(cuerpo)}: al dashboard sin «Estás dentro»): ${log.join()}`);
      // Si el primero murió sin alta, el reintento espera lo justo y corre el alta él mismo (una vez).
      let esperas2 = 0;
      const log2: string[] = [];
      const muerto = await en.entrarConCodigo("a@b.cl", "123456", {
        sesionActual: async () => null, verificar: async () => null, hash: (c, t) => `h:${c}:${t}`,
        ultimaEntrada: async () => ({ id: "e-1", userId: "u-1", codigoHash: "h:a@b.cl:123456", verificadoAt: hace(8), alta: null, recuperadaAt: null }),
        registrar: async () => {}, reponerSesion: async () => yo, marcarRepuesta: async () => {},
        alta: async () => { log2.push("alta"); return { cuerpo: { estado: "nueva" } }; }, marcarAlta: async () => {},
        ahora: () => ahora, esperar: async () => { esperas2++; },
      });
      if (muerto.tipo !== "alta" || log2.filter((x) => x === "alta").length !== 1 || esperas2 * en.PASO_ESPERA_MS < en.ESPERA_ALTA_EN_CURSO_MS || en.ESPERA_ALTA_EN_CURSO_MS >= en.TOPE_ENTRAR_MS) F(`2b · con el primero muerto, el reintento no espera lo justo y corre el alta una vez (${esperas2} esperas, ${log2.join()})`);
    }
    // ── 2c · EL ALTA REPETIDA DE UNA CUENTA RECIÉN CREADA ES «NUEVA» (por código o al volver de Google) ──
    {
      const altaSrv = cargar<typeof import("../../../src/lib/deptos/alta-servidor")>("src/lib/deptos/alta-servidor.ts");
      if (!altaSrv) F("2c · falta lib/deptos/alta-servidor");
      else {
        const t = Date.parse("2026-10-25T14:02:40Z");
        const perfil = { comunas: ["Providencia"], dormitorios: [2], precio_min_uf: 4000, precio_max_uf: 6000 };
        const r1 = altaSrv.respuestaDeAltaRepetida({ creadaAt: "2026-10-25T14:02:15Z", perfil, regaloVence: "2026-11-24T14:02:33Z" }, t);
        if (r1?.estado !== "nueva" || r1.regaloVence !== "2026-11-24T14:02:33Z" || (r1.busqueda as { comunas?: string[] } | undefined)?.comunas?.[0] !== "Providencia") F(`2c · el segundo pedido de una cuenta recién creada no es «nueva» con su regalo y su búsqueda: ${JSON.stringify(r1)}`);
        if (altaSrv.respuestaDeAltaRepetida({ creadaAt: "2026-10-01T00:00:00Z", perfil, regaloVence: null }, t) !== null || altaSrv.respuestaDeAltaRepetida({ creadaAt: "2026-10-25T14:02:15Z", perfil: null, regaloVence: null }, t) !== null) F("2c · una cuenta vieja, o sin perfil, entra como «nueva»");
        const ejecutar = codigo("src/lib/deptos/alta-servidor.ts");
        // ⚠ ACTA (25-oct-2026, «Estás dentro» en menos de 2 s) · el alta se partió en piezas con su orden (lib/deptos/alta-orden.ts › ordenarAlta; tier ALTA-ORDEN): la pieza `repetida` usa respuestaDeAltaRepetida y
        // el orden la consulta sin nada pendiente (comportamiento en ALTA-ORDEN §5).
        const ord = codigo("src/lib/deptos/alta-orden.ts");
        if (!/return respuestaDeAltaRepetida\(\{ creadaAt: user\.created_at, perfil: perfil as Record<string, unknown> \| null, regaloVence \}\);/.test(ejecutar)
          || !/if \(!pend\) \{\s*const repetida = e\.cuentaNueva \? await piezas\.repetida\(\) : null;\s*return \{ cuerpo: repetida \?\? \{ estado: "sin-pendiente" \}/.test(ord)) F("2c · el alta sin nada pendiente no mira si es el segundo pedido de una cuenta recién creada");
      }
    }
    // El servidor: verifica ahí, repone con un enlace generado (sin correo) y corre la misma alta.
    const ruta = codigo("src/app/api/deptos/entrar/route.ts");
    if (!/await supabase\.auth\.verifyOtp\(\{ email: c, token: t, type: "email" \}\)/.test(ruta) || !/admin\.auth\.admin\.generateLink\(\{ type: "magiclink", email: c \}\)/.test(ruta) || !/ejecutarAlta\(admin, user, request, \{ ruta: RUTA, crono, pendiente: pendientePrevia, despues: waitUntil \}\)/.test(ruta) || !/entrarConCodigo\(correo, codigo, \{/.test(ruta)) F("2 · /api/deptos/entrar no verifica en el servidor, no repone la sesión o no corre la misma alta");
    // ⚠ ACTA (25-oct-2026, «Estás dentro» en menos de 2 s) · el alta se partió en piezas con su orden (lib/deptos/alta-orden.ts › ordenarAlta; tier ALTA-ORDEN): las dos rutas le pasan el cronómetro y lo de después.
    if (!/ejecutarAlta\(admin, user, request, \{ clave: b\.p, ruta: RUTA, crono, despues: waitUntil \}\)/.test(codigo("src/app/api/deptos/alta/route.ts"))) F("2 · el alta de siempre no es la misma función");
    const srv = cargar<EntradaSrv>("src/lib/deptos/entrada-servidor.ts");
    if (!srv) F("2 · falta lib/deptos/entrada-servidor");
    else {
      const h = srv.hashCodigo("A@b.cl", "123456", "secreto-de-prueba-largo"), h2 = srv.hashCodigo("a@b.cl", "123456", "secreto-de-prueba-largo"), h3 = srv.hashCodigo("a@b.cl", "123457", "secreto-de-prueba-largo");
      if (h !== h2 || h === h3 || h.includes("123456")) F("2 · el hash del código no reconoce el mismo código, confunde otro o lo deja a la vista");
    }
  } catch (e) {
    F(`2 · no corrió: ${(e as Error).message}`);
  }

  // ── 3 · alta_perdida ──
  try {
    if (!en) throw new Error("falta lib/deptos/entrada");
    const ahora = new Date("2026-10-22T15:00:00Z");
    const hace = (s: number) => new Date(ahora.getTime() - s * 1000).toISOString();
    if (!en.esAltaPerdida({ verificadoAt: hace(61), altaAt: null, perdidaAvisadaAt: null }, ahora)) F("3 · una entrada sin alta pasado el minuto no es alta perdida");
    if (en.esAltaPerdida({ verificadoAt: hace(30), altaAt: null, perdidaAvisadaAt: null }, ahora) || en.esAltaPerdida({ verificadoAt: hace(120), altaAt: hace(100), perdidaAvisadaAt: null }, ahora) || en.esAltaPerdida({ verificadoAt: hace(120), altaAt: null, perdidaAvisadaAt: hace(5) }, ahora)) F("3 · cuenta como perdida una entrada reciente, con alta o ya avisada");
    if (en.metodoDeEntrada("/deptos?entro=1") !== "enlace" || en.metodoDeEntrada("/i/ABC?entro=google&p=x") !== "google" || en.metodoDeEntrada("/dashboard") !== null || en.metodoDeEntrada("https://x.cl/deptos?entro=1") !== null) F("3 · no se reconoce el camino de la entrada (enlace o Google)");
    const srv = cargar<EntradaSrv>("src/lib/deptos/entrada-servidor.ts");
    if (!srv) throw new Error("falta lib/deptos/entrada-servidor");
    const filas = [
      { id: "p1", correo: "a@b.cl", user_id: "u-1", puerta: "B", metodo: "codigo", verificado_at: hace(120), alta_at: null, perdida_avisada_at: null },
      { id: "p2", correo: "c@d.cl", user_id: null, puerta: "C", metodo: "google", verificado_at: hace(30), alta_at: null, perdida_avisada_at: null },
    ];
    const b = baseDeEntradas(filas);
    const eventos: Array<Record<string, unknown>> = [];
    const n = await srv.avisarAltasPerdidas(b.admin, ahora, (async (ev: Record<string, unknown>) => { eventos.push(ev); return true; }) as never);
    const ev = eventos[0] as { event?: string; distinctId?: string; uuid?: string; timestamp?: string; properties?: Record<string, unknown> } | undefined;
    if (n !== 1 || eventos.length !== 1 || ev?.event !== "alta_perdida" || ev.distinctId !== "u-1" || ev.properties?.puerta !== "B" || ev.properties?.metodo !== "codigo") F(`3 · alta_perdida no sale una vez, con la puerta y el camino: ${JSON.stringify(eventos)}`);
    if (ev && ev.timestamp !== new Date(ahora.getTime() - 60_000).toISOString()) F(`3 · alta_perdida no lleva la hora en que se cumplió el minuto (${ev?.timestamp})`);
    if (!ev?.uuid || !/^[0-9a-f-]{36}$/.test(ev.uuid)) F("3 · alta_perdida sin uuid determinista (se contaría dos veces)");
    if (!b.escrituras.some((w) => w.op === "update" && (w.valores as Record<string, unknown>)?.perdida_avisada_at && w.filtros.some((f) => f.startsWith('eq("id","p1")')))) F("3 · la entrada avisada no queda marcada (se avisaría en cada vuelta del cron)");
  } catch (e) {
    F(`3 · no corrió: ${(e as Error).message}`);
  }
  try {
    // El cableado: el cron de /deptos lo corre, el callback registra el enlace y Google, el alta marca su entrada.
    const cron = codigo("src/app/api/cron/correo-del-dia/route.ts");
    if (!/altasPerdidas = await avisarAltasPerdidas\(admin\);/.test(cron)) F("3 · el cron de /deptos no avisa las altas perdidas");
    const cb = codigo("src/app/auth/callback/route.ts");
    if (!/const metodo = metodoDeEntrada\(next\);/.test(cb) || !/if \(await leerPendiente\(adminEntrada, user\.email\)\) await registrarEntrada\(adminEntrada, \{ correo: user\.email, userId: user\.id, metodo \}\);/.test(cb)) F("3 · la entrada por el enlace o por Google no queda registrada");
    // ⚠ ACTA (25-oct-2026, «Estás dentro» en menos de 2 s) · el alta se partió en piezas con su orden (lib/deptos/alta-orden.ts › ordenarAlta; tier ALTA-ORDEN): la marca va después de responder (waitUntil).
    if (!/if \(typeof r\.cuerpo\.estado === "string"\) waitUntil\(marcarAlta\(admin, \{ correo: user\.email, userId: user\.id, alta: r\.cuerpo \}\)/.test(codigo("src/app/api/deptos/alta/route.ts"))) F("3 · el alta por el enlace o por Google no marca su entrada (toda entrada así contaría como perdida)");
    if (!/guardarPendiente\(admin, correo, perfilManualDeElecciones\(v\), existe, esPuertaDeptos\(b\.puerta\) \? b\.puerta : null\)/.test(codigo("src/app/api/deptos/correo/route.ts")) || !/guardarPendienteGoogle\(createServiceClient\(\), perfilManualDeElecciones\(v\), esPuertaDeptos\(b\.puerta\) \? b\.puerta : null\)/.test(codigo("src/app/api/deptos/google/route.ts"))) F("3 · lo elegido no guarda la puerta");
    if ((codigo("src/app/deptos/deptos-cliente.tsx").match(/, puerta: puerta\.puerta \}\),/g) ?? []).length !== 2) F("3 · la pantalla no manda la puerta (al pedir el código y al ir a Google)");
    const mig = leer("supabase/migrations/20261022_deptos_entradas.sql");
    if (!/create table if not exists public\.deptos_entradas/.test(mig) || !/enable row level security/.test(mig) || /create policy/i.test(mig)) F("3 · la tabla de entradas no existe o no es solo del servidor");
  } catch (e) {
    F(`3 · no corrió: ${(e as Error).message}`);
  }

  // ── 4 · /api/invitacion, cortado al salir ──
  try {
    const iv = codigo("src/components/invitacion/InvitaAlguien.tsx");
    const efecto = entre(iv, "const control = new AbortController();", "}, []);");
    if (!/window\.addEventListener\("pagehide", cortar\);/.test(efecto) || !/fetch\("\/api\/invitacion", \{ cache: "no-store", signal: control\.signal \}\)/.test(efecto) || !/if \(vivo && !control\.signal\.aborted\) setError\(REFERIDO_COPY\.error\);/.test(efecto) || !/return \(\) => \{ vivo = false; window\.removeEventListener\("pagehide", cortar\); control\.abort\(\); \};/.test(efecto)) F("4 · el pedido de /api/invitacion no se corta al salir (o el corte se dice como error)");
  } catch (e) {
    F(`4 · no corrió: ${(e as Error).message}`);
  }

  if (fallas.length) {
    console.log(`  ✗ ROJO — ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 40)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — «Entrar» con tope de 20 s y un reintento que espera al primer pedido: un alta que no responde termina con el botón activo y el aviso; el mismo código repone la sesión una vez y trae el alta ya hecha; alta_perdida sale una vez con la puerta; /api/invitacion se corta al salir sin error");
  }
  return { hard: fallas.length };
}

// ACTA DE MUTACIÓN (22-oct-2026). CONTRA EL CÓDIGO DE HOY (HEAD af5c6095, todo `src/` del goal de vuelta a HEAD y los
// archivos nuevos apartados): 15 fallas, entre ellas «"Entrar" no pide la entrada al servidor con tope y señal», «/deptos
// verifica el código contra Supabase desde el navegador» y «el cron de /deptos no avisa las altas perdidas». Y 27
// mutaciones, cada una restaurada byte a byte, todas ROJAS:
//   E1 sin la carrera contra el tope (la primera versión la dejaba VERDE: el pedido que nunca responde dejaba a Node sin
//   nada pendiente y el proceso salía con 0 antes del veredicto; ahora lo vigila `conVigia`) · E2 sin reintento · E3 otro
//   tope · E4 no se corta · E5 un corte de red no se reintenta · E6 otro código repone · E7 sin ventana · E8 repone dos
//   veces · E9 corre el alta dos veces · E10 verifica con la sesión puesta · E11 no marca el alta · E12 perdida al toque ·
//   E13 se avisa en cada vuelta · E14 sin la hora del minuto · E15 el cron no avisa · E16 el callback no registra · E17 el
//   alta de siempre no marca · E18 sin aviso · E19 el botón no lo dice · E20 «Entrar» pide otra cosa · E21 /api/invitacion
//   sin corte · E22 el código a la vista · E23 sin el camino del enlace · E24 repone con otra cosa · E25 sin salida al volver.
// LO QUE AGREGÓ EL QA DEL MISMO DÍA: con la respuesta perdida, la cookie de la sesión SÍ llegó al navegador; el reintento
// entraba «con sesión», corría el alta otra vez (lo elegido ya se había usado) y la pantalla se iba al dashboard. Ahora
// devuelve el alta guardada. E9 la saca (rojo en los dos casos: repuesta y con cookie) · E26 sin la ventana · E27 sin
// mirar que sea de la misma cuenta.

if (require.main === module) {
  runEntradaAltaTier().then(({ hard }) => process.exit(hard ? 1 : 0));
}
