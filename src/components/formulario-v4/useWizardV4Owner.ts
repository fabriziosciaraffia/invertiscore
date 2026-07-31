"use client";

// Dueño del borrador: `user.id` con sesión, `guest` sin ella.
//
// Se resuelve contra Supabase en el cliente porque el borrador vive en
// localStorage y la decisión de qué mostrar ocurre antes de cualquier fetch al
// producto. `null` mientras resuelve — el wizard NO debe leer ni escribir
// borradores hasta tener un dueño, o volvería a leer con el scope equivocado
// durante la ventana de carga, que es justo el bug que esto cierra.

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { OWNER_INVITADO } from "@/lib/draft-keys";

export function useWizardV4Owner(): string | null {
  const [owner, setOwner] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (vivo) setOwner(data.user?.id ?? OWNER_INVITADO);
      })
      .catch(() => {
        // Sin poder confirmar identidad, el scope más seguro es el de invitado:
        // nunca deja ver el borrador de un usuario logueado.
        if (vivo) setOwner(OWNER_INVITADO);
      });
    return () => {
      vivo = false;
    };
  }, []);

  return owner;
}
