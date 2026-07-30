import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { emitirBoletaDTE } from "@/lib/openfactura/client";

export async function POST(request: Request) {
  try {
    // Gate compartido: mismo 403 { error: "No autorizado" } que antes, y el
    // client de service role sale del propio gate (antes era inline acá).
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;
    const admin = gate.sb;

    const body = await request.json().catch(() => ({}));
    const documentoId = (body as { documentoId?: string }).documentoId;
    if (!documentoId) {
      return NextResponse.json({ error: "documentoId requerido" }, { status: 400 });
    }

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
      .select("id, user_id, product, amount, commerce_order, flow_order")
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
        flow_order: payment.flow_order,
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
