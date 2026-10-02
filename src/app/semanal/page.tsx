import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { estadoSaldo, leerSaldo } from "@/lib/casa-saldo";
import { itemsVigentes, type ItemSemanal } from "@/lib/guia/semanal-servidor";
import { SEMANAL_PAGINA } from "@/lib/guia/semanal";
import { hrefEntrar } from "@/lib/entrar/entrada";
import { SemanalLista } from "./semanal-lista";

// ─────────────────────────────────────────────────────────────────────────────
// /semanal (02-oct-2026): adonde lleva el correo semanal. Con sesión; la selección es la del token del
// correo y tiene que ser de quien entró. Muestra los deptos que siguen publicados (el clicado primero)
// y, con saldo, «Analizar este» genera el informe con sus números; sin saldo, el botón compra el suelto.
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
  const { data: sel } = await admin.from("semanal_selecciones").select("user_id, items, combinacion, origen_analysis_id, variante").eq("token", t).maybeSingle();
  if (!sel) redirect("/dashboard");

  const otraCuenta = sel.user_id !== user.id;
  const items = otraCuenta ? [] : await itemsVigentes(admin, (sel.items ?? []) as ItemSemanal[]);
  const a = searchParams.a ?? null;
  const ordenados = a ? [...items.filter((i) => i.avisoId === a), ...items.filter((i) => i.avisoId !== a)] : items;
  const saldo = estadoSaldo(await leerSaldo(admin, user.id));
  const combo = (sel.combinacion ?? null) as { piePct: number; plazoAnios: number } | null;

  return (
    <div className="min-h-screen bg-[var(--franco-bg)] text-[var(--franco-text)]">
      <HeaderFranco activo="mis" sesion={{ email: user.email ?? "" }} />
      <main className="mx-auto max-w-[1000px] px-4 pb-16 pt-6 sm:px-6">
        {otraCuenta ? (
          <p className="text-[15px]" role="alert" data-semanal="otra-cuenta">{SEMANAL_PAGINA.otraCuenta}</p>
        ) : (
          <SemanalLista
            token={t}
            origenId={(sel.origen_analysis_id as string | null) ?? null}
            combinacion={combo}
            items={ordenados}
            destacado={a}
            despublicado={searchParams.d === "1" && !!a}
            saldo={saldo}
            variante={(sel.variante as "banda" | "tarjetas" | null) ?? null}
          />
        )}
      </main>
    </div>
  );
}
