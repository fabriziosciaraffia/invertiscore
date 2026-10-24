// ─────────────────────────────────────────────────────────────────────────────
// Tier SEMANAL-SIN-SILENCIO (13-oct-2026, 0 tokens) — que nadie reciba silencio por un error nuestro.
//
//   2 · LA PENDIENTE NO PIERDE LA SEMANA: el lunes de 08 a 11 UTC se vuelve a armar lo que el domingo quedó
//       pendiente (cron semanal-reintento, vigilado), y a las 12 sale lo confirmado aunque sea menos de tres.
//       El envío toma armadas, pendientes y sin coincidencias, con presupuesto y segunda corrida a las 12:30.
//   3 · SIN SELECCIÓN, UN CORREO IGUAL: sin ningún depto confirmado sale el correo corto —«Esta semana no apareció
//       ninguno que te convenga con tu pie y tu plazo. Seguimos buscando.»— con el enlace a su perfil (que pasa por
//       el clic y lleva a /dashboard#perfil), la baja, y sin precios, regalo ni botón de compra.
//   10 · LAS CUENTAS DE PRUEBA fuera de los envíos, salvo las marcadas (`recibe_correos`); y la baja se registra
//       en PostHog desde el servidor esperando el envío (con `void` se perdió una el 12-oct).
//   9 · Las aperturas de Resend llegan como `correo_abierto`; los clics de Resend no (los medimos nosotros).
// ACTA (13-oct-2026). 12/12 mutaciones en ROJO: S1 con menos de tres no sale · S2 el lunes solo salen las armadas · S3 el
// envío vuelve a exigir tres · S4 sin reintento del lunes · S5 el correo corto sin el perfil · S6 el clic no lleva al
// perfil · S7 la marca de prueba no cuenta · S8 el semanal se arma a las cuentas de prueba · S9 la baja vuelve a void ·
// S10 vuelven los clics de Resend · S11 la pendiente fallida pasa a armada · S12 el envío no mira las cuentas de prueba.
// Solo:  node --import tsx scripts/eval/golden/semanal-sin-silencio-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COMO_ENTRAR, HORAS_REINTENTO_LUNES, SEMANAL_VACIO, queEnviarSemanal } from "../../../src/lib/guia/semanal";
import { correoSemanal, correoSemanalVacio } from "../../../src/lib/email/correo-semanal";
import { correoBienvenida } from "../../../src/lib/email/correos";
import { ESTAS_DENTRO } from "../../../src/lib/lo-que-sigue/copy";
import { cuentasPruebaSinCorreo, personasSemanal, enlacesSemanal } from "../../../src/lib/guia/semanal-servidor";
import { CRONS_VIGILADOS } from "../../../src/lib/cron-heartbeat";
import { EVENTOS_RESEND } from "../../../src/lib/medicion-correo";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

type Filtros = Record<string, unknown>;
function supabaseDoble(responder: (tabla: string, f: Filtros) => unknown[]) {
  const sb = {
    from(tabla: string) {
      const f: Filtros = {};
      const b: Record<string, unknown> = {};
      const encadenar = (k: string) => (...a: unknown[]) => { f[k] = a.length === 1 ? a[0] : a; return b; };
      for (const m of ["select", "not", "order", "eq", "in", "is"]) b[m] = encadenar(m);
      b.range = (desde: number) => { f.desde = desde; return b; };
      b.then = (ok: (v: unknown) => unknown) => ok({ data: f.desde && Number(f.desde) > 0 ? [] : responder(tabla, f), error: null });
      return b;
    },
  };
  return sb as never;
}

