// ─────────────────────────────────────────────────────────────────────────────
// Tier TICKET-REGRESO (12-oct-2026, 0 tokens) — el ticket a los 8 s, el que vuelve lo encuentra, «por qué no
// sale» y la hoja de la dirección en iPhone.
//
//   1 · LA MARCA DEL FINAL: `FinCapitulos` está en los DOS informes (en renta larga, justo después de «Detalle de
//       la inversión», cuyo último capítulo es «Tu resultado a 10 años»), y el ticket sube 8 s después.
//   2 · EL QUE VUELVE: dentro de las 24 h, en el mismo navegador o con sesión, el ticket no se abre solo otra vez,
//       y la pestaña del ticket cerrado está a la vista desde que se abre el informe hasta que la oferta vence.
//   3 · «POR QUÉ NO SALE»: con `?lqs=1` el recuadro dice el estado; sin el parámetro no se dibuja; no va a PostHog.
//   4 · LA HOJA DE LA DIRECCIÓN no se mide contra el área visible: ocupa la pantalla y su cuerpo hace scroll.
//   5 · EL INTERRUPTOR DE QA (la cookie que hace de dueño) solo existe con `next dev`.
// La medida en vivo, en WebKit a 390 px, es `ticket-hoja-webkit-sonda.ts`.
//
// ACTA (12-oct-2026). La premisa del punto 1 no se cumplía: `FinCapitulos` YA estaba montada en renta larga
// (SubjectCardGrid, después de «Detalle de la inversión»; la sirve producción) y el ticket subía a los 8 s; lo que
// lo retrasaba en el iPhone era el hilo ocupado (TAREAS-LARGAS). Queda fijada igual. Contra los archivos de
// master: ROJO. 16/16 mutaciones en ROJO: R1 con sesión no cuenta como volver · R2 recién registrado cuenta como
// volver · R3 la pestaña nunca se ve · R4 el ticket no usa la regla de la pestaña · R5 la pestaña no se va al
// vencer · R6 el recuadro le dice de más al que no es dueño · R7 sale sin pedirlo · R8 se mide · R9 el servidor da
// otro motivo · R10 la hoja vuelve al área visible · R11 el Modal la mide igual · R12 sin aire abajo · R13 la cookie
// de QA sin atar a `next dev` · R14 sin la marca en renta larga · R15 renta corta sin la sesión al ticket.
// La sonda en WebKit, contra `next dev`: el ticket sube a los 8.006–8.025 ms de la marca; VERDE, y ROJO en 6/6
// mutaciones (el ticket de master: «al recargar, la pestaña no está a la vista»; sin la marca; a los 12 s; la hoja
// contra el área visible —termina en 332 de 664—; el recuadro sin pedirlo; la hoja sin aire —3 sugerencias bajo el
// teclado—).
// Solo:  node --import tsx scripts/eval/golden/ticket-regreso-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ESPERA_FINAL_MS } from "../../../src/lib/lo-que-sigue/disparo-ticket";
import * as ET from "../../../src/lib/lo-que-sigue/estado-ticket";
import * as DG from "../../../src/lib/lo-que-sigue/diagnostico-ticket";
import * as OS from "../../../src/lib/lo-que-sigue/oferta-informe-servidor";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

/* eslint-disable @typescript-eslint/no-explicit-any */
function adminFalso(pagos: Array<{ product: string; status: string }>, correo: string | null): any {
  const consulta: any = { select: () => consulta, eq: () => consulta, then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: pagos, error: null }).then(ok) };
  return { from: () => consulta, auth: { admin: { getUserById: async () => ({ data: { user: correo ? { email: correo } : null } }) } } };
}

