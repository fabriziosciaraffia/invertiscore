"use client";

import { ArrowRight } from "lucide-react";
import FrancoLogo from "@/components/franco-logo";
import { PremiumResults } from "@/app/analisis/[id]/results-client";
import type { FullAnalysisResult, AnalisisInput } from "@/lib/types";
import { metricaValor } from "@/lib/types";
import { PLUSVALIA_PROYECCION_ANUAL } from "@/lib/plusvalia-proyeccion";
import { CtaAnalizar } from "@/components/CtaAnalizar";

// ─── Hardcoded demo data ────────────────────────────
const UF_CLP = 38800;
const PRECIO_UF = 3200;
const PRECIO_CLP = PRECIO_UF * UF_CLP; // 124,160,000
const PIE_PCT = 20;
const PIE_CLP = PRECIO_CLP * (PIE_PCT / 100); // 24,832,000
const SUPERFICIE = 55;
const ARRIENDO = 420000;
const GGCC = 80000;
const CONTRIBUCIONES_TRIM = 251000;
const CONTRIBUCIONES_MES = Math.round(CONTRIBUCIONES_TRIM / 3);
const DIVIDENDO = 530341;
const FLUJO_NETO = -289908;
const TASA_INTERES = 4.72;
const PLAZO = 25;

const DEMO_INPUT: AnalisisInput = {
  nombre: "Depto 2D1B Providencia",
  comuna: "Providencia",
  ciudad: "Santiago",
  direccion: "Av. Providencia 1234",
  tipo: "departamento",
  dormitorios: 2,
  banos: 1,
  superficie: SUPERFICIE,
  superficieTotal: 60,
  antiguedad: 5,
  enConstruccion: false,
  piso: 8,
  estacionamiento: "1",
  precioEstacionamiento: 0,
  bodega: false,
  estadoVenta: "inmediata",
  cuotasPie: 0,
  montoCuota: 0,
  precio: PRECIO_UF,
  piePct: PIE_PCT,
  plazoCredito: PLAZO,
  tasaInteres: TASA_INTERES,
  gastos: GGCC,
  contribuciones: CONTRIBUCIONES_TRIM,
  provisionMantencion: 0,
  tipoRenta: "larga",
  arriendo: ARRIENDO,
  arriendoEstacionamiento: 0,
  arriendoBodega: 0,
  vacanciaMeses: 1,
  usaAdministrador: false,
};

// Generate 20-year projections
function generateProjections() {
  const creditoCLP = PRECIO_CLP * (1 - PIE_PCT / 100);
  const tasaMes = TASA_INTERES / 100 / 12;
  const n = PLAZO * 12;
  // Unificado a la proyección estándar Franco (rama motor-supuestos): el demo es la
  // promesa pública y no puede proyectar con vara más optimista que el motor.
  const plusvalia = PLUSVALIA_PROYECCION_ANUAL;
  const arriendoGr = 0.035;

  const calcSaldo = (m: number) => {
    if (tasaMes === 0) return creditoCLP * (1 - m / n);
    const cuota = (creditoCLP * tasaMes) / (1 - Math.pow(1 + tasaMes, -n));
    return creditoCLP * Math.pow(1 + tasaMes, m) - cuota * ((Math.pow(1 + tasaMes, m) - 1) / tasaMes);
  };

  let arriendoAct = ARRIENDO;
  let flujoAcum = 0;
  let valorProp = PRECIO_CLP;
  const projs = [];

  for (let anio = 1; anio <= 20; anio++) {
    valorProp *= (1 + plusvalia);
    const flujoAnual = (arriendoAct - DIVIDENDO - GGCC - CONTRIBUCIONES_MES - Math.round(PRECIO_CLP * 0.005 / 12)) * 12;
    flujoAcum += flujoAnual;
    const saldo = Math.max(0, calcSaldo(anio * 12));
    projs.push({
      anio,
      arriendoMensual: Math.round(arriendoAct),
      flujoAnual: Math.round(flujoAnual),
      flujoAcumulado: Math.round(flujoAcum),
      valorPropiedad: Math.round(valorProp),
      saldoCredito: Math.round(saldo),
      patrimonioNeto: Math.round(valorProp - saldo),
    });
    arriendoAct *= (1 + arriendoGr);
  }
  return projs;
}

const projections = generateProjections();

