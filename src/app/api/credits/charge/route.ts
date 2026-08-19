import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { chargeAnalysisCredit } from "@/lib/access";
import { isAdminUser } from "@/lib/admin";
import { AMBAS_ENABLED, AMBAS_OFF_ERROR } from "@/lib/ambas-flag";
import { getUFValue } from "@/lib/uf";
import {
  evaluarPlausibilidad,
  desdeBodyLtr,
  desdeBodyStr,
  type Anomalia,
} from "@/lib/plausibilidad";

/**
 * POST /api/credits/charge — Pre-cobro centralizado para flujo AMBAS.
 *
 * Backlog #3 cont.: el wizard cobra UNA vez antes de disparar los 2 POSTs
 * (LTR + STR) en paralelo. Ambos endpoints LTR/STR aceptan un `prepaidChargeId`
 * en el body que valida contra la fila `payments` creada acá. El primer POST
 * que llega marca el row como consumido (`consumed_at`,
 * `consumed_by_analysis_id`). El segundo POST detecta que el row ya está
 * consumido pero `payment_data.intent === 'both'` y procede sin re-cobrar.
 *
 * Para flujo single (LTR sólo o STR sólo), este endpoint NO se usa — los
 * endpoints cobran ellos mismos vía `chargeAnalysisCredit`.
 *
 * Auth: 401 si no hay user (solo registrados).
 * Admin: bypass del cobro real, igual emite chargeId y mode='subscription'
 * para que el wizard funcione uniformemente.
 */
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
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Intent = "ltr" | "str" | "both";
const VALID_INTENTS: readonly Intent[] = ["ltr", "str", "both"] as const;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const intent = body?.intent as Intent | undefined;
    if (!intent || !VALID_INTENTS.includes(intent)) {
      return NextResponse.json(
        { error: "intent inválido (debe ser ltr, str o both)" },
        { status: 400 },
      );
    }

    // Interruptor de AMBAS. Va ANTES de resolver la sesión a propósito: apagar
    // el comparativo es una decisión de PRODUCTO, no de autorización — la
    // respuesta es la misma para todos, así que preguntar quién eres primero
    // solo agrega una consulta y hace el gate imposible de verificar sin una
    // sesión. No filtra nada: `NEXT_PUBLIC_AMBAS_ENABLED` ya viaja en el bundle.
    //
    // Esto es lo que cierra la puerta al v3 de /analisis/nuevo-v2 —servido y sin
    // enlaces, pero con su camino AMBAS completo— y a cualquier POST a mano.
    if (intent === "both" && !AMBAS_ENABLED) {
      return NextResponse.json({ error: AMBAS_OFF_ERROR }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Debes iniciar sesión para crear un análisis" },
        { status: 401 },
      );
    }

    // Guard de plausibilidad — ANTES de cobrar (PIEZA A).
    //
    // OJO con el alcance real: este endpoint históricamente recibe SOLO
    // `{ intent }`, sin un solo dato de la propiedad, así que no tenía nada que
    // validar. Acepta ahora `ltr` / `str` OPCIONALES — los mismos payloads que
    // el wizard ya construyó para los dos POSTs hijos. Mientras el cliente no
    // los mande, este bloque es no-op y el flujo AMBAS queda protegido recién
    // en los hijos, o sea DESPUÉS del cobro. Wiring del cliente: pendiente de OK.
    if (body?.ltr || body?.str) {
      const ufValue = await getUFValue();
      const anomalias: Anomalia[] = [
        ...(body.ltr ? evaluarPlausibilidad(desdeBodyLtr(body.ltr, ufValue)) : []),
        ...(body.str ? evaluarPlausibilidad(desdeBodyStr(body.str, ufValue)) : []),
      ];
      // Dedup por regla: en AMBAS las dos ramas comparten precio y superficie,
      // así que un precio imposible saldría duplicado.
      const unicas = anomalias.filter(
        (a, i) => anomalias.findIndex((b) => b.regla === a.regla) === i,
      );
      if (unicas.length > 0) {
        console.error(
          `[PLAUSIBILIDAD] rechazo POST /api/credits/charge · user=${user.id} · reglas=${unicas
            .map((a) => a.regla)
            .join(",")}`,
          JSON.stringify(unicas.map((a) => ({ regla: a.regla, campo: a.campo, valor: a.valor }))),
        );
        return NextResponse.json(
          { error: "input_implausible", anomalias: unicas },
          { status: 422 },
        );
      }
    }

    const isAdmin = isAdminUser(user.email);
    let mode: "welcome" | "paid" | "subscription";

    if (isAdmin) {
      // Admin no consume. Reportamos 'subscription' por simetría semántica.
      mode = "subscription";
    } else {
      const charge = await chargeAnalysisCredit(user.id, null);
      if (!charge.ok) {
        return NextResponse.json({ error: charge.message }, { status: 403 });
      }
      mode = charge.mode;
    }

    const chargeId = `charge-${randomUUID()}`;
    const admin = createAdminClient();
    const { error } = await admin.from("payments").insert({
      user_id: user.id,
      commerce_order: chargeId,
      product: "analysis_charge",
      amount: 0,
      status: "paid",
      payment_data: { intent, mode },
    });

    if (error) {
      console.error("[credits/charge] payments insert error:", error);
      // El crédito ya fue descontado pero no pudimos persistir el chargeId.
      // El admin debe reembolsar manualmente. No reintentamos automáticamente
      // para no duplicar el cobro.
      return NextResponse.json(
        { error: "No se pudo registrar el cobro. Contacta a soporte." },
        { status: 500 },
      );
    }

    return NextResponse.json({ chargeId, mode });
  } catch (err) {
    console.error("[credits/charge] error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
