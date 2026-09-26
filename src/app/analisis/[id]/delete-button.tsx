"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

import { esDemo } from "@/lib/demo";

export function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const supabase = createClient();

  // Las filas del demo público no se borran (`src/lib/demo.ts`).
  if (esDemo(id)) return null;

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
