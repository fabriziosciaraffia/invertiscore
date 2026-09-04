"use client";

import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import { metricaValorONull } from "@/lib/types";
import { CAP_STR_UMBRAL_PCT } from "@/lib/rentabilidad-str-hallazgo";
import { ModalCalculoBase, Planilla, FilaDato, FilasDato, type FilaPlanilla } from "@/components/analysis/shared";

/**
 * "Cómo se calcula" STR (CONGELADO): la planilla detrás de las seis cifras.
 *   (a) Flujo por año — el loop del motor (T0 `projections` con desglose): ingreso ·
 *       comisión y costos · ingreso neto · cuota · estabilización · flujo neto · acumulado.
 *   (b) Indicadores — fórmula en palabras · valores sustituidos · resultado, año base.
 *   (c) Escenario de salida — valor año 10 → − saldo → − comisión → = tu parte.
 * Sin desglose (filas sin airbnbRaw) el bloque (a) dice que falta; nunca se inventa.
 */
export function ModalCalculoStr({
  abierto,
  onClose,
  results,
  valorUF,
  fechaUF,
}: {
  abierto: boolean;
  onClose: () => void;
  results: ShortTermResult;
  valorUF: number;
  fechaUF?: string;
}) {
  const clp = (n: number) => `${n < 0 ? "−" : ""}$${Math.round(Math.abs(n)).toLocaleString("es-CL")}`;
  const pct2 = (n: number) => `${n.toFixed(2).replace(".", ",")}%`;
  const pct1 = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;
  const mm = (n: number) => `${n < 0 ? "−" : ""}$${(Math.abs(n) / 1_000_000).toFixed(1).replace(".", ",")} MM`;
  // La planilla año a año va sin "$" (como la LTR): ocho columnas entran en los 720px del modal.
  const num = (n: number) => `${n < 0 ? "−" : ""}${Math.round(Math.abs(n)).toLocaleString("es-CL")}`;
  const c = (v: number) => ({ v: num(v), neg: v < 0 });

  const m = results.metrics;
  const base = results.escenarios.base;
  const exit = results.exitScenario;
  const anios = exit?.yearVenta ?? 10;
  const filas = (results.projections ?? []).slice(0, anios);
  const conDesglose = filas.length > 0 && filas.every((p) => p.ingresoAnual != null && p.cuotaAnual != null);
  const sum = (f: (p: (typeof filas)[number]) => number) => filas.reduce((a, p) => a + f(p), 0);

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
  const capital = exit?.inversionInicial ?? m?.dia1.inversionInicial ?? results.capitalInvertido;
  const coc = capital > 0 ? ((flujo * 12) / capital) * 100 : null;
  const cobertura = cuota > 0 ? ingresoNeto / cuota : null;
  const be = results.breakEvenPctDelMercado;
  const tir = m?.tirPct ?? (exit ? metricaValorONull(exit.tirAnual) : null);

  const filasFlujo: FilaPlanilla[] = filas.map((p) => ({
    th: String(p.year),
    celdas: [
      c(p.ingresoAnual ?? 0),
      c(-((p.comisionAnual ?? 0) + (p.costosAnual ?? 0))),
      c(p.ingresoNetoAnual ?? 0),
      c(-(p.cuotaAnual ?? 0)),
      (p.estabilizacionAnual ?? 0) > 0 ? c(-(p.estabilizacionAnual ?? 0)) : { v: "—" },
      c(p.flujoOperacionalAnual),
      c(p.flujoAcumulado),
    ],
  }));
  if (conDesglose) {
    filasFlujo.push({
      th: `Total ${anios} años`,
      clase: "tot",
      celdas: [
        c(sum((p) => p.ingresoAnual ?? 0)),
        c(-sum((p) => (p.comisionAnual ?? 0) + (p.costosAnual ?? 0))),
        c(sum((p) => p.ingresoNetoAnual ?? 0)),
        c(-sum((p) => p.cuotaAnual ?? 0)),
        c(-sum((p) => p.estabilizacionAnual ?? 0)),
        c(sum((p) => p.flujoOperacionalAnual)),
        { v: "" },
      ],
    });
  }

  const filasInd: FilaPlanilla[] = [
    { th: "Ingreso mensual", celdas: [{ v: "Tarifa × ocupación × 365 ÷ 12" }, { v: `${clp(tarifa)} × ${pct1(occ * 100)} × 365 ÷ 12` }, { v: clp(ingreso) }] },
    { th: "Ingreso neto mensual", celdas: [{ v: "Ingreso − comisión − costos" }, { v: `${clp(ingreso)} − ${clp(comision + admin)} − ${clp(costos)}` }, { v: clp(ingresoNeto) }] },
    { th: "Cap rate STR", celdas: [{ v: "Ingreso neto anual ÷ precio" }, { v: `${clp(ingresoNeto * 12)} ÷ ${clp(precio)}` }, { v: pct2(cap) }] },
    { th: "Flujo mensual", celdas: [{ v: "Ingreso neto − cuota" }, { v: `${clp(ingresoNeto)} − ${clp(cuota)}` }, { v: clp(flujo), neg: flujo < 0 }] },
    { th: "Retorno sobre el capital puesto", celdas: [{ v: "Flujo anual ÷ capital del día 1" }, { v: coc != null ? `${clp(flujo * 12)} ÷ ${clp(capital)}` : "sin capital propio: no aplica" }, { v: coc != null ? pct2(coc) : "—", neg: coc != null && coc < 0 }] },
    { th: "Cobertura de cuota", celdas: [{ v: "Ingreso neto ÷ cuota" }, { v: cobertura != null ? `${clp(ingresoNeto)} ÷ ${clp(cuota)}` : "sin crédito" }, { v: cobertura != null ? `${cobertura.toFixed(2).replace(".", ",")}×` : "—" }] },
    { th: "Punto de equilibrio", celdas: [{ v: "Ingreso que cubre costos y cuota ÷ ingreso estimado" }, { v: `${clp(results.breakEvenIngresoAnual)} ÷ ${clp(ingreso * 12)}` }, { v: `${Math.round(be * 100)}%` }] },
    {
      th: `TIR a ${anios} años`,
      celdas: [
        { v: "Tasa que iguala lo que pones con lo que recibes" },
        { v: exit ? `−${mm(capital)} hoy · ${mm(exit.flujoAcumuladoAlVender)} en ${anios} años · +${mm(exit.equityCLP)} el año ${anios}` : "—" },
        { v: tir != null ? pct2(tir) : "—" },
      ],
    },
  ];

  return (
    <ModalCalculoBase
      abierto={abierto}
      onClose={onClose}
      pie={
        <>
          Motor Franco · UF {Math.round(valorUF).toLocaleString("es-CL")}
          {fechaUF ? ` al ${fechaUF}` : ""} · umbral de renta corta {pct1(CAP_STR_UMBRAL_PCT)}
        </>
      }
      bloques={[
        {
          letra: "a",
          titulo: "Flujo por año",
          bajada: "Entrega inmediata: el año 1 ya opera, con la estabilización inicial descontada.",
          children: conDesglose ? (
            <>
              <Planilla columnas={["Año", "Ingreso", "Comisión y costos", "Ingreso neto", "Cuota", "Estabilización", "Flujo neto", "Acumulado"]} filas={filasFlujo} />
              <div className="v-fuente">
                Ingreso reajustado 3,5% al año · costos y cuota 3% al año · comisión de plataforma 3% del ingreso · estabilización inicial:{" "}
                {clp(results.perdidaRampUp)}, los primeros meses con menos ocupación mientras el aviso gana reseñas
              </div>
            </>
          ) : (
            <div className="v-fuente">Este análisis no trae el desglose anual (se calcula desde el motor en los análisis nuevos).</div>
          ),
        },
        {
          letra: "b",
          titulo: "Indicadores",
          bajada: "Con la tarifa y la ocupación estimadas de hoy, año base.",
          children: (
            <>
              <Planilla variante="ind" columnas={[]} filas={filasInd} />
              <div className="v-fuente">
                Capital del día 1 = pie {clp(results.pie)}
                {m ? ` + gastos de cierre ${clp(m.dia1.gastosCompraCLP)} + amoblamiento ${clp(m.dia1.amoblamientoCLP)}${m.dia1.capexCLP > 0 ? ` + puesta a punto ${clp(m.dia1.capexCLP)}` : ""}` : ""} · costos = luz, agua,
                internet, insumos, gastos comunes, mantención y contribuciones
              </div>
            </>
          ),
        },
        ...(exit
          ? [
              {
                letra: "c",
                titulo: "Escenario de salida",
                bajada: `Venta en el año ${anios}.`,
                children: (
                  <FilasDato>
                    <FilaDato k={`Valor del depto en el año ${anios}`} tip="Precio × 1,03 elevado a los años" sub="3% anual desde la compra" v={clp(exit.valorVenta)} />
                    <FilaDato k="Saldo de la deuda" tip="Lo que queda del crédito al vender" v={clp(-exit.saldoCreditoAlVender)} tono="neg" />
                    <FilaDato k="Comisión de venta" tip="Corretaje" sub="2% del valor" v={clp(-exit.gastosCierre)} tono="neg" />
                    <FilaDato k="Tu parte" tip="Valor − deuda − comisión" v={clp(exit.equityCLP)} tono="tot" />
                  </FilasDato>
                ),
              },
            ]
          : []),
      ]}
    />
  );
}
