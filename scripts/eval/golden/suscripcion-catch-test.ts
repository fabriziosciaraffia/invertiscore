// ============================================================================
// GOLDEN · SUSCRIPCION (05-nov-2026) — catch-test
// ============================================================================
//   La auditoría de promesas, parte 2: la suscripción. Decisiones de Fabrizio, 05-nov-2026:
//   1 · NUNCA DOS SUSCRIPCIONES VIVAS. «Ver cómo pagar» / «Actualiza tu método de pago» cambian la tarjeta: register-callback
//       cierra en Flow lo vivo ANTES de abrir la nueva (y si no puede cerrar, no abre). «Contratar el plan» no abre otra si
//       ya hay una que no esté cancelada. Se prueba con un Flow FALSO que lleva la cuenta de qué quedó vivo.
//   2 · «CONFIRMADO» SOLO CUANDO FLOW COBRÓ. El alta dice «Tarjeta registrada. Tu plan se activa con el primer cobro, en las
//       próximas horas.» (pantalla y correo); «Pago confirmado» sale con el primer cobro de esa suscripción; si la tarjeta
//       rechaza ese primer cobro, el correo dice que el plan no se activó.
//   3 · LA GRACIA VENCIDA CANCELA EN FLOW (también sin subscription_id, por el cliente); «Cancelar el plan» está en la
//       gracia y ahí es inmediato; «Volver al Plan Franco» dice que abre un plan nuevo (Flow no reanuda).
//   4 · «Se renueva el …» con la fecha de Flow (leída en hora de Chile); «Confirmando tu pago…» con tope de 90 s.
//   5 · «No se hizo ningún cargo» solo comprobado; si la consulta falló, «No pudimos confirmar el pago».
//   6 · ELIMINAR LA CUENTA: al pedirlo se cancela en Flow, se detienen los correos y el aviso a hola@ no falla en silencio.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. Sin red ni base.
// Solo:  node --import tsx scripts/eval/golden/suscripcion-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sinComentarios } from "./lectura-paginada-catch-test";
import { abrirPlanUnico, cancelarPlan, cerrarTodo, estaViva, type PuertaFlowConAlta, type SuscripcionFlow } from "../../../src/lib/subscriptions/flow-vivas";
import {
  CAMBIAR_TARJETA_COPY, CONFIRMANDO_TOPE_MS, DEMORA_PAGO, PAGO_SIN_CONFIRMAR, RETORNO_SUSCRIPCION, RUTA_CAMBIAR_TARJETA, SUSCRIPCION_COPY,
  esperaPrimerCobro, estadoRetornoSuscripcion, fechaDeRenovacion, fechaFlowAIso, puedeAbrirPlan,
} from "../../../src/lib/subscriptions/suscripcion";
import { correoPagoFallido, correoTarjetaRegistrada } from "../../../src/lib/email/correos";
import { MARCA_ELIMINACION, TIPOS_QUE_FRENA_LA_ELIMINACION, eliminacionPedida } from "../../../src/lib/correo-baja";
import { fechaCortaCL } from "../../../src/lib/fecha-cl";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sc = (p: string) => sinComentarios(leer(p));

/** Flow falso: guarda las suscripciones y registra el orden de las llamadas. Vivas que cobran = no canceladas ni programadas. */
class FlowFalso implements PuertaFlowConAlta {
  subs = new Map<string, Required<Pick<SuscripcionFlow, "subscriptionId" | "customerId">> & SuscripcionFlow>();
  llamadas: string[] = [];
  fallaCancelar = new Set<string>();
  fallaLista = false;
  fallaCrear = false;
  private n = 0;
  agregar(id: string, customerId: string, extra: Partial<SuscripcionFlow> = {}) {
    this.subs.set(id, { subscriptionId: id, customerId, status: 1, next_invoice_date: "2026-12-09 00:00:00", period_end: "2026-12-08 23:59:59", cancel_at_period_end: 0, ...extra });
  }
  async suscripcionesDe(customerId: string) {
    this.llamadas.push(`lista:${customerId}`);
    if (this.fallaLista) throw new Error("lista caída");
    return Array.from(this.subs.values()).filter((s) => s.customerId === customerId).map((s) => ({ ...s }));
  }
  async leer(id: string) {
    this.llamadas.push(`leer:${id}`);
    const s = this.subs.get(id);
    if (!s) throw new Error("no existe");
    return { ...s };
  }
  async cancelar(id: string, inmediata: boolean) {
    this.llamadas.push(`cancelar:${id}:${inmediata ? "ahora" : "al-final"}`);
    if (this.fallaCancelar.has(id)) throw new Error("Flow rechazó la cancelación");
    const s = this.subs.get(id);
    if (!s) throw new Error("no existe");
    if (inmediata) s.status = 4; else s.cancel_at_period_end = 1;
    return { ...s, subscription_end: inmediata ? null : s.period_end };
  }
  async crear(p: { planId: string; customerId: string; urlCallback: string }) {
    this.llamadas.push(`crear:${p.customerId}`);
    if (this.fallaCrear) throw new Error("timeout");
    const id = `sus_nueva${++this.n}`;
    this.agregar(id, p.customerId);
    return { ...this.subs.get(id)! };
  }
  cobrando(customerId: string): string[] {
    return Array.from(this.subs.values()).filter((s) => s.customerId === customerId && estaViva(s) && Number(s.cancel_at_period_end) !== 1).map((s) => s.subscriptionId);
  }
}

