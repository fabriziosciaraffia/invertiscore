import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Analisis } from "@/lib/types";
import { CompararClient } from "./comparar-client";

// Herramienta con auth (redirige a /login sin sesión) sobre análisis del
// usuario: nunca indexable. No lleva canonical — no es página de marketing.
export const metadata: Metadata = {
  title: "Comparar análisis",
  robots: { index: false, follow: false },
};

export default async function CompararPage({
  searchParams,
}: {
  searchParams: { ids?: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const ids = searchParams.ids?.split(",").filter(Boolean) || [];
  if (ids.length < 2 || ids.length > 3) redirect("/dashboard");

  const { data } = await supabase
    .from("analisis")
    .select("*")
    .in("id", ids)
    .eq("user_id", user.id);

  const analisis = (data || []) as Analisis[];
  if (analisis.length < 2) redirect("/dashboard");

  // Preserve the order from the URL
  const ordered = ids
    .map((id) => analisis.find((a) => a.id === id))
    .filter(Boolean) as Analisis[];

  return <CompararClient analisis={ordered} />;
}
