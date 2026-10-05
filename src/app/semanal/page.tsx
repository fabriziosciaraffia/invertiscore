import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { estadoSaldo, leerSaldo } from "@/lib/casa-saldo";
import { seleccionPorToken, seleccionViva } from "@/lib/guia/semanal-servidor";
import { leerConfigGuia } from "@/lib/guia/guia-servidor";
import { SEMANAL_PAGINA } from "@/lib/guia/semanal";
import { hrefEntrar } from "@/lib/entrar/entrada";
import { SemanalLista } from "./semanal-lista";

// ─────────────────────────────────────────────────────────────────────────────
// /semanal (02-oct-2026): adonde lleva el correo semanal. Con sesión; la selección es la del token del
// correo y tiene que ser de quien entró. Muestra los deptos del correo (el clicado primero) y, con saldo,
// «Analizar este» genera el informe con sus números; sin saldo, el botón compra el suelto. Viva
// (05-oct-2026): el que ya no está publicado lo dice y trae en su lugar el siguiente mejor, chequeado.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";
const TOKEN = /^[0-9a-f]{20,80}$/i;

export default async function SemanalPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const t = searchParams.t ?? "";
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const aqui = `/semanal?${new URLSearchParams(Object.entries(searchParams).filter((e): e is [string, string] => typeof e[1] === "string")).toString()}`;
  if (!user) redirect(hrefEntrar(aqui, "semanal"));
  if (!TOKEN.test(t)) redirect("/dashboard");

  const admin = createServiceClient();
  // El semanal o un aviso inmediato (05-oct-2026): la misma página, viva.
  const sel = await seleccionPorToken(admin, t);
  if (!sel) redirect("/dashboard");

  const otraCuenta = sel.user_id !== user.id;
  const filas = otraCuenta ? [] : await seleccionViva(admin, { tabla: sel.fuente === "inmediato" ? "avisos_inmediatos" : "semanal_selecciones", id: sel.id, userId: user.id, items: sel.items }, await leerConfigGuia(admin));
  const a = searchParams.a ?? null;
  const ordenados = a ? [...filas.filter((f) => f.item.avisoId === a), ...filas.filter((f) => f.item.avisoId !== a)] : filas;
  const saldo = estadoSaldo(await leerSaldo(admin, user.id));
  const combo = sel.combinacion;

  return (
    <div className="min-h-screen bg-[var(--franco-bg)] text-[var(--franco-text)]">
      <HeaderFranco activo="mis" sesion={{ email: user.email ?? "" }} />
      <main className="mx-auto max-w-[1000px] px-4 pb-16 pt-6 sm:px-6">
        {otraCuenta ? (
          <p className="text-[15px]" role="alert" data-semanal="otra-cuenta">{SEMANAL_PAGINA.otraCuenta}</p>
        ) : (
          <SemanalLista
            token={t}
            origenId={sel.origen_analysis_id}
            combinacion={combo}
            filas={ordenados}
            destacado={a}
            saldo={saldo}
            variante={sel.variante}
            inmediato={sel.fuente === "inmediato"}
          />
        )}
      </main>
    </div>
  );
}
