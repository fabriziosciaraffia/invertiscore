import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Flow.cl redirige via POST después del pago → convertir a GET
  if (request.nextUrl.pathname === "/payments/return" && request.method === "POST") {
    const url = new URL("/payments/return", request.url);
    return NextResponse.redirect(url, 303);
  }

  return await updateSession(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/analisis/:path*", "/login", "/register", "/pricing", "/auth/callback", "/payments/return"],
};