export async function runSemanalSinSilencioTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER SEMANAL-SIN-SILENCIO (la pendiente, el correo corto y las cuentas de prueba · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 2 · la pendiente no pierde la semana ────────────────────────────────────
  if (queEnviarSemanal(1) !== "seleccion" || queEnviarSemanal(2) !== "seleccion" || queEnviarSemanal(5) !== "seleccion") F("2 · con uno o dos confirmados no sale la selección (se pierde la semana)");
  if (queEnviarSemanal(0) !== "vacio") F("2 · sin ningún depto no sale el correo corto");
  const srv = sinComentarios(leer("src/lib/guia/semanal-servidor.ts"));
  const enviar = srv.slice(srv.indexOf("export async function enviarSeleccion"), srv.indexOf("export async function enviarSinSeleccion"));
  // ⚠ ACTA (16-oct-2026, goal «la puerta B») · descarta sin mandar SOLO si esa semana ya salió su correo del día (que es
  // el semanal de esa semana) y no hay nuevos; sin él, el correo corto como siempre (PUERTA-B §4).
  // ⚠ ACTA (19-oct-2026, «lo ya visto no ocupa lugar») · la regla recibe además cuántos son NUEVOS: lo visto no cuenta como nuevo después del correo del día (SEMANAL §15).
  if (!/const que = queEnviarSemanal\(conLargo \|\| conCorto \? deptos\.length \+ deptosCortos\.length : 0, \{ delDiaReciente: delDia\.enviado, nuevos: conLargo \|\| conCorto \? nuevos : 0 \}\);\s*if \(que === "nada"\) return descartar\(\);\s*if \(que === "vacio"\) return enviarSinSeleccion\(admin, fila, sitio\);/.test(enviar) || /MINIMO_SEMANAL/.test(enviar) || queEnviarSemanal(0, { delDiaReciente: false }) !== "vacio")
    F("2 · el envío exige tres deptos o descarta sin mandar nada");
  if (!/update\(\{ estado: fila\.estado, enviada_at: null \}\)/.test(enviar)) F("2 · si Resend falla, la fila no vuelve a su estado (la pendiente pasaría a armada)");
  const rutaEnviar = sinComentarios(leer("src/app/api/cron/semanal-enviar/route.ts"));
  if (!/\.in\("estado", \["armada", "pendiente", "sin_match"\]\)\.is\("enviada_at", null\)/.test(rutaEnviar)) F("2 · el lunes solo se mandan las armadas (la pendiente y la sin coincidencias reciben silencio)");
  if (!/if \(Date\.now\(\) - t0 > PRESUPUESTO_ENVIO_MS\) \{ quedan\+\+; continue; \}/.test(rutaEnviar)) F("2 · el envío no tiene presupuesto (con 150 filas pasa del corte de 300 s)");
  const vj = JSON.parse(leer("vercel.json")) as { crons: Array<{ path: string; schedule: string }> };
  if (vj.crons.find((c) => c.path === "/api/cron/semanal-enviar")?.schedule !== "0,30 12 * * 1") F("2 · el envío no tiene la segunda corrida de las 12:30 para lo que no alcanzó");
  if (vj.crons.find((c) => c.path === "/api/cron/semanal-reintento")?.schedule !== `5 ${HORAS_REINTENTO_LUNES[0]}-${HORAS_REINTENTO_LUNES[HORAS_REINTENTO_LUNES.length - 1]} * * 1`) F("2 · no hay reintento de las pendientes el lunes antes del envío");
  if (!CRONS_VIGILADOS.some((c) => c.nombre === "semanal-reintento")) F("2 · el reintento del lunes no está vigilado");
  const reintento = sinComentarios(leer("src/app/api/cron/semanal-reintento/route.ts"));
  if (!/\.eq\("estado", "pendiente"\)\.is\("enviada_at", null\)/.test(reintento) || !/await armarSeleccion\(admin, userId, semana, cfg, presupuesto\)/.test(reintento) || !/await latirCron\(admin, "semanal-reintento"\)/.test(reintento)) F("2 · el reintento no vuelve a armar las pendientes de la semana");

  // ── 3 · sin selección, un correo igual ──────────────────────────────────────
  const enl = enlacesSemanal("https://refranco.ai", "abc123");
  const vacio = correoSemanalVacio({ nombre: "Ana", presentacion: false, urlPerfil: enl.perfil, urlBaja: enl.baja });
  if (!vacio.html.includes("Esta semana no apareció ninguno que te convenga con tu pie y tu plazo. Seguimos buscando.")) F("3 · el correo corto no dice la frase aprobada");
  if (!vacio.html.includes(`href="${enl.perfil}"`) || enl.perfil !== "https://refranco.ai/api/semanal/clic?t=abc123&ir=perfil") F("3 · el correo corto no lleva al perfil (pasando por el clic)");
  if (!vacio.html.includes(`href="${enl.baja}"`)) F("3 · el correo corto no tiene la baja");
  if (/UF \d|\$\d|va por cuenta de Franco|Analizar uno/.test(vacio.html)) F("3 · el correo corto trae precios, regalo o botón de compra");
  if (vacio.subject !== SEMANAL_VACIO.asunto) F("3 · el asunto del correo corto no es el aprobado");
  const primero = correoSemanalVacio({ nombre: null, presentacion: true, urlPerfil: enl.perfil, urlBaja: enl.baja });
  if (!primero.html.includes(COMO_ENTRAR)) F("3 · el primer correo (corto) no dice cómo se entra");
  const clic = sinComentarios(leer("src/app/api/semanal/clic/route.ts"));
  if (!/if \(ir === "perfil"\) return volver\("\/dashboard#perfil"\);/.test(clic)) F("3 · el enlace al perfil no lleva a /dashboard#perfil");
  // ⚠ ACTA (24-oct-2026, goal «Puerta B, parte 2», mockup 3b-dashboard.html) · el perfil es una fila plegada (<details id="perfil">) que el ancla abre (AbrirPorAncla).
  if (!/<FilaPlegada id="perfil"/.test(leer("src/app/dashboard/casa.tsx")) || !/<details id=\{id\} className="ca-plegada"/.test(leer("src/app/dashboard/casa.tsx")) || !/<AbrirPorAncla \/>/.test(leer("src/app/dashboard/page.tsx"))) F("3 · el perfil del dashboard no tiene el ancla #perfil");
  const sin = srv.slice(srv.indexOf("export async function enviarSinSeleccion"), srv.indexOf("export async function combinacionSemanal"));
  if (!/pb\?\.semanal_baja_at\) return descartarSeleccion\(admin, fila\.id\);/.test(sin) || !/\.is\("enviada_at", null\)\.select\("id"\);\s*if \(\(tomada\?\.length \?\? 0\) !== 1\) return "ya";/.test(sin)) F("3 · el correo corto se manda a quien se dio de baja o sin tomar la fila (podría salir dos veces)");

  // ── 10 · cuentas de prueba y la baja en PostHog ─────────────────────────────
  const doble = supabaseDoble((tabla) => {
    if (tabla === "test_accounts") return [{ user_id: "prueba", recibe_correos: false }, { user_id: "prueba-marcada", recibe_correos: true }, { user_id: "prueba-sin-columna" }];
    if (tabla === "perfiles_inversion") return [{ user_id: "real" }, { user_id: "prueba" }];
    if (tabla === "analisis") return [{ user_id: "prueba-marcada" }, { user_id: "prueba-sin-columna" }, { user_id: "otra-real" }];
    return [];
  });
  const fuera = await cuentasPruebaSinCorreo(doble);
  if (!fuera.has("prueba") || !fuera.has("prueba-sin-columna") || fuera.has("prueba-marcada")) F("10 · las cuentas de prueba no quedan fuera (o la marcada queda fuera)");
  const personas = (await personasSemanal(doble)).map((p) => p.userId).sort();
  if (personas.join() !== ["otra-real", "prueba-marcada", "real"].join()) F(`10 · el semanal se le arma a una cuenta de prueba sin marcar (${personas.join(", ")})`);
  if (!/cuenta\[fuera\.has\(fila\.user_id\) \? await descartarSeleccion\(admin, fila\.id\) : await enviarSeleccion\(admin, fila, SITIO\)\]\+\+;/.test(rutaEnviar)) F("10 · el envío del lunes le manda a una cuenta de prueba ya armada");
  for (const r of ["src/app/api/semanal/baja/route.ts", "src/app/api/inmediato/baja/route.ts", "src/app/api/semanal/clic/route.ts"]) {
    const s = sinComentarios(leer(r));
    if (/void capturarServidor/.test(s) || !/await capturarServidor\(\{/.test(s)) F(`10 · ${r} no espera el envío del evento a PostHog (la función responde antes y se pierde)`);
  }

  // ── 8 · cómo entrar ─────────────────────────────────────────────────────────
  if (COMO_ENTRAR !== "Para entrar: tu correo y un código. Sin contraseña.") F("8 · la frase de cómo entrar no es la aprobada");
  if (!correoBienvenida({ nombre: "Ana" }).html.includes(COMO_ENTRAR)) F("8 · la bienvenida no dice cómo se entra");
  if (ESTAS_DENTRO.comoEntrar !== COMO_ENTRAR || !/\{ESTAS_DENTRO\.comoEntrar\}/.test(leer("src/components/lo-que-sigue/EstasDentro.tsx"))) F("8 · «Estás dentro» no dice cómo se entra");
  const conDeptos = correoSemanal({ variante: "tarjetas", nombre: "Ana", busca: "1 dormitorio", piePct: 20, plazoAnios: 25, deptos: [], saldo: 1, conRegalo: false, presentacion: true, urlBoton: "u", urlTres: "c", urlBaja: "b" });
  if (!conDeptos.html.includes(COMO_ENTRAR)) F("8 · el primer semanal no dice cómo se entra");

  // ── 9 · aperturas sí, clics de Resend no ────────────────────────────────────
  if (EVENTOS_RESEND["email.opened"] !== "correo_abierto" || "email.clicked" in EVENTOS_RESEND) F("9 · las aperturas no llegan como correo_abierto, o los clics de Resend se siguen midiendo");

  if (fallas.length) {
    console.log(`  ✗ SEMANAL-SIN-SILENCIO · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — la pendiente se reintenta el lunes y sale con lo confirmado; sin deptos sale el correo corto con el perfil; las cuentas de prueba sin marcar no reciben nada; la baja y el clic esperan su evento; las aperturas se miden y los clics de Resend no");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runSemanalSinSilencioTier().then((r) => process.exit(r.hard ? 1 : 0));
}