const ALTA = { planId: "franco_plan10_mensual", urlCallback: "https://x/api/subscriptions/payment-callback" };

export async function runSuscripcionTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER SUSCRIPCION (la auditoría de promesas, parte 2: la suscripción · 0 tokens) ───");

  // ── 1 · nunca dos suscripciones vivas ─────────────────────────────────────
  {
    // a · en la gracia, con la vieja viva (morosa): cambia la tarjeta → la vieja se cancela ANTES de crear, queda una.
    const f = new FlowFalso();
    f.agregar("sus_vieja", "cus_1");
    const r = await abrirPlanUnico(f, { customerId: "cus_1", subscriptionId: "sus_vieja", ...ALTA });
    const iCancel = f.llamadas.indexOf("cancelar:sus_vieja:ahora"), iCrear = f.llamadas.findIndex((l) => l.startsWith("crear:"));
    if (!r.ok || f.cobrando("cus_1").length !== 1 || f.cobrando("cus_1")[0] === "sus_vieja") F(`1 · cambiar la tarjeta deja ${f.cobrando("cus_1").length} suscripción(es) cobrando (${f.cobrando("cus_1").join(", ")}): DOS SUSCRIPCIONES VIVAS`);
    if (iCancel < 0 || iCrear < 0 || iCancel > iCrear) F("1 · la vieja no se cancela en Flow ANTES de abrir la nueva");

    // b · la cancelada al fin del período (status 1, programada) también se cierra ahora: nunca dos vivas en Flow.
    const g = new FlowFalso();
    g.agregar("sus_cancelada", "cus_2", { cancel_at_period_end: 1 });
    await abrirPlanUnico(g, { customerId: "cus_2", subscriptionId: "sus_cancelada", ...ALTA });
    if (Number(g.subs.get("sus_cancelada")?.status) !== 4) F("1 · «Volver al Plan Franco» deja viva en Flow la suscripción cancelada al fin del período");

    // c · si la vieja no se puede cancelar, NO se abre la nueva.
    const h = new FlowFalso();
    h.agregar("sus_terca", "cus_3");
    h.fallaCancelar.add("sus_terca");
    const rh = await abrirPlanUnico(h, { customerId: "cus_3", subscriptionId: "sus_terca", ...ALTA });
    if (rh.ok || h.llamadas.some((l) => l.startsWith("crear:")) || h.cobrando("cus_3").length !== 1) F("1 · con la anterior sin cancelar se abre otra: DOS SUSCRIPCIONES VIVAS");
    if (!rh.ok && rh.motivo !== "no-se-cerro-la-anterior") F(`1 · la anterior sin cancelar no se informa como tal (${!rh.ok ? rh.motivo : "ok"})`);

    // d · sin la lista del cliente no se sabe si queda otra viva: no se abre.
    const k = new FlowFalso();
    k.fallaLista = true;
    const rk = await abrirPlanUnico(k, { customerId: "cus_4", subscriptionId: null, ...ALTA });
    if (rk.ok || k.llamadas.some((l) => l.startsWith("crear:"))) F("1 · sin poder leer las suscripciones del cliente se abre una nueva");

    // e · una huérfana (viva en Flow, sin subscription_id guardado) también se cierra.
    const m = new FlowFalso();
    m.agregar("sus_huerfana", "cus_5");
    await abrirPlanUnico(m, { customerId: "cus_5", subscriptionId: null, ...ALTA });
    if (m.cobrando("cus_5").length !== 1 || m.cobrando("cus_5")[0] === "sus_huerfana") F("1 · una suscripción viva sin subscription_id guardado sigue cobrando junto a la nueva");

    // f · «Contratar el plan» no abre otra si ya hay una (salvo cancelada); en la gracia solo cambiar la tarjeta.
    if (!puedeAbrirPlan("active", false) || !puedeAbrirPlan("active", true)) F("1 · con el plan activo se puede abrir otra suscripción");
    if (!puedeAbrirPlan("past_due", false)) F("1 · en la gracia «Contratar el plan» abre otra suscripción");
    if (puedeAbrirPlan("past_due", true)) F("1 · en la gracia no se puede cambiar la tarjeta");
    if (puedeAbrirPlan("cancelled", false) || puedeAbrirPlan("none", false)) F("1 · sin plan vivo no se puede contratar");

    // g · el cableado: create usa la regla; register-callback crea SOLO por abrirPlanUnico.
    const create = sc("src/app/api/subscriptions/create/route.ts");
    if (!/const bloqueo = puedeAbrirPlan\(estado, cambiarTarjeta\);\s*if \(bloqueo\) return NextResponse\.json\(\{ error: bloqueo\.error, codigo: bloqueo\.codigo \}, \{ status: 409 \}\);/.test(create)) F("1 · subscriptions/create no aplica la regla de una sola suscripción");
    const reg = sc("src/app/api/subscriptions/register-callback/route.ts");
    if (/subscription\/create/.test(reg)) F("1 · register-callback crea la suscripción por fuera de abrirPlanUnico");
    const iAlta = reg.search(/const alta = await abrirPlanUnico\(puertaFlow, \{/), iGuarda = reg.search(/subscription_id: subData\.subscriptionId,/), iNoOk = reg.search(/if \(!alta\.ok\) \{/);
    if (iAlta < 0 || iNoOk < iAlta || iGuarda < iNoOk) F("1 · register-callback no abre por abrirPlanUnico o guarda la suscripción sin mirar si se abrió");
    if (!/subscriptionId: \(userCredit\.subscription_id as string \| null\) \?\? null,/.test(reg)) F("1 · register-callback no le pasa la suscripción guardada al cierre");

    // h · «Ver cómo pagar», «Actualiza tu método de pago» y el correo del rechazo cambian la tarjeta, no van a /pricing.
    const cuenta = sc("src/app/cuenta/page.tsx");
    if (!/\{pendiente && <EnlaceCarga href=\{RUTA_CAMBIAR_TARJETA\}[^>]*>\{C\.plan\.actualizarPago\}<\/EnlaceCarga>\}/.test(cuenta)) F("1 · «Ver cómo pagar» no lleva a cambiar la tarjeta");
    const perfil = sc("src/app/perfil/page.tsx");
    const ramaGracia = perfil.slice(perfil.indexOf("} else if (isPastDueGrace) {"), perfil.indexOf("} else if (isCancelledActive) {"));
    if (!/planCtaHref = RUTA_CAMBIAR_TARJETA;/.test(ramaGracia)) F("1 · «Actualiza tu método de pago» no lleva a cambiar la tarjeta");
    for (const primerCobro of [false, true]) {
      const html = correoPagoFallido({ nombre: "Ana", graciaHasta: "2026-11-12T12:00:00Z", primerCobro, sitio: "https://s" }).html;
      if (!html.includes(`https://s${RUTA_CAMBIAR_TARJETA}`) || html.includes("https://s/pricing")) F(`1 · el correo del cobro rechazado${primerCobro ? " (primer cobro)" : ""} no lleva a cambiar la tarjeta`);
    }
    if (!/body: JSON\.stringify\(\{ product: PRODUCTO_PLAN, cambiarTarjeta: true \}\)/.test(sc("src/app/cuenta/tarjeta/registrar-tarjeta.tsx"))) F("1 · /cuenta/tarjeta no pide el cambio de tarjeta");
    if (!/const conPendiente = fila\?\.subscription_status === "past_due";/.test(sc("src/app/cuenta/tarjeta/page.tsx")) || !/No quedan dos planes cobrando/.test(CAMBIAR_TARJETA_COPY.cuerpo("Plan Franco", "$39.990"))) F("1 · /cuenta/tarjeta no es para el plan en la gracia o no dice que no quedan dos");
    const compraCliente = sc("src/app/checkout/compra-cliente.tsx");
    if (!/\) : pendiente \? \(\s*<div data-compra="plan-pendiente">[\s\S]*?href=\{RUTA_CAMBIAR_TARJETA\}/.test(compraCliente)) F("1 · /checkout deja contratar el plan con un cobro pendiente");
  }

  // ── 2 · «confirmado» solo cuando Flow cobró ───────────────────────────────
  {
    const reg = sc("src/app/api/subscriptions/register-callback/route.ts");
    if (/sendPaymentConfirmationEmail/.test(reg)) F("2 · el alta manda «Pago confirmado» antes del cobro: «CONFIRMADO» ANTES DEL COBRO");
    if (!/await sendTarjetaRegistradaEmail\(flowUser\.email,/.test(reg)) F("2 · el alta no manda «Tarjeta registrada»");
    if (!/return volver\("registrada", \{ sub: subData\.subscriptionId, val: String\(match\.product\.amount\) \}\);/.test(reg)) F("2 · la vuelta del alta no dice «registrada»");
    if (!/subscription_ends_at: null,/.test(reg) || !/await setPlanFields\(userCredit\.user_id, match\.product, \{ finDePeriodo: null \}\);/.test(reg)) F("2 · el alta deja un período pagado antes del primer cobro");

    const correo = correoTarjetaRegistrada({ nombre: "Ana", plan: "Plan Franco", sitio: "https://s" });
    if (!correo.subject.startsWith("Tarjeta registrada") || !correo.html.includes("Tu plan se activa con el primer cobro, en las próximas horas.")) F("2 · el correo del alta no dice «Tarjeta registrada… se activa con el primer cobro»");
    if (/^Pago confirmado/.test(correo.subject)) F("2 · el correo del alta se titula «Pago confirmado»");
    if (SUSCRIPCION_COPY.tarjetaRegistrada !== "Tarjeta registrada. Tu plan se activa con el primer cobro, en las próximas horas.") F("2 · el copy aprobado de la tarjeta registrada cambió");

    // La pantalla de vuelta: «Tarjeta registrada.», nunca «Pago confirmado».
    if (estadoRetornoSuscripcion("registrada") !== "registrada" || estadoRetornoSuscripcion("success") !== "registrada") F("2 · la vuelta del alta no se lee como tarjeta registrada");
    if (RETORNO_SUSCRIPCION.registrada.titulo !== "Tarjeta registrada." || !RETORNO_SUSCRIPCION.registrada.cuerpo.startsWith("Tu plan se activa con el primer cobro, en las próximas horas.")) F("2 · la pantalla del alta no dice «Tarjeta registrada. Tu plan se activa con el primer cobro…»");
    const ret = sc("src/app/payments/return/page.tsx");
    const ramaSub = ret.slice(ret.indexOf('if (type === "subscription") {'), ret.indexOf("const checkStatus = async"));
    if (!/setPaymentStatus\("suscripcion"\);/.test(ramaSub) || /setPaymentStatus\("paid"\)/.test(ramaSub)) F("2 · la vuelta de la suscripción se muestra como pago confirmado");
    if (!/\{paymentStatus === "suscripcion" && estadoSuscripcion && \(/.test(ret)) F("2 · la vuelta de la suscripción no tiene su pantalla");
    if (/type === "subscription"\s*\?/.test(ret.slice(ret.indexOf('data-retorno-estado="pagado"')))) F("2 · «Pago confirmado» sigue diciendo «Tu suscripción … está activa»");

    // «Pago confirmado» con el PRIMER cobro de la suscripción, una vez.
    const pc = sc("src/lib/subscriptions/process-charge.ts");
    const bloque = pc.slice(pc.indexOf("if (granted && match && userEmail) {"));
    if (!/\.like\("payment_data->>commerceOrder", `\$\{subId\}_%`\);\s*if \(!ePrevios && previos === 0\) \{\s*await sendPaymentConfirmationEmail\(/.test(bloque)) F("2 · el primer cobro de la suscripción no manda «Pago confirmado» (o lo manda en cada renovación)");
    if (!/idempotencyKey: `pago-confirmado-\$\{commerceOrderRow\}`/.test(bloque)) F("2 · «Pago confirmado» del primer cobro sin llave de idempotencia");

    // Esperando el primer cobro.
    if (!esperaPrimerCobro({ subscription_status: "active", subscription_ends_at: null }) || esperaPrimerCobro({ subscription_status: "active", subscription_ends_at: "2026-12-09T03:00:00Z" })
      || !esperaPrimerCobro({ subscription_status: "past_due", subscription_ends_at: null }) || esperaPrimerCobro({ subscription_status: "cancelled", subscription_ends_at: null })) F("2 · «esperando el primer cobro» mal definido");
    const cuenta = sc("src/app/cuenta/page.tsx");
    if (!/\{activo && esperando && <p[^>]*>\{C\.plan\.esperando\}<\/p>\}/.test(cuenta) || !/const renueva = activo && !esperando/.test(cuenta)) F("2 · /cuenta no dice «Tarjeta registrada…» mientras espera el primer cobro (o le pone fecha de renovación)");

    // Si la tarjeta rechaza el primer cobro: lo dice sin haber dicho «confirmado».
    const cb = sc("src/app/api/subscriptions/payment-callback/route.ts");
    if (!/const primerCobro = esperaPrimerCobro\(antes\);/.test(cb) || !/sendPaymentFailedEmail\(flowUser\.email, nombre, graceEndsAt, \{ userId, primerCobro \}\)/.test(cb)) F("2 · el rechazo del primer cobro no se distingue");
    const primer = correoPagoFallido({ nombre: "Ana", graciaHasta: "2026-11-12T12:00:00Z", primerCobro: true });
    if (!/no se activó/.test(primer.html) || /tu suscripción/i.test(primer.html)) F("2 · el correo del primer cobro rechazado no dice que el plan no se activó");
  }

  // ── 3 · la gracia vencida cancela en Flow; cancelar y volver ──────────────
  {
    // a · gracia vencida con la suscripción guardada: se cancela ahora en Flow.
    const f = new FlowFalso();
    f.agregar("sus_morosa", "cus_6");
    const r = await cerrarTodo(f, { customerId: "cus_6", subscriptionId: "sus_morosa" });
    if (!r.ok || Number(f.subs.get("sus_morosa")?.status) !== 4) F("3 · la gracia vencida no cancela en Flow: GRACIA SIN CANCELAR EN FLOW");
    // b · sin subscription_id, por el cliente.
    const g = new FlowFalso();
    g.agregar("sus_sin_id", "cus_7");
    const rg = await cerrarTodo(g, { customerId: "cus_7", subscriptionId: null });
    if (!rg.ok || Number(g.subs.get("sus_sin_id")?.status) !== 4) F("3 · sin subscription_id la gracia vencida no cancela en Flow");
    // c · sin la lista y sin id: no se da por cerrada (el cron reintenta).
    const h = new FlowFalso();
    h.fallaLista = true;
    if ((await cerrarTodo(h, { customerId: "cus_8", subscriptionId: null })).ok) F("3 · sin poder leer Flow la gracia se da por cancelada");
    // d · Flow rechaza la cancelación: no se da por cerrada.
    const k = new FlowFalso();
    k.agregar("sus_terca", "cus_9");
    k.fallaCancelar.add("sus_terca");
    if ((await cerrarTodo(k, { customerId: "cus_9", subscriptionId: "sus_terca" })).ok) F("3 · con Flow rechazando la cancelación la gracia se da por cerrada");
    // e · el cron cablea el cierre ANTES de marcar cancelado, y si no cierra, sigue de largo.
    const eg = sc("src/app/api/cron/expire-grace/route.ts");
    const loop = eg.slice(eg.indexOf("for (const row of pastDueRows ?? []) {"), eg.indexOf("for (const row of cancelledRows ?? []) {"));
    // El bloque del «no cerró» va desde su `if` hasta lo que sigue (`const esManual`) y TERMINA en `continue;`: un regex
    // perezoso hasta «continue;» calzaba con el `continue` del error de update, más abajo.
    const iCierre = loop.search(/const cierre = await cerrarTodo\(puertaFlow, \{/), iNoOk = loop.indexOf("if (!cierre.ok) {"), iSigue = loop.indexOf("const esManual"), iMarca = loop.search(/subscription_status: "cancelled",/);
    const noCerro = iNoOk >= 0 && iSigue > iNoOk ? loop.slice(iNoOk, iSigue) : "";
    if (iCierre < 0 || iNoOk < iCierre || !/continue;\s*\}\s*$/.test(noCerro) || iMarca < iSigue) F("3 · expire-grace marca cancelado sin cancelar en Flow: GRACIA SIN CANCELAR EN FLOW");
    if (!/\.select\("user_id, unlimited_source, subscription_id, flow_customer_id"\)/.test(eg)) F("3 · expire-grace no lee la suscripción ni el cliente de Flow");

    // f · «Cancelar el plan»: la pagada al fin del período; en la gracia, ahora; sin id, por el cliente; otra viva, ahora.
    const c1 = new FlowFalso();
    c1.agregar("sus_pagada", "cus_10");
    const rc1 = await cancelarPlan(c1, { customerId: "cus_10", subscriptionId: "sus_pagada", alFinDelPeriodo: true });
    if (Number(c1.subs.get("sus_pagada")?.cancel_at_period_end) !== 1 || Number(c1.subs.get("sus_pagada")?.status) === 4 || !rc1.finPeriodo) F("3 · cancelar la pagada no la deja hasta el fin del período");
    const c2 = new FlowFalso();
    c2.agregar("sus_gracia", "cus_11");
    await cancelarPlan(c2, { customerId: "cus_11", subscriptionId: "sus_gracia", alFinDelPeriodo: false });
    if (Number(c2.subs.get("sus_gracia")?.status) !== 4) F("3 · cancelar en la gracia no cancela ahora en Flow");
    const c3 = new FlowFalso();
    c3.agregar("sus_unica", "cus_12");
    const rc3 = await cancelarPlan(c3, { customerId: "cus_12", subscriptionId: null, alFinDelPeriodo: true });
    if (!rc3.ok || c3.cobrando("cus_12").length !== 0) F("3 · «Cancelas cuando quieras» no funciona sin subscription_id");
    // …y la que encontró por el cliente es la del plan pagado: queda hasta el fin de su período, no se corta ahora.
    if (Number(c3.subs.get("sus_unica")?.cancel_at_period_end) !== 1 || Number(c3.subs.get("sus_unica")?.status) === 4) F("3 · sin subscription_id, la del plan pagado se corta ahora en vez de al fin del período");
    const c4 = new FlowFalso();
    c4.agregar("sus_plan", "cus_13");
    c4.agregar("sus_extra", "cus_13");
    await cancelarPlan(c4, { customerId: "cus_13", subscriptionId: "sus_plan", alFinDelPeriodo: true });
    if (Number(c4.subs.get("sus_extra")?.status) !== 4) F("3 · cancelar deja viva otra suscripción del cliente");

    const cancel = sc("src/app/api/account/cancel-subscription/route.ts");
    if (!/const alFinDelPeriodo = status === "active" && !esperaPrimerCobro\(credits\);/.test(cancel) || !/const cierre = await cancelarPlan\(puertaFlow, \{ customerId, subscriptionId, alFinDelPeriodo \}\);/.test(cancel)) F("3 · cancel-subscription no cancela ahora en la gracia o no busca por el cliente");
    if (!/if \(subscriptionId \|\| customerId\) \{/.test(cancel)) F("3 · cancel-subscription solo cancela en Flow con subscription_id");
    const iNoOkC = cancel.search(/if \(!cierre\.ok\) \{[\s\S]*?status: 502 \}/), iMarcaC = cancel.search(/subscription_status: "cancelled",/);
    if (iNoOkC < 0 || iMarcaC < iNoOkC) F("3 · cancel-subscription marca cancelado sin que Flow lo confirme");

    const cuenta = sc("src/app/cuenta/page.tsx");
    if (!/\{\(activo \|\| pendiente\) && <CancelSubscriptionButton ahora=\{pendiente \|\| esperando\} \/>\}/.test(cuenta)) F("3 · «Cancelar el plan» no aparece en la gracia");
    if (!/\{cancelado && <EnlaceCarga href=\{urlCompra\(\{ product: PRODUCTO_PLAN \}\)\}/.test(cuenta) || !/\{cancelado && <p[^>]*>\{C\.plan\.volverNota\}<\/p>\}/.test(cuenta)) F("3 · «Volver al Plan Franco» no dice que se abre un plan nuevo");
    if (SUSCRIPCION_COPY.planNuevo !== "Se abre un plan nuevo y se cobra hoy.") F("3 · el copy aprobado de volver al plan cambió");
    if (!/\{props\.planCancelado && !product\.unico && \(\s*<p[^>]*>\{SUSCRIPCION_COPY\.planNuevo\}<\/p>/.test(sc("src/app/checkout/compra-cliente.tsx"))) F("3 · /checkout no avisa que volver abre un plan nuevo");
  }

  // ── 4 · la fecha de Flow y el tope de 90 segundos ─────────────────────────
  {
    // La medianoche de Chile no puede caer el día anterior (en verano UTC−3 y en invierno UTC−4).
    for (const [flow, esperado] of [["2026-12-09 00:00:00", "9 de diciembre de 2026"], ["2026-07-09 00:00:00", "9 de julio de 2026"]] as const) {
      const leido = fechaCortaCL(fechaFlowAIso(flow), { month: "long" });
      if (leido !== esperado) F(`4 · la fecha de Flow «${flow}» se lee «${leido}» (esperado «${esperado}»)`);
    }
    if (fechaFlowAIso("basura") !== null) F("4 · una fecha de Flow que no parsea no da null");
    const ren = fechaDeRenovacion({ subscriptionId: "s", next_invoice_date: "2026-12-09 00:00:00", period_end: "2026-12-01 00:00:00" });
    if (fechaCortaCL(ren, { month: "long" }) !== "9 de diciembre de 2026") F("4 · «Se renueva el …» no usa la fecha del siguiente cobro de Flow");
    const cuenta = sc("src/app/cuenta/page.tsx");
    if (!/\(subId \? fechaDeRenovacion\(await leerConTope\(subId\)\) : null\) \?\? finDelPeriodo/.test(cuenta) || !/\{renueva && <p[^>]*>\{C\.plan\.renueva\(fecha\(renueva\)\)\}<\/p>\}/.test(cuenta)) F("4 · /cuenta no dice la fecha de renovación de Flow");
    const pc = sc("src/lib/subscriptions/process-charge.ts");
    if (!/const deFlow = fechaDeRenovacion\(await puertaFlow\.leer\(subId\)\.catch\(\(\) => null\)\);\s*await refreshSubscriptionEndsAt\(userId, match\.product, deFlow &&/.test(pc)) F("4 · el cobro no guarda la fecha de Flow");

    if (CONFIRMANDO_TOPE_MS !== 90_000) F("4 · el tope de «Confirmando tu pago…» no es 90 segundos");
    const ret = sc("src/app/payments/return/page.tsx");
    if (!/window\.setTimeout\(\(\) => setDemora\(true\), CONFIRMANDO_TOPE_MS\)/.test(ret)) F("4 · «Confirmando tu pago…» no tiene tope");
    if (!/&& !redirecting && !demora && \(\s*<div>\s*\{girando\}/.test(ret) || !/&& !redirecting && demora && \(\s*<div data-retorno-estado="demora">[\s\S]*?\{DEMORA_PAGO\.titulo\}[\s\S]*?href=\{tras\.href\}/.test(ret)) F("4 · a los 90 segundos la pantalla no dice qué pasa ni ofrece volver");
    if (!DEMORA_PAGO.volver) F("4 · el tope no ofrece volver");
  }

  // ── 5 · «No se hizo ningún cargo» solo comprobado ─────────────────────────
  {
    const ret = sc("src/app/payments/return/page.tsx");
    if (!/\} catch \{\s*setPaymentStatus\("sin_confirmar"\);\s*\}/.test(ret)) F("5 · la consulta del pago que falla dice «No se hizo ningún cargo»");
    const errores = ret.match(/setPaymentStatus\("error"\)/g) ?? [];
    if (errores.length !== 1 || !/\} else if \(estado === "error"\) \{\s*setPaymentStatus\("error"\);/.test(ret)) F("5 · «El pago no pasó» se dice sin el rechazo comprobado de Flow");
    if (!/\{paymentStatus === "sin_confirmar" && \(\s*<div data-retorno-estado="sin-confirmar">[\s\S]*?\{PAGO_SIN_CONFIRMAR\.titulo\}/.test(ret)) F("5 · la consulta fallida no dice «No pudimos confirmar el pago»");
    if (PAGO_SIN_CONFIRMAR.titulo !== "No pudimos confirmar el pago." || PAGO_SIN_CONFIRMAR.cuerpo !== "Si se cobró, te avisamos por correo.") F("5 · el copy aprobado de la consulta fallida cambió");
    if (/ningún cargo/.test(PAGO_SIN_CONFIRMAR.cuerpo + DEMORA_PAGO.cuerpo + RETORNO_SUSCRIPCION.sinConfirmar.cuerpo)) F("5 · lo no comprobado dice «ningún cargo»");
    // La suscripción: solo lo comprobado dice «ningún cargo»; un alta pedida y sin confirmar, no.
    if (estadoRetornoSuscripcion("sin-confirmar") !== "sinConfirmar" || estadoRetornoSuscripcion("cualquier-cosa") !== "sinConfirmar") F("5 · un estado desconocido de la vuelta se lee como comprobado");
    const reg = sc("src/app/api/subscriptions/register-callback/route.ts");
    if (!/return volver\(fase === "alta-guardada" \? "registrada" : fase === "alta-pedida" \? "sin-confirmar" : "sin-plan"\);/.test(reg)) F("5 · un error con el alta pedida dice «No se hizo ningún cargo»");
    if (!/return volver\(alta\.motivo === "sin-confirmar" \? "sin-confirmar" : "no-abierto"\);/.test(reg)) F("5 · un alta sin confirmar de Flow dice «No se hizo ningún cargo»");
  }

  // ── 6 · eliminar la cuenta ────────────────────────────────────────────────
  {
    const del = sc("src/app/api/account/request-deletion/route.ts");
    if (!/const cierre = await cerrarTodo\(puertaFlow, \{/.test(del)) F("6 · pedir la eliminación no cancela la suscripción en Flow");
    if (!/\.upsert\(\{ user_id: user\.id, semanal_baja_at: ahora, inmediato_baja_at: ahora \}, \{ onConflict: "user_id" \}\)/.test(del) || !/app_metadata: \{ \[MARCA_ELIMINACION\]: ahora \}/.test(del)) F("6 · pedir la eliminación no detiene los correos");
    if (!/\} catch \(error\) \{[\s\S]*?operacion: "aviso-interno"[\s\S]*?status: 500 \}\);\s*\}/.test(del)) F("6 · el aviso interno que no sale no corta la solicitud");
    const email = sc("src/lib/email.ts");
    const interno = email.slice(email.indexOf("export async function sendAccountDeletionInternalEmail("), email.indexOf("export async function sendAccountDeletionUserEmail("));
    if (!/const \{ data, error \} = await enviarCorreo\("eliminacion_interna", null,/.test(interno) || !/if \(error \|\| !data\) throw new Error\(/.test(interno)) F("6 · el aviso interno a hola@ puede fallar en silencio");
    const envio = email.slice(email.indexOf("async function enviarCorreo("), email.indexOf("const SITE_URL"));
    if (!/if \(TIPOS_QUE_FRENA_LA_ELIMINACION\.has\(tipo\) && userId\) \{[\s\S]*?if \(eliminacionPedida\([\s\S]*?return \{ data: null, error: null \};/.test(envio)) F("6 · el punto de envío no frena los correos de una cuenta que pidió eliminarse");
    for (const t of ["tarjeta_registrada", "premio_referido", "informe_listo", "checkout_abandonado"] as const) if (!TIPOS_QUE_FRENA_LA_ELIMINACION.has(t)) F(`6 · «${t}» le sigue llegando a quien pidió eliminar su cuenta`);
    for (const t of ["boleta", "pago_confirmado", "eliminacion_usuario", "eliminacion_interna"] as const) if (TIPOS_QUE_FRENA_LA_ELIMINACION.has(t)) F(`6 · «${t}» (transaccional) se frena al pedir la eliminación`);
    if (!eliminacionPedida({ [MARCA_ELIMINACION]: "2026-11-05T12:00:00Z" }) || eliminacionPedida({}) || eliminacionPedida(null)) F("6 · la marca de eliminación mal leída");
  }

  if (fallas.length) {
    console.log(`  ✗ SUSCRIPCION · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — nunca dos suscripciones vivas (cambiar la tarjeta cierra la anterior antes de abrir); «Tarjeta registrada» al alta y «Pago confirmado» con el primer cobro; la gracia vencida cancela en Flow; cancelar en la gracia y sin subscription_id; volver dice que abre un plan nuevo; la fecha de Flow y el tope de 90 s; «ningún cargo» solo comprobado; la eliminación cancela, detiene los correos y no falla en silencio");
  }
  return { hard: fallas.length };
}

// ── ACTA DE MUTACIONES (05-nov-2026) ─────────────────────────────────────────────
// 61/61 en rojo, restauradas byte a byte (sha256; scratchpad/mutar.js). Dos predicados se corrigieron ANTES de mutar, al
// leerlos contra su mutación: el `continue` de expire-grace se buscaba con un regex perezoso que calzaba con el `continue`
// del error de update, más abajo (ahora el bloque del «no cerró» va de su `if` a `const esManual` y tiene que terminar en
// `continue`); y la cancelación sin subscription_id solo miraba que se cancelara, no que la del plan pagado quedara hasta
// el fin del período (la mutación que borra ese reconocimiento quedaba verde).
//   1 · abrirPlanUnico sin el corte del cierre · sin cerrar las vivas · todo al fin del período · sin exigir la lectura ·
//       sin usar la lista del cliente · en la gracia se puede contratar · create sin la regla · register-callback
//       creando por fuera · guardando sin mirar el alta · sin la suscripción guardada · «Ver cómo pagar», /perfil y el
//       correo a /pricing · /cuenta/tarjeta sin cambiarTarjeta · /checkout dejando contratar en la gracia.
//   2 · el alta con «Pago confirmado» · la vuelta sin «registrada» · el alta con período pagado (dos) · el correo y la
//       pantalla del alta como «Pago confirmado» · success sin leer · la vuelta como pagada · «Pago confirmado» en cada
//       renovación · sin llave · esperaPrimerCobro sin el período · /cuenta renovando mientras espera · el rechazo del
//       primer cobro sin distinguir · su correo hablando de «tu suscripción».
//   3 · expire-grace sin cancelar en Flow · sin el continue · cerrarTodo sin exigir lectura · sin leer la suscripción ·
//       cancelar siempre al fin del período · sin id la del plan sin reconocer · cancel solo con subscription_id · cancel
//       marcando sin confirmar · otra viva al fin del período · cancelar fuera de la gracia · volver sin la nota · /checkout
//       sin avisar.
//   4 · la fecha de Flow como UTC · la renovación con el fin del período · /cuenta con la guardada · el cobro sin la fecha
//       de Flow · tope de 900 s · sin reloj · el tope sin decir qué pasa.
//   5 · la consulta fallida como «error» · sin la pantalla sin confirmar · el alta sin confirmar con «ningún cargo» · lo
//       desconocido como comprobado · el error con el alta pedida y el alta sin confirmar de Flow como «ningún cargo».
//   6 · eliminar sin cancelar en Flow · sin las bajas · el aviso interno que no corta · que no lanza · el envío sin mirar la
//       marca · la tarjeta registrada fuera de la lista · la marca mal leída.

if (require.main === module) {
  runSuscripcionTier().then(({ hard }) => process.exit(hard ? 1 : 0));
}
