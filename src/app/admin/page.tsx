import { requireAdminPage } from "@/lib/admin-auth";
import { fmtCLP, fmtNumber } from "@/lib/admin-format";
import { COLUMNAS_USO_IA, fmtUsd, resumirCosto, type UsoIA } from "@/lib/costo-ia";
import { COLUMNAS_COMISION, resumirComisiones, type PagoParaComision } from "@/lib/comision-flow";
import {
  adminOverview,
  adminWeeklyStats,
  filtroNoTest,
  getTestAccountIds,
  leerIncludeTest,
  PRODUCTO_CONSUMO,
} from "@/lib/admin-rpc";
import { AdminTitular } from "./admin-titular";
import { AdminCheckoutsAbandonados, type CheckoutAbandonado } from "./admin-funnel";
import { AdminSankey, type AperturaNodo, type MetricaSankey } from "./admin-sankey";
import { AdminTasasChart, type PuntoTasa } from "./admin-tasas-chart";
import { HITOS_FUNNEL, tramoApagado } from "@/lib/admin-funnel-hitos";
import { AdminTendencia } from "./admin-tendencia";
import { ContextoBar } from "./test-toggle";
import { pasosPostHog, seriePostHog } from "@/lib/posthog-admin";
import {
  funnelSupabase,
  leerPeriodo,
  rangoPeriodo,
  serieSupabase,
  type PeriodoFunnel,
} from "@/lib/admin-funnel-data";
import Link from "next/link";

export const dynamic = "force-dynamic";

/** Semanas de la serie de tendencia. */
const SEMANAS = 12;

/** Ventana de los KPIs y del CAC. Una sola constante: si el bloque de costos
 *  mirara 30 días y el de gasto 7, el cociente no significaría nada. */
const DIAS_KPI = 30;

/** Ventana de la serie de tasas. Corta a propósito: es "cómo venimos", no historia. */
const DIAS_SERIE = 14;

/** Denominador por debajo del cual una tasa diaria es ruido y no se dibuja. */
const DENOMINADOR_MINIMO = 20;

/** "2026-08-16" → "16 ago". El eje del gráfico no tiene lugar para más. */
function fmtDiaCorto(dia: string): string {
  const d = new Date(`${dia}T00:00:00Z`);
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");
}

/** `product <> 'analysis_charge'` sin comerse los NULL (en SQL `<>` sobre NULL da NULL). */
const SIN_CONSUMOS = `product.is.null,product.neq.${PRODUCTO_CONSUMO}`;

/**
 * Edad de la foto de PostHog, en texto. `null` (fail-soft) → sin etiqueta: el
 * paso ya se pinta "—" y una marca de tiempo sobre un dato ausente confunde
 * más de lo que informa. Se calcula en el server al renderizar, que es el
 * mismo instante en que se lee el número — la página es force-dynamic.
 */
function etiquetaFrescura(medidoEn: string | null): string | undefined {
  if (!medidoEn) return undefined;
  const ms = Date.now() - new Date(medidoEn).getTime();
  if (!Number.isFinite(ms) || ms < 0) return undefined;
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "actualizado recién";
  if (min < 60) return `actualizado hace ${min} min`;
  const h = Math.floor(min / 60);
  return `actualizado hace ${h} h`;
}

