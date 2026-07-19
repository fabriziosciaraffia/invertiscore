import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import type { AnalisisInput } from "@/lib/types";
import { runAnalysis } from "@/lib/analysis";
import { getUFValue } from "@/lib/uf";
import { sendAnalysisReadyEmail } from "@/lib/email";
import { resolveDisplayName, ensureWelcomeEmail } from "@/lib/welcome";
import { generateAiAnalysis } from "@/lib/ai-generation";
import { readVeredicto } from "@/lib/results-helpers";
import {
  createSupabaseServer,
  requireAuthenticatedUser,
  ensureCreditCharged,
  markPremiumAndClaimPrepaid,
  prefetchMedianaComunaVenta,
  buildMedianaSnapshot,
} from "@/lib/api-helpers/analisis-pipeline";

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServer();

    const auth = await requireAuthenticatedUser(supabase);
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const body: AnalisisInput & { prepaidChargeId?: string; ambasGroupId?: string } = await request.json();
    const prepaidChargeId = body.prepaidChargeId;
    // Enlace AMBAS (flujo crédito/welcome): el wizard genera el group_id y lo
    // pasa a los dos POSTs (LTR + STR). Acá es el lado LTR → rol 'ltr'. Se valida
    // como uuid; junk se ignora (fila queda suelta). El hermano se resuelve por
    // group_id en el dashboard y las páginas hijas — un fallo parcial (STR no se
    // crea) deja este group_id sin hermano y esas lecturas lo degradan a suelto.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const ambasGroupId =
      typeof body.ambasGroupId === "string" && UUID_RE.test(body.ambasGroupId)
        ? body.ambasGroupId
        : null;

    const charge = await ensureCreditCharged({ user, prepaidChargeId });
    if (!charge.ok) return charge.response;
    const { prepaidNeedClaim } = charge;

    // Pasar UF actual explícitamente al motor (antes era módulo-level mutable;
    // ver audit/sesionA-residual-2/diagnostico.md).
    const ufValue = await getUFValue();
    // Pre-fetch async de la mediana comunal de venta UF/m² para inyectarla al
    // motor síncrono (patrón cap_rate). Defensivo: cae a null sin romper.
    const medianaComuna = await prefetchMedianaComunaVenta(supabase, body, ufValue);
    const result = runAnalysis(body, ufValue, medianaComuna);

    const dbClient = supabase;

    const { data, error } = await dbClient
      .from("analisis")
      .insert({
        user_id: user.id,
        nombre: body.nombre,
        comuna: body.comuna,
        ciudad: body.ciudad,
        direccion: body.direccion || null,
        tipo: body.tipo,
        tipo_analisis: "long-term",
        // Commit E.1 · 2026-05-13: análisis nuevos usan metodología v2
        // (thresholds 70/45/0 unificados · slider 3 segmentos · sin fallback
        // score 50). Análisis pre-Commit-E quedan como v1 (legacy preservation).
        methodology_version: "v2",
        dormitorios: body.dormitorios,
        banos: body.banos,
        superficie: body.superficie,
        antiguedad: body.antiguedad,
        precio: body.precio,
        arriendo: body.arriendo,
        gastos: body.gastos,
        contribuciones: body.contribuciones,
        score: result.score,
        desglose: result.desglose,
        resumen: result.resumen,
        results: result,
        input_data: body,
        // Snapshot de la mediana resuelta acá (Fase A): fuente única futura para
        // sobreprecio/hero/prosa/zona. Nadie lo lee aún (Fase B cablea lecturas).
        mediana_comuna_snapshot: buildMedianaSnapshot(medianaComuna),
        creator_name: user?.user_metadata?.nombre || user?.user_metadata?.full_name || null,
        // Enlace AMBAS: solo cuando el wizard pasó un group_id válido (lado LTR).
        ...(ambasGroupId ? { ambas_group_id: ambasGroupId, ambas_role: "ltr" } : {}),
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: "Error al guardar el análisis" },
        { status: 500 },
      );
    }

    // Marcar análisis como premium tras cobro exitoso (o admin bypass).
    // Backlog #3: TODOS los análisis del registrado son premium completos
    // — el welcome credit otorga el mismo nivel que un crédito comprado.
    if (data?.id) {
      await markPremiumAndClaimPrepaid({
        dbClient,
        analysisId: data.id,
        prepaidChargeId,
        prepaidNeedClaim,
      });
      data.is_premium = true;
    }

    // Trabajo diferido tras el response. waitUntil (@vercel/functions) garantiza
    // que corra hasta terminar en serverless — un IIFE fire-and-forget sin await
    // puede morir cuando se envía el response (mismo motivo por el que
    // payments/confirm awaitea su IA). Orden deliberado: welcome → ready → IA.
    // El ready va ANTES de generateAiAnalysis: no depende de la IA (score y
    // veredicto ya están en `result`; el hero es on-demand vía @vercel/og), así
    // no queda detrás de una llamada lenta/colgada. El response NO se bloquea.
    if (data?.id) {
      const analysisId = data.id;
      waitUntil((async () => {
        // Welcome email idempotente: garantiza que un usuario que llega directo
        // a /analisis/nuevo-v2 (vía deep-link o el héroe del onboarding) sin
        // pasar por /dashboard igual lo reciba. ensureWelcomeEmail usa el claim
        // atómico de welcome_email_sent, así que es seguro dispararlo también
        // acá: envía a lo sumo una vez por usuario (no duplica con /dashboard).
        if (user.email) {
          await ensureWelcomeEmail(
            user.id,
            user.email,
            resolveDisplayName(user.user_metadata, user.email),
          );
        }
        if (user.email) {
          try {
            // Variante AMBAS: si esta fila (LTR) pertenece a un par, resolvemos el
            // hermano STR por ambas_group_id para que el correo anuncie la
            // COMPARATIVA y su CTA lleve a la vista comparativa. El hermano se crea
            // en PARALELO (Promise.allSettled en el wizard) y ahora el ready va
            // antes de la IA, así que puede no existir aún → reintento acotado
            // (máx 2 intentos, ≤5s total, en background). Si no aparece, fallback
            // al correo de análisis suelto (mejor genérico que silencio). Solo el
            // lado LTR envía (el endpoint STR no manda ready-email → sin duplicado).
            let ambas: { ltrId: string; strId: string } | undefined;
            if (ambasGroupId) {
              for (let attempt = 0; attempt < 2; attempt++) {
                const { data: sibling } = await dbClient
                  .from("analisis")
                  .select("id")
                  .eq("ambas_group_id", ambasGroupId)
                  .eq("ambas_role", "str")
                  .maybeSingle();
                if (sibling?.id) {
                  ambas = { ltrId: analysisId, strId: sibling.id };
                  break;
                }
                if (attempt === 0) await new Promise((r) => setTimeout(r, 2500));
              }
            }
            await sendAnalysisReadyEmail(
              user.email,
              resolveDisplayName(user.user_metadata, user.email),
              body.nombre || `${body.comuna} - ${body.superficie}m²`,
              result.score,
              readVeredicto(result) || (result.score >= 70 ? "COMPRAR" : result.score >= 45 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA"),
              analysisId,
              ambas,
            );
          } catch (e) {
            console.error("Analysis email error:", e);
          }
        }
        // IA al final (no bloquea la notificación). El page la recupera vía
        // polling /ai-status si acá falla. generateAiAnalysis intacto.
        try {
          await generateAiAnalysis(analysisId, dbClient);
        } catch (e) {
          console.error("Background AI generation failed:", e);
        }
      })());
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
