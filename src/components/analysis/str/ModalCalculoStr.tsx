"use client";

import { GlosaIndicador } from "@/components/analysis/shared/Glosa";
import { GLOSA_COBERTURA_STR } from "@/lib/glosas-indicadores";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import { metricaValorONull } from "@/lib/types";
import { referenciaCapRateStr } from "@/lib/rentabilidad-str-hallazgo";
import { ModalCalculoBase } from "@/components/analysis/shared";
import { Indicador, RemiteResultado, TablaFlujo, type FilaFlujo } from "@/components/analysis/shared/PlanillaCalculo";
import { useEsHoja } from "@/components/analysis/hallazgos/vocabulario";
import { bajadaFlujoStr, fuenteFlujoStr, montoCorto, montoCuenta, type Moneda } from "@/lib/planilla-calculo";

/**
 * «CÓMO SE CALCULA» STR — mockup aprobado el 23-sep-2026
 * (`docs/wireframes/rediseno-informe/planilla-como-se-calcula.html`).
 *   · Flujo por año: año · entra · gastos · cuota · flujo neto, desde el loop del motor.
 *     «Gastos» junta la comisión o el administrador, los costos, la estabilización y el
 *     amoblamiento del año de la entrega. La entrega y la comisión se leen del dato: antes
 *     decía «Entrega inmediata» y «comisión de plataforma 3%» en todas las filas.
 *   · Indicadores: fórmula, cuenta y, debajo, el resultado. El cash on cash divide por
 *     `capitalInvertido`, el mismo denominador con que el motor calcula `cashOnCash`.
 * La venta queda en una fila que remite a «Tu resultado». El pie cita la referencia de la
 * zona (`referenciaCapRateStr`), la misma del hero y del capítulo I, no la constante.
 * Sin desglose (filas sin airbnbRaw) la tabla dice que falta; nunca se inventa.
 */
