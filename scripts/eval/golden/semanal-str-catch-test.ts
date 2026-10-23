// ─────────────────────────────────────────────────────────────────────────────
// Tier SEMANAL-STR (14-oct-2026, 0 tokens) — el semanal de renta corta, estimado por zona, y «Analizar este» que mide fino.
//
// Decisiones de Fabrizio del 14-oct-2026: quien tiene perfil de renta corta recibe en el semanal un bloque de renta corta
// ESTIMADO POR ZONA —el motor de renta corta sobre los avisos de sus comunas con la tarifa y la ocupación típicas de la
// zona que ya están en caché, sin consultar al proveedor—; quien tiene los dos
// perfiles recibe UN correo con DOS bloques y quien solo tiene renta corta, solo ese; la línea provisoria del 13-oct
// salió. Las consultas al proveedor quedan para «Analizar este»: mide fino y, si eso NO DA COMPRAR, no se cobra nunca
// y se muestran los parecidos que sobreviven. Cada comparación queda registrada. Segunda tanda del 14-oct-2026: el
// bloque es SOLO COMPRAR (sin negociables; con menos de tres, los que haya) y la regla de cobro es «lo fino da Comprar»
// (lo de la página —pop-up, marca, medición con tope— y los parecidos que sobreviven, en el tier SEMANAL-AJUSTES).
//
// Fija: (1) LA SELECCIÓN POR ZONA: la respuesta típica de la celda es la de ingreso mediano (con piso de respuestas),
// los candidatos van por rendimiento de zona, el bloque se elige con elegirSemanal y el mismo presupuesto de fichas, y
// preparar y evaluar el bloque NO consulta al proveedor (con la base real y un fetch que cuenta); (2) LOS DOS BLOQUES:
// el correo con los dos, con uno solo, la marca «Estimado por zona» solo en los de renta corta, el estado de la fila y
// el cableado del armado, el envío y la página; (3) EL ANÁLISIS QUE NO SE COBRA: si la medición fina no da Comprar
// —aunque repita el Ajustar que vio la persona—, no se reclama ni se cobra y vuelven los parecidos; si da, un cobro; (4) EL
// REGISTRO: cada medición queda con la zona, lo fino, si cambió y si se cobró; (5) EL PRESUPUESTO: el prechequeo y el
// armado preparan los dos bloques dentro de los mismos 240 s; (6, 19-oct-2026) EL CLIC EN UN DEPTO DE RENTA CORTA: la ruta lo
// reconoce (deptoDelClic, en los dos bloques), `semanal_clic` lleva el depto y el bloque, y /semanal abre con ese bloque
// primero —con el título— y el depto arriba y destacado. ACTA §6: contra el código de producción, 7 fallas; mutaciones 8/8
// en rojo (scratchpad mutar-clic-corto.cjs): N1 la ruta busca solo en renta larga · N2 deptoDelClic ignora renta corta ·
// N3 el evento sin bloque · N4 la página no pone primero renta corta · N5 el título abajo · N6 el reemplazo no cuenta ·
// N7 renta corta acepta cualquier depto · N8 el cierre arriba. Verificado en el navegador con la cuenta de prueba interna.
//
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/semanal-str-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import * as STR from "../../../src/lib/guia/semanal-str";
import * as SEM from "../../../src/lib/guia/semanal";
import { correoSemanal } from "../../../src/lib/email/correo-semanal";
import type { PiezasAnalizar } from "../../../src/lib/guia/analizar-una-vez";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "");
const cuenta = (s: string, sub: string) => s.split(sub).length - 1;

/** Un «Analizar este» de mentira: cuenta cada pieza que se toca. */
function dobles(o: { fino: string | null; mostrado?: string; publicado?: boolean; ya?: string | null; sinPreparar?: boolean }) {
  const n = { reclamar: 0, cobrar: 0, crear: 0, registrar: [] as STR.ComparacionStr[], preparar: 0, alternativas: 0 };
  const piezas: PiezasAnalizar = {
    async reclamar() { n.reclamar++; return { nueva: true }; },
    async retomar() { return false; },
    async cobrar() { n.cobrar++; return { ok: true, mode: "paid" }; },
    async marcarCobrado() {},
    async crear() { n.crear++; return { id: "informe-1" }; },
    async marcarCreado() {},
    async soltar() {},
  };
  const correr = () => STR.analizarStrDeSemanal({
    async yaCreado() { return o.ya ?? null; },
    async chequear() { return o.publicado === false ? "despublicado" : "publicado"; },
    async alDespublicar() {},
    async preparar() {
      n.preparar++;
      if (o.sinPreparar) return { ok: false, status: 422, error: "sin-direccion" };
      return { ok: true, m: {
        mostrado: { veredicto: o.mostrado ?? "COMPRAR", score: 74 },
        zona: { veredicto: o.mostrado ?? "COMPRAR", score: 74, adr: 52000, ocupacion: 0.47 },
        fino: { veredicto: o.fino, score: o.fino === "COMPRAR" ? 71 : 58, adr: 47000, ocupacion: 0.41 },
        piezas,
      } };
    },
    async registrar(c) { n.registrar.push(c); },
    async alternativas() { n.alternativas++; return ["b", "c"]; },
  });
  return { n, correr };
}

