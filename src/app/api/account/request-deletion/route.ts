import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError, captureApiWarning } from "@/lib/observabilidad";
import {
  sendAccountDeletionInternalEmail,
  sendAccountDeletionUserEmail,
} from "@/lib/email";
import { nombreReal } from "@/lib/welcome";
import { cerrarTodo } from "@/lib/subscriptions/flow-vivas";
import { puertaFlow } from "@/lib/subscriptions/flow-puerta";
import { MARCA_ELIMINACION } from "@/lib/correo-baja";

// ─────────────────────────────────────────────────────────────────────────────
// PEDIR LA ELIMINACIÓN DE LA CUENTA (05-nov-2026, auditoría de promesas parte 2, decisión de Fabrizio). El borrado lo hace
// el equipo a mano; lo que no puede esperar a ese borrado pasa AL PEDIRLO:
//   1. se cancela en Flow, ahora, todo lo vivo de la persona (flow-vivas.ts › cerrarTodo) y la cuenta queda sin plan;
//   2. se detienen los correos: las dos bajas de perfil_busqueda (el semanal, el del día, la renta corta, el aviso inmediato,
//      el carrito y el recordatorio del pack las miran) y la marca de eliminación en la cuenta, que frena el resto de lo que
//      no es transaccional (correo-baja.ts › TIPOS_QUE_FRENA_LA_ELIMINACION);
//   3. el aviso interno a hola@ NO puede fallar en silencio: si Resend no lo acepta, la respuesta es error (la persona ve
//      «Escríbenos a hola@refranco.ai») y queda en Sentry. Lleva lo que pasó con Flow, para cancelar a mano si falló.
// Lo fija el tier SUSCRIPCION.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const admin = createServiceClient();
  const ahora = new Date().toISOString();

  // Count user analyses
  const { count: analysisCount } = await supabase
    .from("analisis")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { data: creditsRow } = await admin
    .from("user_credits")
    .select("credits, subscription_status, subscription_id, flow_customer_id, unlimited_source")
    .eq("user_id", user.id)
    .maybeSingle();
  const credits = creditsRow?.credits ?? 0;

  // (1) La suscripción, cancelada en Flow ahora.
  const cierre = await cerrarTodo(puertaFlow, {
    customerId: (creditsRow?.flow_customer_id as string | null) ?? null,
    subscriptionId: (creditsRow?.subscription_id as string | null) ?? null,
  });
  if (cierre.ok && (creditsRow?.subscription_status === "active" || creditsRow?.subscription_status === "past_due")) {
    await admin
      .from("user_credits")
      .update({
        subscription_status: "cancelled",
        subscription_ends_at: ahora,
        grace_ends_at: null,
        ...(creditsRow?.unlimited_source === "manual" ? {} : { is_unlimited: false, unlimited_source: null }),
        updated_at: ahora,
      })
      .eq("user_id", user.id);
  }
  if (!cierre.ok) {
    captureApiError(new Error("Eliminación pedida: Flow no confirmó la cancelación"), {
      ruta: "POST /api/account/request-deletion",
      operacion: "cancelar-en-flow",
      userId: user.id,
      extra: { vivas: cierre.vivas, fallidas: cierre.fallidas, lecturaFallida: cierre.lecturaFallida },
    });
  }

  // (2) Los correos, detenidos.
  const { error: eBaja } = await admin
    .from("perfil_busqueda")
    .upsert({ user_id: user.id, semanal_baja_at: ahora, inmediato_baja_at: ahora }, { onConflict: "user_id" });
  const { error: eMarca } = await admin.auth.admin.updateUserById(user.id, { app_metadata: { [MARCA_ELIMINACION]: ahora } });
  const correosDetenidos = !eBaja && !eMarca;
  if (!correosDetenidos) {
    captureApiError(new Error("Eliminación pedida: no se pudieron detener los correos"), {
      ruta: "POST /api/account/request-deletion",
      operacion: "detener-correos",
      userId: user.id,
      extra: { baja: eBaja?.message ?? null, marca: eMarca?.message ?? null },
    });
  }

  const flowTexto = cierre.ok
    ? cierre.canceladas.length > 0 ? `Cancelada en Flow: ${cierre.canceladas.join(", ")}` : "Sin suscripción viva en Flow"
    : `NO SE PUDO CANCELAR EN FLOW — cancelar a mano: ${[...cierre.fallidas.map((f) => f.id), ...(cierre.lecturaFallida ? ["(no se pudo leer la lista del cliente)"] : [])].join(", ")}`;
  const solicitadaEl = new Date().toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santiago",
  });

  // (3) El aviso interno: si no sale, la solicitud no se da por recibida.
  try {
    await sendAccountDeletionInternalEmail({
      email: user.email!,
      userId: user.id,
      requestedAt: solicitadaEl,
      analysisCount: analysisCount ?? 0,
      credits,
      flow: flowTexto,
      correos: correosDetenidos ? "Detenidos" : "NO SE PUDIERON DETENER — revisar",
    });
  } catch (error) {
    console.error("[request-deletion] el aviso interno no salió:", error);
    captureApiError(error, {
      ruta: "POST /api/account/request-deletion",
      operacion: "aviso-interno",
      userId: user.id,
      extra: { flow: flowTexto, correosDetenidos },
    });
    return NextResponse.json({ error: "No se pudo enviar la solicitud" }, { status: 500 });
  }

  // La confirmación a la persona. Si no sale, la solicitud igual quedó recibida (el aviso interno salió): se dice.
  let confirmacion = true;
  try {
    await sendAccountDeletionUserEmail(user.email!, nombreReal(user.user_metadata) ?? "", { userId: user.id, planCancelado: cierre.ok });
  } catch (error) {
    confirmacion = false;
    console.error("[request-deletion] la confirmación a la persona no salió:", error);
    captureApiWarning(error, { ruta: "POST /api/account/request-deletion", operacion: "confirmacion-usuario", userId: user.id });
  }

  return NextResponse.json({ success: true, confirmacion, planCancelado: cierre.ok });
}
