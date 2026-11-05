// ============================================================================
// GOLDEN · PROMESAS-TEXTOS (05-nov-2026) — catch-test
// ============================================================================
//   Goal de Fabrizio, 05-nov-2026: «Auditoría de promesas, parte 3: lo que decimos. Cada texto dice lo que el código hace.
//   […] Gates en rojo con cada texto contra su regla.»
//
//   1 · EL REGALO: el cupo del día es 500; un lote en fallo se reintenta solo (el cron) y se carga una sola vez; quien topa ve
//       por qué —en pantalla y bajo «Sin análisis»— con «Ver planes».
//   2 · EL REFERIDO: «cuando tu invitado hace su primer análisis, tú recibes uno», con el tope de 5 y los 60 días, en todos
//       los textos; el invitado recibe el regalo de cuenta nueva; el premio sale del primer análisis, no del «¿Cuándo
//       piensas comprar?».
//   3 · LOS AVISOS: lo que de verdad llega (cada lunes; cada día con «Quiero comprar ya»); «hoy» solo si fue hoy; el
//       semanal con la fecha real en que Franco vio cada depto, sin «hace unas horas».
//   4 · CIFRAS Y TEXTOS FIJOS: el ahorro exacto del pack, los comparables en vivo, el FAQ con lo que existe, «Abajo, deptos
//       parecidos» solo si los hay, «dentro de la hora», UNA cifra de tiempo y /terms con lo que incluye y sus fuentes.
//   5 · LOS DATOS: el FAQ igual a /privacy, «en este navegador», el id del Lead que Meta no puede cruzar con el correo, y la
//       vista previa con el mismo puntaje que el informe.
//   6 · DESPUÉS DE PAGAR DESDE UN DEPTO: si no se pudo analizar, lo dice y deja el saldo a la vista; la renta corta analiza
//       sola a la vuelta; la tarjeta «no da» conserva la publicación y «Analizar igual»; «no usas un análisis» al comprar.
//   7 · LAS FECHAS: «vence hoy a las 21:04», sin «Hoy,» en el ticket, «Te quedan N» sin restar lo no cobrado, el
//       recordatorio sin informe al mapa y el carrito abandonado a la compra a medias.
//   8 · CLAUDE.md al día: el plan da 20, la boleta emite en producción, el informe no se bloquea por nivel.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. 0 tokens; no lee ni escribe la base (las dos
// funciones de servidor corren contra una base de juguete).
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/promesas-textos-catch-test.ts
// ============================================================================
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createHash, createHmac } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sinComentarios } from "./lectura-paginada-catch-test";
import { DIAS_TOPE_DISPOSITIVO, FUENTE_REGALO_ALTA, DIAS_VIGENCIA_REGALO_ALTA, SIN_REGALO_COPY, TOPE_REGALOS_DIA, VER_PLANES, motivoSinRegalo } from "../../../src/lib/regalo-alta";
import { reintentarLote } from "../../../src/lib/regalo-alta-servidor";
import { DIAS_VIGENCIA_PREMIO_REFERIDO, REFERIDO_COPY, REGLA_REFERIDO, TOPE_PREMIOS_REFERIDO } from "../../../src/lib/referido";
import { referidoAlPrimerAnalisis } from "../../../src/lib/referido-servidor";
import { PLANES_COPY } from "../../../src/lib/planes";
import { CASA } from "../../../src/app/dashboard/casa-copy";
import { pildoraSaldo } from "../../../src/lib/casa/reglas";
import { AVISO_NUEVOS } from "../../../src/lib/guia/aviso-nuevos";
import { DEL_DIA, diaRelativo } from "../../../src/lib/guia/del-dia";
import { INMEDIATO } from "../../../src/lib/guia/inmediato";
import { DEPTOS_COPY } from "../../../src/lib/deptos/respuesta";
import { PACK_AHORRO_CLP, PACK_ANALISIS, PACK_PRECIO_CLP } from "../../../src/lib/lo-que-sigue/oferta-pack";
import { SINGLE_PRICE, fmtCLP } from "../../../src/lib/pricing";
import { TICKET_PACK, DESPUES_DE_PAGAR, REGISTRO_UN_PASO } from "../../../src/lib/lo-que-sigue/copy";
import { cifraComparables, textoComparables, pisoComparables, TIEMPO_ANALISIS } from "../../../src/lib/stats";
import { faqSecciones } from "../../../src/lib/faq-data";
import { COMPARAR_MAX, COMPARAR_MIN } from "../../../src/lib/lo-que-sigue/comparar-tipos";
import { idLead, normalizarCorreo } from "../../../src/lib/meta/ids";
import { puntajeDe } from "../../../src/lib/analysis/resultados-del-informe";
import { textoFallo, type MotivoFallo } from "../../../src/lib/guia/informe-en-camino";
import { RETORNO, rutaRetomarCompra, urlCompra, vueltaAnalizaSola } from "../../../src/lib/compra/compra";
import { volverAlDepto, TICKET_CON_SALDO } from "../../../src/lib/guia/compra-desde-depto";
import { AVISO_ANALIZAR } from "../../../src/lib/guia/aviso-analizar";
import { fechaVence, textoVence } from "../../../src/lib/guia/semanal";
import { DESTINO_SIN_INFORME, correoRecordatorioPack } from "../../../src/lib/lo-que-sigue/recordatorio";
import { correoCheckoutAbandonado } from "../../../src/lib/email/correos";

// El JSX de los componentes usa el React global; y los componentes importan CSS: en node, un módulo vacío.
(globalThis as { React?: unknown }).React = React;
(require as unknown as { extensions: Record<string, (m: { exports: unknown }) => void> }).extensions[".css"] = (m) => { m.exports = {}; };

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sc = (p: string) => sinComentarios(leer(p));
/** El código sin sus imports: que un identificador se importe no es que se use. */
const sinImports = (s: string) => s.replace(/^import[\s\S]*?from\s+["'][^"']+["'];?$/gm, "");
const usa = (p: string, llamada: string) => sinImports(sc(p)).includes(llamada);
const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&quot;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