const DEMO_RESULTS: FullAnalysisResult = {
  score: 58,
  clasificacion: "AJUSTA SUPUESTOS",
  clasificacionColor: "#888780",
  veredicto: "AJUSTA SUPUESTOS",
  resumenEjecutivo: "Inversión con flujo negativo pero plusvalía atractiva en Providencia. Score 58/100 — negociable.",
  desglose: {
    rentabilidad: 35,
    flujoCaja: 25,
    plusvalia: 78,
    eficiencia: 65,
  },
  metrics: {
    rentabilidadBruta: 4.1,
    rentabilidadNeta: 2.3,
    capRate: 2.7,
    cashOnCash: metricaValor(-14.0),
    precioM2: PRECIO_UF / SUPERFICIE, // UF/m²
    mesesPaybackPie: metricaValor(-1), // N/A (negative flow)
    dividendo: DIVIDENDO,
    flujoNetoMensual: FLUJO_NETO,
    noi: Math.round(ARRIENDO * 12 - GGCC * 12 - CONTRIBUCIONES_TRIM * 4 - PRECIO_CLP * 0.005),
    pieCLP: PIE_CLP,
    precioCLP: PRECIO_CLP,
    ingresoMensual: ARRIENDO,
    egresosMensuales: Math.abs(FLUJO_NETO) + ARRIENDO,
    provisionMantencionAjustada: Math.round(PRECIO_CLP * 0.005 / 12),
    contribuciones: CONTRIBUCIONES_TRIM,
    gastos: GGCC,
  },
  cashflowYear1: Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    ingreso: ARRIENDO,
    dividendo: DIVIDENDO,
    gastos: GGCC,
    contribuciones: CONTRIBUCIONES_MES,
    mantencion: Math.round(PRECIO_CLP * 0.005 / 12),
    vacancia: Math.round(ARRIENDO / 12),
    corretaje: Math.round(ARRIENDO * 0.5 / 12),
    administracion: 0,
    egresoTotal: DIVIDENDO + GGCC + CONTRIBUCIONES_MES + Math.round(PRECIO_CLP * 0.005 / 12),
    flujoNeto: FLUJO_NETO,
    acumulado: FLUJO_NETO * (i + 1),
  })),
  projections,
  exitScenario: (() => {
    const valorVenta = projections[9].valorPropiedad;
    const saldoCredito = projections[9].saldoCredito;
    const comisionVenta = Math.round(valorVenta * 0.02);
    const gananciaNeta = valorVenta - saldoCredito - comisionVenta;
    const flujoAcumulado = projections[9].flujoAcumulado;
    const retornoTotal = gananciaNeta + flujoAcumulado;
    const inversionInicial = PIE_CLP + Math.round(PRECIO_CLP * 0.02);
    const flujoMensualAcumuladoNegativo = projections
      .slice(0, 10)
      .filter((p) => p.flujoAnual < 0)
      .reduce((s, p) => s + Math.abs(p.flujoAnual), 0);
    const totalAportado = inversionInicial + flujoMensualAcumuladoNegativo;
    const gananciaSobreTotal = gananciaNeta - totalAportado;
    const porcentajeGananciaSobreTotal = totalAportado > 0
      ? Math.round((gananciaSobreTotal / totalAportado) * 10000) / 100
      : 0;
    const multiplicadorCapital = totalAportado > 0
      ? Math.round((retornoTotal / totalAportado) * 100) / 100
      : 0;
    return {
      anios: 10,
      valorVenta,
      sobreprecioVenta: null,
      precioVentaEsperado: valorVenta,
      saldoCredito,
      comisionVenta,
      equityCLP: gananciaNeta, // rename honesto gananciaNeta→equityCLP (campo del tipo)
      flujoAcumulado,
      retornoTotal,
      multiplicadorCapital: metricaValor(multiplicadorCapital),
      tir: metricaValor(9.6),
      inversionInicial,
      flujoMensualAcumuladoNegativo,
      totalAportado,
      gananciaSobreTotal,
      porcentajeGananciaSobreTotal,
    };
  })(),
  refinanceScenario: {
    anios: 10,
    ltv: 0.8,
    nuevoAvaluo: projections[9].valorPropiedad,
    nuevoCredito: Math.round(projections[9].valorPropiedad * 0.8),
    capitalLiberado: Math.round(projections[9].valorPropiedad * 0.8 - projections[9].saldoCredito),
    nuevoDividendo: 650000,
    dividendoActual: DIVIDENDO,
    ratioCuota: 650000 / DIVIDENDO,
    nuevoFlujoNeto: -180000,
  },
  sensitivity: [
    { variable: "Arriendo +10%", variacion: "+10%", nuevoScore: 65, nuevoFlujo: FLUJO_NETO + 42000, delta: 42000 },
    { variable: "Arriendo -10%", variacion: "-10%", nuevoScore: 50, nuevoFlujo: FLUJO_NETO - 42000, delta: -42000 },
    { variable: "Tasa +1%", variacion: "+1%", nuevoScore: 52, nuevoFlujo: FLUJO_NETO - 55000, delta: -55000 },
    { variable: "Vacancia 2 meses", variacion: "2 meses", nuevoScore: 54, nuevoFlujo: FLUJO_NETO - 35000, delta: -35000 },
  ],
  breakEvenTasa: -1, // N/A
  valorMaximoCompra: 67358800,
  resumen: "Depto 2D1B en Providencia, 55m², UF 3.200. Score 58/100. Flujo negativo de $290K/mes compensado por plusvalía de 3% anual.",
  pros: [
    "Ubicación premium en Providencia con alta demanda de arriendo",
    "Precio por m² bajo el promedio de la zona",
    "Plusvalía proyectada de 3% anual",
  ],
  contras: [
    "Flujo negativo de $290K/mes requiere aporte de tu bolsillo",
    "Cash on cash negativo (-14%)",
    "Sensible a alzas de tasa de interés",
  ],
};


