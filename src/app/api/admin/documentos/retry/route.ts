import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/admin";
import { emitirBoletaDTE } from "@/lib/openfactura/client";

function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignored
          }
        },
      },
    }
  );
}

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isAdminUser(user.email)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const documentoId = (body as { documentoId?: string }).documentoId;
    if (!documentoId) {
      return NextResponse.json({ error: "documentoId requerido" }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1) Documento → payment_id
    const { data: doc, error: docErr } = await admin
      .from("documentos_tributarios")
      .select("id, payment_id")
      .eq("id", documentoId)
      .single();

    if (docErr || !doc) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    // 2) Pago asociado
    const { data: payment, error: payErr } = await admin
      .from("payments")
      .select("id, user_id, product, amount, commerce_order")
      .eq("id", doc.payment_id)
      .single();

    if (payErr || !payment) {
      return NextResponse.json({ error: "Pago asociado no encontrado" }, { status: 404 });
    }

    // 3) Email del usuario. Sin email NO emitimos (el helper manda sendEmail:true).
    const { data: userData } = await admin.auth.admin.getUserById(payment.user_id);
    const userEmail = userData?.user?.email;
    if (!userEmail) {
      return NextResponse.json({ ok: false, error: "usuario sin email" }, { status: 422 });
    }

    // 4) Re-emitir. El índice único parcial permite una nueva fila viva porque la
    // anterior quedó en 'error' (no cuenta). El resultado incluye `skipped` si el
    // kill-switch OPENFACTURA_ENABLED está apagado.
    const result = await emitirBoletaDTE({
      payment: {
        id: payment.id,
        user_id: payment.user_id,
        product: payment.product,
        amount: payment.amount,
        commerce_order: payment.commerce_order,
      },
      userEmail,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
