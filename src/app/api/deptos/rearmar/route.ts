import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { diaChile } from "@/lib/regalo-alta";
import { encolarPrimeraSeleccion } from "@/lib/guia/del-dia-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/deptos/rearmar (21-oct-2026, la línea «Buscas» de «Estás dentro», lib/deptos/respuesta.ts): la persona cambió
// su búsqueda y tocó «Listo» (el perfil ya se guardó por PUT /api/perfil-busqueda). Si el correo del día todavía no
// salió, su selección se rearma con la búsqueda nueva: la fila pendiente se borra y se vuelve a encolar —con fila nueva,
// así una primera vuelta que todavía corra con la búsqueda vieja escribe sobre una fila que ya no existe—. Si el correo
// ya salió, queda como está: la búsqueda nueva manda desde la próxima.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 60;
const RUTA = "POST /api/deptos/rearmar";
const SITIO = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";

export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });
  const admin = createServiceClient();
  const { data: fila, error } = await admin.from("semanal_selecciones").select("id, enviada_at")
    .eq("user_id", user.id).eq("tipo", "del_dia").eq("semana", diaChile()).maybeSingle();
  reportarFalloQuery(error, { ruta: RUTA, operacion: "leer-fila", userId: user.id });
  if (fila?.enviada_at) return NextResponse.json({ rearmada: false, motivo: "enviada" });
  if (fila) {
    const { error: eBorrar } = await admin.from("semanal_selecciones").delete().eq("id", fila.id).is("enviada_at", null);
    reportarFalloQuery(eBorrar, { ruta: RUTA, operacion: "borrar-pendiente", userId: user.id });
    if (eBorrar) return NextResponse.json({ error: "borrar" }, { status: 500 });
  }
  const nueva = await encolarPrimeraSeleccion(admin, user, { sitio: SITIO, enSegundoPlano: waitUntil, ruta: RUTA });
  return NextResponse.json({ rearmada: !!nueva });
}
