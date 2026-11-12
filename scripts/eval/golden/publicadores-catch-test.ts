// ============================================================================
// TIER PUBLICADORES — quién publica cada aviso (12-nov-2026, goal de Fabrizio). Rojo con:
//   1 · UN AVISO DEL LISTADO SIN SU TIPO cuando la URL lo trae: la fila de cada noche (propertyToRow, la que escriben el pase
//       diario y la obra nueva) lleva `publicador_tipo` de la URL —corredor, dueño, inmobiliaria—, y el upsert no lo borra
//       cuando una fuente no lo trae.
//   2 · UNA FICHA LEÍDA SIN SU PUBLICADOR GUARDADO cuando el dato venía: todo 200 de leerFicha (la guía, «Analizar este»,
//       «Quiero verlo» y el relleno) llama a guardarPublicador con el `client` de la ficha —id, nombre, logo— y el tipo de su
//       URL; sin `client`, igual queda leído (null). El almacén de verdad lo escribe en avisos_publicador y publicadores, y de
//       un dueño directo no guarda el nombre. La forma real de la ficha (capturada el 12-nov-2026) se lee.
//   3 · LA CLASE MAL PUESTA: franquicia por la marca, corredor independiente por un nombre de persona con pocos avisos,
//       corredora el resto; inmobiliaria y dueño por su tipo.
//   4 · EL RELLENO FUERA DE SUS RIELES: va por Decodo (`DECODO_RELLENO_URL`) y nunca por `PROXY_URL`; sin la variable no sale
//       a la fuente; 200 fichas por hora contadas en SU bitácora (lecturas_relleno), que el tope de 30 de las personas no ve;
//       el fusible lo detiene seis horas ante un bloqueo, una respuesta rara, tres errores seguidos o cinco fichas sin
//       publicador; con el fusible vigente no lee; el tope corta la corrida; primero las inscripciones y después los que
//       convienen, por puntaje; corre cada 10 minutos, late y está vigilado.
//   5 · EL CONTACTO DE UN PUBLICADOR EN UNA RESPUESTA PÚBLICA: solo el servidor de la ficha, el relleno, su cron y el panel
//       de admin tocan los módulos y las tablas de publicadores; ningún componente de cliente ni ruta pública; las tablas, con
//       RLS sin políticas y sin grants (la migración); `scraped_properties` —que se lee con la llave pública— lleva solo el
//       tipo. Y EN VIVO: la llave pública no lee ninguna fila de publicadores ni de avisos_publicador.
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. Lee la base en §5 (dos lecturas): 0 tokens.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/publicadores-catch-test.ts
// ============================================================================
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { propertyToRow, filaSinPisarCoords } from "../../../src/lib/services/scraper/property-row";
import type { ScrapedProperty } from "../../../src/lib/services/scraper/toctoc";
import { leerFicha, TOPE_FICHAS_POR_HORA, type AlmacenPublicacion, type RespuestaFicha, type ResultadoLectura } from "../../../src/lib/guia/publicacion";
import { claseDelPublicador, parsearPublicadorFicha, tipoDesdeUrl, type PublicadorFicha, type TipoPublicador } from "../../../src/lib/publicadores/publicador";
import { guardarPublicadorEn } from "../../../src/lib/publicadores/publicadores-servidor";
import { correrRelleno, evaluarFusible, LOTE_RELLENO, PAUSA_FUSIBLE_MS, RITMO_RELLENO_POR_HORA, type CandidatoRelleno, type DepsRelleno } from "../../../src/lib/publicadores/relleno";
import { CRONS_VIGILADOS } from "../../../src/lib/cron-heartbeat";
import { CRONS_VARIAS_AL_DIA } from "../../../src/lib/cron-alertas";