/** Todos los .ts/.tsx de src, sin comentarios (lo que se escribe para la persona y el código; nunca la prosa del acta). */
function fuentes(): Array<{ p: string; s: string }> {
  const out: Array<{ p: string; s: string }> = [];
  const andar = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const full = join(dir, n);
      if (statSync(full).isDirectory()) { andar(full); continue; }
      if (/\.(ts|tsx)$/.test(n)) out.push({ p: relative(RAIZ, full).replace(/\\/g, "/"), s: sinComentarios(readFileSync(full, "utf8").replace(/\r\n/g, "\n")) });
    }
  };
  andar(join(RAIZ, "src"));
  return out;
}

// ── Una base de juguete: lo justo para las dos funciones de servidor (nunca toca la base real) ──
type Fila = Record<string, unknown>;
function baseJuguete(tablas: Record<string, Fila[]>, opts: { prohibidas?: string[]; alTocar?: (t: string) => void } = {}): SupabaseClient {
  let siguiente = 1;
  const from = (tabla: string) => {
    if (opts.prohibidas?.includes(tabla)) { opts.alTocar?.(tabla); throw new Error(`juguete: ${tabla} no se toca en esta prueba`); }
    const filtros: Array<(f: Fila) => boolean> = [];
    let op: "select" | "update" | "insert" = "select";
    let datos: Fila = {};
    let conSelect = false, uno = false, contar = false;
    const filas = () => (tablas[tabla] ??= []);
    const correr = () => {
      if (op === "insert") { const f = { id: `g${siguiente++}`, ...datos }; filas().push(f); return { data: uno ? f : [f], error: null }; }
      const m = filas().filter((f) => filtros.every((p) => p(f)));
      if (op === "update") { for (const f of m) Object.assign(f, datos); return { data: conSelect ? m.map((f) => ({ ...f })) : null, error: null }; }
      if (contar) return { data: null, count: m.length, error: null };
      if (uno) return { data: m[0] ?? null, error: null };
      return { data: m, error: null };
    };
    const b: Record<string, unknown> = {
      select: (_c?: string, o?: { count?: string }) => { conSelect = true; if (o?.count) contar = true; return b; },
      update: (d: Fila) => { op = "update"; datos = d; return b; },
      insert: (d: Fila) => { op = "insert"; datos = d; return b; },
      eq: (c: string, v: unknown) => { filtros.push((f) => f[c] === v); return b; },
      // SQL: `x <> v` es NULL (no true) con x NULL, así que la fila se descarta (CLAUDE.md › NULL en filtros de exclusión).
      neq: (c: string, v: unknown) => { filtros.push((f) => f[c] != null && f[c] !== v); return b; },
      is: (c: string, v: unknown) => { filtros.push((f) => (v === null ? f[c] == null : f[c] === v)); return b; },
      or: (expr: string) => {
        const partes = expr.split(",").map((x) => x.split("."));
        filtros.push((f) => partes.some(([c, o, v]) => (o === "is" && v === "null" ? f[c] == null : o === "eq" ? String(f[c]) === v : false)));
        return b;
      },
      order: () => b, limit: () => b,
      single: () => { uno = true; return b; }, maybeSingle: () => { uno = true; return b; },
      then: (res: (x: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve().then(correr).then(res, rej),
    };
    return b;
  };
  return { from } as unknown as SupabaseClient;
}

/** Sin la key de PostHog la captura no sale (posthog-servidor.ts): la prueba no manda eventos. */
async function sinPosthog<T>(f: () => Promise<T>): Promise<T> {
  const k = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  try { return await f(); } finally { if (k !== undefined) process.env.NEXT_PUBLIC_POSTHOG_KEY = k; }
}

const AHORA = new Date("2026-11-05T15:00:00Z"); // 12:00 en Chile (verano, UTC−3)
const HACE = (h: number) => new Date(AHORA.getTime() - h * 3600_000).toISOString();

export async function runPromesasTextosTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER PROMESAS-TEXTOS (cada texto dice lo que el código hace: regalo, referido, avisos, cifras, datos, el pago, las fechas, CLAUDE.md · 0 tokens) ───");

  // ── 1 · EL REGALO ───────────────────────────────────────────────────────────
  if (TOPE_REGALOS_DIA !== 500) F(`1 · el cupo de regalos del día no es 500 (${TOPE_REGALOS_DIA})`);
  if (!SIN_REGALO_COPY.tope_dia.bajada.includes(String(TOPE_REGALOS_DIA))) F("1 · el motivo «tope del día» no dice el cupo de la constante");
  if (!SIN_REGALO_COPY.tope_dispositivo.bajada.includes(String(DIAS_TOPE_DISPOSITIVO))) F("1 · el motivo «tope del dispositivo» no dice los días de la constante");
  const motivos = ["tope_dispositivo", "tope_dia", "existente"] as const;
  for (const m of motivos) {
    if (motivoSinRegalo(m) !== m || motivoSinRegalo("ya", m) !== m) F(`1 · motivoSinRegalo no reconoce «${m}» (decidido o guardado)`);
    if (!SIN_REGALO_COPY[m].titulo || !SIN_REGALO_COPY[m].bajada) F(`1 · el motivo «${m}» no tiene título y bajada`);
  }
  if (new Set(motivos.map((m) => SIN_REGALO_COPY[m].titulo)).size !== 3) F("1 · dos motivos dicen lo mismo: no dicen por qué");
  for (const no of ["otorgar", "fallo", "vieja", null]) if (motivoSinRegalo(no) !== null) F(`1 · «${no}» se dice como un motivo sin regalo (un fallo se reintenta, no se explica)`);
  if (VER_PLANES.texto !== "Ver planes" || VER_PLANES.href !== "/pricing") F("1 · «Ver planes» no lleva a /pricing");
  // El reintento: un lote en «fallo» se carga, una sola vez, con 30 días desde ahora.
  {
    const tablas: Record<string, Fila[]> = { regalos_alta: [{ user_id: "u1", motivo: "fallo", vence_at: null, grant_id: null, decidido_at: HACE(30) }], credit_grants: [] };
    const db = baseJuguete(tablas);
    const r1 = await sinPosthog(() => reintentarLote(db, "u1", { motivo: "fallo", vence_at: null, grant_id: null, decidido_at: HACE(30) }, AHORA));
    const r2 = await sinPosthog(() => reintentarLote(db, "u1", { motivo: "fallo", vence_at: null, grant_id: null, decidido_at: HACE(30) }, AHORA));
    const lotes = tablas.credit_grants.filter((g) => g.user_id === "u1" && g.source === FUENTE_REGALO_ALTA);
    const vence = new Date(AHORA.getTime() + DIAS_VIGENCIA_REGALO_ALTA * 864e5).toISOString();
    if (r1?.estado !== "otorgar") F(`1 · UN LOTE EN FALLO NO SE REINTENTA (${JSON.stringify(r1)})`);
    if (lotes.length !== 1) F(`1 · el reintento cargó ${lotes.length} lote(s), no uno (dos reintentos a la vez cargan dos)`);
    if (r2 !== null) F("1 · el segundo reintento del mismo fallo no se reconoce como ya tomado");
    if (lotes[0] && (lotes[0].expires_at !== vence || lotes[0].amount !== 1)) F("1 · el lote reintentado no vence a los 30 días desde ahora (la persona nunca lo tuvo)");
    const fila = tablas.regalos_alta[0];
    if (fila.motivo !== "otorgado" || fila.grant_id !== lotes[0]?.id) F("1 · la fila del regalo no queda «otorgado» con su lote enlazado");
    // «otorgado» sin lote: dentro de la espera es un lote en curso (no se toca); pasada la espera, se carga.
    const t2: Record<string, Fila[]> = { regalos_alta: [{ user_id: "u2", motivo: "otorgado", grant_id: null }], credit_grants: [] };
    const enCurso = await sinPosthog(() => reintentarLote(baseJuguete(t2), "u2", { motivo: "otorgado", grant_id: null, decidido_at: HACE(0.05) }, AHORA));
    if (enCurso !== null || t2.credit_grants.length) F("1 · un lote en curso (recién decidido) se carga dos veces");
    const pasado = await sinPosthog(() => reintentarLote(baseJuguete(t2), "u2", { motivo: "otorgado", grant_id: null, decidido_at: HACE(2) }, AHORA));
    if (pasado?.estado !== "otorgar" || t2.credit_grants.length !== 1) F("1 · un «otorgado» sin lote pasada la espera no se carga");
  }
  if (!usa("src/app/api/cron/reconciliar-pagos/route.ts", "reintentarRegalosEnFallo(")) F("1 · el cron diario no barre los regalos en fallo: nadie los reintenta");
  // Quien topa, lo ve: en pantalla y bajo «Sin análisis», con «Ver planes».
  {
    const dash = sinImports(sc("src/app/dashboard/page.tsx"));
    const linea = dash.match(/<p[^>]*data-casa="sin-regalo"[\s\S]*?<\/p>/)?.[0] ?? "";
    if (!/SIN_REGALO_COPY\[sinRegalo\]\.titulo/.test(linea) || !/SIN_REGALO_COPY\[sinRegalo\]\.bajada/.test(linea)) F("1 · el dashboard no dice por qué no hay regalo bajo «Sin análisis»");
    if (!/motivoSinRegalo\(regaloAlta\.estado/.test(dash)) F("1 · el motivo del dashboard no sale de lo que decidió el regalo");
    const p = pildoraSaldo({ tipo: "sin" } as Parameters<typeof pildoraSaldo>[0]);
    if (p.texto !== "Sin análisis" || !p.planes || CASA.verPlanes !== "Ver planes") F("1 · «Sin análisis» no lleva «Ver planes»");
    const deptos = sinImports(sc("src/app/deptos/deptos-cliente.tsx"));
    const sr = deptos.match(/function SinRegalo[\s\S]*?\n}\n/)?.[0] ?? "";
    if (!/SIN_REGALO_COPY\[motivo\]/.test(sr) || !/VER_PLANES\.href/.test(sr) || !/<SinRegalo /.test(deptos)) F("1 · «Estás dentro» no dice por qué no hay regalo, o sin «Ver planes»");
    const pin = sinImports(sc("src/app/explorar/tarjeta-pin.tsx"));
    const banda = pin.match(/data-explorar="sin-regalo"[\s\S]*?<\/span>/)?.[0] ?? "";
    if (!/SIN_REGALO_COPY\[recien\.sinRegalo\]/.test(banda) || !/VER_PLANES\.href/.test(banda)) F("1 · Explorar no dice por qué no hay regalo, o sin «Ver planes»");
  }

  // ── 2 · EL REFERIDO ─────────────────────────────────────────────────────────
  if (TOPE_PREMIOS_REFERIDO !== 5 || DIAS_VIGENCIA_PREMIO_REFERIDO !== 60) F(`2 · el tope o la vigencia del referido cambiaron (${TOPE_PREMIOS_REFERIDO}, ${DIAS_VIGENCIA_PREMIO_REFERIDO})`);
  const planGratis = PLANES_COPY.gratis.incluye.find((i) => /invitado/.test(i)) ?? "";
  const textosRegla: Array<[string, string]> = [
    ["la regla", REGLA_REFERIDO], ["Invita a alguien", REFERIDO_COPY.invitaTexto], ["el pie del semanal", REFERIDO_COPY.pieSemanal],
    ["la cuenta sin invitados", REFERIDO_COPY.cuenta(0)], ["la cuenta con 2", REFERIDO_COPY.cuenta(2)], ["el menú de compartir", REFERIDO_COPY.menuCompartirNota],
    ["la casa", CASA.invita.bajada], ["el plan Gratis", planGratis],
  ];
  for (const [donde, t] of textosRegla) {
    if (!/primer análisis/.test(t)) F(`2 · ${donde} no dice que el premio sale del primer análisis del invitado: «${t}»`);
    if (!t.includes(String(TOPE_PREMIOS_REFERIDO)) || !t.includes(`${DIAS_VIGENCIA_PREMIO_REFERIDO} días`)) F(`2 · ${donde} no dice el tope de ${TOPE_PREMIOS_REFERIDO} y los ${DIAS_VIGENCIA_PREMIO_REFERIDO} días: «${t}»`);
    if (/se registr|crea su cuenta|cuándo piensa/i.test(t)) F(`2 · ${donde} todavía dice la regla vieja: «${t}»`);
  }
  for (const [donde, t] of [["el asunto", REFERIDO_COPY.correoAsunto], ["el titular", REFERIDO_COPY.correoTitular], ["lo que quedan", REFERIDO_COPY.correoQuedan(2)]] as const)
    if (!/primer análisis/.test(t)) F(`2 · el correo a quien invitó (${donde}) no dice que fue el primer análisis`);
  if (!/regala un análisis/.test(REFERIDO_COPY.bajada) || !REFERIDO_COPY.textoCompartir(null).includes(REFERIDO_COPY.bajada)) F("2 · la página y el mensaje del invitado no dicen su regalo de cuenta nueva");
  for (const r of ["src/app/api/perfil-busqueda/route.ts", "src/app/api/lo-que-sigue/perfil/route.ts"])
    if (/referido/i.test(sinImports(sc(r))) || /referido/.test(sc(r).match(/^import[\s\S]*?;$/gm)?.join("\n") ?? "")) F(`2 · ${r} todavía dispara el referido al contestar «¿Cuándo piensas comprar?»`);
  if (/referidoAlContestarCuando/.test(sc("src/lib/referido-servidor.ts"))) F("2 · el disparo por «¿Cuándo piensas comprar?» sigue en referido-servidor");
  for (const r of ["src/app/api/analisis/route.ts", "src/app/api/analisis/short-term/route.ts", "src/app/api/lo-que-sigue/guia/analizar/route.ts", "src/app/api/semanal/analizar-str/route.ts", "src/app/api/analisis/claim/route.ts"])
    if (!usa(r, "referidoTrasAnalisis(")) F(`2 · ${r} crea un análisis y no revisa el premio del referido`);
  if (!usa("src/app/dashboard/page.tsx", "referidoAlPrimerAnalisis(")) F("2 · el dashboard no revisa el premio del referido (la red si la ruta falló)");
  // El premio: sin análisis, nada; con uno —también con `pending_payment` NULL—, va a pagar.
  {
    const ref = () => [{ invitado_id: "inv", invitador_id: "otro", estado: "pendiente" }];
    const r0 = await referidoAlPrimerAnalisis(baseJuguete({ referidos: ref(), analisis: [{ id: "x", user_id: "inv", pending_payment: true }] }), { userId: "inv" }, AHORA);
    if (r0.estado !== "sin_analisis") F(`2 · EL INVITADO SIN ANÁLISIS (solo uno esperando el pago) YA DA EL PREMIO (${r0.estado})`);
    let llego = false;
    const r1 = await referidoAlPrimerAnalisis(baseJuguete({ referidos: ref(), analisis: [{ id: "y", user_id: "inv", pending_payment: null }] }, { prohibidas: ["invitaciones"], alTocar: () => { llego = true; } }), { userId: "inv" }, AHORA);
    if (!llego || r1.estado === "sin_analisis") F(`2 · EL PRIMER ANÁLISIS DEL INVITADO NO DA EL PREMIO (${r1.estado}; un análisis con pending_payment NULL no cuenta)`);
  }

  // ── 3 · LOS AVISOS ──────────────────────────────────────────────────────────
  if (!/^Cada lunes te mandamos los nuevos que convienen; si marcas «Quiero comprar ya», cada día que aparezca uno\.$/.test(AVISO_NUEVOS)) F(`3 · el aviso de nuevos no dice lo que de verdad llega: «${AVISO_NUEVOS}»`);
  if (!DEL_DIA.vacio.includes(AVISO_NUEVOS) || !DEPTOS_COPY.correo.tituloSinDeptos.includes(AVISO_NUEVOS)) F("3 · el correo del día vacío o /deptos sin deptos no usan el aviso de nuevos");
  if (diaRelativo(HACE(2), AHORA) !== "hoy") F("3 · lo de hace dos horas no es «hoy»");
  if (diaRelativo(HACE(20), AHORA) !== "ayer") F(`3 · lo de ayer no es «ayer» (${diaRelativo(HACE(20), AHORA)})`);
  const viejo = diaRelativo(HACE(72), AHORA);
  if (!/^el \S+ \d{1,2}$/.test(viejo)) F(`3 · lo de hace tres días no dice su día («el lunes 2»): «${viejo}»`);
  for (const [donde, t] of [
    ["el asunto del día", DEL_DIA.asunto(viejo)], ["el titular del día", DEL_DIA.titular(viejo)], ["la intro del día", DEL_DIA.introN(3, "x", "20", 30, 0, viejo)],
    ["el aviso inmediato (uno)", INMEDIATO.intro(1, "x", "20", 30, viejo)], ["el aviso inmediato (varios)", INMEDIATO.intro(2, "x", "20", 30, viejo)],
  ] as const) if (/\bhoy\b/i.test(t)) F(`3 · ${donde} dice «hoy» de algo de hace tres días: «${t}»`);
  if (!/\bhoy\b/.test(INMEDIATO.intro(1, "x", "20", 30, diaRelativo(HACE(1), AHORA)))) F("3 · el aviso inmediato de algo de hoy ya no dice «hoy»");
  if (!/dia: diaRelativo\(/.test(sinImports(sc("src/lib/guia/del-dia-servidor.ts")))) F("3 · el correo del día no calcula su día con diaRelativo");
  if (!/diaRelativo\(/.test(sinImports(sc("src/lib/guia/inmediato-servidor.ts")))) F("3 · el aviso inmediato no calcula su día con diaRelativo");
  {
    const ci = sinImports(sc("src/lib/email/correo-inmediato.ts"));
    // TODAS las llamadas con su día: una sola sin él vuelve a decir «hoy» por defecto.
    const conDia = (s: string, re: RegExp) => { const l = s.match(re) ?? []; return l.length > 0 && l.every((x) => /\bdia\b/.test(x)); };
    if (!conDia(ci, /INMEDIATO\.intro\([^)]*\)/g)) F("3 · el correo inmediato no le pasa su día a la intro (queda «hoy» siempre)");
    const cs = sinImports(sc("src/lib/email/correo-semanal.ts"));
    if (!conDia(cs, /DEL_DIA\.(?:asunto|titular|introN)\([^)]*\)/g)) F("3 · el correo del día no le pasa su día al asunto, al titular o a la intro");
    const tarjeta = cs.match(/data-marca="visto-publicado"[^`]*/)?.[0] ?? "";
    if (!/SEMANAL\.vistoPublicado\(cuandoSeVio\(d\.vistoAt\)\)/.test(tarjeta)) F("3 · la tarjeta del semanal no dice cuándo Franco vio el depto");
    if (!/vistoAt/.test(sinImports(sc("src/lib/guia/semanal-servidor.ts")))) F("3 · el semanal no le pone a cada depto la fecha en que se vio");
  }
  {
    const b = (n: number) => { const x = DEPTOS_COPY.correo.bajada(n); return `${x.antes}${x.fuerte}${x.despues}`; };
    if (!/dentro de la hora/.test(b(12)) || !/dentro de la hora/.test(b(1))) F("3 · /deptos no dice «dentro de la hora»");
    if (!/^Cada lunes/.test(b(0))) F("3 · /deptos sin deptos promete algo que no es el lunes");
  }

  // ── 4 · CIFRAS Y TEXTOS FIJOS ───────────────────────────────────────────────
  if (PACK_AHORRO_CLP !== PACK_ANALISIS * SINGLE_PRICE - PACK_PRECIO_CLP) F(`4 · el ahorro del pack no es el exacto (${PACK_AHORRO_CLP})`);
  if (!TICKET_PACK.despedidaAhorro(fmtCLP(PACK_AHORRO_CLP)).includes(fmtCLP(PACK_ANALISIS * SINGLE_PRICE - PACK_PRECIO_CLP))) F("4 · el ticket no dice el ahorro exacto");
  if (!/despedidaAhorro\(fmtCLP\(PACK_AHORRO_CLP\)\)/.test(sinImports(sc("src/components/lo-que-sigue/TicketPack.tsx")))) F("4 · el ticket no dice el ahorro de la constante");
  if (cifraComparables(39_950) !== "+39.000" || textoComparables(41_976) !== "más de 41.000") F(`4 · la cifra de comparables no es el piso a miles (${cifraComparables(39_950)}, ${textoComparables(41_976)})`);
  for (const n of [999, 39_950, 41_976, 100_001]) if (pisoComparables(n) > n) F(`4 · la cifra de comparables promete más de lo medido (${n})`);
  for (const r of ["src/app/page.tsx", "src/app/layout.tsx", "src/app/metodologia/page.tsx", "src/app/faq/page.tsx", "src/app/dashboard/page.tsx"])
    if (!usa(r, "comparablesVivos()")) F(`4 · ${r} no lee la cifra de comparables en vivo`);
  // Sin nombrar la tabla: LECTURA-PAGINADA prohíbe su nombre fuera de una llamada, y ya fija que esa lectura sea un conteo.
  // Acá: una sola lectura en el módulo, y con los filtros de la población de las medianas.
  {
    const cv = sc("src/lib/comparables-vivos.ts");
    if ((cv.match(/\.from\(/g) ?? []).length !== 1 || !/\.select\("id", \{ count: "exact", head: true \}\)\s*\.eq\("is_active", true\)\.gt\("precio", 0\)\.gt\("superficie_m2", 0\)/.test(cv)) F("4 · el conteo vivo no cuenta la población de las medianas (activos con precio y superficie), o no por count");
  }
  {
    const s = faqSecciones("más de 1.234");
    const it = (id: string) => s.flatMap((x) => x.items).find((i) => i.id === id)?.a ?? "";
    if (!it("datos").includes("más de 1.234")) F("4 · el FAQ no dice la cifra que le pasa la página");
    if (/sensibilidad|escenarios|panel|ambas|comparad/i.test(it("que-incluye"))) F(`4 · el FAQ de qué incluye promete algo que no existe: «${it("que-incluye")}»`);
    if (!it("comparar-analisis").includes(`de ${COMPARAR_MIN} a ${COMPARAR_MAX}`) || /ganador|mejor de/i.test(it("comparar-analisis"))) F("4 · el FAQ de comparar no dice lo que hace /comparar");
    if (!it("caro-complejo").toLowerCase().startsWith(TIEMPO_ANALISIS.toLowerCase())) F("4 · el FAQ no usa la cifra de tiempo medida");
  }
  {
    const { DespuesDePagar } = require("../../../src/components/lo-que-sigue/DespuesDePagar") as typeof import("../../../src/components/lo-que-sigue/DespuesDePagar");
    const html = (sinParecidos: boolean) => texto(renderToStaticMarkup(createElement(DespuesDePagar, { analysisId: "a1", veredicto: "BUSCAR OTRA", modalidad: "ltr", conSesion: true, sinParecidos })));
    if (/deptos parecidos/.test(html(true))) F("4 · «Abajo, deptos parecidos» se dice sin parecidos abajo");
    if (!html(false).includes(DESPUES_DE_PAGAR.fraseVeredicto["BUSCAR OTRA"])) F("4 · con guía, «Buscar otro» no dice su frase (la prueba de arriba no mide nada)");
    if (!/sinParecidos \/>/.test(sinImports(sc("src/app/payments/return/page.tsx")))) F("4 · la vuelta del pago no avisa que la guía no mostró parecidos");
  }
  {
    const viejos: Array<[RegExp, string]> = [
      [/Te aviso cuando aparezca uno/, "una alerta que no existe"], [/hace unas horas/, "«hace unas horas» sin saber cuándo"], [/[Pp]ublicados hoy/, "«Publicados hoy»"],
      [/en minutos/, "«en minutos»"], [/\$15\.000 menos/, "el ahorro redondeado"], [/\+40\.000|más de 40\.000/, "la cifra de comparables a mano"],
      [/30 segundos|en 2 minutos|menos de un minuto|hasta 60 segundos/, "una cifra de tiempo que no es la medida"],
      [/no compartimos tus datos/i, "«no compartimos tus datos» (Meta y PostHog los reciben)"],
    ];
    const todas = fuentes();
    for (const [re, por] of viejos) {
      const hits = todas.filter((f) => re.test(f.s)).map((f) => f.p);
      if (hits.length) F(`4 · ${por} sigue en ${hits.join(", ")}`);
    }
    const sinCifra = ["src/app/aprende/page.tsx", "src/app/cobertura/page.tsx", "src/app/comunas/page.tsx", "src/app/comunas/[slug]/page.tsx", "src/app/layout.tsx", "src/app/register/page.tsx", "src/components/chrome/SharedConversionCTA.tsx", "src/components/analysis/LoadingEditorial.tsx", "src/lib/guia/semanal-str.ts"];
    for (const r of sinCifra) if (!usa(r, "TIEMPO_ANALISIS")) F(`4 · ${r} no dice la cifra de tiempo medida`);
  }
  {
    const t = sinImports(sc("src/app/terms/page.tsx"));
    if (!/Cada análisis incluye el veredicto/.test(t)) F("4 · /terms no dice qué incluye el análisis (y su descripción lo promete)");
    if (!/Banco Central/.test(t) || !/SII/.test(t)) F("4 · /terms no nombra sus fuentes públicas");
    if (/CMF|Portal Inmobiliario|TocToc/i.test(t)) F("4 · /terms nombra una fuente que no usa o que no se nombra");
  }

  // ── 5 · LOS DATOS ───────────────────────────────────────────────────────────
  {
    const s = faqSecciones();
    const datos = s.flatMap((x) => x.items).find((i) => i.id === "datos-seguros")?.a ?? "";
    if (!/Meta/.test(datos) || !/cookies/.test(datos) || !/PostHog/.test(datos)) F("5 · el FAQ de datos no dice que Meta (con cookies) y PostHog los reciben, como /privacy");
    const priv = sc("src/app/privacy/page.tsx");
    if (!/Meta/.test(priv) || !/PostHog/.test(priv)) F("5 · /privacy ya no nombra a Meta y PostHog: el FAQ dice otra cosa");
    if (!/en este navegador/.test(REGISTRO_UN_PASO.enlaceAlternativa)) F("5 · «vuelves a este mismo informe con tu cuenta» no dice «en este navegador»");
    const plantilla = sc("src/lib/email/plantilla-clara.ts");
    if (!/en el navegador donde lo pediste/.test(plantilla)) F("5 · el correo del código no dice que el enlace sirve en el navegador donde se pidió");
    if (!/en el navegador donde lo pediste/.test(leer("docs/emails/supabase-codigo.html"))) F("5 · la plantilla de Supabase (docs/emails/supabase-codigo.html) no está regenerada");
    const todas = fuentes();
    const sinNav = todas.filter((f) => /vuelves a este mismo informe/.test(f.s) && !/en este navegador, vuelves a este mismo informe/.test(f.s)).map((f) => f.p);
    if (sinNav.length) F(`5 · «vuelves a este mismo informe» sin «en este navegador» en ${sinNav.join(", ")}`);
  }
  {
    const correo = "Ana@Correo.cl ";
    const norm = normalizarCorreo(correo);
    const a = await idLead(correo, "llave"), b = await idLead("ana@correo.cl", "llave");
    const sha = `lead-${createHash("sha256").update(norm).digest("hex").slice(0, 32)}`;
    const hmac = `lead-${createHmac("sha256", "lead:llave").update(norm).digest("hex").slice(0, 32)}`;
    if (a !== b) F("5 · el id del Lead no es uno por correo (no deduplica)");
    if (a === sha || a.includes(createHash("sha256").update(norm).digest("hex").slice(0, 16))) F("5 · EL ID DEL LEAD ES EL SHA-256 DEL CORREO: Meta lo cruza aunque la persona rechace las cookies");
    if (a !== hmac) F("5 · el id del Lead no es el HMAC con la llave del servidor");
    // Sin llave (el parámetro por defecto lee CRON_SECRET: se saca del entorno para probarlo).
    const llave = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    try {
      if ((await idLead(correo)) === (await idLead(correo))) F("5 · sin llave, el id del Lead sale del correo");
    } finally { if (llave !== undefined) process.env.CRON_SECRET = llave; }
  }
  {
    if (puntajeDe({ score: 71.6 } as Parameters<typeof puntajeDe>[0]) !== 72 || puntajeDe(null) !== null) F("5 · puntajeDe no redondea el puntaje del informe como el informe");
    for (const r of ["src/app/api/og/route.tsx", "src/app/api/og/veredicto/route.tsx", "src/app/analisis/[id]/page.tsx", "src/app/analisis/[id]/informe-ltr.tsx"]) {
      const s = sinImports(sc(r));
      if (!/resultadosPorId\(/.test(s)) F(`5 · ${r} no lee el puntaje del informe recalculado`);
      if (/runtime\s*=\s*["']edge["']/.test(s)) F(`5 · ${r} corre en edge: no puede recalcular el informe`);
    }
    const ltr = sinImports(sc("src/app/analisis/[id]/informe-ltr.tsx"));
    if (/\brawResults\b/.test(ltr)) F("5 · el informe todavía arma su puntaje por su cuenta (rawResults), aparte de la vista previa");
  }

  // ── 6 · DESPUÉS DE PAGAR DESDE UN DEPTO ─────────────────────────────────────
  for (const m of ["despublicado", "sin-direccion", "medicion", "error", "fuera"] as MotivoFallo[]) {
    const t = textoFallo(m);
    if (!/No se usó ningún análisis/.test(`${t.titulo} ${t.que}`)) F(`6 · el fallo «${m}» no dice que no se usó ningún análisis`);
  }
  if (textoFallo("sin-direccion").titulo === textoFallo("error").titulo || textoFallo("medicion").titulo === textoFallo("error").titulo) F("6 · «sin dirección» o «medición caída» se dicen como un error genérico");
  if (!/dirección/.test(textoFallo("sin-direccion").titulo) || !/medición/.test(textoFallo("medicion").titulo)) F("6 · el fallo no dice cuál fue el motivo");
  if (RETORNO.quedanSinUsar(3) !== "Te quedan 3 análisis para otro depto." || !/No te quedan/.test(RETORNO.quedanSinUsar(0))) F("6 · el saldo tras un fallo no es el real");
  {
    const iec = sinImports(sc("src/components/guia/InformeEnCamino.tsx"));
    if (!/data-informe="quedan-sin-usar">\{RETORNO\.quedanSinUsar\(saldo\)\}/.test(iec)) F("6 · el pop-up del fallo no deja el saldo a la vista (sin restar el de este depto)");
    const ret = sinImports(sc("src/app/payments/return/page.tsx"));
    // La vuelta del pago dibuja InformeEnLaVuelta: su rama de fallo deja el saldo, y la página le pasa el saldo.
    const enLaVuelta = iec.match(/export function InformeEnLaVuelta[\s\S]*?\n}\n/)?.[0] ?? "";
    if (!/<VueltaInforme [^>]*saldo=\{saldo\}/.test(enLaVuelta)) F("6 · el informe en la vuelta no le pasa el saldo a lo que dibuja");
    const vuelta = iec.match(/function VueltaInforme[\s\S]*?\n}\n/)?.[0] ?? "";
    const ramaFallo = vuelta.match(/\{fallo && \([\s\S]*?\n {6}\)\}/)?.[0] ?? "";
    if (!/data-retorno="quedan-sin-usar">\{RETORNO\.quedanSinUsar\(saldo\)\}/.test(ramaFallo)) F("6 · la vuelta del pago que no pudo analizar no deja el saldo a la vista");
    if (!/<InformeEnLaVuelta [^>]*saldo=\{saldo\}/.test(ret)) F("6 · la vuelta del pago no le pasa el saldo al informe en camino");
    if (!/vueltaAnalizaSola\(vuelta\)\)\s*\{[\s\S]{0,400}?abrirDestino\(vuelta\)/.test(ret)) F("6 · LA VUELTA DE RENTA CORTA NO ANALIZA SOLA (no lleva al depto con analizar=1)");
  }
  if (!vueltaAnalizaSola(volverAlDepto("0123456789abcdef0123", "a1", "str"))) F("6 · la vuelta de un depto de renta corta no se reconoce como «analiza sola»");
  if (!vueltaAnalizaSola("/explorar?analizar=1&a=x")) F("6 · la vuelta a Explorar con analizar=1 no analiza sola");
  for (const no of ["/dashboard", "/explorar?a=x", "/semanal?t=x&analizar=1", "https://otro.cl/dashboard?analizar=1", "/dashboard?analizar=10"]) if (vueltaAnalizaSola(no)) F(`6 · «${no}» se toma como una vuelta que analiza sola`);
  {
    const sl = sinImports(sc("src/app/semanal/semanal-lista.tsx"));
    const noDa = sl.match(/if \(corta && noDa\.has\(it\.avisoId\)\) \{[\s\S]*?\n {4}\}\n/)?.[0] ?? "";
    if (!/data-semanal="ver-publicacion"/.test(noDa) || !/href=\{url\}/.test(noDa)) F("6 · LA TARJETA «NO DA» NO CONSERVA EL ENLACE A LA PUBLICACIÓN");
    if (!/data-semanal="analizar-igual"/.test(noDa) || !/textoAnalizarIgual\(/.test(noDa)) F("6 · la tarjeta «no da» no conserva «Analizar igual»");
    if (!/publicaciones=/.test(sinImports(sc("src/app/dashboard/seleccion-en-casa.tsx")))) F("6 · la selección del dashboard no le pasa las publicaciones a la tarjeta «no da»");
  }
  if (!/no usas un análisis/.test(AVISO_ANALIZAR.incluyeCortaComprando.despues) || /no gastas/.test(AVISO_ANALIZAR.incluyeCortaComprando.despues)) F("6 · comprando, «si no da» no dice «no usas un análisis»");
  if (!/sin \? AVISO_ANALIZAR\.incluyeCortaComprando : AVISO_ANALIZAR\.incluyeCorta/.test(sinImports(sc("src/components/guia/AvisoAntesDeAnalizar.tsx")))) F("6 · el pop-up sin saldo no usa el texto de comprar («no gastas» al lado de «Comprar»)");

  // ── 7 · LAS FECHAS ──────────────────────────────────────────────────────────
  {
    const hoy = fechaVence("2026-11-06T00:04:00Z", AHORA); // 21:04 del 5 en Chile
    if (hoy !== "hoy a las 21:04") F(`7 · «vence» el mismo día no da la hora: «${hoy}»`);
    if (fechaVence("2026-12-01T15:00:00Z", AHORA) !== "el 1 de diciembre") F(`7 · «vence» otro día no da la fecha: «${fechaVence("2026-12-01T15:00:00Z", AHORA)}»`);
    if (textoVence("2026-11-06T00:04:00Z", AHORA) !== "Vence hoy a las 21:04.") F("7 · «Vence el {día}» no lleva la hora el día que vence");
    if (!/fechaVence\(/.test(sinImports(sc("src/app/perfil/page.tsx")))) F("7 · /perfil no dice el vencimiento con la hora del mismo día");
  }
  if (/^Hoy/i.test(TICKET_CON_SALDO.linea("$14.990", "mañana 11:17"))) F("7 · el ticket con saldo dice «Hoy,» y vence mañana");
  if (/\b0 análisis/.test(RETORNO.quedanOtros(0))) F("7 · «Te quedan 0 análisis»");
  if (DESTINO_SIN_INFORME !== "/explorar" || !correoRecordatorioPack("https://refranco.ai", null).html.includes('href="https://refranco.ai/explorar"')) F("7 · el recordatorio de un pack sin informe no lleva al mapa");
  {
    const pago = { product: "single", analysis_id: "an1", payment_data: { origen: "semanal", volver: "/dashboard?t=abc&a=x" } };
    const ruta = rutaRetomarCompra(pago);
    if (ruta !== urlCompra({ product: "single", analysisId: "an1", origen: "semanal", volver: "/dashboard?t=abc&a=x" }) || ruta === "/pricing") F(`7 · el carrito abandonado no lleva a la compra a medias («${ruta}»)`);
    const correo = correoCheckoutAbandonado({ nombre: "Ana", producto: "1 análisis", tipo: "single", sitio: "https://refranco.ai", retomar: ruta });
    if (!correo.html.includes(`https://refranco.ai${ruta.replace(/&/g, "&amp;")}`) && !correo.html.includes(`https://refranco.ai${ruta}`)) F("7 · el correo del carrito abandonado no lleva el enlace a la compra a medias");
    if (!/retomar: rutaRetomarCompra\(row\)/.test(sinImports(sc("src/app/api/cron/abandoned-checkout/route.ts")))) F("7 · el cron del carrito abandonado no arma el enlace a la compra a medias");
  }

  // ── 8 · CLAUDE.md AL DÍA ────────────────────────────────────────────────────
  {
    const md = leer("CLAUDE.md");
    if (!/Plan Franco: \$39\.990\/mes — 20 análisis\/mes/.test(md) || /10 análisis\/mes/.test(md)) F("8 · CLAUDE.md no dice que el plan da 20 análisis al mes");
    if (/la emisión está \*\*apagada\*\*/.test(md) || !/\*\*Emite en producción\*\*/.test(md)) F("8 · CLAUDE.md dice que la boleta no emite en producción");
    if (/son solo premium\/subscriber/.test(md) || !/El informe no se bloquea por nivel/.test(md)) F("8 · CLAUDE.md todavía dice que el simulador de renta larga se bloquea por nivel");
    if (!/y 500 en el día/.test(md)) F("8 · CLAUDE.md no dice el cupo de 500 regalos al día");
  }

  for (const f of fallas) console.log(`  ✗ ${f}`);
  console.log(fallas.length === 0 ? "  ✓ PROMESAS-TEXTOS: el regalo, el referido, los avisos, las cifras, los datos, después de pagar, las fechas y CLAUDE.md dicen lo que el código hace" : `  ${fallas.length} falla(s)`);
  return { hard: fallas.length };
}

if (require.main === module) {
  runPromesasTextosTier().then((r) => { process.exitCode = r.hard > 0 ? 1 : 0; });
}

// ============================================================================
// ACTA — verificado EN ROJO por mutación (05-nov-2026)
// ============================================================================
//   Runner `mutar.js` del scratchpad de la sesión e82e757c (aplica, corre el tier, exige la falla nombrada, restaura por sha256).
//   §1  M1 el cupo vuelve a 100 · M2 el reclamo del fallo sin condición (dos reintentos cargan dos) · M3 un fallo no se
//       reintenta · M4 el cron no barre · M5 el dashboard sin la bajada del motivo · M6 Explorar sin «Ver planes» ...... ROJO
//   §2  M7 la regla vuelve al registro · M8 el menú sin tope ni días · M9 crear un análisis no revisa el premio · M10 el
//       conteo con un `.neq` pelado (descarta los `pending_payment` NULL: la base de juguete imita al SQL) · M11 sin
//       análisis también paga · M12 el «cuándo» vuelve a importar el referido ..................................... ROJO
//   §3  M13 el aviso de nuevos vuelve a prometer · M14 diaRelativo dice «hoy» siempre · M15 UNA llamada del correo
//       inmediato sin su día (la otra lo lleva: el predicado exige todas) · M16 la intro del día sin su día · M17 la
//       tarjeta del semanal vuelve a «hace unas horas» · M18 el correo del día con «hoy» fijo · M19 «en minutos» ...... ROJO
//   §4  M20 el ahorro redondeado al mil · M21 comparables a decenas de miles · M22 los metadatos con la constante · M23 el
//       FAQ vuelve a la sensibilidad · M24 «deptos parecidos» sin mirar si los hay · M25 «30 segundos» · M26 /terms con
//       la CMF · M27 /terms sin lo que incluye ........................................................................ ROJO
//   §5  M28 el FAQ vuelve a «no compartimos» · M29 «vuelves a este mismo informe» sin el navegador · M30 el id del Lead
//       vuelve al SHA-256 · M31 la imagen del veredicto con el puntaje de la columna .................................. ROJO
//   §6  M32 «sin dirección» como error genérico · M33 el fallo en la vuelta resta el saldo · M34 la vuelta de renta corta
//       no lleva al depto · M35 «analiza sola» acepta el semanal · M36 la tarjeta «no da» sin la publicación · M37 el
//       pop-up sin saldo dice «no gastas» ............................................................................. ROJO
//   §7  M38 «vence» sin la hora del mismo día · M39 el ticket vuelve a «Hoy,» · M40 «Te quedan 0 análisis» · M41 el
//       recordatorio sin informe a planes · M42 el carrito siempre a planes · M43 el cron del carrito sin el enlace ... ROJO
//   §8  M44 CLAUDE.md con 10 análisis · M45 con la boleta apagada · M46 con el simulador bloqueado .................... ROJO
//   46/46 en rojo, a la primera. Antes de correrlas se endurecieron dos predicados que habrían quedado verdes: §3 pedía el
//   día en UNA llamada del correo inmediato (hay dos) y en el asunto y el titular del día pero no en la intro; ahora exige
//   todas. Y tres se corrigieron por medir mal, no el código: §5 «sin llave» pasaba `undefined`, que activa el valor por
//   defecto (CRON_SECRET) en vez de probar la falta de llave; §5 «rawResults» tomaba `rawResultsForGuard` (el tipo, no el
//   puntaje); §6 buscaba el saldo en InformeEnLaVuelta, que delega el dibujo en VueltaInforme.
//   §4 «el conteo vivo» nombraba la tabla en su regex y LECTURA-PAGINADA lo cazó recién en el QUICK sobre master: ese tier
//   lee los archivos TRACKEADOS, y en la rama este archivo todavía no lo estaba. Reescrito sin el nombre (una sola lectura
//   en el módulo, con los filtros de la población); L1 sin el filtro de precio y L2 una segunda lectura: los dos ROJO.
// ============================================================================
