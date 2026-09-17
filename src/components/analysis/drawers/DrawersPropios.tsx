"use client";

// ════════════════════════════════════════════════════════════════════════════
// Lo que queda de los «drawers propios» — SOLO el Dial de sensibilidad.
//
// ⛔ LOS SEIS Drawer*Str SE RETIRARON el 17-sep-2026, con sus primitivas.
//
// CÓMO MURIERON, que es la parte que vale registrar: el 5-sep-2026 el commit
// `b6406180` («muere el STR viejo») retiró la MAQUINARIA que los abría —`DrawerSTR`,
// `DrawerContentSTR`, `PiramideHallazgosSTR` con su `HALLAZGO_DRAWER_STR`— y los dejó
// a ellos en pie. Su acta afirmaba que el contenido ya vivía en los capítulos, y era
// CIERTO: lo verificamos doce días después y ninguno perdía material. Pero nadie lo
// verificó entonces, y 737 líneas de superficie inalcanzable sobrevivieron dos
// semanas sin que ningún gate chistara.
//
// La lección, y por eso está escrita acá y no solo en el commit: RETIRAR UN LLAMADOR
// DEJA HUÉRFANO A LO LLAMADO, Y ESO NO LO CAZA NINGÚN GATE. El type-check pasa —los
// símbolos siguen bien tipados—, el lint pasa —están exportados, así que no son
// «unused»—, y los tiers no los tocan porque no los nombra nadie. Lo único que lo
// encuentra es preguntarse, al borrar un caller, qué quedó del otro lado.
//
// Cómo se verificó el retiro (los tres métodos, porque el grep solo no alcanza):
//   · por SÍMBOLO — cero importadores fuera de este archivo;
//   · por RUTA — ninguna página de `src/app/` los menciona, y `/dev/drawers-pixel`
//     monta los results-client reales, no los drawers;
//   · en el NAVEGADOR — seis sondas de texto exclusivas, sobre `innerHTML`, abriendo
//     los seis capítulos y clickeando todo lo de adentro: cero de seis.
//
// Y lo que NO se fue, por estar vivo aunque pareciera del mismo lote:
//   · `nivelActualValidado` — lo usa `escalera-pie.tsx` internamente;
//   · `CmpPares` — lo usa `EstructuraComparada`, que los capítulos sí montan;
//   · la clase CSS `.viz-pie` — la usa `CapitulosInversion` con un `<p>` propio.
//     Murió el COMPONENTE `VizPie`, que no tenía consumidor; la clase no.
// ════════════════════════════════════════════════════════════════════════════

import type {
  FullAnalysisResult,
  HallazgoSensibilidad,
  HallazgoDistanciaVeredicto,
} from "@/lib/types";
import {
  Dial,
  type ZonaDial,
  type BordeDial,
} from "@/components/analysis/hallazgos/vocabulario";

// ── Formato (coma decimal chilena, UTF-8 directo) ──────────────────────────────
type Currency = "CLP" | "UF";
// dec1 normaliza el guion ASCII de toFixed al − tipográfico (HUECO-3b): mismo trato
// de signo que el resto de los helpers.
const dec1 = (n: number) => n.toFixed(1).replace(".", ",").replace("-", "−");
const pctStr = (n: number) => dec1(n) + "%";
const round1 = (n: number) => Math.round(n * 10) / 10;

// Monto completo respetando toggle CLP/UF.
function fmtMoney(n: number, currency: Currency, valorUF: number): string {
  const abs = Math.abs(n);
  if (currency === "UF") {
    const uf = abs / (valorUF || 1);
    if (uf >= 100) return "UF " + Math.round(uf).toLocaleString("es-CL");
    return "UF " + dec1(Math.round(uf * 10) / 10);
  }
  return "$" + Math.round(abs).toLocaleString("es-CL");
}

/** Derivación del dial de sensibilidad — compartida por el drawer y el capítulo I
 *  (T3): eje, zonas, bordes y colchón salen de acá, una sola vez. */