export default function DemoPage() {
  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
{/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-[var(--franco-border)] bg-[var(--franco-bg)]">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <FrancoLogo size="header" href="/" inverted />
          <CtaAnalizar origen="demo"
            className="bg-[#C8323C] text-white font-body text-xs font-semibold px-4 py-2 rounded-lg hover:bg-[#C8323C]/90 transition-colors"
          >
            Analiza tu depto gratis →
          </CtaAnalizar>
        </div>
      </nav>

      {/* Demo banner */}
      <div className="bg-[var(--franco-card)] text-white border-b border-[var(--franco-border)]">
        <div className="container mx-auto max-w-6xl px-4 py-3 flex items-center justify-center gap-3 flex-wrap">
          <p className="font-body text-[13px] text-[var(--franco-text)] text-center">
            Esto es un análisis de ejemplo.
          </p>
          <CtaAnalizar origen="demo"
            className="inline-flex items-center gap-1.5 font-body text-[13px] font-bold text-[#C8323C] hover:text-[#C8323C]/80 transition-colors"
          >
            Analiza tu propio departamento gratis <ArrowRight className="h-3.5 w-3.5" />
          </CtaAnalizar>
        </div>
      </div>

      {/* Results */}
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <PremiumResults
          results={DEMO_RESULTS}
          accessLevel="premium"
          inputData={DEMO_INPUT}
          comuna="Providencia"
          score={58}
          freeYieldBruto={4.1}
          freeFlujo={FLUJO_NETO}
          freePrecioM2={PRECIO_UF / SUPERFICIE}
          resumenEjecutivo={DEMO_RESULTS.resumenEjecutivo}
          ufValue={UF_CLP}
          nombre="Depto 2D1B Providencia"
          ciudad="Santiago"
          createdAt="2026-03-18T12:00:00Z"
          superficie={SUPERFICIE}
          precioUF={PRECIO_UF}
        />
      </div>

      {/* Bottom CTA */}
      <div className="bg-[var(--franco-bg)] py-12 text-center">
        <p className="font-heading font-bold text-xl text-white mb-2">¿Tienes un depto en la mira?</p>
        <p className="font-body text-sm text-[var(--franco-text-secondary)] mb-6">Resultado en 30 segundos. Registro gratis.</p>
        <CtaAnalizar origen="demo"
          className="inline-block bg-[#C8323C] text-white font-body text-[15px] font-bold px-8 py-3.5 rounded-lg shadow-[0_4px_20px_rgba(200,50,60,0.3)] hover:shadow-[0_4px_24px_rgba(200,50,60,0.4)] transition-shadow"
        >
          Analizar mi departamento →
        </CtaAnalizar>
      </div>
    </div>
  );
}
