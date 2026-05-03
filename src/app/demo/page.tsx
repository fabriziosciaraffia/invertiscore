"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import FrancoLogo from "@/components/franco-logo";
import { PremiumResults } from "@/app/analisis/[id]/results-client";
import type { FullAnalysisResult, AnalisisInput, AIAnalysisV2 } from "@/lib/types";

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
  clasificacion: "AJUSTA EL PRECIO",
  clasificacionColor: "#FBBF24",
  veredicto: "AJUSTA EL PRECIO",
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
      saldoCredito,
      comisionVenta,
      gananciaNeta,
      flujoAcumulado,
      retornoTotal,
      multiplicadorCapital,
      tir: 9.6,
      inversionInicial,
      flujoMensualAcumuladoNegativo,
      totalAportado,
      gananciaSobreTotal,
      porcentajeGananciaSobreTotal,
    };
  })(),
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

// ─── Hardcoded AI Analysis (v2 structure) ────────────
const DEMO_AI: AIAnalysisV2 = {
  siendoFrancoHeadline_clp: "A UF 3.200 el depto no se paga solo. Bajando a UF 2.900 los números empiezan a cerrar y la plusvalía de Providencia acompaña.",
  siendoFrancoHeadline_uf: "A UF 3.200 el depto no se paga solo. Bajando a UF 2.900 los números empiezan a cerrar y la plusvalía de Providencia acompaña.",
  conviene: {
    pregunta: "¿Conviene o no conviene?",
    respuestaDirecta_clp: "Hoy no conviene al precio de lista. A UF 3.200 tendrías que poner $289.908 de tu bolsillo cada mes durante 25 años para sostener la inversión. Pero la zona es buena y hay margen para negociar: a UF 2.900 el flujo mejora significativamente y la inversión empieza a tener sentido.",
    respuestaDirecta_uf: "Hoy no conviene al precio de lista. A UF 3.200 tendrías que poner UF 7,5 de tu bolsillo cada mes durante 25 años para sostener la inversión. Pero la zona es buena y hay margen para negociar: a UF 2.900 el flujo mejora significativamente y la inversión empieza a tener sentido.",
    veredictoFrase_clp: "Los números piden una negociación antes de firmar.",
    veredictoFrase_uf: "Los números piden una negociación antes de firmar.",
    datosClave: [
      {
        label: "Aporte mensual",
        valor_clp: "$289.908",
        valor_uf: "UF 7,5",
        subtexto: "de tu bolsillo",
        color: "red",
      },
      {
        label: "Precio sugerido",
        valor_clp: "UF 2.900",
        valor_uf: "UF 2.900",
        subtexto: "-9% negociable",
        color: "accent",
      },
      {
        label: "Retorno 10 años",
        valor_clp: "3,21x",
        valor_uf: "3,21x",
        subtexto: "sobre el pie",
        color: "green",
      },
    ],
    reencuadre_clp: "Con este precio y financiamiento, estás pagando principalmente por la plusvalía de Providencia — no por flujo. Si esa apuesta te calza, el margen de negociación es la palanca. Si no te calza, conviene buscar algo donde el arriendo cubra más del costo mensual.",
    reencuadre_uf: "Con este precio y financiamiento, estás pagando principalmente por la plusvalía de Providencia — no por flujo. Si esa apuesta te calza, el margen de negociación es la palanca. Si no te calza, conviene buscar algo donde el arriendo cubra más del costo mensual.",
    cajaAccionable_clp: "¿Puedes sostener $289.908/mes durante 10+ años sin que afecte tu estabilidad? Y si el vendedor no baja a UF 2.900, ¿qué precio máximo estás dispuesto a pagar?",
    cajaAccionable_uf: "¿Puedes sostener UF 7,5/mes durante 10+ años sin que afecte tu estabilidad? Y si el vendedor no baja a UF 2.900, ¿qué precio máximo estás dispuesto a pagar?",
    cajaLabel: "Antes de seguir, decide:",
  },
  costoMensual: {
    pregunta: "¿Qué te cuesta mes a mes?",
    contenido_clp: "Entra $420.000 de arriendo. Sale $530.341 de dividendo + $80.000 de gastos comunes + $83.667 de contribuciones + mantención. Total salida: $709.908. Flujo neto: -$289.908 cada mes.",
    contenido_uf: "Entra UF 10,8 de arriendo. Sale UF 13,7 de dividendo + UF 2,1 de gastos comunes + UF 2,2 de contribuciones + mantención. Total salida: UF 18,3. Flujo neto: -UF 7,5 cada mes.",
    cajaAccionable_clp: "Regla del 25%: si el aporte no supera el 25% de tu ingreso líquido, es sostenible. $289.908/mes implica un sueldo líquido sobre $1.160.000 para que no te apriete.",
    cajaAccionable_uf: "Regla del 25%: si el aporte no supera el 25% de tu ingreso líquido, es sostenible. UF 7,5/mes implica un sueldo líquido sobre UF 30 para que no te apriete.",
    cajaLabel: "Hazte esta pregunta:",
  },
  negociacion: {
    pregunta: "¿Hay margen para negociar?",
    contenido_clp: "A UF 2.900 (9% menos) el flujo mejora a -$220.000/mes y la TIR sube a 11,2%. Es un descuento alcanzable: el precio/m² ya está bajo el promedio de Providencia, y con las tasas actuales, pocos compradores pueden pagar precio lista.",
    contenido_uf: "A UF 2.900 (9% menos) el flujo mejora a -UF 5,7/mes y la TIR sube a 11,2%. Es un descuento alcanzable: el precio/m² ya está bajo el promedio de Providencia, y con las tasas actuales, pocos compradores pueden pagar precio lista.",
    cajaAccionable_clp: "Usa este guion: 'Con las tasas actuales el dividendo queda muy alto para el arriendo de mercado. A UF 2.900 puedo cerrar la semana que viene. Sobre eso no llego.'",
    cajaAccionable_uf: "Usa este guion: 'Con las tasas actuales el dividendo queda muy alto para el arriendo de mercado. A UF 2.900 puedo cerrar la semana que viene. Sobre eso no llego.'",
    cajaLabel: "Guión para la contraoferta:",
    precioSugerido: "UF 2.900",
  },
  largoPlazo: {
    pregunta: "¿Vale la pena a 10 años?",
    contenido_clp: "En 10 años aportas ~$34.800.000 acumulados. La propiedad vale $183.780.000 (vs $124.160.000 hoy, con plusvalía 4% anual). Patrimonio neto: $79.712.000. Retorno 3,21x sobre el pie de $24.832.000. TIR estimada: 9,6%.",
    contenido_uf: "En 10 años aportas ~UF 897 acumulados. La propiedad vale UF 4.738 (vs UF 3.200 hoy, con plusvalía 4% anual). Patrimonio neto: UF 2.055. Retorno 3,21x sobre el pie de UF 640. TIR estimada: 9,6%.",
    cajaAccionable_clp: "La apuesta implícita: que Providencia mantenga plusvalía de 4% anual durante 10 años. Históricamente (2014-2024) la comuna promedió 5,1% anual — la apuesta tiene respaldo, pero no está garantizada.",
    cajaAccionable_uf: "La apuesta implícita: que Providencia mantenga plusvalía de 4% anual durante 10 años. Históricamente (2014-2024) la comuna promedió 5,1% anual — la apuesta tiene respaldo, pero no está garantizada.",
    cajaLabel: "La apuesta que estás haciendo:",
  },
  riesgos: {
    pregunta: "¿Qué puede salir mal?",
    contenido_clp: "**Subida de tasas.** Si la tasa sube 1,5%, el dividendo pasa a $585.000 y el flujo negativo crece a $345.000/mes. Tu capacidad de ahorro debe absorber ese escenario.\n\n**Vacancia prolongada.** Cada mes sin arrendatario pierdes $500.000 (arriendo + GGCC). Una vacancia de 2 meses al año suma $35.000/mes al déficit.\n\n**Plusvalía por debajo del supuesto.** Si la plusvalía cae a 2% anual (en vez de 4%), el retorno 10 años baja a 2,1x en lugar de 3,21x — la inversión se sostiene pero con mucho menos margen.",
    contenido_uf: "**Subida de tasas.** Si la tasa sube 1,5%, el dividendo pasa a UF 15,1 y el flujo negativo crece a UF 8,9/mes. Tu capacidad de ahorro debe absorber ese escenario.\n\n**Vacancia prolongada.** Cada mes sin arrendatario pierdes UF 12,9 (arriendo + GGCC). Una vacancia de 2 meses al año suma UF 0,9/mes al déficit.\n\n**Plusvalía por debajo del supuesto.** Si la plusvalía cae a 2% anual (en vez de 4%), el retorno 10 años baja a 2,1x en lugar de 3,21x — la inversión se sostiene pero con mucho menos margen.",
    cajaAccionable_clp: "Fondo de reserva mínimo: 6 meses de dividendo + gastos = ~$4.260.000. Antes de firmar, revisa 3 bancos para comparar tasas y asegura que las contribuciones y GGCC del edificio estén al día.",
    cajaAccionable_uf: "Fondo de reserva mínimo: 6 meses de dividendo + gastos = ~UF 110. Antes de firmar, revisa 3 bancos para comparar tasas y asegura que las contribuciones y GGCC del edificio estén al día.",
    cajaLabel: "Si decides avanzar, protege estos flancos:",
  },
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
    <div className="min-h-screen bg-[var(--franco-bg)]">
{/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-[var(--franco-border)] bg-[var(--franco-bg)]">
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
      <div className="bg-[var(--franco-card)] text-white border-b border-[var(--franco-border)]">
        <div className="container mx-auto max-w-6xl px-4 py-3 flex items-center justify-center gap-3 flex-wrap">
          <p className="font-body text-[13px] text-[var(--franco-text)] text-center">
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
      <div className="bg-[var(--franco-bg)] py-12 text-center">
        <p className="font-heading font-bold text-xl text-white mb-2">¿Tienes un depto en la mira?</p>
        <p className="font-body text-sm text-[var(--franco-text-secondary)] mb-6">Resultado en 30 segundos. Registro gratis.</p>
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
