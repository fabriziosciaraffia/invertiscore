// ============================================================================
// TIER EDAD-EDIFICIO — la edad del edificio entra y se dice tal cual cuando se conoce (03-nov-2026, goal de Fabrizio).
//
//   1 · EL MOTOR RECIBE LA EDAD REAL: con el año de la ficha o de otro aviso del edificio, un edificio de 1951 entra con 75 años
//       —no con el 25 de la banda «20+»— en renta larga y corta, en el DFL2 y en el re-análisis, y usa el tramo de más de 25
//       años de la puesta a punto. Sin año, los 25 supuestos. La banda manda solo cuando la persona la cambia en el wizard.
//   2 · EL TEXTO LO DICE: la ficha de la portada («Usado · 75 años, edificio de 1951», con «según la ficha» o «según otro aviso
//       del edificio» en la línea chica), la puesta a punto del motor («Departamento de 75 años») y «Cómo lo pagas» («un depto
//       de 75 años», con «Edificio de 1951, según la ficha.»), en renta larga y corta.
//   3 · LA EDAD DEL AVISO: la ficha leída al tocar, o la de otro aviso del edificio (la fuente es «edificio» solo si la dio OTRO
//       aviso), con el año y la fuente guardados en `origenAviso`; sin año, por qué: la ficha se leyó y no lo dice, o no se pudo
//       leer (tope, error, bloqueo o sin enlace). Las dos rutas de «Analizar este» lo cablean.
//   4 · LA NOTA DICE LA VERDAD: «La publicación no dice la antigüedad; Franco supuso 25 años.» o «No pudimos leer la antigüedad;
//       Franco supuso 25 años.», sin «lo más prudente»; los informes de antes leen «no dice» (los 44 tuvieron su ficha leída).
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. 0 tokens, sin base.
// Solo:  node --import tsx scripts/eval/golden/edad-edificio-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { aniosDelUsado, bandaDeAnios } from "../../../src/components/formulario-v4/helpers-wizard";
import { buildLtrPayload, buildStrPayload, datosDfl2, type SubmitContext } from "../../../src/components/formulario-v4/wizardV4Payload";
import { respuestasDesdeInforme } from "../../../src/components/formulario-v4/wizardV4Reanalisis";
import { respuestasDeAviso, type AvisoParaEvaluar } from "../../../src/lib/avisos/evaluar-aviso";
import { aniosDesde, claveEdificio } from "../../../src/lib/guia/ficha-anio";
import { antiguedadDelAviso, camposDeEdad, lecturaAnioDe } from "../../../src/lib/guia/analizar-servidor";
import { cuerpoStrDeAviso } from "../../../src/lib/guia/semanal-str-servidor";
import { edadDelInforme, supuestaDelInforme, type EdadEdificio } from "../../../src/lib/guia/edad-edificio";
import { INFORME_DE_AVISO } from "../../../src/lib/guia/copy";
import { buildFichaLtr, buildFichaStr } from "../../../src/lib/ficha-depto";
import { construirComoLoPagas, type EntradaComoLoPagas } from "../../../src/lib/como-lo-pagas";
import { calcCapexPuestaAPunto } from "../../../src/lib/capex-puesta-a-punto";
import { runAnalysis } from "../../../src/lib/analysis";
import { GOLDEN_SEEDS, GOLDEN_UF, GOLDEN_ASOF } from "./seeds";
import type { AnalisisInput, HallazgoPuestaAPunto } from "../../../src/lib/types";
import type { CandidatoGuia } from "../../../src/lib/guia/guia-servidor";

(globalThis as { React?: unknown }).React = React;
(require as unknown as { extensions: Record<string, (m: { exports: unknown }) => void> }).extensions[".css"] = (m) => { m.exports = {}; };
const RAIZ = join(__dirname, "..", "..", "..");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n"));
const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
/** Los argumentos de una llamada `nombre({ … })`, contando llaves. "" si no está. */
function llamada(src: string, nombre: string): string {
  const i = src.indexOf(`${nombre}({`);
  if (i < 0) return "";
  let prof = 0;
  for (let k = i + nombre.length + 1; k < src.length; k++) {
    if (src[k] === "{") prof++;
    else if (src[k] === "}" && --prof === 0) return src.slice(i, k + 1);
  }
  return "";
}

