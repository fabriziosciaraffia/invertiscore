"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Trash2 } from "lucide-react";

const DEMO_ANALYSIS_ID = "6db7a9ac-f030-4ccf-b5a8-5232ae997fb1";

export function DashboardDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const supabase = createClient();

  if (id === DEMO_ANALYSIS_ID) return null;

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("¿Estás seguro de eliminar este análisis?")) return;

    await supabase.from("analisis").delete().eq("id", id);
    router.refresh();
  };

  return (
    <button
      onClick={handleDelete}
      className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      title="Eliminar análisis"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
