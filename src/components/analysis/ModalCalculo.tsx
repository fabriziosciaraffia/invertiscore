"use client";

import { GlosaIndicador } from "./shared/Glosa";
import type { AnalisisInput, AnalysisMetrics, FullAnalysisResult } from "@/lib/types";
import { metricaValorONull } from "@/lib/types";
import { ModalCalculoBase } from "./shared/ModalCalculoBase";
import { Indicador, RemiteResultado, TablaFlujo, type FilaFlujo } from "./shared/PlanillaCalculo";
import { useEsHoja } from "./hallazgos/vocabulario";
import { bajadaFlujoLtr, fuenteFlujoLtr, montoCorto, montoCuenta, type Moneda } from "@/lib/planilla-calculo";

/**
 * «CÓMO SE CALCULA» LTR — mockup aprobado el 23-sep-2026
 * (`docs/wireframes/rediseno-informe/planilla-como-se-calcula.html`).
 *
 * La planilla detrás de cada cifra, para rehacer la cuenta. Dos bloques, deterministas
 * desde `projections` y `metrics`:
 *   · Flujo por año: año · entra · gastos · cuota · flujo neto. «Gastos» junta todo lo que
 *     no es cuota (gastos operativos, vacancia, corretaje y recambio). Pesos exactos en
 *     escritorio; millones en teléfono, con el redondeo avisado.
 *   · Indicadores: fórmula en palabras, cuenta y, debajo, el resultado. El cash on cash
 *     divide por `metrics.capitalCashOnCash`, el denominador del motor: antes dividía por
 *     `exitScenario.inversionInicial` (que suma el corretaje) y la cuenta no daba el
 *     resultado en 403 de 1.214 filas.
 * La venta al año N ya no se desglosa acá: queda una fila con lo que te queda al vender y el
 * enlace a «Tu resultado», donde vive el desglose. La moneda sigue el toggle del informe, y
 * la vacancia, la administración y la entrega se leen del dato.
 * Si las filas vienen sin desglose (results legacy), la tabla no se dibuja: se dice que
 * falta, nunca se inventa.
 */
