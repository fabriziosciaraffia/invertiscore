"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import FrancoLogo from "@/components/franco-logo";
import { PremiumResults } from "@/app/analisis/[id]/results-client";
import type { FullAnalysisResult, AnalisisInput, AIAnalysis } from "@/lib/types";

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
  vacanciaMeses: 1,
  usaAdministrador: false,
};

// Generate 20-year projections
function generateProjections() {
  const creditoCLP = PRECIO_CLP * (1 - PIE_PCT / 100);
  const tasaMes = TASA_INTERES / 100 / 12;
  const n = PLAZO * 12;
  const plusvalia = 0.04;
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
  clasificacion: "NEGOCIAR",
  clasificacionColor: "#FBBF24",
  resumenEjecutivo: "Inversión con flujo negativo pero plusvalía atractiva en Providencia. Score 58/100 — negociable.",
  desglose: {
    rentabilidad: 35,
    flujoCaja: 25,
    plusvalia: 78,
    riesgo: 72,
    eficiencia: 65,
  },
  metrics: {
    rentabilidadBruta: 4.1,
    rentabilidadNeta: 2.3,
    capRate: 2.7,
    cashOnCash: -14.0,
    precioM2: PRECIO_UF / SUPERFICIE, // UF/m²
    mesesPaybackPie: -1, // N/A (negative flow)
    dividendo: DIVIDENDO,
    flujoNetoMensual: FLUJO_NETO,
    noi: Math.round(ARRIENDO * 12 - GGCC * 12 - CONTRIBUCIONES_TRIM * 4 - PRECIO_CLP * 0.005),
    pieCLP: PIE_CLP,
    precioCLP: PRECIO_CLP,
    ingresoMensual: ARRIENDO,
    egresosMensuales: Math.abs(FLUJO_NETO) + ARRIENDO,
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
  exitScenario: {
    anios: 10,
    valorVenta: projections[9].valorPropiedad,
    saldoCredito: projections[9].saldoCredito,
    comisionVenta: Math.round(projections[9].valorPropiedad * 0.02),
    gananciaNeta: projections[9].valorPropiedad - projections[9].saldoCredito - Math.round(projections[9].valorPropiedad * 0.02),
    flujoAcumulado: projections[9].flujoAcumulado,
    retornoTotal: projections[9].valorPropiedad - projections[9].saldoCredito - Math.round(projections[9].valorPropiedad * 0.02) + projections[9].flujoAcumulado,
    multiplicadorCapital: 3.21,
    tir: 9.6,
  },
  refinanceScenario: {
    nuevoAvaluo: projections[9].valorPropiedad,
    nuevoCredito: Math.round(projections[9].valorPropiedad * 0.8),
    capitalLiberado: Math.round(projections[9].valorPropiedad * 0.8 - projections[9].saldoCredito),
    nuevoDividendo: 650000,
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
  resumen: "Depto 2D1B en Providencia, 55m², UF 3.200. Score 58/100. Flujo negativo de $290K/mes compensado por plusvalía de 4% anual.",
  pros: [
    "Ubicación premium en Providencia con alta demanda de arriendo",
    "Precio por m² bajo el promedio de la zona",
    "Plusvalía proyectada de 4% anual",
  ],
  contras: [
    "Flujo negativo de $290K/mes requiere aporte de tu bolsillo",
    "Cash on cash negativo (-14%)",
    "Sensible a alzas de tasa de interés",
  ],
};

// ─── Hardcoded AI Analysis (typewriter animated) ────
const DEMO_AI: AIAnalysis = {
  resumenEjecutivo_clp: "Este departamento en Providencia presenta un escenario típico de inversión con flujo negativo. Con un arriendo de $420.000 y un dividendo de $530.341, el déficit mensual es de $289.908. Sin embargo, la plusvalía proyectada de 4% anual en Providencia compensa significativamente.",
  resumenEjecutivo_uf: "Este departamento en Providencia presenta un escenario típico de inversión con flujo negativo. Con un arriendo de UF 10,8 y un dividendo de UF 13,7, el déficit mensual es de UF 7,5. Sin embargo, la plusvalía proyectada de 4% anual en Providencia compensa significativamente.",
  tuBolsillo: {
    titulo: "Tu bolsillo mes a mes",
    contenido_clp: "Cada mes necesitas poner $289.908 de tu bolsillo. En un año, eso suma $3.478.896. Con un pie de $24.832.000, recuperas tu inversión vía plusvalía en aproximadamente 7 años — pero el flujo nunca llega a ser positivo con las condiciones actuales.",
    contenido_uf: "Cada mes necesitas poner UF 7,5 de tu bolsillo. En un año, eso suma UF 89,6. Con un pie de UF 640, recuperas tu inversión vía plusvalía en aproximadamente 7 años — pero el flujo nunca llega a ser positivo con las condiciones actuales.",
    alerta_clp: "El flujo negativo de $289.908/mes es manejable para un sueldo sobre $2M, pero ajustado si tienes otros compromisos financieros.",
    alerta_uf: "El flujo negativo de UF 7,5/mes es manejable para un sueldo sobre UF 51,5, pero ajustado si tienes otros compromisos financieros.",
  },
  vsAlternativas: {
    titulo: "¿Es mejor que un depósito a plazo?",
    contenido_clp: "Si pones los $24.832.000 del pie en un depósito a plazo al 5% anual, ganas $1.241.600/año sin riesgo. Este departamento requiere aporte mensual pero genera plusvalía: en 10 años tu patrimonio neto crece 3.21x. La diferencia es apalancamiento — usas plata del banco para multiplicar tu capital.",
    contenido_uf: "Si pones las UF 640 del pie en un depósito a plazo al 5% anual, ganas UF 32/año sin riesgo. Este departamento requiere aporte mensual pero genera plusvalía: en 10 años tu patrimonio neto crece 3.21x. La diferencia es apalancamiento — usas plata del banco para multiplicar tu capital.",
  },
  negociacion: {
    titulo: "Margen de negociación",
    contenido_clp: "El precio de compra (UF 3.200 = $2.258.168/m²) está por debajo del promedio de la zona ($2.438.400/m²). Si logras bajar el precio a UF 2.900 (-9%), el flujo mejora a -$220.000/mes y la TIR sube a 11,2%. Un descuento del 5% (UF 3.040) ya mejora el flujo en $50.000/mes.",
    contenido_uf: "El precio de compra (UF 3.200 = UF 58,2/m²) está por debajo del promedio de la zona (UF 62,8/m²). Si logras bajar el precio a UF 2.900 (-9%), el flujo mejora a UF -5,7/mes y la TIR sube a 11,2%. Un descuento del 5% (UF 3.040) ya mejora el flujo en UF 1,3/mes.",
    precioSugerido: "UF 2.900 – UF 3.040",
  },
  proyeccion: {
    titulo: "Proyección a 10 años",
    contenido_clp: "En 10 años, tu patrimonio se multiplica 3.21x, pasando de una inversión inicial de $24.832.000 (pie 20%) a un patrimonio neto de aproximadamente $79.712.000. La plusvalía acumulada de 4% anual transforma una propiedad de $124.160.000 en una de $183.780.000.",
    contenido_uf: "En 10 años, tu patrimonio se multiplica 3.21x, pasando de una inversión inicial de UF 640 (pie 20%) a un patrimonio neto de aproximadamente UF 2.055. La plusvalía acumulada de 4% anual transforma una propiedad de UF 3.200 en una de UF 4.738.",
  },
  riesgos: {
    titulo: "Riesgos a considerar",
    items_clp: [
      "Si la tasa sube a 6,2% (+1,5%), el dividendo sube a $585.000 y el flujo negativo crece a $345.000/mes",
      "Una vacancia de 2 meses al año agrega $35.000/mes al déficit",
      "Providencia tiene baja vacancia histórica (3-4%), pero una recesión podría elevarla temporalmente",
    ],
    items_uf: [
      "Si la tasa sube a 6,2% (+1,5%), el dividendo sube a UF 15,1 y el flujo negativo crece a UF 8,9/mes",
      "Una vacancia de 2 meses al año agrega UF 0,9/mes al déficit",
      "Providencia tiene baja vacancia histórica (3-4%), pero una recesión podría elevarla temporalmente",
    ],
  },
  veredicto: {
    titulo: "NEGOCIAR el precio",
    decision: "NEGOCIAR" as const,
    explicacion_clp: "El departamento tiene fundamentos sólidos: buena ubicación, precio bajo el promedio de la zona y plusvalía proyectada atractiva. El flujo negativo de $290K/mes es el punto débil. Recomendación: negocia el precio a UF 2.900-3.040 o busca un arriendo de $480.000 (+14%) para mejorar la ecuación.",
    explicacion_uf: "El departamento tiene fundamentos sólidos: buena ubicación, precio bajo el promedio de la zona y plusvalía proyectada atractiva. El flujo negativo de UF 7,5/mes es el punto débil. Recomendación: negocia el precio a UF 2.900-3.040 o busca un arriendo de UF 12,4 (+14%) para mejorar la ecuación.",
  },
  aFavor: [
    "Ubicación premium con alta demanda y baja vacancia",
    "Precio por m² bajo el promedio de la zona (-7%)",
    "Patrimonio se multiplica 3.21x en 10 años",
    "Plusvalía proyectada de 4% anual en Providencia",
  ],
  puntosAtencion: [
    "Flujo negativo de $290K/mes requiere capacidad de ahorro",
    "Cash on cash negativo: la propiedad no se paga sola",
    "Sensible a alzas de tasa de interés (+1,5% = +$55K/mes)",
  ],
};

// ─── Zone comparison data ────────────────────────────
const DEMO_ZONE_DATA = [
  {
    comuna: "Providencia",
    tipo: "2D",
    arriendo_promedio: 430000,
    precio_m2_promedio: 10.2,
    precio_m2_venta_promedio: 62.8,
    gastos_comunes_m2: 1450,
    numero_publicaciones: 342,
    fecha_actualizacion: "2026-03-15",
  },
];

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-[#0F0F0F]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#0F0F0F]">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <FrancoLogo size="header" href="/" inverted />
          <Link
            href="/register"
            className="bg-[#C8323C] text-white font-body text-xs font-semibold px-4 py-2 rounded-lg hover:bg-[#C8323C]/90 transition-colors"
          >
            Analiza tu depto gratis →
          </Link>
        </div>
      </nav>

      {/* Demo banner */}
      <div className="bg-[#151515] text-white border-b border-white/[0.08]">
        <div className="container mx-auto max-w-6xl px-4 py-3 flex items-center justify-center gap-3 flex-wrap">
          <p className="font-body text-[13px] text-white/80 text-center">
            Esto es un análisis de ejemplo.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 font-body text-[13px] font-bold text-[#C8323C] hover:text-[#C8323C]/80 transition-colors"
          >
            Analiza tu propio departamento gratis <ArrowRight className="h-3.5 w-3.5" />
          </Link>
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
          zoneData={DEMO_ZONE_DATA}
          demoAiData={DEMO_AI}
          nombre="Depto 2D1B Providencia"
          ciudad="Santiago"
          createdAt="2026-03-18T12:00:00Z"
          superficie={SUPERFICIE}
          precioUF={PRECIO_UF}
          hidePanel
        />
      </div>

      {/* Bottom CTA */}
      <div className="bg-[#0F0F0F] py-12 text-center">
        <p className="font-heading font-bold text-xl text-white mb-2">¿Tienes un depto en la mira?</p>
        <p className="font-body text-sm text-white/50 mb-6">Resultado en 30 segundos. Registro gratis.</p>
        <Link
          href="/register"
          className="inline-block bg-[#C8323C] text-white font-body text-[15px] font-bold px-8 py-3.5 rounded-lg shadow-[0_4px_20px_rgba(200,50,60,0.3)] hover:shadow-[0_4px_24px_rgba(200,50,60,0.4)] transition-shadow"
        >
          Analizar mi departamento →
        </Link>
      </div>
    </div>
  );
}
