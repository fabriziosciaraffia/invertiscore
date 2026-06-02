import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  sendAccountDeletionInternalEmail,
  sendAccountDeletionUserEmail,
} from "@/lib/email";
import { resolveDisplayName } from "@/lib/welcome";

export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Count user analyses
  const { count: analysisCount } = await supabase
    .from("analisis")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Get credits
  const { data: creditsRow } = await supabase
    .from("user_credits")
    .select("credits")
    .eq("user_id", user.id)
    .single();

  const credits = creditsRow?.credits ?? 0;
  const now = new Date().toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  try {
    // (1) Correo interno con los datos para procesar la baja.
    await sendAccountDeletionInternalEmail({
      email: user.email!,
      userId: user.id,
      requestedAt: now,
      analysisCount: analysisCount ?? 0,
      credits,
    });

    // (2) Confirmación al usuario. Nombre vía resolveDisplayName (resuelto en
    // el caller para evitar el ciclo de imports con welcome.ts).
    await sendAccountDeletionUserEmail(
      user.email!,
      resolveDisplayName(user.user_metadata, user.email),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending deletion request email:", error);
    return NextResponse.json(
      { error: "No se pudo enviar la solicitud" },
      { status: 500 }
    );
  }
}