export function ModalCalculoStr({
  abierto,
  onClose,
  results,
  inputData,
  valorUF,
  fechaUF,
  currency,
  onVerResultado,
}: {
  abierto: boolean;
  onClose: () => void;
  results: ShortTermResult;
  inputData: Record<string, unknown> | null;
  valorUF: number;
  fechaUF?: string;
  currency: Moneda;
  /** Cierra la planilla y abre «Tu resultado a N años». */
  onVerResultado?: () => void;
}) {
  const compacto = useEsHoja();
  const P = (n: number) => montoCuenta(n, currency, valorUF);
  const pct2 = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(n).toFixed(2).replace(".", ",")}%`;
  const pct1 = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(n).toFixed(1).replace(".", ",")}%`;

  const m = results.metrics;
  const base = results.escenarios.base;
  const exit = results.exitScenario;
  const anios = exit?.yearVenta ?? 10;
  const proy = (results.projections ?? []).slice(0, anios);
  const conDesglose = proy.length > 0 && proy.every((p) => p.ingresoAnual != null && p.cuotaAnual != null);

  const fechaEntrega = typeof inputData?.fechaEntrega === "string" ? inputData.fechaEntrega : null;
  const primerOp = proy.find((p) => (p.mesesOperativos ?? 12) > 0);
  const mesesPrimerOp = primerOp?.mesesOperativos ?? 12;
  const entregaParcial = !!primerOp && mesesPrimerOp < 12;
  const amobTabla = proy.reduce((a, p) => a + (p.amoblamientoAnual ?? 0), 0);

  const filas: FilaFlujo[] = proy.map((p) => ({
    anio: p.year,
    mesesEntrega: entregaParcial && p === primerOp ? mesesPrimerOp : null,
    entra: p.ingresoAnual ?? 0,
    gastos: (p.comisionAnual ?? 0) + (p.costosAnual ?? 0) + (p.estabilizacionAnual ?? 0) + (p.amoblamientoAnual ?? 0),
    cuota: p.cuotaAnual ?? 0,
    flujo: p.flujoOperacionalAnual,
  }));

  const conAdmin = inputData?.modoGestion === "administrador";
  const comisionAdminPct = conAdmin ? Math.round((Number(inputData?.comisionAdministrador) || 0) * 1000) / 10 : null;

  // Indicadores, año base.
  const ingreso = m?.ingresoEstabilizadoMensual ?? base.ingresoBrutoMensual;
  const comision = m?.desgloseFall.comisionPlataforma ?? base.comisionMensual;
  const admin = m?.desgloseFall.administrador ?? 0;
  const costos = m ? m.desgloseFall.costosDirectos + m.desgloseFall.gastosComunesMantencion + m.desgloseFall.contribucionesMensuales : base.costosOperativos;
  const ingresoNeto = ingreso - comision - admin - costos;
  const cuota = m?.desgloseFall.cuota ?? results.dividendoMensual;
  const flujo = m?.flujoMensual ?? base.flujoCajaMensual;
  const precio = results.pie + results.montoCredito;
  const cap = m?.capRatePct ?? base.capRate * 100;
  const tarifa = m?.tarifaNoche ?? base.adrReferencia;
  const occ = m?.ocupacion ?? base.ocupacionReferencia;
  // El cash on cash, con el denominador y el flujo con que lo calcula el motor.
  const coc = metricaValorONull(base.cashOnCash);
  const capitalCoc = results.capitalInvertido;
  const cobertura = cuota > 0 ? ingresoNeto / cuota : null;
  const be = results.breakEvenPctDelMercado;
  const tir = m?.tirPct ?? (exit ? metricaValorONull(exit.tirAnual) : null);
  const inversionTir = exit?.inversionInicial ?? m?.dia1.inversionInicial ?? results.capitalInvertido;
  const ref = referenciaCapRateStr(results.hallazgos);

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
          Motor Franco · UF {Math.round(valorUF).toLocaleString("es-CL")}
          {fechaUF ? ` al ${fechaUF}` : ""} · proyección a {anios} años · {ref.hayRef ? `referencia de la zona ${pct1(ref.pct)}` : "sin referencia de la zona"}
        </>
      }
      bloques={[
        {
          titulo: "Flujo por año",
          bajada: bajadaFlujoStr({ primerAnioOperativo: primerOp?.year ?? 1, mesesPrimerAnio: mesesPrimerOp, fechaEntrega }),
          children: conDesglose ? (
            <>
              <TablaFlujo filas={filas} moneda={currency} valorUF={valorUF} compacto={compacto} />
              <p className="pc-fuente">
                {fuenteFlujoStr({ comisionAdministradorPct: comisionAdminPct, estabilizacion: P(results.perdidaRampUp), amoblamiento: amobTabla > 0 ? P(amobTabla) : null })}
              </p>
            </>
          ) : (
            <p className="pc-fuente">Este análisis no trae el desglose anual (se calcula desde el motor en los análisis nuevos).</p>
          ),
        },
        {
          titulo: "Indicadores",
          bajada: "Con la tarifa y la ocupación estimadas de hoy, año base.",
          children: (
            <>
              <Indicador nombre="Ingreso mensual" formula="Tarifa por noche × ocupación × 365 ÷ 12" cuenta={`${P(tarifa)} × ${pct1(occ * 100)} × 365 ÷ 12`} resultado={P(ingreso)} />
              <Indicador
                nombre="Ingreso neto mensual"
                formula={`Ingreso − ${admin > 0 ? "administrador" : "comisión"} − costos`}
                cuenta={`${P(ingreso)} − ${P(comision + admin)} − ${P(costos)}`}
                resultado={P(ingresoNeto)}
              />
              <Indicador nombre={<>Cap rate<GlosaIndicador glosa="capRateStr" /></>} formula="Ingreso neto anual ÷ precio" cuenta={`${P(ingresoNeto * 12)} ÷ ${P(precio)}`} resultado={pct2(cap)} />
              <Indicador nombre="Flujo mensual" formula="Ingreso neto − cuota" cuenta={`${P(ingresoNeto)} − ${P(cuota)}`} resultado={P(flujo)} neg={flujo < 0} />
              <Indicador
                nombre={<>Cash on cash<GlosaIndicador glosa="cashOnCash" /></>}
                formula="Flujo anual ÷ lo que pusiste el día 1"
                cuenta={coc != null && capitalCoc > 0 ? `${P(base.flujoCajaMensual * 12)} ÷ ${P(capitalCoc)}` : "sin capital propio: no aplica"}
                resultado={coc != null ? pct2(coc * 100) : "—"}
                neg={coc != null && coc < 0}
              />
              <Indicador
                nombre={<>Cobertura de cuota<GlosaIndicador glosa={GLOSA_COBERTURA_STR} /></>}
                formula="Ingreso neto ÷ cuota"
                cuenta={cobertura != null ? `${P(ingresoNeto)} ÷ ${P(cuota)}` : "sin crédito"}
                resultado={cobertura != null ? `${cobertura.toFixed(2).replace(".", ",")}×` : "—"}
              />
              <Indicador
                nombre={<>Punto de equilibrio<GlosaIndicador glosa="equilibrio" /></>}
                formula="Ingreso que cubre costos y cuota ÷ ingreso estimado"
                cuenta={`${P(results.breakEvenIngresoAnual)} ÷ ${P(ingreso * 12)}`}
                resultado={`${Math.round(be * 100)}%`}
              />
              <Indicador
                nombre={<>TIR a {anios} años<GlosaIndicador glosa="tir" /></>}
                formula="La tasa que iguala lo que pones hoy con el flujo de cada año y lo que te queda al vender"
                cuenta={cuentaTir}
                resultado={tir != null ? pct2(tir) : "—"}
              />
              <p className="pc-fuente">
                {m ? (
                  <>
                    Lo que pusiste el día 1 = pie {P(m.dia1.pieCLP)} + gastos de compra {P(m.dia1.gastosCompraCLP)}
                    {m.dia1.amoblamientoCLP > 0 ? ` + amoblamiento ${P(m.dia1.amoblamientoCLP)}` : ""}
                    {m.dia1.capexCLP > 0 ? ` + puesta a punto ${P(m.dia1.capexCLP)}` : ""}
                    {entregaParcial && amobTabla > 0 ? ". El amoblamiento no va el día 1: con entrega futura se compra al recibir el depto y está en la tabla" : ""}
                    {" · "}
                  </>
                ) : null}
                costos = luz, agua, internet, insumos, gastos comunes, mantención y contribuciones
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
