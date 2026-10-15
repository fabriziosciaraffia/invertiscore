// ─────────────────────────────────────────────────────────────────────────────
// POST /api/analisis/claim — adopción de análisis anónimos (F2-2)
//
// Requiere sesión. Lee la cookie httpOnly `franco_anon` (viaja sola en el
// request; el client no la ve ni la manda) y delega en el núcleo compartido
// `claimAnalisisAnonimos`. Sin cookie → { claimed: 0 } rápido: los call-sites
// (login, register, red de seguridad del provider) lo llaman a ciegas.
//
// LA PUERTA (15-oct-2026): el formulario que reclama manda por dónde entró la cuenta (`{ puerta, puertaDetalle }`:
// el banner del informe y la tarjeta de la guía mandan A) y queda en `user_attribution` (atribucion-puerta.ts).
// El Lead de Meta ya no sale acá: desde el 15-oct-2026 Lead es «dejó su correo» (/api/meta/lead, el ticket).
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
import { claimAnalisisAnonimos } from "@/lib/anon-claim";
import { guardarAtribucion } from "@/lib/attribution";
import { esPuerta } from "@/lib/atribucion-puerta";
import { ensureWelcomeEmail } from "@/lib/welcome";
import { captureApiError } from "@/lib/observabilidad";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const cuerpo = (await request.json().catch(() => null)) as { porCodigo?: unknown; puerta?: unknown; puertaDetalle?: unknown } | null;
    if (cuerpo?.porCodigo === true && user.email) {
      waitUntil(ensureWelcomeEmail(user.id, user.email, user.user_metadata ?? null));
    }
    const puerta = cuerpo?.puerta;
    if (esPuerta(puerta)) {
      const detalle = typeof cuerpo?.puertaDetalle === "string" ? cuerpo.puertaDetalle.slice(0, 60) : null;
      waitUntil(guardarAtribucion(createAdminServiceClient(), user.id, { puerta, puerta_detalle: detalle }).then(() => undefined));
    }

    const token = tokenAnonDelRequest();
    if (!token) return NextResponse.json({ claimed: 0, redirect: null });

    const result = await claimAnalisisAnonimos(createAdminServiceClient(), user, token);
    return NextResponse.json(result);
  } catch (error) {
    captureApiError(error, { ruta: "POST /api/analisis/claim", operacion: "claim-anonimo" });
    // Fail-soft: un claim caído no debe romper el flujo de auth del caller.
    // La red de seguridad del provider lo reintenta en la próxima carga.
    return NextResponse.json({ claimed: 0, redirect: null });
  }
}
