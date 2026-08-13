import { requireAdminPage } from "@/lib/admin-auth";
import { fmtCLP, fmtNumber } from "@/lib/admin-format";
import {
  COLUMNAS_USO_IA,
  costoUsd,
  resumirCosto,
  USD_CLP,
  type UsoIA,
} from "@/lib/costo-ia";
import {
  COLUMNAS_COMISION,
  leerComision,
  resumirComisiones,
  type PagoParaComision,
} from "@/lib/comision-flow";
import { leerGastosFijos } from "@/lib/gastos-fijos";
import { AIRROI_USD_CALL, leerCostoAirroi } from "@/lib/airroi-costo";
import { construirCascadas, IVA, type PagoParaMargen } from "@/lib/margen-informe";
import { leerGastoMeta } from "@/lib/meta-ads";
import { filtroNoTest, getTestAccountIds, leerIncludeTest, PRODUCTO_CONSUMO } from "@/lib/admin-rpc";
import { ContextoBar } from "../test-toggle";
import { AdminCac } from "../admin-cac";
import {
  Badge,
  BloqueCostosVariables,
  BloqueGastosFijos,
  BloqueMargen,
  BloqueResultado,
  SeccionHead,
  type LineaResultado,
} from "./finanzas-bloques";

export const dynamic = "force-dynamic";

/** Ventana del panel. Una sola: si el gasto mirara 30 días y los ingresos 7, el
 *  resultado no significaría nada. */
const DIAS = 30;

/** `product <> 'analysis_charge'` sin comerse los NULL. */
const SIN_CONSUMOS = `product.is.null,product.neq.${PRODUCTO_CONSUMO}`;

/** Umbral bajo el cual una serie diaria se considera cobertura incompleta. */
const COBERTURA_COMPLETA = DIAS;

