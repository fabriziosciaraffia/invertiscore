// ============================================================================
// GOLDEN · LO-QUE-SIGUE (28-sep-2026) — catch-test
// ============================================================================
//   Las dos ofertas después del veredicto del PRIMER informe anónimo (mockup v3 aprobado, variante
//   con franja):
//   1 · NADA DE ESTO APARECE CON SESIÓN: banner, barra, ticket y cierre se montan solo con
//       `isAnonOwner && !isLoggedIn` (LTR) / `isAnonOwner && !userId && !demo` (STR).
//   2 · EL PACK VENCE: 24 h desde created_at, lo valida payments/create (410) y lo dice el ticket.
//   3 · EL PERFIL QUEDA LIGADO AL REGISTRARSE: se guarda al crear (LTR y STR) y el claim lo liga.
//   4 · EL TICKET NO VUELVE SOLO después de la despedida (estado por análisis, terminal para el
//       auto-subir), pero se puede volver desde la pestaña mientras la oferta viva. Abajo va UNA
//       sola cosa según la zona (`queVaAbajo`): barra fuera del cierre; ticket o pestaña en el
//       cierre. Todo anclado al área visible real (iOS).
//   5 · EL COPY EN TUTEO: sin voseo en copy.ts (todo: banner, barra, «Estás dentro», ticket,
//       despedida, pestaña, después de pagar, comparar y el correo).
//   Segunda entrega (30-sep-2026):
//   6 · EL PRECIO DEL TICKET SALE DEL MOTOR: `precioQueCierraUF` lee la palanca precio del hallazgo
//       de distancia (vías, palancas o el delta mínimo); los dos informes lo cablean y el ticket lo
//       usa en la primera línea. Sin precio, la frase va sin cifra: nunca se inventa.
//   7 · EL WIZARD PRECARGADO NO PISA EL DEPTO: la precarga solo escribe lo de la persona, solo donde
//       no hay respuesta; el grafo salta el financiamiento solo si vino completo.
//   9 · LA MODALIDAD VUELVE CON EL PAGO (m=l|s) y post_pago_visto la registra de ahí.
//  10 · EL CARRITO ABANDONADO NO ESCRIBE POR EL PACK (vence y no vuelve).
//   8 · EL CORREO SALE UNA VEZ: `debeRecordar` y el reclamo con la condición en el WHERE antes de
//       enviar.
//   Más: sale «Guardarlo» del header y «Crear cuenta para guardarlo» del cierre; el pack es
//   producto real ($14.990 por 3 —$5.000 cada uno—, 3 créditos sin caducidad, pack_pagado desde el
//   servidor); los eventos.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/lo-que-sigue-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { diaVencimiento, horaVencimiento, leerRetornoPack, modalidadDeTipo, ofertaPackVigente, productosRecuperables, urlRetornoPack, PACK_AHORRO_CLP, PACK_ANALISIS, PACK_PRECIO_CLP, PACK_UNITARIO_CLP, PACK_UNITARIO_REFERENCIA_CLP, venceEl, VENTANA_PACK_MS } from "../../../src/lib/lo-que-sigue/oferta-pack";
import { fmtCLP } from "../../../src/lib/pricing";
import { debeSubirTicket, leerEstadoTicket, marcarTicket } from "../../../src/lib/lo-que-sigue/estado-ticket";
import { queVaAbajo } from "../../../src/lib/lo-que-sigue/estado-ui";
import { perfilDesdeLtr, perfilDesdeStr, tipologiaDe } from "../../../src/lib/lo-que-sigue/perfil";
import { CHECKOUT_PACK, COMPARAR, CORREO_RECORDATORIO, DESPUES_DE_PAGAR, ESTAS_DENTRO, FRASE_REGISTRO, leadTicket, OFERTA_REGISTRO, REGISTRO_UN_PASO, RETORNO_SIN_SESION, TICKET_PACK } from "../../../src/lib/lo-que-sigue/copy";
import { precioQueCierraUF } from "../../../src/lib/lo-que-sigue/precio-cierre";
import { aplicarPrecarga, CAMPOS_DEPTO, CAMPOS_PRECARGA, precargaDesdeInforme } from "../../../src/lib/lo-que-sigue/precarga";
import { correoRecordatorioPack, debeRecordar } from "../../../src/lib/lo-que-sigue/recordatorio";
import { computeNext, computePlannedPath, type WizardV4Answers } from "../../../src/components/formulario-v4/wizardV4Nodes";
import type { HallazgoDistanciaVeredicto } from "../../../src/lib/types";
import { EVENTOS_LQS } from "../../../src/lib/lo-que-sigue/eventos";
import { CODIGO_MAX, CODIGO_MIN, codigoValido, limpiarCodigo } from "../../../src/lib/lo-que-sigue/codigo";
import { FLOW_PRODUCTS } from "../../../src/lib/flow-products";
import { correoCodigoSupabase } from "../../../src/lib/email/plantilla-clara";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");

/** Voseo: las formas que se cuelan («dejás», «tenés», «mirá», «tomá», «vos», «tu informe guardalo»). */
const VOSEO = /(^|[^a-záéíóúñ])(dejás|tenés|querés|podés|sabés|mirá|tomá|entrá|seguí|registrate|guardá|revisá|vos|poné|compará|comparalo|negociá|analizá|elegí|tocá|pedí|escribí|fijate|hacé|decime|pensás|comprás|buscás|analizás|negociás|firmás|dejala|preguntá)(?![a-záéíóúñ])/i;

