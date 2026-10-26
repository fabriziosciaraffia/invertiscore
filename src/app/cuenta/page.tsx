import { redirect } from "next/navigation";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { AppFooter } from "@/components/chrome/AppFooter";
import { fechaCortaCL } from "@/lib/fecha-cl";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hasSubscriptionAccess } from "@/lib/access";
import { estadoSaldo, leerSaldo } from "@/lib/casa-saldo";
import { leerPerfilBusqueda } from "@/lib/perfil-busqueda-servidor";
import { textoVence } from "@/lib/guia/semanal";
import { fmtCLP } from "@/lib/pricing";
import { PLANES_COPY, nombrePlan } from "@/lib/planes";
import { CASA } from "@/app/dashboard/casa-copy";
import { PerfilBusquedaCasa } from "@/app/dashboard/casa";
import { CancelSubscriptionButton } from "./cancel-dialog";
import { DeleteAccountButton } from "./delete-account-button";
import { CorreosCuenta } from "./correos-cuenta";
import { CUENTA_COPY, etiquetaCompra } from "./cuenta-copy";

// ─────────────────────────────────────────────────────────────────────────────
// /cuenta (19-oct-2026, decisión de Fabrizio): plana y clara, en el sistema de la casa —Inter, serif solo en el título,
// secciones planas separadas por una línea fina, sin tarjetas—: el correo; el plan o el saldo, con las compras; el perfil
// de búsqueda (el mismo editable del dashboard); cómo entras; y darte de baja (los correos, y eliminar la cuenta).
// El plan de 50 y el ilimitado ya no se venden, pero quien los tiene los sigue viendo con su nombre (planes.ts).
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

const UI = "var(--font-ui), Inter, 'Helvetica Neue', Arial, sans-serif";
const fecha = (d: string | null | undefined) => (d ? fechaCortaCL(d, { month: "long" }) || "—" : "—");
const enlace = "text-[14px] text-[var(--franco-text)] underline underline-offset-4";

