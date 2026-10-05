// ============================================================================
// GOLDEN · INMEDIATO (05-oct-2026) — catch-test
// ============================================================================
//   El aviso inmediato a quien respondió «Ya» (decisiones de Fabrizio):
//   1 · CUÁNDO: un aviso NUEVO (entró en 48 horas) que da Comprar con su perfil —comunas, tipología,
//       precio, pie y plazo— y sigue publicado; el cron corre después de la evaluación. Solo Comprar.
//   2 · SIN SATURAR: un correo por día por persona (varios van juntos); la fila se toma antes de mandar;
//       lo avisado no se vuelve a avisar ni se repite en el semanal.
//   3 · EL CORREO: «Apareció un depto que conviene con lo que buscas», en la plantilla del semanal, con el
//       depto, su veredicto y su flujo, «Analizar uno · $9.990» sin análisis, y su PROPIA baja que no toca
//       el semanal.
//   4 · EL «YA» VENCE: a los 60 días sin compra se pregunta «¿Cuándo piensas comprar?» con un clic; sin
//       respuesta, solo el semanal; «Ya» vuelve a correr el plazo.
//   5 · LOS EVENTOS: enviado, abierto, clic y compra que vino del aviso.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. Sin red y sin base.
// Solo:  node --import tsx scripts/eval/golden/inmediato-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DIAS_VENCE_YA, INMEDIATO, RUTA_SUELTO_INMEDIATO, TOPE_INMEDIATO, VENTANA_NUEVOS_HORAS, diaDelAviso, elegirInmediato, estadoYa,
} from "../../../src/lib/guia/inmediato";
import { correoInmediato, correoPreguntaYa } from "../../../src/lib/email/correo-inmediato";
import { COLOR_VEREDICTO } from "../../../src/lib/email/correo-semanal";
import { ROJO } from "../../../src/lib/email/plantilla-clara";
import { ESTAS_DENTRO } from "../../../src/lib/lo-que-sigue/copy";
import { TIPOS_CORREO, eventoInmediatoAbierto } from "../../../src/lib/medicion-correo";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const VOSEO = /(^|[^a-záéíóúñ])(dejás|tenés|querés|podés|sabés|mirá|tomá|entrá|seguí|registrate|guardá|revisá|poné|compará|elegí|tocá|pedí|escribí|analizá|empezá|respondé|vos)(?![a-záéíóúñ])/i;

