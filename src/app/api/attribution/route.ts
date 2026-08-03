import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createAdminServiceClient } from "@/lib/admin-auth";
import { guardarAtribucion, sanearAtribucion, tieneAlgo } from "@/lib/attribution";

/**
 * Segunda mitad de la atribución: los UTM que viven en localStorage.
 *
 * Por qué el cliente y no el redirectTo del OAuth (decisión, con su razón):
 *  · localStorage sobrevive el round-trip de Google intacto —el usuario vuelve
 *    al MISMO origen—, así que no hace falta meter nada en la URL.
 *  · Meter los UTM en el redirectTo obligaría a romper la whitelist de
 *    `queryDeIntencion` (["next","plan"]), que existe justamente para no
 *    arrastrar params ajenos entre pantallas de auth; sumaría 5 params a una URL
 *    que ya pasa por Supabase y Google, y dejaría los UTM expuestos en el
 *    Referer de terceros.
 *  · El referrer y el landing_path NO están en la query de todos modos: solo el
 *    cliente los conoce.
 *
 * El costo de esta decisión, dicho: si el usuario bloquea JS o cierra antes de
 * que corra el hook, quedan el fbp/fbc del callback y ningún UTM. Es una fila
 * parcial, no una fila ausente.
 *
 * Seguridad: el user_id NO viene del body. Sale de la sesión, server-side. Así
 * nadie puede escribir la atribución de otra cuenta.
 */
export async function POST(request: Request) {
  try {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const datos = sanearAtribucion(body);

    if (!tieneAlgo(datos)) {
      return NextResponse.json({ ok: true, skipped: "sin datos" });
    }

    const guardado = await guardarAtribucion(createAdminServiceClient(), user.id, datos);
    return NextResponse.json({ ok: guardado });
  } catch (e) {
    // Igual que el resto del flujo de atribución: nunca es un error que le
    // importe al usuario. Se responde 200 para que el cliente marque el sync
    // como hecho y no reintente en loop contra algo que está roto server-side.
    console.error("[api/attribution] excepción:", e);
    return NextResponse.json({ ok: false });
  }
}
