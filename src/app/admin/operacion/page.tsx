import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { conceptoBoleta, type PaymentForDTE } from "@/lib/openfactura/client";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/StatusBadge";
import { fmtCLP, fmtNumber, fmtRelative, fmtDateShort } from "@/lib/admin-format";
import { esUFPlausible } from "@/lib/uf";
import {
  adminOverview,
  filtroNoTest,
  getTestAccountIds,
  leerIncludeTest,
  PRODUCTO_CONSUMO,
} from "@/lib/admin-rpc";
import {
  FUENTE_SENTRY,
  METRICA_ERRORES_1D,
  leerSerie,
  resumirSerie,
} from "@/lib/metrics-daily";
import { leerLatidos } from "@/lib/cron-heartbeat";
import { leerCobertura, plegarCobertura } from "@/lib/admin-cobertura";
import { COMUNAS_ROSTER } from "@/lib/data/comunas-roster";
import { DIAS_ATRASO_PASE, estadoPase, leerCheckpointBackfill } from "@/lib/admin-backfill-toctoc";
import { AdminActions } from "../admin-actions";
import { RetryButton } from "../retry-button";
import { TestToggle } from "../test-toggle";

export const dynamic = "force-dynamic";

const SIN_CONSUMOS = `product.is.null,product.neq.${PRODUCTO_CONSUMO}`;

/** Ventana de la pastilla de errores: el día de hoy más los 6 anteriores. */
const DIAS_VENTANA_ERRORES = 7;

/**
 * Umbrales de la pastilla de errores, en errores por día.
 *
 * Calibrados al volumen REAL de hoy, no a un estándar de la industria: 48
 * usuarios reales y algo más de un análisis por día. Con ese tráfico, diez
 * errores en 24 horas no puede ser ruido de fondo — es algo roto. Y un solo
 * error ya merece una mirada, aunque no despertar a nadie.
 *
 * No hay línea base todavía (Sentry recién empezó a ver los errores de las
 * rutas de API), así que estos números son un punto de partida deliberadamente
 * conservador. Cuando haya un par de semanas de serie en metrics_daily, se
 * recalibran contra la mediana observada en vez de contra una intuición.
 */
const ERRORES_UMBRAL_WARN = 1;
const ERRORES_UMBRAL_ERROR = 10;

/** Link al buscador de issues del proyecto, con la ventana ya aplicada. */
const SENTRY_ISSUES_URL =
  "https://sentry.io/organizations/franco-1v/issues/?project=javascript-nextjs&statsPeriod=24h";

function horasDesde(date: string | null | undefined): number | null {
  if (!date) return null;
  return (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60);
}

function isStale(date: string | null | undefined, hoursThreshold: number): boolean {
  const h = horasDesde(date);
  return h == null || h > hoursThreshold;
}

function diasDesde(date: string | null | undefined): number | null {
  const h = horasDesde(date);
  return h == null ? null : Math.floor(h / 24);
}

/**
 * Operación: "¿está todo funcionando?".
 *
 * Todo esto vivía mezclado con las métricas de negocio en /admin, que respondía
 * dos preguntas distintas al mismo tiempo y ninguna bien. Acá el orden es por
 * urgencia: primero lo que está roto, después lo que hay que mirar de vez en
 * cuando.
 */
