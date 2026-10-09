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
  const { EstasDentro } = req("../../../src/components/lo-que-sigue/EstasDentro") ?? {};
  // PISO DE COBERTURA (08-oct-2026, segunda pasada): `req` es tolerante para que el tier corriera antes de
  // que existieran los módulos, y eso hacía que un módulo que no carga —un JSX roto— SALTARA en verde todas
  // las secciones que lo usan (la mutación S24 lo mostró: sin el visto, el componente no compilaba y la
  // sección 8 no corrió). Ahora que existen, que no cargue es una falla.
  for (const [nombre, m] of [["oferta-informe", O], ["oferta-informe-servidor", OS], ["disparo-ticket", D], ["oferta-pack", P], ["copy", C], ["BannerRegistro", BannerRegistro], ["TicketPack", TicketPack], ["EstasDentro", EstasDentro]] as const) {
    if (!m) F(`0 · no carga ${nombre}: las secciones que lo usan no corrieron`);
  }

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
    // EL SALTO (08-oct-2026): la persona salta de golpe más allá de «Tu resultado a 10 años» (la tecla Fin,
    // un ancla) y la marca queda POR ENCIMA de la pantalla sin haberla cruzado; el observer no avisa (de no
    // visible a no visible no hay cruce). Reproducido en /dev/lo-que-sigue: marca a −1.500 px, ticket
    // cerrado a los 12 s. Cuenta como que la pasó y corren los 8 s: al desplazarse se mira dónde quedó.
    if (typeof D.marcaAlcanzada !== "function" || typeof D.crearVigiaZona !== "function") F("3 · saltar más allá de la marca del final no cuenta como haberla pasado (no existe `marcaAlcanzada`/`crearVigiaZona`)");
    else {
      if (D.marcaAlcanzada(1733, 900)) F("3 · la marca todavía bajo la pantalla cuenta como alcanzada");
      if (!D.marcaAlcanzada(400, 900)) F("3 · la marca en pantalla no cuenta como alcanzada");
      if (!D.marcaAlcanzada(-1500, 900)) F("3 · la marca por encima de la pantalla (saltó más allá) no cuenta como pasada");
      const { reloj, subidas, d } = nuevo();
      const cambios: boolean[] = [];
      const vigia = D.crearVigiaZona((enZona: boolean) => { cambios.push(enZona); if (enZona) d.llegoAlFinal(); });
      vigia.revisar(false); // el observer al montar: la marca está abajo
      vigia.revisar(D.marcaAlcanzada(-1500, 900)); // el salto: el observer calla; el scroll mira dónde quedó
      vigia.revisar(D.marcaAlcanzada(-1600, 900)); // más scroll en la zona: no vuelve a avisar
      reloj.avanzar(7999);
      if (subidas.length) F("3 · después del salto sube antes de los 8 s");
      reloj.avanzar(1);
      if (subidas.join() !== "final") F(`3 · después de saltar más allá de la marca, el ticket no sube a los 8 s (${subidas.join() || "nunca"})`);
      if (cambios.join() !== "false,true") F(`3 · la vigía de la zona avisa de más o de menos (${cambios.join()})`);
    }
    {
      const tkSalto = sinComentarios(leer("src/components/lo-que-sigue/TicketPack.tsx"));
      // ⚠ ACTA (08-oct-2026, la recomendación) · el scroll mira las DOS marcas con `revisarMarcas` (la regla de
      // la del final se prueba sobre esa función más abajo, en §7); el cableado pasa las dos.
      // ⚠ ACTA (09-oct-2026, tareas largas) · las marcas se miden en la PÁGINA al montar y cuando cambia su alto, y
      // el scroll las mira una vez por cuadro restando `scrollY`: la regla es la misma (un salto cuenta), la mecánica
      // la fija TAREAS-LARGAS §2.
      if (!/window\.addEventListener\("scroll", alDesplazar, \{ passive: true \}\)/.test(tkSalto) || !/revisarMarcas\(\{ finTop: finEnPagina - y, recoTop: recoEnPagina === null \? null : recoEnPagina - y, alto: window\.innerHeight \}, vigia, d\);/.test(tkSalto)) F("3 · el ticket no mira dónde quedaron las marcas al desplazarse (un salto no cuenta)");
      if (!/vigia\.revisar\(e\.isIntersecting \|\| e\.boundingClientRect\.top < 0\)/.test(tkSalto)) F("3 · el observer de la marca no pasa por la misma vigía que el scroll");
      if (!/window\.removeEventListener\("scroll", alDesplazar\)/.test(tkSalto)) F("3 · el scroll de la marca no se suelta al desmontar");
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
        // Desde la segunda pasada la salida exige haber pasado la recomendación (§7): acá se da por pasada.
        d.pasoLaRecomendacion();
        d.salida(ev);
        if ((subidas.join() === "salida") !== sube) F(`3 · salida (${nombre}): ${sube ? "no sube" : "sube"}`);
      }
    }
    {
      const { reloj, subidas, d } = nuevo(false);
      d.llegoAlFinal();
      reloj.avanzar(9000);
      d.pasoLaRecomendacion();
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
  // ⚠ ACTA (08-oct-2026, el salto) · la zona la decide una vigía que comparten el observer y el scroll; la
  // regla es la misma: entrar a la zona arranca los 8 s.
  if (!/const vigia = crearVigiaZona\(\(enZona\) => \{\s*setZonaCierre\(enZona\);\s*if \(!enZona\) return;\s*d\.llegoAlFinal\(\);/.test(tk)) F("3 · llegar al final no arranca los 8 s");
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
    // (08-oct-2026, segunda pasada) la jerarquía nueva: «Accede gratis» en negrita en la línea de arriba; el
    // titular solo con la urgencia; el registro en negrita debajo; la bajada en gris; chips y botón.
    for (const frase of [
      "Accede gratis · solo con tu correo",
      "Los deptos que convienen como inversión se van rápido.",
      "Regístrate y Franco te manda cada semana una selección según tu perfil.",
      "Deptos publicados que dan Comprar con tu pie y tu plazo, chequeados ese mismo día.",
      "Quiero recibirlos",
    ]) if (!t.includes(frase)) F(`4 · el banner no dice «${frase}»`);
    if (/Quiero acceso|Lo que sigue/.test(t)) F("4 · el banner conserva el copy viejo");
    if (!/<p class="lqs-ojo"><b>Accede gratis<\/b> · solo con tu correo<\/p>/.test(html)) F("4 · la línea de arriba no lleva «Accede gratis» en negrita y el resto normal");
    if (!/<h3 class="lqs-h3 lqs-h3-lead">Los deptos que convienen como inversión se van rápido\.<\/h3>/.test(html)) F("4 · el titular no es solo «Los deptos que convienen como inversión se van rápido.»");
    if (!/<p class="lqs-banner-registro"><b>Regístrate y Franco te manda cada semana una selección según tu perfil\.<\/b><\/p>/.test(html)) F("4 · «Regístrate y Franco te manda…» no va debajo del titular en negrita");
    if (!/<p class="lqs-cuerpo lqs-gris">Deptos publicados/.test(html)) F("4 · la bajada no va en gris");
    if (!/<div class="lqs-fila-accion">\s*<div class="lqs-parati"[\s\S]*?<\/div>\s*<button type="button" class="lqs-btn"/.test(html)) F("4 · los chips «Para ti» y el botón no van en la misma fila");
    if (/data-lqs="barra"/.test(html)) F("5 · el banner sigue con la barra fija");
  }
  if (TicketPack && P?.cuandoVence) {
    const creado = new Date().toISOString();
    const html = dibujarConRouter(createElement(TicketPack, { ctx: { analysisId: "a1", veredicto: "COMPRAR", modalidad: "ltr" }, createdAt: creado }));
    const t = texto(html);
    // ⚠ ACTA (08-oct-2026, tercera pasada) · el titular en UNA línea, «Pack · 3 análisis por $14.990»; debajo,
    // más chico, «$9.990 $4.997 cada uno» con la referencia tachada; el cuerpo en un solo tamaño, tres
    // líneas con salto entre ellas. Se deroga también la línea única «<b>Pack…</b> · <s>$9.990</s> $4.997
    // cada uno».
    // ⚠ ACTA (08-oct-2026, corrección de Fabrizio) · la línea 1 normal y las líneas 2 y 3 ENTERAS en negrita,
    // en el mismo tamaño que la 1. Deroga el «sin negrita» de 24dfe83a (que leyó un texto sin marcas).
    if (!/<p class="lqs-tk-titular" data-lqs="ticket-linea">Pack · 3 análisis por \$14\.990<\/p>/.test(html)) F("4 · el titular del ticket no es «Pack · 3 análisis por $14.990» solo");
    if (!/<p class="lqs-tk-precio"><s>\$9\.990<\/s> \$4\.997 cada uno<\/p>/.test(html)) F("4 · debajo del titular no va «$9.990 $4.997 cada uno», con el $9.990 tachado");
    if (!/<p class="lqs-tk-cuerpo">El mismo informe que acabas de leer, para tres deptos más\.<br\/><b>La mitad del precio, solo para usuarios nuevos\.<\/b><br\/><b>Al comprar quedas registrado y además recibes cada semana oportunidades que puedes evaluar con tu pack\.<\/b><\/p>/.test(html)) F("4 · el cuerpo del ticket no es: línea 1 normal, líneas 2 y 3 enteras en negrita, con salto entre ellas");
    {
      // Un solo tamaño: la negrita del cuerpo solo cambia el peso.
      const cssTk = sinComentarios(leer("src/components/lo-que-sigue/lo-que-sigue.css"));
      const reglaB = cssTk.match(/\.lqs-tk \.lqs-tk-cuerpo b \{([^}]*)\}/)?.[1] ?? "";
      if (/font-size|font:/.test(reglaB)) F("4 · la negrita del cuerpo del ticket cambia el tamaño (tiene que ser uno solo)");
      if (/font-weight:\s*(normal|[1-5]00)\b/.test(reglaB)) F("4 · la negrita del cuerpo del ticket no es negrita (peso bajo 600)");
    }
    if (/lqs-tk-negrita/.test(html)) F("4 · el ticket conserva un segundo tamaño de cuerpo (lqs-tk-negrita)");
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

  // ── 6 · EL TICKET ESPERA MIENTRAS EL BANNER ESTÁ EN USO (08-oct-2026) ──────────────────────
  // ⚠ ACTA (08-oct-2026, tercera pasada) · la regla es UNA: el banner está en uso durante 60 s desde la
  // última actividad en él —escribir, foco, abrir el paso del código—, y ningún ESTADO lo retiene. Hasta
  // la segunda pasada el correo con foco y el paso del código abierto contaban como uso SIN LÍMITE: con
  // el código pedido y sin completar, el ticket no salía nunca (reproducido en /dev/lo-que-sigue: cerrado
  // 75 s después del final y al salir por arriba). Dejar el correo o cerrar el código no es actividad:
  // los chequeos de la segunda pasada que contaban el minuto desde el blur se derogan con esto.
  const U = req("../../../src/lib/lo-que-sigue/uso-banner");
  if (!U) F("6 · no existe `uso-banner`: el ticket puede taparle el registro a quien está escribiendo su correo");
  else {
    if (U.QUIETUD_BANNER_MS !== 60000) F("6 · la quietud del banner no es de 60 s");
    let t = 0;
    const u = U.crearUsoBanner(() => t);
    if (u.enUso()) F("6 · sin tocarlo, el banner figura en uso");
    u.actividad();
    t = 59999;
    if (!u.enUso()) F("6 · a los 59 s de la última actividad el banner ya no figura en uso");
    t = 60000;
    if (u.enUso()) F("6 · a los 60 s sin actividad el banner sigue en uso");
    u.correoConFoco(true);
    t = 119999;
    if (!u.enUso()) F("6 · el foco en el correo no cuenta como actividad");
    t = 120000;
    if (u.enUso()) F("6 · el correo con foco retiene el banner más de 60 s sin actividad");
    u.correoConFoco(false);
    if (u.enUso()) F("6 · dejar el correo cuenta como actividad (la regla: escribir, foco o abrir el código)");
    u.codigoAbierto(true);
    t = 179999;
    if (!u.enUso()) F("6 · abrir el paso del código no cuenta como actividad");
    t = 180000;
    if (u.enUso()) F("6 · el paso del código abierto retiene el banner más de 60 s sin actividad: el ticket no sale nunca");
    u.codigoAbierto(false);
    if (u.enUso()) F("6 · cerrar el paso del código cuenta como actividad");
  }
  if (D) {
    const conEspera = (ocupado: { v: boolean }) => {
      const reloj = relojFalso();
      const subidas: string[] = [];
      const d = D.crearDisparador({ reloj, puedeSubir: () => true, subir: (m: string) => subidas.push(m), enEspera: () => ocupado.v });
      return { reloj, subidas, d };
    };
    {
      const ocupado = { v: true };
      const { reloj, subidas, d } = conEspera(ocupado);
      d.llegoAlFinal();
      reloj.avanzar(9000);
      d.tick(true);
      if (subidas.length) F("6 · el ticket sube con el banner en uso");
      ocupado.v = false;
      reloj.avanzar(1000);
      d.tick(true);
      if (subidas.join() !== "final") F(`6 · liberado el banner, el ticket no sale (${subidas.join()})`);
    }
    {
      const ocupado = { v: true };
      const { reloj, subidas, d } = conEspera(ocupado);
      d.actividad();
      for (let s = 1; s <= 250; s++) { reloj.avanzar(1000); if (s % 10 === 0) d.actividad(); d.tick(true); }
      if (subidas.length) F("6 · la lectura sube el ticket con el banner en uso");
      ocupado.v = false;
      reloj.avanzar(1000);
      d.actividad();
      d.tick(true);
      if (subidas.join() !== "lectura") F(`6 · la lectura no siguió contando mientras el banner estaba en uso (${subidas.join()})`);
    }
    // EL CASO EXACTO (tercera pasada), con el banner de verdad y no un `ocupado` de mentira: escribe el
    // correo, pide el código y deja el paso del código abierto sin completar; llega al final y espera, o
    // sale por arriba. Las llamadas son las de los componentes, en su orden.
    if (U) {
      const caso = () => {
        const reloj = relojFalso();
        const u = U.crearUsoBanner(() => reloj.ahora());
        const subidas: string[] = [];
        const d = D.crearDisparador({ reloj, puedeSubir: () => true, subir: (m: string) => subidas.push(m), enEspera: () => u.enUso() });
        u.correoConFoco(true); // RegistroUnPaso: onFocus del correo
        u.actividad(); // BannerRegistro: las teclas del correo (captura)
        u.codigoAbierto(false); // RegistroUnPaso: al mandar, el efecto anterior se limpia…
        u.correoConFoco(false);
        u.codigoAbierto(true); // …y se abre el paso del código
        return { reloj, subidas, d };
      };
      {
        const { reloj, subidas, d } = caso();
        d.llegoAlFinal();
        for (let s = 1; s <= 59; s++) { reloj.avanzar(1000); d.tick(true); }
        if (subidas.length) F("6 · con el código recién pedido, el ticket sube antes del minuto");
        for (let s = 60; s <= 61; s++) { reloj.avanzar(1000); d.tick(true); }
        if (subidas.join() !== "final") F(`6 · código pedido y paso abierto sin completar: un minuto sin actividad y el ticket no sale al final (${subidas.join() || "nunca"})`);
      }
      {
        const { reloj, subidas, d } = caso();
        d.pasoLaRecomendacion();
        for (let s = 1; s <= 61; s++) { reloj.avanzar(1000); d.tick(true); }
        d.salida({ clientY: 0, haciaFuera: true, pc: true });
        if (subidas.join() !== "salida") F(`6 · código pedido y paso abierto sin completar: un minuto sin actividad y la salida por arriba no sube el ticket (${subidas.join() || "nunca"})`);
      }
    }
    // ── 7 · LA SALIDA POR ARRIBA, SOLO DESPUÉS DE LA RECOMENDACIÓN O DE 60 S DE LECTURA ───────
    if (D.LECTURA_PARA_SALIDA_MS !== 60000) F("7 · la lectura que habilita la salida no es de 60 s");
    const pc = { clientY: 0, haciaFuera: true, pc: true };
    {
      const { subidas, d } = conEspera({ v: false });
      d.salida(pc);
      if (subidas.length) F("7 · la salida sube el ticket sin haber pasado la recomendación ni leído 60 s");
      if (typeof d.pasoLaRecomendacion === "function") d.pasoLaRecomendacion();
      else F("7 · el disparador no sabe si se pasó la recomendación");
      d.salida(pc);
      if (subidas.join() !== "salida") F("7 · pasada la recomendación, la salida no sube el ticket");
    }
    {
      const { reloj, subidas, d } = conEspera({ v: false });
      d.actividad();
      for (let s = 1; s <= 59; s++) { reloj.avanzar(1000); d.actividad(); d.tick(true); }
      d.salida(pc);
      if (subidas.length) F("7 · con 59 s de lectura la salida ya sube el ticket");
      reloj.avanzar(1000); d.actividad(); d.tick(true);
      d.salida(pc);
      if (subidas.join() !== "salida") F("7 · con 60 s de lectura la salida no sube el ticket");
    }
    if (D.SELECTOR_FIN_RECOMENDACION !== '[data-lqs="fin-recomendacion"]') F("7 · la marca del final de la recomendación no es data-lqs=fin-recomendacion");
    // EL SALTO SOBRE LA RECOMENDACIÓN (08-oct-2026): la marca de la recomendación queda por encima de la
    // pantalla sin cruzarla y el observer no avisa. Reproducido en /dev/lo-que-sigue (ventana de 240 px: la
    // marca abajo al cargar, a −400 después del salto, el final todavía abajo): la salida por arriba no
    // abría el ticket. Cuenta como pasada: al desplazarse se miran las dos marcas (`revisarMarcas`).
    if (typeof D.revisarMarcas !== "function") F("7 · saltar más allá de la recomendación no cuenta como haberla pasado (no existe `revisarMarcas`)");
    else {
      {
        const { subidas, d } = conEspera({ v: false });
        const vigia = D.crearVigiaZona(() => {});
        vigia.revisar(false);
        D.revisarMarcas({ finTop: 1046, recoTop: 287, alto: 240 }, vigia, d); // al cargar: las dos abajo
        d.salida(pc);
        if (subidas.length) F("7 · la recomendación todavía bajo la pantalla cuenta como pasada");
        D.revisarMarcas({ finTop: 1046, recoTop: -400, alto: 240 }, vigia, d); // el salto: la recomendación arriba, el final abajo
        d.salida(pc);
        if (subidas.join() !== "salida") F(`7 · después de saltar más allá de la recomendación, la salida por arriba no sube el ticket (${subidas.join() || "nunca"})`);
      }
      {
        // La misma función cubre el salto sobre el final (§3): sin recomendación en la página, también.
        const { reloj, subidas, d } = conEspera({ v: false });
        const vigia = D.crearVigiaZona((en: boolean) => { if (en) d.llegoAlFinal(); });
        vigia.revisar(false);
        D.revisarMarcas({ finTop: -1500, recoTop: null, alto: 900 }, vigia, d);
        reloj.avanzar(8000);
        if (subidas.join() !== "final") F(`7 · \`revisarMarcas\` no cuenta el salto sobre el final (${subidas.join() || "nunca"})`);
      }
    }
  }
  if (!/enEspera: \(\) => usoBanner\.enUso\(\)/.test(tk)) F("6 · el ticket no espera al banner");
  if (!/document\.querySelector\(SELECTOR_FIN_RECOMENDACION\)/.test(tk) || !/d\.pasoLaRecomendacion\(\)/.test(tk)) F("7 · el ticket no mira si ya se pasó la recomendación");
  {
    const bannerSrc = sinComentarios(leer("src/components/lo-que-sigue/BannerRegistro.tsx"));
    for (const ev of ["onPointerDownCapture", "onKeyDownCapture", "onInputCapture", "onFocusCapture"]) {
      if (!new RegExp(`${ev}=\\{marcarUso\\}`).test(bannerSrc)) F(`6 · la actividad en el banner no se marca (${ev})`);
    }
    if (!/const marcarUso = \(\) => usoBanner\.actividad\(\);/.test(bannerSrc)) F("6 · el banner no marca su uso en usoBanner");
    const reg = sinComentarios(leer("src/components/lo-que-sigue/RegistroUnPaso.tsx"));
    if (!/onFocus=\{\(\) => usoBanner\.correoConFoco\(true\)\}/.test(reg) || !/onBlur=\{\(\) => usoBanner\.correoConFoco\(false\)\}/.test(reg)) F("6 · el foco del correo no se avisa al ticket");
    if (!/usoBanner\.codigoAbierto\(!!enviado\);/.test(reg) || !/return \(\) => \{\s*usoBanner\.codigoAbierto\(false\);\s*usoBanner\.correoConFoco\(false\);/.test(reg)) F("6 · el paso del código abierto no se avisa al ticket (o queda marcado al desmontar)");
  }
  for (const [nombre, f] of [["LTR", "src/components/analysis/HeroLTR.tsx"], ["STR", "src/components/analysis/str/HeroStrDictamen.tsx"]] as const) {
    if (!/\{recomendacion\}\s*<\/SeccionInforme>\s*<FinRecomendacion \/>\s*\{despuesDeLaCard\}/.test(sinComentarios(leer(f)))) F(`7 · ${nombre}: la marca del final de la recomendación no va justo después de la card`);
  }

  // ── 8 · «ESTÁS DENTRO» Y EL «CUÁNDO» CON ESTADO (08-oct-2026, segunda pasada) ─────────────
  if (C) {
    const E = C.ESTAS_DENTRO;
    if (E.anotado !== "Anotado · toca para cambiar" || E.avisoYa !== "Te avisamos el mismo día que aparezca uno") F("8 · «Anotado · toca para cambiar» o el aviso de «Ya» no son los aprobados");
    if (typeof C.notaCuando !== "function" || C.notaCuando(null) !== null || C.notaCuando("ya") !== E.avisoYa || C.notaCuando("meses") !== E.anotado || C.notaCuando("mirando") !== E.anotado) F("8 · la nota del «cuándo» no es nada antes de elegir, el aviso con «Ya» y «Anotado…» con las otras");
    if (typeof C.notaChips !== "function" || C.notaChips(false) !== E.tocaCambiar || C.notaChips(true) !== E.anotado) F("8 · los chips no pasan de «toca para cambiar» a «Anotado · toca para cambiar» al cambiarse");
  }
  if (EstasDentro) {
    const ctx = { analysisId: "a1", veredicto: "COMPRAR", modalidad: "ltr" };
    const perfil = { tipologia: "2D1B", comuna: "San Miguel", modalidad: "ltr" };
    const sin = dibujarConRouter(createElement(EstasDentro, { ctx, perfil, demo: true }));
    if (/Anotado|Te avisamos/.test(sin) || /lqs-visto/.test(sin)) F("8 · antes de elegir ya dice «Anotado» o marca una opción");
    if ((sin.match(/class="lqs-opcion"/g) ?? []).length !== 3) F("8 · las tres opciones no van con su estilo (borde)");
    const ya = dibujarConRouter(createElement(EstasDentro, { ctx, perfil, demo: true, horizonteInicial: "ya" }));
    if (!/data-activa="1"[^>]*><span class="lqs-visto" aria-hidden="true">✓<\/span>Ya</.test(ya)) F("8 · la opción elegida no lleva el visto");
    if (!/<span class="lqs-toca lqs-anotado"[^>]*>Te avisamos el mismo día que aparezca uno<\/span>/.test(ya)) F("8 · con «Ya» no dice «Te avisamos el mismo día que aparezca uno»");
    const meses = dibujarConRouter(createElement(EstasDentro, { ctx, perfil, demo: true, horizonteInicial: "meses" }));
    if (!/<span class="lqs-toca lqs-anotado"[^>]*>Anotado · toca para cambiar<\/span>/.test(meses)) F("8 · al elegir no dice «Anotado · toca para cambiar»");
    if ((meses.match(/lqs-visto/g) ?? []).length !== 1) F("8 · más de una opción marcada");
    const ed = sinComentarios(leer("src/components/lo-que-sigue/EstasDentro.tsx"));
    if (!/\{notaChips\(chipsCambiados\)\}/.test(ed) || !/setChipsCambiados\(true\)/.test(ed)) F("8 · los chips no dicen «Anotado» después de cambiarse");
  }
  const cssDentro = sinComentarios(leer("src/components/lo-que-sigue/lo-que-sigue.css"));
  if (!/\.lqs-opcion\[data-activa="1"\] \{[^}]*background: #FAFAF8/.test(cssDentro) || !/\.lqs-opcion \{[^}]*background: none/.test(cssDentro)) F("8 · la opción elegida no va con relleno y las otras solo con borde");
  // El alto (≤ 360 px en PC) se mide en el navegador; acá queda la fila de PC, que es lo que más lo baja.
  // ⚠ ACTA (08-oct-2026, cuarta pasada) · «Quiero recibirlos» va SOLO, en la fila siguiente a los chips y
  // alineado a la izquierda, en PC y en teléfono. Deroga la fila única de chips y botón en PC (segunda pasada).
  if (!/\.lqs-fila-accion \{ display: flex; flex-direction: column; align-items: flex-start;/.test(cssDentro) || /\.lqs-fila-accion \{[^}]*flex-direction: row/.test(cssDentro)) F("4 · «Quiero recibirlos» no va solo en la fila siguiente a los chips, a la izquierda (PC o teléfono)");
  // ⚠ ACTA (cuarta pasada) · la columna del banner es la del informe: el padding horizontal es el ESPEJO del
  // margen que lo lleva de borde a borde (`calc(50vw - 50%)`, con el % del contenedor del informe), así el
  // contenido empieza y termina donde el `.doc-page` en cualquier ancho. Ningún paso pisa ese padding con
  // un `padding:` corto, y la columna no se ensancha (sale el 880 px de la segunda pasada).
  {
    if (!/\.lqs-banner \{ margin: 0 calc\(50% - 50vw\) 34px; padding: 32px calc\(50vw - 50%\) 30px; \}/.test(cssDentro) || !/\.lqs-banner \{ padding: 52px calc\(50vw - 50%\) 48px; \}/.test(cssDentro)) F("4 · el padding horizontal del banner no es el espejo de su margen (la columna no es la del informe)");
    // Solo las reglas cuyo selector ES el banner (uno o varios pasos), no las de sus hijos.
    const reglasPaso = cssDentro.match(/(?:^|[}\n])\s*\.lqs-banner\[data-paso="[a-z]+"\](?:\s*,\s*\.lqs-banner\[data-paso="[a-z]+"\])*\s*\{[^}]*\}/g) ?? [];
    if (reglasPaso.length < 2) F("4 · no encuentro las reglas de padding de los pasos del banner (el chequeo no corrió)");
    if (reglasPaso.some((r) => /[{;]\s*padding:/.test(r))) F("4 · un paso del banner pisa el padding horizontal con un `padding:` corto");
    if (/\.lqs-banner \.lqs-col \{[^}]*max-width: 880px/.test(cssDentro)) F("4 · la columna del banner sigue ensanchada a 880 px");
  }

  // ── 9 · TODOS LOS PASOS DEL BANNER CON EL ALTO DEL PRIMERO (08-oct-2026, tercera pasada) ─────
  // El banner mide la oferta y se la pone de alto mínimo a los pasos siguientes; el CSS compacto hace que
  // ninguno la pase (eso se mide en el navegador: PC 213 px, teléfono 311). Acá: el cableado, que la
  // medida no la tome un paso que no es la oferta, y la columna a lo ancho (sin ella se encogía al
  // contenido y en teléfono el paso del correo se desbordaba).
  {
    const br = sinComentarios(leer("src/components/lo-que-sigue/BannerRegistro.tsx"));
    if (!/style=\{paso !== "oferta" && altoOferta \? \{ minHeight: altoOferta \} : undefined\}/.test(br)) F("9 · los pasos siguientes no toman el alto de la oferta");
    if (!/if \(el\.dataset\.paso === "oferta"\) setAltoOferta\(el\.offsetHeight\);/.test(br)) F("9 · el alto puede medirse en un paso que no es la oferta (crece paso a paso)");
    if (!/\.lqs-banner \{ display: flex; flex-direction: column; justify-content: center; \}/.test(cssDentro) || !/\.lqs-banner \.lqs-col \{ width: 100%; \}/.test(cssDentro)) F("9 · el banner no centra el paso en su alto o la columna no va a lo ancho");
    if (!/\.lqs-banner\[data-paso="registro"\] \.lqs-h3 \{[^}]*font-size: 22px/.test(cssDentro)) F("9 · el registro conserva el titular grande del banner viejo");
  }

  // ── 10 · EL PIE DE LOS DOS INFORMES, LIMPIO (08-oct-2026, tercera pasada) ──────────────────
  // Solo el wordmark y el aviso. Sin la frase de marca (mono, mayúsculas espaciadas) ni los enlaces Cómo
  // calcula, Comunas y Planes. Renta larga no tenía pie (ni el aviso); renta corta usaba el del sitio.
  {
    const { AppFooter, DISCLAIMER_CANONICO } = req("../../../src/components/chrome/AppFooter") ?? {};
    if (!AppFooter) F("10 · no carga AppFooter");
    else {
      const pie = dibujarConRouter(createElement(AppFooter, { variant: "informe" }));
      if (!pie.includes(DISCLAIMER_CANONICO)) F("10 · el pie del informe no lleva el aviso");
      if (!/franco/.test(texto(pie))) F("10 · el pie del informe no lleva el wordmark");
      if (/Cómo calcula|>Comunas<|>Planes<|estado más franco/.test(pie)) F("10 · el pie del informe conserva los enlaces o la frase bajo el wordmark");
      if (/font-mono|uppercase/.test(pie)) F("10 · el pie del informe lleva mono o mayúsculas");
      const sitio = dibujarConRouter(createElement(AppFooter, { variant: "minimal" }));
      if (!/Cómo calcula/.test(sitio)) F("10 · el pie del sitio perdió sus enlaces (el cambio es solo del informe)");
    }
    for (const [nombre, f] of [["renta larga", "src/app/analisis/[id]/informe-ltr.tsx"], ["renta corta", "src/app/analisis/renta-corta/[id]/results-client.tsx"]] as const) {
      const s = sinComentarios(leer(f));
      if (!/<AppFooter variant="informe" \/>/.test(s)) F(`10 · el informe de ${nombre} no lleva el pie del informe`);
      if (/<AppFooter variant="(minimal|rich)"/.test(s)) F(`10 · el informe de ${nombre} conserva el pie del sitio`);
    }
  }

  if (fallas.length) {
    console.log(`  ✗ OFERTA-TICKET · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 50)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — la oferta es del informe (anónimo, de vuelta sin sesión, con sesión; no el enlace ajeno ni el comprado), sigue después de un pago fallido con el correo de la cuenta, sube a los 8 s del final, a los 4 min de lectura o al salir por arriba en PC (pasada la recomendación o un minuto de lectura), una vez, y espera mientras se usa el banner; el copy del goal; el «cuándo» se ve elegido; sin barra fija");
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
//
// ACTAS DE MUTACIÓN · SEGUNDA PASADA (08-oct-2026) — mismo método. Antes de implementar el tier dio 35
// fallas. Las 29 en ROJO; restauradas, VERDE. Dos debilidades del propio tier, corregidas en el camino:
//  · S24 salió VERDE la primera vez: borrar el visto dejaba `{cond && }`, el componente no compilaba, el
//    `req` tolerante devolvía null y la sección 8 SE SALTABA. De ahí el piso de cobertura (§0): un módulo
//    que no carga es una falla. Repetida con una mutación que compila (S24) y con una que no (S29): rojas.
//  · la QA en el navegador mostró que el minuto contaba desde la última TECLA, no desde que la persona
//    deja el correo (subía a los 46 s del abandono): S10–S12 vigilan que dejar el campo o el paso del
//    código marque, y que el desmontaje —que suelta todo siempre— no alargue la espera.
//    S1  la línea de arriba sin negrita                   S16 el banner no marca el toque
//    S2  el registro sin negrita                          S17 el foco del correo no se avisa
//    S3  la bajada sin gris                               S18 el desmontaje deja el código marcado
//    S4  chips y botón fuera de la fila                   S19 la salida sin la puerta de la recomendación
//    S5  la fila no es fila en PC                         S20 el ticket no avisa la recomendación
//    S6  el pack sin negrita                              S21 la marca falta en LTR
//    S7  «La mitad del precio» sin negrita                S22 la marca falta en STR
//    S8  el foco del correo no cuenta                     S23 el «Anotado» con otro texto
//    S9  la quietud a 30 s                                S24 la elegida sin visto
//    S10 dejar el correo no marca                         S25 sin la nota del «cuándo»
//    S11 dejar el código no marca                         S26 los chips no dicen «Anotado»
//    S12 el desmontaje alarga la espera                   S27 la elegida sin relleno
//    S13 disparar ignora la espera                        S28 «Ya» dice lo mismo que las otras
//    S14 el pendiente no se suelta                        S29 EstasDentro no compila (el piso)
//    S15 el ticket no espera al banner
//
// ACTAS DE MUTACIÓN · TERCERA PASADA (08-oct-2026) — mismo método. Primero el caso exacto, en ROJO
// sobre el código de la segunda pasada (6 fallas, dos de ellas «el ticket no sale… (nunca)»), reproducido
// antes en /dev/lo-que-sigue con el pedido del código interceptado (sin correo ni usuario): con el paso
// del código abierto, el ticket seguía cerrado 75 s después del final y al salir por arriba. Causa:
// `enUso()` devolvía `foco || codigo || …`, sin límite de tiempo. Arreglado, subió a los 60,8 s.
// S10–S12 de la segunda pasada (el minuto contado desde el blur) quedan derogadas por la regla nueva.
// Las 19 en ROJO; restauradas, VERDE.
//    T1  el código abierto retiene el banner (el bug)     T11 los pasos no toman el alto
//    T2  el foco retiene el banner                        T12 la medida sin la guarda
//    T3  abrir el código no cuenta                        T13 la columna sin ancho
//    T4  el foco no cuenta                                T14 el registro con el titular grande
//    T5  dejar el correo cuenta                           T15 el pie del informe con la frase
//    T6  el titular vuelve a la línea única               T16 el pie del informe con los enlaces
//    T7  el precio sin tachar                             T17 renta larga sin pie
//    T8  el cuerpo sin saltos                             T18 renta corta con el pie del sitio
//    T9  la segunda línea sin negrita                     T19 el pie del sitio pierde los enlaces
//    T10 vuelve el segundo tamaño del cuerpo
// Corrección del mismo día: «negrita únicamente donde se marca» y el texto del goal no marca ninguna, así
// que el cuerpo va sin negrita. T9 se invierte: vuelve la negrita en la 1.ª, 2.ª o 3.ª línea (T9b–T9d), las
// tres en ROJO.
// Corrección de Fabrizio (08-oct-2026): la línea 1 normal y las líneas 2 y 3 ENTERAS en negrita, en un
// solo tamaño. Deroga la de arriba. Gate en ROJO antes del arreglo; las siete mutaciones, en ROJO:
//    U1 la línea 1 en negrita              U5 sin salto entre la 2 y la 3
//    U2 la línea 2 sin negrita             U6 la negrita con otro tamaño
//    U3 la línea 3 sin negrita             U7 la negrita sin peso (400)
//    U4 la línea 2 en negrita a medias
//
// ACTAS DE MUTACIÓN · CUARTA PASADA (08-oct-2026) — el botón en su fila y la columna del informe. Gate en
// ROJO antes del arreglo (4 fallas). Un chequeo nuevo salió rojo sobre código sano: atrapaba el `padding`
// del botón de Google (un hijo del banner), no solo el del banner; se acotó a las reglas cuyo selector ES
// el banner, con piso de presencia. Las seis en ROJO; restauradas, VERDE:
//    V1 chips y botón en una fila en PC     V4 el padding horizontal fijo (PC)
//    V2 el botón centrado                    V5 un paso pisa el padding con un corto
//    V3 el padding horizontal fijo (tel.)   V6 la columna otra vez a 880 px
//
// ACTAS DE MUTACIÓN · EL SALTO (08-oct-2026) — saltar de golpe más allá de «Tu resultado a 10 años» cuenta
// como haberla pasado. Reproducido antes en /dev/lo-que-sigue (marca a −1.500 px, ticket cerrado a los
// 12 s); gate en ROJO antes del arreglo (4 fallas); arreglado, subió a los 8,1 s en PC y teléfono. Tres
// chequeos que fijaban el código del observer viejo se reescribieron sobre la vigía, con acta. Las seis
// en ROJO; restauradas, VERDE:
//    X1 por encima de la pantalla no cuenta (el bug)   X4 el scroll no se suelta al desmontar
//    X2 la vigía avisa en cada scroll                  X5 el observer se salta la vigía
//    X3 sin mirar al desplazarse                       X6 la vigía no arranca los 8 s
//
// ACTAS DE MUTACIÓN · EL SALTO SOBRE LA RECOMENDACIÓN (08-oct-2026) — misma regla para la marca que habilita
// la salida por arriba. Reproducido antes (ventana de 240 px: la marca a −400 tras el salto, el final abajo,
// la salida no abría el ticket); gate en ROJO antes del arreglo (2 fallas); arreglado, la salida lo abre.
// El chequeo de cableado de §3 se reescribió sobre `revisarMarcas`, con acta. Las cinco en ROJO:
//    Y1 el salto sobre la recomendación no cuenta (el bug)   Y4 el ticket no pasa la marca de la recomendación
//    Y2 `revisarMarcas` olvida el final                      Y5 el ticket cruza las marcas
//    Y3 la recomendación todavía abajo cuenta