const AHORA = new Date("2026-11-03T12:00:00Z");
const ANIO = 1951;
const EDAD = aniosDesde(ANIO, AHORA); // 75
const FICHA: EdadEdificio = { anio: ANIO, fuente: "ficha" };
const OTRO: EdadEdificio = { anio: ANIO, fuente: "edificio" };
const CTX: SubmitContext = {
  ufCLP: GOLDEN_UF, tasaMercado: 4.1, arriendoSugerido: 550000, arriendoN: 20, arriendoFuente: "radio", arriendoRango: null, muestraArriendo: null,
  precioM2UF: 60, radiusUsed: 800, ggccSugerido: 80000, ventaN: 30, ventaFuente: "radio", ventaUniverso: "usado", ventaRadio: 800,
};
const AVISO: AvisoParaEvaluar = { id: "a1", comuna: "Providencia", lat: -33.44328, lng: -70.63067, precioUF: 3000, m2: 50, dormitorios: 2, banos: 1, condicion: "usado", direccion: null, fechaEntrega: null, antiguedadAnios: null };
const CANDIDATO = {
  avisoId: "a1", distanciaM: 0, comuna: "Providencia", lat: -33.44328, lng: -70.63067, m2: 50, dormitorios: 2, banos: 1, condicion: "usado", direccion: null,
  fechaEntrega: null, url: null, precioUF: 3000, antiguedadAnios: null, antiguedadOrigen: "supuesta",
  arriendo: { monto: 550000, fuente: "radio", n: 20, radio: 800, radioMonto: 550000, radioFuente: "radio", segmento: null },
  venta: { precioM2UF: 60, fuente: "radio", n: 30, universo: "usado", radio: 800 }, gastosComunes: 80000, medianaComuna: null,
} as unknown as CandidatoGuia;

/** Una base de juguete para `anios_edificio`: la fila del edificio, si hay, y qué se le preguntó. */
function baseDe(fila: { anio: number; aviso_id: string } | null) {
  const pedidos: Array<{ tabla: string; edificio: unknown }> = [];
  const admin = {
    from: (tabla: string) => ({
      select: () => ({ eq: (_c: string, edificio: unknown) => ({ maybeSingle: async () => { pedidos.push({ tabla, edificio }); return { data: fila, error: null }; } }) }),
    }),
  };
  return { admin: admin as never, pedidos };
}

