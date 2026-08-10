import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { resolveDisplayName } from "@/lib/welcome";
import { readVeredicto } from "@/lib/results-helpers";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/StatusBadge";
import { fmtCLP, fmtNumber, fmtRelative, fmtDateShort, fmtPlanLabel } from "@/lib/admin-format";
import { COLUMNAS_USO_IA, fmtUsd, resumirCosto, type UsoIA } from "@/lib/costo-ia";
import { fmtDec } from "@/components/analysis/utils";
import { NotaComposer, NotaCard } from "./notas-client";
import { ReenviarInformeButton, type ReenvioInfo } from "./reenviar-informe-client";
import { OtorgarAnalisisForm, RevertirGrantButton } from "./grants-client";
import { UnlimitedToggle, type UnlimitedEstado } from "./unlimited-client";
import { hasSubscriptionAccess } from "@/lib/access";
import { leerAtribucion, fmtFuente } from "@/lib/attribution";
import { leerComision } from "@/lib/comision-flow";

export const dynamic = "force-dynamic";

// Iniciales para el avatar (hasta 2 palabras del nombre resuelto).
function initials(name: string, email: string): string {
  const base = name.trim() || email.trim();
  if (!base) return "?";
  const words = base.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

// Veredicto → tono Franco. BUSCAR OTRA es el único en Signal Red (criticidad);
// COMPRAR y AJUSTA SUPUESTOS van en Ink (regla del rojo de franco-design-system).
function veredictoTone(v: string): StatusBadgeTone {
  if (v === "BUSCAR OTRA") return "signal-red";
  if (v === "AJUSTA SUPUESTOS") return "ink-500";
  return "ink-400"; // COMPRAR
}

/** Fila de la card de origen. Se omite sola cuando el campo viene vacío. */
function CampoOrigen({ label, valor }: { label: string; valor: string | null | undefined }) {
  if (!valor) return null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 font-body text-xs text-[var(--franco-text-muted)]">{label}</dt>
      <dd className="break-all text-right font-mono text-xs text-[var(--franco-text)]">{valor}</dd>
    </div>
  );
}

/** "_fbp + _fbc" / "solo _fbp" / null. El valor crudo no se muestra: es un id
 *  largo e ilegible; lo accionable es si Meta puede matchear a esta persona. */
function cookiesMetaLabel(a: { fbp?: string | null; fbc?: string | null }): string | null {
  if (a.fbp && a.fbc) return "_fbp + _fbc";
  if (a.fbp) return "solo _fbp";
  if (a.fbc) return "solo _fbc";
  return null;
}

type TimelineEvent = {
  key: string;
  // Orden cronológico inverso. ms = epoch de la fecha del evento (null → al final).
  ms: number | null;
  node: React.ReactNode;
};