function derivarSensibilidad(hallazgo: HallazgoSensibilidad, results: FullAnalysisResult, currency: Currency, valorUF: number) {
  const v = hallazgo.valor;
  const arriendo = results.metrics?.ingresoMensual ?? 0;
  const margenFrac = v.marginPct / 100;
  const colchon = arriendo * margenFrac;
  const piso = arriendo * (1 - margenFrac);
  const base = v.veredictoBase;
  // CORRECCIÓN 7 (FASE 4.1) — sin veredicto de destino (firme) no hay corte ni se inventa.
  const nuevo = v.veredictoNuevo;
  const arriendoStr = fmtMoney(arriendo, currency, valorUF);
  const pisoStr = fmtMoney(piso, currency, valorUF);
  const colchonStr = fmtMoney(colchon, currency, valorUF);
  // GRUPO A — clasifica sobre marginPct redondeado a 1 decimal contra el corte del motor.
  const amplio = round1(v.marginPct) >= v.corteFavorable;

  // ── BORDE DE ARRIBA ── solo es un punto DEL MISMO EJE cuando la palanca más barata
  // es el arriendo. Si lo más barato es bajar el precio o estirar el plazo, ese borde
  // existe pero vive en otro eje: se nombra en prosa y NO se dibuja en el dial.
  const dist = results.hallazgos?.find(
    (h): h is HallazgoDistanciaVeredicto => h.id === "distancia_veredicto",
  );
  const palancaArriba = dist && !dist.valor.esEstructural ? dist.valor.palancaMasBarata : null;
  const objetivoArriba =
    palancaArriba && dist ? (dist.valor.veredictoObjetivo === "COMPRAR" ? "COMPRAR" : "AJUSTA SUPUESTOS") : null;
  const arribaEsArriendo = palancaArriba?.palanca === "arriendo" && (palancaArriba.objetivo ?? 0) > 0;
  const arribaX = arribaEsArriendo ? (palancaArriba!.objetivo as number) : null;

  // ── EJE DEL DIAL ── arriendo mensual, extremos con 8% de aire.
  const puntos = [arriendo, piso, ...(arribaX ? [arribaX] : [])];
  const ejeMin = Math.min(...puntos) * 0.92;
  const ejeMax = Math.max(...puntos) * 1.08;
  const pos = (x: number) => ((x - ejeMin) / (ejeMax - ejeMin)) * 100;

  const tonoDe = (ver: string): "buscar" | "ajusta" | "comprar" =>
    ver === "BUSCAR OTRA" ? "buscar" : ver === "COMPRAR" ? "comprar" : "ajusta";
  const zonas: ZonaDial[] = [];
  const bordes: BordeDial[] = [];
  if (v.firme || !nuevo) {
    zonas.push({ k: base, pct: 100, tono: tonoDe(base) });
  } else {
    zonas.push({ k: nuevo, pct: pos(piso), tono: tonoDe(nuevo) });
    const finBase = arribaX ? pos(arribaX) : 100;
    zonas.push({ k: base, pct: finBase - pos(piso), tono: tonoDe(base) });
    if (arribaX && objetivoArriba) zonas.push({ k: objetivoArriba, pct: 100 - finBase, tono: tonoDe(objetivoArriba) });
    // Formato único tira↔cuerpo (editorial T3): entero sin decimal, coma si no.
    const margenStr = Number.isInteger(round1(v.marginPct)) ? `${Math.round(v.marginPct)}%` : pctStr(v.marginPct);
    bordes.push({ pos: pos(piso), delta: `−${margenStr}`, v: pisoStr, k: `y cae a ${nuevo}`, dir: "abajo" });
    if (arribaX && objetivoArriba) {
      bordes.push({
        pos: pos(arribaX),
        delta: `+${pctStr(Math.abs(palancaArriba!.deltaPct))}`,
        v: fmtMoney(arribaX, currency, valorUF),
        k: `y sube a ${objetivoArriba}`,
        dir: "arriba",
      });
    }
  }
  return { v, arriendo, base, nuevo, arriendoStr, colchonStr, amplio, palancaArriba, objetivoArriba, arribaEsArriendo, arribaX, zonas, bordes, marcaPct: pos(arriendo) };
}

/** El Dial de sensibilidad con su colchón — la viz del capítulo I. Único consumidor:
 *  `CapitulosInversion.tsx`. Era también la del drawer, hasta que el drawer se retiró. */
export function SensibilidadDial({
  hallazgo,
  results,
  currency,
  valorUF,
}: {
  hallazgo: HallazgoSensibilidad;
  results: FullAnalysisResult;
  currency: Currency;
  valorUF: number;
}) {
  const d = derivarSensibilidad(hallazgo, results, currency, valorUF);
  if (!(d.arriendo > 0)) return null;
  return (
    <>
      <Dial zonas={d.zonas} marcaPct={d.marcaPct} marcaK="Declaraste" marcaV={d.arriendoStr} bordes={d.bordes} />
      {!d.v.firme && d.nuevo ? (
        <div className="compo-total">
          <span className="k">Colchón hasta el borde de abajo</span>
          <span className="v">
            {d.colchonStr}
            <small>/mes</small>
          </span>
        </div>
      ) : (
        <div className="compo-total">
          <span className="k">No hay borde dentro del rango probado</span>
          <span className="v">{d.base}</span>
        </div>
      )}
    </>
  );
}
