// ============================================================================
// TIER PAUTA-ARREGLOS — cuatro arreglos antes de prender la pauta (26-oct-2026, reporte del lunes)
//
//   1 · LAS CUENTAS DE PRUEBA FUERA DE LOS CORREOS: el único punto por donde sale todo correo (email.ts › enviarCorreo)
//       no le manda nada a una dirección de @refranco.ai que no es un buzón de Franco, ni a una cuenta de prueba sin
//       `recibe_correos`; lo que va a un buzón de Franco sale siempre. Toda cuenta interna (alias fabriziosciaraffia+…,
//       @refranco.ai) está en test_accounts —viva— y nace marcada (el trigger de la migración).
//   2 · LA SELECCIÓN DIARIA DE «QUIERO COMPRAR YA»: con un perfil de renta corta también sale (antes quedaba «sin-perfil»
//       todos los días); una persona con «Ya» y un depto nuevo que conviene recibe su selección; la primera mira los
//       nuevos de la semana y las siguientes los de 48 horas; la fila guarda su modalidad y la página la muestra como el
//       bloque corto.
//   3 · LA MEDICIÓN DE ENTRADA NO CUENTA ROBOTS: los escáneres que PostHog cuenta como personas se reconocen por el agente
//       y por cómo piden, y la vista sale marcada `robot: true` (la landing, /deptos, /i y /explorar); Explorar deja
//       «explorar_pin» al tocar un pin y «explorar_aviso» al ver el aviso sin saldo.
//   4 · LAS CONSULTAS QUE SE COLGABAN RESPONDEN EN MENOS DE 2 SEGUNDOS: el resumen de la noche se lee de `config` (lo
//       guarda el cron de la evaluación) y no se cuenta en cada pantalla; inmediato_candidatos planea con sus valores. Se
//       MIDEN contra la base real.
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/pauta-arreglos-catch-test.ts
// ============================================================================
import "./als-de-next";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { BUZONES_FRANCO, destinoBloqueado } from "../../../src/lib/correo-destino";
import { seleccionDelDia, type PreparacionInmediato } from "../../../src/lib/guia/inmediato-servidor";
import { INMEDIATO, VENTANA_NUEVOS_HORAS, VENTANA_PRIMERA_HORAS, ventanaNuevosHoras } from "../../../src/lib/guia/inmediato";
import { correoInmediato } from "../../../src/lib/email/correo-inmediato";
import { eventoVistaEntrada, robotDeVisita } from "../../../src/lib/vista-entrada";
import { eventoExplorarVista } from "../../../src/lib/explorar/servidor";
import { EVENTOS_PORTAL } from "../../../src/lib/explorar/portal";
import { CLAVE_RESUMEN_NOCHE, resumenDeLaNoche, resumenGuardado } from "../../../src/lib/deptos/servidor";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => (existsSync(join(RAIZ, p)) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));
/** El cuerpo de una función (desde su firma hasta la siguiente función de primer nivel). */
const cuerpo = (src: string, firma: string) => {
  const i = src.indexOf(firma);
  if (i < 0) return "";
  const resto = src.slice(i + firma.length);
  const fin = resto.search(/\n(export )?(async )?function |\nconst [A-Za-z_]+ = /);
  return fin < 0 ? resto : resto.slice(0, fin);
};

const UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";
const UA_CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const cab = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null });
const NAVEGADOR = cab({ "accept-language": "es-CL,es;q=0.9", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" });
const SCRIPT = cab({ accept: "*/*" });

/** Un candidato mínimo: lo que elegirInmediato y la preparación leen. */
const cand = (avisoId: string, comuna = "Providencia") => ({ avisoId, comuna, dormitorios: 2, banos: 1, m2: 55, precioUF: 3800, scoreCron: 70 }) as never;
const prep = (veredicto: string, candidatos = [cand("a1")]): PreparacionInmediato => ({
  perfil: { comunas: ["Providencia"], dormitorios: [2] } as never,
  origen: { analysisId: null },
  combo: { piePct: 20, plazoAnios: 25 },
  candidatos,
  evaluar: async () => ({ veredicto: veredicto as never, score: 80, flujo: -50000 }),
});

export async function runPautaArreglosTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER PAUTA-ARREGLOS (cuentas de prueba fuera de los correos, la selección diaria del «Ya», robots marcados, consultas bajo 2 s · 0 tokens) ───");

  // ── 1 · las cuentas de prueba fuera de los correos ──
  const prueba = new Set(["u-prueba"]);
  if (destinoBloqueado("qa-x@refranco.ai", null, null) !== "dominio-propio") F("1 · una dirección de @refranco.ai que no existe recibe correos");
  if (destinoBloqueado("QA-Y@Refranco.AI", "u-real", new Set()) !== "dominio-propio") F("1 · @refranco.ai con mayúsculas pasa");
  if (destinoBloqueado("persona@gmail.com", "u-prueba", prueba) !== "cuenta-de-prueba") F("1 · una cuenta de prueba sin recibe_correos recibe correos");
  if (destinoBloqueado("persona@gmail.com", "u-real", prueba) !== null) F("1 · una cuenta real queda sin correo");
  if (destinoBloqueado("persona@gmail.com", "u-marcada", prueba) !== null) F("1 · una cuenta de prueba marcada recibe_correos queda sin correo");
  for (const b of BUZONES_FRANCO) if (destinoBloqueado(b, "u-prueba", prueba) !== null) F(`1 · el buzón ${b} (las alertas) queda sin correo`);
  if (!BUZONES_FRANCO.includes("hola@refranco.ai")) F("1 · hola@refranco.ai no está entre los buzones de Franco");
  const env = cuerpo(codigo("src/lib/email.ts"), "async function enviarCorreo(");
  const iBloqueo = env.indexOf("destinoBloqueado("), iEnvio = env.indexOf("resend.emails.send(");
  if (iBloqueo < 0 || iEnvio < 0 || iBloqueo > iEnvio) F("1 · enviarCorreo no decide el destino antes de mandar (destinoBloqueado antes de resend.emails.send)");
  if (!/if\s*\(\s*bloqueo\s*\)\s*\{[\s\S]{0,160}return\s*\{\s*data:\s*null/.test(env)) F("1 · enviarCorreo no corta cuando el destino está bloqueado");
  if (!/cuentasDePruebaSinCorreo\(\)/.test(env)) F("1 · enviarCorreo no lee las cuentas de prueba sin correo");
  const mig = leer("supabase/migrations/20261026_pauta_arreglos.sql");
  if (!/create trigger marcar_cuenta_interna\s+after insert on auth\.users/.test(mig) || !/fabriziosciaraffia\+%@gmail\.com/.test(cuerpo(mig, "create or replace function public.marcar_cuenta_interna()")) || !/%@refranco\.ai/.test(cuerpo(mig, "create or replace function public.marcar_cuenta_interna()"))) {
    F("1 · la cuenta interna no nace marcada (sin el trigger en auth.users con los dos patrones)");
  }

  // ── 2 · la selección diaria del «Ya» ──
  const T = new Date("2026-10-26T12:00:00Z");
  const base = { avisados: async () => new Set<string>(), vistos: async () => new Set<string>(), publicado: async () => "publicado" as const };
  const corta = await seleccionDelDia({ ...base, primera: async () => false, ltr: async () => null, str: async () => prep("COMPRAR") }, T);
  if (!corta || corta.modalidad !== "str" || corta.elegidos.length !== 1) F(`2 · una persona con «Ya» y perfil de renta corta, con un depto nuevo que conviene, no recibe su selección: ${JSON.stringify(corta && { m: corta.modalidad, n: corta.elegidos.length })}`);
  const larga = await seleccionDelDia({ ...base, primera: async () => false, ltr: async () => prep("COMPRAR"), str: async () => { throw new Error("no se pide la corta si hay larga"); } }, T);
  if (!larga || larga.modalidad !== "ltr" || larga.elegidos.length !== 1) F("2 · una persona con «Ya» de renta larga y un depto nuevo que conviene no recibe su selección");
  const ajusta = await seleccionDelDia({ ...base, primera: async () => false, ltr: async () => prep("AJUSTA SUPUESTOS"), str: async () => null }, T);
  if (!ajusta || ajusta.elegidos.length !== 0) F("2 · un Ajustar entra a la selección diaria (es solo Comprar)");
  const sinPerfil = await seleccionDelDia({ ...base, primera: async () => false, ltr: async () => null, str: async () => null }, T);
  if (sinPerfil !== null) F("2 · sin perfil de ninguna modalidad igual se arma algo");
  let desdePrimera = "", desdeSiguiente = "";
  await seleccionDelDia({ ...base, primera: async () => true, ltr: async (d) => { desdePrimera = d; return prep("COMPRAR"); }, str: async () => null }, T);
  await seleccionDelDia({ ...base, primera: async () => false, ltr: async (d) => { desdeSiguiente = d; return prep("COMPRAR"); }, str: async () => null }, T);
  const horas = (d: string) => Math.round((T.getTime() - Date.parse(`${d}Z`)) / 3600_000);
  if (horas(desdePrimera) !== VENTANA_PRIMERA_HORAS || VENTANA_PRIMERA_HORAS !== 168) F(`2 · la primera no mira los nuevos de la semana (${horas(desdePrimera)} h)`);
  if (horas(desdeSiguiente) !== VENTANA_NUEVOS_HORAS || ventanaNuevosHoras(false) !== 48) F(`2 · las siguientes no miran los de 48 horas (${horas(desdeSiguiente)} h)`);
  const despub = await seleccionDelDia({ ...base, publicado: async () => "despublicado" as const, primera: async () => false, ltr: async () => prep("COMPRAR"), str: async () => null }, T);
  if (!despub || despub.elegidos.length !== 0) F("2 · un depto despublicado entra a la selección diaria");
  const av = cuerpo(codigo("src/lib/guia/inmediato-servidor.ts"), "export async function avisarPersona(");
  if (!/seleccionDelDia\(/.test(av) || !/prepararSeleccionStr\(/.test(av)) F("2 · avisarPersona no elige con seleccionDelDia (y la renta corta)");
  if (!/const fila = \{[^}]*\bmodalidad\b/.test(av)) F("2 · la fila del día no guarda su modalidad");
  const tok = cuerpo(codigo("src/lib/guia/semanal-servidor.ts"), "export async function seleccionPorToken(");
  if (!/modalidad === "str"/.test(tok) || !/corto:\s*corta\s*\?/.test(tok) || !/conLargo:\s*!corta/.test(tok)) F("2 · la selección diaria de renta corta no se muestra como el bloque corto de /semanal");
  if (!/corta && sel\.tabla === "semanal_selecciones" \? \{ items_str: items \} : \{ items \}/.test(codigo("src/lib/guia/semanal-servidor.ts"))) F("2 · el reemplazo de la selección diaria de renta corta escribe items_str (columna que avisos_inmediatos no tiene)");
  const str = cuerpo(codigo("src/lib/guia/semanal-str-servidor.ts"), "export async function prepararSeleccionStr(");
  if (!/opts\.nuevosDesde\s*\?\s*await admin\.rpc\("inmediato_candidatos_str"/.test(str)) F("2 · la renta corta de la selección diaria no pide los avisos NUEVOS (inmediato_candidatos_str)");

  // ── 5 · con vecinas, sin repetir el semanal (27-oct-2026, decisión de Fabrizio) ──
  const conVecinas = (veredictoPropio: string | null, veredictoVecina: string, vistos: string[] = []) => {
    let pidioVecinas = false;
    const p: PreparacionInmediato = {
      ...prep("COMPRAR", veredictoPropio ? [cand("propio")] : []),
      evaluar: async (c) => ({ veredicto: ((c as { avisoId: string }).avisoId === "propio" ? veredictoPropio : veredictoVecina) as never, score: 80, flujo: 0 }),
      vecinas: async () => { pidioVecinas = true; return [cand("vecina", "Las Condes")]; },
    };
    return seleccionDelDia({ ...base, vistos: async () => new Set(vistos), primera: async () => false, ltr: async () => p, str: async () => null }, T).then((r) => ({ r, pidioVecinas }));
  };
  const v1 = await conVecinas("COMPRAR", "COMPRAR");
  if (!v1.r || v1.r.deVecinas || v1.r.elegidos.map((e) => (e.c as { avisoId: string }).avisoId).join() !== "propio" || v1.pidioVecinas) F("5 · con un nuevo que conviene en sus comunas igual se miran (o se mezclan) las vecinas");
  const v2 = await conVecinas("AJUSTA SUPUESTOS", "COMPRAR");
  if (!v2.r || !v2.r.deVecinas || v2.r.elegidos.map((e) => (e.c as { avisoId: string }).avisoId).join() !== "vecina") F("5 · sin nuevos que convengan en sus comunas no se miran las vecinas");
  const v3 = await conVecinas(null, "COMPRAR", ["vecina"]);
  if (!v3.r || v3.r.elegidos.length !== 0 || v3.r.deVecinas) F("5 · un depto de vecina que ya salió en el semanal se repite en la selección diaria");
  const v4 = await conVecinas("COMPRAR", "COMPRAR", ["propio"]);
  if (!v4.r || v4.r.elegidos.map((e) => (e.c as { avisoId: string }).avisoId).join() !== "vecina" || !v4.r.deVecinas) F("5 · un depto de sus comunas que ya salió en el semanal se repite (o no deja pasar a la vecina)");
  const v5 = await conVecinas("AJUSTA SUPUESTOS", "AJUSTA SUPUESTOS");
  if (!v5.r || v5.r.elegidos.length !== 0) F("5 · un Ajustar de vecina entra a la selección diaria");
  const av5 = cuerpo(codigo("src/lib/guia/inmediato-servidor.ts"), "export async function avisarPersona(");
  if (!/vecinas: p\.p\.respaldo\.vecinas/.test(av5) || (av5.match(/vecinas: p\.p\.respaldo\.vecinas/g) ?? []).length !== 2) F("5 · avisarPersona no le pasa las vecinas (de renta larga y corta) a la selección diaria");
  if (!/vistos: async \(\) => new Set\(Array\.from\(\(await vistosDePersona\(admin, userId\)\)\.keys\(\)\)\)/.test(av5)) F("5 · avisarPersona no saca lo que ya salió en el semanal (vistosDePersona)");
  if (!/\.\.\.\(deVecinas \? \{ tramo: "vecina" as const \} : \{\}\)/.test(av5)) F("5 · los deptos de vecina no salen marcados como vecina");
  const correoBase = { nombre: null, busca: "2D en Providencia", piePct: 20, plazoAnios: 25, saldo: 1, urlBoton: "u", urlComprar: "c", urlBaja: "b" };
  const dep = { avisoId: "a", comuna: "Las Condes", tipologia: "2D1B", m2: 55, precioUF: 3800, veredicto: "COMPRAR", score: 80, flujo: 0, url: "x" };
  if (!correoInmediato({ ...correoBase, deptos: [{ ...dep, tramo: "vecina" }] as never }).html.includes(INMEDIATO.vecinas)) F("5 · el correo no dice que los deptos son de comunas vecinas");
  if (correoInmediato({ ...correoBase, deptos: [dep] as never }).html.includes(INMEDIATO.vecinas)) F("5 · el correo dice «comunas vecinas» sin que lo sean");

  // ── 3 · la medición de entrada no cuenta robots ──
  const escaneres = [
    "NoMoreVibe/1.0 (+https://nomorevibe.app)", "cve-2026-63030/1.0", "hexide-ct-indexer/0.3.1 (+https://hexide.com; ct@hexide.com)", "header-probe/2.0",
    "Mozilla/5.0 (l9scan/2.0.13e29373e2839313e2631323; +https://leakix.net)", "Mozilla/5.0 (compatible; CMS-Checker/1.0; +https://example.com)",
    "User-Agent:Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0 Safari/537.36",
  ];
  for (const a of escaneres) if (robotDeVisita(a, NAVEGADOR) !== "agente") F(`3 · el escáner «${a.slice(0, 40)}» no se reconoce por el agente`);
  if (robotDeVisita(UA_CHROME, SCRIPT) !== "comportamiento") F("3 · un agente de navegador que pide como un script (sin Accept-Language ni Sec-Fetch) no se reconoce");
  if (robotDeVisita(UA_IPHONE, NAVEGADOR) !== null) F("3 · un iPhone de verdad queda marcado como robot");
  if (robotDeVisita(UA_CHROME, cab({ "accept-language": "es" })) !== null) F("3 · un navegador sin Sec-Fetch pero con Accept-Language queda marcado (Safari viejo)");
  const vista = (agente: string, cabeceras: ReturnType<typeof cab>) => eventoVistaEntrada({ pagina: "landing", ruta: "/", search: "", referer: null, userId: null, consentimiento: null, idPostHog: null, visita: "11111111-1111-4111-8111-111111111111", esCarga: true, agente, cabeceras });
  const vEsc = vista(escaneres[0], NAVEGADOR), vReal = vista(UA_IPHONE, NAVEGADOR), vComp = vista(UA_CHROME, SCRIPT);
  if (!vEsc || vEsc.properties?.robot !== true || vEsc.properties?.robot_motivo !== "agente") F("3 · la vista de un escáner no sale marcada robot (motivo agente)");
  if (!vComp || vComp.properties?.robot !== true || vComp.properties?.robot_motivo !== "comportamiento") F("3 · la vista de un script con agente de navegador no sale marcada robot (motivo comportamiento)");
  if (!vReal || vReal.properties?.robot !== false || "robot_motivo" in (vReal.properties ?? {})) F("3 · la vista de una persona sale marcada robot");
  if (vista("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", NAVEGADOR) !== null) F("3 · un robot conocido (Googlebot) deja de descartarse");
  const exv = eventoExplorarVista({ userId: "u", filtros: { comunas: ["Providencia"], tipologias: ["2"], ufMin: 0, ufMax: 4000, pie: 20, plazo: 25 }, n: 1, analizados: 0, fuente: "pagina", robot: "agente" });
  if (exv.properties?.robot !== true || exv.properties?.robot_motivo !== "agente") F("3 · «explorar_vista» no marca el robot");
  const mw = codigo("src/middleware.ts");
  // Solo la llamada a la vista (hasta su «});»): la del navegador, más abajo, también pasa `cabeceras: request.headers`.
  const llamadaVista = (() => { const i = mw.indexOf("eventoVistaEntrada({"); return i < 0 ? "" : mw.slice(i, mw.indexOf("});", i)); })();
  if (!/cabeceras:\s*request\.headers/.test(llamadaVista)) F("3 · el middleware no pasa las cabeceras a la vista (la landing y /deptos)");
  if (!/cabeceras,/.test(cuerpo(codigo("src/app/i/[codigo]/page.tsx"), "eventoInvitacionVista({")) || !/cabeceras:\s*p\.cabeceras/.test(codigo("src/lib/invitacion-vista.ts"))) F("3 · /i no pasa las cabeceras a su vista");
  if (!/robot:\s*robotDeVisita\(headers\(\)\.get\("user-agent"\),\s*headers\(\)\)/.test(codigo("src/app/explorar/page.tsx"))) F("3 · /explorar no marca el robot en su vista");
  // ⚠ ACTA (28-oct-2026, Explorar como portal) · los cambios de filtros se aplican en el navegador, sin pedir nada: la API ya no
  // deja la vista (la deja el navegador, EXPLORAR-PORTAL §10). Tocar un pin es `tocarPin` (no hay mapa cerrado) y el aviso sin
  // saldo, con su «explorar_aviso», se retiró: sin saldo se explora todo.
  if (/capturarServidor|eventoExplorarVista/.test(codigo("src/app/api/explorar/route.ts"))) F("3 · la API del mapa volvió a dejar la vista (la deja el navegador)");
  if (EVENTOS_PORTAL.pin !== "explorar_pin") F("3 · los nombres de los eventos de Explorar cambiaron");
  const exc = codigo("src/app/explorar/explorar-cliente.tsx");
  const sel = cuerpo(exc, "function tocarPin(");
  if (!/posthog\?\.capture\(EVENTOS_PORTAL\.pin, \{ aviso_id: avisoId/.test(sel)) F("3 · tocar un pin no deja «explorar_pin»");
  if (!/onSeleccionar=\{tocarPin\}/.test(exc)) F("3 · el mapa no avisa que el toque fue en un pin");
  if (existsSync(join(RAIZ, "src/app/explorar/aviso-sin-saldo.tsx")) || /explorar_aviso/.test(exc)) F("3 · volvió el aviso sin saldo de Explorar");

  // ── 4 · las consultas que se colgaban (comportamiento) ──
  const llamadas: string[] = [];
  const falsa = (valor: string | null) => ({
    from: (t: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => { llamadas.push(`leer:${t}`); return { data: valor == null ? null : { value: valor }, error: null }; } }) }),
      upsert: async () => { llamadas.push(`guardar:${t}`); return { error: null }; },
    }),
    rpc: async (fn: string) => { llamadas.push(`rpc:${fn}`); return { data: [{ comuna: "Santiago", total: 100, comprar_20: 20 }], error: null }; },
  }) as unknown as SupabaseClient;
  const r1 = await resumenDeLaNoche(falsa(JSON.stringify({ revisados: 21000, convienen: 4800, calculadoAt: "2026-10-26T08:31:00Z" })));
  if (!r1 || r1.revisados !== 21000 || llamadas.some((l) => l.startsWith("rpc:"))) F(`4 · con el resumen guardado igual se cuenta toda la cobertura en la pantalla: ${llamadas.join(",")}`);
  llamadas.length = 0;
  const r2 = await resumenDeLaNoche(falsa(null));
  if (!r2 || !llamadas.includes("rpc:deptos_conteo") || !llamadas.includes("guardar:config")) F(`4 · sin resumen guardado no se calcula y guarda: ${llamadas.join(",")}`);
  if (resumenGuardado("{\"revisados\":0}") !== null || resumenGuardado("no-json") !== null) F("4 · un resumen guardado inválido se lee como bueno");
  if (CLAVE_RESUMEN_NOCHE !== "deptos_resumen_noche") F("4 · la clave del resumen cambió");
  if (!/guardarResumenDeLaNoche\(sb\)/.test(codigo("src/app/api/cron/evaluar-avisos/route.ts"))) F("4 · el cron de la evaluación no guarda el resumen de la noche");
  const planes = leer("supabase/migrations/20261026_inmediato_planes.sql");
  if (!/function public\.inmediato_candidatos\([\s\S]*?language plpgsql[\s\S]*?return query execute/.test(planes)) F("4 · inmediato_candidatos sigue con el plan genérico (sin plpgsql y EXECUTE)");

  // ── 4 · y se MIDEN contra la base real ──
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !llave) {
    F("4 · NO CORRIÓ la medición: faltan las variables de Supabase (el tier mide contra la base real)");
  } else {
    const admin = createClient(url, llave, { auth: { persistSession: false } });
    const medir = async <T>(f: () => Promise<T>) => { const t = Date.now(); const v = await f(); return { v, ms: Date.now() - t }; };
    const res = await medir(() => resumenDeLaNoche(admin));
    if (!res.v) F("4 · el resumen de la noche no se lee de la base");
    if (res.ms >= 2000) F(`4 · el resumen de la noche tarda ${res.ms} ms (el tope es 2 s)`);
    const nuevos = new Date(Date.now() - 48 * 3600_000).toISOString().replace("Z", "");
    const inm = await medir(async () => await admin.rpc("inmediato_candidatos", { comunas: ["Providencia", "Ñuñoa", "Las Condes", "Santiago"], dorms: [1, 2, 3], uf_min: 0, uf_max: 1e9, nuevos_desde: nuevos, max_filas: 200 }));
    if (inm.v.error) F(`4 · inmediato_candidatos falla: ${inm.v.error.message}`);
    if (inm.ms >= 2000) F(`4 · inmediato_candidatos tarda ${inm.ms} ms (el tope es 2 s)`);
    const inmStr = await medir(async () => await admin.rpc("inmediato_candidatos_str", { comunas: ["Providencia", "Ñuñoa"], dorms: [1, 2], uf_min: 0, uf_max: 5000, nuevos_desde: nuevos, por_celda: 20 }));
    if (inmStr.v.error) F(`4 · inmediato_candidatos_str falla: ${inmStr.v.error.message}`);
    if (inmStr.ms >= 2000) F(`4 · inmediato_candidatos_str tarda ${inmStr.ms} ms (el tope es 2 s)`);
    console.log(`  · medido: resumen ${res.ms} ms · inmediato_candidatos ${inm.ms} ms · inmediato_candidatos_str ${inmStr.ms} ms`);
    // 1 · toda cuenta interna, viva, está en test_accounts
    const { data: ta, error: eTa } = await admin.from("test_accounts").select("user_id");
    if (eTa) F(`1 · no se leyó test_accounts: ${eTa.message}`);
    const marcadas = new Set((ta ?? []).map((r) => r.user_id as string));
    const sueltas: string[] = [];
    for (let page = 1; page < 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) { F(`1 · no se leyeron las cuentas: ${error.message}`); break; }
      for (const u of data.users) {
        const c = (u.email ?? "").toLowerCase();
        if ((/^fabriziosciaraffia\+.*@gmail\.com$/.test(c) || c.endsWith("@refranco.ai")) && !marcadas.has(u.id)) sueltas.push(u.id.slice(0, 8));
      }
      if (data.users.length < 1000) break;
    }
    if (sueltas.length > 0) F(`1 · ${sueltas.length} cuenta(s) interna(s) fuera de test_accounts: ${sueltas.slice(0, 5).join(", ")}`);
  }

  if (fallas.length) {
    console.log(`  ✗ PAUTA-ARREGLOS · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — las cuentas de prueba y @refranco.ai no reciben correos (las alertas sí) y toda cuenta interna está marcada; el «Ya» de renta corta recibe su selección diaria, la primera con los nuevos de la semana; los escáneres salen marcados robot y Explorar mide el pin y el aviso; el resumen de la noche y la selección diaria responden bajo 2 s");
  }
  return { hard: fallas.length };
}

// ACTA DE MUTACIÓN (26-oct-2026, scratchpad mutar-pauta.cjs, cada una restaurada byte a byte): M1 enviarCorreo no corta ·
// M2 @refranco.ai pasa · M3 la cuenta de prueba pasa · M4 los buzones de Franco también se bloquean · M5 sin la renta corta
// en la selección diaria · M6 la primera con 48 h · M7 la fila sin modalidad · M8 la página no muestra la corta como bloque
// corto · M9 el reemplazo escribe items_str en avisos_inmediatos · M10 la corta pide los vistos de la semana · M11 sin
// reconocer escáneres por agente · M12 sin reconocer por comportamiento · M13 la vista no marca robot · M14 el middleware sin
// cabeceras · M15 /explorar sin robot · M16 sin explorar_pin · M17 explorar_pin solo con Explorar abierto · M18 sin
// explorar_aviso · M19 el resumen se cuenta en cada pantalla · M20 el cron no guarda el resumen · M21 explorar_vista sin
// robot. 21/21 ROJO. M14 salió VERDE en la primera pasada: el predicado buscaba `cabeceras: request.headers` desde la llamada
// a la vista hasta el final del archivo y lo encontraba en la del navegador (VECINDAD); se acotó a la llamada y quedó ROJO.

if (require.main === module) {
  runPautaArreglosTier().then((r) => process.exit(r.hard ? 1 : 0));
}
