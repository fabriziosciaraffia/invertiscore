import "./planes.css";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { AppFooter } from "@/components/chrome/AppFooter";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { createClient } from "@/lib/supabase/server";
import { rutaTres } from "@/lib/tres-analisis";
import { PLANES_COPY, RUTA_PLAN, RUTA_SUELTO_PLANES } from "@/lib/planes";
import { VistaPlanes } from "./vista-planes";

// ─────────────────────────────────────────────────────────────────────────────
// /pricing (19-oct-2026, decisión de Fabrizio; segunda pasada el mismo día): tres productos —gratis, pack y plan—, una
// columna y un botón cada uno. Arriba, una línea: el semanal lo traen los tres; cambia cuántos análisis. Las dos pagadas
// con la MISMA estructura —qué suman a lo de Gratis, el precio por análisis grande, el total chico, la condición, el
// botón— y el pack destacado con el material del banner, con el suelto como botón secundario de borde fino. Sin
// describir qué trae el análisis: debajo, el enlace al demo. El plan de 50, el ilimitado y los anuales ya no se muestran
// (planes.ts › VENTA_RETIRADA). Con sesión, a quien ya tiene un plan no se le vuelve a vender.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: cuenta } = user
    ? await supabase.from("user_credits").select("subscription_status, active_plan, is_unlimited").eq("user_id", user.id).maybeSingle()
    : { data: null };
  // Un plan vigente (el Franco, o uno de los que ya no se venden): el botón del plan lleva a la cuenta.
  const conPlan = !!cuenta && (cuenta.is_unlimited === true || (cuenta.subscription_status === "active" && !!cuenta.active_plan));
  const C = PLANES_COPY;

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      <VistaPlanes />
      <HeaderFranco activo="planes" sesion={user ? { email: user.email ?? "" } : null} />
      <main className="pl mx-auto max-w-[1100px] px-4 pb-16 pt-8 sm:px-6 md:pt-12" data-planes="pagina">
        <h1 className="pl-titulo">{C.titulo}</h1>
        <p className="pl-bajada" data-planes="bajada">{C.bajada}</p>

        <div className="pl-grilla">
          {/* Gratis */}
          <section className="pl-col" data-planes="gratis">
            <h2 className="pl-nombre">{C.gratis.nombre}</h2>
            <p className="pl-precio"><span className="pl-monto">{C.gratis.precio}</span></p>
            <ul className="pl-incluye">
              {C.gratis.incluye.map((t) => <li key={t}>{t}</li>)}
            </ul>
            <div className="pl-accion">
              {user ? (
                <EnlaceCarga href="/dashboard" className="pl-boton pl-boton-borde" data-planes="boton-gratis">Ir a mis análisis</EnlaceCarga>
              ) : (
                <EnlaceCarga href={C.gratis.ruta} className="pl-boton pl-boton-borde" data-planes="boton-gratis">{C.gratis.boton}</EnlaceCarga>
              )}
            </div>
          </section>

          {/* El pack, destacado */}
          <section className="pl-col pl-pack" data-planes="pack">
            <h2 className="pl-nombre">{C.pack.nombre}</h2>
            <p className="pl-detalle">{C.pack.detalle}</p>
            <p className="pl-precio"><span className="pl-monto">{C.pack.precio}</span><span className="pl-unidad">{C.pack.unidad}</span></p>
            <p className="pl-total">{C.pack.total}</p>
            <p className="pl-condicion">{C.pack.condicion}</p>
            <div className="pl-accion">
              <EnlaceCarga href={rutaTres("planes", { volver: "/dashboard" })} className="pl-boton" data-planes="boton-pack">{C.pack.boton}</EnlaceCarga>
              <EnlaceCarga href={RUTA_SUELTO_PLANES} className="pl-secundario" data-planes="suelto">{C.pack.suelto}</EnlaceCarga>
            </div>
          </section>

          {/* El Plan Franco */}
          <section className="pl-col" data-planes="plan">
            <h2 className="pl-nombre">{C.plan.nombre}</h2>
            <p className="pl-detalle">{C.plan.detalle}</p>
            <p className="pl-precio"><span className="pl-monto">{C.plan.precio}</span><span className="pl-unidad">{C.plan.unidad}</span></p>
            <p className="pl-total">{C.plan.total}</p>
            <p className="pl-condicion">{C.plan.condicion}</p>
            <div className="pl-accion">
              {conPlan ? (
                <EnlaceCarga href="/cuenta" className="pl-estado" data-planes="boton-plan">{C.planActivo}</EnlaceCarga>
              ) : (
                <EnlaceCarga href={RUTA_PLAN} className="pl-boton pl-boton-tinta" data-planes="boton-plan">{C.plan.boton}</EnlaceCarga>
              )}
            </div>
          </section>
        </div>

        <p className="pl-nota" data-planes="demo">
          {C.demo.antes} <EnlaceCarga href={C.demo.ruta}>{C.demo.enlace}</EnlaceCarga>
        </p>
      </main>
      <AppFooter variant="informe" />
    </div>
  );
}