export default async function AdminOperacionPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { sb } = await requireAdminPage();
  const includeTest = leerIncludeTest(searchParams.test);

  const testUserIds = await getTestAccountIds(sb);
  const noTest = includeTest ? null : filtroNoTest(testUserIds);
  const sinTest = <T extends { or: (f: string) => T }>(q: T): T => (noTest ? q.or(noTest) : q);

  const [
    analisisCount,
    propsActiveCount,
    propsLastScraped,
    ufConfig,
    tasaConfig,
    lastPaidPayment,
    overviewReal,
    overviewTotal,
    serieErrores,
    latidos,
    cobertura,
    checkpointBackfill,
  ] = await Promise.all([
    sb.from("analisis").select("*", { count: "exact", head: true }),
    sb.from("scraped_properties").select("*", { count: "exact", head: true }).eq("is_active", true),
    sb.from("scraped_properties").select("scraped_at").order("scraped_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("config").select("value, updated_at").eq("key", "uf_value").maybeSingle(),
    sb.from("config").select("value, updated_at").eq("key", "tasa_hipotecaria").maybeSingle(),
    // Criterio de pago real: sin esto, cada consumo de crédito ($0) contaba como
    // "último pago" y la pastilla no podía ponerse nunca en rojo.
    sb
      .from("payments")
      .select("created_at")
      .eq("status", "paid")
      .gt("amount", 0)
      .or(SIN_CONSUMOS)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    adminOverview(sb, false),
    adminOverview(sb, true),
    // Errores de Sentry: se leen de metrics_daily, NO de la API de Sentry. Un
    // timeout de un tercero no puede dejar esta página colgada — el cron diario
    // (/api/cron/sentry-metrics) es el único que habla con Sentry.
    leerSerie(sb, FUENTE_SENTRY, METRICA_ERRORES_1D, DIAS_VENTANA_ERRORES),
    leerLatidos(sb),
    leerCobertura(sb),
    leerCheckpointBackfill(sb),
  ]);

  // ─── UF y tasa ───
  // La fuente viva es la tabla `config`, NO `market_data` (que no existe en la
  // base: el cron que le escribe falla en silencio todos los días). La pastilla
  // apuntaba a esa tabla fantasma y por eso solo mostraba "—".
  const ufRaw = ufConfig.data ? parseFloat(ufConfig.data.value as string) : null;
  const ufUpdatedAt = (ufConfig.data?.updated_at as string | undefined) ?? null;
  const ufOk = esUFPlausible(ufRaw) && !isStale(ufUpdatedAt, 48);
  const ufCorrupta = ufRaw != null && ufRaw > 0 && !esUFPlausible(ufRaw);
  const tasaUpdatedAt = (tasaConfig.data?.updated_at as string | undefined) ?? null;
  const tasaValor = tasaConfig.data ? parseFloat(tasaConfig.data.value as string) : null;
  // "El cron de UF/tasa" = la última vez que alguien escribió estos dos valores.
  const marketUpdatedAt =
    ufUpdatedAt && tasaUpdatedAt ? (ufUpdatedAt > tasaUpdatedAt ? ufUpdatedAt : tasaUpdatedAt) : ufUpdatedAt ?? tasaUpdatedAt;
  const diasSinActualizar = diasDesde(marketUpdatedAt);

  const lastScrapedAt = propsLastScraped.data?.scraped_at as string | undefined;

  // ─── ERRORES (Sentry) ───
  // "0 errores" y "sin dato" NO son lo mismo, y la pastilla tiene que
  // distinguirlos: el primero es una buena noticia, el segundo significa que el
  // cron no corrió y estamos ciegos. Mostrar "0" en ambos casos sería mentir
  // sobre el más grave de los dos.
  const errores = resumirSerie(serieErrores);
  const sinDatoErrores = errores.ultimoDia === null || !errores.fresca;

  const estadoErrores: "ok" | "warn" | "error" = sinDatoErrores
    ? "warn"
    : errores.ultimoDia! >= ERRORES_UMBRAL_ERROR
    ? "error"
    : errores.ultimoDia! >= ERRORES_UMBRAL_WARN
    ? "warn"
    : "ok";

  const valorErrores = sinDatoErrores
    ? errores.ultimaFecha
      ? `sin medir desde ${fmtDateShort(errores.ultimaFecha)}`
      : "sin dato"
    // El 7d se DERIVA sumando las filas diarias; no se guarda aparte para que no
    // pueda desincronizarse del detalle. Si faltan días en la serie se dice,
    // porque un total de 3 días no es comparable con uno de 7.
    : `${fmtNumber(errores.ultimoDia!)} · 24h  ·  ${fmtNumber(errores.suma7d)} · ${errores.diasConDato === DIAS_VENTANA_ERRORES ? "7d" : `${errores.diasConDato}d`}`;

  const hayAlertaErrores = estadoErrores === "error";

  // ─── LATIDO DE LOS CRONS ───
  // Un cron que no corre no deja rastro: ni log, ni error, ni fila. El 10-ago-2026
  // el reconciliador de cobros no se ejecutó (los deploys a producción reemplazan
  // el registro de crons) y el hueco solo apareció en el post-mortem. Acá se ve.
  const cronsAtrasados = latidos.filter((l) => l.atrasado);
  const latidoMasReciente = latidos.reduce<string | null>(
    (max, l) => (l.ultimaCorrida && (!max || l.ultimaCorrida > max) ? l.ultimaCorrida : max),
    null
  );

  // ─── PASE SEMANAL TOCTOC ───
  // Complementa el latido de CRONS_VIGILADOS (que desde el 04-sep también lo
  // incluye): acá importa QUÉ hizo, no solo si corrió. Se lee del checkpoint
  // que la propia ruta deja en `config`, así que no hay instrumentación nueva.
  const pase = estadoPase(checkpointBackfill);
  const paseBadge: { label: string; tone: StatusBadgeTone } =
    pase.pase === null
      ? { label: "Sin checkpoint", tone: "signal-red" }
      : pase.atrasado
      ? { label: "Atrasado", tone: "signal-red" }
      : pase.estado === "error"
      ? { label: "Con errores", tone: "signal-red" }
      : !pase.completo
      ? { label: "A medias", tone: "ink-700" }
      : pase.estado === "warn"
      ? { label: "Sin desactivar", tone: "ink-700" }
      : { label: "Completo", tone: "ink-400" };

  const pills: Array<{ label: string; value: string; estado: "ok" | "warn" | "error" }> = [
    {
      label: "Base de datos",
      value: `${fmtNumber(analisisCount.count ?? 0)} análisis`,
      estado: analisisCount.error == null ? "ok" : "error",
    },
    {
      label: "Propiedades",
      value: `${fmtNumber(propsActiveCount.count ?? 0)} activas · ${fmtRelative(lastScrapedAt)}`,
      estado: (propsActiveCount.count ?? 0) > 0 ? "ok" : "error",
    },
    {
      label: "UF",
      value: ufRaw && ufRaw > 0 ? `$${fmtNumber(Math.round(ufRaw))} · ${fmtDateShort(ufUpdatedAt)}` : "sin dato",
      estado: ufOk ? "ok" : "error",
    },
    {
      label: "Tasa",
      value: tasaValor ? `${tasaValor}% · ${fmtDateShort(tasaUpdatedAt)}` : "sin dato",
      estado: isStale(tasaUpdatedAt, 24 * 45) ? "error" : "ok",
    },
    {
      // Usuarios de verdad, no filas de user_credits. La pastilla contaba filas
      // de esa tabla y daba 69 mientras el funnel decía 48: hay 14 cuentas
      // antiguas en auth que nunca tuvieron fila en user_credits.
      label: "Usuarios",
      value: `${fmtNumber(overviewReal.registrados)} reales · ${fmtNumber(overviewTotal.registrados)} total`,
      estado: overviewTotal.registrados > 0 ? "ok" : "error",
    },
    {
      label: "Último pago",
      value: lastPaidPayment.data ? fmtRelative(lastPaidPayment.data.created_at as string) : "sin pagos",
      estado: lastPaidPayment.data != null ? "ok" : "warn",
    },
    {
      label: "Cron: Scraping",
      value: fmtRelative(lastScrapedAt),
      estado: isStale(lastScrapedAt, 48) ? "error" : "ok",
    },
    {
      label: "Cron: UF/Tasa",
      value: marketUpdatedAt ? `${fmtDateShort(marketUpdatedAt)} · ${fmtRelative(marketUpdatedAt)}` : "nunca",
      estado: isStale(marketUpdatedAt, 48) ? "error" : "ok",
    },
    {
      label: "Cron: Backfill TocToc",
      value: pase.fecha
        ? `${fmtRelative(pase.fecha)} · ${pase.completo ? "completo" : "a medias"}`
        : "sin checkpoint",
      estado: pase.estado,
    },
    // "Cron: Geocode" se retiró el 03-sep-2026 junto con el botón "Forzar Geocode":
    // ya no hay cron de geocode (ce65743) y la pastilla medía max(scraped_at) con
    // lat no nula, que hoy es cualquier fila del listado. Los huecos de coordenadas
    // se ven por comuna en "Cobertura de datos".
    {
      // Los crons de negocio, en UNA pastilla. Individualizarlos serían cinco
      // pastillas más en una fila que ya scrollea; el bloque de abajo nombra los
      // atrasados cuando los hay, que es cuando importa saber cuál.
      label: `Crons de negocio (${latidos.length})`,
      value:
        cronsAtrasados.length === 0
          ? `al día · ${fmtRelative(latidoMasReciente)}`
          : `${cronsAtrasados.length} sin correr`,
      estado: cronsAtrasados.length === 0 ? "ok" : "error",
    },
    {
      label: "Errores (Sentry)",
      value: valorErrores,
      estado: estadoErrores,
    },
  ];

  const hayAlertaMercado = !ufOk || ufCorrupta || isStale(marketUpdatedAt, 48);

  // ─── COBERTURA ───
  // Agregado EN LA BASE (RPC admin_cobertura_scraped, docs/sql/admin-panel-rpcs.sql
  // §3). La query anterior traía las activas a JS sin `.limit`, y PostgREST corta
  // en 1.000 filas: la tabla sumaba 1.000 propiedades mientras la pastilla de
  // arriba —un count con head:true, que no pasa por ese tope— decía 44.798.
  // Ahora las dos cifras salen del mismo conteo.
  const cov = cobertura.ok ? plegarCobertura(cobertura.rows) : null;
  const diasFila = (ultimo: string | null): number | null => (ultimo ? diasDesde(ultimo) ?? 0 : null);
  // Orden por ANTIGÜEDAD descendente: lo más viejo arriba. Ordenado alfabético,
  // una comuna con 131 días sin actualizar quedaba enterrada en el medio de la
  // tabla y no la veía nadie. Una comuna del roster SIN activas (dias null) va
  // primera: es el caso peor.
  const ordenAntiguedad = (d: number | null) => d ?? Number.MAX_SAFE_INTEGER;
  const covRows = (cov?.roster ?? [])
    .map((r) => ({ ...r, dias: diasFila(r.ultimo) }))
    .sort((a, b) => ordenAntiguedad(b.dias) - ordenAntiguedad(a.dias));
  const covOtras = cov?.otras ? { ...cov.otras, dias: diasFila(cov.otras.ultimo) } : null;
  const covMaxDias = Math.max(...covRows.map((r) => r.dias ?? 0), covOtras?.dias ?? 0, 1);

  /** Celda de antigüedad: barra proporcional + días + "Crítico" desde los 60. */
  const celdaAntiguedad = (dias: number | null) => {
    const critico = dias === null || dias >= 60;
    return (
      <>
        <span
          aria-hidden="true"
          className="mr-2 hidden h-[7px] w-[110px] overflow-hidden rounded-sm bg-[var(--franco-sunken)] align-middle sm:inline-block"
        >
          <span
            className="block h-full"
            style={{
              width: `${dias === null ? 100 : Math.max((dias / covMaxDias) * 100, 2)}%`,
              background: critico ? "var(--signal-red)" : dias >= 14 ? "var(--ink-600)" : "var(--ink-400)",
            }}
          />
        </span>
        <span className="font-mono text-xs" style={{ color: critico ? "var(--signal-red)" : "var(--franco-text)" }}>
          {dias === null ? "sin activas" : dias === 0 ? "hoy" : `${fmtNumber(dias)} d`}
        </span>
        {critico && (
          <span
            className="ml-2 inline-block whitespace-nowrap rounded border px-1.5 py-px font-mono text-[9px] uppercase tracking-wider"
            style={{ color: "var(--signal-red)", borderColor: "rgba(200,50,60,.4)" }}
          >
            Crítico
          </span>
        )}
      </>
    );
  };
  const celdaConteo = (n: number, bold = false) => (
    <span className={`font-mono text-xs ${bold ? "font-bold" : ""}`} style={{ color: n === 0 ? "var(--franco-text-muted)" : "var(--franco-text)" }}>
      {n === 0 ? "—" : fmtNumber(n)}
    </span>
  );

  // ─── ANÁLISIS ───
  const { count: sharedCount } = await sinTest(
    sb.from("analisis").select("*", { count: "exact", head: true }).not("user_id", "is", null)
  );
  const { data: lastPro } = await sinTest(
    sb
      .from("analisis")
      .select("id, comuna, score, created_at")
      .eq("is_premium", true)
      .order("created_at", { ascending: false })
      .limit(5)
  );

  // ─── DOCUMENTOS TRIBUTARIOS ───
  const { data: docsData } = await sinTest(
    sb
      .from("documentos_tributarios")
      .select(
        "id, payment_id, user_id, folio, monto_total, estado, ambiente, autoservicio_url, error_mensaje, created_at, payments(product, analysis_id, quantity, flow_order, commerce_order)"
      )
      .order("created_at", { ascending: false })
      .limit(50)
  );

  // Correos de las boletas. Una sola llamada a la Auth API en vez de una por
  // fila; el tope de 1000 cubre la base actual con margen.
  const emailById = new Map<string, string>();
  if ((docsData ?? []).length) {
    const { data: usersList } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of usersList?.users ?? []) {
      if (u.id && u.email) emailById.set(u.id, u.email);
    }
  }

  const payOf = (d: { payments?: unknown }) =>
    (Array.isArray(d.payments) ? d.payments[0] : d.payments) as
      | { product?: string; analysis_id?: string | null; quantity?: number | null; flow_order?: number | null; commerce_order?: string | null }
      | null
      | undefined;
  const docAnalysisIds = Array.from(
    new Set(
      (docsData ?? [])
        .map((d) => payOf(d)?.analysis_id ?? null)
        .filter((x): x is string => !!x)
    )
  );
  const comunaByAnalysisId = new Map<string, string>();
  if (docAnalysisIds.length) {
    const { data: anRows } = await sb.from("analisis").select("id, comuna").in("id", docAnalysisIds);
    for (const a of (anRows ?? []) as Array<{ id: string; comuna: string | null }>) {
      if (a.comuna) comunaByAnalysisId.set(a.id, a.comuna);
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[var(--franco-text)]">Operación</h1>
          <p className="mt-1 font-mono text-sm text-[var(--franco-text-muted)]">Estado del sistema y datos</p>
        </div>
        <TestToggle
          includeTest={includeTest}
          href={includeTest ? "/admin/operacion" : "/admin/operacion?test=1"}
        />
      </div>

      {/* ─── ESTADO ─── */}
      <section className="mb-8">
        <h2 className="mb-3 font-heading text-lg font-bold text-[var(--franco-text)]">Estado del sistema</h2>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {pills.map((p) => {
            const color =
              p.estado === "error" ? "var(--signal-red)" : p.estado === "warn" ? "var(--ink-600)" : "var(--ink-400)";
            return (
              <div
                key={p.label}
                className="flex shrink-0 items-center gap-2 rounded-lg border bg-[var(--franco-card)] px-3 py-2"
                style={{ borderColor: p.estado === "error" ? "rgba(200,50,60,.4)" : "var(--franco-border)" }}
              >
                <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: color }} />
                <div className="flex flex-col">
                  <span className="font-body text-[10px] uppercase tracking-wide text-[var(--franco-text-muted)]">
                    {p.label}
                  </span>
                  <span
                    className="font-mono text-xs"
                    style={{ color: p.estado === "error" ? "var(--signal-red)" : "var(--franco-text)" }}
                  >
                    {p.value}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Un punto rojo sin explicación no sirve: acá va qué está roto y desde cuándo. */}
        {hayAlertaMercado && (
          <div className="mt-3 rounded-xl border p-4" style={{ borderColor: "rgba(200,50,60,.35)" }}>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--signal-red)]">
              Datos de mercado desactualizados
            </div>
            <p className="font-body text-[13px] leading-relaxed text-[var(--franco-text-secondary)]">
              <b className="font-medium text-[var(--franco-text)]">
                UF y tasa sin actualizarse
                {diasSinActualizar != null && ` hace ${fmtNumber(diasSinActualizar)} días`}.
              </b>{" "}
              La ruta que las escribe (<span className="font-mono text-xs">/api/data/update-market</span>) corre a
              diario a las 10:00 UTC; si figura acá es que no corrió o falló. Se puede forzar con
              &laquo;Actualizar UF/Tasa&raquo; acá abajo.
              {ufCorrupta && (
                <>
                  {" "}
                  <b className="font-medium text-[var(--franco-text)]">Además el valor guardado está fuera de rango</b> (
                  {fmtCLP(ufRaw!)}): lo dejó un parser que borraba el punto decimal. Ya está corregido, pero el valor
                  viejo sigue en la base hasta el próximo refresco.
                </>
              )}{" "}
              Los análisis no usan este valor —toman la UF de mindicador.cl al momento de calcular—, así que no hay
              informes afectados.
            </p>
          </div>
        )}

        {/* Mismo criterio: el punto rojo dice que algo pasa, acá va CUÁL cron y
            desde cuándo. Sin esto, "3 sin correr" no dice a qué mirarle. */}
        {cronsAtrasados.length > 0 && (
          <div className="mt-3 rounded-xl border p-4" style={{ borderColor: "rgba(200,50,60,.35)" }}>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--signal-red)]">
              Crons sin correr
            </div>
            <ul className="mb-2 space-y-1">
              {cronsAtrasados.map((c) => (
                <li key={c.nombre} className="font-body text-[13px] text-[var(--franco-text-secondary)]">
                  <b className="font-medium text-[var(--franco-text)]">{c.label}</b>{" "}
                  <span className="font-mono text-xs">/api/cron/{c.nombre}</span> —{" "}
                  {c.ultimaCorrida
                    ? `última corrida ${fmtRelative(c.ultimaCorrida)} (se espera cada ${c.intervaloHoras}h)`
                    : "sin ninguna corrida registrada"}
                </li>
              ))}
            </ul>
            <p className="font-body text-[13px] leading-relaxed text-[var(--franco-text-secondary)]">
              Un cron que no corre no deja rastro: ni log, ni error, ni fila. La causa más probable es un deploy a
              producción dentro de su ventana de disparo — cada deploy reemplaza el registro de crons, y el 10-ago-2026
              eso dejó al reconciliador de cobros sin ejecutarse en todo el día. Si recién se desplegó el latido, es
              normal que figuren acá hasta que cada uno corra una vez.
            </p>
          </div>
        )}

        {/* Mismo criterio que el bloque de arriba: el punto rojo dice QUE pasa
            algo, este bloque dice qué y adónde ir a mirarlo. */}
        {hayAlertaErrores && (
          <div className="mt-3 rounded-xl border p-4" style={{ borderColor: "rgba(200,50,60,.35)" }}>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--signal-red)]">
              Pico de errores
            </div>
            <p className="font-body text-[13px] leading-relaxed text-[var(--franco-text-secondary)]">
              <b className="font-medium text-[var(--franco-text)]">
                {fmtNumber(errores.ultimoDia!)} errores en las últimas 24 horas
              </b>{" "}
              (umbral: {fmtNumber(ERRORES_UMBRAL_ERROR)}). Con el volumen actual del producto, eso no es ruido de fondo:
              algo se rompió. El detalle —qué falla, en qué ruta y a cuántos usuarios— está en Sentry; acá solo vive el
              conteo.{" "}
              <a
                href={SENTRY_ISSUES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[var(--franco-text)] underline decoration-[var(--franco-border-strong)] underline-offset-2 transition-colors hover:text-[var(--signal-red)]"
              >
                Ver los errores en Sentry →
              </a>
            </p>
          </div>
        )}
      </section>

      {/* ─── ACCIONES ─── */}
      <section className="mb-8">
        <h2 className="mb-3 font-heading text-lg font-bold text-[var(--franco-text)]">Acciones</h2>
        <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
          <AdminActions />
          <p className="mt-3 font-body text-[11px] text-[var(--franco-text-muted)]">
            Ejecutan los endpoints CRON con el secret server-side. Los resultados se aplican inmediatamente a la base de datos.
          </p>
        </div>
      </section>

      {/* ─── COBERTURA ─── */}
      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-[var(--franco-text)]">Cobertura de datos</h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
            {cov
              ? `${fmtNumber(cov.total.total)} activas · ${COMUNAS_ROSTER.length} del roster${
                  covOtras ? ` + ${fmtNumber(covOtras.comunas)} otras` : ""
                } · lo más viejo arriba`
              : "sin datos"}
          </span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
          {!cov ? (
            // La RPC se aplica a mano (docs/sql). Hasta entonces la sección lo
            // dice en vez de pintar una tabla vacía que parezca "cero propiedades".
            <p className="font-body text-[13px] leading-relaxed text-[var(--franco-text-secondary)]">
              {cobertura.ok === false && cobertura.faltaRpc ? (
                <>
                  <b className="font-medium text-[var(--franco-text)]">
                    Falta la función <span className="font-mono text-xs">admin_cobertura_scraped</span> en la base.
                  </b>{" "}
                  Aplicar la sección 3 de <span className="font-mono text-xs">docs/sql/admin-panel-rpcs.sql</span> en
                  el SQL Editor de Supabase; la tabla aparece sola en la siguiente carga.
                </>
              ) : (
                <>
                  <b className="font-medium text-[var(--franco-text)]">No se pudo leer la cobertura.</b>{" "}
                  <span className="font-mono text-xs">{cobertura.ok === false ? cobertura.mensaje : ""}</span>
                </>
              )}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Comuna</th>
                  <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Antigüedad</th>
                  <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Venta usada</th>
                  <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Arriendo</th>
                  <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Obra nueva</th>
                  <th className="pb-2 font-body text-xs font-medium text-[var(--franco-text-muted)]">Sin coords</th>
                </tr>
              </thead>
              <tbody>
                {covRows.map((r) => (
                  <tr key={r.comuna} className="border-b border-[var(--franco-border)] last:border-b-0">
                    <td className="py-2 pr-4 font-body text-xs text-[var(--franco-text)]">{r.comuna}</td>
                    <td className="py-2 pr-4">{celdaAntiguedad(r.dias)}</td>
                    <td className="py-2 pr-4">{celdaConteo(r.ventaUsada)}</td>
                    <td className="py-2 pr-4">{celdaConteo(r.arriendo)}</td>
                    <td className="py-2 pr-4">{celdaConteo(r.obraNueva)}</td>
                    <td className="py-2">{celdaConteo(r.sinCoords)}</td>
                  </tr>
                ))}
                {/* Lo que el viewport trae de fuera del roster, en una fila: no se
                    publica, pero sí se mantiene (Fase C las desactiva igual). */}
                {covOtras && (
                  <tr className="border-b border-[var(--franco-border)]">
                    <td className="py-2 pr-4 font-body text-xs text-[var(--franco-text-muted)]">
                      Otras · {fmtNumber(covOtras.comunas)} comunas
                    </td>
                    <td className="py-2 pr-4">{celdaAntiguedad(covOtras.dias)}</td>
                    <td className="py-2 pr-4">{celdaConteo(covOtras.ventaUsada)}</td>
                    <td className="py-2 pr-4">{celdaConteo(covOtras.arriendo)}</td>
                    <td className="py-2 pr-4">{celdaConteo(covOtras.obraNueva)}</td>
                    <td className="py-2">{celdaConteo(covOtras.sinCoords)}</td>
                  </tr>
                )}
                <tr className="border-t-2 border-[var(--franco-border)]">
                  <td className="py-2 pr-4 font-body text-xs font-bold text-[var(--franco-text)]">TOTAL</td>
                  <td className="py-2 pr-4" />
                  <td className="py-2 pr-4">{celdaConteo(cov.total.ventaUsada, true)}</td>
                  <td className="py-2 pr-4">{celdaConteo(cov.total.arriendo, true)}</td>
                  <td className="py-2 pr-4">{celdaConteo(cov.total.obraNueva, true)}</td>
                  <td className="py-2">{celdaConteo(cov.total.sinCoords, true)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ─── PASE SEMANAL TOCTOC ─── */}
      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-[var(--franco-text)]">Último pase semanal TocToc</h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
            lunes 03:00 UTC · /api/data/backfill-toctoc
          </span>
        </div>
        <div
          className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4"
          style={pase.estado === "error" ? { borderColor: "rgba(200,50,60,.35)" } : undefined}
        >
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <StatusBadge label={paseBadge.label} tone={paseBadge.tone} className="text-[10px]" />
            <span className="font-mono text-xs text-[var(--franco-text-muted)]">{pase.pase ?? "—"}</span>
          </div>

          {pase.pase === null ? (
            <p className="font-body text-[13px] leading-relaxed text-[var(--franco-text-secondary)]">
              <b className="font-medium text-[var(--franco-text)]">No hay checkpoint en la tabla config.</b> El backfill
              nunca corrió con esta versión, o corrió y no pudo escribir su estado. Una corrida deja el checkpoint
              antes de la primera fila, así que si el cron disparó, tiene que estar.
            </p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <div>
                <dt className="font-body text-[10px] uppercase tracking-wide text-[var(--franco-text-muted)]">
                  {pase.completo ? "Terminó" : "Última actualización"}
                </dt>
                <dd
                  className="mt-0.5 font-mono text-sm"
                  style={{ color: pase.atrasado ? "var(--signal-red)" : "var(--franco-text)" }}
                >
                  {fmtDateShort(pase.fecha)}
                  <span className="ml-2 text-xs text-[var(--franco-text-muted)]">{fmtRelative(pase.fecha)}</span>
                </dd>
              </div>
              <div>
                <dt className="font-body text-[10px] uppercase tracking-wide text-[var(--franco-text-muted)]">
                  Filas escritas
                </dt>
                <dd className="mt-0.5 font-mono text-sm text-[var(--franco-text)]">
                  {fmtNumber(pase.filas.total)}
                  <span className="ml-2 text-xs text-[var(--franco-text-muted)]">
                    venta {fmtNumber(pase.filas.venta)} · arriendo {fmtNumber(pase.filas.arriendo)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="font-body text-[10px] uppercase tracking-wide text-[var(--franco-text-muted)]">Nuevas</dt>
                <dd className="mt-0.5 font-mono text-sm text-[var(--franco-text)]">{fmtNumber(pase.nuevas)}</dd>
              </div>
              <div>
                <dt className="font-body text-[10px] uppercase tracking-wide text-[var(--franco-text-muted)]">
                  Desactivadas
                </dt>
                <dd className="mt-0.5 font-mono text-sm text-[var(--franco-text)]">
                  {pase.desactivadas === null ? "—" : fmtNumber(pase.desactivadas)}
                  {pase.forzada && (
                    <span
                      className="ml-2 inline-block whitespace-nowrap rounded border border-[var(--franco-border-strong)] px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-[var(--franco-text-secondary)]"
                      title="Se saltó la salvaguarda de proporción con ?forzarDesactivacion=1"
                    >
                      Forzada
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          )}

          {/* La salvaguarda no es un error del pase: el pase cerró, pero no
              desactivó. Hay que leer el motivo para decidir si se reintenta. */}
          {pase.omitida && (
            <p className="mt-4 font-body text-[13px] leading-relaxed text-[var(--franco-text-secondary)]">
              <b className="font-medium text-[var(--franco-text)]">Desactivación omitida:</b> {pase.omitida}. Se
              reintenta con <span className="font-mono text-xs">?reanudar=1</span> (y{" "}
              <span className="font-mono text-xs">?forzarDesactivacion=1</span> si el pase es confiable).
            </p>
          )}

          {pase.errores.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[var(--signal-red)]">
                {fmtNumber(pase.errores.length)} {pase.errores.length === 1 ? "error" : "errores"} en el pase
              </div>
              <ul className="space-y-0.5">
                {pase.errores.slice(0, 5).map((e, i) => (
                  <li key={i} className="truncate font-mono text-xs text-[var(--franco-text-secondary)]" title={e}>
                    {e}
                  </li>
                ))}
                {pase.errores.length > 5 && (
                  <li className="font-body text-xs text-[var(--franco-text-muted)]">
                    y {fmtNumber(pase.errores.length - 5)} más en el checkpoint.
                  </li>
                )}
              </ul>
            </div>
          )}

          <p className="mt-4 font-body text-[11px] text-[var(--franco-text-muted)]">
            El pase recorre venta usada + arriendo de TocToc y, al cerrar completo y sin errores, desactiva lo que no
            vio (Fase C). Se declara atrasado pasados {DIAS_ATRASO_PASE} días. No está en los crons de negocio: se lee
            del checkpoint que la ruta deja en <span className="font-mono">config</span>.
          </p>
        </div>
      </section>

      {/* ─── ANÁLISIS ─── */}
      <section className="mb-8">
        <h2 className="mb-3 font-heading text-lg font-bold text-[var(--franco-text)]">Análisis</h2>
        <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
          <div className="mb-3">
            <div className="font-mono text-2xl font-bold text-[var(--franco-text)]">{fmtNumber(sharedCount ?? 0)}</div>
            <div className="font-body text-xs text-[var(--franco-text-muted)]">
              análisis con dueño (URL pública accesible)
            </div>
          </div>
          <div className="border-t border-[var(--franco-border)] pt-3">
            <div className="mb-2 font-body text-xs text-[var(--franco-text-muted)]">Últimos análisis Pro generados</div>
            <ul className="space-y-1.5">
              {(lastPro ?? []).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3">
                  <Link
                    href={`/analisis/${a.id}`}
                    className="truncate font-body text-sm text-[var(--franco-text)] hover:text-[#C8323C]"
                  >
                    {a.comuna ?? "—"}
                  </Link>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-xs text-[var(--franco-text)]">Score {a.score}</span>
                    <span className="font-mono text-[10px] text-[var(--franco-text-muted)]">
                      {fmtRelative(a.created_at as string)}
                    </span>
                  </div>
                </li>
              ))}
              {(lastPro ?? []).length === 0 && (
                <li className="font-body text-xs text-[var(--franco-text-muted)]">
                  Sin análisis Pro{includeTest ? "" : " de usuarios reales"} aún.
                </li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* ─── DOCUMENTOS TRIBUTARIOS ─── */}
      <section>
        <h2 className="mb-3 font-heading text-lg font-bold text-[var(--franco-text)]">Documentos tributarios</h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Fecha</th>
                <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Correo</th>
                <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Folio</th>
                <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Concepto</th>
                <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Monto</th>
                <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Estado</th>
                <th className="pb-2 pr-4 font-body text-xs font-medium text-[var(--franco-text-muted)]">Ambiente</th>
                <th className="pb-2 font-body text-xs font-medium text-[var(--franco-text-muted)]">Acción</th>
              </tr>
            </thead>
            <tbody>
              {(docsData ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} className="py-3 font-body text-sm text-[var(--franco-text-muted)]">
                    Sin documentos tributarios{includeTest ? "." : " de usuarios reales."}
                  </td>
                </tr>
              )}
              {(docsData ?? []).map((d) => {
                const estado = d.estado as string;
                const tone: StatusBadgeTone =
                  estado === "emitido"
                    ? "ink-400"
                    : estado === "error"
                    ? "signal-red"
                    : estado === "anulado"
                    ? "ink-500"
                    : "muted";
                const estadoLabel =
                  estado === "emitido"
                    ? "Emitido"
                    : estado === "error"
                    ? "Error"
                    : estado === "anulado"
                    ? "Anulado"
                    : "Pendiente";
                const pay = payOf(d);
                const analysisId = pay?.analysis_id ?? null;
                const flowOrder = pay?.flow_order ?? null;
                const autoservicioUrl = (d.autoservicio_url as string | null) ?? null;
                const conceptoPayment = {
                  id: d.payment_id,
                  user_id: d.user_id,
                  product: pay?.product ?? "single",
                  amount: d.monto_total,
                  commerce_order: pay?.commerce_order ?? "",
                  quantity: pay?.quantity ?? 1,
                } as PaymentForDTE;
                const concepto = conceptoBoleta(
                  conceptoPayment,
                  analysisId ? { comuna: comunaByAnalysisId.get(analysisId) } : undefined
                );
                const ambiente = d.ambiente as string;
                return (
                  <tr key={d.id} className="border-b border-[var(--franco-border)] last:border-b-0">
                    <td className="py-2 pr-4 font-mono text-xs text-[var(--franco-text)]">
                      {fmtDateShort(d.created_at as string)}
                    </td>
                    <td className="max-w-[200px] truncate py-2 pr-4 font-mono text-xs text-[var(--franco-text)]">
                      {emailById.get(d.user_id as string) ?? "—"}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-[var(--franco-text)]">
                      {d.folio ?? "—"}
                      {flowOrder != null && (
                        <div className="mt-0.5 font-mono text-[10px] text-[var(--franco-text-muted)]">
                          Flow {flowOrder}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-4 font-body text-xs text-[var(--franco-text)]">{concepto.label}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-[var(--franco-text)]">
                      {fmtCLP(d.monto_total as number)}
                    </td>
                    <td className="py-2 pr-4">
                      <StatusBadge label={estadoLabel} tone={tone} className="text-[10px]" />
                      {estado === "error" && d.error_mensaje && (
                        <div
                          className="mt-1 max-w-[220px] truncate font-body text-xs text-[var(--franco-text-muted)]"
                          title={d.error_mensaje as string}
                        >
                          {d.error_mensaje as string}
                        </div>
                      )}
                    </td>
                    <td
                      className="py-2 pr-4 font-mono text-[10px] uppercase"
                      style={{ color: ambiente === "dev" ? "var(--ink-700)" : "var(--franco-text-muted)" }}
                    >
                      {ambiente}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-col items-start gap-1">
                        {estado === "emitido" && autoservicioUrl && (
                          <a
                            href={autoservicioUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-body text-xs text-[var(--franco-text-muted)] transition-colors hover:text-[#C8323C]"
                          >
                            Ver boleta →
                          </a>
                        )}
                        {analysisId && (
                          <Link
                            href={`/analisis/${analysisId}`}
                            className="font-body text-xs text-[var(--franco-text-muted)] transition-colors hover:text-[#C8323C]"
                          >
                            Ver análisis →
                          </Link>
                        )}
                        {estado === "error" && <RetryButton documentoId={d.id as string} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
