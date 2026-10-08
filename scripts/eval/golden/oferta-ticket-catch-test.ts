// ============================================================================
// GOLDEN · LA OFERTA DEL INFORME ANÓNIMO — catch-test (08-oct-2026). 0 tokens, sin base.
// ============================================================================
// Goal «Banner y ticket del informe gratis anónimo» (08-oct-2026), con las tres lecturas que
// aprobó Fabrizio: la salida en PC es el cursor que deja la página por arriba; la oferta persiste
// en el mismo navegador o con sesión («si te vas, guarda el enlace»); una sola vez por informe en
// cada navegador, sin columna nueva.
//
// FIJA:
//   1 · LA OFERTA ES DEL INFORME, NO DE LA SESIÓN: el pack queda en el informe que nació anónimo
//       hasta que venza o se compre, para su dueño —con la cookie, en su navegador de origen sin
//       sesión, o con sesión—, nunca para un enlace ajeno ni el demo. El banner, al dueño sin
//       sesión o recién dentro. Con correo conocido, el ticket no lo pide.
//       (Hasta el 08-oct-2026 los dos colgaban de «dueño anónimo» o de una marca de 30 minutos en la
//       pestaña: un registro en el banner o un pago fallido los hacían desaparecer.)
//   2 · EL PAGO FALLIDO: el informe ya quedó ligado a la cuenta (el pack la crea antes de ir a
//       Flow); de vuelta sin sesión, en su navegador, la oferta sigue con el correo de esa cuenta.
//       Solo un pack PAGADO la apaga: rechazado o pendiente no.
//   3 · LOS TIEMPOS: al pasar «Tu resultado a 10 años», 8 segundos; si no llega, 4 minutos de
//       lectura activa (pestaña visible y actividad en los últimos 30 s); en PC, el cursor que sale
//       por arriba. El primero que llega, una sola vez.
//   4 · EL COPY del banner y del ticket, el del goal.
//   5 · SIN BARRA FIJA; la pestaña sin el degradado; la hoja cerrada no asoma; la despedida no
//       genera scroll.
// Verificado EN ROJO por mutación (actas al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/oferta-ticket-catch-test.ts
// ============================================================================
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(require as any).extensions[".css"] = (m: any) => { m.exports = {}; };

const RAIZ = join(__dirname, "..", "..", "..");
/** Un archivo que no existe se lee vacío: la falla la dice el chequeo, no un error del tier. */
const leer = (p: string) => {
  try {
    return readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
  } catch {
    return "";
  }
};
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

function dibujarConRouter(el: React.ReactElement): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime");
  const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, el));
}

/** Un reloj que avanza a mano, con temporizadores. */
function relojFalso() {
  let t = 0;
  const tareas: { fn: () => void; en: number; vivo: boolean }[] = [];
  return {
    ahora: () => t,
    programar(fn: () => void, ms: number) {
      const h = { fn, en: t + ms, vivo: true };
      tareas.push(h);
      return h;
    },
    cancelar(h: unknown) {
      if (h && typeof h === "object") (h as { vivo: boolean }).vivo = false;
    },
    avanzar(ms: number) {
      const fin = t + ms;
      for (;;) {
        const prox = tareas.filter((x) => x.vivo && x.en <= fin).sort((a, b) => a.en - b.en)[0];
        if (!prox) break;
        t = prox.en;
        prox.vivo = false;
        prox.fn();
      }
      t = fin;
    },
  };
}

/** Un cliente de servicio de mentira: los pagos del informe y el correo del dueño. */
function adminFalso(pagos: { product: string; status: string }[], correoDueno: string | null) {
  const consulta = {
    select() { return consulta; },
    eq() { return consulta; },
    then(ok: (r: { data: unknown; error: null }) => unknown) { return Promise.resolve({ data: pagos, error: null }).then(ok); },
  };
  return {
    from: () => consulta,
    auth: { admin: { getUserById: async () => ({ data: { user: correoDueno ? { email: correoDueno } : null }, error: null }) } },
  };
}

