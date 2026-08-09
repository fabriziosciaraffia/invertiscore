"use client";

import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { purgarBorradoresYPestana } from "@/lib/draft-keys";

export function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    // ANTES del signOut: los borradores guardan dirección, precio, pie, tasa y
    // arriendo en localStorage, que es por origen y no por sesión. Sin esto
    // quedan legibles para quien use después el mismo navegador.
    purgarBorradoresYPestana();
    await supabase.auth.signOut();
    // Desatar la persona de PostHog: sin esto, lo que pase después en este
    // navegador (otro usuario incluido) sigue atribuido al que se fue.
    try {
      posthog.reset();
    } catch {
      /* PostHog sin inicializar — no es un problema */
    }
    router.push("/login");
    router.refresh();
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      className="text-[var(--franco-text-secondary)] font-body hover:text-[var(--franco-text)] hover:bg-[var(--franco-card)]"
    >
      Cerrar Sesión
    </Button>
  );
}
