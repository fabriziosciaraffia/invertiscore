// ============================================================================
// GOLDEN · LA MEDICIÓN (28-sep-2026) — catch-test
// ============================================================================
//   Auditoría de la medición: después del wizard nuevo, el header, la landing v14 y el retiro de la
//   IA quedaron eventos muertos, duplicados y huecos. Lo que se decidió, y este tier vigila:
//   1 · `landing_direccion_elegida` en el hero, antes de navegar.
//   2 · `informe_visto` único: absorbe a `analysis_viewed` (retirado, con `francoOverridesEngine`).
//   3 · `pago_confirmado` desde el servidor en payments/confirm, junto al CAPI Purchase, con el mismo
//       id (`commerce_order`) y uuid determinista; `capturarServidor` manda al endpoint de captura.
//   4 · `correo_enviado` por tipo desde email.ts (todo envío pasa por `enviarCorreo`, con tags), y el
//       webhook de Resend con la firma Svix verificada antes de leer nada.
//   5 · `entrada` registrada como súper propiedad de sesión al montar el wizard.
//   6 · SIN `dir` FANTASMA: con una llegada pendiente ni `wizard4_step_viewed` ni la telemetría de
//       paso miran el nodo inicial.
//   7 · registro y login, email o Google, salen de `emitirAuthCompletada`.
//   8 · `INICIO_WIZARD` sin el `dir` de la landing.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
//   Acta 28-sep-2026: A vuelve analysis_viewed → 1 falla · B el pago no se manda → 3 · C la firma siempre
//   pasa → 3 · D step_viewed sin esperar la llegada → 1 · E el hook de pasos sin esperar → 1 · F INICIO_WIZARD
//   con dir → 1 · G un correo fuera de enviarCorreo → 2 · H el hero sin evento → 1 · I registro fuera del
//   helper → 2. Restaurado: verde.
// Solo:  node --import tsx scripts/eval/golden/medicion-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { capturarServidor, distinctIdDeCorreo, uuidDeterminista } from "../../../src/lib/posthog-servidor";
import { eventoPagoConfirmado } from "../../../src/lib/medicion-pago";
import { EVENTOS_RESEND, TIPOS_CORREO, eventoCorreoEnviado, eventoDeResend, identidadCorreo, tagsCorreo, valorTag } from "../../../src/lib/medicion-correo";
import { firmarSvix, verificarFirmaSvix } from "../../../src/lib/resend-webhook";
import { registrarInformeVisto } from "../../../src/lib/informe-visto";
import { emitirAuthCompletada } from "../../../src/lib/auth-analytics";
import { EV } from "../../../src/components/landing-v14/eventos";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");

/** Un PostHog falso que anota lo que se le pide. */
function posthogFalso() {
  const llamadas: Array<{ metodo: string; args: unknown[] }> = [];
  const ph = new Proxy({}, { get: (_t, prop) => (...args: unknown[]) => { llamadas.push({ metodo: String(prop), args }); } });
  return { ph: ph as never, llamadas };
}

