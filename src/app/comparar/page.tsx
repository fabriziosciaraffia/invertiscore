import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { columnasComparar, idsComparar, opcionesComparar, COMPARAR_MIN } from "@/lib/lo-que-sigue/comparar";
import { CompararVista } from "./comparar-vista";

// ─────────────────────────────────────────────────────────────────────────────
// /comparar (30-sep-2026): dos o más informes propios lado a lado —veredicto, precio, flujo y
// resultado a 10 años—, recalculados con el motor de hoy. Sin ids (o con uno) muestra el selector;
// con dos a cuatro, la tabla. Se entra desde el dashboard. Reemplaza la vista vieja, que leía los
// resultados guardados y no tenía entrada desde ninguna parte.
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Comparar análisis",
  robots: { index: false, follow: false },
};

export default async function CompararPage({ searchParams }: { searchParams: { ids?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/comparar")}`);

  const ids = idsComparar(searchParams.ids);
  const [opciones, columnas] = await Promise.all([
    opcionesComparar(supabase, user.id),
    ids.length >= COMPARAR_MIN ? columnasComparar(supabase, user.id, ids) : Promise.resolve([]),
  ]);

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      <HeaderFranco activo="mis" sesion={{ email: user.email ?? "" }} />
      <CompararVista opciones={opciones} columnas={columnas} seleccion={ids} />
    </div>
  );
}
