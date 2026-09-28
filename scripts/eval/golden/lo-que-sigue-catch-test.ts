// ============================================================================
// GOLDEN · LO-QUE-SIGUE (28-sep-2026) — catch-test
// ============================================================================
//   Las dos ofertas después del veredicto del PRIMER informe anónimo (mockup v3 aprobado, variante
//   con franja):
//   1 · NADA DE ESTO APARECE CON SESIÓN: banner, barra, ticket y cierre se montan solo con
//       `isAnonOwner && !isLoggedIn` (LTR) / `isAnonOwner && !userId && !demo` (STR).
//   2 · EL PACK VENCE: 24 h desde created_at, lo valida payments/create (410) y lo dice el ticket.
//   3 · EL PERFIL QUEDA LIGADO AL REGISTRARSE: se guarda al crear (LTR y STR) y el claim lo liga.
//   4 · EL TICKET NO VUELVE DESPUÉS DE LA DESPEDIDA: estado por análisis, «despedida» es terminal.
//   5 · EL COPY EN TUTEO: sin voseo en copy.ts.
//   Más: sale «Guardarlo» del header y «Crear cuenta para guardarlo» del cierre; el pack es
//   producto real ($5.000, 3 créditos sin caducidad, pack_pagado desde el servidor); los eventos.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/lo-que-sigue-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { diaVencimiento, horaVencimiento, ofertaPackVigente, PACK_ANALISIS, PACK_PRECIO_CLP, PACK_UNITARIO_CLP, venceEl, VENTANA_PACK_MS } from "../../../src/lib/lo-que-sigue/oferta-pack";
import { debeSubirTicket, leerEstadoTicket, marcarTicket } from "../../../src/lib/lo-que-sigue/estado-ticket";
import { perfilDesdeLtr, perfilDesdeStr, tipologiaDe } from "../../../src/lib/lo-que-sigue/perfil";
import { CHECKOUT_PACK, CIERRE_REGISTRO, FRASE_PACK, FRASE_REGISTRO, OFERTA_REGISTRO, REGISTRO_UN_PASO, TICKET_PACK } from "../../../src/lib/lo-que-sigue/copy";
import { EVENTOS_LQS } from "../../../src/lib/lo-que-sigue/eventos";
import { FLOW_PRODUCTS } from "../../../src/lib/flow-products";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");

/** Voseo: las formas que se cuelan («dejás», «tenés», «mirá», «tomá», «vos», «tu informe guardalo»). */
const VOSEO = /(^|[^a-záéíóúñ])(dejás|tenés|querés|podés|sabés|mirá|tomá|entrá|seguí|registrate|guardá|revisá|vos)(?![a-záéíóúñ])/i;

