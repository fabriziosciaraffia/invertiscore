import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Analisis } from "@/lib/types";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: analisisList } = await supabase
    .from("analisis")
    .select("*")
    .order("created_at", { ascending: false });

  const analisis = (analisisList || []) as Analisis[];

  return <DashboardClient analisis={analisis} />;
}