export async function runTicketRegresoTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER TICKET-REGRESO (el ticket a los 8 s, el que vuelve, «por qué no sale» y la hoja en iPhone · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 1 · la marca del final en los dos informes ──────────────────────────────
  const grid = sinComentarios(leer("src/components/analysis/SubjectCardGrid.tsx"));
  const inversion = grid.slice(grid.indexOf('id="la-inversion"'), grid.indexOf('id="la-zona"'));
  if (!/<CapitulosInversion[\s\S]*?<\/SeccionInforme>\s*<FinCapitulos \/>/.test(inversion)) F("1 · en renta larga la marca del final no va justo después de «Detalle de la inversión» (sin ella el disparador de los 8 s nunca corre)");
  if (!/<FinCapitulos \/>/.test(sinComentarios(leer("src/app/analisis/renta-corta/[id]/results-client.tsx")))) F("1 · en renta corta falta la marca del final");
  if (ESPERA_FINAL_MS !== 8_000) F(`1 · el ticket no sube a los 8 s de la marca (${ESPERA_FINAL_MS} ms)`);

  // ── 2 · el que vuelve lo encuentra ───────────────────────────────────────────
  const reg = (estadoLocal: ET.EstadoTicket, conSesion: boolean, recienDentro: boolean) => ET.esRegreso({ estadoLocal, conSesion, recienDentro });
  if (typeof ET.esRegreso !== "function" || typeof ET.pestanaVisible !== "function") F("2 · faltan `esRegreso` / `pestanaVisible`");
  else {
    if (reg("nunca", false, false)) F("2 · la primera visita sin sesión cuenta como volver (el ticket no subiría nunca)");
    if (!reg("visto", false, false) || !reg("despedida", false, false)) F("2 · en el mismo navegador, después de mostrarse, el ticket se vuelve a abrir solo");
    if (!reg("nunca", true, false)) F("2 · con sesión, a un informe que nació anónimo, el ticket se vuelve a abrir solo");
    if (reg("nunca", true, true)) F("2 · en la misma visita en que se registró, cuenta como volver (el ticket no subiría al final)");
    const pv = (abierto: boolean, yaSubio: boolean, vigente: boolean) => ET.pestanaVisible({ abierto, yaSubio, vigente });
    if (!pv(false, true, true)) F("2 · la pestaña no está a la vista con el ticket cerrado y la oferta viva");
    if (pv(true, true, true) || pv(false, false, true) || pv(false, true, false)) F("2 · la pestaña se ve con el ticket abierto, sin haber subido nunca o con la oferta vencida");
  }
  const tk = sinComentarios(leer("src/components/lo-que-sigue/TicketPack.tsx"));
  if (!/const pestana = pestanaVisible\(\{ abierto, yaSubio, vigente \}\);/.test(tk) || /zonaCierre/.test(tk)) F("2 · la pestaña depende otra vez de la zona del final (quien vuelve arriba no la encuentra)");
  if (!/const vuelve = \(\) => esRegreso\(\{ estadoLocal: leerEstadoTicket\(almacen, ctx\.analysisId\), conSesion, recienDentro \}\);/.test(tk) || !/if \(vuelve\(\)\) setYaSubio\(true\);/.test(tk) || !/puedeSubir: \(\) => !vuelve\(\) && ofertaPackVigente\(createdAt\),/.test(tk))
    F("2 · el ticket no distingue al que vuelve (se abre solo otra vez, o la pestaña no está desde el principio)");
  if (!/const ms = venceEl\(createdAt\)\.getTime\(\) - Date\.now\(\);/.test(tk) || !/window\.setTimeout\(\(\) => setVigente\(false\)/.test(tk)) F("2 · con la página abierta, la pestaña no se va cuando la oferta vence");
  // ⚠ ACTA (21-oct-2026, recorrido real de Fabrizio por la puerta B) · el ticket de la cuenta nueva va en su primer
  // informe, que se abre con la sesión: entrar con ella NO es volver, así que `conSesion` lleva `&& !ticketDesde` (la
  // primera vez sube solo, como el anónimo; tier PUERTA-B-RECORRIDO §5). Para el informe que nació anónimo, igual que antes.
  for (const [rc, sesion] of [["src/app/analisis/[id]/results-client.tsx", "isLoggedIn && !ticketDesde"], ["src/app/analisis/renta-corta/[id]/results-client.tsx", "!!userId && !ticketDesde"]] as const) {
    const s = sinComentarios(leer(rc));
    // ⚠ ACTA (22-oct-2026) · después de `recienDentro` va `conCuenta` (tier TICKET-VIVO §4).
    if (!new RegExp(`<TicketPack [^>]*conSesion=\\{${sesion.replace(/[!]/g, "\\!")}\\} recienDentro=\\{!!recienDentro\\} conCuenta=\\{[^}]+\\} />`).test(s)) F(`2 · ${rc.includes("renta-corta") ? "renta corta" : "renta larga"}: el ticket no sabe si entra con sesión o recién registrado`);
  }

  // ── 3 · «por qué no sale» ─────────────────────────────────────────────────────
  if (!DG.pideDiagnostico("?lqs=1") || DG.pideDiagnostico("") || DG.pideDiagnostico("?lqs=0") || DG.pideDiagnostico("?x=1")) F("3 · el recuadro no responde solo a `?lqs=1`");
  const base = { vigente: true, venceHora: "10:40", estadoLocal: "nunca" as ET.EstadoTicket, regreso: false, bannerMontado: true, bannerLibreEnMs: 0, vivo: null };
  const ajeno = DG.lineasDiagnostico({ ...base, motivo: "no-dueno" });
  if (ajeno.length !== 1 || !/no te reconoce como dueño/.test(ajeno[0])) F("3 · al que no es el dueño el recuadro le dice más que eso");
  const motivos: Array<[DG.MotivoOferta, RegExp]> = [["demo", /ejemplo/], ["no-nacio-anonimo", /no nació anónimo/], ["pack-pagado", /ya está pagado/]];
  for (const [m, re] of motivos) if (!re.test(DG.lineasDiagnostico({ ...base, motivo: m })[0] ?? "")) F(`3 · el recuadro no dice por qué no hay oferta (${m})`);
  if (!/vencida a las 10:40/.test(DG.lineasDiagnostico({ ...base, motivo: "ofrecida", vigente: false })[0])) F("3 · el recuadro no dice que la oferta venció");
  const contando = DG.lineasDiagnostico({ ...base, motivo: "ofrecida", vivo: { abierto: false, pestana: false, disparo: { hecho: false, motivo: null, pendiente: null, finalFaltaMs: 3200, lecturaMs: 65_000, lecturaActiva: true, pasoLaRecomendacion: true } } }).join("\n");
  if (!/vigente hasta las 10:40/.test(contando) || !/nunca se mostró/.test(contando) || !/Banner: libre/.test(contando) || !/faltan 4 s/.test(contando) || !/1:05 de 4:00/.test(contando) || !/Salida por arriba \(solo PC\): habilitada/.test(contando))
    F("3 · el recuadro no dice qué disparador cuenta y cuánto le falta");
  const enUso = DG.lineasDiagnostico({ ...base, motivo: "ofrecida", bannerLibreEnMs: 12_000 }).join("\n");
  if (!/Banner: en uso, se libera en 12 s/.test(enUso)) F("3 · el recuadro no dice que el banner está en uso");
  const vuelve = DG.lineasDiagnostico({ ...base, motivo: "ofrecida", estadoLocal: "despedida", regreso: true, vivo: { abierto: false, pestana: true, disparo: null } }).join("\n");
  if (!/se mostró y se cerró · vuelve: no se abre solo/.test(vuelve) || !/pestaña visible/.test(vuelve)) F("3 · el recuadro no dice que quien vuelve encuentra la pestaña");
  const dgUi = leer("src/components/lo-que-sigue/DiagnosticoTicket.tsx");
  const dgLib = leer("src/lib/lo-que-sigue/diagnostico-ticket.ts");
  if (!/if \(!pideDiagnostico\(window\.location\.search\)\) return;/.test(dgUi) || !/if \(!lineas\) return null;/.test(dgUi)) F("3 · el recuadro se dibuja sin `?lqs=1`");
  if (/posthog|capturar|EVENTOS_LQS/i.test(sinComentarios(dgUi) + sinComentarios(dgLib))) F("3 · el recuadro se mide en PostHog");
  for (const rc of ["src/app/analisis/[id]/results-client.tsx", "src/app/analisis/renta-corta/[id]/results-client.tsx"]) {
    if (!/<DiagnosticoTicket motivo=\{motivoOferta\}/.test(sinComentarios(leer(rc)))) F(`3 · ${rc.includes("renta-corta") ? "renta corta" : "renta larga"} no monta el recuadro con el motivo del servidor`);
  }
  for (const inf of ["src/app/analisis/[id]/informe-ltr.tsx", "src/app/analisis/renta-corta/[id]/informe-str.tsx"]) {
    if (!/motivoOferta[=:]\s*\{?ofertaLqs\.motivo/.test(leer(inf))) F(`3 · ${inf.includes("renta-corta") ? "renta corta" : "renta larga"}: el motivo de la oferta no baja del servidor`);
  }
  const fila = { anon_origen_hash: "h" };
  const motivo = async (pagos: Array<{ product: string; status: string }>, quienMira: "anonimo" | "origen" | "sesion" | null, extra: Partial<{ esDemo: boolean; fila: Record<string, string | null> }> = {}) =>
    (await OS.leerOfertaPack(adminFalso(pagos, "x@y.cl"), { analysisId: "a1", fila: extra.fila ?? fila, quienMira, esDemo: extra.esDemo ?? false, correoSesion: null, duenoId: "u1" })).motivo;
  const esperados: Array<[Promise<string>, string]> = [
    [motivo([], "origen"), "ofrecida"], [motivo([], null), "no-dueno"], [motivo([], "sesion", { esDemo: true }), "demo"],
    [motivo([], "sesion", { fila: {} }), "no-nacio-anonimo"], [motivo([{ product: "pack3", status: "paid" }], "sesion"), "pack-pagado"],
  ];
  for (const [p, e] of esperados) { const v = await p; if (v !== e) F(`3 · el servidor da el motivo «${v}» donde va «${e}»`); }

  // ── 4 · la hoja de la dirección ocupa la pantalla ─────────────────────────────
  if (!/<Modal [^>]*alto="pantalla">/.test(leer("src/components/entrada/HojaDireccion.tsx"))) F("4 · la hoja de la dirección se mide contra el área visible (en iOS 26 termina después de la primera sugerencia)");
  const voc = sinComentarios(leer("src/components/analysis/hallazgos/vocabulario.tsx"));
  if (!/if \(!abierto \|\| !esHoja \|\| esGlosa \|\| alto === "pantalla"\) return;/.test(voc) || !/\$\{alto === "pantalla" \? " v-pantalla" : ""\}/.test(voc)) F("4 · el Modal no tiene la hoja a pantalla (sin medir el área visible)");
  const acc = leer("src/components/analysis/hallazgos/HallazgosAcordeon.tsx");
  // ⚠ ACTA (12-oct-2026, segunda pasada) · la hoja ya no va abajo con 56 px de velo y aire de 50vh: en iOS 26 el
  // foco desplazaba la página y la hoja se iba. Ahora va ANCLADA ARRIBA y de alto completo, la página en cero y la
  // lista con scroll propio; la regla fina la fija TICKET-IOS §1. Acá, que siga ocupando la pantalla entera.
  if (!/\.v-modal-overlay\.v-pantalla\[role="dialog"\] \.v-modal\{height:100%;/.test(acc)) F("4 · la hoja a pantalla no ocupa la pantalla");

  // ── 5 · el interruptor de QA solo con `next dev` ──────────────────────────────
  const inf = sinComentarios(leer("src/app/analisis/[id]/informe-ltr.tsx"));
  const anon = sinComentarios(leer("src/lib/api-helpers/anon-cap.ts"));
  if (!/const qaDueno = process\.env\.NODE_ENV === "development" && !isLoggedIn && !modoDemo && duenoQaDelRequest\(analisis\.id\);/.test(inf) || !/const isAnonOwner = anonDuenoPorCookie \|\| qaDueno;/.test(inf))
    F("5 · la cookie de QA que hace de dueño no está atada a `next dev` y fuera del demo (en un build sería una puerta abierta)");
  if (!/export function duenoQaDelRequest\(analysisId: string\): boolean \{\s*if \(process\.env\.NODE_ENV !== "development"\) return false;\s*return cookies\(\)\.get\("franco_qa_dueno"\)\?\.value === analysisId;/.test(anon))
    F("5 · el ayudante de la cookie de QA la lee fuera de `next dev`");
  if (/franco_qa_dueno|\bcookies\(\)/.test(inf)) F("5 · el informe lee la cookie de QA directo (vuelve dinámica la ruta, el demo incluido)");

  if (fallas.length) {
    console.log(`  ✗ TICKET-REGRESO · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — la marca del final está en los dos informes y el ticket sube a los 8 s; quien vuelve no lo ve abrirse solo y encuentra la pestaña desde el principio; `?lqs=1` dice por qué; la hoja de la dirección ocupa la pantalla; la cookie de QA solo con `next dev`");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runTicketRegresoTier().then((r) => process.exit(r.hard ? 1 : 0));
}