export function runLoQueSigueTier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER LO-QUE-SIGUE (las dos ofertas del primer informe anónimo, 0 tokens) ───");

  // ── 1 · NADA CON SESIÓN ────────────────────────────────────────────────────
  const ltr = sinComentarios(leer("src/app/analisis/[id]/results-client.tsx"));
  if (!/const loQueSigue = isAnonOwner && !isLoggedIn && !!analysisId;/.test(ltr)) F("1 · el gate LTR no es «dueño anónimo sin sesión»");
  if (!/despuesDeLaCard=\{loQueSigue \? <BannerRegistro ctx=\{ctxLqs\} next=\{nextLqs\} \/> : undefined\}/.test(ltr)) F("1 · el banner LTR no cuelga del gate");
  if (!/\{loQueSigue \? \(\s*<>\s*<TicketPack ctx=\{ctxLqs\} createdAt=\{createdAt\} \/>\s*<CierreRegistro veredicto=\{resolvedVeredicto\} next=\{nextLqs\} \/>\s*<\/>\s*\) : \(\s*<NextAnalysisCTA \{\.\.\.nextCtaProps\} \/>\s*\)\}/.test(ltr)) F("1 · el ticket y el cierre LTR no cuelgan del gate (o desplazaron el CTA de siempre)");
  const str = sinComentarios(leer("src/app/analisis/renta-corta/[id]/results-client.tsx"));
  if (!/const loQueSigue = isAnonOwner && !userId && !demo;/.test(str)) F("1 · el gate STR no es «dueño anónimo sin sesión, fuera del demo»");
  if (!/despuesDeLaCard=\{loQueSigue \? <BannerRegistro ctx=\{ctxLqs\} next=\{nextLqs\} \/> : undefined\}/.test(str)) F("1 · el banner STR no cuelga del gate");
  if (!/\{loQueSigue \? \(\s*<>\s*<TicketPack ctx=\{ctxLqs\} createdAt=\{createdAt\} \/>\s*<CierreRegistro veredicto=\{veredicto\} next=\{nextLqs\} \/>\s*<\/>\s*\) : \(\s*<NextAnalysisCTA \{\.\.\.nextCtaProps\} \/>\s*\)\}/.test(str)) F("1 · el ticket y el cierre STR no cuelgan del gate");
  for (const [f, que] of [["src/components/analysis/HeroLTR.tsx", "HeroLTR"], ["src/components/analysis/str/HeroStrDictamen.tsx", "HeroStrDictamen"]] as const) {
    const s = sinComentarios(leer(f));
    if (!/\{recomendacion\}\s*<\/SeccionInforme>\s*\{despuesDeLaCard\}/.test(s)) F(`1 · ${que} no ubica «lo que sigue» justo después de la card de Franco`);
  }
  if (!/despuesDeLaCard=\{despuesDeLaCard\}/.test(sinComentarios(leer("src/components/analysis/SubjectCardGrid.tsx")))) F("1 · el grid no pasa el hueco al hero");
  const header = sinComentarios(leer("src/components/chrome/HeaderFranco.tsx"));
  if (/Guardarlo/.test(header)) F("1 · vuelve «Guardarlo» al header");
  const cta = sinComentarios(leer("src/components/analysis/NextAnalysisCTA.tsx"));
  if (/guardarlo/i.test(cta)) F("1 · vuelve «Crear cuenta para guardarlo» al cierre");

  // ── 2 · EL PACK VENCE ──────────────────────────────────────────────────────
  const t0 = new Date("2026-09-28T21:04:00Z");
  if (VENTANA_PACK_MS !== 24 * 60 * 60 * 1000) F("2 · la ventana del pack no es de 24 horas");
  if (!ofertaPackVigente(t0, new Date(t0.getTime() + VENTANA_PACK_MS - 1))) F("2 · un segundo antes de las 24 h ya no vale");
  if (ofertaPackVigente(t0, new Date(t0.getTime() + VENTANA_PACK_MS))) F("2 · a las 24 h exactas sigue valiendo: no vence de verdad");
  if (ofertaPackVigente("no es fecha")) F("2 · una fecha inválida vale como vigente");
  if (venceEl(t0).toISOString() !== "2026-09-29T21:04:00.000Z") F("2 · venceEl no suma 24 h");
  if (horaVencimiento(t0) !== "18:04") F(`2 · la hora no se dice en hora de Chile (${horaVencimiento(t0)})`);
  if (diaVencimiento(t0, new Date("2026-09-29T12:00:00Z")) !== "hoy" || diaVencimiento(t0, new Date("2026-09-28T12:00:00Z")) !== "mañana") F("2 · «hoy»/«mañana» no salen del reloj de Chile");
  if (FLOW_PRODUCTS.pack3.amount !== PACK_PRECIO_CLP || PACK_PRECIO_CLP !== 5000 || PACK_ANALISIS !== 3 || PACK_UNITARIO_CLP !== 1667 || FLOW_PRODUCTS.pack3.kind !== "one_time") F("2 · el pack no es 3 análisis por $5.000 en el catálogo de Flow");
  const create = sinComentarios(leer("src/app/api/payments/create/route.ts"));
  if (!/if \(product === PRODUCTO_PACK && !analysisId\)/.test(create)) F("2 · payments/create acepta el pack sin informe");
  if (!/if \(!ofertaPackVigente\(analysis\.created_at as string\)\) \{[\s\S]*?eventoPackVencido\([\s\S]*?status: 410/.test(create)) F("2 · payments/create no rechaza el pack vencido con 410 ni lo mide");
  if (/pack3: \{ amount: 9990/.test(create)) F("2 · vuelve el pack3 legacy de $9.990");
  const confirm = sinComentarios(leer("src/app/api/payments/confirm/route.ts"));
  if (!/product === PRODUCTO_PACK\) \{[\s\S]*?grantCredits\(userId, PRODUCTO_PACK, PACK_ANALISIS, \{ paymentId, noExpire: true \}\)/.test(confirm)) F("2 · payments/confirm no otorga los 3 créditos sin caducidad");
  if (!/capturarServidor\(eventoPackPagado\(/.test(confirm)) F("2 · pack_pagado no sale del servidor al confirmar");
  const ticket = sinComentarios(leer("src/components/lo-que-sigue/TicketPack.tsx"));
  if (!/if \(!ofertaPackVigente\(createdAt\)\) \{[\s\S]*?EVENTOS_LQS\.packVencido[\s\S]*?marcarTicket\(almacen, ctx\.analysisId, "despedida"\);\s*return;/.test(ticket)) F("2 · el ticket sube aunque el pack haya vencido (o no mide pack_vencido)");
  const checkout = sinComentarios(leer("src/app/checkout/page.tsx"));
  if (!/\/api\/lo-que-sigue\/oferta\?analysisId=/.test(checkout) || !/disabled=\{loading \|\| packVencido\}/.test(checkout) || !/res\.status === 410 \? CHECKOUT_PACK\.vencido/.test(checkout)) F("2 · el checkout no pregunta la vigencia al servidor, no bloquea el pago vencido o no explica el 410");

  // ── 3 · EL PERFIL ──────────────────────────────────────────────────────────
  const p = perfilDesdeLtr({ precio: "4000", piePct: 20, comuna: "Providencia", dormitorios: 2, banos: 2 }, "AJUSTA SUPUESTOS", { analysisId: "a", userId: null, anonClaimTokenHash: "h" });
  if (p.presupuestoUf !== 4000 || p.piePct !== 20 || p.tipologia !== "2D2B" || p.modalidad !== "ltr" || p.veredicto !== "AJUSTA SUPUESTOS" || p.anonClaimTokenHash !== "h") F("3 · perfilDesdeLtr no arma presupuesto, pie, tipología, modalidad y veredicto");
  const q = perfilDesdeStr({ precioCompraUF: 3200, piePct: "10", comuna: "Ñuñoa", dormitorios: 0, banos: 1 }, "COMPRAR", { analysisId: "b", userId: "u", anonClaimTokenHash: null });
  if (q.presupuestoUf !== 3200 || q.piePct !== 10 || q.tipologia !== "Studio1B" || q.modalidad !== "str" || q.userId !== "u") F("3 · perfilDesdeStr no arma el perfil STR");
  if (tipologiaDe(undefined, undefined) !== null || tipologiaDe("x", 1) !== "1B") F("3 · tipologiaDe no tolera datos ausentes");
  const rutaLtr = sinComentarios(leer("src/app/api/analisis/route.ts"));
  if (!/filaCreada = true;[\s\S]{0,200}guardarPerfil\(createAnonPipelineClient\(\), perfilDesdeLtr\(body, readVeredicto\(result\) \?\? null, \{\s*analysisId: data\.id as string,\s*userId: user\?\.id \?\? null,/.test(rutaLtr)) F("3 · POST /api/analisis no guarda el perfil al crear");
  const rutaStr = sinComentarios(leer("src/app/api/analisis/short-term/route.ts"));
  if (!/guardarPerfil\(createAnonPipelineClient\(\), perfilDesdeStr\(body,/.test(rutaStr)) F("3 · POST /api/analisis/short-term no guarda el perfil al crear");
  const claim = sinComentarios(leer("src/lib/anon-claim.ts"));
  if (!/if \(!filas \|\| filas\.length === 0\) return \{ claimed: 0, redirect: null \};\s*await ligarPerfiles\(admin, user\.id, filas\.map\(\(f\) => f\.id as string\)\);/.test(claim)) F("3 · el claim no liga los perfiles a la persona al registrarse");
  const perfilLib = sinComentarios(leer("src/lib/lo-que-sigue/perfil.ts"));
  if (!/\.update\(\{ user_id: userId, anon_claim_token_hash: null, linked_at: new Date\(\)\.toISOString\(\) \}\)\s*\.in\("analysis_id", analysisIds\)\s*\.is\("user_id", null\)/.test(perfilLib)) F("3 · ligarPerfiles no es idempotente (pisa perfiles ya ligados) o no limpia el hash");
  if (!/create table if not exists public\.perfiles_inversion/.test(leer("supabase/migrations/20260928_perfiles_inversion.sql"))) F("3 · falta la migración de perfiles_inversion");

  // ── 4 · EL TICKET NO VUELVE ────────────────────────────────────────────────
  {
    const mapa = new Map<string, string>();
    const almacen = { getItem: (k: string) => mapa.get(k) ?? null, setItem: (k: string, v: string) => { mapa.set(k, v); } };
    if (!debeSubirTicket(leerEstadoTicket(almacen, "x"))) F("4 · un informe nuevo no sube el ticket");
    marcarTicket(almacen, "x", "visto");
    if (debeSubirTicket(leerEstadoTicket(almacen, "x"))) F("4 · el ticket vuelve a subir después de haberse visto");
    marcarTicket(almacen, "x", "despedida");
    if (leerEstadoTicket(almacen, "x") !== "despedida" || debeSubirTicket(leerEstadoTicket(almacen, "x"))) F("4 · el ticket vuelve después de la despedida");
    if (!debeSubirTicket(leerEstadoTicket(almacen, "otro"))) F("4 · el estado de un informe contamina a otro");
    if (!debeSubirTicket(leerEstadoTicket(null, "x"))) F("4 · sin storage el ticket no sube nunca");
  }
  if (!/if \(!debeSubirTicket\(leerEstadoTicket\(almacen, ctx\.analysisId\)\)\) return;/.test(ticket)) F("4 · el ticket no consulta su estado antes de subir");
  if (!/function despedirse\(\) \{\s*if \(cara === "despedida"\) return;\s*setCara\("despedida"\);\s*capturarLqs\(posthog, EVENTOS_LQS\.despedidaVista/.test(ticket)) F("4 · cerrar o «Seguir leyendo» no cambian a la despedida en el mismo lugar");
  if (!/function cerrarDelTodo\(\) \{\s*marcarTicket\([^)]*, ctx\.analysisId, "despedida"\);\s*setAbierto\(false\);\s*cerrarTicket\(\);/.test(ticket)) F("4 · «Sí, seguir leyendo» no cierra ni deja el ticket como terminal");
  if (!/className="lqs-x" onClick=\{despedirse\}/.test(ticket) || !/className="lqs-seguir" onClick=\{despedirse\}/.test(ticket)) F("4 · la X o «Seguir leyendo» cierran de golpe en vez de despedirse");
  if ((ticket.match(/role=\{abierto \? "dialog" : undefined\}/g) ?? []).length !== 1) F("4 · el ticket no es UN solo diálogo");
  const banner = sinComentarios(leer("src/components/lo-que-sigue/BannerRegistro.tsx"));
  if (!/data-visible=\{atras && !ticketAbierto \? "1" : "0"\}/.test(banner)) F("4 · la barra fija no se recoge mientras el ticket está arriba (o no espera a que el banner quede atrás)");
  const css = leer("src/components/lo-que-sigue/lo-que-sigue.css");
  if (!/\.lqs-barra\[data-visible="1"\] \{ transform: translateY\(0\)/.test(css) || !/\.lqs-velo\[data-abierto="1"\] \.lqs-hoja \{ transform: translateY\(0\)/.test(css) || !/\.lqs-franja/.test(css)) F("4 · la coreografía (barra ↔ hoja por el mismo borde) o la franja no están en el CSS");
  if (!/\.lqs-banner \{ margin: 0 calc\(50% - 50vw\)/.test(css)) F("4 · el banner no va de borde a borde");

  // ── 5 · EL COPY EN TUTEO ───────────────────────────────────────────────────
  const textos: string[] = [
    ...Object.values(FRASE_REGISTRO), ...Object.values(FRASE_PACK), ...Object.values(CIERRE_REGISTRO),
    ...Object.values(OFERTA_REGISTRO), ...Object.values(REGISTRO_UN_PASO).map((v) => (typeof v === "function" ? v("x@y.cl") : v)),
    TICKET_PACK.ojo, TICKET_PACK.precioNota, TICKET_PACK.ahorro("a", "b"), TICKET_PACK.vence("hoy", "21:04"), TICKET_PACK.boton("$5.000"), TICKET_PACK.seguir, TICKET_PACK.despedida("21:04"), TICKET_PACK.comprar, TICKET_PACK.siSeguir,
    CHECKOUT_PACK.titulo, CHECKOUT_PACK.subtitulo, CHECKOUT_PACK.vence("hoy", "21:04"), CHECKOUT_PACK.vencido,
  ];
  for (const t of textos) {
    if (VOSEO.test(t)) F(`5 · voseo en el copy: «${t}»`);
    if (/\bdesde\b/i.test(t)) F(`5 · «desde» en el copy: «${t}»`);
    if (/guard[aá]/i.test(t)) F(`5 · «guarda tu informe» en el copy: «${t}»`);
  }
  if (TICKET_PACK.despedida("21:04") !== "Vence a las 21:04 y no vuelve. ¿La dejas pasar?") F("5 · la despedida no es la frase aprobada, en tuteo");
  if (!/\\u00bf|¿La dejas pasar\?/.test(leer("src/lib/lo-que-sigue/copy.ts"))) F("5 · la despedida no está en copy.ts");

  // ── eventos: los ocho, y del lado del cliente con veredicto y modalidad ────
  const esperados = ["banner_visto", "registro_iniciado", "registro_completado", "ticket_visto", "despedida_vista", "pack_iniciado", "pack_pagado", "pack_vencido"];
  const tenemos = Object.values(EVENTOS_LQS);
  for (const e of esperados) if (!tenemos.includes(e as never)) F(`eventos · falta ${e}`);
  const eventos = sinComentarios(leer("src/lib/lo-que-sigue/eventos.ts"));
  if (!/oferta: "lo_que_sigue",\s*analysis_id: ctx\.analysisId,\s*veredicto: ctx\.veredicto,\s*modalidad: ctx\.modalidad,/.test(eventos)) F("eventos · capturarLqs no lleva análisis, veredicto y modalidad");
  const reg = sinComentarios(leer("src/components/lo-que-sigue/RegistroUnPaso.tsx"));
  if (!/signInWithOtp\(\{\s*email: c,\s*options: \{ emailRedirectTo: callback\(\), shouldCreateUser: true \}/.test(reg)) F("registro · el correo no manda el enlace sin contraseña (signInWithOtp)");
  if (!/EVENTOS_LQS\.registroIniciado, ctx, \{ via: "correo" \}/.test(reg) || !/EVENTOS_LQS\.registroIniciado, ctx, \{ via: "google" \}/.test(reg)) F("registro · registro_iniciado no lleva la vía");
  if (!/consumirRegistroPendiente\(\);\s*if \(m\) capturarLqs\(posthog, EVENTOS_LQS\.registroCompletado, m\.ctx, \{ via: m\.via \}\)/.test(reg)) F("registro · registro_completado no sale al volver con su vía");

  if (fallas.length) {
    console.log(`  ✗ LO-QUE-SIGUE · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 40)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — nada con sesión; el pack vence a las 24 h y lo rechaza el servidor; el perfil se guarda al crear y se liga al registrarse; el ticket no vuelve después de la despedida; el copy en tuteo; los ocho eventos con su vía, veredicto y modalidad");
  }
  return { hard: fallas.length };
}

// ── ACTA DE MUTACIONES (28-sep-2026, 24/24 en rojo, restauradas byte a byte) ────────────────
// M1 banner LTR con sesión · M2 banner STR con sesión · M3 ticket LTR sin gate · M4 vuelve «Guardarlo»
// al header · M5 vuelve «Crear cuenta para guardarlo» · M6 ventana de 48 h · M7 vence con <= · M8
// payments/create no rechaza el vencido · M9 el pack a $9.990 · M10 créditos que caducan · M11 el
// ticket sube vencido · M12 /api/analisis sin perfil · M13 el claim no liga · M14 ligarPerfiles pisa
// ligados · M15 el ticket vuelve tras la despedida · M16 la X cierra de golpe · M17 «Sí, seguir
// leyendo» no deja terminal · M18 la barra no se recoge · M19 voseo en la despedida · M20 «guarda tu
// informe» · M21 registro_iniciado sin vía · M22 correo con contraseña · M23 banner sin borde a
// borde · M24 falta pack_vencido.

if (require.main === module) {
  const { hard } = runLoQueSigueTier();
  process.exit(hard ? 1 : 0);
}
