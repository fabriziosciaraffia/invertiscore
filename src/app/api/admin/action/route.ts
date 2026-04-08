import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isAdminUser } from "@/lib/admin";

const ACTIONS = {
  "update-market": "/api/data/update-market",
  "calculate-stats": "/api/data/calculate-stats",
  "geocode": "/api/data/geocode-toctoc",
} as const;

type ActionKey = keyof typeof ACTIONS;

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

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !isAdminUser(user.email)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

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

    return NextResponse.json({ ok: true, result: text.slice(0, 500) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
