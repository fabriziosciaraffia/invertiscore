// ─────────────────────────────────────────────────────────────────────────────
// A QUIEN FIRMÓ LA ORDEN NUNCA SE LE MUESTRA UN ENLACE AL PORTAL (decisión de Fabrizio, 19-nov-2026): ni en el informe (la portada,
// la franja, «Mandármelo por correo»), ni en el resultado, ni en los detalles, ni en la selección, ni en el pop-up «no da», ni en
// los correos. Quien ya firmó no debe salir de Franco para ver el depto. UNA sola regla, por la persona que MIRA (no por el dueño
// del informe): tiene una orden firmada, con o sin acceso hoy a la lista. La lee cada superficie que trae `scraped_properties.url`
// hacia una persona; el tier INVIERTE-V2-E2 vigila que todas pasen por acá.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { ultimaOrdenDe } from "./servidor";

export async function sinEnlaceAlPortal(admin: SupabaseClient, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  // Ante una falla de lectura, el lado seguro es no mostrar el enlace.
  return (await ultimaOrdenDe(admin, userId).catch(() => true)) != null;
}