export function runLoQueSigueTier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER LO-QUE-SIGUE (las dos ofertas del primer informe anónimo, 0 tokens) ───");

  // ── 1 · NADA CON SESIÓN ────────────────────────────────────────────────────
  const ltr = sinComentarios(leer("src/app/analisis/[id]/results-client.tsx"));
  if (!/const loQueSigue = isAnonOwner && !isLoggedIn && !!analysisId;/.test(ltr)) F("1 · el gate LTR no es «dueño anónimo sin sesión»");
  if (!/despuesDeLaCard=\{loQueSigue \? <BannerRegistro ctx=\{ctxLqs\} next=\{nextLqs\} perfil=\{perfilLqs\} \/> : undefined\}/.test(ltr)) F("1 · el banner LTR no cuelga del gate");
  if (!/\{loQueSigue \? \(\s*<TicketPack ctx=\{ctxLqs\} createdAt=\{createdAt\} precioCierreUF=\{precioCierreLqs\} \/>\s*\) : showCtaWelcome \? null : \(\s*<CierreInforme /.test(ltr)) F("1 · el ticket LTR no cuelga del gate (o desplazó el cierre de siempre)"); // (01-oct-2026) el cierre de siempre es CierreInforme
  if (/CierreRegistro|lqs-cierre/.test(ltr)) F("1 · vuelve el texto del registro al final del informe LTR: la barra fija es la repetición");
  const str = sinComentarios(leer("src/app/analisis/renta-corta/[id]/results-client.tsx"));
  if (!/const loQueSigue = isAnonOwner && !userId && !demo;/.test(str)) F("1 · el gate STR no es «dueño anónimo sin sesión, fuera del demo»");
  if (!/despuesDeLaCard=\{loQueSigue \? <BannerRegistro ctx=\{ctxLqs\} next=\{nextLqs\} perfil=\{perfilLqs\} \/> : undefined\}/.test(str)) F("1 · el banner STR no cuelga del gate");
  if (!/\{loQueSigue \? \(\s*<TicketPack ctx=\{ctxLqs\} createdAt=\{createdAt\} precioCierreUF=\{precioCierreLqs\} \/>\s*\) : showCtaWelcome \? null : \(\s*<CierreInforme /.test(str)) F("1 · el ticket STR no cuelga del gate");
  if (/CierreRegistro|lqs-cierre/.test(str)) F("1 · vuelve el texto del registro al final del informe STR");
  if (!/\/registro\?next=/.test(sinComentarios(leer("src/app/checkout/page.tsx"))) || /\/register\?next=/.test(sinComentarios(leer("src/app/checkout/page.tsx")))) F("1 · el checkout no manda a /registro, la única puerta");
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
  if (FLOW_PRODUCTS.pack3.amount !== PACK_PRECIO_CLP || PACK_PRECIO_CLP !== 14990 || PACK_ANALISIS !== 3 || PACK_UNITARIO_CLP !== 5000 || FLOW_PRODUCTS.pack3.kind !== "one_time") F("2 · el pack no es 3 análisis por $14.990 ($5.000 cada uno) en el catálogo de Flow");
  if (fmtCLP(PACK_PRECIO_CLP) !== "$14.990" || fmtCLP(PACK_UNITARIO_CLP) !== "$5.000" || fmtCLP(PACK_UNITARIO_REFERENCIA_CLP) !== "$9.990") F("2 · el ticket no dice «$14.990» ni «$5.000 por análisis en vez de $9.990»");
  {
    const tk = sinComentarios(leer("src/components/lo-que-sigue/TicketPack.tsx"));
    if (!/\{TICKET_PACK\.ahorro\(fmtCLP\(PACK_UNITARIO_CLP\), fmtCLP\(PACK_UNITARIO_REFERENCIA_CLP\)\)\}/.test(tk) || TICKET_PACK.ahorro("$5.000", "$9.990") !== "$5.000 cada uno en vez de $9.990.") F("2 · el ahorro no dice «$5.000 cada uno en vez de $9.990.» con los montos del catálogo");
    if (!/\{TICKET_PACK\.titulo\(fmtCLP\(PACK_PRECIO_CLP\)\)\}/.test(tk) || TICKET_PACK.titulo("$14.990") !== "3 análisis por $14.990" || !/\{TICKET_PACK\.pestana\(fmtCLP\(PACK_PRECIO_CLP\), hora\)\}/.test(tk)) F("2 · el precio del ticket o de la pestaña no sale de PACK_PRECIO_CLP");
    if (!/\{TICKET_PACK\.despedidaAhorro\(fmtCLP\(PACK_AHORRO_CLP\)\)\}/.test(tk) || fmtCLP(PACK_AHORRO_CLP) !== "$15.000") F("2 · la despedida no dice «$15.000 menos» desde el catálogo");
  }
  const create = sinComentarios(leer("src/app/api/payments/create/route.ts"));
  if (!/if \(product === PRODUCTO_PACK && !analysisId\)/.test(create)) F("2 · payments/create acepta el pack sin informe");
  if (!/if \(!ofertaPackVigente\(analysis\.created_at as string\)\) \{[\s\S]*?eventoPackVencido\([\s\S]*?status: 410/.test(create)) F("2 · payments/create no rechaza el pack vencido con 410 ni lo mide");
  if (/pack3: \{ amount: 9990/.test(create)) F("2 · vuelve el pack3 legacy de $9.990");
  const confirm = sinComentarios(leer("src/app/api/payments/confirm/route.ts"));
  if (!/product === PRODUCTO_PACK\) \{[\s\S]*?grantCredits\(userId, PRODUCTO_PACK, PACK_ANALISIS, \{ paymentId, noExpire: true \}\)/.test(confirm)) F("2 · payments/confirm no otorga los 3 créditos sin caducidad");
  if (!/capturarServidor\(eventoPackPagado\(/.test(confirm)) F("2 · pack_pagado no sale del servidor al confirmar");
  const ticket = sinComentarios(leer("src/components/lo-que-sigue/TicketPack.tsx"));
  if (!/if \(!ofertaPackVigente\(createdAt\)\) \{\s*setVigente\(false\);[\s\S]*?EVENTOS_LQS\.packVencido[\s\S]*?marcarTicket\(almacen, ctx\.analysisId, "despedida"\);\s*continue;/.test(ticket)) F("2 · el ticket sube aunque el pack haya vencido (o no mide pack_vencido)");
  const packApi = sinComentarios(leer("src/app/api/lo-que-sigue/pack/route.ts"));
  if (!/if \(!ofertaPackVigente\(analysis\.created_at as string\)\) \{[\s\S]*?eventoPackVencido[\s\S]*?status: 410/.test(packApi)) F("2 · el pago desde el ticket no rechaza el pack vencido con 410");
  if (!/generateLink\(\{\s*type: "magiclink",\s*email,/.test(packApi) || !/claimAnalisisAnonimos\(admin, user, token\)/.test(packApi) || !/if \(analysis\.user_id && analysis\.user_id !== user\.id\)/.test(packApi)) F("2 · el pago desde el ticket no crea la cuenta por correo, no adopta el informe o no cuida al dueño");
  if (!/product: PRODUCTO_PACK,\s*amount: producto\.amount,/.test(packApi) || !/urlConfirmation: `\$\{SITE_URL\}\/api\/payments\/confirm`/.test(packApi)) F("2 · el pago desde el ticket no abre la orden del pack en Flow");
  if (!/fetch\("\/api\/lo-que-sigue\/pack", \{\s*method: "POST"/.test(ticket) || !/className="lqs-tk-correo"/.test(ticket) || /\/registro\?next=/.test(ticket)) F("2 · el ticket no lleva el correo adentro directo a Flow (o sigue mandando a /registro)");
  if (!/if \(res\.status === 401\) \{\s*setPaymentStatus\("sin_sesion"\);/.test(sinComentarios(leer("src/app/payments/return/page.tsx")))) F("2 · /payments/return sin sesión no explica cómo entrar después de pagar el pack");
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
  if (!/if \(!debeSubirTicket\(leerEstadoTicket\(almacen, ctx\.analysisId\)\)\) continue;\s*subioEnEstaCarga = true;/.test(ticket)) F("4 · el ticket no consulta su estado antes de subir solo");
  if (!/onClick=\{\(\) => abrir\("pestaña"\)\}/.test(ticket) || !/const pestana = zonaCierre && !abierto && yaSubio && vigente;/.test(ticket)) F("4 · no hay pestaña para volver al ticket (zona del cierre, cerrado, oferta viva)");
  if (!/const enZona = e\.isIntersecting \|\| e\.boundingClientRect\.top < 0;\s*if \(enZona\) entrarZonaCierre\(\);\s*else salirZonaCierre\(\);/.test(ticket)) F("4 · la zona del cierre no se mide (del sentinel al final de la página)");
  if (queVaAbajo({ bannerAtras: true, zonaCierre: false, ticketAbierto: false, ticketYaSubio: false, ofertaVigente: true }) !== "barra") F("4 · fuera del cierre no va la barra");
  if (queVaAbajo({ bannerAtras: true, zonaCierre: true, ticketAbierto: true, ticketYaSubio: true, ofertaVigente: true }) !== "ticket") F("4 · con el ticket arriba va otra cosa");
  if (queVaAbajo({ bannerAtras: true, zonaCierre: true, ticketAbierto: false, ticketYaSubio: true, ofertaVigente: true }) !== "pestaña") F("4 · en el cierre, cerrado el ticket, no queda la pestaña");
  if (queVaAbajo({ bannerAtras: true, zonaCierre: true, ticketAbierto: false, ticketYaSubio: true, ofertaVigente: false }) !== "nada") F("4 · vencida la oferta sigue la pestaña");
  if (queVaAbajo({ bannerAtras: true, zonaCierre: true, ticketAbierto: false, ticketYaSubio: false, ofertaVigente: true }) !== "nada") F("4 · en la zona del cierre, antes de que el ticket suba, aparece la barra");
  if (queVaAbajo({ bannerAtras: false, zonaCierre: false, ticketAbierto: false, ticketYaSubio: false, ofertaVigente: true }) !== "nada") F("4 · la barra aparece antes de que el banner quede atrás");
  if (!/useAnclaAbajo\(barraRef\);/.test(sinComentarios(leer("src/components/lo-que-sigue/BannerRegistro.tsx"))) || !/useAnclaAreaVisible\(velo\);/.test(ticket) || !/useAnclaAbajo\(pestanaRef\);/.test(ticket)) F("4 · la barra, la pestaña o el velo no se anclan al área visible real desde el montaje (iOS: anclar al abrir mueve el borde a mitad de la transición)");
  const ancla = sinComentarios(leer("src/lib/lo-que-sigue/area-visible.ts"));
  if (!/vv\.offsetTop \+ vv\.height - el\.offsetHeight/.test(ancla) || !/vv\.addEventListener\("scroll", colocar\)/.test(ancla)) F("4 · el ancla no lee visualViewport (offsetTop + height) ni sigue su scroll");
  if (!/const useAntesDePintar = typeof window !== "undefined" \? useLayoutEffect : useEffect;/.test(ancla) || (ancla.match(/useAntesDePintar\(\(\) => \{/g) ?? []).length !== 2) F("4 · el ancla no se fija antes de pintar (useLayoutEffect)");
  if (!/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?transition: opacity 160ms ease !important;[\s\S]*?\.lqs-velo\[data-abierto="1"\] \.lqs-hoja \{ opacity: 1;/.test(leer("src/components/lo-que-sigue/lo-que-sigue.css"))) F("4 · con «Reducir movimiento» el borde inferior aparece de golpe en vez de fundirse");
  if (!/function despedirse\(\) \{\s*if \(cara === "despedida"\) return;\s*setCara\("despedida"\);\s*capturarLqs\(posthog, EVENTOS_LQS\.despedidaVista/.test(ticket)) F("4 · cerrar o «Seguir leyendo» no cambian a la despedida en el mismo lugar");
  if (!/function cerrarDelTodo\(\) \{\s*marcarTicket\([^)]*, ctx\.analysisId, "despedida"\);\s*setAbierto\(false\);\s*cerrarTicket\(\);/.test(ticket)) F("4 · «Sí, seguir leyendo» no cierra ni deja el ticket como terminal");
  if (!/className="lqs-x" onClick=\{despedirse\}/.test(ticket) || !/className="lqs-seguir" onClick=\{despedirse\}/.test(ticket)) F("4 · la X o «Seguir leyendo» cierran de golpe en vez de despedirse");
  if ((ticket.match(/role=\{abierto \? "dialog" : undefined\}/g) ?? []).length !== 1) F("4 · el ticket no es UN solo diálogo");
  const banner = sinComentarios(leer("src/components/lo-que-sigue/BannerRegistro.tsx"));
  if (!/const barra = paso !== "dentro" && queVaAbajo\(\{ bannerAtras: atras, zonaCierre, ticketAbierto,/.test(banner) || !/data-visible=\{barra \? "1" : "0"\}/.test(banner)) F("4 · la barra fija no sale de queVaAbajo (una sola cosa según la zona) o sigue después de «Estás dentro»");
  const css = leer("src/components/lo-que-sigue/lo-que-sigue.css");
  if (!/\.lqs-barra\[data-visible="1"\] \{ transform: translateY\(0\)/.test(css) || !/\.lqs-velo\[data-abierto="1"\] \.lqs-hoja \{ transform: translateY\(0\)/.test(css) || !/\.lqs-franja/.test(css)) F("4 · la coreografía (barra ↔ hoja por el mismo borde) o la franja no están en el CSS");
  if (!/\.lqs-banner \{ margin: 0 calc\(50% - 50vw\)/.test(css)) F("4 · el banner no va de borde a borde");

  // ── 5 · EL COPY EN TUTEO ───────────────────────────────────────────────────
  const textos: string[] = [
    ...Object.values(FRASE_REGISTRO), ...Object.values(RETORNO_SIN_SESION),
    ...Object.values(OFERTA_REGISTRO), ...Object.values(REGISTRO_UN_PASO).map((v) => (typeof v === "function" ? v("x@y.cl") : v)),
    ...Object.values(TICKET_PACK).map((v) => (typeof v === "function" ? (v as (...a: string[]) => string)("hoy", "21:04") : v)),
    ...(["BUSCAR OTRA", "AJUSTA SUPUESTOS", "COMPRAR"] as const).flatMap((v) => [leadTicket(v, 1934, "$5.000"), leadTicket(v, null, "$5.000"), DESPUES_DE_PAGAR.fraseVeredicto[v]]),
    ESTAS_DENTRO.titular, ESTAS_DENTRO.cuerpo, ESTAS_DENTRO.tocaCambiar, ESTAS_DENTRO.aprende, ESTAS_DENTRO.cuando, ESTAS_DENTRO.errorGuardar, ...ESTAS_DENTRO.horizontes.map((h) => h.texto), ...Object.values(ESTAS_DENTRO.modalidad),
    DESPUES_DE_PAGAR.titular, DESPUES_DE_PAGAR.cuerpo, DESPUES_DE_PAGAR.boton,
    COMPARAR.titulo, COMPARAR.bajada, COMPARAR.boton, COMPARAR.notaPesos, COMPARAR.minimo, ...Object.values(COMPARAR.filas),
    ...Object.values(CORREO_RECORDATORIO),
    CHECKOUT_PACK.titulo, CHECKOUT_PACK.subtitulo, CHECKOUT_PACK.vence("hoy", "21:04"), CHECKOUT_PACK.vencido,
  ];
  for (const t of textos) {
    if (VOSEO.test(t)) F(`5 · voseo en el copy: «${t}»`);
    if (/\bdesde\b/i.test(t)) F(`5 · «desde» en el copy: «${t}»`);
    if (/guard[aá]/i.test(t)) F(`5 · «guarda tu informe» en el copy: «${t}»`);
  }
  if (TICKET_PACK.despedida("21:04") !== "Vence a las 21:04 y no vuelve." || TICKET_PACK.despedidaAhorro("$15.000") !== "Son $15.000 menos en tus próximos tres análisis. ¿La dejas pasar?") F("5 · la despedida no es la frase aprobada, en tuteo");
  // Las frases aprobadas, literales (30-sep-2026).
  if (FRASE_REGISTRO["BUSCAR OTRA"] !== "Este depto no conviene. Franco ya tiene los que sí." || FRASE_REGISTRO["AJUSTA SUPUESTOS"] !== "Este depto conviene si lo negocias. Franco tiene los que convienen tal como están." || FRASE_REGISTRO.COMPRAR !== "Este depto conviene. Y Franco tiene más oportunidades como esta.") F("5 · la primera línea del banner no es la aprobada");
  if (OFERTA_REGISTRO.boton !== "Quiero acceso" || OFERTA_REGISTRO.bajoBoton !== "Gratis. Solo tu correo." || `${OFERTA_REGISTRO.barraTitulo} ${OFERTA_REGISTRO.barraSub}` !== "Las oportunidades que otros no ven. Solo para usuarios de Franco.") F("5 · el botón, el «Gratis» o la barra no son los aprobados");
  if (ESTAS_DENTRO.titular !== "Estás dentro." || ESTAS_DENTRO.cuando !== "¿Cuándo piensas comprar?" || ESTAS_DENTRO.horizontes.map((h) => h.texto).join("|") !== "Ya|En los próximos meses|Solo estoy mirando") F("5 · «Estás dentro» no es el aprobado");
  if (TICKET_PACK.pestana("$14.990", "21:04") !== "3 análisis por $14.990 · hasta las 21:04" || TICKET_PACK.boton !== "Quiero los 3 análisis") F("5 · la pestaña o el botón del ticket no son los aprobados");
  // (30-sep-2026) El copy nuevo de Fabrizio, con la guía de búsqueda debajo; sin guía, Buscar otro dice la de antes.
  if (DESPUES_DE_PAGAR.fraseVeredicto["BUSCAR OTRA"] !== "Mismo pie, mismo plazo. Abajo, deptos parecidos ya revisados con tus números." || DESPUES_DE_PAGAR.fraseVeredicto["AJUSTA SUPUESTOS"] !== "Compara y mira si alguno conviene sin negociar, y así tienes con qué presionar." || DESPUES_DE_PAGAR.fraseVeredicto.COMPRAR !== "Compara y mira si este sigue siendo el mejor." || DESPUES_DE_PAGAR.buscarSinGuia !== "Mismo pie, mismo plazo. Solo falta el próximo depto.") F("5 · la frase por veredicto de después de pagar no es la aprobada");
  if (`${DESPUES_DE_PAGAR.titular} ${DESPUES_DE_PAGAR.cuerpo}` !== "Tienes 3 análisis. El próximo es más fácil: tus números del primer informe ya están cargados.") F("5 · después de pagar no dice «Tienes 3 análisis…»");
  if (CORREO_RECORDATORIO.asunto !== "Te quedan 3 análisis, con tus números ya cargados.") F("5 · el asunto del correo no es el aprobado");
  for (const f of ["src/components/lo-que-sigue/BannerRegistro.tsx", "src/components/lo-que-sigue/EstasDentro.tsx", "src/components/lo-que-sigue/DespuesDePagar.tsx", "src/components/lo-que-sigue/TicketPack.tsx", "src/app/comparar/comparar-vista.tsx"]) {
    // El texto visible sale de copy.ts: ni voseo ni literales sueltos en JSX.
    const s = sinComentarios(leer(f));
    const literales = (s.match(/>\s*[A-ZÁÉÍÓÚ¿][^<>{}]{3,}\s*</g) ?? []).map((x) => x.slice(1, -1).trim());
    for (const l of literales) if (VOSEO.test(l)) F(`5 · voseo en ${f}: «${l}»`);
  }
  if (!/\\u00bf|¿La dejas pasar\?/.test(leer("src/lib/lo-que-sigue/copy.ts"))) F("5 · la despedida no está en copy.ts");

  // ── 6 · EL PRECIO DEL TICKET SALE DEL MOTOR ───────────────────────────────
  {
    const dv = (valor: Record<string, unknown>) => ({ id: "distancia_veredicto", tipo: "distancia_umbral", valor }) as unknown as HallazgoDistanciaVeredicto;
    const viaPrecio = (uf: number) => [{ palanca: "precio", estado: "cruza", objetivo: uf }];
    const ajusta = dv({ vias: viaPrecio(4175) });
    const buscar = dv({ viasHastaComprar: viaPrecio(1934) });
    if (precioQueCierraUF("AJUSTA SUPUESTOS", ajusta, 4500) !== 4175) F("6 · AJUSTA no lee el precio de la vía del motor");
    if (precioQueCierraUF("BUSCAR OTRA", buscar, 2400) !== 1934) F("6 · BUSCAR no lee el precio de la vía hasta Comprar");
    if (precioQueCierraUF("COMPRAR", ajusta, 4500) !== null) F("6 · COMPRAR recibe un precio que cierra: su frase no lleva cifra");
    if (precioQueCierraUF("AJUSTA SUPUESTOS", null, 4500) !== null) F("6 · sin hallazgo se inventa un precio");
    if (precioQueCierraUF("AJUSTA SUPUESTOS", dv({ vias: viaPrecio(4600) }), 4500) !== null) F("6 · un «precio que cierra» por encima del precio pedido pasa al ticket");
    if (!/Para que este conviniera, tendría que costar UF 1\.934\. Equivocarte con un depto cuesta millones\. Saberlo antes, \$5\.000\./.test(leadTicket("BUSCAR OTRA", 1934, "$5.000"))) F("6 · la frase BUSCAR no lleva el precio en UF con punto de miles");
    if (leadTicket("AJUSTA SUPUESTOS", 4175, "$5.000") !== "Este conviene si te lo dejan en UF 4.175. Mientras negocias, compáralo con otros de la zona: si hay uno que conviene sin negociar, tienes con qué presionar.") F("6 · la frase AJUSTA no es la aprobada con el precio");
    if (/UF/.test(leadTicket("AJUSTA SUPUESTOS", null, "$5.000")) || /UF/.test(leadTicket("BUSCAR OTRA", null, "$5.000"))) F("6 · sin precio del motor la frase inventa una cifra");
    const tk = sinComentarios(leer("src/components/lo-que-sigue/TicketPack.tsx"));
    if (!/\{leadTicket\(v, precioCierreUF, fmtCLP\(PACK_UNITARIO_CLP\)\)\}/.test(tk)) F("6 · la primera línea del ticket no es leadTicket con el precio que recibe");
    if (!/const precioCierreLqs = precioQueCierraUF\(\s*resolvedVeredicto,\s*\(\(results\?\.hallazgos[\s\S]{0,120}\.find\(\(h\) => h\.id === "distancia_veredicto"\)[\s\S]{0,80}\?\? null,\s*inputData\?\.precio,\s*\);/.test(ltr)) F("6 · el informe LTR no saca el precio del hallazgo de distancia del motor");
    if (!/const precioCierreLqs = precioQueCierraUF\(veredicto, distanciaPortada, precioCompraUFIn\);/.test(str)) F("6 · el informe STR no saca el precio de la distancia del motor");
  }

  // ── 7 · EL WIZARD PRECARGADO NO PISA EL DEPTO ─────────────────────────────
  {
    const origen = { piePct: 20, tasaInteres: 4.04, tasaMercado: 4.04, plazoCredito: 25, comuna: "San Miguel", ciudad: "Santiago", dormitorios: 2, banos: 1, precio: 2250, superficieUtil: 43, arriendo: 470000, direccion: "Gran Avenida 1", gastosComunes: 60000, contribuciones: 0, tipoPropiedad: "usado", antiguedad: 5 };
    const pre = precargaDesdeInforme(origen, "long-term");
    for (const k of CAMPOS_DEPTO) if (k in pre) F(`7 · la precarga trae «${k}», que es del depto`);
    for (const k of Object.keys(pre)) if (!(CAMPOS_PRECARGA as readonly string[]).includes(k)) F(`7 · la precarga escribe «${k}», fuera de lo de la persona`);
    if (pre.pieMonto !== "20" || pre.tasaInteres !== "4,04" || pre.plazoCredito !== "25" || pre.modalidad !== "ltr" || pre.comuna !== "San Miguel" || pre.dormitorios !== "2" || pre.financiamientoPrecargado !== true) F("7 · la precarga no arma pie, tasa, plazo, modalidad, comuna y tipología");
    if (precargaDesdeInforme(origen, "short-term").modalidad !== "str") F("7 · la precarga de renta corta no queda en renta corta");
    if (precargaDesdeInforme({ piePct: 20 }, "long-term").financiamientoPrecargado) F("7 · sin tasa ni plazo igual se salta el financiamiento");
    const actual = { precio: "3100", superficieUtil: "55", direccion: "Otra 2", comuna: "Ñuñoa", pieMonto: "" } as WizardV4Answers;
    const patch = aplicarPrecarga(actual, { ...pre, ...({ precio: "2250", superficieUtil: "43", direccion: "Gran Avenida 1" } as Record<string, string>) });
    for (const k of CAMPOS_DEPTO) if (k in patch) F(`7 · aplicarPrecarga escribe «${k}», que es del depto`);
    if ("comuna" in patch) F("7 · aplicarPrecarga pisa una comuna ya respondida");
    if (patch.pieMonto !== "20") F("7 · aplicarPrecarga no llena un campo vacío de la persona");
    const listo: WizardV4Answers = { financiamientoPrecargado: true, pieMonto: "20", tasaInteres: "4,04", plazoCredito: "25", modalidad: "ltr" } as WizardV4Answers;
    if (computeNext("precio", listo) !== "arr" || (() => { const r = computePlannedPath(listo); return r.includes("pie") || r[r.indexOf("precio") + 1] !== "arr"; })()) F("7 · con el financiamiento precargado el wizard no salta de precio a la renta");
    if (computeNext("precio", { ...listo, modalidad: "str" }) !== "adr") F("7 · en renta corta no salta a la tarifa");
    if (computeNext("precio", { ...listo, financiamientoPrecargado: false }) !== "pie" || computeNext("precio", { ...listo, tasaInteres: "" }) !== "pie") F("7 · sin precarga completa el wizard se salta el pie");
    const wz = sinComentarios(leer("src/components/formulario-v4/WizardV4.tsx"));
    if (!/const patch = aplicarPrecarga\(nav\.answers, precarga \?\? \{\}\);\s*if \(Object\.keys\(patch\)\.length > 0\) w\.patchAnswers\(patch\);/.test(wz)) F("7 · el wizard no aplica la precarga con aplicarPrecarga (podría pisar el depto)");
    if (!/if \(!precargaId \|\| precargaAplicada\.current \|\| !w\.inicializado \|\| w\.draftPendiente\) return;/.test(wz)) F("7 · la precarga corre antes de que el borrador se resuelva (lo pisaría)");
    const api = sinComentarios(leer("src/app/api/lo-que-sigue/precarga/route.ts"));
    if (!/\.eq\("id", analysisId\)\s*\.eq\("user_id", user\.id\)/.test(api) || !/status: 401/.test(api)) F("7 · la precarga lee un informe ajeno o sin sesión");
  }

  // ── 8 · EL CORREO SALE UNA VEZ ─────────────────────────────────────────────
  {
    const ahora = new Date("2026-10-04T13:00:00Z");
    const base = { status: "paid", product: "pack3", pagadoEl: "2026-10-01T12:00:00Z", recordatorioEnviadoEl: null, restantes: 3 };
    if (!debeRecordar(base, ahora)) F("8 · a los tres días sin usar el pack no toca el correo");
    if (debeRecordar({ ...base, recordatorioEnviadoEl: "2026-10-04T12:00:00Z" }, ahora)) F("8 · el correo sale dos veces");
    if (debeRecordar({ ...base, restantes: 2 }, ahora)) F("8 · el correo sale aunque ya usó uno");
    if (debeRecordar({ ...base, pagadoEl: "2026-10-02T12:00:00Z" }, ahora)) F("8 · el correo sale antes de los tres días");
    if (debeRecordar({ ...base, status: "pending" }, ahora) || debeRecordar({ ...base, product: "single" }, ahora)) F("8 · el correo sale sin pago o para otro producto");
    const cron = sinComentarios(leer("src/app/api/cron/recordatorio-pack/route.ts"));
    const reclamo = cron.search(/\.update\(\{ recordatorio_pack_enviado_at: [^}]+\}\)\s*\.eq\("id", [^)]+\)\s*\.is\("recordatorio_pack_enviado_at", null\)\s*\.select\(/);
    const envio = cron.search(/sendRecordatorioPackEmail\(/);
    if (reclamo < 0) F("8 · el cron no reclama la fila con la condición en el WHERE (de NULL a fecha)");
    if (envio < 0 || (reclamo >= 0 && envio < reclamo)) F("8 · el cron manda el correo antes de reclamar la fila");
    if (!/if \(casErr \|\| !reclamado\) \{/.test(cron)) F("8 · el cron manda aunque el reclamo no tuvo efecto");
    const vj = JSON.parse(leer("vercel.json")) as { crons: { path: string }[] };
    if (!vj.crons.some((c) => c.path === "/api/cron/recordatorio-pack")) F("8 · el cron del recordatorio no está en vercel.json");
    if (!/recordatorio_pack_enviado_at timestamptz/.test(leer("supabase/migrations/20260930_lo_que_sigue_preferencias.sql"))) F("8 · falta la columna del reclamo en la migración");
    const c = correoRecordatorioPack("https://refranco.ai", "11111111-2222-3333-4444-555555555555");
    if (c.subject !== CORREO_RECORDATORIO.asunto || !c.html.includes("/analisis/nuevo-v4?precarga=11111111-2222-3333-4444-555555555555") || !/background: #FAFAF8/.test(c.html)) F("8 · el correo no va en la plantilla clara con el botón al wizard precargado");
  }

  // ── después de pagar: el retorno del pack ──────────────────────────────────
  {
    const sp = (q: string) => new URLSearchParams(q);
    const r = leerRetornoPack(sp("order=x&lqs=pack&a=11111111-2222-3333-4444-555555555555&v=b"));
    if (!r || r.veredicto !== "BUSCAR OTRA") F("pago · el retorno del pack no trae el informe y el veredicto");
    // 9 · LA MODALIDAD VUELVE CON EL PAGO y el evento la registra de ahí (29-sep-2026).
    const ida = (m: "ltr" | "str") => leerRetornoPack(new URL(urlRetornoPack("https://refranco.ai", "o1", "11111111-2222-3333-4444-555555555555", "COMPRAR", m)).searchParams);
    if (ida("str")?.modalidad !== "str" || ida("ltr")?.modalidad !== "ltr" || ida("str")?.veredicto !== "COMPRAR") F("9 · la vuelta del pago no trae la modalidad (ida y vuelta)");
    if (modalidadDeTipo("short-term") !== "str" || modalidadDeTipo("long-term") !== "ltr") F("9 · la modalidad no sale de tipo_analisis");
    for (const [f, re] of [
      ["src/app/api/lo-que-sigue/pack/route.ts", /select\("user_id, created_at, results, tipo_analisis"\)[\s\S]*urlRetornoPack\(SITE_URL, commerceOrder, analysisId, veredicto, modalidadDeTipo\(analysis\.tipo_analisis as string\)\)/],
      ["src/app/api/payments/create/route.ts", /modalidadPack = modalidadDeTipo\(analysis\.tipo_analisis as string\);[\s\S]*urlRetornoPack\(SITE_URL, commerceOrder, analysisId, veredictoPack, modalidadPack\)/],
      ["src/app/payments/return/page.tsx", /modalidad=\{retornoPack\.modalidad\}/],
      ["src/components/lo-que-sigue/DespuesDePagar.tsx", /EVENTOS_LQS\.postPagoVisto, \{ analysisId, veredicto, modalidad \}/],
    ] as const) if (!re.test(sinComentarios(leer(f)))) F(`9 · ${f} no lleva la modalidad del informe hasta el evento de después de pagar`);
    if (leerRetornoPack(sp("order=x&a=11111111-2222-3333-4444-555555555555")) !== null) F("pago · un retorno que no es del pack muestra la pantalla del pack");
    const ret = sinComentarios(leer("src/app/payments/return/page.tsx"));
    // (01-oct-2026) Con guía (renta larga) «Tienes 3 análisis. Empieza por estos.» es la guía; sin ella, DespuesDePagar.
    if (!/\{retornoPack && \(paymentStatus === "paid" \|\| paymentStatus === "sin_sesion"\) && \(\s*hayGuia\(retornoPack\.modalidad\) \? \(\s*<GuiaBusqueda[\s\S]{0,400}?\) : \(\s*<DespuesDePagar/.test(ret) || !/\{!retornoPack && paymentStatus === "paid" && !redirecting && \(/.test(ret)) F("pago · después de pagar el pack se muestra el saldo en vez de «Tienes 3 análisis»");
  }

  // ── 10 · EL CARRITO ABANDONADO NO LE ESCRIBE A QUIEN DEJÓ EL PACK ──────────
  {
    const rec = productosRecuperables(Object.keys(FLOW_PRODUCTS) as (keyof typeof FLOW_PRODUCTS)[]);
    if ((rec as string[]).includes("pack3")) F("10 · el carrito abandonado le escribe a quien dejó el pack (vence y no vuelve)");
    if (!(rec as string[]).includes("single") || rec.length !== Object.keys(FLOW_PRODUCTS).length - 1) F("10 · el filtro del pack se lleva otros productos del recupero");
    const ab = sinComentarios(leer("src/app/api/cron/abandoned-checkout/route.ts"));
    if (!/const RECOVERABLE_PRODUCTS = productosRecuperables\(Object\.keys\(FLOW_PRODUCTS\) as FlowProductKey\[\]\);/.test(ab) || (ab.match(/\.in\("product", RECOVERABLE_PRODUCTS\)/g) ?? []).length !== 2) F("10 · el cron de carrito abandonado no filtra con productosRecuperables en sus dos lecturas");
  }

  // ── eventos: los ocho, y del lado del cliente con veredicto y modalidad ────
  const esperados = ["banner_visto", "registro_iniciado", "registro_completado", "ticket_visto", "despedida_vista", "pack_iniciado", "pack_pagado", "pack_vencido",
    "acceso_click", "dentro_visto", "preferencia_editada", "horizonte_elegido", "post_pago_visto", "precarga_abierta", "comparar_visto", "recordatorio_pack_enviado"];
  const tenemos = Object.values(EVENTOS_LQS);
  for (const e of esperados) if (!tenemos.includes(e as never)) F(`eventos · falta ${e}`);
  const eventos = sinComentarios(leer("src/lib/lo-que-sigue/eventos.ts"));
  if (!/oferta: "lo_que_sigue",\s*analysis_id: ctx\.analysisId,\s*veredicto: ctx\.veredicto,\s*modalidad: ctx\.modalidad,/.test(eventos)) F("eventos · capturarLqs no lleva análisis, veredicto y modalidad");
  const reg = sinComentarios(leer("src/components/lo-que-sigue/RegistroUnPaso.tsx"));
  if (!/signInWithOtp\(\{\s*email: c,\s*options: \{ emailRedirectTo: callback\(\), shouldCreateUser: true \}/.test(reg)) F("registro · el correo no manda el enlace sin contraseña (signInWithOtp)");
  if (!/EVENTOS_LQS\.registroIniciado, ctx, \{ via: "correo" \}/.test(reg) || !/EVENTOS_LQS\.registroIniciado, ctx, \{ via: "google" \}/.test(reg)) F("registro · registro_iniciado no lleva la vía");
  if (!/consumirRegistroPendiente\(\);\s*if \(m\) capturarLqs\(posthog, EVENTOS_LQS\.registroCompletado, m\.ctx, \{ via: m\.via, como: "enlace" \}\)/.test(reg)) F("registro · registro_completado no sale al volver con su vía");
  if (!/verifyOtp\(\{ email: enviado, token: t, type: "email" \}\)/.test(reg) || !/autoComplete="one-time-code"/.test(reg) || !/maxLength=\{CODIGO_MAX\}/.test(reg)) F("4 · el código no se escribe en el mismo formulario (verifyOtp)");
  // 11 · EL CÓDIGO DE 6 A 8 DÍGITOS (29-sep-2026): Supabase manda el largo que diga su panel («Email OTP
  //      Length»); estuvo en 8 con un formulario de 6 y nadie podía entrar con el código. El copy sigue en 6.
  if (CODIGO_MIN !== 6 || CODIGO_MAX !== 8) F("11 · el formulario no acepta de 6 a 8 dígitos");
  if (!codigoValido("482913") || !codigoValido("4829131") || !codigoValido("24017994")) F("11 · un código de 6, 7 u 8 dígitos no pasa");
  if (codigoValido("48291") || codigoValido("240179941") || codigoValido("48 2913") || codigoValido("")) F("11 · pasa un código de menos de 6, de más de 8 o con otra cosa que dígitos");
  if (limpiarCodigo("2401 7994") !== "24017994" || limpiarCodigo("240179941234") !== "24017994") F("11 · pegar un código de 8 dígitos lo corta o deja espacios");
  if (!/onChange=\{\(e\) => setCodigo\(limpiarCodigo\(e\.target\.value\)\)\}/.test(reg) || !/if \(!codigoValido\(t\) \|\| !enviado\) \{/.test(reg) || /\\d\{6\}|slice\(0, 6\)/.test(reg)) F("11 · el formulario no usa limpiarCodigo y codigoValido (o vuelve a cortar en 6)");
  if (REGISTRO_UN_PASO.errorCodigo !== "El código son 6 dígitos.") F("11 · el copy dejó de decir 6 dígitos");
  if (!/await reclamarAnalisisAnonimos\(posthog, "register"\);[\s\S]*?EVENTOS_LQS\.registroCompletado, ctx, \{ via: "correo", como: "codigo" \}\);[\s\S]*?router\.refresh\(\);/.test(reg)) F("4 · al entrar con código no se reclama el informe, no se mide o no se refresca el informe");
  if (!/emailRedirectTo: callback\(\)/.test(reg)) F("4 · el enlace del correo no vuelve al mismo informe");
  const plantilla = leer("docs/emails/supabase-codigo.html").replace(/<!--[\s\S]*?-->/g, "");
  if (!/\{\{ \.Token \}\}/.test(plantilla) || !/\{\{ \.ConfirmationURL \}\}/.test(plantilla)) F("4 · la plantilla del correo de Supabase no lleva el código y el enlace");
  if (plantilla.trim() !== correoCodigoSupabase().trim()) F("4 · docs/emails/supabase-codigo.html no es lo que genera la plantilla clara (regenerar con scripts/emails/generar-supabase-codigo.ts)");
  if (/background: #151515|Courier|color-scheme" content="dark/.test(plantilla) || !/<body style="margin: 0; padding: 0; background: #FAFAF8;">/.test(plantilla) || !/Inter, 'Helvetica Neue'/.test(plantilla)) F("4 · la plantilla del código no es la clara (papel, Inter con fallback), o trae oscuro o mono");
  if (!/<img src="https:\/\/refranco\.ai\/email\/wordmark-claro-2x\.png" width="132" height="43" alt="refranco\.ai"/.test(plantilla)) F("4 · el wordmark del correo no es el PNG fiel (ancho fijo, alt refranco.ai)");
  if (!/background: #0F0F0F;">\s*<a href="\{\{ \.ConfirmationURL \}\}"/.test(plantilla)) F("4 · el botón del enlace no va en tinta");
  if (!/verifyOtp\(\{ email: enviado, token: t, type: "email" \}\)/.test(reg)) F("2 · verifyOtp tiene que ir con type «email», que cubre Confirm signup y Magic Link");
  if (!/\.lqs-reg \.lqs-codigo::placeholder \{ letter-spacing: 0;/.test(leer("src/components/lo-que-sigue/lo-que-sigue.css")) || REGISTRO_UN_PASO.placeholderCodigo !== "Código") F("3 · el placeholder del código no es corto y sin espaciado");

  if (fallas.length) {
    console.log(`  ✗ LO-QUE-SIGUE · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 40)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el precio del ticket sale del motor; la precarga no pisa el depto; el correo sale una vez; nada con sesión; el pack vence a las 24 h y lo rechaza el servidor; el perfil se guarda al crear y se liga al registrarse; el ticket no vuelve después de la despedida; el copy en tuteo; los ocho eventos con su vía, veredicto y modalidad");
  }
  return { hard: fallas.length };
}

// ── ACTA DE MUTACIONES v5 (29-sep-2026, el código de 6 a 8 dígitos) ──────────────────────────
// 8/8 en rojo, restauradas: M71 el máximo vuelve a 6 · M72 la validación exige 6 · M73 limpiar corta en 6
// · M74 el campo corta en 6 · M75 maxLength 6 · M76 el envío valida con otra regla · M77 pasa cualquier
// cosa · M78 el copy deja de decir 6.
// ── ACTA DE MUTACIONES v4 (29-sep-2026, modalidad de vuelta y carrito abandonado: 9/9 en rojo) ──
// M62 la vuelta sin `m` · M63 la lectura ignora `m` · M64 el evento supone ltr · M65 el ticket no lee
// tipo_analisis · M66 el checkout no pasa la modalidad · M67 la página de vuelta no la pasa · M68 el
// recupero incluye el pack · M69 el cron sin el filtro · M70 el filtro se lleva el single.
// ── ACTA DE MUTACIONES v3 (30-sep-2026, copy y después de pagar: 23/23 en rojo, restauradas) ──
// M40 voseo en el banner · M41 voseo en «Estás dentro» · M42 voseo en el correo · M43 voseo en
// después de pagar (primero pasó VERDE: la lista no tenía «poné»/«comparalo»; se amplió y se fijaron
// las tres frases literales) · M43b «dejala» en el ticket · M44 precio inventado sin motor · M45 el
// ticket ignora el precio · M46 LTR no pasa el precio · M47 STR deriva el precio · M48 BUSCAR sin las
// vías del motor · M49 la precarga trae el precio del depto · M50 aplicarPrecarga pisa lo respondido
// · M51 el wizard aplica la precarga cruda · M52 la precarga corre antes del borrador · M53 el grafo
// salta sin precarga completa · M54 el correo sale dos veces · M55 sale aunque usó uno · M56 el
// reclamo sin condición en el WHERE · M57 manda aunque no reclamó · M58 la barra sigue después de
// entrar · M59 después de pagar vuelve el saldo · M60 falta precarga_abierta · M61 el ahorro sin
// redondear ($14.980).
// ── ACTA DE MUTACIONES v2 (28-sep-2026, ajustes 1, 2 y 4: 15/15 en rojo, restauradas) ────────
// M25 vuelve el texto del registro al cierre · M26 el checkout a /register · M27 sin pestaña · M28
// la zona del cierre no cuenta lo de arriba · M29 la barra en el cierre · M30 la pestaña vencida ·
// M31 el ticket vuelve a subir solo · M32 la barra sin ancla · M33 el ancla mide la ventana · M34
// verifyOtp con otro tipo · M35 sin claim al entrar con código · M36 el ticket manda a /registro ·
// M37 el pago no adopta el informe · M38 /payments/return sin sesión cae en error · M39 la
// plantilla sin el código.
// ── ACTA DE MUTACIONES v1 (28-sep-2026, 24/24 en rojo, restauradas byte a byte) ─────────────
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