export function ModalCalculo({
  abierto,
  onClose,
  metrics,
  results,
  inputData,
  valorUF,
  currency,
  onVerResultado,
}: {
  abierto: boolean;
  onClose: () => void;
  metrics: AnalysisMetrics;
  results: FullAnalysisResult;
  inputData: AnalisisInput | null | undefined;
  valorUF: number;
  currency: Moneda;
  /** Cierra la planilla y abre «Tu resultado a N años». */
  onVerResultado?: () => void;
}) {
  const compacto = useEsHoja();
  const P = (n: number) => montoCuenta(n, currency, valorUF);
  const pct2 = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(n).toFixed(2).replace(".", ",")}%`;

  const exit = results.exitScenario;
  const anios = exit?.anios ?? 10;
  const proy = (results.projections ?? []).slice(0, anios);
  const conDesglose = proy.length > 0 && proy.every((p) => p.noiAnual != null && p.dividendoAnual != null);
  const preEntregaAnios = metrics.preEntrega?.aniosEspera ?? 0;

  const filas: FilaFlujo[] = proy.map((p) => {
    const meses = p.mesesOperativos ?? 12;
    return {
      anio: p.anio,
      mesesEntrega: preEntregaAnios > 0 && meses > 0 && meses < 12 ? meses : null,
      entra: p.arriendoAnual ?? 0,
      gastos: (p.gastosOperativosAnual ?? 0) + (p.vacanciaRotacionAnual ?? 0),
      cuota: p.dividendoAnual ?? 0,
      flujo: p.flujoAnual,
    };
  });

  // Indicadores, año base.
  const arriendoAnual = metrics.ingresoMensual * 12;
  // Los gastos del cap rate neto: todo lo que no es cuota —los mismos de la columna «gastos»—,
  // en pesos exactos (egresos del mes − dividendo, × 12). Así la cuenta da `rentabilidadNeta`.
  const gastosNetosAnual = (metrics.egresosMensuales - metrics.dividendo) * 12;
  const precio = metrics.precioCLP;
  const coc = metricaValorONull(metrics.cashOnCash);
  const capCoc = metrics.capitalCashOnCash;
  const flujoAnual0 = metrics.flujoNetoMensual * 12;
  const tir = metricaValorONull(exit?.tir);
  const cobertura = metrics.dividendo > 0 ? metrics.ingresoMensual / metrics.dividendo : null;
  const inversionTir = exit?.inversionInicial ?? 0;
  const corretaje = metrics.corretajeInicialCLP ?? 0;

  const cuentaTir = !exit
    ? "—"
    : compacto
      ? [`−${montoCorto(inversionTir, currency, valorUF)} hoy`, `los ${anios} flujos de la tabla`, `+${montoCorto(exit.equityCLP, currency, valorUF)} al vender el año ${anios}`]
      : `−${P(inversionTir)} hoy · los ${anios} flujos de la tabla · +${P(exit.equityCLP)} al vender el año ${anios}`;

  return (
    <ModalCalculoBase
      abierto={abierto}
      onClose={onClose}
      pie={
        <>
          Motor Franco · UF {Math.round(valorUF).toLocaleString("es-CL")} · proyección a {anios} años
        </>
      }
      bloques={[
        {
          titulo: "Flujo por año",
          bajada: bajadaFlujoLtr({ aniosSinArriendo: preEntregaAnios, fechaEntrega: inputData?.fechaEntrega }),
          children: conDesglose ? (
            <>
              <TablaFlujo filas={filas} moneda={currency} valorUF={valorUF} compacto={compacto} />
              <p className="pc-fuente">
                {fuenteFlujoLtr({
                  vacanciaMeses: inputData?.vacanciaMeses ?? 0,
                  usaAdministrador: inputData?.usaAdministrador,
                  comisionAdministradorPct: inputData?.comisionAdministrador ?? 7,
                })}
              </p>
            </>
          ) : (
            <p className="pc-fuente">Este análisis no trae el desglose anual (se calcula desde el motor en los análisis nuevos).</p>
          ),
        },
        {
          titulo: "Indicadores",
          bajada: "Con el arriendo y los gastos de hoy, año base.",
          children: (
            <>
              <Indicador
                nombre={<>Cap rate bruto<GlosaIndicador glosa="capRateBruto" /></>}
                formula="Arriendo anual ÷ precio"
                cuenta={`${P(arriendoAnual)} ÷ ${P(precio)}`}
                resultado={pct2(metrics.rentabilidadBruta)}
              />
              <Indicador
                nombre={<>Cap rate neto<GlosaIndicador glosa="capRateNeto" /></>}
                formula="Ingreso neto anual ÷ precio"
                cuenta={`(${P(arriendoAnual)} − ${P(gastosNetosAnual)}) ÷ ${P(precio)}`}
                resultado={pct2(metrics.rentabilidadNeta)}
              />
              <Indicador
                nombre={<>Cash on cash<GlosaIndicador glosa="cashOnCash" /></>}
                formula="Flujo anual ÷ lo que pusiste el día 1 (pie + gastos de compra + puesta a punto)"
                cuenta={coc == null ? "sin pie: no aplica" : capCoc ? `${P(flujoAnual0)} ÷ ${P(capCoc.totalCLP)}` : "—"}
                resultado={coc != null ? pct2(coc) : "—"}
                neg={coc != null && coc < 0}
              />
              <Indicador
                nombre={<>Cobertura de cuota<GlosaIndicador glosa="cobertura" /></>}
                formula="Arriendo mensual ÷ cuota"
                cuenta={cobertura != null ? `${P(metrics.ingresoMensual)} ÷ ${P(metrics.dividendo)}` : "sin crédito"}
                resultado={cobertura != null ? `${cobertura.toFixed(2).replace(".", ",")}×` : "—"}
              />
              <Indicador
                nombre={<>TIR a {anios} años<GlosaIndicador glosa="tir" /></>}
                formula="La tasa que iguala lo que pones hoy con el flujo de cada año y lo que te queda al vender"
                cuenta={cuentaTir}
                resultado={tir != null ? pct2(tir) : "—"}
              />
              <p className="pc-fuente">
                <b>Ingreso neto</b> = arriendo − los gastos de la tabla: gastos comunes en vacancia, contribuciones, mantención, vacancia, corretaje y recambio
                {inputData?.usaAdministrador ? ", administración" : ""}.
                {capCoc && (
                  <>
                    {" "}Lo que pusiste el día 1 = pie {P(capCoc.pieCLP)} + gastos de compra {P(capCoc.gastosCompraCLP)}
                    {capCoc.capexCLP > 0 ? ` + puesta a punto ${P(capCoc.capexCLP)}` : ""}.
                  </>
                )}
                {corretaje > 0 && exit ? ` El corretaje de compra (${P(corretaje)}) no entra acá; en la TIR sí: hoy pones ${P(inversionTir)}.` : ""}
              </p>
              {exit && (
                <RemiteResultado anios={anios} equity={exit.equityCLP} conSobreprecio={!!exit.sobreprecioVenta} moneda={currency} valorUF={valorUF} onVerResultado={onVerResultado} />
              )}
            </>
          ),
        },
      ]}
    />
  );
}