const RAIZ = join(__dirname, "..", "..", "..");
/** Todos los .ts/.tsx de src/, también los nuevos sin commitear (un archivo nuevo que filtre el contacto cuenta igual). */
function archivosSrc(dir = join(RAIZ, "src")): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...archivosSrc(p));
    else if (/\.(ts|tsx)$/.test(n)) out.push(relative(RAIZ, p).split("\\").join("/"));
  }
  return out;
}
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
/** El código sin comentarios: un acta que nombra lo que el predicado busca no lo satisface. */
const codigo = (p: string) => leer(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const URL_CORREDOR = "https://www.toctoc.com/propiedades/compracorredorasr/departamento/nunoa/se-vende-departamento-nunoa-villa-olimpica/4173996";
const URL_DUENO = "https://www.toctoc.com/propiedades/compraparticularsr/departamento/quinta-normal/oportunidad/4247243";
const URL_NUEVO = "https://www.toctoc.com/propiedades/compranuevo/departamento/nunoa/jose-pedro-alessandri/4320392";

/** La forma real de la ficha nueva (12-nov-2026, `b_4173996`), recortada: el menú de corredoras destacadas (sin `client`),
 *  el aviso con su `client` y los datos de la página. */
const FICHA_REAL = `<html><script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"menu":[{"src":"https://d1cfu8v5n1wsm.cloudfront.net/toctoc/logos/corredora/22771/1.png","alt":"Urbalia","href":"https://www.toctoc.com/empresas/gestioncorredor/corredoras/propiedades/urbalia/22771?o=menu"}],"initialState":{"property":{"property":{"data":{"title":"Se vende departamento Ñuñoa, Villa Olímpica","publishDate":"2026-05-14T00:00:00.000Z","idPropertyType":2,"order":44},"client":{"id":23375,"idType":2,"name":"Century21 Conecta","logo":"https://d1cfu8v5n1wsm.cloudfront.net/toctoc/logos/corredora/23375/0922202.jpeg"},"contactInformationId":50737,"contactInformationHashId":"6a56ae60d40bfc7c4bd59179","characteristics":[{"name":"Dormitorios:","value":"3 "}]}}}}}}</script></html>`;

export async function runPublicadoresTier(): Promise<{ hard: number }> {
  console.log("\n=== Tier PUBLICADORES (quién publica cada aviso) ===");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 1 · el listado guarda el tipo ───────────────────────────────────────────
  {
    const casos: Array<[string | null, TipoPublicador | null]> = [
      [URL_CORREDOR, "corredor"],
      ["https://www.toctoc.com/propiedades/arriendocorredorasr/departamento/santiago/x/1", "corredor"],
      [URL_DUENO, "dueno"],
      ["https://www.toctoc.com/propiedades/arriendoparticularsr/departamento/santiago/x/1", "dueno"],
      [URL_NUEVO, "inmobiliaria"],
      ["https://www.toctoc.com/venta/departamento/nunoa/b_4173996", "corredor"],
      ["https://www.toctoc.com/venta/departamento/estacion-central/o_4293231", "dueno"],
      ["https://www.toctoc.com/venta/departamento/renca/r_b4b025a443bad264aed984c70488fa2fff42d500", "inmobiliaria"],
      ["https://www.toctoc.com/resultados/mapa/compra/departamento/metropolitana/santiago/", null],
      [null, null],
    ];
    for (const [u, t] of casos) if (tipoDesdeUrl(u) !== t) F(`1 · la URL ${u ?? "null"} da «${tipoDesdeUrl(u)}», no «${t}»`);
    const prop = (url: string | undefined): ScrapedProperty => ({ source: "toctoc", sourceId: url ?? "x", type: "venta", comuna: "Ñuñoa", precio: 3500, moneda: "UF", url } as ScrapedProperty);
    for (const [u, t] of [[URL_CORREDOR, "corredor"], [URL_DUENO, "dueno"], [URL_NUEVO, "inmobiliaria"]] as const) {
      const fila = propertyToRow(prop(u));
      if (fila.publicador_tipo !== t) F(`1 · la fila del listado de ${t} sale con publicador_tipo «${fila.publicador_tipo}»`);
      if (filaSinPisarCoords(fila).publicador_tipo !== t) F(`1 · el upsert le quita el tipo a una fila de ${t}`);
    }
    if ("publicador_tipo" in filaSinPisarCoords(propertyToRow(prop(undefined)))) F("1 · una fila sin URL borra el tipo que ya se sabía (manda publicador_tipo null)");
    // Las dos rutas del listado escriben por propertyToRow.
    for (const r of ["src/app/api/data/backfill-toctoc/route.ts", "src/app/api/data/scrape-nuevos/route.ts", "src/app/api/data/scrape-properties/route.ts"]) {
      if (!/propertyToRow\)?/.test(codigo(r)) || !/\bpropertyToRow\b/.test(codigo(r).replace(/^import.*$/gm, ""))) F(`1 · ${r} no arma sus filas con propertyToRow`);
    }
  }

  // ── 2 · la ficha guarda al publicador ───────────────────────────────────────
  {
    const real = parsearPublicadorFicha(FICHA_REAL);
    if (!real || real.id !== 23375 || real.nombre !== "Century21 Conecta" || real.idType !== 2 || !real.logo?.includes("/23375/")) F(`2 · la forma real de la ficha no da su publicador (${JSON.stringify(real)})`);
    if (parsearPublicadorFicha('"client":{"id":7,"idType":2,"name":"Pérez \\"y\\" {Cía}","logo":null}')?.nombre !== 'Pérez "y" {Cía}') F("2 · un nombre con comillas o llaves rompe la lectura del publicador");
    if (parsearPublicadorFicha(FICHA_REAL.replace(/"client":\{[^}]*\},/, "")) !== null) F("2 · sin `client` se inventa un publicador (el menú no es el publicador)");
    if (parsearPublicadorFicha('"client":{"id":null,"name":"X"}') !== null) F("2 · un `client` sin id cuenta como publicador");

    const guardados: Array<{ avisoId: string; p: PublicadorFicha | null; tipo: TipoPublicador | null }> = [];
    let enLaHora = 0;
    const alm: AlmacenPublicacion = {
      async publicacion() { return null; },
      async lecturasUltimaHora() { return enLaHora; },
      async anotar() { enLaHora++; },
      async cerrar() {},
      async guardarPublicacion() {},
      async despublicar() {},
      async alertarBloqueo() {},
      async guardarPublicador(avisoId, p, tipo) { guardados.push({ avisoId, p, tipo }); },
    };
    const fuente = (nueva: RespuestaFicha) => async (u: string): Promise<RespuestaFicha> =>
      u === URL_CORREDOR ? { status: 307, location: "http://www.toctoc.com/venta/departamento/nunoa/b_4173996", html: null } : nueva;
    const ahora = new Date("2026-11-12T12:00:00Z");
    for (const tipo of ["guia", "clic", "relleno"] as const) {
      guardados.length = 0;
      const r = await leerFicha({ id: `a-${tipo}`, url: URL_CORREDOR, edificio: "e" }, tipo, alm, fuente({ status: 200, location: null, html: FICHA_REAL }), ahora);
      const g = guardados[0];
      if (!r.leida || r.motivo !== "publicado" || guardados.length !== 1 || g.avisoId !== `a-${tipo}` || g.p?.id !== 23375 || g.p?.nombre !== "Century21 Conecta" || g.tipo !== "corredor") F(`2 · la lectura «${tipo}» de una ficha con publicador no lo guarda (${JSON.stringify(guardados)})`);
      if (!r.leida || r.publicador?.id !== 23375 || r.rara) F(`2 · la lectura «${tipo}» no devuelve el publicador, o llama rara a la ficha real`);
    }
    guardados.length = 0;
    const sin = await leerFicha({ id: "b", url: URL_CORREDOR, edificio: "e" }, "guia", alm, fuente({ status: 200, location: null, html: FICHA_REAL.replace(/"client":\{[^}]*\},/, "") }), ahora);
    if (!sin.leida || guardados.length !== 1 || guardados[0].p !== null || guardados[0].tipo !== "corredor") F("2 · una ficha publicada sin `client` no queda leída (guardarPublicador con null)");
    guardados.length = 0;
    await leerFicha({ id: "c", url: URL_CORREDOR, edificio: "e" }, "guia", alm, fuente({ status: 404, location: null, html: null }), ahora);
    if (guardados.length !== 0) F("2 · un despublicado guarda un publicador");
    const rara = await leerFicha({ id: "d", url: URL_CORREDOR, edificio: "e" }, "relleno", alm, fuente({ status: 200, location: null, html: "<html>Verificando que eres humano</html>" }), ahora);
    if (!rara.leida || !rara.rara) F("2 · un 200 que no es la ficha no se marca como raro");

    // El almacén de verdad: avisos_publicador siempre; publicadores con el nombre, salvo el dueño directo.
    const escritos: Array<{ tabla: string; fila: Record<string, unknown>; onConflict?: string }> = [];
    const falso = { from: (tabla: string) => ({ upsert: async (fila: Record<string, unknown>, o?: { onConflict?: string }) => { escritos.push({ tabla, fila, onConflict: o?.onConflict }); return { error: null }; } }) };
    await guardarPublicadorEn(falso as never, "av-1", { id: 23375, idType: 2, nombre: "Century21 Conecta", logo: "https://x/1.png" }, "corredor");
    const pub = escritos.find((e) => e.tabla === "publicadores"), link = escritos.find((e) => e.tabla === "avisos_publicador");
    if (!pub || pub.fila.id !== 23375 || pub.fila.nombre !== "Century21 Conecta" || pub.onConflict !== "id" || !link || link.fila.aviso_id !== "av-1" || link.fila.publicador_id !== 23375 || link.onConflict !== "aviso_id") F(`2 · el almacén no guarda el publicador y su aviso (${JSON.stringify(escritos)})`);
    if (pub && ("clase" in pub.fila || "avisos_activos" in pub.fila || "telefono" in pub.fila)) F("2 · guardar un publicador pisa la clase, los conteos o el contacto");
    escritos.length = 0;
    await guardarPublicadorEn(falso as never, "av-2", { id: 9, idType: 1, nombre: "María Pérez", logo: null }, "dueno");
    if (escritos.find((e) => e.tabla === "publicadores")?.fila.nombre != null) F("2 · de un dueño directo se guarda el nombre (es una persona particular)");
    escritos.length = 0;
    await guardarPublicadorEn(falso as never, "av-3", null, "corredor");
    if (escritos.length !== 1 || escritos[0].tabla !== "avisos_publicador" || escritos[0].fila.publicador_id !== null) F("2 · una ficha sin publicador no queda marcada como leída");
    // El almacén de la guía lo cablea.
    const srv = codigo("src/lib/guia/ficha-servidor.ts");
    if (!/async guardarPublicador\(avisoId, publicador, tipo\) \{\s*await guardarPublicadorEn\(admin, avisoId, publicador, tipo\);/.test(srv)) F("2 · el almacén de la guía no guarda el publicador de sus lecturas");
  }

  // ── 3 · la clase ────────────────────────────────────────────────────────────
  {
    const casos: Array<[TipoPublicador | null, string | null, number, string | null]> = [
      ["corredor", "Century21 Conecta", 3, "franquicia"],
      ["corredor", "RE/MAX Uno", 200, "franquicia"],
      ["corredor", "Engel & Völkers Vitacura", 40, "franquicia"],
      ["corredor", "María José Pérez", 4, "independiente"],
      ["corredor", "María José Pérez", 60, "corredora"],
      ["corredor", "Fuenzalida Propiedades", 2, "corredora"],
      ["corredor", "Gestión Inmobiliaria Andes SpA", 90, "corredora"],
      ["corredor", "Urbalia", 5, "corredora"],
      ["inmobiliaria", "Inmobiliaria X", 10, "inmobiliaria"],
      ["dueno", null, 1, "dueno"],
      [null, "Algo", 1, null],
    ];
    for (const [tipo, nombre, n, debe] of casos) {
      const c = claseDelPublicador({ tipo, nombre, avisosActivos: n });
      if (c !== debe) F(`3 · «${nombre}» (${tipo}, ${n} avisos) es «${c}», no «${debe}»`);
    }
  }

  // ── 4 · el relleno ──────────────────────────────────────────────────────────
  {
    if (RITMO_RELLENO_POR_HORA !== 200) F(`4 · el ritmo del relleno no es 200 fichas por hora (${RITMO_RELLENO_POR_HORA})`);
    if (!(LOTE_RELLENO * 6 >= RITMO_RELLENO_POR_HORA && LOTE_RELLENO <= 60)) F("4 · el lote por corrida no alcanza el ritmo en seis corridas por hora, o se pasa del tiempo de la función");
    if (PAUSA_FUSIBLE_MS !== 6 * 60 * 60 * 1000) F("4 · el fusible no detiene el relleno seis horas");
    const rs = codigo("src/lib/publicadores/relleno-servidor.ts");
    if (/proxyDispatcher|PROXY_URL/.test(rs)) F("4 · el relleno sale por el proxy de las personas (PROXY_URL)");
    if (!/process\.env\.DECODO_RELLENO_URL \? new ProxyAgent\(process\.env\.DECODO_RELLENO_URL\) : null/.test(rs)) F("4 · el proxy del relleno no es Decodo (DECODO_RELLENO_URL)");
    const bajar = rs.slice(rs.indexOf("export async function bajarFichaRelleno"), rs.indexOf("export function almacenRelleno"));
    if (!/const dispatcher = proxyRelleno\(\);\s*if \(!dispatcher\) return \{ falla: "red" \};/.test(bajar) || (bajar.match(/\bfetch\(/g) ?? []).length !== 1 || !/redirect: "manual",\s*dispatcher,/.test(bajar) || !/AbortSignal\.timeout\(TIMEOUT_FICHA_MS\)/.test(bajar) || /for\s*\(|while\s*\(|reintent/i.test(bajar)) F("4 · la bajada del relleno no es UN pedido por Decodo, sin redirecciones solas y con tiempo máximo (o sale sin Decodo)");
    const alm = rs.slice(rs.indexOf("export function almacenRelleno"), rs.indexOf("export async function leerFusible"));
    if (!/from\("lecturas_relleno"\)\.select\("id", \{ count: "exact", head: true \}\)\.gte\("leido_at", desde\)\.neq\("motivo", "redirige"\)/.test(alm) || !/from\("lecturas_relleno"\)\.insert\(/.test(alm) || /lecturas_ficha/.test(alm)) F("4 · el relleno no cuenta ni anota en su propia bitácora (o toca la de las personas)");
    if (!/leerFicha\(\{ id: c\.avisoId, url: c\.url, edificio: c\.edificio \}, "relleno", almacen, bajarFichaRelleno, new Date\(\), \{ tope: RITMO_RELLENO_POR_HORA \}\)/.test(rs)) F("4 · el relleno no lee con su tope, su almacén y su bajada");
    // El tope de las personas no ve al relleno: sigue contando solo lecturas_ficha, en 30.
    if (TOPE_FICHAS_POR_HORA !== 30 || /lecturas_relleno/.test(codigo("src/lib/guia/ficha-servidor.ts"))) F("4 · el tope de las personas cambió o cuenta las lecturas del relleno");

    // El fusible y el orden, con dobles.
    const c = (i: number, prioridad = 1): CandidatoRelleno => ({ avisoId: `a${i}`, url: URL_CORREDOR, edificio: "e", prioridad });
    const pub: PublicadorFicha = { id: 1, idType: 2, nombre: "X", logo: null };
    const L = (x: Partial<Extract<ResultadoLectura, { leida: true }>>): ResultadoLectura => ({ leida: true, motivo: "publicado", codigo: 200, anio: null, gets: 2, publicador: pub, rara: false, ...x });
    const correr = async (lecturas: ResultadoLectura[], opts: { fusible?: boolean; candidatos?: CandidatoRelleno[] } = {}) => {
      const leidos: string[] = [];
      const saltos: Array<{ motivo: string; hasta: Date }> = [];
      const ahora = new Date("2026-11-12T12:00:00Z");
      const deps: DepsRelleno = {
        async fusible() { return opts.fusible ? { hasta: new Date(ahora.getTime() + 1000), motivo: "bloqueo" } : null; },
        async saltarFusible(motivo, _d, hasta) { saltos.push({ motivo, hasta }); },
        async candidatos(n) { return (opts.candidatos ?? lecturas.map((_, i) => c(i))).slice(0, n); },
        async leer(x) { leidos.push(x.avisoId); return lecturas[leidos.length - 1] ?? L({}); },
        async esperar() {},
        ahora: () => ahora,
      };
      const r = await correrRelleno(deps);
      return { r, leidos, saltos, ahora };
    };
    const b = await correr([L({}), L({ motivo: "bloqueo", codigo: 403, publicador: null }), L({})]);
    if (b.r.estado !== "fusible" || b.leidos.length !== 2 || b.saltos[0]?.motivo !== "bloqueo" || b.saltos[0].hasta.getTime() - b.ahora.getTime() !== PAUSA_FUSIBLE_MS) F(`4 · un bloqueo no corta la corrida y detiene el relleno seis horas (${b.r.estado}, ${b.leidos.length} leídas)`);
    const ra = await correr([L({ rara: true, publicador: null }), L({})]);
    if (ra.r.estado !== "fusible" || ra.leidos.length !== 1 || ra.saltos[0]?.motivo !== "rara") F("4 · una respuesta rara no hace saltar el fusible");
    const er = await correr([L({ motivo: "error", publicador: null }), L({ motivo: "tiempo", publicador: null }), L({ motivo: "error", publicador: null }), L({})]);
    if (er.r.estado !== "fusible" || er.leidos.length !== 3 || er.saltos[0]?.motivo !== "errores") F("4 · tres errores seguidos no hacen saltar el fusible");
    const er2 = await correr([L({ motivo: "error", publicador: null }), L({ motivo: "error", publicador: null }), L({}), L({ motivo: "error", publicador: null }), L({})]);
    if (er2.r.estado !== "completo") F("4 · errores sueltos (no seguidos) hacen saltar el fusible");
    const sp = await correr(Array.from({ length: 6 }, () => L({ publicador: null })));
    if (sp.r.estado !== "fusible" || sp.leidos.length !== 5 || sp.saltos[0]?.motivo !== "sin-publicador") F("4 · cinco fichas seguidas sin publicador no hacen saltar el fusible");
    const desp = await correr(Array.from({ length: 8 }, () => L({ motivo: "despublicado", codigo: 404, publicador: null })));
    if (desp.r.estado !== "completo" || desp.r.despublicadas !== 8) F("4 · los despublicados hacen saltar el fusible (son lo normal)");
    const det = await correr([L({})], { fusible: true });
    if (det.r.estado !== "detenido" || det.leidos.length !== 0) F("4 · con el fusible vigente el relleno lee igual");
    const tope = await correr([L({}), { leida: false, razon: "tope", gets: 0 }, L({})]);
    if (tope.r.estado !== "tope" || tope.leidos.length !== 2) F("4 · el tope por hora no corta la corrida");
    const ins = await correr([L({}), L({}), L({})], { candidatos: [c(0, 0), c(1, 0), c(2, 1)] });
    if (ins.r.inscripciones !== 2 || ins.leidos.join() !== "a0,a1,a2") F("4 · la corrida no lee en el orden de la lista o no cuenta las inscripciones");
    if (evaluarFusible({ leida: false, razon: "tope", gets: 0 }, { errores: 5, sinPublicador: 9 }) !== null) F("4 · una lectura que no salió hace saltar el fusible");
    // El orden: primero las inscripciones (prioridad 0), después los que convienen por puntaje; sin los ya leídos, los
    // despublicados ni los intentados en 24 horas. Lo dice la función de la migración.
    const mig = leer("supabase/migrations/20261112_publicadores.sql");
    const fn = mig.slice(mig.indexOf("create or replace function public.relleno_publicadores_candidatos"), mig.indexOf("create or replace function public.recontar_publicadores"));
    if (!/from public\.invierte_inscripciones i[\s\S]*?0 as prio/.test(fn.slice(0, fn.indexOf("conv as"))) && !/0 as prio[\s\S]*?from public\.invierte_inscripciones i/.test(fn.slice(0, fn.indexOf("conv as")))) F("4 · las inscripciones no van primero (prioridad 0)");
    if (!/1 as prio, -coalesce\(e\.score_20, 0\) as orden[\s\S]*?where e\.veredicto_20 = 'COMPRAR'/.test(fn) || !/order by t\.prio, t\.orden/.test(fn)) F("4 · los que convienen no van después, por puntaje");
    if (!/not exists \(select 1 from public\.avisos_publicador/.test(fn) || !/estado = 'despublicado'/.test(fn) || !/lecturas_relleno lr where lr\.aviso_id = t\.id and lr\.leido_at > now\(\) - interval '24 hours'/.test(fn)) F("4 · el relleno vuelve a leer lo ya leído, lo despublicado o lo intentado hoy");
    if (!/language plpgsql/.test(fn) || !/set plan_cache_mode = force_custom_plan/.test(fn) || !/set search_path = public, pg_temp/.test(fn)) F("4 · la función de candidatos no va con plan a medida y search_path fijo");
    // El cron: cada 10 minutos, late, cierra, vigilado, de varias corridas al día.
    const vj = JSON.parse(leer("vercel.json")) as { crons: { path: string; schedule: string }[] };
    const cron = vj.crons.find((x) => x.path === "/api/cron/relleno-publicadores");
    if (!cron || !/^(\d+-\d+)?\*?\/10 \* \* \* \*$|^5-55\/10 \* \* \* \*$/.test(cron.schedule)) F(`4 · el relleno no corre cada 10 minutos (${cron?.schedule})`);
    if (!CRONS_VIGILADOS.some((x) => x.nombre === "relleno-publicadores") || !CRONS_VARIAS_AL_DIA.has("relleno-publicadores")) F("4 · el relleno no está vigilado como cron de varias corridas al día");
    const ruta = codigo("src/app/api/cron/relleno-publicadores/route.ts");
    if (!/if \(!proxyRelleno\(\)\) \{[\s\S]*?return cerrarCron\(/.test(ruta) || ruta.indexOf("if (!proxyRelleno())") > ruta.indexOf("correrRelleno(depsRelleno(admin))")) F("4 · sin Decodo la ruta corre el relleno igual");
  }

  // ── 5 · uso interno ─────────────────────────────────────────────────────────
  {
    const PERMITIDOS = new Set([
      "src/lib/publicadores/publicador.ts",
      "src/lib/publicadores/publicadores-servidor.ts",
      "src/lib/publicadores/relleno.ts",
      "src/lib/publicadores/relleno-servidor.ts",
      "src/lib/guia/ficha-servidor.ts",
      "src/lib/guia/publicacion.ts",
      "src/lib/services/scraper/property-row.ts",
      "src/app/api/cron/relleno-publicadores/route.ts",
      "src/app/admin/invierte/page.tsx",
    ]);
    // Los módulos con datos del publicador (los de servidor) y las tablas, solo donde se permiten.
    const SERVIDOR = /@\/lib\/publicadores\/(publicadores-servidor|relleno-servidor)|from\("(publicadores|avisos_publicador|lecturas_relleno)"\)|rpc\("(recontar_publicadores|relleno_publicadores_candidatos)"/;
    const PURO = /@\/lib\/publicadores\//;
    let vistos = 0;
    for (const f of archivosSrc()) {
      const s = codigo(f);
      if (PERMITIDOS.has(f)) { if (SERVIDOR.test(s) || PURO.test(s)) vistos++; continue; }
      if (SERVIDOR.test(s)) F(`5 · ${f} toca los datos de los publicadores y no es el servidor de la ficha, el relleno ni el panel de admin`);
      else if (PURO.test(s)) F(`5 · ${f} importa el módulo de publicadores fuera de los lugares permitidos`);
      if (/^\s*["']use client["']/.test(s) && /publicador/i.test(s.replace(/publicador_tipo/g, ""))) F(`5 · ${f} es de cliente y nombra al publicador`);
    }
    if (vistos < 5) F(`5 · el censo de los que tocan publicadores no corrió (${vistos} archivos vistos)`);
    // La página de admin es de servidor y exige admin.
    const adm = codigo("src/app/admin/invierte/page.tsx");
    if (/^\s*["']use client["']/.test(adm) || !/await requireAdminPage\(\)/.test(adm)) F("5 · el panel con el contacto no es de servidor o no exige admin");
    // La migración: RLS sin políticas y sin grants; scraped_properties gana solo el tipo.
    // Sin los comentarios del SQL: el rollback del encabezado nombra lo mismo que se busca.
    const mig = leer("supabase/migrations/20261112_publicadores.sql").replace(/--.*$/gm, "");
    for (const t of ["publicadores", "avisos_publicador", "lecturas_relleno"]) {
      if (!new RegExp(`alter table public\\.${t} enable row level security;`).test(mig) || !new RegExp(`revoke all on public\\.${t} from anon, authenticated;`).test(mig)) F(`5 · ${t} no queda con RLS y sin grants a la llave pública`);
      if (new RegExp(`create policy[^;]*on public\\.${t}\\b`, "i").test(mig)) F(`5 · ${t} tiene una política: la llave pública podría leerla`);
    }
    const alterSp = mig.match(/alter table public\.scraped_properties[^;]*;/g) ?? [];
    if (alterSp.length !== 1 || !/add column if not exists publicador_tipo text/.test(alterSp[0]) || /nombre|telefono|correo|sitio/.test(alterSp.join(""))) F("5 · scraped_properties (lectura pública) gana algo más que el tipo del publicador");
    const filaListado = Object.keys(propertyToRow({ source: "toctoc", sourceId: "x", type: "venta", comuna: "x", precio: 1, moneda: "UF", url: URL_CORREDOR } as ScrapedProperty)).filter((k) => /publicador|telefono|correo|sitio/.test(k));
    if (filaListado.join() !== "publicador_tipo") F(`5 · la fila pública del listado lleva datos del publicador más allá del tipo (${filaListado.join()})`);

    // EN VIVO: la llave pública no lee publicadores ni avisos_publicador. Un cero cuenta solo si hay filas (con la llave de servicio).
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, servicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anon || !servicio) console.log("  ⚠ 5 · sin llaves de Supabase: la lectura en vivo no corrió");
    else {
      const pub = createClient(url, anon, { auth: { persistSession: false } });
      const srv = createClient(url, servicio, { auth: { persistSession: false } });
      for (const t of ["publicadores", "avisos_publicador"]) {
        // GET y no HEAD: un HEAD sobre una tabla que no existe vuelve sin error y con count null.
        const s = await srv.from(t).select("*").limit(1);
        if (s.error) { console.log(`  ⚠ 5 · ${t} no se pudo leer con la llave de servicio (${s.error.code ?? s.error.message}): ¿falta la migración?`); continue; }
        const p = await pub.from(t).select("*").limit(5);
        if (!p.error && (p.data?.length ?? 0) > 0) F(`5 · la llave pública lee ${p.data!.length} filas de ${t}`);
        if (!s.data?.length) console.log(`  ⚠ 5 · ${t} está vacía: el cero de la llave pública todavía no prueba nada`);
      }
    }
  }

  for (const f of fallas) console.log(`  ✗ ${f}`);
  console.log(fallas.length ? `  ${fallas.length} falla(s)` : "  ✓ PUBLICADORES verde");
  return { hard: fallas.length };
}

if (require.main === module) {
  runPublicadoresTier().then((r) => process.exit(r.hard ? 1 : 0));
}

// ── ACTA DE MUTACIONES (12-nov-2026) ────────────────────────────────────────
// 30 de 30 en ROJO, una a la vez, con el archivo restaurado byte a byte después de cada una (los archivos nuevos, borrados):
//   §1 P1 el listado sin tipo · P2 el upsert borra el tipo.
//   §2 P3 la ficha no guarda el publicador · P4 sin `client` no queda leída · P5 el nombre se pierde · P6 el nombre del dueño
//      se guarda · P7 el almacén de la guía no guarda · P32 lo raro pasa por ficha.
//   §3 P8 franquicia sin Century21 · P9 independiente con 60 avisos.
//   §4 P10 el relleno por PROXY_URL · P11 sin Decodo sale directo · P12 cuenta la bitácora de las personas · P13 sin su tope ·
//      P14 el bloqueo no corta · P15 la rara no corta · P16 cinco errores · P17 la racha no se reinicia · P18 el fusible
//      vigente se ignora · P19 el fusible una hora · P20 el tope no corta · P21 las inscripciones no van primero · P22 sin
//      resumen de varias corridas · P23 la ruta corre sin Decodo · P29 400 por hora.
//   §5 P24 un componente de cliente con el publicador (archivo nuevo, sin commitear: el censo lee el disco, no git) · P25 una
//      ruta pública que lee publicadores · P26 una política en publicadores · P27 el teléfono a scraped_properties · P28 el
//      panel sin requireAdminPage.
// Dos trampas del arnés que este tier evita, las dos medidas el 12-nov-2026: (1) `archivosTrackeados` lee git, y un archivo
// nuevo que filtre el contacto no estaría en el censo hasta el commit; (2) un HEAD con count sobre una tabla que no existe
// vuelve SIN error y con count null: la sonda en vivo usa GET (memoria «sonda de existencia: GET, no HEAD+count»).
