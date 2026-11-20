// ─────────────────────────────────────────────────────────────────────────────
// LA ENTRADA DE INVIERTE EN EL MENÚ (láminas del 19-nov-2026, menu-mi-inversion): desde que la persona firma la orden, el menú de
// arriba la muestra como primera entrada en todas las páginas. Quien no ha firmado no la ve. La decide UN solo lugar: firmó una
// orden y tiene acceso al flujo (sin acceso, /invierte da 404, así que la entrada llevaría a nada).
//   · El texto (20-nov-2026, decisión de Fabrizio): antes de elegir deptos, «Seguir con Franco»; desde que elige al menos uno,
//     «Mi inversión» (estadoMenuInvierte; texto y destino en menu-cliente.ts › entradaMenu).
//   · Las páginas que ya lo saben en el servidor (la base) se lo pasan al header (`invierte`).
//   · Las demás: el header consulta GET /api/invierte-v2/menu una vez y lo guarda en la sesión del navegador (menu-cliente.ts).
// ─────────────────────────────────────────────────────────────────────────────
import type { User } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { accesoInvierteV2 } from "./acceso-servidor";
import { ultimaOrdenDe } from "./servidor";
import type { EstadoMenu } from "./menu-cliente";

export async function muestraMiInversion(user: Pick<User, "id" | "email"> | null): Promise<boolean> {
  if (!user) return false;
  if (!(await accesoInvierteV2(user).catch(() => false))) return false;
  return (await ultimaOrdenDe(createServiceClient(), user.id).catch(() => null)) != null;
}

export async function estadoMenuInvierte(user: Pick<User, "id" | "email"> | null): Promise<EstadoMenu> {
  if (!user || !(await muestraMiInversion(user))) return "ninguno";
  const { count } = await createServiceClient().from("inv_deptos").select("aviso_id", { count: "exact", head: true }).eq("user_id", user.id).eq("estado", "elegido");
  return (count ?? 0) > 0 ? "inversion" : "seguir";
}
