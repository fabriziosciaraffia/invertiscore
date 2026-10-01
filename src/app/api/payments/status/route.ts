import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAvailableCredits } from "@/lib/credits-grant";
import { getUserAccessLevel } from "@/lib/access";
import { firmaPagoValida } from "@/lib/lo-que-sigue/firma-pago";
import { accesoAlPago } from "@/lib/lo-que-sigue/retorno-pago";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/status?order=…[&t=…] — el estado de un pago a la vuelta de Flow.
//
// 02-oct-2026: tres arreglos. (1) Sin sesión, con la firma del pago (`t`, firma-pago.ts) devuelve el
// estado de ESE pago y el saldo de la cuenta dueña: el pack se paga sin sesión y la pantalla tiene que
// poder decir «Tienes N análisis» de verdad, o que el pago no pasó. (2) Con sesión de OTRA cuenta
// responde `otraCuenta: true` en vez de `payment: null` (la pantalla quedaba cargando para siempre).
// (3) El saldo real viaja con el pago (ledger + legacy; `ilimitado` para la suscripción).
// Sin sesión y sin firma válida: 401, nada.
// ─────────────────────────────────────────────────────────────────────────────

const CAMPOS = "id, user_id, commerce_order, product, amount, status, created_at, analysis_id, payment_data";

async function saldoDe(admin: ReturnType<typeof createServiceClient>, userId: string): Promise<{ saldo: number; ilimitado: boolean }> {
  const nivel = await getUserAccessLevel(userId);
  if (nivel === "subscriber") return { saldo: 0, ilimitado: true };
  return { saldo: await getAvailableCredits(userId, admin), ilimitado: false };
}

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const url = new URL(request.url);
  const commerceOrder = url.searchParams.get("order");
  const firma = url.searchParams.get("t");

  // Sin sesión solo se entra con una orden y su firma.
  if (!user && !firmaPagoValida(commerceOrder, firma)) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // payments sin RLS de lectura para el cliente: se lee con service role.
  const admin = createServiceClient();

  if (!commerceOrder) {
    // Sin order solo con sesión (arriba): el último pago de la persona.
    const { data } = await admin
      .from("payments")
      .select(CAMPOS)
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!data) return NextResponse.json({ payment: null });
    const { user_id: _dueno, ...payment } = data;
    void _dueno;
    return NextResponse.json({ payment, ...(await saldoDe(admin, user!.id)) });
  }

  const { data: fila } = await admin.from("payments").select(CAMPOS).eq("commerce_order", commerceOrder).maybeSingle();
  const acceso = accesoAlPago({
    sesionUserId: user?.id ?? null,
    duenoPago: fila ? ((fila.user_id as string | null) ?? null) : undefined,
    firmaValida: firmaPagoValida(commerceOrder, firma),
  });

  if (acceso === "otra_cuenta") return NextResponse.json({ payment: null, otraCuenta: true });
  if (acceso === "no_existe") return NextResponse.json({ payment: null });
  if (acceso === "sin_datos" || !fila) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const dueno = fila.user_id as string;
  if (acceso === "firma") {
    // Sin sesión: lo justo para la pantalla. Nada del correo ni de payment_data.
    const payment = { commerce_order: fila.commerce_order, product: fila.product, amount: fila.amount, status: fila.status, analysis_id: fila.analysis_id };
    return NextResponse.json({ payment, sinSesion: true, ...(fila.status === "paid" ? await saldoDe(admin, dueno) : {}) });
  }
  const { user_id: _d, ...payment } = fila;
  void _d;
  return NextResponse.json({ payment, ...(await saldoDe(admin, dueno)) });
}