export async function runEdadEdificioTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER EDAD-EDIFICIO (la edad real del edificio entra al motor y se dice —con el año y la fuente— en la portada, la puesta a punto y «Cómo lo pagas»; la nota distingue «no dice» de «no pudimos leer» · 0 tokens) ───");

  // ── 1 · el motor recibe la edad real ─────────────────────────────────────────
  if (EDAD !== 75) F(`1 · un edificio de 1951 no tiene 75 años el 03-nov-2026 (dio ${EDAD})`);
  if (aniosDelUsado({ antiguedad: "20+", antiguedadAnios: 75 }) !== 75) F("1 · con la edad real, el motor no la recibe tal cual");
  if (aniosDelUsado({ antiguedad: "20+" }) !== 25) F("1 · sin edad real, la banda «20+» no da 25");
  if (aniosDelUsado({ antiguedad: "11-20", antiguedadAnios: 75 }) !== 15) F("1 · si la persona cambia la banda, la edad real sigue mandando");
  if (aniosDelUsado({ antiguedad: "6-10", antiguedadAnios: 6 }) !== 6) F("1 · un edificio de 6 años entra con el 8 de la banda");
  if (bandaDeAnios(75) !== "20+" || bandaDeAnios(6) !== "6-10" || bandaDeAnios(2) !== "0-2") F("1 · la banda de unos años conocidos no es la del wizard");
  const r75 = respuestasDeAviso({ ...AVISO, antiguedadAnios: EDAD }, 20, 4.1, 550000, { plazo: 30, tasaMercado: 4.1 });
  const r25 = respuestasDeAviso(AVISO, 20, 4.1, 550000, { plazo: 30, tasaMercado: 4.1 });
  if (r75.antiguedad !== "20+" || r75.antiguedadAnios !== 75) F("1 · las respuestas del aviso no llevan la edad real junto a su banda");
  if (r25.antiguedadAnios !== undefined || r25.antiguedad !== "20+") F("1 · un aviso sin año lleva una edad real o no lleva la banda supuesta");
  if (respuestasDeAviso({ ...AVISO, condicion: "nuevo", antiguedadAnios: 3 }, 20, 4.1, 550000).antiguedadAnios !== undefined) F("1 · la obra nueva lleva edad de usado");
  if (buildLtrPayload(r75, CTX).antiguedad !== 75) F("1 · renta larga: un edificio de 1951 no entra con 75 años");
  if (buildLtrPayload(r25, CTX).antiguedad !== 25) F("1 · renta larga: sin año no entra con los 25 supuestos");
  if (buildStrPayload({ ...r75, modalidad: "str" }, CTX).antiguedad !== 75) F("1 · renta corta: un edificio de 1951 no entra con 75 años");
  if (datosDfl2(r75).aniosDesdeRecepcion !== 75) F("1 · el DFL2 no cuenta los años reales desde la recepción");
  const str = cuerpoStrDeAviso(CANDIDATO, { tasa: 4.1, modoGestion: "auto", comisionAdministrador: 0.2 } as never, { piePct: 20, plazoAnios: 30 }, { uf: GOLDEN_UF, tasa: 4.1 }, { antiguedadAnios: EDAD });
  if (!str || str.antiguedad !== 75) F(`1 · el cuerpo de renta corta del aviso no entra con 75 años (${str?.antiguedad})`);
  // El tramo de más de 25 años de la puesta a punto, y el motor que lo usa y lo dice.
  const c75 = calcCapexPuestaAPunto({ antiguedad: 75, superficieUtilM2: 50, valorUF: GOLDEN_UF, modelo: "v3" });
  const c25 = calcCapexPuestaAPunto({ antiguedad: 25, superficieUtilM2: 50, valorUF: GOLDEN_UF, modelo: "v3" });
  if (!(c75.ufM2Min >= 1.8) || !(c25.ufM2Max <= 1.6)) F(`1 · 75 años no cae en el tramo de más de 25 de la puesta a punto (${c75.ufM2Min}–${c75.ufM2Max} contra ${c25.ufM2Min}–${c25.ufM2Max})`);
  const base = GOLDEN_SEEDS[0].input as AnalisisInput;
  const capexDe = (r: ReturnType<typeof runAnalysis>) =>
    ((r.hallazgos ?? []).find((h) => h.id === "capex_puesta_a_punto") as HallazgoPuestaAPunto | undefined) ?? (r.metrics?.hallazgoPuestaAPunto as HallazgoPuestaAPunto | undefined) ?? null;
  const m75 = capexDe(runAnalysis({ ...base, esNuevo: false, enConstruccion: false, antiguedad: 75 }, GOLDEN_UF, GOLDEN_SEEDS[0].mediana, GOLDEN_ASOF));
  const m25 = capexDe(runAnalysis({ ...base, esNuevo: false, enConstruccion: false, antiguedad: 25 }, GOLDEN_UF, GOLDEN_SEEDS[0].mediana, GOLDEN_ASOF));
  if (!m75 || m75.valor.antiguedadAnios !== 75 || !/^Departamento de 75 años:/.test(m75.fraseCanonica ?? "")) F("1 · la puesta a punto del motor no dice «Departamento de 75 años»");
  if (!m75 || !m25 || !(m75.valor.montoUF > m25.valor.montoUF)) F("1 · el motor no cobra más puesta a punto a 75 años que a 25");

  // ── 2 · el texto dice la edad, el año y la fuente ────────────────────────────
  const estado = (f: ReturnType<typeof buildFichaLtr>) => f.grupos.flatMap((g) => g.filas).find((x) => x.k === "Estado");
  const fichaLtr = (edad: EdadEdificio | null) => buildFichaLtr({ input: { ...base, esNuevo: false, enConstruccion: false, estadoVenta: "inmediata", antiguedad: 75 } as AnalisisInput, results: null, medianaUfM2: null, direccion: "", comuna: "Providencia", ufValue: GOLDEN_UF, moneda: "UF", edad });
  const eF = estado(fichaLtr(FICHA)), eO = estado(fichaLtr(OTRO)), eS = estado(fichaLtr(null));
  if (eF?.v !== "Usado · 75 años, edificio de 1951" || eF?.sub !== "según la ficha") F(`2 · la ficha de la portada no dice «Usado · 75 años, edificio de 1951» con «según la ficha» (${eF?.v} / ${eF?.sub})`);
  if (eO?.sub !== "según otro aviso del edificio") F("2 · con el año de otro aviso, la ficha no dice «según otro aviso del edificio»");
  if (eS?.v !== "Usado · 75 años" || eS?.sub !== undefined) F("2 · sin el año, la ficha inventa un año o una fuente");
  const fichaStr = buildFichaStr({ input: { tipoPropiedad: "usado", antiguedad: 75, superficieUtil: 50, dormitorios: 2, banos: 1, precioCompra: 3000 * GOLDEN_UF, precioCompraUF: 3000 }, adrNoche: null, ocupacionZona: null, direccion: "", comuna: "Providencia", moneda: "UF", edad: OTRO });
  const eStr = fichaStr.grupos.flatMap((g) => g.filas).find((x) => x.k === "Estado");
  if (eStr?.v !== "Usado · 75 años, edificio de 1951" || eStr?.sub !== "según otro aviso del edificio") F("2 · la ficha de renta corta no dice la edad, el año y la fuente");
  const entrada = (edad: EdadEdificio | null): EntradaComoLoPagas => ({
    modalidad: "LTR", veredicto: "COMPRAR", precioUF: 3000, superficieM2: 50, comuna: "Providencia", piePctActual: 20, plazoActual: 30, distancia: null, sobre: null,
    limiteTirUF: null, mesCierraUF: null, alternativa: null, valorUF: GOLDEN_UF, edad,
    capex: { montoUF: 110, montoCLP: 110 * GOLDEN_UF, ufM2: 2.2, antiguedadAnios: 75, superficieUtilM2: 50, origen: "derivado", fraccionInversion: 0.1 } as unknown as HallazgoPuestaAPunto["valor"],
  });
  const pagas = construirComoLoPagas(entrada(FICHA));
  const intro = (pagas.capex?.intro ?? []).map((s) => s.t).join("");
  if (!/un depto de 75 años/.test(intro)) F("2 · «Cómo lo pagas» no dice «un depto de 75 años»");
  if (pagas.capex?.fuenteEdad !== "Edificio de 1951, según la ficha.") F(`2 · «Cómo lo pagas» no dice el año y la fuente (${pagas.capex?.fuenteEdad})`);
  if (construirComoLoPagas(entrada(OTRO)).capex?.fuenteEdad !== "Edificio de 1951, según otro aviso del edificio.") F("2 · «Cómo lo pagas» no distingue la fuente «otro aviso del edificio»");
  if (construirComoLoPagas(entrada(null)).capex?.fuenteEdad !== null) F("2 · «Cómo lo pagas» inventa la fuente sin el año");
  try {
    const { CapituloComoLoPagas } = require(join(RAIZ, "src/components/analysis/shared/CapituloComoLoPagas")) as { CapituloComoLoPagas: React.FC<Record<string, unknown>> };
    const html = renderToStaticMarkup(createElement(CapituloComoLoPagas, { modelo: pagas, valorUF: GOLDEN_UF }));
    if (!/data-fuente-edad/.test(html) || !texto(html).includes("Edificio de 1951, según la ficha.")) F("2 · el capítulo no dibuja la línea de la fuente de la edad");
    const sin = renderToStaticMarkup(createElement(CapituloComoLoPagas, { modelo: construirComoLoPagas(entrada(null)), valorUF: GOLDEN_UF }));
    if (/data-fuente-edad/.test(sin)) F("2 · el capítulo dibuja la línea de la fuente sin el año");
  } catch (e) {
    F(`2 · no se pudo dibujar el capítulo: ${(e as Error).message}`);
  }
  const edadDe = (v: unknown) => edadDelInforme({ origenAviso: { avisoId: "a1", antiguedad: "ficha", edad: v } });
  if (JSON.stringify(edadDe({ anio: 1951, fuente: "edificio" })) !== JSON.stringify(OTRO) || edadDe({ anio: "1951", fuente: "ficha" }) !== null || edadDelInforme({}) !== null) F("2 · el informe no lee bien su año y su fuente");
  const subject = codigo("src/components/analysis/SubjectCardGrid.tsx");
  const strCli = codigo("src/app/analisis/renta-corta/[id]/results-client.tsx");
  if (!/\bedad: edadDelInforme\(inputData\)/.test(llamada(subject, "buildFichaLtr"))) F("2 · la portada de renta larga no le pasa el año a la ficha");
  if (!/\bedad: edadDelInforme\(inputData\)/.test(llamada(strCli, "buildFichaStr"))) F("2 · la portada de renta corta no le pasa el año a la ficha");
  if (!/\bedad: edadDelInforme\(inputData\)/.test(llamada(codigo("src/components/analysis/CapitulosInversion.tsx"), "construirComoLoPagas"))) F("2 · «Cómo lo pagas» de renta larga no recibe el año");
  if (!/\bedad: edadDelInforme\(inputData\)/.test(llamada(codigo("src/components/analysis/str/CapitulosInversionStr.tsx"), "construirComoLoPagas"))) F("2 · «Cómo lo pagas» de renta corta no recibe el año");

  // ── 3 · la edad del aviso: el año, su fuente, o por qué se supuso ───────────
  const conAnio = await antiguedadDelAviso(baseDe(null).admin, CANDIDATO, { leida: true, anio: ANIO }, AHORA);
  if (conAnio.anios !== 75 || conAnio.origen !== "ficha" || JSON.stringify(conAnio.edad) !== JSON.stringify(FICHA)) F("3 · con el año de la ficha leída, no son 75 años según la ficha");
  const b1 = baseDe({ anio: 1966, aviso_id: "otro" });
  const deOtro = await antiguedadDelAviso(b1.admin, CANDIDATO, { leida: true, anio: null }, AHORA);
  if (deOtro.anios !== 60 || deOtro.edad?.fuente !== "edificio" || deOtro.edad?.anio !== 1966) F("3 · con el año de otro aviso del edificio, no dice «edificio»");
  if (b1.pedidos[0]?.tabla !== "anios_edificio" || b1.pedidos[0]?.edificio !== claveEdificio(CANDIDATO)) F("3 · no busca el año en el edificio del aviso");
  const deEste = await antiguedadDelAviso(baseDe({ anio: 1966, aviso_id: "a1" }).admin, CANDIDATO, { leida: false, anio: null }, AHORA);
  if (deEste.edad?.fuente !== "ficha") F("3 · el año que dio la ficha de ESTE aviso (guardado en el edificio) se rotula como de otro aviso");
  const noDice = await antiguedadDelAviso(baseDe(null).admin, CANDIDATO, { leida: true, anio: null }, AHORA);
  if (noDice.anios !== null || noDice.origen !== "supuesta" || noDice.supuestaPor !== "no-dice" || noDice.edad) F("3 · la ficha leída sin año no queda como «no dice»");
  const noLeida = await antiguedadDelAviso(baseDe(null).admin, CANDIDATO, { leida: false, anio: null }, AHORA);
  if (noLeida.origen !== "supuesta" || noLeida.supuestaPor !== "no-leida") F("3 · la ficha que no se pudo leer no queda como «no pudimos leer»");
  const nuevo = await antiguedadDelAviso(baseDe(null).admin, { ...CANDIDATO, condicion: "nuevo" }, { leida: false, anio: null }, AHORA);
  if (nuevo.origen !== "nuevo" || nuevo.supuestaPor || nuevo.edad) F("3 · la obra nueva queda con edad o con supuesto");
  const lec = (l: Parameters<typeof lecturaAnioDe>[0]) => JSON.stringify(lecturaAnioDe(l));
  if (lec({ leida: true, motivo: "publicado", anio: null }) !== JSON.stringify({ leida: true, anio: null })) F("3 · un 200 sin año no cuenta como ficha leída");
  if (lec({ leida: true, motivo: "publicado", anio: ANIO }) !== JSON.stringify({ leida: true, anio: ANIO })) F("3 · un 200 con año pierde el año");
  for (const motivo of ["bloqueo", "error", "tiempo"]) if (lecturaAnioDe({ leida: true, motivo, anio: null }).leida) F(`3 · un ${motivo} cuenta como ficha leída`);
  if (lecturaAnioDe({ leida: false }).leida || lecturaAnioDe(null).leida) F("3 · sin lectura (tope o sin enlace) cuenta como ficha leída");
  if (JSON.stringify(camposDeEdad(conAnio)) !== JSON.stringify({ edad: FICHA }) || JSON.stringify(camposDeEdad(noLeida)) !== JSON.stringify({ supuestaPor: "no-leida" }) || JSON.stringify(camposDeEdad(nuevo)) !== "{}") F("3 · lo que `origenAviso` guarda de la edad no es el año y la fuente, o el motivo");
  const servidor = codigo("src/lib/guia/analizar-servidor.ts");
  if (!/body\.origenAviso = \{[^}\n]*\.\.\.camposDeEdad\(antiguedad\) \};/.test(servidor)) F("3 · el informe de renta larga no guarda el año, la fuente ni el motivo");
  for (const [p, nombre] of [["src/app/api/lo-que-sigue/guia/analizar/route.ts", "renta larga"], ["src/app/api/semanal/analizar-str/route.ts", "renta corta"]] as const) {
    const s = codigo(p);
    if (!/lecturaAnio = lecturaAnioDe\(c\.lectura\);/.test(s) || !/antiguedadDelAviso\(admin, aviso, lecturaAnio\)/.test(s)) F(`3 · «Analizar este» de ${nombre} no le pasa la lectura de la ficha a la edad`);
  }
  const rutaStr = codigo("src/app/api/semanal/analizar-str/route.ts");
  if (!/body\.origenAviso = \{[^\n]*\.\.\.camposDeEdad\(antiguedad\) \};/.test(rutaStr)) F("3 · el informe de renta corta no guarda el año, la fuente ni el motivo");
  if (!/cuerpoStrDeAviso\([^\n]*\{ antiguedadAnios: antiguedad\.anios,/.test(rutaStr)) F("3 · el cuerpo de renta corta no recibe la edad del aviso");

  // ── 4 · la nota dice la verdad ───────────────────────────────────────────────
  const NO_DICE = "La publicación no dice la antigüedad; Franco supuso 25 años.";
  const NO_LEIDA = "No pudimos leer la antigüedad; Franco supuso 25 años.";
  if (INFORME_DE_AVISO.antiguedadSupuesta["no-dice"] !== NO_DICE) F("4 · la nota de la ficha sin año no es la aprobada");
  if (INFORME_DE_AVISO.antiguedadSupuesta["no-leida"] !== NO_LEIDA) F("4 · la nota de la ficha sin leer no es la aprobada");
  if (Object.values(INFORME_DE_AVISO.antiguedadSupuesta).some((t) => /prudente/i.test(t))) F("4 · la nota sigue diciendo «lo más prudente»");
  const sup = (o: Record<string, unknown>) => supuestaDelInforme({ origenAviso: { avisoId: "a1", ...o } });
  if (sup({ antiguedad: "supuesta", supuestaPor: "no-leida" }) !== "no-leida" || sup({ antiguedad: "supuesta", supuestaPor: "no-dice" }) !== "no-dice") F("4 · el informe no lee por qué se supuso");
  if (sup({ antiguedad: "supuesta" }) !== "no-dice") F("4 · un informe de antes (sin el motivo) no lee «no dice»");
  if (sup({ antiguedad: "ficha" }) !== null || sup({ antiguedad: "nuevo" }) !== null || supuestaDelInforme(null) !== null) F("4 · hay nota con el año conocido, en obra nueva o sin aviso");
  try {
    const { InformeDeAviso } = require(join(RAIZ, "src/components/guia/InformeDeAviso")) as { InformeDeAviso: React.FC<Record<string, unknown>> };
    const dib = (supuesta: unknown) => texto(renderToStaticMarkup(createElement(InformeDeAviso, { analysisId: "x", veredicto: "COMPRAR", supuesta, esDueno: false })));
    if (!dib("no-dice").includes(NO_DICE) || dib("no-dice").includes(NO_LEIDA)) F("4 · el informe con la ficha sin año no dice «La publicación no dice la antigüedad»");
    if (!dib("no-leida").includes(NO_LEIDA) || dib("no-leida").includes(NO_DICE)) F("4 · el informe con la ficha sin leer no dice «No pudimos leer la antigüedad»");
    if (/supuso/.test(dib(null))) F("4 · el informe con el año conocido dice que lo supuso");
  } catch (e) {
    F(`4 · no se pudo dibujar la nota: ${(e as Error).message}`);
  }
  const ltrCli = codigo("src/app/analisis/[id]/results-client.tsx");
  if (!/<InformeDeAviso [^>]*supuesta=\{supuestaDelInforme\(inputData\)\}/.test(ltrCli)) F("4 · el informe de renta larga no le pasa el motivo a la nota");
  if (!/<InformeDeAviso [^>]*supuesta=\{supuestaDelInforme\(inputData\)\}/.test(strCli)) F("4 · el informe de renta corta no le pasa el motivo a la nota");

  // ── 5 · el re-análisis conserva la edad real ─────────────────────────────────
  const inputAviso = { ...base, esNuevo: false, antiguedad: 75, origenAviso: { avisoId: "a1", antiguedad: "ficha", edad: FICHA } } as unknown as Record<string, unknown>;
  const re = respuestasDesdeInforme(inputAviso, "long-term").respuestas;
  if (re.antiguedad !== "20+" || re.antiguedadAnios !== 75 || buildLtrPayload(re, CTX).antiguedad !== 75) F("5 · el re-análisis de un edificio de 1951 vuelve con los 25 de la banda");
  const reSin = respuestasDesdeInforme({ ...base, esNuevo: false, antiguedad: 25 } as unknown as Record<string, unknown>, "long-term").respuestas;
  if (reSin.antiguedadAnios !== undefined) F("5 · el re-análisis de un informe sin año conocido inventa una edad real");

  if (fallas.length) for (const f of fallas) console.log(`   ✗ ${f}`);
  else console.log("   ✓ EDAD-EDIFICIO: el motor con 75 años, el texto con el año y la fuente, la nota con su motivo");
  return { hard: fallas.length };
}

if (require.main === module) {
  runEdadEdificioTier().then((r) => process.exit(r.hard > 0 ? 1 : 0)).catch((e) => { console.error(e); process.exit(1); });
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTA DE MUTACIONES (03-nov-2026, meta-runner que restaura byte a byte): 37 de 37 en ROJO, cada una por su invariante.
//   §1 N1-N7: aniosDelUsado que siempre da la banda o que deja mandar la edad real con otra banda; el payload de renta larga,
//      el de renta corta y el DFL2 con la banda; las respuestas del aviso sin la edad real; el tramo de más de 25 años de la
//      puesta a punto igual al de 25.
//   §2 N8-N17: la ficha sin la línea de la fuente, sin «edificio de 1951» o con «según la ficha» para otro aviso; la ficha de
//      renta corta sin el año; «Cómo lo pagas» sin la línea o sin dibujarla; las cuatro llamadas (dos portadas, dos capítulos)
//      sin `edad: edadDelInforme(inputData)`.
//   §3 N18-N25 · N35-N37: el año de ESTE aviso rotulado «otro aviso»; la ficha sin leer como «no dice»; un bloqueo o un tope
//      como ficha leída; renta larga y corta sin guardar el año ni el motivo; la ruta sin la lectura; el cuerpo de renta corta
//      sin la edad; `camposDeEdad` sin el motivo; la ficha leída con año rotulada «otro aviso» o ignorada.
//   §4 N26-N31: la nota vieja con «lo más prudente», las dos notas iguales, los informes de antes como «no pudimos leer», la
//      nota que no mira el motivo y los dos informes sin pasárselo.
//   §5 N32-N33: el re-análisis sin la edad real, o con una edad real que el informe no conocía.
//   N34 (§2): el informe que no lee su año.
// ─────────────────────────────────────────────────────────────────────────────
