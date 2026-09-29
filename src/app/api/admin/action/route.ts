import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

const ACTIONS = {
  "update-market": "/api/data/update-market",
  // "calculate-stats" se retiró junto con market_stats (2026-08).
  // "geocode" (→ /api/data/geocode-toctoc) se retiró el 03-sep-2026: la ruta salió
  // del cron en ce65743 y solo quemaba reintentos (ver admin-actions.tsx).
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
    // Parcial (ver cron-resultado.ts): la corrida hizo algo, pero no todo. Hasta el 29-sep-2026 venía
    // como 207; desde entonces toda falla responde 500 y lo parcial viaja en el body (`resultado`).
    // Se propaga como bandera y no como status propio: el cliente decide cómo mostrarlo.
    let resultado: string | null = null;
    try { resultado = (JSON.parse(text) as { resultado?: string }).resultado ?? null; } catch { /* body no JSON */ }
    const parcial = resultado === "parcial";
    if (!res.ok && !parcial) {
      return NextResponse.json({ error: `Error ${res.status}: ${text.slice(0, 200)}` }, { status: 500 });
    }
    return NextResponse.json({ ok: !parcial, parcial, result: text.slice(0, 500) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
