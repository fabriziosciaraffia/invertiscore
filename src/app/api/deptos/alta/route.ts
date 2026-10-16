import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError, reportarFalloQuery } from "@/lib/observabilidad";
import { capturarServidor, uuidDeterminista } from "@/lib/posthog-servidor";
import { guardarAtribucion } from "@/lib/attribution";
import { leerPerfilBusqueda } from "@/lib/perfil-busqueda-servidor";
import { asegurarRegaloDeAlta, huellaDeRequest } from "@/lib/regalo-alta-servidor";
import { comunasParaAgregar, tipoDeAlta } from "@/lib/deptos/respuesta";
import { borrarPendiente, leerPendiente, reclavarPendienteGoogle } from "@/lib/deptos/servidor";
import { CLAVE_GOOGLE } from "@/lib/deptos/respuesta";
import { encolarDelDia, procesarDelDia } from "@/lib/guia/del-dia-servidor";
import { leerConfigGuia } from "@/lib/guia/guia-servidor";
import { cuentasPruebaSinCorreo } from "@/lib/guia/semanal-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/deptos/alta (16-oct-2026, la puerta B): después del código, con sesión. Lee lo que la persona eligió en
// /deptos (deptos_pendientes) y:
//   · CUENTA NUEVA —el correo no tenía cuenta al pedir el código y la cuenta nació después (tipoDeAlta)—: la cuenta nace
//     con ese perfil manual (comunas, tipología, rango, modalidad, pie 20 % y 25 años), su regalo (regalo-alta.ts), la
//     puerta B en la atribución, sin el correo de bienvenida (su bienvenida es el correo del día) y el correo del día en
//     cola, con la primera vuelta en el momento;
//   · CUENTA QUE YA EXISTÍA: nada se duplica ni se pisa; devuelve las comunas que su perfil no tiene, para preguntarle si
//     las agrega.
// CON GOOGLE (16-oct-2026): lo elegido llega a nombre del correo porque el callback lo pasó (reclavarPendienteGoogle);
// si no alcanzó a pasarlo, la pantalla manda la clave (`{ p }`) y se pasa acá. Desde ahí, igual que por código.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 60;
const RUTA = "POST /api/deptos/alta";
const SITIO = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });
  const admin = createServiceClient();
  const b = (await request.json().catch(() => ({}))) as { p?: unknown };
  try {
    let pend = await leerPendiente(admin, user.email);
    if (!pend && typeof b.p === "string" && CLAVE_GOOGLE.test(b.p) && await reclavarPendienteGoogle(admin, { clave: b.p, correo: user.email, cuentaCreadaAt: user.created_at })) {
      pend = await leerPendiente(admin, user.email);
    }
    if (!pend) return NextResponse.json({ estado: "sin-pendiente" });
    // Si ya tiene perfil con comunas, no se pisa: entra y se le pregunta si agrega las comunas.
    const { data: perfilPrevio } = await admin.from("perfil_busqueda").select("comunas").eq("user_id", user.id).maybeSingle();
    const yaTienePerfil = Array.isArray(perfilPrevio?.comunas) && (perfilPrevio.comunas as unknown[]).length > 0;
    const tipo = tipoDeAlta({ existiaAlPedir: pend.existe, cuentaCreadaAt: user.created_at, pedidoAt: pend.creadoAt, yaTienePerfil });
    // La puerta B (atribucion-puerta.ts): la primera gana; el orgánico cede.
    waitUntil(guardarAtribucion(admin, user.id, { puerta: "B", puerta_detalle: "deptos" }).then(() => undefined));

    if (tipo === "existente") {
      const pp = await leerPerfilBusqueda(admin, user.id);
      const elegidas = Array.isArray(pend.perfil.comunas) ? (pend.perfil.comunas as string[]) : [];
      const comunasNuevas = comunasParaAgregar(pp.perfil.comunas, elegidas);
      await borrarPendiente(admin, user.email);
      return NextResponse.json({ estado: "existente", comunasNuevas, comunas: pp.perfil.comunas });
    }

    // La cuenta nace con su perfil manual.
    const { error: ePerfil } = await admin.from("perfil_busqueda").upsert({ user_id: user.id, ...pend.perfil, actualizado_at: new Date().toISOString() }, { onConflict: "user_id" });
    reportarFalloQuery(ePerfil, { ruta: RUTA, operacion: "perfil", userId: user.id });
    if (ePerfil) return NextResponse.json({ error: "perfil" }, { status: 500 });
    // Su bienvenida es el correo del día: la de siempre no sale (welcome.ts).
    await admin.from("user_credits").upsert({ user_id: user.id, credits: 0, subscription_status: "none", welcome_email_sent: true }, { onConflict: "user_id", ignoreDuplicates: true });
    await admin.from("user_credits").update({ welcome_email_sent: true }).eq("user_id", user.id);
    const regalo = await asegurarRegaloDeAlta(admin, { userId: user.id, creadaAt: user.created_at, huella: huellaDeRequest(request), puerta: "B" });
    await borrarPendiente(admin, user.email);

    // El correo del día, en cola; la primera vuelta ahora (las siguientes, el cron cada 10 minutos). Las cuentas de
    // prueba no reciben correos, salvo las marcadas.
    const fila = await encolarDelDia(admin, user.id);
    if (fila) {
      waitUntil((async () => {
        try {
          const fuera = await cuentasPruebaSinCorreo(admin);
          if (fuera.has(user.id)) {
            await admin.from("semanal_selecciones").update({ estado: "descartada" }).eq("id", fila.id).is("enviada_at", null);
            return;
          }
          await procesarDelDia(admin, fila, await leerConfigGuia(admin), SITIO, { lecturas: 0, bloqueada: false });
        } catch (e) {
          captureApiError(e, { ruta: RUTA, operacion: "primera-vuelta", userId: user.id });
        }
      })());
    }
    void capturarServidor({ event: "deptos_alta", distinctId: user.id, uuid: uuidDeterminista(`deptos_alta:${user.id}`), properties: { regalo: regalo.estado, puerta: "B" } }).catch(() => {});
    return NextResponse.json({ estado: "nueva", regaloVence: regalo.vence });
  } catch (e) {
    captureApiError(e, { ruta: RUTA, operacion: "alta", userId: user.id });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