function fmtToday(): string {
  return new Date().toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Resumen del panel: 4 bloques, en pirámide invertida.
 *
 *   1. Titular en prosa — qué está pasando, en una frase.
 *   2. Funnel proporcional — dónde se cae la gente.
 *   3. Tendencia — cómo viene, semana a semana, con cohortes.
 *   4. Tres KPIs — los números que se miran al final, no al principio.
 *
 * Todo lo operacional (estado del sistema, crons, cobertura, boletas) vive ahora
 * en /admin/operacion: son dos preguntas distintas —"¿cómo va el negocio?" y
 * "¿está todo funcionando?"— y mezclarlas hacía que ninguna se respondiera bien.
 *
 * Los agregados salen de admin_overview y admin_weekly_stats (SQL, sin traer
 * filas a JS). Si esas funciones todavía no están creadas en la base, las
 * llamadas devuelven vacío y la página se ve en cero en vez de caerse.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // Gate compartido (src/lib/admin-auth.ts): anon client primero, service role
  // solo después de validar la allowlist.
  const { sb } = await requireAdminPage();
  const includeTest = leerIncludeTest(searchParams.test);

  const testUserIds = await getTestAccountIds(sb);
  const noTest = includeTest ? null : filtroNoTest(testUserIds);
  const testIdSet = new Set(testUserIds);
  /** Corte de la ventana, compartido por todas las queries del período. */
  const desdeKpi = new Date(Date.now() - DIAS_KPI * 864e5).toISOString();

  // Funnel 7 pasos (Fase B): período con corte en el deploy del cap. Default
  // "post" — mezclar mundo-muro con mundo-cap ensucia toda tasa.
  const periodo = leerPeriodo(searchParams.periodo);
  const rango = rangoPeriodo(periodo);

  const [overview, semanas, checkoutsRow, usoIaRows, pagosRows, pasosPh, funnel7] = await Promise.all([
    adminOverview(sb, includeTest),
    adminWeeklyStats(sb, { weeks: SEMANAS, includeTest }),
    // Los checkouts abandonados se traen como filas (no como conteo) porque con
    // este volumen cada caso es información: quién, qué producto y cuándo.
    (() => {
      const q = sb
        .from("payments")
        .select("id, user_id, product, amount, created_at")
        .eq("status", "pending")
        .gt("amount", 0)
        .or(SIN_CONSUMOS)
        .order("created_at", { ascending: false })
        .limit(20);
      return noTest ? q.or(noTest) : q;
    })(),
    // Consumo de IA de los análisis del período. Se traen las filas y el costo se
    // calcula al leer (ver costo-ia.ts): las tarifas cambian, los tokens no.
    // Mismo filtro de cuentas de test que el resto de la página.
    (() => {
      const q = sb
        .from("analisis")
        .select(COLUMNAS_USO_IA)
        .gte("created_at", desdeKpi);
      return noTest ? q.or(noTest) : q;
    })(),
    // Pagos confirmados del período, para el NETO. `ingresos_30d` de la RPC es
    // bruto —lo que el usuario pagó—, no lo que entró: Flow retiene comisión +
    // IVA en cada transacción. La retención viene en el propio payment_data
    // (ver comision-flow.ts), así que se traen las filas y se lee al calcular,
    // igual que con los tokens de IA.
    (() => {
      const q = sb
        .from("payments")
        .select(COLUMNAS_COMISION)
        .eq("status", "paid")
        .gt("amount", 0)
        .or(SIN_CONSUMOS)
        .gte("created_at", desdeKpi);
      return noTest ? q.or(noTest) : q;
    })(),
    // El gasto de Meta, el histórico de análisis y la atribución se fueron con
    // el CAC a /admin/finanzas — esta pantalla ya no los necesita y son tres
    // queries menos por visita.
    // Pasos 1-2 del funnel (PostHog, cacheado 15 min, fail-soft a "sin datos") y
    // pasos 3-7 (Supabase directo). Nada de esto puede tirar la página.
    pasosPostHog(rango.desde ?? "2025-01-01T00:00:00.000Z", rango.hasta, includeTest),
    funnelSupabase(sb, { periodo, testUserIds, includeTest }),
  ]);

  // Las filas anteriores a la instrumentación tienen los ai_* en NULL, que
  // significa "no medido" y NO "costo cero": resumirCosto las cuenta aparte para
  // que el promedio no se diluya con análisis que sí costaron y nadie midió.
  const costoIa = resumirCosto((usoIaRows.data ?? []) as unknown as UsoIA[]);

  // Neto depositado del período. `resumirComisiones` deja fuera las altas de
  // suscripción: no son un cobro (el cargo llega después, en su propia fila) y
  // sumarlas contaría el mismo dinero dos veces.
  const comisiones = resumirComisiones((pagosRows.data ?? []) as unknown as PagoParaComision[]);

  const checkoutRows = (checkoutsRow.data ?? []) as Array<{
    id: string; user_id: string; product: string | null; amount: number | null; created_at: string;
  }>;

  // Correos de los usuarios que aparecen en la tabla de abandonados — la única
  // identidad que esta página necesita resolver. Se piden por id (uno por
  // usuario ÚNICO, no por fila) en vez de paginar la base entera: la lista está
  // topeada en 20 filas y en la práctica son un puñado de usuarios.
  const idsAbandonados = Array.from(new Set(checkoutRows.map((p) => p.user_id)));
  const emailById = new Map<string, string>(
    (
      await Promise.all(
        idsAbandonados.map(async (id) => {
          const { data } = await sb.auth.admin.getUserById(id);
          return [id, data?.user?.email ?? ""] as const;
        })
      )
    ).filter(([, email]) => email !== "")
  );

  const abandonados: CheckoutAbandonado[] = checkoutRows.map((p) => ({
    paymentId: p.id,
    email: emailById.get(p.user_id) ?? "—",
    producto: p.product ?? "—",
    monto: p.amount ?? 0,
    fecha: p.created_at,
    esTest: testIdSet.has(p.user_id),
  }));

  const tasaActivacion =
    overview.registrados > 0 ? Math.round((overview.activaron / overview.registrados) * 100) : 0;

  // Los pasos de PostHog salen de una foto cacheada; los de Supabase son en
  // vivo. La etiqueta de edad hace visible esa asimetría: sin ella, un número
  // quieto mientras el resto se mueve se lee como dato roto (pasó, 17-ago).
  const frescuraPh = etiquetaFrescura(pasosPh.medidoEn);

  // ── Vista 1 · Sankey de dos caminos ──
  // El Sankey necesita las columnas 1-2 (origen y wizard), que son de PostHog.
  // Sin ellas no hay diagrama que dibujar: se degrada a un aviso sobrio y el
  // resto del bloque (métricas calculables, tabla de abandonados) sigue vivo.
  const hayPostHog =
    pasosPh.visitas != null && pasosPh.iniciaronWizard != null && pasosPh.visitasPagada != null;

  const entradaSankey = hayPostHog
    ? {
        visitasPagada: pasosPh.visitasPagada!,
        visitasOrganico: pasosPh.visitasOrganico ?? 0,
        abrenWizard: pasosPh.iniciaronWizard!,
        gratisAnonimos: funnel7.gratisAnonCap,
        gratisConCuenta: funnel7.gratisWelcome,
        cuentasClaim: funnel7.cuentasClaim,
        cuentasDirecto: funnel7.cuentasOrganico,
        pagos: funnel7.pagaron,
      }
    : null;

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);
  const pruebanPct = pasosPh.visitas != null ? pct(funnel7.gratisTotal, pasosPh.visitas) : null;
  const claimPct = pct(funnel7.cuentasClaim, funnel7.gratisAnonCap);
  const visitasPorCuenta =
    pasosPh.visitas != null && funnel7.cuentasTotal > 0
      ? Math.round(pasosPh.visitas / funnel7.cuentasTotal)
      : null;

  // Desglose por nodo. Solo los nodos con una dimensión medible aparecen acá;
  // el resto no es clickeable. El componente decide si hay volumen suficiente
  // para mostrar porcentajes o si corresponde el estado vacío honesto.
  const aperturas: Record<string, AperturaNodo> = {
    pagada: { titulo: "por fuente", items: pasosPh.origenPorFuente },
    abren: { titulo: "por dispositivo", items: pasosPh.wizardPorDispositivo },
    anonimos: { titulo: "por modalidad", items: funnel7.gratisPorTipoAnon },
    concuenta: { titulo: "por modalidad", items: funnel7.gratisPorTipoWelcome },
  };

  const metricasSankey: MetricaSankey[] = [
    {
      titulo: "Prueban el producto",
      valor: pruebanPct != null ? `${pruebanPct}%` : "—",
      detalle:
        pruebanPct != null
          ? `${fmtNumber(funnel7.gratisTotal)} de ${fmtNumber(pasosPh.visitas!)} visitas`
          : "sin datos de PostHog para el denominador",
    },
    {
      titulo: "Anónimo → cuenta",
      valor: claimPct != null ? `${claimPct}%` : "—",
      detalle:
        claimPct != null
          ? `${fmtNumber(funnel7.cuentasClaim)} de ${fmtNumber(funnel7.gratisAnonCap)} reclamaron`
          : "todavía no hay análisis anónimos",
    },
    {
      titulo: "Visitas por cuenta",
      valor: visitasPorCuenta != null ? fmtNumber(visitasPorCuenta) : "—",
      detalle:
        visitasPorCuenta != null
          ? `${fmtNumber(pasosPh.visitas!)} ÷ ${fmtNumber(funnel7.cuentasTotal)}`
          : "sin cuentas en el período todavía",
    },
  ];

  // ── Vista 2 · Evolución de tasas ──
  // Ventana móvil propia de 14 días: la evolución se lee sobre un tramo corto y
  // reciente. El filtro de período manda en el Sankey, no acá — si no, elegir
  // "pre-cap" dejaría el gráfico sin el hito que le da sentido.
  const desdeSerie = new Date(Date.now() - DIAS_SERIE * 86_400_000).toISOString();
  const [serPh, serSb] = await Promise.all([
    seriePostHog(desdeSerie, includeTest),
    serieSupabase(sb, { desdeIso: desdeSerie, testUserIds, includeTest }),
  ]);
  const phPorDia = new Map(serPh.map((d) => [d.dia, d]));
  const sbPorDia = new Map(serSb.map((d) => [d.dia, d]));
  const diasSerie = Array.from(
    new Set(Array.from(phPorDia.keys()).concat(Array.from(sbPorDia.keys()))),
  ).sort();

  // Un día con 4 visitas produce tasas de 75% que son ruido, no señal: con
  // denominador chico un solo usuario mueve la línea decenas de puntos. Debajo
  // del piso el punto se apaga (null) en vez de dibujarse como si midiera algo.
  const conBase = (num: number, den: number | null) =>
    den != null && den >= DENOMINADOR_MINIMO ? pct(num, den) : null;

  const datosTasas: PuntoTasa[] = diasSerie.map((dia) => {
    const ph = phPorDia.get(dia);
    const sbd = sbPorDia.get(dia);
    const visitas = ph?.visitas ?? null;
    const wiz = ph?.iniciaronWizard ?? null;
    const gratis = sbd?.gratis ?? 0;
    const cuentas = sbd?.cuentas ?? 0;
    // Cada hito apaga los tramos que lista en `invalida` para los días
    // anteriores a su fecha: el corte vive en el hito, no acá, así que agregar
    // un hito nuevo no obliga a tocar esta función.
    const apagado = (tramo: Parameters<typeof tramoApagado>[0]) => tramoApagado(tramo, dia);
    return {
      dia,
      label: fmtDiaCorto(dia),
      visitaWizard: apagado("visitaWizard") ? null : conBase(wiz ?? 0, visitas),
      wizardAnalisis: apagado("wizardAnalisis") ? null : conBase(gratis, wiz),
      analisisCuenta: apagado("analisisCuenta") ? null : conBase(cuentas, gratis),
    };
  });

  const visitasPorCompra =
    pasosPh.visitas != null && funnel7.pagaron > 0
      ? Math.round(pasosPh.visitas / funnel7.pagaron)
      : null;
  const PERIODOS: Array<{ id: PeriodoFunnel; label: string }> = [
    { id: "post", label: "Desde el cap (16 ago)" },
    { id: "pre", label: "Pre-cap" },
    { id: "todo", label: "Todo" },
  ];
  const hrefPeriodo = (p: PeriodoFunnel) =>
    `/admin?periodo=${p}${includeTest ? "&test=1" : ""}`;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[var(--franco-text)]">Resumen</h1>
          <p className="mt-1 font-mono text-sm text-[var(--franco-text-muted)]">{fmtToday()}</p>
        </div>
      </div>

      <ContextoBar
        includeTest={includeTest}
        href={includeTest ? "/admin" : "/admin?test=1"}
        usuarios={overview.registrados}
        testCount={testUserIds.length}
      />

      {/* ─── 1 · TITULAR ─── */}
      <section className="mb-8">
        <AdminTitular
          registrados={overview.registrados}
          nuevos30d={overview.nuevos_30d}
          activaron={overview.activaron}
          iniciaronCheckout={overview.iniciaron_checkout}
          pagaron={overview.pagaron}
          includeTest={includeTest}
        />
      </section>

      {/* ─── 2 · FUNNEL 7 PASOS (mundo post-cap) ─── */}
      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-[var(--franco-text)]">Dónde se cae</h2>
          {/* Filtro de período con corte en el deploy del cap: mezclar
              mundo-muro con mundo-cap ensucia toda tasa. Default: post. */}
          <div className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider">
            {PERIODOS.map((p) => (
              <Link
                key={p.id}
                href={hrefPeriodo(p.id)}
                className={`rounded border px-2 py-1 transition-colors ${
                  periodo === p.id
                    ? "border-[var(--franco-text)] bg-[var(--franco-text)] text-[var(--franco-bg)]"
                    : "border-[var(--franco-border)] text-[var(--franco-text-muted)] hover:text-[var(--franco-text)]"
                }`}
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>

        {/* El número grande: cuántas visitas cuesta una compra en el período. */}
        <div className="mb-3 rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] px-4 py-3.5">
          <div className="font-mono text-[26px] font-bold tracking-tight text-[var(--franco-text)]">
            {visitasPorCompra != null ? fmtNumber(visitasPorCompra) : "—"}
          </div>
          <div className="mt-0.5 font-body text-[13px] text-[var(--franco-text)]">visitas por compra</div>
          <div className="mt-0.5 font-mono text-[10px] text-[var(--franco-text-tertiary)]">
            {visitasPorCompra != null
              ? `${fmtNumber(pasosPh.visitas ?? 0)} visitas ÷ ${fmtNumber(funnel7.pagaron)} ${funnel7.pagaron === 1 ? "compra" : "compras"}`
              : pasosPh.visitas == null
                ? "sin datos de PostHog para el numerador"
                : "sin compras en el período todavía"}
          </div>
        </div>

        {entradaSankey ? (
          <AdminSankey
            entrada={entradaSankey}
            metricas={metricasSankey}
            aperturas={aperturas}
            frescura={frescuraPh}
            nota="Las etapas no comparten unidad: origen y wizard cuentan sesiones y personas de PostHog; análisis, cuentas y pagos cuentan identidades de la base (el par AMBAS vale 1). El reparto de “se van” entre pagado y orgánico es proporcional al peso de cada origen — no hay dato de abandono por origen. “Con cuenta” no desemboca en cuentas creadas: esos análisis los hicieron cuentas que ya existían."
          />
        ) : (
          <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] px-4 py-6">
            <p className="font-body text-[13px] text-[var(--franco-text-muted)]">
              PostHog no respondió, así que faltan las columnas de origen y wizard — sin ellas el
              diagrama de flujo no se puede dibujar. Los datos de la base siguen abajo.
            </p>
          </div>
        )}

        <div className="mt-3">
          <AdminCheckoutsAbandonados includeTest={includeTest} abandonados={abandonados} />
        </div>
      </section>

      {/* ─── 2b · EVOLUCIÓN DE TASAS ─── */}
      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-[var(--franco-text)]">
            ¿Vamos mejorando?
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
            últimos {DIAS_SERIE} días · día UTC
          </span>
        </div>
        <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
          {datosTasas.length === 0 ? (
            <p className="font-body text-[13px] text-[var(--franco-text-muted)]">
              Todavía no hay días con datos en la ventana.
            </p>
          ) : (
            <>
              <AdminTasasChart datos={datosTasas} />
              {/* Respaldo en texto del gráfico: mismos números, sin depender de
                  poder ver la curva. Es lo que lee un lector de pantalla. */}
              <table className="sr-only">
                <caption>
                  Tasas de conversión diarias de los últimos {DIAS_SERIE} días. Los tramos no se
                  informan antes del hito que los hace comparables:{" "}
                  {HITOS_FUNNEL.map((h) => `${h.etiqueta} (${h.fecha}) — ${h.motivo}`).join("; ")}.
                  Tampoco se informan los días con menos de {DENOMINADOR_MINIMO} en el
                  denominador, donde la tasa sería ruido.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Día</th>
                    <th scope="col">Visita a wizard</th>
                    <th scope="col">Wizard a análisis</th>
                    <th scope="col">Análisis a cuenta</th>
                  </tr>
                </thead>
                <tbody>
                  {datosTasas.map((d) => (
                    <tr key={d.dia}>
                      <th scope="row">{d.label}</th>
                      <td>{d.visitaWizard != null ? `${d.visitaWizard}%` : "sin dato"}</td>
                      <td>{d.wizardAnalisis != null ? `${d.wizardAnalisis}%` : "sin dato"}</td>
                      <td>{d.analisisCuenta != null ? `${d.analisisCuenta}%` : "no comparable"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </section>

      {/* ─── 3 · TENDENCIA ─── */}
      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-[var(--franco-text)]">Cómo viene</h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
            Últimas {SEMANAS} semanas
          </span>
        </div>
        <AdminTendencia semanas={semanas} />
      </section>

      {/* El CAC vivía acá y se mudó a /admin/finanzas: un costo de adquisición es
          plata, no embudo. Esta pantalla responde "¿cómo va el negocio?" y la de
          Finanzas "¿esto se paga solo?" — mezclarlas hacía que ninguna se
          respondiera bien, el mismo motivo por el que lo operacional se fue a
          /admin/operacion. */}

      {/* ─── 4 · KPIs ─── */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-[var(--franco-text)]">Los cuatro números</h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
            Últimos {DIAS_KPI} días
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            valor={fmtNumber(overview.nuevos_30d)}
            label="Usuarios nuevos"
            sub={
              overview.registrados > 0
                ? `${Math.round((overview.nuevos_30d / overview.registrados) * 100)}% de toda la base`
                : undefined
            }
          />
          <Kpi
            valor={`${tasaActivacion}%`}
            label="Tasa de activación"
            sub={`${fmtNumber(overview.activaron)} de ${fmtNumber(overview.registrados)} generaron un análisis`}
          />
          {/* El bruto es lo que pagó el usuario; el neto es lo que entró. La
              diferencia es la comisión de Flow, que en cada transacción viene en
              el propio payment_data — así que se muestra medida, no supuesta. */}
          <Kpi
            valor={fmtCLP(comisiones.neto)}
            label="Ingresos netos"
            sub={
              <>
                <div>
                  {fmtCLP(comisiones.bruto)} bruto · Flow retuvo {fmtCLP(comisiones.retenido)}
                  {comisiones.tasaEfectiva != null
                    ? ` (${(comisiones.tasaEfectiva * 100).toFixed(2)}%)`
                    : ""}
                </div>
                <div>
                  {fmtNumber(comisiones.medidos)} medidos
                  {comisiones.estimados > 0 ? ` · ${fmtNumber(comisiones.estimados)} estimados` : ""}
                  {comisiones.sinCobro > 0 ? ` · ${fmtNumber(comisiones.sinCobro)} altas sin cobro` : ""}
                </div>
              </>
            }
          />
          <Kpi
            valor={costoIa.medidos > 0 ? fmtUsd(costoIa.totalUsd) : "sin datos"}
            label="Costo IA"
            sub={
              costoIa.medidos > 0
                ? `${fmtUsd(costoIa.promedioUsd ?? 0)} por análisis · ${fmtNumber(costoIa.medidos)} medidos${
                    costoIa.sinMedir > 0 ? ` · ${fmtNumber(costoIa.sinMedir)} sin medir` : ""
                  }`
                : "ningún análisis del período tiene tokens registrados"
            }
            className="col-span-2 lg:col-span-1"
          />
        </div>
      </section>
    </>
  );
}

function Kpi({
  valor,
  label,
  sub,
  className = "",
}: {
  valor: string;
  label: string;
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4 ${className}`}>
      <div className="truncate font-mono text-[26px] font-bold tracking-tight text-[var(--franco-text)]" title={valor}>
        {valor}
      </div>
      <div className="mt-1 font-body text-[13px] text-[var(--franco-text)]">{label}</div>
      {sub && <div className="mt-0.5 font-mono text-[10px] leading-relaxed text-[var(--franco-text-tertiary)]">{sub}</div>}
    </div>
  );
}
