import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Captura de leads por comuna fuera de cobertura (Gran Santiago beta).
// Usa el service role key porque waitlist_zonas tiene RLS sin policies públicas.
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: Request) {
  try {
    const { email, comuna } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }

    const comunaClean =
      typeof comuna === "string" && comuna.trim().length > 0
        ? comuna.trim().slice(0, 120)
        : null;

    const { error } = await getSupabase()
      .from("waitlist_zonas")
      .insert({ email: email.toLowerCase().trim(), comuna: comunaClean });

    if (error) {
      console.error("waitlist_zonas error:", error);
      return NextResponse.json({ error: "Error al registrar" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
