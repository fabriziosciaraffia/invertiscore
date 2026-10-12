// ─────────────────────────────────────────────────────────────────────────────
// Tier TICKET-IOS (12-oct-2026, 0 tokens) — iPhone (iOS 26): la hoja de la dirección que se iba al enfocar el
// campo, y el ticket que quedaba «ya se mostró» sin que nadie lo viera.
//
//   1 · LA HOJA DE LA DIRECCIÓN: mientras está abierta, la página queda en CERO —y vuelve a cero si iOS la desplaza
//       al enfocar el campo—; la hoja va anclada arriba, de alto completo, con el campo al tope; la lista de
//       sugerencias tiene su propio scroll.
//   2a · LA BITÁCORA: el recuadro de `?lqs=1` muestra los últimos eventos del ticket con hora (abierto y con qué
//       disparador; medido al segundo, dentro o fuera de la pantalla; a la despedida o cerrado, y por dónde; un
//       toque en el velo ignorado). En el navegador, nunca en PostHog.
//   2b · FIJO A LA PANTALLA: el velo y la pestaña van con `position: fixed` y los márgenes seguros; nada en el ticket
//       mide el área visible (el ancla al `visualViewport` se retiró).
//   2c · EL VELO: en el primer segundo un toque no cierra; el final de un gesto que empezó antes de abrirse, tampoco.
//   2d · «YA SE MOSTRÓ» se guarda cuando la hoja estuvo un segundo dentro de la pantalla, no cuando el disparador
//       decide abrirla.
//   3 · EL BANNER EN USO: solo el foco o la escritura en un campo, abrir el paso del código, tocar un botón o un chip.
//       El scroll y el toque de paso por encima, no.
// La medida en vivo, en WebKit a 390 px, es `ticket-hoja-webkit-sonda.ts`.
//
// ACTA (12-oct-2026). 23/23 mutaciones en ROJO: S1 la vuelta a cero no hace nada · S2 el body en -y · S3 sin escuchar
// el scroll de la ventana · S4 la hoja abajo · S5 la lista sin scroll propio · S6 la bitácora sin tope · S7 el recuadro
// sin eventos con el ticket montado (la primera versión del tier quedó VERDE acá: solo probaba el recuadro sin el
// ticket montado, que sale por otra rama) · S8 el recuadro no lee la bitácora · S9 la despedida no anota · S10 la X
// anotada como otra cosa · S11 el ticket vuelve a leer el área visible · S12 la pestaña sin margen seguro · S13 el
// velo sin la cláusula del gesto previo · S14 sin la gracia · S15 el velo sin consultarla · S16 abrir sin anotar
// cuándo · S17 «ya se mostró» al subir · S18 `hojaDentro` sin el borde de abajo · S19 sin mirar la pantalla · S20 sin
// esperar el segundo · S21 el dedo de paso marca el banner · S22 el foco en cualquier cosa · S23 el chip no cuenta.
// Solo:  node --import tsx scripts/eval/golden/ticket-ios-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import * as ET from "../../../src/lib/lo-que-sigue/estado-ticket";
import * as BT from "../../../src/lib/lo-que-sigue/bitacora-ticket";
import * as DG from "../../../src/lib/lo-que-sigue/diagnostico-ticket";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(RAIZ, dir))) {
    const rel = `${dir}/${n}`;
    if (statSync(join(RAIZ, rel)).isDirectory()) out.push(...archivos(rel));
    else if (/\.(ts|tsx)$/.test(n)) out.push(rel);
  }
  return out;
}
/** El cuerpo de una función o bloque, desde su apertura hasta la llave que lo cierra. Vacío si no está. */
function cuerpo(src: string, apertura: string): string {
  const i = src.indexOf(apertura);
  if (i < 0) return "";
  let d = 0;
  for (let j = i + apertura.length - 1; j < src.length; j++) {
    if (src[j] === "{") d++;
    else if (src[j] === "}" && --d === 0) return src.slice(i + apertura.length, j);
  }
  return "";
}

function almacenFalso() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