function fmtToday(): string {
  return new Date().toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Finanzas — qué entra, qué sale y qué queda.
 *
 * SEPARACIÓN CON EL RESUMEN: /admin responde "¿cómo va el negocio?" (funnel,
 * activación, tendencia) y esta pestaña responde "¿esto se paga solo?". El CAC
 * vivía en Resumen y se mudó acá: un costo de adquisición es plata, no embudo.
 *
 * TRES REGLAS QUE ATRAVIESAN TODA LA PANTALLA:
 *
 * 1. Nada se suma en silencio. Cada cifra viaja con su procedencia — medido,
 *    estimado o sin dato — y la UI las distingue. El costo de IA sale de tokens
 *    reales; el de AirROI, de un conteo × una tarifa sin factura. No son la
 *    misma clase de número y no se presentan igual.
 * 2. El IVA no es ingreso. Los ingresos entran netos: el IVA se entera al SII.
 *    El IVA de la comisión de Flow, en cambio, es crédito fiscal y no resta.
 * 3. Las altas de suscripción no son cobros. `resumirComisiones` las excluye,
 *    así que esta pestaña NO hereda el doble conteo de `admin_overview`.
 */
export default async function FinanzasPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { sb } = await requireAdminPage();
  const includeTest = leerIncludeTest(searchParams.test);

  const testUserIds = await getTestAccountIds(sb);
  const noTest = includeTest ? null : filtroNoTest(testUserIds);
  const desde = new Date(Date.now() - DIAS * 864e5).toISOString();

  const [pagosRes, iaRes, airroi, gastos, gastoMeta, analisisRes, atribucionRes] = await Promise.all([
    (() => {
      const q = sb
        .from("payments")
        .select(`${COLUMNAS_COMISION}, product`)
        .eq("status", "paid")
        .gt("amount", 0)
        .or(SIN_CONSUMOS)
        .gte("created_at", desde);
      return noTest ? q.or(noTest) : q;
    })(),
    (() => {
      const q = sb.from("analisis").select(COLUMNAS_USO_IA).gte("created_at", desde);
      return noTest ? q.or(noTest) : q;
    })(),
    leerCostoAirroi(sb, DIAS),
    leerGastosFijos(sb),
    leerGastoMeta(sb, DIAS),
    (() => {
      const q = sb.from("analisis").select("user_id, created_at");
      return noTest ? q.or(noTest) : q;
    })(),
    sb.from("user_attribution").select("user_id, utm_source, created_at").gte("created_at", desde),
  ]);

  // ── Ingresos ──
  const pagos = (pagosRes.data ?? []) as unknown as PagoParaMargen[];
  const comisiones = resumirComisiones(pagos as PagoParaComision[]);
  // Neto SIN IVA: el balance que deposita Flow todavía lleva el IVA adentro, y
  // ese IVA no es nuestro. Se saca del bruto de los cobros reales y después se
  // descuenta la comisión NETA (su IVA es crédito fiscal, no costo).
  const ivaDebito = Math.round(comisiones.bruto - comisiones.bruto / (1 + IVA));
  const comisionSinIva = pagos.reduce((s, p) => {
    const c = leerComision(p);
    return c.fuente === "sin-cobro" ? s : s + c.fee;
  }, 0);
  const ingresoNeto = comisiones.bruto - ivaDebito - comisionSinIva;

  // ── Costo IA ──
  const iaFilas = (iaRes.data ?? []) as unknown as UsoIA[];
  const costoIa = resumirCosto(iaFilas);
  // Mediana y no promedio: un análisis con un Plan C desbordado arrastraría el
  // promedio y el margen unitario saldría peor de lo que es en el caso típico.
  const costosOrdenados = iaFilas
    .map((f) => costoUsd(f))
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);
  const medianaIaUsd = costosOrdenados.length
    ? costosOrdenados[Math.floor(costosOrdenados.length / 2)]
    : null;
  const medianaIaClp = medianaIaUsd == null ? null : Math.round(medianaIaUsd * USD_CLP);

  // ── Resultado ──
  const cascadas = construirCascadas(pagos, medianaIaClp);

  const lineas: LineaResultado[] = [
    { label: "Ingreso neto", monto: ingresoNeto, estado: comisiones.estimados > 0 ? "estimado" : "medido" },
    { label: "− Costo IA", monto: -Math.round(costoIa.totalClp), estado: "medido" },
    {
      label: "− AirROI",
      monto: -airroi.totalClp,
      estado: airroi.sinDato ? "sin-dato" : "estimado",
      cobertura:
        !airroi.sinDato && airroi.diasConDato < COBERTURA_COMPLETA
          ? `${airroi.diasConDato} de ${DIAS} días`
          : undefined,
    },
    {
      label: "− Gastos fijos",
      monto: -gastos.totalMensual,
      estado: gastos.sinDato ? "sin-dato" : "medido",
    },
    {
      label: "− Pauta (Meta)",
      monto: -Math.round(gastoMeta.total),
      estado: gastoMeta.sinDato ? "sin-dato" : "estimado",
      cobertura:
        !gastoMeta.sinDato && gastoMeta.diasConDato < COBERTURA_COMPLETA
          ? `${gastoMeta.diasConDato} de ${DIAS} días`
          : undefined,
    },
  ];

  const total = lineas.reduce((s, l) => s + l.monto, 0);

  // Las líneas con serie incompleta suben al banner: el resultado es un piso,
  // no una medición cerrada, y eso tiene que leerse con el mismo peso que la cifra.
  const incompletas = lineas
    .filter((l) => l.cobertura)
    .map((l) => ({ label: l.label.replace(/^− /, ""), cobertura: `${l.cobertura} medidos` }));

  // ── CAC (mudado desde Resumen) ──
  const primerAnalisis = new Map<string, string>();
  for (const a of (analisisRes.data ?? []) as Array<{ user_id: string | null; created_at: string }>) {
    if (!a.user_id) continue;
    const previo = primerAnalisis.get(a.user_id);
    if (!previo || a.created_at < previo) primerAnalisis.set(a.user_id, a.created_at);
  }
  const activaciones = Array.from(primerAnalisis.values()).filter((f) => f >= desde).length;

  const atribuciones = (atribucionRes.data ?? []) as Array<{ utm_source: string | null }>;
  const conteoFuente = new Map<string, number>();
  for (const a of atribuciones) {
    const k = a.utm_source?.trim() || "directo/sin UTM";
    conteoFuente.set(k, (conteoFuente.get(k) ?? 0) + 1);
  }
  const porFuente = Array.from(conteoFuente, ([fuente, usuarios]) => ({ fuente, usuarios })).sort(
    (a, b) => b.usuarios - a.usuarios,
  );

  // Registros del período: los usuarios con atribución son un subconjunto, así
  // que el denominador del CAC sale de los análisis + atribuciones que sí se ven.
  const registros = Math.max(atribuciones.length, activaciones);
  const pagosReales = comisiones.medidos + comisiones.estimados;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[var(--franco-text)]">Finanzas</h1>
          <p className="mt-1 font-mono text-sm text-[var(--franco-text-muted)]">
            {fmtToday()} · últimos {DIAS} días
          </p>
        </div>
      </div>

      <ContextoBar
        includeTest={includeTest}
        href={includeTest ? "/admin/finanzas" : "/admin/finanzas?test=1"}
        usuarios={registros}
        testCount={testUserIds.length}
      />

      {/* ─── 1 · RESULTADO ─── */}
      <section className="mb-8">
        <SeccionHead titulo="Resultado del período" nota="Ingresos reales menos todo" />
        <BloqueResultado total={total} lineas={lineas} incompletas={incompletas} />
      </section>

      {/* ─── 2 · MARGEN POR INFORME ─── */}
      <section className="mb-8">
        <SeccionHead titulo="Margen por informe" nota="Cascada sobre los cobros reales" />
        <BloqueMargen cascadas={cascadas} />
        {comisiones.sinCobro > 0 && (
          <p className="mt-3 font-body text-[11px] leading-relaxed text-[var(--franco-text-muted)]">
            Se {comisiones.sinCobro === 1 ? "excluyó" : "excluyeron"} {fmtNumber(comisiones.sinCobro)}{" "}
            {comisiones.sinCobro === 1 ? "fila de alta de suscripción" : "filas de alta de suscripción"}:
            no {comisiones.sinCobro === 1 ? "es un cobro" : "son cobros"} — el cargo llega después en su
            propia fila. Contarla{comisiones.sinCobro === 1 ? "" : "s"} duplicaría el ingreso.
            <Badge estado="medido" />
          </p>
        )}
      </section>

      {/* ─── 3 · COSTOS VARIABLES ─── */}
      <section className="mb-8">
        <SeccionHead titulo="Costos variables" nota="Escalan con el uso" />
        <BloqueCostosVariables
          iaUsd={costoIa.totalUsd}
          iaClp={Math.round(costoIa.totalClp)}
          iaMedidos={costoIa.medidos}
          iaSinMedir={costoIa.sinMedir}
          airroi={airroi}
          usdClp={USD_CLP}
          tarifaAirroi={AIRROI_USD_CALL}
        />
      </section>

      {/* ─── 4 · GASTOS FIJOS ─── */}
      <section className="mb-8">
        <SeccionHead titulo="Gastos fijos" nota="Prorrateados a mes" />
        <BloqueGastosFijos gastos={gastos} />
      </section>

      {/* ─── 5 · CAC ─── */}
      <section>
        <SeccionHead titulo="Qué cuesta traer a alguien" nota="Gasto de Meta ÷ conversiones nuestras" />
        <AdminCac
          datos={{
            gasto: gastoMeta,
            registros,
            activaciones,
            pagos: pagosReales,
            dias: DIAS,
            conAtribucion: atribuciones.length,
            porFuente,
          }}
        />
      </section>

      <p className="mt-8 font-body text-[11px] leading-relaxed text-[var(--franco-text-muted)]">
        Bruto del período: {fmtCLP(comisiones.bruto)} en {fmtNumber(pagosReales)}{" "}
        {pagosReales === 1 ? "cobro" : "cobros"}.
      </p>
    </>
  );
}
