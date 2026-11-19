// ─────────────────────────────────────────────────────────────────────────────
// «MI INVERSIÓN» EN EL MENÚ (láminas del 19-nov-2026, menu-mi-inversion): desde que la persona firma la orden, el menú de arriba
// la muestra como primera entrada en todas las páginas. Quien no ha firmado no la ve. La decide UN solo lugar: firmó una orden
// y tiene acceso al flujo (sin acceso, /invierte da 404, así que la entrada llevaría a nada). Lleva a /invierte, que decide.
//   · Las páginas que ya lo saben en el servidor (las de Invierte, el mapa, el informe) se lo pasan al header (`invierte`).
//   · Las demás: el header consulta GET /api/invierte-v2/menu una vez y lo guarda en la sesión del navegador (menu-cliente.ts).
// ─────────────────────────────────────────────────────────────────────────────
import type { User } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { accesoInvierteV2 } from "./acceso-servidor";
import { ultimaOrdenDe } from "./servidor";

export async function muestraMiInversion(user: Pick<User, "id" | "email"> | null): Promise<boolean> {
  if (!user) return false;
  if (!(await accesoInvierteV2(user).catch(() => false))) return false;
  return (await ultimaOrdenDe(createServiceClient(), user.id).catch(() => null)) != null;
}