export function runTicketIosTier(): { hard: number } {
  console.log("\n─── TIER TICKET-IOS (la hoja de la dirección en cero y el ticket que solo cuenta si se vio · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 1 · la hoja de la dirección: la página en cero, la hoja arriba, la lista con scroll propio ──
  if (!/<Modal [^>]*alto="pantalla">/.test(leer("src/components/entrada/HojaDireccion.tsx"))) F("1 · la hoja de la dirección no usa la forma a pantalla del Modal");
  const voc = sinComentarios(leer("src/components/analysis/hallazgos/vocabulario.tsx"));
  if (!/const enCero = alto === "pantalla";/.test(voc) || !/body\.style\.top = enCero \? "0px" : `-\$\{y\}px`;/.test(voc))
    F("1 · con la hoja de la dirección abierta la página no queda en cero (queda donde estaba el scroll)");
  const aCero = cuerpo(voc, "const aCero = () => {");
  if (!/^\s*if \(window\.scrollY !== 0 \|\| \(window\.visualViewport\?\.offsetTop \?\? 0\) !== 0\) window\.scrollTo\(0, 0\);\s*$/.test(aCero))
    F("1 · si iOS desplaza la página al enfocar el campo, no vuelve a cero");
  const alAbrir = cuerpo(voc, "if (enCero) {");
  if (!/^\s*window\.scrollTo\(0, 0\);\s*window\.addEventListener\("scroll", aCero, \{ passive: true \}\);\s*window\.visualViewport\?\.addEventListener\("scroll", aCero\);\s*window\.visualViewport\?\.addEventListener\("resize", aCero\);\s*$/.test(alAbrir))
    F("1 · la vuelta a cero no escucha el scroll de la ventana y del área visible");
  if (!/window\.removeEventListener\("scroll", aCero\);\s*window\.visualViewport\?\.removeEventListener\("scroll", aCero\);\s*window\.visualViewport\?\.removeEventListener\("resize", aCero\);/.test(voc))
    F("1 · la vuelta a cero sigue escuchando después de cerrar la hoja (la página no se podría mover)");
  if (!/\}, \[abierto, esHoja, alto\]\);/.test(voc)) F("1 · el bloqueo del scroll no depende de la forma de la hoja");
  const acc = leer("src/components/analysis/hallazgos/HallazgosAcordeon.tsx");
  if (!/\.v-modal-overlay\.v-pantalla\{align-items:flex-start\}/.test(acc) || !/\.v-modal-overlay\.v-pantalla\[role="dialog"\] \.v-modal\{height:100%;border-radius:0;animation:none\}/.test(acc))
    F("1 · la hoja a pantalla no va anclada arriba y de alto completo (el campo no queda al tope)");
  if (/\.v-pantalla[^{]*\{[^}]*padding-bottom:50vh/.test(acc)) F("1 · la hoja a pantalla volvió al aire de 50vh (el cuerpo hace scroll y el campo se va hacia arriba)");
  if (!/html\.he-hoja-abierta \.he-hoja-sugerencias \{ max-height: max\(150px, calc\(50svh - 140px\)\); overflow-y: auto;/.test(leer("src/components/entrada/hero-entrada.css")))
    F("1 · la lista de sugerencias no tiene su propio scroll bajo el campo");

  // ── 2a · la bitácora del ticket ─────────────────────────────────────────────
  const alm = almacenFalso();
  for (let i = 0; i < 10; i++) BT.anotarEvento(alm, "a", { t: Date.UTC(2026, 9, 12, 17, 0, i), tipo: "abierto", motivo: `m${i}` });
  const ev = BT.leerBitacora(alm, "a");
  if (ev.length !== BT.MAX_EVENTOS_TICKET || ev[0].motivo !== "m2" || ev[ev.length - 1].motivo !== "m9") F(`2a · la bitácora no guarda los últimos ${BT.MAX_EVENTOS_TICKET} eventos (${ev.length})`);
  if (BT.leerBitacora(alm, "b").length) F("2a · la bitácora de un informe se mezcla con la de otro");
  BT.anotarEvento(null, "a", { t: 0, tipo: "abierto" });
  const t = Date.UTC(2026, 9, 12, 17, 3, 27);
  const lineas: Array<[BT.EventoTicket, RegExp]> = [
    [{ t, tipo: "abierto", motivo: "final" }, /^14:03:27 · abierto \(final\)$/],
    [{ t, tipo: "medido", dentro: true, top: 210, alto: 454, pantalla: 664 }, /^14:03:27 · al segundo, dentro de la pantalla: arriba 210 · alto 454 de 664$/],
    [{ t, tipo: "medido", dentro: false, top: 610, alto: 454, pantalla: 664 }, /FUERA de la pantalla/],
    [{ t, tipo: "despedida", por: "velo" }, /a la despedida por el velo$/],
    [{ t, tipo: "despedida", por: "x" }, /a la despedida por la X$/],
    [{ t, tipo: "despedida", por: "seguir" }, /a la despedida por «Seguir leyendo»$/],
    [{ t, tipo: "cerrado", por: "escape" }, /cerrado por Escape$/],
    [{ t, tipo: "ignorado", por: "velo" }, /toque en el velo ignorado/],
  ];
  for (const [e, re] of lineas) if (!re.test(BT.lineaEvento(e))) F(`2a · la línea del evento «${e.tipo}» dice «${BT.lineaEvento(e)}»`);
  const base = { motivo: "ofrecida" as const, vigente: true, venceHora: "10:40", estadoLocal: "nunca" as ET.EstadoTicket, regreso: false, bannerMontado: true, bannerLibreEnMs: 0, vivo: null };
  const eventos: BT.EventoTicket[] = [{ t, tipo: "abierto", motivo: "final" }, { t: t + 1000, tipo: "medido", dentro: false, top: 700, alto: 454, pantalla: 664 }];
  const conEv = DG.lineasDiagnostico({ ...base, eventos });
  const iEv = conEv.indexOf("Últimos eventos:");
  if (iEv < 0 || !/FUERA de la pantalla/.test(conEv[iEv + 1] ?? "") || !/abierto \(final\)/.test(conEv[iEv + 2] ?? "")) F("2a · el recuadro no muestra los eventos, del más nuevo al más viejo");
  // Con el ticket montado —el caso del teléfono— el recuadro llega hasta los disparadores y AHÍ también los muestra.
  const montado = DG.lineasDiagnostico({ ...base, vivo: { abierto: false, pestana: true, disparo: { hecho: true, motivo: "final", pendiente: null, finalFaltaMs: null, lecturaMs: 0, lecturaActiva: false, pasoLaRecomendacion: false } }, eventos });
  if (!/Ticket: cerrado · pestaña visible/.test(montado.join("\n")) || !montado.includes("Últimos eventos:")) F("2a · con el ticket montado el recuadro no muestra los eventos");
  if (!DG.lineasDiagnostico({ ...base, vigente: false, eventos }).includes("Últimos eventos:")) F("2a · con la oferta vencida el recuadro no muestra lo que pasó");
  if (DG.lineasDiagnostico({ ...base, motivo: "no-dueno", eventos }).length !== 1) F("2a · al que no es dueño el recuadro le muestra la bitácora");
  if (!/eventos: leerBitacora\(almacen, analysisId\),/.test(leer("src/components/lo-que-sigue/DiagnosticoTicket.tsx"))) F("2a · el recuadro no lee la bitácora");
  const tk = sinComentarios(leer("src/components/lo-que-sigue/TicketPack.tsx"));
  if (/posthog|capturar/i.test(sinComentarios(leer("src/lib/lo-que-sigue/bitacora-ticket.ts")))) F("2a · la bitácora se manda a PostHog");
  const abrir = cuerpo(tk, "function abrir(");
  const despedirse = cuerpo(tk, "function despedirse(por: PorDondeTicket) {");
  const cerrarDelTodo = cuerpo(tk, "function cerrarDelTodo(por: PorDondeTicket) {");
  if (!/anotar\(\{ tipo: "abierto", motivo: desde === "pestaña" \? "pestaña" : motivo \?\? "\?" \}\);/.test(abrir)) F("2a · al abrirse el ticket no anota el disparador");
  if (!/anotar\(\{ tipo: "despedida", por \}\);/.test(despedirse) || !/anotar\(\{ tipo: "cerrado", por \}\);/.test(cerrarDelTodo)) F("2a · la despedida o el cierre no anotan por dónde");
  const porDonde: Array<[RegExp, string]> = [
    [/className="lqs-x" onClick=\{\(\) => despedirse\("x"\)\}/, "la X"],
    [/className="lqs-seguir" onClick=\{\(\) => despedirse\("seguir"\)\}/, "«Seguir leyendo»"],
    [/className="lqs-tinta" onClick=\{\(\) => cerrarDelTodo\("si-seguir"\)\}/, "«Sí, seguir leyendo»"],
    [/if \(cara === "ticket"\) despedirse\("escape"\);\s*else cerrarDelTodo\("escape"\);/, "Escape"],
    [/if \(cara === "ticket"\) despedirse\("velo"\);\s*else cerrarDelTodo\("velo"\);/, "el velo"],
  ];
  for (const [re, q] of porDonde) if (!re.test(tk)) F(`2a · cerrar por ${q} no queda anotado como tal`);

  // ── 2b · fijo a la pantalla, sin medir el área visible ──────────────────────
  if (/visualViewport|useAncla|area-visible/.test(tk)) F("2b · el ticket vuelve a medir el área visible (en iOS 26 la hoja podía quedar fuera de la pantalla)");
  if (existsSync(join(RAIZ, "src/lib/lo-que-sigue/area-visible.ts"))) F("2b · el ancla al área visible sigue en el repo");
  const importan = archivos("src").filter((p) => /lo-que-sigue\/area-visible/.test(leer(p)));
  if (importan.length) F(`2b · alguien importa el ancla retirada: ${importan.join(", ")}`);
  const css = leer("src/components/lo-que-sigue/lo-que-sigue.css");
  if (!/\.lqs-velo \{ position: fixed; inset: 0;/.test(css)) F("2b · el velo no va fijo a toda la pantalla");
  if (!/\.lqs-pestana \{ position: fixed; left: 50%; bottom: 0;[^}]*padding: 0 16px env\(safe-area-inset-bottom, 0px\);/.test(css)) F("2b · la pestaña no va fija abajo con el margen seguro");
  if (!/\.lqs-tk \{ position: relative; padding: 14px 20px calc\(22px \+ env\(safe-area-inset-bottom, 0px\)\); \}/.test(css)) F("2b · el ticket no deja el margen seguro abajo (el botón queda sobre el indicador de inicio)");

  // ── 2c · el velo no cierra en el primer segundo ni con un gesto que empezó antes ─
  if (ET.GRACIA_VELO_MS !== 1_000) F(`2c · la gracia del velo no es un segundo (${ET.GRACIA_VELO_MS} ms)`);
  const vc = (ahora: number, ultimoToque: number) => ET.veloCierra({ ahora, abiertoEn: 10_000, ultimoToque });
  if (vc(10_400, 10_300) || vc(10_999, 10_900)) F("2c · un toque en el velo en el primer segundo lo cierra");
  if (vc(12_000, 9_500)) F("2c · el final de un gesto que empezó antes de abrirse cierra el velo");
  if (!vc(12_000, 11_900) || !vc(11_000, 11_000)) F("2c · pasado el segundo, un toque nuevo en el velo no lo cierra");
  if (!/abiertoEn\.current = performance\.now\(\);/.test(abrir)) F("2c · al abrirse no se anota cuándo (la gracia no tiene desde dónde contar)");
  const toque = cuerpo(tk, "const toque = () => {");
  if (!/^\s*ultimoToque\.current = performance\.now\(\);\s*$/.test(toque) || !/window\.addEventListener\("pointerdown", toque, \{ capture: true, passive: true \}\);\s*window\.addEventListener\("touchstart", toque, \{ capture: true, passive: true \}\);/.test(tk))
    F("2c · no se anota cuándo empezó el último toque en la página");
  const veloClick = tk.slice(tk.indexOf("onClick={(e) => {\n          if (e.target !== e.currentTarget) return;"), tk.indexOf('<div className="lqs-hoja">'));
  if (!/if \(!veloCierra\(\{ ahora: performance\.now\(\), abiertoEn: abiertoEn\.current, ultimoToque: ultimoToque\.current \}\)\) \{\s*anotar\(\{ tipo: "ignorado", por: "velo" \}\);\s*return;\s*\}\s*if \(cara === "ticket"\) despedirse\("velo"\);/.test(veloClick))
    F("2c · el velo cierra sin consultar la gracia");

  // ── 2d · «ya se mostró» solo si se vio un segundo ───────────────────────────
  if (ET.VISTO_TRAS_MS !== 1_000) F(`2d · «ya se mostró» no espera un segundo en pantalla (${ET.VISTO_TRAS_MS} ms)`);
  const hd = (top: number, height: number) => BT.hojaDentro({ top, bottom: top + height, height }, 664);
  if (!hd(210, 454) || !hd(0, 664)) F("2d · una hoja dentro de la pantalla no cuenta como dentro");
  if (hd(400, 332 + 60) || hd(-80, 454) || hd(700, 300) || hd(0, 0)) F("2d · una hoja fuera de la pantalla (o sin alto) cuenta como vista");
  const subir = cuerpo(tk, "subir: (motivo) => {");
  if (!subir || /marcarTicket/.test(subir)) F("2d · «ya se mostró» se guarda cuando el disparador decide abrir, no cuando se vio");
  if ((tk.match(/marcarTicket\(.*"visto"\)/g) ?? []).length !== 1) F("2d · «ya se mostró» se guarda en más de un lugar");
  const medir = cuerpo(tk, "const t = window.setTimeout(() => {");
  if (!/const dentro = hojaDentro\(r, window\.innerHeight\) && document\.visibilityState === "visible";/.test(medir) || !/if \(dentro && leerEstadoTicket\(almacenLocal\(\), ctx\.analysisId\) === "nunca"\) marcarTicket\(almacenLocal\(\), ctx\.analysisId, "visto"\);/.test(medir) || !/\}, VISTO_TRAS_MS\);\s*return \(\) => window\.clearTimeout\(t\);\s*\}, \[abierto\]\);/.test(tk))
    F("2d · «ya se mostró» no depende de que la hoja esté un segundo dentro de la pantalla (o no se cancela si se cierra antes)");

  // ── 3 · el banner en uso: el campo, el código, un botón o un chip; el scroll no ─
  const ban = sinComentarios(leer("src/components/lo-que-sigue/BannerRegistro.tsx"));
  if (/onPointerDownCapture|onTouchStartCapture|onPointerMoveCapture|onTouchMoveCapture|onScroll|onWheel/.test(ban)) F("3 · un dedo que pasa por encima del banner (o el scroll) lo marca en uso: el ticket espera un minuto más");
  if (!/const esCampo = \(t: EventTarget \| null\) => t instanceof HTMLElement && t\.matches\("input, textarea, select"\);/.test(ban)
    || !/onKeyDownCapture=\{\(e\) => \{ if \(esCampo\(e\.target\)\) marcarUso\(\); \}\}/.test(ban)
    || !/onFocusCapture=\{\(e\) => \{ if \(esCampo\(e\.target\)\) marcarUso\(\); \}\}/.test(ban)
    || !/onInputCapture=\{marcarUso\}/.test(ban)) F("3 · el foco o la escritura en un campo del banner no lo marcan en uso (o lo marca el foco en cualquier cosa)");
  if (!/const esBotonOChip = \(t: EventTarget \| null\) => t instanceof HTMLElement && !!t\.closest\('button, a, \[data-lqs="chip"\]'\);/.test(ban) || !/onClickCapture=\{\(e\) => \{ if \(esBotonOChip\(e\.target\)\) marcarUso\(\); \}\}/.test(ban))
    F("3 · tocar un botón o un chip del banner no lo marca en uso");
  if (!/className="lqs-chip" data-lqs="chip"/.test(ban)) F("3 · los chips del banner no se reconocen como chips");
  const reg = sinComentarios(leer("src/components/lo-que-sigue/RegistroUnPaso.tsx"));
  if (!/usoBanner\.codigoAbierto\(!!enviado\);/.test(reg) || !/onFocus=\{\(\) => usoBanner\.correoConFoco\(true\)\}/.test(reg)) F("3 · abrir el paso del código o el foco en el correo dejaron de marcar el banner en uso");

  if (fallas.length) {
    console.log(`  ✗ TICKET-IOS · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — la hoja de la dirección deja la página en cero, va arriba y su lista hace scroll adentro; el ticket va fijo a la pantalla, el velo tiene un segundo de gracia y no cierra con un gesto previo, «ya se mostró» espera un segundo en pantalla, la bitácora sale en ?lqs=1; el banner solo cuenta como en uso con un campo, el código, un botón o un chip");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  process.exit(runTicketIosTier().hard ? 1 : 0);
}
