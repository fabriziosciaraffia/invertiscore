"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { botonOcupado, claveActual, iniciarCarga } from "@/lib/carga-global";

import { esDemo } from "@/lib/demo";

export function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const supabase = createClient();
  // Lo que tarda se ve cargando (22-oct-2026): el botón ocupado mientras borra, la barra del header hasta el dashboard.
  const [borrando, setBorrando] = useState(false);

  // Las filas del demo público no se borran (`src/lib/demo.ts`).
  if (esDemo(id)) return null;

  const handleDelete = async () => {
    if (borrando || !confirm("¿Estás seguro de que quieres eliminar este análisis?")) return;

    setBorrando(true);
    await supabase.from("analisis").delete().eq("id", id);
    iniciarCarga(claveActual());
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2 text-destructive hover:text-destructive"
      onClick={handleDelete}
      disabled={borrando}
      {...botonOcupado(borrando)}
    >
      <Trash2 className="h-4 w-4" /> {borrando ? "Eliminando…" : "Eliminar"}
    </Button>
  );
}