export default async function CuentaPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent("/cuenta")}`);

  const admin = createServiceClient();
  const [{ data: fila }, datosSaldo, pp, { data: compras }] = await Promise.all([
    supabase.from("user_credits").select("subscription_status, subscription_ends_at, grace_ends_at, is_unlimited, active_plan").eq("user_id", user.id).maybeSingle(),
    leerSaldo(admin, user.id),
    leerPerfilBusqueda(admin, user.id),
    supabase.from("payments").select("id, product, amount, created_at").eq("user_id", user.id).eq("status", "paid").gt("amount", 0).order("created_at", { ascending: false }).limit(6),
  ]);
  const saldo = estadoSaldo(datosSaldo);

  // El plan: vigente, cancelado con el período pagado aún en curso, o con el cobro pendiente dentro de la gracia.
  const estado = (fila?.subscription_status as string | null) ?? "none";
  const finDelPeriodo = (fila?.subscription_ends_at as string | null) ?? null;
  const finDeGracia = (fila?.grace_ends_at as string | null) ?? null;
  const ilimitado = fila?.is_unlimited === true;
  const activo = estado === "active";
  const cancelado = estado === "cancelled" && hasSubscriptionAccess({ subscription_status: estado, subscription_ends_at: finDelPeriodo });
  const pendiente = estado === "past_due" && hasSubscriptionAccess({ subscription_status: estado, grace_ends_at: finDeGracia });
  const plan = activo || cancelado || pendiente || ilimitado ? nombrePlan(fila?.active_plan as string | null, ilimitado) : null;
  const esFranco = fila?.active_plan === "plan10" && !ilimitado;
  const disponibles = datosSaldo.disponibles;

  const conGoogle = (user.identities ?? []).some((i) => i.provider === "google");
  const correos = { semanal: !pp.semanalBajaAt, inmediato: !pp.inmediatoBajaAt };
  const pb = pp.perfil;
  const C = CUENTA_COPY;

  return (
    <div className="min-h-screen bg-[var(--franco-bg)] text-[var(--franco-text)]">
      <HeaderFranco sesion={{ email: user.email ?? "" }} />
      <main className="mx-auto max-w-[720px] px-4 pb-16 pt-8 sm:px-6" style={{ fontFamily: UI }} data-cuenta="pagina">
        <h1 className="m-0 font-heading text-[28px] font-bold leading-[1.12] tracking-[-0.015em] sm:text-[34px]">{C.titulo}</h1>
        <p className="mt-1.5 text-[15px] text-[var(--franco-text-secondary)]" data-cuenta="correo">{user.email}</p>

        <div className="mt-7">
          {/* El plan o el saldo, con las compras */}
          <section className="ca-plano-sec" data-cuenta={plan ? "plan" : "saldo"}>
            <h2 className="ca-plano-t">{plan ? C.plan.titulo : C.saldo.titulo}</h2>
            {plan ? (
              <>
                <p className="m-0 text-[15px]">
                  <span className="font-semibold">{plan}</span>
                  <span className="text-[var(--franco-text-secondary)]"> · {esFranco ? PLANES_COPY.plan.resumen : C.plan.legado}</span>
                </p>
                {!ilimitado && <p className="mt-1 text-[15px]">{C.plan.teQuedan(disponibles)}</p>}
                {activo && finDelPeriodo && <p className="mt-1 text-[14px] text-[var(--franco-text-secondary)]">{C.plan.renueva(fecha(finDelPeriodo))}</p>}
                {cancelado && <p className="mt-1 text-[14px] text-[var(--franco-text-secondary)]">{C.plan.cancelado(fecha(finDelPeriodo))}</p>}
                {pendiente && <p className="mt-1 text-[14px] text-[var(--franco-text-secondary)]">{C.plan.pendiente(fecha(finDeGracia))}</p>}
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  {activo && <CancelSubscriptionButton />}
                  {cancelado && <EnlaceCarga href="/pricing" className={enlace}>{C.plan.volver}</EnlaceCarga>}
                  {pendiente && <EnlaceCarga href="/pricing" className={enlace}>{C.plan.actualizarPago}</EnlaceCarga>}
                </div>
              </>
            ) : (
              <>
                <p className="m-0 text-[15px] font-semibold" data-saldo={saldo.tipo}>
                  {saldo.tipo === "sin" ? C.saldo.ninguno
                    : saldo.tipo === "regalo" ? `${CASA.regalo.titulo}${saldo.vence ? ` ${textoVence(saldo.vence)}` : ""}`
                    : saldo.tipo === "con" ? `${CASA.con.titulo(saldo.n)}.${saldo.noVencen ? ` ${CASA.con.noVencen}` : ""}`
                    : CASA.plan.titulo}
                </p>
                <div className="mt-3"><EnlaceCarga href="/pricing" className={enlace}>{C.saldo.comprar}</EnlaceCarga></div>
              </>
            )}
            {(compras ?? []).length > 0 && (
              <div className="mt-5" data-cuenta="compras">
                <p className="m-0 mb-1.5 text-[13px] font-medium text-[var(--franco-text-secondary)]">{C.compras}</p>
                <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[14px]">
                  {(compras ?? []).map((p) => (
                    <li key={p.id as string} className="flex flex-wrap justify-between gap-x-4">
                      <span>{etiquetaCompra(p.product as string)} <span className="text-[var(--franco-text-secondary)]">· {fecha(p.created_at as string)}</span></span>
                      <span className="tabular-nums">{fmtCLP(Number(p.amount))}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* El perfil de búsqueda: el mismo editable del dashboard */}
          {pb.completo ? (
            <PerfilBusquedaCasa
              pendientes={[]}
              modalidadRespondida={pp.manual.modalidad != null}
              inicial={{ dormitorios: pb.dormitorios, comunas: pb.comunas, precioMaxUf: pb.precioMaxUf, precioMinUf: pb.precioMinUf, modalidad: pb.modalidad, piePct: pb.piePct, plazoAnios: pb.plazoAnios, horizonte: pb.horizonte }}
            />
          ) : (
            <section className="ca-plano-sec" data-casa="perfil">
              <h2 className="ca-plano-t">{CASA.perfil.titulo}</h2>
              <p className="m-0 max-w-[560px] text-[14px] text-[var(--franco-text-secondary)]">{C.perfil.sin}</p>
              <div className="mt-3"><EnlaceCarga href="/deptos" className={enlace}>{C.perfil.armar}</EnlaceCarga></div>
            </section>
          )}

          {/* Cómo entras */}
          <section className="ca-plano-sec" data-cuenta="entrar">
            <h2 className="ca-plano-t">{C.entrar.titulo}</h2>
            <p className="m-0 text-[15px]">{C.entrar.codigo}</p>
            {conGoogle && <p className="mt-1 text-[15px]">{C.entrar.google}</p>}
          </section>

          {/* Darte de baja */}
          <section className="ca-plano-sec" data-cuenta="baja">
            <h2 className="ca-plano-t">{C.baja.titulo}</h2>
            <p className="m-0 mb-3 max-w-[560px] text-[14px] text-[var(--franco-text-secondary)]">{C.baja.bajada}</p>
            <CorreosCuenta inicial={correos} />
            <div className="mt-5"><DeleteAccountButton /></div>
          </section>
        </div>
      </main>
      <AppFooter variant="informe" />
    </div>
  );
}