export async function runMedicionTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER MEDICIÓN (eventos, 0 tokens) ───");

  // ── 1 · LA DIRECCIÓN ELEGIDA EN EL HERO ────────────────────────────────────
  if (EV.direccionElegida !== "landing_direccion_elegida") F("1 · falta EV.direccionElegida");
  const entrada = sinComentarios(leer("src/components/landing-v14/Entrada.tsx"));
  if (!/onDireccion: \(sel: SeleccionDireccion\) => \{\s*\n\s*posthog\?\.capture\(EV\.direccionElegida, \{ ubicacion, via: sel\.via, precision: sel\.precision, cubierta: sel\.cubierta \}\);\s*\n\s*setNavegando\("escribir"\);/.test(entrada)) F("1 · elegir una dirección en el hero no emite landing_direccion_elegida antes de navegar");

  // ── 2 · INFORME_VISTO ÚNICO ────────────────────────────────────────────────
  const conViejo = execSync("git grep -l -E \"analysis_viewed|francoOverridesEngine\" -- src", { cwd: RAIZ, encoding: "utf8" }).split("\n").filter(Boolean)
    .filter((f) => /analysis_viewed|francoOverridesEngine/.test(sinComentarios(leer(f))));
  if (conViejo.length) F(`2 · analysis_viewed / francoOverridesEngine siguen en el código: ${conViejo.join(", ")}`);
  {
    const { ph, llamadas } = posthogFalso();
    registrarInformeVisto({ posthog: ph, ids: ["a1"], modalidad: "ltr", esperaMs: 120, esOwner: true, comuna: "Ñuñoa", score: 59, veredicto: "AJUSTA SUPUESTOS", accessLevel: "premium", esCompartido: false });
    const cap = llamadas.find((l) => l.metodo === "capture");
    const props = (cap?.args[1] ?? {}) as Record<string, unknown>;
    if (cap?.args[0] !== "informe_visto") F("2 · registrarInformeVisto no emite informe_visto");
    if (props.comuna !== "Ñuñoa" || props.score !== 59 || props.veredicto !== "AJUSTA SUPUESTOS" || props.access_level !== "premium" || props.es_compartido !== false) F(`2 · informe_visto no absorbió lo de analysis_viewed (${JSON.stringify(props)})`);
    const ltr = sinComentarios(leer("src/app/analisis/[id]/results-client.tsx"));
    if (!/registrarInformeVisto\(\{[\s\S]*?comuna,\s*\n\s*score,\s*\n\s*veredicto: readVeredicto\(results\),\s*\n\s*accessLevel,\s*\n\s*esCompartido: isSharedView \|\| isSharedLink,/.test(ltr)) F("2 · el informe LTR no le pasa comuna, score, veredicto y acceso a informe_visto");
  }

  // ── 3 · PAGO_CONFIRMADO DESDE EL SERVIDOR ──────────────────────────────────
  {
    const ev = eventoPagoConfirmado({ commerceOrder: "FR-123", userId: "u-1", product: "single", amount: 9990, analysisId: "an-1" });
    const ev2 = eventoPagoConfirmado({ commerceOrder: "FR-123", userId: "u-1", product: "single", amount: 9990, analysisId: "an-1" });
    if (ev.event !== "pago_confirmado" || ev.distinctId !== "u-1") F("3 · eventoPagoConfirmado no arma el evento con el user id");
    if (!ev.uuid || ev.uuid !== ev2.uuid || !/^[0-9a-f-]{36}$/.test(ev.uuid)) F("3 · el uuid del pago no es determinista (un reintento de Flow lo duplicaría)");
    if (ev.uuid === eventoPagoConfirmado({ commerceOrder: "FR-124", userId: "u-1", product: "single", amount: 9990 }).uuid) F("3 · dos pagos distintos comparten uuid");
    if (ev.properties?.event_id !== "FR-123" || ev.properties?.commerce_order !== "FR-123" || ev.properties?.monto !== 9990) F("3 · el evento del pago no lleva el mismo id que el Purchase de Meta");
    // el cliente del servidor: POST al endpoint de captura, con api_key, uuid y $lib
    const pedidos: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetchFalso = (async (url: string, init: { body: string }) => { pedidos.push({ url, body: JSON.parse(init.body) }); return { ok: true } as Response; }) as unknown as typeof fetch;
    const ok = await capturarServidor(ev, { fetch: fetchFalso, key: "phc_test", host: "https://ph.test" });
    const b = pedidos[0]?.body ?? {};
    if (!ok || pedidos[0]?.url !== "https://ph.test/capture/" || b.api_key !== "phc_test" || b.event !== "pago_confirmado" || b.distinct_id !== "u-1" || b.uuid !== ev.uuid || (b.properties as Record<string, unknown>)?.$lib !== "franco-servidor") F(`3 · capturarServidor no manda el evento como corresponde (${JSON.stringify(pedidos[0])})`);
    if (await capturarServidor(ev, { fetch: fetchFalso, key: "" }) !== false) F("3 · sin key, capturarServidor tendría que devolver false sin pedir nada");
    const confirm = sinComentarios(leer("src/app/api/payments/confirm/route.ts"));
    const bloque = (confirm.match(/if \(userId\) \{\s*\n\s*try \{\s*\n\s*const \{ data: capiUser \}[\s\S]*?await capturarServidor\(eventoPagoConfirmado\(\{[\s\S]*?\}\)\);/) ?? [])[0] ?? "";
    if (!bloque) F("3 · payments/confirm no emite pago_confirmado en el mismo bloque que el Purchase de Meta");
    if (!/eventId: payment\.commerce_order,/.test(bloque) || !/commerceOrder: payment\.commerce_order,/.test(bloque)) F("3 · el Purchase de Meta y pago_confirmado no llevan el mismo commerce_order");
    if (!/userId,\s*\n\s*product: payment\.product,\s*\n\s*amount: payment\.amount,/.test(bloque)) F("3 · pago_confirmado no lleva usuario, producto y monto del pago confirmado");
  }

  // ── 4 · CORREOS: ENVIADOS Y ABIERTOS ───────────────────────────────────────
  {
    const email = sinComentarios(leer("src/lib/email.ts"));
    const cuerpoEnviar = (email.match(/async function enviarCorreo\([\s\S]*?\n\}/) ?? [])[0] ?? "";
    if (!cuerpoEnviar) F("4 · no encuentro enviarCorreo en email.ts");
    const sueltos = (email.replace(cuerpoEnviar, "").match(/emails\.send\(/g) ?? []).length;
    if (sueltos) F(`4 · quedan ${sueltos} envío(s) que no pasan por enviarCorreo (sin tags ni correo_enviado)`);
    if (!/tags: \[\.\.\.\(mensaje\.tags \?\? \[\]\), \.\.\.tagsCorreo\(tipo, distinctId\)\]/.test(cuerpoEnviar) || !/if \(!res\.error\) \{\s*\n\s*void capturarServidor\(eventoCorreoEnviado\(\{ tipo, distinctId, resendId: res\.data\?\.id \?\? null \}\)\)/.test(cuerpoEnviar)) F("4 · enviarCorreo no manda los tags ni emite correo_enviado al salir");
    for (const t of TIPOS_CORREO) if (!new RegExp(`enviarCorreo\\("${t}", `).test(email)) F(`4 · ningún correo sale con el tipo «${t}»`);
    const tags = tagsCorreo("informe_listo", "u-1");
    if (tags[0]?.name !== "tipo" || tags[0]?.value !== "informe_listo" || tags[1]?.name !== "pid" || tags[1]?.value !== "u-1") F("4 · tagsCorreo no arma tipo + pid");
    if (valorTag("a@b.cl") !== "a_b_cl") F("4 · valorTag deja caracteres que Resend rechaza");
    if (identidadCorreo("x@y.cl", "u-9") !== "u-9" || identidadCorreo("x@y.cl", null) !== distinctIdDeCorreo("x@y.cl") || /@/.test(distinctIdDeCorreo("x@y.cl"))) F("4 · la identidad del correo no cae al user id o deja el correo en claro");
    const enviado = eventoCorreoEnviado({ tipo: "bienvenida", distinctId: "u-1", resendId: "re_1" });
    if (enviado.event !== "correo_enviado" || enviado.properties?.tipo !== "bienvenida" || enviado.uuid !== uuidDeterminista("correo_enviado:re_1")) F("4 · correo_enviado no lleva el tipo ni un uuid por envío");
    // la firma Svix
    const secreto = "whsec_" + Buffer.from("clave-de-prueba-suficientemente-larga").toString("base64");
    const cuerpo = JSON.stringify({ type: "email.opened", created_at: "2026-09-28T20:00:00.000Z", data: { email_id: "re_1", to: ["x@y.cl"], subject: "Hola", tags: { tipo: "informe_listo", pid: "u-1" } } });
    const ts = String(1_790_600_000);
    const firma = firmarSvix("msg_1", ts, cuerpo, secreto);
    const base = { svixId: "msg_1", svixTimestamp: ts, svixSignature: `v1,${firma}`, cuerpo, secreto, ahoraSeg: 1_790_600_010 };
    if (!verificarFirmaSvix(base)) F("4 · una firma válida se rechaza");
    if (verificarFirmaSvix({ ...base, cuerpo: cuerpo + " " })) F("4 · un cuerpo alterado pasa la firma");
    if (verificarFirmaSvix({ ...base, svixSignature: "v1," + firma.replace(/.$/, (c) => (c === "A" ? "B" : "A")) })) F("4 · una firma alterada pasa");
    if (verificarFirmaSvix({ ...base, ahoraSeg: 1_790_600_000 + 6 * 60 })) F("4 · una firma de hace más de cinco minutos pasa");
    if (verificarFirmaSvix({ ...base, secreto: undefined })) F("4 · sin secreto la firma pasa");
    if (!verificarFirmaSvix({ ...base, svixSignature: `v1,otra ${`v1,${firma}`}` })) F("4 · varias firmas separadas por espacio no se aceptan");
    const ev = eventoDeResend(JSON.parse(cuerpo), "msg_1");
    if (ev?.event !== "correo_abierto" || ev.distinctId !== "u-1" || ev.properties?.tipo !== "informe_listo" || ev.uuid !== uuidDeterminista("resend:msg_1") || ev.timestamp !== "2026-09-28T20:00:00.000Z") F(`4 · eventoDeResend no mapea la apertura con la persona del tag (${JSON.stringify(ev)})`);
    const clic = eventoDeResend({ type: "email.clicked", data: { email_id: "re_1", to: "x@y.cl", tags: [{ name: "tipo", value: "boleta" }], click: { link: "https://refranco.ai/a" } } }, "msg_2");
    if (clic?.event !== "correo_clic" || clic.properties?.link !== "https://refranco.ai/a" || clic.distinctId !== distinctIdDeCorreo("x@y.cl") || clic.properties?.tipo !== "boleta") F("4 · el clic no lleva el link ni cae a la identidad derivada del correo sin pid");
    if (eventoDeResend({ type: "email.sent", data: { to: "x@y.cl" } }, "m") !== null) F("4 · un evento de Resend que no se mide igual se manda");
    for (const [tipo, nombre] of Object.entries(EVENTOS_RESEND)) if (!/^correo_[a-z]+$/.test(nombre) || !/^email\./.test(tipo)) F(`4 · el mapa de eventos de Resend tiene un nombre raro: ${tipo} → ${nombre}`);
    const ruta = sinComentarios(leer("src/app/api/webhooks/resend/route.ts"));
    if (!/const secreto = process\.env\.RESEND_WEBHOOK_SECRET;\s*\n\s*if \(!secreto\) return NextResponse\.json\([^)]*\{ status: 503 \}\);/.test(ruta)) F("4 · el webhook acepta cargas sin secreto configurado");
    if (!/const cuerpo = await req\.text\(\);[\s\S]*?verificarFirmaSvix\(\{[\s\S]*?\}\);\s*\n\s*if \(!valida \|\| !svixId\) return NextResponse\.json\([^)]*\{ status: 401 \}\);[\s\S]*?JSON\.parse\(cuerpo\)/.test(ruta)) F("4 · el webhook no verifica la firma sobre el cuerpo crudo antes de leer la carga");
    if (!/capturarServidor\(evento\)/.test(ruta)) F("4 · el webhook no manda el evento a PostHog");
    if (!/RESEND_WEBHOOK_SECRET=/.test(leer(".env.example"))) F("4 · .env.example no documenta RESEND_WEBHOOK_SECRET");
  }

  // ── 5 · LA ENTRADA COMO SÚPER PROPIEDAD ────────────────────────────────────
  const wizard = sinComentarios(leer("src/components/formulario-v4/WizardV4.tsx"));
  if (!/posthog\?\.register_for_session\(\{ entrada \}\);/.test(wizard)) F("5 · el wizard no registra `entrada` como súper propiedad de sesión");

  // ── 6 · SIN DIR FANTASMA ───────────────────────────────────────────────────
  if (!/const \[llegadaLista, setLlegadaLista\] = useState\(!hayLlegada\);/.test(wizard)) F("6 · el wizard no distingue una llegada pendiente");
  if (!/llegadaAplicada\.current = true;\s*\n\s*setLlegadaLista\(true\);\s*\n\s*if \(direccionInicial\) \{/.test(wizard)) F("6 · aplicar la llegada no libera la medición");
  if (!/const retomarBorrador = \(\) => \{ llegadaAplicada\.current = true; setLlegadaLista\(true\); w\.resumeDraft\(\); \};/.test(wizard)) F("6 · retomar el borrador no libera la medición");
  const efectoStep = (wizard.match(/const lastStep = useRef<NodeId \| null>\(null\);\s*\n\s*useEffect\(\(\) => \{([\s\S]*?)\}, \[nav\.current, posthog, llegadaLista\]\);/) ?? [])[1] ?? "";
  if (!efectoStep || !/^\s*if \(!llegadaLista\) return;/.test(efectoStep)) F("6 · wizard4_step_viewed se emite con una llegada pendiente: vuelve el dir fantasma");
  if (!/extra: \{ entrada \},\s*\n\s*activo: llegadaLista,\s*\n\s*\}\);/.test(wizard)) F("6 · la telemetría de paso no espera a la llegada");
  const tele = sinComentarios(leer("src/components/formulario-v4/stepTelemetry.ts"));
  if (!/useEffect\(\(\) => \{\s*\n\s*if \(!activo\) return;\s*\n\s*const prev = pasoRef\.current;/.test(tele) || !/\}, \[node, emitir, activo\]\);/.test(tele)) F("6 · el hook de pasos arranca el paso inicial aunque la llegada esté pendiente (step_left + dir_tipeo fantasmas)");

  // ── 7 · AUTH DESDE UN SOLO LUGAR ───────────────────────────────────────────
  {
    const { ph, llamadas } = posthogFalso();
    emitirAuthCompletada(ph, "signup", "google");
    emitirAuthCompletada(ph, "login", "email");
    const nombres = llamadas.map((l) => `${l.args[0]}:${(l.args[1] as { method: string }).method}`);
    if (nombres.join(",") !== "signup_completed:google,login_completed:email") F(`7 · emitirAuthCompletada no emite los dos eventos con su método (${nombres.join(",")})`);
    const literales = execSync("git grep -l -E \"(signup|login)_completed\" -- src", { cwd: RAIZ, encoding: "utf8" }).split("\n").filter(Boolean)
      .filter((f) => f !== "src/lib/auth-analytics.ts" && /capture\([^)]*(signup|login)_completed/.test(sinComentarios(leer(f))));
    if (literales.length) F(`7 · registro o login se emiten fuera de emitirAuthCompletada: ${literales.join(", ")}`);
    for (const f of ["src/app/register/page.tsx", "src/app/login/page.tsx", "src/hooks/useAttributionSync.ts"]) if (!/emitirAuthCompletada\(/.test(sinComentarios(leer(f)))) F(`7 · ${f} no usa emitirAuthCompletada`);
  }

  // ── 8 · INICIO_WIZARD SIN EL DIR DE LA LANDING ─────────────────────────────
  const admin = sinComentarios(leer("src/lib/posthog-admin.ts"));
  if (!/const INICIO_WIZARD = "\(properties\.node = 'dirMapa' OR \(properties\.node = 'dir' AND coalesce\(properties\.entrada, ''\) != 'landing'\)\)";/.test(admin)) F("8 · INICIO_WIZARD vuelve a contar el dir de la landing");

  if (fallas.length) {
    console.log(`  ✗ MEDICIÓN · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el hero mide la dirección elegida; informe_visto es uno solo; el pago se mide desde el servidor con el id de Meta; los correos salen con tags y se miden al salir y al abrirse con la firma verificada; la entrada viaja en toda la sesión; sin dir fantasma; auth desde un solo lugar; INICIO_WIZARD sin el dir de la landing");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runMedicionTier().then(({ hard }) => process.exit(hard ? 1 : 0));
}