export async function runInmediatoTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER INMEDIATO (el aviso a quien piensa comprar ya · 0 tokens) ───");
  const srv = sinComentarios(leer("src/lib/guia/inmediato-servidor.ts"));
  const sem = sinComentarios(leer("src/lib/guia/semanal-servidor.ts"));
  const mig = leer("supabase/migrations/20261005_aviso_inmediato.sql");
  const vj = leer("vercel.json");

  // ── 1 · cuándo ──
  {
    type C = { avisoId: string; scoreCron: number | null };
    const cs: C[] = ["n1", "n2", "n3", "n4", "n5"].map((id, i) => ({ avisoId: id, scoreCron: 50 - i }));
    const tabla: Record<string, [string, number]> = { n1: ["AJUSTA SUPUESTOS", 99], n2: ["COMPRAR", 70], n3: ["COMPRAR", 88], n4: ["BUSCAR OTRA", 95], n5: ["COMPRAR", 80] };
    const ev = async (c: C) => ({ veredicto: tabla[c.avisoId][0], score: tabla[c.avisoId][1], flujo: -1000 });
    const pedidos: string[] = [];
    const r = await elegirInmediato(cs, new Set(["n5"]), ev, async (c) => { pedidos.push(c.avisoId); return c.avisoId === "n2" ? "despublicado" : "publicado"; });
    if (r.map((x) => x.c.avisoId).join() !== "n3") F(`1 · el aviso no son solo los Comprar nuevos, publicados y no avisados (${r.map((x) => x.c.avisoId).join()})`);
    if (pedidos.join() !== "n3,n2") F(`1 · la ficha no se chequea por puntaje, solo para los Comprar (${pedidos.join()})`);
    const uno = await elegirInmediato([cs[2]], new Set(), ev, async () => "publicado");
    if (uno.length !== 1) F("1 · con un solo Comprar publicado no hay aviso");
    const sinCupo = await elegirInmediato([cs[2]], new Set(), ev, async () => "sin-chequeo");
    if (sinCupo.length !== 0) F("1 · un depto sin chequear entra al aviso");
    if (VENTANA_NUEVOS_HORAS !== 48 || !/const nuevosDesde = new Date\(ahora\.getTime\(\) - VENTANA_NUEVOS_HORAS \* 3600_000\)/.test(srv) || !/await prepararSeleccion\(admin, userId, cfg, \{ nuevosDesde \}\)/.test(srv)) F("1 · el aviso no prepara con los avisos nuevos de las 48 horas");
    if (!/and sp\.created_at >= nuevos_desde/.test(mig) || !/create or replace function public\.inmediato_candidatos\(/.test(mig) || !/revoke execute on function public\.inmediato_candidatos[^;]*from public, anon, authenticated;/.test(mig)) F("1 · la consulta no filtra los avisos nuevos (o queda abierta al cliente)");
    if (!/opts\.nuevosDesde\s*\? await admin\.rpc\("inmediato_candidatos", \{\s*comunas, dorms: perfil\.dormitorios, uf_min: rango\.ufMin, uf_max: rango\.ufMax, nuevos_desde: opts\.nuevosDesde/.test(sem)) F("1 · la preparación no usa la consulta de los avisos nuevos con su perfil");
    if (!/elegirInmediato\(candidatos, await avisadosAlMomento\(admin, userId\), evaluar, publicadoConPresupuesto\(admin, presupuesto\)\)/.test(srv)) F("1 · el aviso no elige con su evaluación y el chequeo de la ficha");
    const cron = vj.match(/"path": "\/api\/cron\/aviso-inmediato",\s*"schedule": "(\d+) (\d+) \* \* \*"/);
    const ev2 = vj.match(/"path": "\/api\/cron\/evaluar-avisos[^"]*",\s*"schedule": "(\d+) ([\d,]+) \* \* \*"/);
    const ultimaEval = ev2 ? Math.max(...ev2[2].split(",").map(Number)) * 60 + Number(ev2[1]) : NaN;
    if (!cron || !(Number(cron[2]) * 60 + Number(cron[1]) > ultimaEval)) F(`1 · el aviso no corre cada día después de la evaluación de avisos (${cron?.[0] ?? "sin cron"} · ${ev2?.[0] ?? "sin evaluación"})`);
  }

  // ── 2 · sin saturar ──
  {
    if (diaDelAviso(new Date("2026-10-06T02:30:00Z")) !== "2026-10-05" || diaDelAviso(new Date("2026-10-06T09:40:00Z")) !== "2026-10-06") F("2 · el día del aviso no es el de Chile");
    if (!/unique \(user_id, dia\)/.test(mig) || !/revoke all on public\.avisos_inmediatos from anon, authenticated;/.test(mig)) F("2 · se puede mandar dos avisos el mismo día (o la tabla queda abierta)");
    if (!/if \(hoy\?\.enviado_at\) return "ya";/.test(srv)) F("2 · no se mira si ya salió el aviso del día");
    const iTomar = srv.search(/await admin\.from\("avisos_inmediatos"\)\.insert\(fila\)/), iMandar = srv.indexOf("await sendInmediatoEmail(");
    if (iTomar < 0 || iMandar < 0 || iTomar > iMandar || !/\.update\(fila\)\.eq\("id", hoy\.id\)\.is\("enviado_at", null\)/.test(srv)) F("2 · el aviso se manda sin tomar la fila del día antes");
    if (!/if \(!r\.ok\) \{\s*await admin\.from\("avisos_inmediatos"\)\.update\(\{ enviado_at: null \}\)\.eq\("id", tomada\.id\);/.test(srv)) F("2 · si Resend falla, la fila del día no se suelta");
    if (TOPE_INMEDIATO < 2) F("2 · varios deptos del día no van juntos");
    if (!/const avisados = opts\.nuevosDesde \? new Set<string>\(\) : await avisadosAlMomento\(admin, userId\);/.test(sem) || !/\.map\(candidatoDeFila\)\.filter\(\(c\) => !avisados\.has\(c\.avisoId\)\)/.test(sem)) F("2 · lo avisado se repite en el semanal");
    if (!/\.from\("avisos_inmediatos"\)\.select\("aviso_ids"\)\.eq\("user_id", userId\)\.not\("enviado_at", "is", null\)\.gte\("dia", desde\)/.test(sem)) F("2 · lo avisado no se lee de los avisos enviados");
  }

  // ── 3 · el correo ──
  {
    const depto = (i: number) => ({ comuna: "Huechuraba", tipologia: "2D2B", m2: 62, precioUF: 3890 + i, veredicto: "COMPRAR", score: 76, flujo: -51000, url: `https://x/clic?a=${i}` });
    const base = { nombre: "Camila", busca: "2 dormitorios, Huechuraba, hasta UF 4.200", piePct: 20, plazoAnios: 30, deptos: [depto(1)], saldo: 0, urlBoton: "https://x/sel", urlComprar: "https://x/comprar", urlBaja: "https://x/baja-aviso" };
    const sinSaldo = correoInmediato(base), conSaldo = correoInmediato({ ...base, saldo: 2 }), dos = correoInmediato({ ...base, deptos: [depto(1), depto(2)] });
    if (sinSaldo.subject !== "Apareció un depto que conviene con lo que buscas" || INMEDIATO.asunto !== sinSaldo.subject) F(`3 · el asunto no es el aprobado («${sinSaldo.subject}»)`);
    const h = sinSaldo.html;
    if (!h.includes("font-size: 28px; line-height: 1.1; font-weight: 700;") || !h.includes(">UF 3.891</a>")) F("3 · el depto no va en la tarjeta del semanal con el precio grande");
    if (!h.includes(`color: ${COLOR_VEREDICTO.COMPRAR};">Comprar`)) F("3 · el veredicto no va en su color");
    if (!h.includes(`color: ${ROJO};">−$51.000`)) F("3 · el flujo no va (o no va en rojo cuando es negativo)");
    if (!h.includes(`<a href="https://x/comprar" style="display: inline-block; padding: 15px 30px;`) || !h.includes(">Analizar uno · $9.990</a>")) F("3 · sin análisis el botón no es «Analizar uno · $9.990» a la compra");
    if (!conSaldo.html.includes(">Analizar uno</a>") || conSaldo.html.includes("$9.990</a>")) F("3 · con análisis el botón no es «Analizar uno»");
    if (!h.includes(`<a href="https://x/baja-aviso" style="color: `) || !h.includes(`>${INMEDIATO.baja}</a>`) || !h.includes(INMEDIATO.bajaSigue)) F("3 · el aviso no trae su propia baja (o no dice que el semanal sigue)");
    if (!dos.html.includes("Aparecieron 2 deptos que convienen con lo que buscas") || (dos.html.match(/font-size: 28px; line-height: 1\.1/g) ?? []).length !== 2) F("3 · dos deptos del día no van juntos en un correo");
    if (/oportunidad|portafolio|exclusiv/i.test(h + dos.html)) F("3 · aparece una palabra vedada");
    for (const t of [INMEDIATO.intro(1, base.busca, "20", 30), INMEDIATO.porQue, INMEDIATO.bajaLista, INMEDIATO.bajaVolver]) if (VOSEO.test(t)) F(`3 · voseo: «${t}»`);
    if (!/"List-Unsubscribe": `<\$\{urlBaja\}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"[\s\S]{0,40}\}\);\s*if \(res\.error\) \{ console\.error\("\[aviso_inmediato\]/.test(leer("src/lib/email.ts"))) F("3 · el aviso no lleva List-Unsubscribe de un clic");
    const baja = sinComentarios(leer("src/app/api/inmediato/baja/route.ts"));
    if (!/inmediato_baja_at: new Date\(\)\.toISOString\(\)/.test(baja) || /semanal_baja_at/.test(baja) || !/export async function POST/.test(baja)) F("3 · la baja de los avisos no es propia (toca el semanal o no es de un clic)");
    if (estadoYa({ horizonte: "ya", yaDesde: new Date(), ultimaCompra: null, preguntaAt: null, bajaAt: new Date() }) !== "no") F("3 · con la baja de los avisos igual le corren");
    if (!/semanalBajaAt && !opts\.nuevosDesde\) return \{ tipo: "baja" \}/.test(sem)) F("3 · la baja del semanal corta también los avisos");
  }

  // ── 4 · el «Ya» vence ──
  {
    const ahora = new Date("2026-12-10T12:00:00Z");
    const hace = (d: number) => new Date(ahora.getTime() - d * 864e5);
    const e = (o: Partial<Parameters<typeof estadoYa>[0]>) => estadoYa({ horizonte: "ya", yaDesde: hace(10), ultimaCompra: null, preguntaAt: null, bajaAt: null, ahora, ...o });
    if (DIAS_VENCE_YA !== 60) F("4 · el «Ya» no vence a los 60 días");
    if (e({ yaDesde: hace(59.9) }) !== "vigente" || e({ yaDesde: hace(60) }) !== "preguntar") F("4 · la pregunta no llega a los 60 días");
    if (e({ yaDesde: hace(90), ultimaCompra: hace(20) }) !== "vigente") F("4 · una compra no vuelve a correr el plazo");
    if (e({ yaDesde: hace(70), preguntaAt: hace(5) }) !== "vencido") F("4 · sin respuesta a la pregunta le siguen llegando avisos");
    if (e({ yaDesde: hace(1), preguntaAt: hace(5) }) !== "vigente") F("4 · responder «Ya» no vuelve a activar los avisos");
    if (e({ horizonte: "meses" }) !== "no" || e({ yaDesde: null }) !== "no") F("4 · le corren avisos a quien no dijo «Ya»");
    const p = correoPreguntaYa({ nombre: null, urlRespuesta: (h) => `https://x/h?t=abc&h=${h}` });
    if (p.subject !== "¿Cuándo piensas comprar?") F("4 · la pregunta no es «¿Cuándo piensas comprar?»");
    const textos = INMEDIATO.pregunta.opciones.map((o) => `${o.id}:${o.texto}`).join("|");
    if (textos !== ESTAS_DENTRO.horizontes.map((o) => `${o.id}:${o.texto}`).join("|")) F(`4 · las respuestas no son las de «Estás dentro» (${textos})`);
    for (const o of INMEDIATO.pregunta.opciones) if (!p.html.includes(`<a href="https://x/h?t=abc&h=${o.id}"`) || !p.html.includes(`>${o.texto}</a>`)) F(`4 · falta la respuesta de un clic «${o.texto}»`);
    if (p.html.includes(`bgcolor="${ROJO}"`)) F("4 · la pregunta empuja una respuesta (una en rojo)");
    const hz = sinComentarios(leer("src/app/api/inmediato/horizonte/route.ts"));
    if (!/\.update\(\{ horizonte_compra: h, actualizado_at: new Date\(\)\.toISOString\(\), ya_pregunta_token: null \}\)\s*\.eq\("ya_pregunta_token", t\)/.test(hz)) F("4 · responder no anota la respuesta (o el token sirve más de una vez)");
    if (!/if \(estado === "preguntar" && yaDesde\) return preguntar\(admin, userId, yaDesde, sitio\);/.test(srv) || !/if \(estado !== "vigente"\) return "no";/.test(srv)) F("4 · el envío no pregunta a los 60 días (o avisa sin «Ya» vigente)");
    const iMarca = srv.indexOf('.or(`ya_pregunta_at.is.null,ya_pregunta_at.lt.${yaDesde.toISOString()}`)'), iMandarP = srv.indexOf("await sendPreguntaYaEmail(");
    if (iMarca < 0 || iMandarP < 0 || iMarca > iMandarP) F("4 · la pregunta se manda sin marcarla antes (dos corridas la mandan dos veces)");
    const pbs = sinComentarios(leer("src/lib/perfil-busqueda-servidor.ts"));
    if (!/const horizonteDesde = manual\.horizonte\s*\? \(\(m\?\.actualizado_at as string \| null\) \?\? null\)\s*: conHorizonte \? \(\(conHorizonte\.pref_actualizado_at as string \| null\) \?\? \(conHorizonte\.created_at as string\)\) : null;/.test(pbs)) F("4 · no se sabe desde cuándo dijo «Ya»");
    for (const t of [INMEDIATO.pregunta.cuerpo, INMEDIATO.pregunta.sinRespuesta, INMEDIATO.pregunta.graciasYa, INMEDIATO.pregunta.graciasOtro]) if (VOSEO.test(t)) F(`4 · voseo: «${t}»`);
  }

  // ── 5 · los eventos ──
  {
    if (!/event: "aviso_inmediato_enviado"/.test(srv)) F("5 · falta aviso_inmediato_enviado");
    if (!TIPOS_CORREO.includes("aviso_inmediato")) F("5 · el aviso no viaja con su tipo a Resend");
    const ab = eventoInmediatoAbierto({ event: "correo_abierto", distinctId: "u", uuid: "x", properties: { tipo: "aviso_inmediato" } });
    if (ab?.event !== "aviso_inmediato_abierto" || ab.uuid === "x" || eventoInmediatoAbierto({ event: "correo_abierto", distinctId: "u", properties: { tipo: "semanal" } }) !== null || eventoInmediatoAbierto({ event: "correo_clic", distinctId: "u", properties: { tipo: "aviso_inmediato" } }) !== null) F("5 · la apertura del aviso no da aviso_inmediato_abierto (o lo da de más)");
    if (!/const inmediato = eventoInmediatoAbierto\(evento\);\s*if \(inmediato\) await capturarServidor\(inmediato\);/.test(sinComentarios(leer("src/app/api/webhooks/resend/route.ts")))) F("5 · el webhook no emite aviso_inmediato_abierto");
    const clic = sinComentarios(leer("src/app/api/semanal/clic/route.ts"));
    if (!/if \(sel\.fuente === "inmediato"\) \{\s*void capturarServidor\(\{ event: "aviso_inmediato_clic"/.test(clic)) F("5 · falta aviso_inmediato_clic");
    if (!/if \(ir === "comprar" && sel\.fuente === "inmediato"\) return volver\(RUTA_SUELTO_INMEDIATO\);/.test(clic) || RUTA_SUELTO_INMEDIATO !== "/checkout?product=single&origen=inmediato") F("5 · «Analizar uno · $9.990» del aviso no compra el suelto marcado como del aviso");
    if (!/searchParams\.get\("origen"\) === "inmediato" \? "inmediato"/.test(leer("src/app/checkout/page.tsx"))) F("5 · el checkout no lleva el origen del aviso");
    if (!/\.\.\.\(origenBody === "inmediato" \? \{ origen: "inmediato" \} : \{\}\)/.test(sinComentarios(leer("src/app/api/payments/create/route.ts")))) F("5 · el pago no guarda que vino del aviso");
    const conf = sinComentarios(leer("src/app/api/payments/confirm/route.ts"));
    if (!/\.\.\.\(prePaymentData\?\.origen === "inmediato" \? \{ origen: "inmediato" \} : \{\}\)/.test(conf) || !/if \(deCorreo\?\.origen === "inmediato"\) \{\s*await capturarServidor\(\{ event: "aviso_inmediato_compra"/.test(conf)) F("5 · la compra que vino del aviso no se mide (o el confirm pierde el origen)");
    if (!/inmediato \? RUTA_SUELTO_INMEDIATO : rutaSueltoSemanal\(variante\)/.test(leer("src/app/semanal/semanal-lista.tsx"))) F("5 · la compra desde la página del aviso no va marcada como del aviso");
    // La página del aviso también está viva (05-oct-2026): el caído se dice y trae el siguiente, guardado en su tabla.
    if (!/await seleccionViva\(admin, \{ tabla: sel\.fuente === "inmediato" \? "avisos_inmediatos" : "semanal_selecciones", id: sel\.id,/.test(sinComentarios(leer("src/app/semanal/page.tsx"))) || !/seleccionViva\(\s*admin: SupabaseClient,\s*sel: \{ tabla: "semanal_selecciones" \| "avisos_inmediatos";/.test(sem)) F("3 · la página del aviso no está viva (o guarda el reemplazo en otra tabla)");
  }

  if (fallas.length === 0) console.log("  ✓ VERDE — solo Comprar nuevos y publicados con su perfil, después de la evaluación; un correo por día que se toma antes de mandar; lo avisado no se repite; la plantilla del semanal con su propia baja; el «Ya» pregunta a los 60 días; enviado, abierto, clic y compra medidos");
  for (const f of fallas) console.log(`  ✗ INMEDIATO · ${f}`);
  return { hard: fallas.length };
}

if (require.main === module) {
  runInmediatoTier().then(({ hard }) => process.exit(hard > 0 ? 1 : 0));
}

// ─── ACTA · verificado EN ROJO por mutación ──────────────────────────────────
// 05-oct-2026: 22/22 ROJO, cada archivo restaurado byte a byte.
//   §1 I1 entra Ajustar · I2 entra sin ficha chequeada · I3 se repite lo avisado · I4 sin la ventana de nuevos · I5 la consulta
//      sin el filtro de nuevos · I6 el cron antes de la evaluación
//   §2 I7 el día en UTC · I8 dos avisos el mismo día · I9 manda sin tomar la fila · I10 el semanal repite lo avisado
//   §3 I11 otro asunto · I12 sin el botón al suelto · I13 la baja del aviso toca el semanal · I14 sin la baja propia
//   §4 I15 vence a los 90 · I16 la compra no corre el plazo · I17 sin respuesta siguen los avisos · I18 la pregunta empuja
//      el «Ya» · I19 la respuesta no se anota · I20 la pregunta sin marcar antes
//   §5 I21 sin abierto del aviso · I22 la compra del aviso sin medir
//   Después, con la página viva (05-oct-2026): I23 la página del aviso guarda el reemplazo en la tabla del semanal → ROJO (§3).
