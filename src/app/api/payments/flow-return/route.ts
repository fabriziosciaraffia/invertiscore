import { NextRequest, NextResponse } from "next/server";

// Flow.cl redirige al usuario via POST después del pago.
// Next.js App Router pages solo manejan GET, así que este route handler
// recibe el POST y redirige a /payments/return via GET (303 See Other).
export async function POST(request: NextRequest) {
  const url = new URL("/payments/return", request.url);

  // Extraer token del body (Flow lo envía como form data)
  const formData = await request.formData().catch(() => null);
  if (formData) {
    const token = formData.get("token");
    if (token) {
      url.searchParams.set("token", String(token));
    }
  }

  return NextResponse.redirect(url, 303);
}