export default async function AdminUsuarioDetallePage({
  params,
}: {
  params: { id: string };
}) {
  // ─── Gate compartido: autentica con el anon client y SOLO entonces entrega
  // el client de service role (ver src/lib/admin-auth.ts). Mismos redirects que
  // el gate inline que reemplaza: sin sesión → /login, sin allowlist → /dashboard.
  const { sb } = await requireAdminPage();
  const userId = params.id;

  // ─── Resolver el usuario por id ───
  const { data: userRes, error: userErr } = await sb.auth.admin.getUserById(userId);
  const targetUser = userRes?.user ?? null;
  if (userErr || !targetUser) notFound();

  const email = targetUser.email ?? "";
  const nombre = resolveDisplayName(targetUser.user_metadata, email);
  const phone = targetUser.phone || (targetUser.user_metadata?.phone as string | undefined) || "";

  // ─── Datos del usuario (todo para UN solo user) ───
  const nowIso = new Date().toISOString();
  const [
    creditsRes,
    liveGrantsRes,
    welcomeGrantRes,
    analisisRes,
    paymentsRes,
    docsRes,
    notasRes,
    auditRes,
    atribucion,
  ] = await Promise.all([
    sb
      .from("user_credits")
      .select("credits, is_unlimited, unlimited_source, subscription_status, active_plan, subscription_ends_at, grace_ends_at")
      .eq("user_id", userId)
      .maybeSingle(),
    // Lotes vivos: mismo criterio que getAvailableCredits/consumeCredit.
    // id/amount se suman para los lotes manuales: el desglose los lista uno por
    // uno (quién los otorgó y por qué) y la reversión necesita el id del lote.
    sb
      .from("credit_grants")
      .select("id, source, amount, remaining, granted_at")
      .eq("user_id", userId)
      .gt("remaining", 0)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`),
    // Grant de bienvenida (vivo o consumido) para el evento de timeline.
    sb
      .from("credit_grants")
      .select("granted_at")
      .eq("user_id", userId)
      .eq("source", "welcome")
      .order("granted_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    sb
      .from("analisis")
      .select(
        "id, comuna, tipo, dormitorios, banos, superficie, precio, arriendo, tipo_analisis, pending_payment, is_premium, results, created_at, ambas_group_id, " +
          COLUMNAS_USO_IA
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    sb
      .from("payments")
      .select("id, amount, product, status, flow_order, created_at, payment_data, commerce_order")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    sb
      .from("documentos_tributarios")
      .select("id, estado, folio, error_mensaje, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    // Notas internas VIVAS (deleted_at IS NULL): una nota borrada desaparece del
    // timeline pero sigue en la tabla (soft delete) y en admin_audit_log.
    sb
      .from("admin_notas")
      .select("id, texto, autor_email, created_at, updated_at")
      .eq("target_user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    // Acciones de escritura EXITOSAS sobre este usuario, en una sola query:
    //  - resend_report: única memoria de "este correo ya se mandó" (la acción no
    //    tiene idempotencia, así que sin esto es imposible saberlo).
    //  - grant_credits: quién otorgó cada lote manual y por qué.
    //  - toggle_unlimited: quién encendió el ilimitado a mano y por qué.
    // Solo result='ok' — un intento fallido no movió nada.
    sb
      .from("admin_audit_log")
      .select("action, target_id, admin_email, created_at, meta")
      .in("action", ["resend_report", "grant_credits", "toggle_unlimited"])
      .eq("target_user_id", userId)
      .eq("result", "ok")
      .order("created_at", { ascending: false }),
    // De dónde vino este usuario. Devuelve null si no tiene fila — que es el caso
    // de todos los que se registraron antes de que esto existiera, y también del
    // tráfico directo sin cookies de Meta.
    leerAtribucion(sb, userId),
  ]);

  const credits = creditsRes.data ?? null;
  const isUnlimited = credits?.is_unlimited ?? false;
  const subStatus = credits?.subscription_status ?? "none";
  const activePlan = credits?.active_plan ?? null;
  const legacyCredits = credits?.credits ?? 0;

  // ─── Saldo del ledger + desglose por source ───
  const liveGrants = (liveGrantsRes.data ?? []) as Array<{
    id: string; source: string; amount: number | null; remaining: number | null; granted_at: string;
  }>;
  const ledgerSaldo = liveGrants.reduce((s, g) => s + (g.remaining ?? 0), 0);
  const saldoTotal = ledgerSaldo + legacyCredits;
  const porSource = new Map<string, number>();
  for (const g of liveGrants) {
    porSource.set(g.source, (porSource.get(g.source) ?? 0) + (g.remaining ?? 0));
  }
  const desglose = Array.from(porSource.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  // Lotes MANUALES vivos, uno por uno: son los únicos con procedencia humana que
  // hay que poder auditar de un vistazo (y revertir). Un lote revertido queda en
  // remaining=0, así que sale solo de esta lista — su rastro vive en el audit log.
  const lotesManuales = liveGrants.filter((g) => g.source === "admin_grant");

  // ─── Badge de estado derivado (jerarquía mayor) ───
  const payments = (paymentsRes.data ?? []) as Array<{
    id: string; amount: number | null; product: string | null; status: string | null;
    flow_order: number | null; created_at: string;
    payment_data: unknown; commerce_order: string | null;
  }>;
  const tienePagoPaid = payments.some((p) => p.status === "paid");
  const estadoBadge: { label: string; tone: StatusBadgeTone } = isUnlimited
    ? { label: "Ilimitado", tone: "ink-400" }
    : subStatus === "active"
    ? { label: activePlan ? fmtPlanLabel(activePlan) : "Suscriptor", tone: "ink-400" }
    : tienePagoPaid
    ? { label: "Pagador", tone: "ink-700" }
    : { label: "Gratis", tone: "muted" };

  // ─── Timeline: fusión de 5 fuentes ordenada por fecha desc ───
  // El doble cast es por el select armado con concatenación (para reusar
  // COLUMNAS_USO_IA): Supabase infiere los tipos del literal de columnas y con
  // una expresión no puede, así que devuelve GenericStringError[].
  const analisis = (analisisRes.data ?? []) as unknown as Array<{
    id: string; comuna: string | null; tipo: string | null; dormitorios: number | null;
    banos: number | null; superficie: number | null; precio: number | null; arriendo: number | null;
    tipo_analisis: string | null; pending_payment: boolean | null; is_premium: boolean | null;
    results: { veredicto?: string; francoVerdict?: string; engineSignal?: string } | null;
    created_at: string; ambas_group_id: string | null;
  }> & UsoIA[];

  // Costo de IA acumulado del usuario. Sale de las filas que ya trajimos —sin
  // query extra— y separa medido de no medido: los análisis anteriores a la
  // instrumentación tienen los ai_* en NULL y no son "gratis", son "sin dato".
  const costoIaUsuario = resumirCosto(analisis);
  const docs = (docsRes.data ?? []) as Array<{
    id: string; estado: string; folio: number | null; error_mensaje: string | null; created_at: string;
  }>;

  const toMs = (d: string | null | undefined) => (d ? new Date(d).getTime() : null);
  const events: TimelineEvent[] = [];

  // ─── Audit log: memoria de las acciones de escritura sobre este usuario ───
  // Una sola query trae reenvíos y otorgamientos; acá se parten por acción. Viene
  // ordenada desc, así que el primer hit de cada target_id es el más reciente.
  if (auditRes.error) {
    console.error("[admin/usuarios/[id]] admin_audit_log query error:", auditRes.error);
  }
  const auditRows = (auditRes.data ?? []) as Array<{
    action: string; target_id: string | null; admin_email: string; created_at: string;
    meta: { motivo?: string; reversion?: boolean; activar?: boolean } | null;
  }>;

  // Reenvíos OK por análisis ("el correo ya salió").
  const ultimoReenvioPorAnalisis = new Map<string, ReenvioInfo>();
  for (const r of auditRows) {
    if (r.action !== "resend_report") continue;
    if (!r.target_id || ultimoReenvioPorAnalisis.has(r.target_id)) continue;
    ultimoReenvioPorAnalisis.set(r.target_id, {
      fechaLabel: `${fmtDateShort(r.created_at)} · ${fmtRelative(r.created_at)}`,
      adminEmail: r.admin_email,
    });
  }

  // Quién otorgó cada lote manual y por qué. Se excluyen las reversiones: apuntan
  // al mismo target_id y pisarían el motivo del otorgamiento original.
  const otorgamientoPorGrant = new Map<
    string,
    { adminEmail: string; motivo: string | null; fechaLabel: string }
  >();
  for (const r of auditRows) {
    if (r.action !== "grant_credits" || r.meta?.reversion === true) continue;
    if (!r.target_id || otorgamientoPorGrant.has(r.target_id)) continue;
    otorgamientoPorGrant.set(r.target_id, {
      adminEmail: r.admin_email,
      motivo: r.meta?.motivo ?? null,
      fechaLabel: `${fmtDateShort(r.created_at)} · ${fmtRelative(r.created_at)}`,
    });
  }

  // Último ENCENDIDO manual del ilimitado (meta.activar === true): es lo que
  // explica por qué este usuario tiene acceso sin tope. Los apagados no
  // interesan acá — si está apagado, no hay estado que justificar.
  const ultimoEncendidoUnlimited = auditRows.find(
    (r) => r.action === "toggle_unlimited" && r.meta?.activar === true
  );

  // Estado del ilimitado con su ORIGEN. El flag solo no distingue "lo paga" de
  // "se lo regalamos", que son dos cosas con consecuencias opuestas.
  const unlimitedEstado: UnlimitedEstado = {
    isUnlimited,
    source: credits?.unlimited_source ?? null,
    motivo: ultimoEncendidoUnlimited?.meta?.motivo ?? null,
    porQuien: ultimoEncendidoUnlimited
      ? `${ultimoEncendidoUnlimited.admin_email} · ${fmtDateShort(ultimoEncendidoUnlimited.created_at)}`
      : null,
    // Mismo criterio que el server (hasSubscriptionAccess): activa, en gracia
    // vigente, o cancelada dentro del ciclo ya pagado.
    suscripcionVigente: hasSubscriptionAccess({
      subscription_status: subStatus,
      grace_ends_at: credits?.grace_ends_at ?? null,
      subscription_ends_at: credits?.subscription_ends_at ?? null,
    }),
  };

  /**
   * Por qué NO se puede reenviar el informe de esta fila (null = se puede).
   * Espeja los guards del route handler, que los revalida igual — acá es para no
   * hacerle perder el clic al operador y explicarle el motivo en el tooltip.
   */
  function motivoBloqueoReenvio(a: (typeof analisis)[number]): string | null {
    if (a.pending_payment === true) {
      return "Pendiente de pago: se computó pero no se cobró. Reenviar anunciaría un informe que el usuario no compró.";
    }
    if (a.is_premium !== true) {
      return "Sin desbloquear (is_premium=false): el correo llevaría a un informe recortado.";
    }
    // tipo_analisis null = LTR legacy (mismo criterio que la etiqueta de arriba).
    if (a.tipo_analisis === "short-term") {
      return a.ambas_group_id
        ? "Lado STR de un par AMBAS: el correo de la comparativa se reenvía desde la fila LTR del par."
        : "No hay plantilla de correo para un análisis STR suelto.";
    }
    return null;
  }

  // a) ANÁLISIS
  for (const a of analisis) {
    const ufM2 = a.superficie && a.superficie > 0 && a.precio ? a.precio / a.superficie : null;
    const modalidad = a.tipo_analisis === "short-term" ? "STR" : "LTR";
    const href = a.tipo_analisis === "short-term" ? `/analisis/renta-corta/${a.id}` : `/analisis/${a.id}`;
    const veredicto = readVeredicto(a.results);
    const pending = a.pending_payment === true;
    events.push({
      key: `an-${a.id}`,
      ms: toMs(a.created_at),
      node: (
        <article
          className={`rounded-lg border p-3 ${
            pending ? "border-[var(--signal-red)]" : "border-[var(--franco-border)]"
          } bg-[var(--franco-card)]`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-body text-sm font-medium text-[var(--franco-text)]">
                Análisis · {a.comuna ?? "—"}
                <span className="font-mono text-[10px] text-[var(--franco-text-muted)] ml-2">{modalidad}</span>
              </div>
              <div className="font-mono text-[11px] text-[var(--franco-text-muted)] mt-1">
                {[a.tipo, a.dormitorios != null ? `${a.dormitorios}D` : null, a.banos != null ? `${a.banos}B` : null]
                  .filter(Boolean)
                  .join(" · ") || "—"}
                {ufM2 != null && <> · {fmtDec(ufM2, 1)} UF/m²</>}
                {a.arriendo != null && a.arriendo > 0 && <> · arriendo {fmtCLP(a.arriendo)}</>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {veredicto && (
                <StatusBadge label={veredicto} tone={veredictoTone(veredicto)} className="text-[10px]" />
              )}
              {pending && (
                <StatusBadge label="Pago no asociado" tone="signal-red" className="text-[10px]" />
              )}
            </div>
          </div>
          <div className="flex items-end justify-between gap-3 mt-2">
            <span className="font-mono text-[10px] text-[var(--franco-text-muted)]">
              {fmtDateShort(a.created_at)} · {fmtRelative(a.created_at)}
            </span>
            <div className="flex flex-col items-end gap-1.5">
              <Link
                href={href}
                className="font-body text-xs text-[var(--franco-text-muted)] hover:text-[#C8323C] transition-colors"
              >
                Ver informe →
              </Link>
              <ReenviarInformeButton
                analisisId={a.id}
                targetEmail={email || userId}
                motivoBloqueo={motivoBloqueoReenvio(a)}
                ultimoReenvio={ultimoReenvioPorAnalisis.get(a.id) ?? null}
              />
            </div>
          </div>
        </article>
      ),
    });
  }

  // b) PAGOS
  for (const p of payments) {
    const statusLabel =
      p.status === "paid" ? "pagado" : p.status === "rejected" ? "rechazado" : p.status === "cancelled" ? "cancelado" : "pendiente";
    // La comisión solo tiene sentido sobre un cobro efectivo. `leerComision`
    // marca su propia procedencia: medido (bloque de Flow), estimado (tasa de
    // respaldo) o sin-cobro (alta de suscripción, ver comision-flow.ts). Se
    // muestra la etiqueta SIEMPRE, para no pasar un estimado por un dato.
    const comision = p.status === "paid" ? leerComision(p) : null;
    events.push({
      key: `pay-${p.id}`,
      ms: toMs(p.created_at),
      node: (
        <article className="rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="font-body text-sm text-[var(--franco-text)]">Pago · {statusLabel}</div>
            <span className="font-mono text-xs text-[var(--franco-text)] shrink-0">
              {p.amount != null ? fmtCLP(p.amount) : "—"}
            </span>
          </div>
          <div className="font-mono text-[11px] text-[var(--franco-text-muted)] mt-1">
            {[p.product, p.flow_order != null ? `Flow ${p.flow_order}` : null].filter(Boolean).join(" · ") || "—"}
          </div>
          {comision && (
            <div className="mt-2 border-t border-dashed border-[var(--franco-border)] pt-2">
              {comision.fuente === "sin-cobro" ? (
                <div className="font-mono text-[10px] text-[var(--franco-text-muted)]">
                  ALTA DE SUSCRIPCIÓN · SIN COBRO PROPIO
                  <span className="ml-1 font-body normal-case">
                    — el cobro y su comisión van en su propia fila
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex items-baseline justify-between gap-3 font-mono text-[11px]">
                    <span className="text-[var(--franco-text-muted)]">
                      Comisión Flow{comision.medio ? ` · ${comision.medio}` : ""}
                    </span>
                    <span className="shrink-0 text-[var(--franco-text-secondary)]">
                      −{fmtCLP(comision.retenido)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-baseline justify-between gap-3 font-mono text-[11px]">
                    <span className="text-[var(--franco-text-muted)]">Neto depositado</span>
                    <span className="shrink-0 text-[var(--franco-text)]">{fmtCLP(comision.neto)}</span>
                  </div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
                    {comision.fuente === "medido"
                      ? `Medido · ${fmtCLP(comision.fee)} + IVA ${fmtCLP(comision.iva)}`
                      : "Estimado · la fila no trae el desglose de Flow"}
                  </div>
                </>
              )}
            </div>
          )}
          <div className="font-mono text-[10px] text-[var(--franco-text-muted)] mt-2">
            {fmtDateShort(p.created_at)} · {fmtRelative(p.created_at)}
          </div>
        </article>
      ),
    });
  }

  // c) BOLETAS
  for (const d of docs) {
    const esError = d.estado === "error";
    events.push({
      key: `doc-${d.id}`,
      ms: toMs(d.created_at),
      node: (
        <article
          className={`rounded-lg border p-3 ${
            esError ? "border-[var(--signal-red)]" : "border-[var(--franco-border)]"
          } bg-[var(--franco-card)]`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="font-body text-sm text-[var(--franco-text)]">
              Boleta · {d.estado}
              {d.folio != null && (
                <span className="font-mono text-[11px] text-[var(--franco-text-muted)] ml-2">Folio {d.folio}</span>
              )}
            </div>
            {esError && <StatusBadge label="Error" tone="signal-red" className="text-[10px]" />}
          </div>
          {esError && d.error_mensaje && (
            <div className="font-body text-xs text-[var(--signal-red)] mt-1">{d.error_mensaje}</div>
          )}
          <div className="font-mono text-[10px] text-[var(--franco-text-muted)] mt-2">
            {fmtDateShort(d.created_at)} · {fmtRelative(d.created_at)}
          </div>
        </article>
      ),
    });
  }

  // d) BIENVENIDA
  const welcomeAt = welcomeGrantRes.data?.granted_at as string | undefined;
  if (welcomeAt) {
    events.push({
      key: "welcome",
      ms: toMs(welcomeAt),
      node: (
        <article className="rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] p-3">
          <div className="font-body text-sm text-[var(--franco-text)]">Cuenta creada · análisis de bienvenida</div>
          <div className="font-mono text-[10px] text-[var(--franco-text-muted)] mt-2">
            {fmtDateShort(welcomeAt)} · {fmtRelative(welcomeAt)}
          </div>
        </article>
      ),
    });
  }

  // e) NOTAS INTERNAS (quinta fuente del timeline). Si la migración
  // 20260729_admin_audit_log_y_notas.sql todavía no se aplicó, la query falla y
  // `data` viene null → el timeline sigue funcionando sin notas (degradación
  // suave, mismo criterio que getAvailableCredits).
  if (notasRes.error) {
    console.error("[admin/usuarios/[id]] admin_notas query error:", notasRes.error);
  }
  const notas = (notasRes.data ?? []) as Array<{
    id: string; texto: string; autor_email: string; created_at: string; updated_at: string;
  }>;
  for (const n of notas) {
    // "editada" con tolerancia de 1s: al crear, created_at y updated_at salen del
    // mismo now() y son iguales — el margen evita marcar como editada una nota nueva.
    const editada =
      new Date(n.updated_at).getTime() - new Date(n.created_at).getTime() > 1000;
    events.push({
      key: `nota-${n.id}`,
      ms: toMs(n.created_at),
      node: (
        <NotaCard
          nota={{
            id: n.id,
            texto: n.texto,
            autorEmail: n.autor_email,
            fechaLabel: `${fmtDateShort(n.created_at)} · ${fmtRelative(n.created_at)}`,
            editada,
          }}
        />
      ),
    });
  }

  // Orden cronológico inverso (sin fecha → al final).
  events.sort((a, b) => {
    if (a.ms == null) return 1;
    if (b.ms == null) return -1;
    return b.ms - a.ms;
  });

  const sourceLabel = (s: string): string => {
    if (s === "welcome") return "Bienvenida";
    if (s === "single") return "Compra individual";
    if (s === "admin_grant") return "Otorgado por admin";
    if (s.startsWith("plan10")) return "Plan 10";
    if (s.startsWith("plan50")) return "Plan 50";
    return s;
  };

  return (
    <>
      {/* El chrome (fondo, ancho máximo y padding) lo pone src/app/admin/layout.tsx. */}
      <div>
        {/* ← Usuarios */}
        <div className="mb-6">
          <Link
            href="/admin/usuarios"
            className="text-sm text-[var(--franco-text-muted)] hover:text-[var(--franco-text)] font-body"
          >
            ← Usuarios
          </Link>
        </div>

        {/* ─── HEADER IDENTIDAD ─── */}
        <header className="mb-8 flex flex-wrap items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[var(--franco-border)] bg-[var(--franco-card)] font-mono text-lg font-bold text-[var(--franco-text)]">
            {initials(nombre, email)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl font-bold text-[var(--franco-text)]">{nombre || "—"}</h1>
              <StatusBadge label={estadoBadge.label} tone={estadoBadge.tone} />
            </div>
            <p className="font-mono text-sm text-[var(--franco-text)] mt-1 break-all">{email || "—"}</p>
            <p className="font-mono text-[11px] text-[var(--franco-text-muted)] mt-2">
              Registró {fmtDateShort(targetUser.created_at)}
              {" · "}Último acceso {fmtRelative(targetUser.last_sign_in_at)}
              {phone && <> · {phone}</>}
              {" · "}ID {userId.slice(0, 8)}…
            </p>
          </div>
        </header>

        {/* ─── GRID: timeline (62%) + sidebar (38%) ─── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.62fr_1fr]">
          {/* TIMELINE */}
          <section className="order-1">
            <h2 className="font-heading text-lg font-bold mb-3 text-[var(--franco-text)]">Timeline</h2>
            {/* Alta de nota: la nota queda como evento del timeline (fuente e). */}
            <NotaComposer targetUserId={userId} />
            {events.length === 0 ? (
              <div className="rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] p-4 font-body text-sm text-[var(--franco-text-muted)]">
                Sin actividad registrada.
              </div>
            ) : (
              <div className="space-y-2.5">{events.map((e) => <div key={e.key}>{e.node}</div>)}</div>
            )}
          </section>

          {/* SIDEBAR */}
          <aside className="order-2 space-y-6">
            {/* Card COSTO IA — lo que este usuario costó en tokens de Anthropic.
                Se calcula al leer desde las columnas ai_* (ver costo-ia.ts); el
                USD es la cifra exacta (es la moneda en que Anthropic factura) y
                el CLP es orientativo, con el dólar de la constante. */}
            <div className="rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
              <div className="font-body text-xs text-[var(--franco-text-muted)] mb-1">Costo de IA acumulado</div>
              {costoIaUsuario.medidos > 0 ? (
                <>
                  <div className="font-mono text-3xl font-bold text-[var(--franco-text)]">
                    {fmtUsd(costoIaUsuario.totalUsd)}
                  </div>
                  <div className="font-mono text-[10px] text-[var(--franco-text-muted)] mt-1">
                    ≈ {fmtCLP(Math.round(costoIaUsuario.totalClp))} · {fmtUsd(costoIaUsuario.promedioUsd ?? 0)} por análisis
                  </div>
                  <div className="font-mono text-[10px] text-[var(--franco-text-muted)] mt-1">
                    {fmtNumber(costoIaUsuario.medidos)} medido{costoIaUsuario.medidos === 1 ? "" : "s"}
                    {costoIaUsuario.sinMedir > 0 && (
                      <> · {fmtNumber(costoIaUsuario.sinMedir)} sin medir</>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-mono text-lg text-[var(--franco-text-muted)]">sin datos</div>
                  <div className="font-mono text-[10px] text-[var(--franco-text-muted)] mt-1">
                    {analisis.length > 0
                      ? `sus ${analisis.length} análisis son anteriores a la medición de tokens`
                      : "todavía no generó análisis"}
                  </div>
                </>
              )}
            </div>

            {/* Card SALDO */}
            <div className="rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
              <div className="font-body text-xs text-[var(--franco-text-muted)] mb-1">Saldo de análisis</div>
              {isUnlimited ? (
                <StatusBadge label="Ilimitado" tone="ink-400" />
              ) : (
                <div className="font-mono text-3xl font-bold text-[var(--franco-text)]">{fmtNumber(saldoTotal)}</div>
              )}
              <div className="font-mono text-[10px] text-[var(--franco-text-muted)] mt-1">credit_grants</div>
              {desglose.length > 0 && (
                <div className="border-t border-[var(--franco-border)] mt-3 pt-3 space-y-1.5">
                  {desglose.map(([source, remaining]) => (
                    <div key={source} className="flex items-center justify-between gap-3">
                      <span className="font-body text-xs text-[var(--franco-text)]">{sourceLabel(source)}</span>
                      <span className="font-mono text-xs text-[var(--franco-text)]">{fmtNumber(remaining)}</span>
                    </div>
                  ))}
                </div>
              )}
              {legacyCredits > 0 && (
                <div className="flex items-center justify-between gap-3 mt-1.5">
                  <span className="font-body text-xs text-[var(--franco-text-muted)]">Créditos legacy</span>
                  <span className="font-mono text-xs text-[var(--franco-text-muted)]">{fmtNumber(legacyCredits)}</span>
                </div>
              )}

              {/* Lotes MANUALES, uno por uno: quién y por qué. El resto de los
                  sources se queda en el agregado de arriba — solo lo regalado
                  necesita procedencia humana. Revertir aparece solo si el lote
                  está INTACTO (remaining == amount); el server lo revalida. */}
              {lotesManuales.length > 0 && (
                <div className="border-t border-[var(--franco-border)] mt-3 pt-3 space-y-2.5">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-muted)]">
                    Lotes otorgados
                  </div>
                  {lotesManuales.map((g) => {
                    const info = otorgamientoPorGrant.get(g.id);
                    const intacto = g.amount != null && g.remaining === g.amount;
                    return (
                      <div key={g.id} className="rounded-md border border-[var(--franco-border)] p-2">
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-mono text-xs text-[var(--franco-text)]">
                            {fmtNumber(g.remaining ?? 0)}
                            {g.amount != null && g.remaining !== g.amount && (
                              <span className="text-[var(--franco-text-muted)]"> de {fmtNumber(g.amount)}</span>
                            )}
                          </span>
                          {intacto && (
                            <RevertirGrantButton grantId={g.id} cantidad={g.amount ?? 0} />
                          )}
                        </div>
                        {info?.motivo && (
                          <p className="font-body text-xs text-[var(--franco-text)] mt-1">{info.motivo}</p>
                        )}
                        <div className="font-mono text-[10px] text-[var(--franco-text-muted)] mt-1">
                          {info
                            ? `${info.adminEmail} · ${info.fechaLabel}`
                            : `sin registro en el audit log · ${fmtDateShort(g.granted_at)}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Alta de lote manual */}
              <OtorgarAnalisisForm targetUserId={userId} targetEmail={email || userId} />

              {/* Toggle de ilimitado: va en la card de saldo porque es la otra
                  palanca sobre lo mismo — cuánto puede analizar el usuario. */}
              <UnlimitedToggle
                targetUserId={userId}
                targetEmail={email || userId}
                estado={unlimitedEstado}
              />
            </div>

            {/* Card SUSCRIPCIÓN */}
            {subStatus !== "none" && (
              <div className="rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
                <div className="font-body text-xs text-[var(--franco-text-muted)] mb-2">Suscripción</div>
                <dl className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="font-body text-xs text-[var(--franco-text-muted)]">Plan</dt>
                    <dd className="font-mono text-xs text-[var(--franco-text)]">{activePlan ?? "—"}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="font-body text-xs text-[var(--franco-text-muted)]">Estado</dt>
                    <dd className="font-mono text-xs text-[var(--franco-text)]">{subStatus}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="font-body text-xs text-[var(--franco-text-muted)]">Vence</dt>
                    <dd className="font-mono text-xs text-[var(--franco-text)]">
                      {fmtDateShort(credits?.subscription_ends_at)}
                    </dd>
                  </div>
                  {subStatus === "past_due" && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="font-body text-xs text-[var(--signal-red)]">Gracia hasta</dt>
                      <dd className="font-mono text-xs text-[var(--signal-red)]">
                        {fmtDateShort(credits?.grace_ends_at)}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Card ORIGEN — de dónde vino este usuario.
                Siempre visible, incluso sin datos: "no sabemos de dónde vino"
                también es información, y esconder la card haría creer que el
                dato no existe en el producto. */}
            <div className="rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
              <div className="mb-2 font-body text-xs text-[var(--franco-text-muted)]">Origen</div>
              {atribucion ? (
                <>
                  <div className="font-mono text-sm text-[var(--franco-text)]">
                    {fmtFuente(atribucion)}
                  </div>
                  <dl className="mt-3 space-y-1.5 border-t border-[var(--franco-border)] pt-3">
                    <CampoOrigen label="Campaña" valor={atribucion.utm_campaign} />
                    <CampoOrigen label="Contenido" valor={atribucion.utm_content} />
                    <CampoOrigen label="Término" valor={atribucion.utm_term} />
                    <CampoOrigen label="Entró por" valor={atribucion.landing_path} />
                    <CampoOrigen label="Vino de" valor={atribucion.referrer} />
                    {/* Las cookies del pixel no se muestran enteras: son un
                        identificador largo y no se leen a ojo. Sí importa saber
                        si Meta puede matchear a esta persona. */}
                    <CampoOrigen label="Cookies Meta" valor={cookiesMetaLabel(atribucion)} />
                    <CampoOrigen label="Registrado" valor={fmtDateShort(atribucion.created_at)} />
                  </dl>
                </>
              ) : (
                <p className="font-body text-xs leading-relaxed text-[var(--franco-text-muted)]">
                  Sin datos de origen. Las cuentas creadas antes de que se
                  registrara la atribución no se pueden reconstruir.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