export async function runSemanalStrTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER SEMANAL-STR (renta corta en el semanal: por zona, dos bloques, sin cobro si cambia · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const srv = sinComentarios(leer("src/lib/guia/semanal-servidor.ts"));
  const strSrv = sinComentarios(leer("src/lib/guia/semanal-str-servidor.ts"));
  const ruta = sinComentarios(leer("src/app/api/semanal/analizar-str/route.ts"));
  // ⚠ ACTA (21-oct-2026, recorrido real de Fabrizio por la puerta B) · la selección vive en el dashboard: los dos bloques los
  // arma el cargador compartido (seleccion-pagina-servidor.ts) y los dibuja seleccion-en-casa.tsx; /semanal redirige ahí. Las
  // reglas de los bloques no cambian, cambian de archivo (tier PUERTA-B-RECORRIDO §7).
  const pagina = sinComentarios(leer("src/lib/guia/seleccion-pagina-servidor.ts")) + sinComentarios(leer("src/app/dashboard/seleccion-en-casa.tsx"));
  const lista = sinComentarios(leer("src/app/semanal/semanal-lista.tsx"));
  const pipeline = sinComentarios(leer("src/lib/api-helpers/analisis-pipeline.ts"));

  // ── 1 · LA SELECCIÓN POR ZONA ───────────────────────────────────────────────────
  {
    // La respuesta típica de la celda: la de ingreso mediano, con piso de respuestas.
    const r = (xs: number[]) => xs.map((ingresoAnual, i) => ({ ingresoAnual, id: `r${i}` }));
    const t = STR.respuestaTipica(r([9, 1, 5, 7, 3]), STR.MIN_RESPUESTAS_ZONA);
    const par = STR.respuestaTipica(r([4, 1, 8, 6]), STR.MIN_RESPUESTAS_ZONA);
    if (t?.ingresoAnual !== 5 || par?.ingresoAnual !== 4) F(`1 · la respuesta típica de la celda no es la de ingreso mediano (${t?.ingresoAnual}, ${par?.ingresoAnual})`);
    if (STR.MIN_RESPUESTAS_ZONA < 3 || STR.respuestaTipica(r([5, 6]), STR.MIN_RESPUESTAS_ZONA) !== null) F(`1 · una celda con menos de 3 respuestas guardadas estima igual (${STR.MIN_RESPUESTAS_ZONA})`);
    if (STR.ingresoAnualDeEstimacion({ average_daily_rate: { p50: 50000 }, occupancy: { p50: 0.5 } }) !== 50000 * 0.5 * 365 || STR.ingresoAnualDeEstimacion({ average_daily_rate: { p50: 50000 }, occupancy: { p50: 47 } }) !== null) F("1 · el ingreso de una estimación no es tarifa p50 × ocupación p50 × 365 (o acepta una ocupación imposible)");
    // La zona sale del caché con la conversión del caché, y el cálculo es el del informe.
    if (!/const t = respuestaTipica\(ds, MIN_RESPUESTAS_ZONA\);/.test(strSrv) || !/estimacion: estimacionDesdeCache\(fila\)/.test(strSrv) || !/const dirs = await direccionesDeComuna\(comuna\);/.test(strSrv))
      F("1 · la zona no sale de la respuesta típica guardada (direccionesDeComuna → respuestaTipica → estimacionDesdeCache)");
    if (/getAirbnbEstimate|buildShortTermAnalysisRow|api\.airroi\.com/.test(strSrv)) F("1 · el semanal de renta corta puede consultar al proveedor (getAirbnbEstimate / buildShortTermAnalysisRow en semanal-str-servidor.ts)");
    if (!/const ev = evaluarCuerpoStr\(body, cfg\.uf,/.test(strSrv) || !/= evaluarCuerpoStr\(body, ufValue, medianaComuna, airbnbResult, asOfPipeline\);/.test(pipeline))
      F("1 · la zona y el informe no corren el mismo cálculo (evaluarCuerpoStr)");
    if (!/const body = cuerpoStrDeAviso\(c, o, combo, cfg\);/.test(strSrv) || !/return buildStrPayload\(answers, ctx\)/.test(strSrv) || !/modalidad: "str", modoGestion: o\.modoGestion/.test(strSrv))
      F("1 · el cuerpo del depto no es el del wizard (buildStrPayload sobre las respuestas del aviso, con la gestión de la persona)");
    // Los candidatos: de las comunas del perfil de renta corta, por rendimiento de zona; sin zona, fuera.
    if (!/admin\.rpc\("semanal_candidatos_str", \{\s*comunas, dorms: perfil\.dormitorios, uf_min: rango\.ufMin, uf_max: rango\.ufMax, desde, por_celda: POR_CELDA_STR,/.test(strSrv)
      || !/if \(!zona \|\| !\(c\.precioUF > 0\)\) continue;\s*out\.push\(\{ \.\.\.c, scoreCron: Math\.round\(\(zona\.ingresoAnual \/ \(c\.precioUF \* cfg\.uf\)\) \* 10_000\) \}\);/.test(strSrv))
      F("1 · los candidatos de renta corta no van por rendimiento de zona (o entran sin zona)");
    // SOLO COMPRAR (14-oct-2026): el respaldo de renta corta son las vecinas (dan Comprar) y nada más; sin negociables.
    const prepStrFn = strSrv.slice(strSrv.indexOf("export async function prepararSeleccionStr"));
    if (!/const perfil = pp\.perfilStr;\s*if \(!perfil\) return null;/.test(strSrv) || !/respaldo: \{\s*vecinas: \(\) => \(vecinas \?\?= leerCandidatos\(comunasVecinas\(propias\)\)\),\s*\},/.test(prepStrFn) || /evaluarConDescuento|DESCUENTO_NEGOCIABLE/.test(prepStrFn))
      F("1 · el bloque no sale del perfil de renta corta, o su respaldo no es solo las vecinas (trae negociables)");
    const mig = leer("supabase/migrations/20261014_semanal_renta_corta.sql");
    if (!/partition by sp\.comuna, case when public\.es_estudio\(sp\.dormitorios, sp\.titulo\) then 0 else sp\.dormitorios end\s*order by ae\.precio_uf asc, sp\.id/.test(mig) || !/and ae\.arriendo_sospechoso is not true/.test(mig))
      F("1 · la RPC de renta corta no trae los más baratos de cada celda con los filtros del semanal");
    // Con la base real: preparar y evaluar el bloque de una persona con perfil de renta corta, contando los pedidos al
    // proveedor. Tienen que ser cero, y el bloque tiene que evaluar con la zona.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) F("1 · NO CORRIÓ: faltan las variables de Supabase (correr con --env-file=.env.local)");
    else {
      const { prepararSeleccionStr, zonasDeComuna } = await import("../../../src/lib/guia/semanal-str-servidor");
      const { leerPerfilBusqueda } = await import("../../../src/lib/perfil-busqueda-servidor");
      const { leerConfigGuia } = await import("../../../src/lib/guia/guia-servidor");
      const { direccionesDeComuna } = await import("../../../src/lib/strref-zona-query");
      const sb = createClient(url, key);
      const fetchReal = globalThis.fetch;
      let alProveedor = 0;
      globalThis.fetch = (async (u: RequestInfo | URL, init?: RequestInit) => {
        if (String(u).includes("airroi.com")) { alProveedor++; throw new Error("el semanal no consulta al proveedor"); }
        return fetchReal(u, init);
      }) as typeof fetch;
      try {
        const cfg = await leerConfigGuia(sb);
        // La zona de Santiago 1D: la respuesta de ingreso mediano entre las de su celda.
        const z = (await zonasDeComuna(sb, "Santiago")).get(1);
        const celda = (await direccionesDeComuna("Santiago")).filter((d) => d.dormitorios === 1).map((d) => d.ingresoAnual).sort((a, b) => a - b);
        const mediana = celda[Math.floor((celda.length - 1) / 2)];
        if (!z || Math.abs(z.ingresoAnual - mediana) > 1 || z.n !== celda.length) F(`1 · la zona de Santiago 1D no es la respuesta mediana de su celda (${z?.ingresoAnual} vs ${mediana}, n ${z?.n}/${celda.length})`);
        const { data } = await sb.from("analisis").select("user_id").eq("tipo_analisis", "short-term").not("user_id", "is", null).order("created_at", { ascending: false }).limit(40);
        let probada = 0, conComprar = 0;
        for (const u of Array.from(new Set((data ?? []).map((x) => x.user_id as string)))) {
          if (probada >= 3) break;
          const pp = await leerPerfilBusqueda(sb, u);
          const prep = await prepararSeleccionStr(sb, u, cfg, pp);
          if (prep?.tipo !== "lista" || prep.p.candidatos.length === 0) continue;
          probada++;
          const evs = await Promise.all(prep.p.candidatos.slice(0, 15).map((c) => prep.p.evaluar(c)));
          if (evs.some((e) => e?.veredicto === "COMPRAR")) conComprar++;
          if (evs.every((e) => e == null)) F(`1 · el bloque de renta corta no evalúa ningún candidato con la zona (persona ${u.slice(0, 8)})`);
        }
        if (probada === 0) F("1 · NO CORRIÓ: ninguna persona con perfil de renta corta tuvo candidatos");
        if (alProveedor > 0) F(`1 · preparar y evaluar el bloque de renta corta hizo ${alProveedor} pedido(s) al proveedor`);
        console.log(`  · por zona: ${probada} personas probadas, ${conComprar} con algún Comprar, ${alProveedor} pedidos al proveedor`);
      } finally {
        globalThis.fetch = fetchReal;
      }
    }
  }

  // ── 2 · LOS DOS BLOQUES ─────────────────────────────────────────────────────────
  {
    const d = (n: number, extra: Record<string, unknown> = {}) => ({ comuna: "Ñuñoa", tipologia: "1D1B", m2: 40, precioUF: 3000 + n, veredicto: "COMPRAR", score: 75, flujo: 50000, url: `https://x/${n}`, ...extra });
    const base = { variante: "tarjetas" as const, nombre: "Ana", busca: "1 dormitorio, Ñuñoa", piePct: 20, plazoAnios: 25, deptos: [d(1), d(2)], conRegalo: false, saldo: 2, urlBoton: "https://x/b", urlTres: "https://x/t", urlBaja: "https://x/baja" };
    const corto = { deptos: [d(3), d(4), d(5)], busca: "1 dormitorio, Santiago", piePct: 10, plazoAnios: 30 };
    const dos = correoSemanal({ ...base, corto }).html;
    const soloCorto = correoSemanal({ ...base, deptos: [], largo: false, corto }).html;
    const soloLargo = correoSemanal(base).html;
    const sinLargoEstaSemana = correoSemanal({ ...base, deptos: [], corto }).html;
    if (!dos.includes(STR.SEMANAL_STR.bloqueLargo) || !dos.includes(STR.SEMANAL_STR.bloqueCorto) || cuenta(dos, 'data-bloque="titulo"') !== 2) F("2 · quien tiene los dos perfiles no recibe un correo con los dos bloques titulados");
    if (cuenta(dos, `>${STR.MARCA_ZONA}<`) !== corto.deptos.length || !dos.includes(STR.SEMANAL_STR.zona)) F(`2 · los deptos de renta corta no llevan todos la marca «${STR.MARCA_ZONA}» (o falta la línea de la zona): ${cuenta(dos, `>${STR.MARCA_ZONA}<`)} de ${corto.deptos.length}`);
    if (cuenta(dos, "https://x/") < 5 + 1) F("2 · el correo con los dos bloques no trae los deptos de los dos");
    if (soloCorto.includes(STR.SEMANAL_STR.bloqueLargo) || soloCorto.includes(STR.SEMANAL_STR.sinLargo) || cuenta(soloCorto, 'data-bloque="titulo"') !== 0 || cuenta(soloCorto, `>${STR.MARCA_ZONA}<`) !== 3 || soloCorto.includes("https://x/1\""))
      F("2 · quien solo tiene renta corta recibe también el bloque de arriendo tradicional (o no recibe el suyo)");
    if (soloLargo.includes(STR.MARCA_ZONA) || soloLargo.includes(STR.SEMANAL_STR.bloqueCorto) || cuenta(soloLargo, 'data-bloque="titulo"') !== 0) F("2 · quien solo tiene renta larga ve algo de renta corta (o títulos de bloque)");
    if (!sinLargoEstaSemana.includes(STR.SEMANAL_STR.sinLargo)) F("2 · con los dos perfiles y una semana sin renta larga, el correo no lo dice");
    if (/analízalos con tu pack/.test(dos + soloCorto + soloLargo)) F("2 · la línea provisoria de renta corta sigue en el correo");
    // El estado de la fila con sus dos bloques.
    const E = STR.estadoDeFila;
    const tabla: Array<[ReturnType<typeof E>, ReturnType<typeof E>]> = [
      [E("armada", null), "armada"], [E(null, "armada"), "armada"], [E("sin_match", "armada"), "armada"], [E("armada", "pendiente"), "pendiente"],
      [E("pendiente", "sin_match"), "pendiente"], [E("sin_match", "sin_match"), "sin_match"], [E(null, null), "sin_match"], [E("sin_match", null), "sin_match"],
    ];
    if (tabla.some(([x, y]) => x !== y)) F(`2 · el estado de la fila con dos bloques no es «pendiente si alguno, armada si alguno» (${tabla.map(([x]) => x).join(",")})`);
    // El armado: los dos bloques, cada uno de su perfil, con el mismo presupuesto de fichas.
    const armar = srv.slice(srv.indexOf("export async function armarSeleccion"), srv.indexOf("export async function prechequearSemana"));
    const ramaLarga = armar.slice(armar.indexOf('if (prep.tipo === "lista") {'), armar.indexOf("let corto: EstadoBloque"));
    const ramaCorta = armar.slice(armar.indexOf('if (prepStr?.tipo === "lista") {'), armar.indexOf("} else if (prepStr) {"));
    // ⚠ ACTA (19-oct-2026) · los dos bloques reciben lo ya visto, leído una vez, y cada uno elige con él (SEMANAL §15).
    if (!/const prepStr = await prepararSeleccionStr\(admin, userId, cfg, pp, vistos\);/.test(armar)
      || !/const g = await elegirSemanal\(candidatos, evaluar, publicado, respaldo, REGLA_LARGA, visto\);/.test(ramaLarga)
      || !/const g = await elegirSemanal\(candidatos, evaluar, publicado, respaldo, REGLA_CORTA, visto\);/.test(ramaCorta)
      // ⚠ ACTA (23-oct-2026, el orden fijo, tier PUERTA-B-MOCKUPS §4) · los ítems respetan el orden de lo que la fila ya tenía.
      || !/items_str: aItems\(g, undefined, previos\.corto\), estado_str: g\.estado, combinacion_str: combo, perfil_str: perfil, origen_str_analysis_id: o\.analysisId,/.test(armar)
      || !/const estado = estadoDeFila\(largo, corto\);/.test(armar))
      F("2 · el armado no arma el bloque de renta corta con su regla (solo Comprar) y el mismo presupuesto (o no lo guarda)");
    if (!/const perfil = opts\.nuevosDesde \? pp\.perfil : pp\.perfilLtr;/.test(srv)) F("2 · el bloque de renta larga no sale del perfil de renta larga (quien solo tiene renta corta lo recibiría)");
    const pbs = sinComentarios(leer("src/lib/perfil-busqueda-servidor.ts"));
    // ⚠ ACTA (16-oct-2026, goal «la puerta B») · sin ningún informe, el perfil de cada bloque sale de lo editado a mano
    // (la cuenta de /deptos); con informes, igual que antes (PUERTA-B §3).
    if (!/perfilLtr: filasLtr\.length > 0 \? perfilDeBusqueda\(filasLtr, manual\) : soloManual && manual\.modalidad !== "str" \? perfilDeBusqueda\(\[\], manual\) : null,/.test(pbs) || !/perfilStr: filasStr\.length > 0 \? perfilDeBusqueda\(filasStr, manual\)/.test(pbs)) F("2 · los dos perfiles no salen de sus informes (renta larga y renta corta por separado)");
    // El envío y la página.
    const enviar = srv.slice(srv.indexOf("export async function enviarSeleccion"), srv.indexOf("export async function enviarSinSeleccion"));
    if (!/conCorto \? itemsVigentes\(admin, fila\.items_str \?\? \[\]\)/.test(enviar) || !/largo: conLargo,/.test(enviar) || !/corto: conCorto \? \{\s*deptos: deptosCortos\.map/.test(enviar))
      F("2 · el envío no manda el bloque de renta corta (o manda el de renta larga a quien no lo tiene)");
    if (!/sel\.corto && \(\s*<SemanalLista[\s\S]*?modalidad="str"[\s\S]*?\/>/.test(pagina) || !/sel\.largo && \(\s*<SemanalLista/.test(pagina) || !/largo: sel\.conLargo \? \{/.test(pagina)) F("2 · la página no muestra el bloque de renta corta (o muestra el de renta larga a quien no lo tiene)");
    if (!/\{corta && <p className="guia-negociar" data-semanal="zona">\{MARCA_ZONA\}<\/p>\}/.test(lista)) F(`2 · en la página, los deptos de renta corta no llevan la marca «${STR.MARCA_ZONA}»`);
  }

  // ── 3 · EL ANÁLISIS QUE NO SE COBRA CUANDO CAMBIA EL VEREDICTO ───────────────────
  {
    if (STR.cambiaVeredicto("COMPRAR", "COMPRAR") || !STR.cambiaVeredicto("COMPRAR", "AJUSTA SUPUESTOS") || !STR.cambiaVeredicto("AJUSTA SUPUESTOS", "COMPRAR") || !STR.cambiaVeredicto("COMPRAR", null))
      F("3 · «cambia el veredicto» no es cualquier diferencia con lo que vio la persona");
    // Cambia: no se reclama, no se cobra, no hay informe; vuelven los siguientes.
    const a = dobles({ fino: "AJUSTA SUPUESTOS" });
    const ra = await a.correr();
    if (ra.estado !== "no-da" || a.n.reclamar !== 0 || a.n.cobrar !== 0 || a.n.crear !== 0) F(`3 · con el veredicto cambiado igual se reclama, se cobra o se crea (${JSON.stringify({ estado: ra.estado, ...a.n, registrar: a.n.registrar.length })})`);
    if (ra.estado === "no-da" && (ra.alternativas.join() !== "b,c" || a.n.alternativas !== 1)) F("3 · con el veredicto cambiado no vuelven los siguientes de su selección");
    // Se sostiene: un cobro y un informe.
    const b = dobles({ fino: "COMPRAR" });
    const rb = await b.correr();
    if (rb.estado !== "creado" || b.n.cobrar !== 1 || b.n.crear !== 1 || b.n.reclamar !== 1) F(`3 · con el veredicto sostenido no se cobra una vez y se crea el informe (${JSON.stringify({ estado: rb.estado, ...b.n, registrar: b.n.registrar.length })})`);
    // LA REGLA DE COBRO ES SIMPLE (14-oct-2026): si lo fino no da Comprar, no se cobra, aunque repita el Ajustar que vio
    // la persona (los negociables de las selecciones anteriores); si da Comprar, se cobra aunque ella hubiera visto Ajustar.
    const c = dobles({ fino: "AJUSTA SUPUESTOS", mostrado: "AJUSTA SUPUESTOS" });
    const rc = await c.correr();
    if (rc.estado !== "no-da" || c.n.cobrar !== 0 || c.n.reclamar !== 0 || c.n.crear !== 0) F(`3 · un Ajustar que lo fino confirma como Ajustar se cobra (no da Comprar) (${JSON.stringify({ estado: rc.estado, cobrar: c.n.cobrar })})`);
    if (c.n.registrar.length !== 1 || c.n.registrar[0].cambio || c.n.registrar[0].cobrado) F("3·4 · el Ajustar que se repite no queda registrado como «no cambió, no se cobró»");
    const c2 = dobles({ fino: "COMPRAR", mostrado: "AJUSTA SUPUESTOS" });
    if ((await c2.correr()).estado !== "creado" || c2.n.cobrar !== 1) F("3 · uno que se vio como Ajustar y lo fino da Comprar no se analiza");
    for (const v of ["BUSCAR OTRA", null] as const) {
      const x = dobles({ fino: v });
      if ((await x.correr()).estado !== "no-da" || x.n.cobrar !== 0) F(`3 · lo fino da ${v ?? "sin veredicto"} y se cobra`);
    }
    if (STR.daComprar("AJUSTA SUPUESTOS") || STR.daComprar(null) || !STR.daComprar("COMPRAR")) F("3 · «da Comprar» no es exactamente COMPRAR");
    // Despublicado, ya creado o sin poder medir: ni medición ni cobro.
    const d = dobles({ fino: "COMPRAR", publicado: false });
    const e = dobles({ fino: "COMPRAR", ya: "informe-viejo" });
    const f = dobles({ fino: "COMPRAR", sinPreparar: true });
    const [rd, re, rf] = [await d.correr(), await e.correr(), await f.correr()];
    if (rd.estado !== "despublicado" || d.n.preparar !== 0 || d.n.cobrar !== 0) F("3 · un despublicado se mide o se cobra");
    if (re.estado !== "ya-creado" || e.n.preparar !== 0 || e.n.cobrar !== 0) F("3 · un depto ya analizado se vuelve a medir o a cobrar");
    if (rf.estado !== "sin-preparar" || f.n.cobrar !== 0 || f.n.registrar.length !== 0) F("3 · sin poder medir (sin dirección) se cobra o se registra una comparación vacía");
    // Los siguientes: en orden, sin el que no dio y sin los que ya se sabe que no dan, hasta tres.
    const items = ["a", "b", "c", "d", "e"].map((avisoId) => ({ avisoId }));
    const alt = STR.alternativasNoDa(items, "b", new Set(["d"])).map((x) => x.avisoId).join();
    if (alt !== "c,e,a" || STR.ALTERNATIVAS_NO_DA < 2 || STR.ALTERNATIVAS_NO_DA > 3) F(`3 · los siguientes no son «los dos o tres siguientes de su selección» (${alt})`);
    if (STR.NO_DA !== "Con los datos de su dirección, este depto no da para renta corta. Estos sí dan, con esos mismos datos:") F("3 · el mensaje cuando no da no es el aprobado");
    // La ruta: compara contra lo que vio la persona, mide fino con el contador «semanal», y no mide sin análisis.
    if (!/mostrado: \{ veredicto: item\.veredicto!, score: item\.score \?\? null \}/.test(ruta)) F("3 · la ruta no compara contra el veredicto que vio la persona");
    if (!/await buildShortTermAnalysisRow\(body, ufValue, mercado, undefined, \{ origen: "semanal" \}\)/.test(ruta)) F("3 · la medición fina no es la del informe o no se cuenta como del semanal");
    if (!/const lugar = await reverseGeocode\(aviso\.lat, aviso\.lng\);/.test(ruta)) F("3 · la medición fina no va por la dirección del depto, como en el wizard");
    const iSaldo = ruta.indexOf('if (saldo.tipo === "sin") return { ok: false, status: 402, error: "sin-creditos" };'), iMide = ruta.indexOf("await buildShortTermAnalysisRow(");
    if (iSaldo < 0 || iMide < 0 || iSaldo > iMide) F("3 · sin análisis disponibles igual se consulta al proveedor");
    // ⚠ ACTA (15-oct-2026) · la respuesta sale por `salir`, que le suma el espejo de AnalizarEste (tier MEDICION-META).
    if (!/const r = await analizarStrDeSemanal\(\{/.test(ruta) || !/if \(r\.estado === "no-da"\) return salir\(NextResponse\.json\(\{ estado: "no-da", alternativas: r\.alternativas \}\)\);/.test(ruta)) F("3 · la ruta no pasa por analizarStrDeSemanal o no devuelve los siguientes");
    if (!/if \(res\.ok && d\.estado === "no-da"\) \{\s*setNoDanAhora\(\(xs\) => \[\.\.\.xs, it\.avisoId\]\);\s*setPopup\(\{ avisoId: it\.avisoId, parecidos: d\.alternativas \?\? \[\] \}\);\s*break;\s*\}/.test(lista))
      F("3 · la página no abre el pop-up con los parecidos cuando no da (o no marca la tarjeta)");
  }

  // ── 4 · EL REGISTRO DE LA COMPARACIÓN ────────────────────────────────────────────
  {
    const a = dobles({ fino: "BUSCAR OTRA" });
    await a.correr();
    const ca = a.n.registrar;
    if (ca.length !== 1 || !ca[0].cambio || ca[0].cobrado || ca[0].mostrado !== "COMPRAR" || ca[0].fino.veredicto !== "BUSCAR OTRA" || ca[0].zona?.veredicto !== "COMPRAR" || ca[0].fino.adr == null)
      F(`3·4 · la comparación de un veredicto que cambió no queda registrada entera (${JSON.stringify(ca)})`);
    const b = dobles({ fino: "COMPRAR" });
    await b.correr();
    const cb = b.n.registrar;
    if (cb.length !== 2 || cb[0].cambio || cb[0].cobrado || !cb[1].cobrado || cb[1].analysisId !== "informe-1") F(`4 · la comparación de un veredicto sostenido no queda registrada (antes de cobrar) y anotada como cobrada después (${JSON.stringify(cb)})`);
    if (!/from\("comparaciones_zona_str"\)\.upsert\(\{\s*\.\.\.clave, seleccion_id: sel\.id,\s*zona_mostrado: c\.mostrado, zona_score: c\.mostradoScore,[\s\S]*?cambio: c\.cambio, cobrado: c\.cobrado, analysis_id: c\.analysisId,[\s\S]*?\}, \{ onConflict: "user_id,aviso_id" \}\)/.test(ruta))
      F("4 · la ruta no guarda la comparación (zona mostrada, fina, si cambió y si se cobró) por persona y aviso");
    const mig = leer("supabase/migrations/20261014_semanal_renta_corta.sql");
    if (!/create table if not exists public\.comparaciones_zona_str \(/.test(mig) || !/cambio boolean not null,/.test(mig) || !/primary key \(user_id, aviso_id\)\s*\);\s*create index if not exists comparaciones_zona_str_medido/.test(mig) || !/revoke all on public\.comparaciones_zona_str from anon, authenticated;/.test(mig))
      F("4 · la tabla de comparaciones no existe en la migración (o la puede leer cualquiera)");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const { error } = await createClient(url, key).from("comparaciones_zona_str").select("user_id", { count: "exact", head: true });
      if (error) F(`4 · la tabla comparaciones_zona_str no está en la base (${error.message})`);
    }
  }

  // ── 5 · EL PRESUPUESTO: los dos bloques dentro de los 240 s del prechequeo y del armado ──
  {
    const pre = srv.slice(srv.indexOf("export async function prechequearSemana"), srv.indexOf("const FUENTE_AVANCE"));
    // ⚠ ACTA (19-oct-2026) · el prechequeo prepara los dos bloques con lo ya visto, leído una vez (SEMANAL §15).
    if (!/const \[l, s\] = await Promise\.all\(\[prepararSeleccion\(admin, userId, cfg, \{ perfilLeido: pp, vistos \}\), prepararSeleccionStr\(admin, userId, cfg, pp, vistos\)\]\);/.test(pre)
      || !/p\.str \? await siguienteYEstado\(p\.str\.candidatos, p\.str\.evaluar, enMemoria, p\.str\.respaldo, REGLA_CORTA, p\.str\.visto\) : null,/.test(pre)
      || !/estado\.set\(userId, rs\.every\(\(r\) => r\.armada\) \? "armada" : aviso \? "pendiente" : "sin-candidatos"\);/.test(pre))
      F("5 · el prechequeo no cuenta la selección de renta corta (o la da por armada sin chequear)");
    if (!/if \(pp\.semanalBajaAt\) return null;/.test(pre)) F("5 · el prechequeo prepara la renta corta de quien se dio de baja");
    const rutaPre = sinComentarios(leer("src/app/api/cron/semanal-prechequeo/route.ts"));
    if (!/hastaMs: t0 \+ PRESUPUESTO_PRECHEQUEO_MS,/.test(rutaPre)) F("5 · el prechequeo no corta a los 240 s");
    const rutaArmar = sinComentarios(leer("src/app/api/cron/semanal-armar/route.ts"));
    if (!/const PRESUPUESTO_MS = 240_000;/.test(rutaArmar) || !/if \(Date\.now\(\) - t0 > PRESUPUESTO_MS \|\| presupuesto\.bloqueada\) break;/.test(rutaArmar)) F("5 · el armado del domingo no corta a los 240 s");
    const rechequeo = srv.slice(srv.indexOf("export async function rechequearArmadas"), srv.indexOf("export interface SeleccionPorToken"));
    if (!/\.select\("id, user_id, items, items_str"\)/.test(rechequeo) || !/items: \[\.\.\.\(s\.items \?\? \[\]\), \.\.\.\(s\.items_str \?\? \[\]\)\]/.test(rechequeo)) F("5 · el rechequeo del domingo no mira los deptos de renta corta");
  }

  // ── 6 · EL CLIC EN UN DEPTO DE RENTA CORTA (19-oct-2026) ─────────────────────────
  // El caso: el 19-oct, 5 clics del correo quedaron como clic «general» (aviso null, destino «seleccion»); 4 eran de
  // personas que solo tenían renta corta. La ruta buscaba el depto solo en el bloque de renta larga, así que el evento
  // perdía el depto y la página no lo ponía primero.
  {
    const L1 = "11111111-1111-4111-8111-111111111111", C1 = "22222222-2222-4222-8222-222222222222", X = "33333333-3333-4333-8333-333333333333";
    const sel = { items: [{ avisoId: L1 }], corto: { items: [{ avisoId: C1 }] } };
    try {
      const corto = SEM.deptoDelClic(sel, C1);
      if (corto.avisoId !== C1 || corto.bloque !== "corto") F(`6 · un clic en un depto de renta corta se guarda sin depto o sin su bloque (${JSON.stringify(corto)})`);
      const largo = SEM.deptoDelClic(sel, L1);
      if (largo.avisoId !== L1 || largo.bloque !== "largo") F(`6 · un clic en un depto de renta larga cambió (${JSON.stringify(largo)})`);
      if (SEM.deptoDelClic(sel, X).avisoId !== null || SEM.deptoDelClic(sel, "no-es-un-id").avisoId !== null || SEM.deptoDelClic(sel, null).bloque !== null) F("6 · un depto que no está en la selección (o un id raro) se toma como depto");
      if (SEM.deptoDelClic({ items: [{ avisoId: L1 }], corto: null }, C1).avisoId !== null) F("6 · sin bloque de renta corta (el aviso inmediato) se acepta un depto ajeno");
      const fila = (id: string) => ({ item: { avisoId: id }, reemplazo: null as { avisoId: string } | null });
      if (SEM.bloqueDelDestacado(C1, [fila(L1)], [fila(C1)]) !== "corto" || SEM.bloqueDelDestacado(L1, [fila(L1)], [fila(C1)]) !== "largo" || SEM.bloqueDelDestacado(null, [fila(L1)], [fila(C1)]) !== null
        || SEM.bloqueDelDestacado(X, [fila(L1)], [{ item: { avisoId: C1 }, reemplazo: { avisoId: X } }]) !== "corto") F("6 · /semanal no sabe en qué bloque está el depto clicado (ni su reemplazo)");
    } catch (err) {
      F(`6 · un clic en un depto de renta corta no se reconoce (${(err as Error).message})`);
    }
    // La ruta: el depto se busca en los dos bloques, el evento lleva el depto y el bloque, y la página abre con él.
    const clic = sinComentarios(leer("src/app/api/semanal/clic/route.ts"));
    if (!/const \{ avisoId, bloque \} = deptoDelClic\(sel, a\);/.test(clic) || /sel\.items\.some\(\(i\) => i\.avisoId === a\)/.test(clic)) F("6 · la ruta del clic busca el depto solo en el bloque de renta larga");
    if (!/properties: \{ semana: sel\.semana, variante: sel\.variante, aviso_id: avisoId, destino, bloque \},/.test(clic)) F("6 · el evento semanal_clic no lleva el bloque del depto");
    const { hrefSeleccion } = await import("../../../src/lib/guia/seleccion-casa");
    if (!/return volver\(hrefSeleccion\(t, avisoId, estado === "despublicado"\)\);/.test(clic) || hrefSeleccion("abc", "x9", true) !== "/dashboard?t=abc&a=x9&d=1#seleccion") F("6 · el clic en un depto no abre la selección con ese depto");
    // La página: con el depto en renta corta, ese bloque va primero —con el título— y el de renta larga, después, con el cierre.
    if (!/cortoPrimero: sel\.conLargo && sel\.corto != null && bloqueDelDestacado\(a, filas, filasCortas\) === "corto",/.test(pagina)) F("6 · /semanal no decide qué bloque va primero según el depto clicado");
    if (!/\{sel\.cortoPrimero \? <>\{listaCorta\}\{listaLarga\}<\/> : <>\{listaLarga\}\{listaCorta\}<\/>\}/.test(pagina)) F("6 · /semanal no pone primero el bloque de renta corta cuando el depto clicado es de ahí");
    const corta = (pagina.match(/const listaCorta = sel\.corto && \(\s*<SemanalLista[\s\S]*?\/>/) ?? [""])[0];
    const larga = (pagina.match(/const listaLarga = sel\.largo && \(\s*<SemanalLista[\s\S]*?\/>/) ?? [""])[0];
    if (!/conTitulo=\{!sel\.largo \|\| sel\.cortoPrimero\}/.test(corta) || !/cierre=\{!sel\.cortoPrimero\}/.test(corta) || !/conTitulo=\{!sel\.cortoPrimero\}/.test(larga) || !/cierre=\{!sel\.corto \|\| sel\.cortoPrimero\}/.test(larga))
      F("6 · con el bloque de renta corta primero, el título o el cierre quedan en el bloque equivocado");
    if (!/filas=\{sel\.corto\.filas\}/.test(corta) || !/\{\.\.\.comun\}/.test(corta) || !/destacado: sel\.destacado,/.test(pagina) || !/filas: primero\(filasCortas\),/.test(pagina) || !/destacado: a,/.test(pagina)) F("6 · en su bloque, el depto clicado no va arriba ni destacado");
  }

  if (fallas.length) {
    console.log(`  ✗ SEMANAL-STR · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el bloque de renta corta se estima por zona sin consultar al proveedor, solo con Comprar (vecinas sí, negociables no); un correo con los dos bloques (o solo el suyo) y la marca de zona; si la medición fina no da Comprar no se cobra y vuelven los parecidos; cada comparación queda registrada; los dos bloques dentro de los 240 s");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runSemanalStrTier().then((r) => process.exit(r.hard ? 1 : 0));
}
