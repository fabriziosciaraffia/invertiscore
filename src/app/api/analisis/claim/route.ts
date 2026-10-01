// ─────────────────────────────────────────────────────────────────────────────
// POST /api/analisis/claim — adopción de análisis anónimos (F2-2)
//
// Requiere sesión. Lee la cookie httpOnly `franco_anon` (viaja sola en el
// request; el client no la ve ni la manda) y delega en el núcleo compartido
// `claimAnalisisAnonimos`. Sin cookie → { claimed: 0 } rápido: los call-sites
// (login, register, red de seguridad del provider) lo llaman a ciegas.
//
// El Lead de Meta va en waitUntil: este endpoint está en el camino del login
// y no puede esperar el timeout de Meta (5s).
//
// BIENVENIDA AL REGISTRARSE POR CÓDIGO (01-oct-2026): con `{ porCodigo: true }` en el body —lo mandan
// los formularios del código justo después de verifyOtp— también sale `ensureWelcomeEmail` (una sola
// vez por persona, claim atómico), en waitUntil y ANTES del atajo sin cookie: quien entra por código
// sin informe anónimo también recibe su bienvenida.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { createAdminServiceClient } from "@/lib/admin-auth";
import { tokenAnonDelRequest } from "@/lib/api-helpers/anon-cap";
import { claimAnalisisAnonimos, enviarLeadClaim } from "@/lib/anon-claim";
import { ensureWelcomeEmail } from "@/lib/welcome";
import { captureApiError } from "@/lib/observabilidad";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const cuerpo = (await request.json().catch(() => null)) as { porCodigo?: unknown } | null;
    if (cuerpo?.porCodigo === true && user.email) {
      waitUntil(ensureWelcomeEmail(user.id, user.email, user.user_metadata ?? null));
    }

    const token = tokenAnonDelRequest();
    if (!token) return NextResponse.json({ claimed: 0, redirect: null });

    const result = await claimAnalisisAnonimos(createAdminServiceClient(), user, token);

    if (result.claimed > 0) {
      const cookieStore = cookies();
      const leadCtx = {
        eventSourceUrl: new URL(request.url).origin,
        clientIp:
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request.headers.get("x-real-ip"),
        userAgent: request.headers.get("user-agent"),
        fbp: cookieStore.get("_fbp")?.value ?? null,
        fbc: cookieStore.get("_fbc")?.value ?? null,
      };
      waitUntil(enviarLeadClaim(user, leadCtx));
    }

    return NextResponse.json(result);
  } catch (error) {
    captureApiError(error, { ruta: "POST /api/analisis/claim", operacion: "claim-anonimo" });
    // Fail-soft: un claim caído no debe romper el flujo de auth del caller.
    // La red de seguridad del provider lo reintenta en la próxima carga.
    return NextResponse.json({ claimed: 0, redirect: null });
  }
}
