import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

const ACTIONS = {
  "update-market": "/api/data/update-market",
  "calculate-stats": "/api/data/calculate-stats",
  "geocode": "/api/data/geocode-toctoc",
} as const;

type ActionKey = keyof typeof ACTIONS;

export async function POST(request: Request) {
  try {
    // Gate compartido: mismo 403 { error: "No autorizado" } que antes.
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;

    const body = await request.json();
    const action = body?.action as ActionKey;
    if (!action || !(action in ACTIONS)) {
      return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
    }

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    // Build absolute URL for self-call
    const origin = new URL(request.url).origin;
    const target = `${origin}${ACTIONS[action]}`;

    const res = await fetch(target, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${cronSecret}`,
        "Content-Type": "application/json",
      },
    });

    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json({ error: `Error ${res.status}: ${text.slice(0, 200)}` }, { status: 500 });
    }

    // 207 = parcial (ver el criterio en cron-resultado.ts): la corrida hizo
    // algo, pero no todo. Colapsarlo en `ok: true` era el motivo por el que el
    // botón "Actualizar UF/Tasa" mostraba el check verde aunque la UF no se
    // hubiera escrito — el proxy solo miraba `res.ok`, y 207 es 2xx.
    //
    // Se propaga como bandera y no como status propio: el proxy respondió bien,
    // lo parcial es el resultado de la acción. El cliente decide cómo mostrarlo.
    const parcial = res.status === 207;
    return NextResponse.json({ ok: !parcial, parcial, result: text.slice(0, 500) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
