"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

const DEMO_ANALYSIS_ID = "6db7a9ac-f030-4ccf-b5a8-5232ae997fb1";

export function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const supabase = createClient();

  if (id === DEMO_ANALYSIS_ID) return null;

  const handleDelete = async () => {
    if (!confirm("¿Estás seguro de que quieres eliminar este análisis?")) return;

    await supabase.from("analisis").delete().eq("id", id);
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2 text-destructive hover:text-destructive"
      onClick={handleDelete}
    >
      <Trash2 className="h-4 w-4" /> Eliminar
    </Button>
  );
}