export async function runOfertaTicketTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER OFERTA-TICKET (la oferta es del informe; pago fallido; tiempos; banner y ticket · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const req = (p: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require(p);
    } catch {
      return null;
    }
  };

  const O = req("../../../src/lib/lo-que-sigue/oferta-informe");
  const OS = req("../../../src/lib/lo-que-sigue/oferta-informe-servidor");
  const D = req("../../../src/lib/lo-que-sigue/disparo-ticket");
  const P = req("../../../src/lib/lo-que-sigue/oferta-pack");
  const C = req("../../../src/lib/lo-que-sigue/copy");
  const { BannerRegistro } = req("../../../src/components/lo-que-sigue/BannerRegistro") ?? {};
  const { TicketPack } = req("../../../src/components/lo-que-sigue/TicketPack") ?? {};

  // ── 1 · LA OFERTA ES DEL INFORME ───────────────────────────────────────────
  if (!O) F("1 · no existe `oferta-informe`: la oferta cuelga de la sesión y no del informe");
  else {
    const q = O.quienMiraElInforme;
    if (q({ isAnonOwner: true, isOrigenNavegador: false, isOwner: false }) !== "anonimo") F("1 · el dueño por cookie no se reconoce");
    if (q({ isAnonOwner: false, isOrigenNavegador: true, isOwner: false }) !== "origen") F("1 · el navegador de origen sin sesión no se reconoce");
    if (q({ isAnonOwner: false, isOrigenNavegador: false, isOwner: true }) !== "sesion") F("1 · el dueño con sesión no se reconoce");
    if (q({ isAnonOwner: false, isOrigenNavegador: false, isOwner: false }) !== null) F("1 · un enlace ajeno se trata como dueño");
    if (!O.nacioAnonimo({ anon_claim_token_hash: "h" }) || !O.nacioAnonimo({ anon_origen_hash: "h" }) || O.nacioAnonimo({})) F("1 · «nació anónimo» no lee las dos marcas de la fila");
    const base = { nacioAnonimo: true, quienMira: "anonimo", packPagado: false, esDemo: false };
    for (const quien of ["anonimo", "origen", "sesion"]) {
      if (!O.ofertaPackDelInforme({ ...base, quienMira: quien })) F(`1 · el dueño «${quien}» se queda sin la oferta`);
    }
    if (O.ofertaPackDelInforme({ ...base, quienMira: null })) F("1 · un enlace ajeno ve la oferta");
    if (O.ofertaPackDelInforme({ ...base, packPagado: true })) F("1 · comprado el pack, la oferta sigue");
    if (O.ofertaPackDelInforme({ ...base, nacioAnonimo: false })) F("1 · un informe hecho con sesión ofrece el pack");
    if (O.ofertaPackDelInforme({ ...base, esDemo: true })) F("1 · el demo ofrece el pack");
    const b = O.bannerRegistroVisible;
    if (!b({ quienMira: "anonimo", conSesion: false, recienDentro: false, compartido: false })) F("1 · el anónimo no ve el banner");
    if (!b({ quienMira: "origen", conSesion: false, recienDentro: false, compartido: false })) F("1 · de vuelta sin sesión en su navegador no ve el banner");
    if (b({ quienMira: "sesion", conSesion: true, recienDentro: false, compartido: false })) F("1 · con sesión vuelve a ver «regístrate»");
    if (!b({ quienMira: "sesion", conSesion: true, recienDentro: true, compartido: false })) F("1 · recién dentro, el banner no queda en «Estás dentro»");
    if (b({ quienMira: null, conSesion: false, recienDentro: false, compartido: false })) F("1 · un enlace ajeno ve el banner");
    if (O.correoDelTicket({ recienDentro: "a@b.cl", correoConocido: "c@d.cl" }) !== "a@b.cl" || O.correoDelTicket({ recienDentro: null, correoConocido: "c@d.cl" }) !== "c@d.cl" || O.correoDelTicket({ recienDentro: null, correoConocido: null }) !== null) F("1 · el correo del ticket no es el de quien acaba de entrar o el conocido");
  }
  // Cableado: el servidor calcula la oferta y el cliente la monta; ya no cuelga de «dueño anónimo».
  for (const [nombre, srv, cli, sesion] of [
    ["LTR", "src/app/analisis/[id]/informe-ltr.tsx", "src/app/analisis/[id]/results-client.tsx", "isLoggedIn"],
    ["STR", "src/app/analisis/renta-corta/[id]/informe-str.tsx", "src/app/analisis/renta-corta/[id]/results-client.tsx", "!!userId"],
  ] as const) {
    const s = sinComentarios(leer(srv));
    const c = sinComentarios(leer(cli));
    if (!/const quienMira = [^;]*quienMiraElInforme\(\{ isAnonOwner, isOrigenNavegador, isOwner \}\)/.test(s)) F(`1 · ${nombre}: el servidor no decide quién mira el informe`);
    if (!/const ofertaLqs = await leerOfertaPack\(/.test(s)) F(`1 · ${nombre}: el servidor no calcula la oferta del informe`);
    if (!/ofertaPack[=:] ?\{?ofertaLqs\.oferta\}?/.test(s) || !/correoOferta[=:] ?\{?ofertaLqs\.correo\}?/.test(s) || !/quienMiraLqs[=:] ?\{?quienMira\}?/.test(s)) F(`1 · ${nombre}: la oferta no llega al cliente`);
    const banner = new RegExp(String.raw`const bannerLqs = !!analysisId && bannerRegistroVisible\(\{ quienMira: quienMiraLqs, conSesion: ${sesion.replace(/!/g, "!")}, recienDentro: !!recienDentro, compartido: isSharedView \}\);`);
    if (!banner.test(c)) F(`1 · ${nombre}: el banner no sale de bannerRegistroVisible`);
    if (!/const ticketLqs = !!analysisId && ofertaPack;/.test(c)) F(`1 · ${nombre}: el ticket no sale de la oferta del informe`);
    if (!/despuesDeLaCard=\{bannerLqs \? <BannerRegistro /.test(c)) F(`1 · ${nombre}: el banner no cuelga de bannerLqs`);
    if (!/\{ticketLqs \? \(\s*<TicketPack ctx=\{ctxLqs\} createdAt=\{createdAt\} correoSesion=\{correoDelTicket\(\{ recienDentro, correoConocido: correoOferta \}\)\} \/>/.test(c)) F(`1 · ${nombre}: el ticket no cuelga de ticketLqs con el correo conocido`);
    if (/loQueSigue/.test(c)) F(`1 · ${nombre}: queda el gate viejo «loQueSigue»`);
  }

  // ── 2 · EL PAGO FALLIDO ────────────────────────────────────────────────────
  if (!OS) F("2 · no existe `oferta-informe-servidor`: nada lee los pagos del informe");
  else {
    const fila = { anon_claim_token_hash: null, anon_origen_hash: "h" };
    const fallido = await OS.leerOfertaPack(adminFalso([{ product: "pack3", status: "rejected" }], "dueno@correo.cl"), { analysisId: "a1", fila, quienMira: "origen", esDemo: false, correoSesion: null, duenoId: "u1" });
    if (!fallido.oferta) F("2 · después de un pago rechazado, la oferta desaparece");
    if (fallido.correo !== "dueno@correo.cl") F(`2 · de vuelta del pago fallido, el ticket no trae el correo de la cuenta (${fallido.correo})`);
    const pendiente = await OS.leerOfertaPack(adminFalso([{ product: "pack3", status: "pending" }], "dueno@correo.cl"), { analysisId: "a1", fila, quienMira: "origen", esDemo: false, correoSesion: null, duenoId: "u1" });
    if (!pendiente.oferta) F("2 · un pago pendiente apaga la oferta");
    const pagado = await OS.leerOfertaPack(adminFalso([{ product: "pack3", status: "rejected" }, { product: "pack3", status: "paid" }], "dueno@correo.cl"), { analysisId: "a1", fila, quienMira: "origen", esDemo: false, correoSesion: null, duenoId: "u1" });
    if (pagado.oferta) F("2 · comprado el pack, la oferta sigue");
    const sesion = await OS.leerOfertaPack(adminFalso([], null), { analysisId: "a1", fila, quienMira: "sesion", esDemo: false, correoSesion: "ana@correo.cl", duenoId: "u1" });
    if (!sesion.oferta || sesion.correo !== "ana@correo.cl") F("2 · registrado en el banner, el ticket no trae su correo");
    const anon = await OS.leerOfertaPack(adminFalso([], "x@y.cl"), { analysisId: "a1", fila: { anon_claim_token_hash: "h" }, quienMira: "anonimo", esDemo: false, correoSesion: null, duenoId: null });
    if (!anon.oferta || anon.correo !== null) F("2 · el anónimo sin cuenta no ve la oferta o le aparece un correo");
    const ajeno = await OS.leerOfertaPack(adminFalso([], "x@y.cl"), { analysisId: "a1", fila, quienMira: null, esDemo: false, correoSesion: null, duenoId: "u1" });
    if (ajeno.oferta || ajeno.correo !== null) F("2 · un enlace ajeno ve la oferta o el correo del dueño");
  }
  if (TicketPack) {
    const creado = new Date().toISOString();
    const ctx = { analysisId: "a1", veredicto: "AJUSTA SUPUESTOS", modalidad: "ltr" };
    if (/lqs-tk-correo/.test(dibujarConRouter(createElement(TicketPack, { ctx, createdAt: creado, correoSesion: "dueno@correo.cl" })))) F("2 · con el correo conocido, el ticket lo vuelve a pedir");
    if (!/lqs-tk-correo/.test(dibujarConRouter(createElement(TicketPack, { ctx, createdAt: creado })))) F("2 · sin correo conocido, el ticket no lo pide (el tier no mide)");
  }

  // ── 3 · LOS TIEMPOS ────────────────────────────────────────────────────────
  if (!D) F("3 · no existe `disparo-ticket`: el ticket sube apenas se ve el final");
  else {
    if (D.ESPERA_FINAL_MS !== 8000 || D.LECTURA_ACTIVA_MS !== 240000 || D.INACTIVIDAD_MS !== 30000) F("3 · las esperas no son 8 s, 4 min y 30 s");
    const nuevo = (puede = true) => {
      const reloj = relojFalso();
      const subidas: string[] = [];
      const d = D.crearDisparador({ reloj, puedeSubir: () => puede, subir: (m: string) => subidas.push(m) });
      return { reloj, subidas, d };
    };
    {
      const { reloj, subidas, d } = nuevo();
      d.llegoAlFinal();
      reloj.avanzar(7999);
      if (subidas.length) F("3 · al llegar al final sube antes de los 8 s");
      d.llegoAlFinal();
      reloj.avanzar(1);
      if (subidas.join() !== "final") F(`3 · a los 8 s del final no sube una vez (${subidas.join()})`);
      d.salida({ clientY: 0, haciaFuera: true, pc: true });
      reloj.avanzar(300000);
      if (subidas.length !== 1) F("3 · sube dos veces");
    }
    {
      const { reloj, subidas, d } = nuevo();
      d.actividad();
      for (let s = 1; s <= 239; s++) {
        reloj.avanzar(1000);
        if (s % 10 === 0) d.actividad();
        d.tick(true);
      }
      if (subidas.length) F("3 · sube antes de 4 minutos de lectura");
      reloj.avanzar(1000);
      d.tick(true);
      if (subidas.join() !== "lectura") F(`3 · a los 4 minutos de lectura activa no sube (${subidas.join()})`);
    }
    {
      const { reloj, subidas, d } = nuevo();
      d.actividad();
      for (let s = 1; s <= 300; s++) { reloj.avanzar(1000); d.tick(true); }
      if (subidas.length) F("3 · cuenta como lectura el tiempo sin actividad");
    }
    {
      const { reloj, subidas, d } = nuevo();
      for (let s = 1; s <= 300; s++) { reloj.avanzar(1000); d.actividad(); d.tick(false); }
      if (subidas.length) F("3 · cuenta como lectura la pestaña escondida");
    }
    {
      const casos: [string, { clientY: number; haciaFuera: boolean; pc: boolean }, boolean][] = [
        ["PC, sale por arriba", { clientY: 0, haciaFuera: true, pc: true }, true],
        ["teléfono", { clientY: 0, haciaFuera: true, pc: false }, false],
        ["PC, sale por abajo", { clientY: 600, haciaFuera: true, pc: true }, false],
        ["PC, pasa a otro elemento", { clientY: 0, haciaFuera: false, pc: true }, false],
      ];
      for (const [nombre, ev, sube] of casos) {
        const { subidas, d } = nuevo();
        d.salida(ev);
        if ((subidas.join() === "salida") !== sube) F(`3 · salida (${nombre}): ${sube ? "no sube" : "sube"}`);
      }
    }
    {
      const { reloj, subidas, d } = nuevo(false);
      d.llegoAlFinal();
      reloj.avanzar(9000);
      d.salida({ clientY: 0, haciaFuera: true, pc: true });
      if (subidas.length) F("3 · sube aunque ya subió en este navegador (o la oferta venció)");
    }
    if (D.SELECTOR_FIN_CAPITULOS !== '[data-lqs="fin-capitulos"]') F("3 · la marca del final no es data-lqs=fin-capitulos");
  }
  // Cableado: la marca justo después de los capítulos (el último es «Tu resultado a 10 años»), y el
  // ticket la mira y ya no sube solo al verse.
  const marca = sinComentarios(leer("src/components/lo-que-sigue/FinCapitulos.tsx"));
  if (!/data-lqs="fin-capitulos"/.test(marca)) F("3 · FinCapitulos no dibuja la marca");
  for (const [nombre, f] of [["LTR", "src/components/analysis/SubjectCardGrid.tsx"], ["STR", "src/app/analisis/renta-corta/[id]/results-client.tsx"]] as const) {
    if (!/titulo="Detalle de la inversión"[\s\S]*?<\/SeccionInforme>\s*<FinCapitulos \/>/.test(sinComentarios(leer(f)))) F(`3 · ${nombre}: la marca del final no va justo después de los capítulos`);
  }
  for (const [nombre, f] of [["LTR", "src/components/analysis/CapitulosInversion.tsx"], ["STR", "src/components/analysis/str/CapitulosInversionStr.tsx"]] as const) {
    const ids = [...sinComentarios(leer(f)).matchAll(/id: "([a-z]+)",\s*\n\s*numero:/g)].map((m) => m[1]);
    if (ids[ids.length - 1] !== "resultado") F(`3 · ${nombre}: el último capítulo no es «Tu resultado a 10 años» (${ids.join(",")})`);
  }
  const tk = sinComentarios(leer("src/components/lo-que-sigue/TicketPack.tsx"));
  if (!/crearDisparador\(\{/.test(tk)) F("3 · el ticket no usa el disparador");
  if (!/document\.querySelector\(SELECTOR_FIN_CAPITULOS\)/.test(tk)) F("3 · el ticket no mira la marca del final de los capítulos");
  if (!/if \(enZona\) \{[^}]*d\.llegoAlFinal\(\);/.test(tk)) F("3 · llegar al final no arranca los 8 s");
  if (!/setInterval\(\(\) => d\.tick\(document\.visibilityState === "visible"\), 1000\)/.test(tk)) F("3 · la lectura activa no se cuenta cada segundo con la pestaña visible");
  // La actividad: la lista del módulo, enganchada al disparador. (La primera versión de este chequeo
  // buscaba las palabras sueltas en el ticket y «keydown» pasó en verde por el Escape: presencia no es
  // cableado.)
  if (D && (D.EVENTOS_ACTIVIDAD ?? []).join() !== "scroll,pointermove,keydown,touchstart,wheel") F(`3 · la actividad no es scroll, mouse, teclado, toque y rueda (${(D.EVENTOS_ACTIVIDAD ?? []).join()})`);
  if (!/const actividad = \(\) => d\.actividad\(\);\s*for \(const ev of EVENTOS_ACTIVIDAD\) window\.addEventListener\(ev, actividad, \{ passive: true \}\);/.test(tk)) F("3 · la actividad no está enganchada al disparador");
  if (!/document\.addEventListener\("mouseout", /.test(tk) || !/d\.salida\(\{ clientY: e\.clientY, haciaFuera: !e\.relatedTarget, pc: /.test(tk)) F("3 · la salida por arriba en PC no está cableada");
  if ((tk.match(/abrir\("solo"/g) ?? []).length !== 1 || !/subir: \(motivo\) => \{[\s\S]{0,400}abrir\("solo", motivo\)/.test(tk)) F("3 · el ticket sube por otro camino que el disparador");

  // ── 4 · EL COPY ────────────────────────────────────────────────────────────
  if (P && P.PACK_UNITARIO_CLP !== 4997) F(`4 · el pack no dice $4.997 cada uno (${P?.PACK_UNITARIO_CLP})`);
  if (P?.cuandoVence) {
    const creado = "2026-10-08T00:04:00Z";
    if (P.cuandoVence(creado, new Date("2026-10-08T15:00:00Z")) !== "hoy a las 21:04") F(`4 · el vencimiento de hoy no se dice «hoy a las 21:04» (${P.cuandoVence(creado, new Date("2026-10-08T15:00:00Z"))})`);
    if (P.cuandoVence(creado, new Date("2026-10-07T23:00:00Z")) !== "mañana a las 21:04") F("4 · el vencimiento de mañana no se dice «mañana a las 21:04»");
  } else F("4 · no existe `cuandoVence`");
  if (BannerRegistro) {
    const perfil = { tipologia: "2D1B", comuna: "San Miguel", modalidad: "ltr" };
    const html = dibujarConRouter(createElement(BannerRegistro, { ctx: { analysisId: "a1", veredicto: "BUSCAR OTRA", modalidad: "ltr" }, next: "/analisis/a1", perfil }));
    const t = texto(html);
    for (const frase of [
      "Gratis · solo con tu correo",
      "Los deptos que convienen como inversión se van rápido. Regístrate y Franco te manda cada semana una selección según tu perfil.",
      "Deptos publicados que dan Comprar con tu pie y tu plazo, chequeados ese mismo día.",
      "Quiero recibirlos",
    ]) if (!t.includes(frase)) F(`4 · el banner no dice «${frase}»`);
    if (/Quiero acceso|Lo que sigue/.test(t)) F("4 · el banner conserva el copy viejo");
    if (/data-lqs="barra"/.test(html)) F("5 · el banner sigue con la barra fija");
  }
  if (TicketPack && P?.cuandoVence) {
    const creado = new Date().toISOString();
    const html = dibujarConRouter(createElement(TicketPack, { ctx: { analysisId: "a1", veredicto: "COMPRAR", modalidad: "ltr" }, createdAt: creado }));
    const t = texto(html);
    if (!/Pack · 3 análisis por \$14\.990 · <s>\$9\.990<\/s> \$4\.997 cada uno/.test(html)) F("4 · la primera línea del ticket no es «Pack · 3 análisis por $14.990 · $9.990 $4.997 cada uno» con el $9.990 tachado");
    if (!t.includes("El mismo informe que acabas de leer, para tres deptos más. La mitad del precio, solo para usuarios nuevos.")) F("4 · el ticket no dice qué es el pack");
    if (!/<b[^>]*>Al comprar quedas registrado y además recibes cada semana oportunidades que puedes evaluar con tu pack\.<\/b>/.test(html)) F("4 · la línea del registro no va en negrita");
    if (!/>Comprar por \$14\.990</.test(html)) F("4 · el botón no dice «Comprar por $14.990»");
    const vence = `Solo para usuarios nuevos, en este informe · hasta ${P.cuandoVence(creado)} · si te vas, guarda el enlace`;
    if (!t.includes(vence)) F(`4 · el vencimiento no dice «${vence}»`);
    if (/Quiero los 3 análisis[^<]*<\/button>\s*<p class="lqs-tk-pie"|Incluye una selección|Revísalos hoy/.test(html)) F("4 · el ticket conserva el copy viejo");
  }

  // ── 5 · SIN BARRA; PESTAÑA, HOJA Y DESPEDIDA ───────────────────────────────
  const css = sinComentarios(leer("src/components/lo-que-sigue/lo-que-sigue.css"));
  if (/\.lqs-barra/.test(css)) F("5 · el CSS conserva la barra fija");
  if (/lqs-pestana-franja/.test(css + tk) || /<button[^>]*lqs-pestana[\s\S]{0,300}lqs-franja/.test(tk)) F("5 · la pestaña conserva el degradado");
  if (!/\.lqs-velo:not\(\[data-abierto="1"\]\) \.lqs-hoja \{[^}]*visibility: hidden/.test(css)) F("5 · la hoja cerrada puede asomar abajo (no se esconde)");
  if (!/\.lqs-tk \.lqs-cara\[data-activa="0"\] \{[^}]*overflow: hidden/.test(css)) F("5 · la despedida genera scroll (la cara escondida se desborda)");
  const est = sinComentarios(leer("src/lib/lo-que-sigue/estado-ui.ts"));
  if (/queVaAbajo/.test(est)) F("5 · queda `queVaAbajo`, que solo decidía la barra");

  if (fallas.length) {
    console.log(`  ✗ OFERTA-TICKET · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 50)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — la oferta es del informe (anónimo, de vuelta sin sesión, con sesión; no el enlace ajeno ni el comprado), sigue después de un pago fallido con el correo de la cuenta, sube a los 8 s del final, a los 4 min de lectura o al salir por arriba en PC, una vez; el copy del goal; sin barra fija");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runOfertaTicketTier().then((r) => process.exit(r.hard ? 1 : 0));
}

// ACTAS DE MUTACIÓN (08-oct-2026) — cada una aplicada sobre el código arreglado, corrida contra este
// tier y restaurada desde una copia en memoria. Las 22 en ROJO; restauradas, VERDE. Antes del arreglo
// el tier dio 45 fallas sobre master (fde14d23). Una debilidad del propio tier se corrigió en el camino:
// «keydown» pasaba en verde por el Escape del ticket (presencia no es cableado); ahora se exige la lista
// del módulo enganchada al disparador.
//    N1  la oferta vuelve a ser solo del anónimo          N12 la marca del final no está en LTR
//    N2  un pago rechazado cuenta como pagado             N13 vuelven los $5.000
//    N3  sin sesión no trae el correo de la cuenta        N14 el banner con la primera línea vieja
//    N4  el ticket LTR vuelve al gate de sesión           N15 la hoja cerrada asoma
//    N5  el servidor STR no decide quién mira             N16 la despedida da scroll
//    N6  sin espera al final                              N17 vuelve la barra
//    N7  cuenta lectura sin actividad                     N18 el banner se ofrece con sesión
//    N8  cuenta lectura con la pestaña escondida          N19 el correo ignora a quien acaba de entrar
//    N9  la salida también en teléfono                    N20 el vencimiento sin «guarda el enlace»
//    N10 sube dos veces                                   N21 el ticket sin la negrita
//    N11 sube apenas se ve el final                       N22 la pestaña vuelve con el degradado
