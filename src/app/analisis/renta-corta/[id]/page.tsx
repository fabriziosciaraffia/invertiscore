import { normalizarResultsStrPersistidos } from "@/lib/analysis/normalizar-results-str";
import { loadAirbnbEstimateCrudo } from "@/lib/airbnb/get-estimate";
import { buildZonaStr } from "@/lib/zona-str";
import { fechaProsaVigente } from "@/lib/pipeline-timing";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUFValue } from "@/lib/uf";
import { getUserAccessLevel } from "@/lib/access";
import { simularStrDesdePersistido } from "@/lib/analysis/simular-str";
import { getAvailableCredits } from "@/lib/credits-grant";
import { isAdminUser } from "@/lib/admin";
import { STRResultsClient } from "./results-client";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import { normalizeLegacyVerdict } from "@/lib/types";
import { recomputeShortTermForLegacy, veredictoStrRecomputado } from "@/lib/analysis/recompute-short-term-for-legacy";
import { prefetchMercadoStr } from "@/lib/api-helpers/analisis-pipeline";
import { conOcupacionRealizadaDelCache } from "@/lib/airbnb/ocupacion-realizada-cache";
import type { StrRefZonaSnapshot } from "@/lib/strref-zona";
import { sha256Hex, tokenAnonDelRequest } from "@/lib/api-helpers/anon-cap";
import { etiquetaAnalisis } from "@/lib/format-direccion";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createClient();
  const { data } = await supabase
    .from("analisis")
    // `input_data` y `created_at` entran para poder RECOMPUTAR el veredicto (ver abajo). Esta
    // query es propia de la metadata —no comparte nada con el cuerpo de la página— así que
    // sumarle dos columnas a un SELECT que ya se hace no agrega un viaje a la base.
    .select("nombre, comuna, results, input_data, created_at, mediana_comuna_snapshot")
    .eq("id", params.id)
    .single();

  if (!data) {
    return {
      title: "Franco — Análisis de renta corta",
      robots: { index: false, follow: false },
    };
  }

  // La demanda de la zona del score: las filas que no la guardaron la leen del caché de AirROI,
  // igual que el cuerpo de la página (si no, el título diría otro veredicto).
  const results = await conOcupacionRealizadaDelCache(data.input_data as Record<string, unknown> | null, data.results as ShortTermResult | null);
  // ⛔ EL TÍTULO RECOMPUTA, COMO EL CUERPO (17-sep-2026).
  //
  // Citaba `data.results.veredicto`, la columna persistida, mientras el cuerpo de la MISMA
  // página corre `recomputeShortTermForLegacy`. Los dos números salen de motores distintos en
  // momentos distintos, y cada vez que el motor se recalibra el persistido se queda donde
  // estaba. Medido sobre el parque el 17-sep: **8 de 251 filas (3,2%)** con el persistido
  // distinto del recomputado, y las 8 cambian la ETIQUETA que se imprime —5 BUSCAR OTRO →
  // AJUSTAR, 2 AJUSTAR → COMPRAR, 1 BUSCAR OTRO → COMPRAR—. O sea: la pestaña del navegador y
  // el preview del link decían COMPRAR sobre un informe que adentro dice AJUSTAR, y quien
  // comparte el link comparte la versión vieja.
  //
  // La UF es la CONGELADA, igual que en el cuerpo (`precioCompra / precioCompraUF`), y la
  // fecha es `created_at`: si la metadata usara la UF viva daría otro veredicto que la página.
  // `veredictoStrRecomputado` es la misma función que usa el recompute del cuerpo, así que no
  // hay dos fórmulas. Desde el 22-sep-2026 (variante B) el exit descuenta el sobreprecio contra
  // la mediana comunal, así que la mediana SÍ entra: la del snapshot persistido, sin segundo
  // viaje. Filas sin snapshot recomputan sin descuento acá y con él en el cuerpo (que la
  // prefetchea): en el parque del 22-sep ninguna cambia de veredicto por eso.
  //
  // Si el recompute no puede (legacy sin `airbnbRaw`, o sin los dos campos de precio) cae al
  // persistido — que es exactamente lo que hace el cuerpo, así que los dos siguen coincidiendo.
  const inputStr = data.input_data as Record<string, unknown> | null;
  const precioCompraUF = Number(inputStr?.precioCompraUF) || 0;
  const precioCompraCLP = Number(inputStr?.precioCompra) || 0;
  const recomputado =
    precioCompraUF > 0 && precioCompraCLP > 0
      ? veredictoStrRecomputado(
          inputStr,
          results as { airbnbRaw?: unknown } | null,
          precioCompraCLP / precioCompraUF,
          new Date(data.created_at ?? new Date().toISOString()),
          (() => { const snap = data.mediana_comuna_snapshot as { mediana?: number | null; n?: number } | null; return snap ? { mediana: snap.mediana ?? null, n: snap.n ?? 0 } : undefined; })(),
        )
      : null;
  // Commit 1 · 2026-05-11: normalizar veredicto legacy en metadata.
  // Goal 10a: en <title> y meta va la etiqueta (BUSCAR OTRO / AJUSTAR / COMPRAR), no el valor.
  const veredicto = etiquetaVeredicto(
    normalizeLegacyVerdict(recomputado?.francoScore.veredicto ?? results?.veredicto),
    "banda",
    "Análisis",
  );
  // Misma regla que el título LTR: la comuna autoritativa se pega si el nombre
  // libre no la nombra (ver `etiquetaAnalisis`).
  // T3 (05-sep-2026): el nombre libre de las filas STR ya empieza con "Renta Corta - …", así
  // que el título salía "Renta Corta: Renta Corta - …". Se quita ese prefijo antes de la etiqueta.
  const nombreSinPrefijo = (data.nombre ?? "").replace(/^\s*renta\s+corta\s*[-–·:]\s*/i, "");
  const title = `Renta Corta: ${etiquetaAnalisis(nombreSinPrefijo, data.comuna)} — ${veredicto}`;
  const description = `Análisis de renta corta en ${data.comuna}. Veredicto: ${veredicto}.`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";

  return {
    title,
    description,
    // Informes de usuarios: nunca indexables (misma regla que el LTR).
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "article",
      url: `${siteUrl}/analisis/renta-corta/${params.id}`,
      siteName: "Franco",
      // El informe STR no tiene OG personalizado (el /api/og es solo LTR):
      // va la imagen de marca para que el share en WhatsApp no salga pelado.
      images: ["/opengraph-image"],
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function STRResultPage({
  params,
}: {
  params: { id: string };
}) {
  // El PDF ya no usa esta página en modo print: navega a la vista documento
  // dedicada /analisis/renta-corta/[id]/documento (server-rendered). Esta ruta
  // es siempre la vista interactiva completa.

  const supabase = createClient();

  const [{ data: { user } }, ufValue] = await Promise.all([
    supabase.auth.getUser(),
    getUFValue(),
  ]);

  const { data } = await supabase
    .from("analisis")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!data) {
    redirect(user ? "/dashboard" : "/");
  }

  // La demanda de la zona del score (factibilidad): las filas anteriores a que se guardara la leen
  // del caché de AirROI; nada se escribe en la base (23-sep-2026).
  const persistedResults = await conOcupacionRealizadaDelCache(
    data.input_data as Record<string, unknown> | null,
    normalizarResultsStrPersistidos(data.results as (ShortTermResult & { tipoAnalisis?: string }) | null),
  );

  // Commit E.1 · 2026-05-13 — guard simétrico LTR↔STR.
  // Antes solo se chequeaba results.tipoAnalisis (jsonb). Ahora se valida
  // PRIMERO la columna SQL `tipo_analisis` (más confiable) y luego el flag
  // jsonb para back-compat con análisis pre-migration 20260510.
  const tipoCol = (data as Record<string, unknown>).tipo_analisis;
  if (tipoCol === "long-term" || (tipoCol == null && persistedResults?.tipoAnalisis !== "short-term")) {
    redirect(`/analisis/${params.id}`);
  }

  // Salvavidas: si quedamos en la rama STR pero `results` es null (registro
  // corrupto), mandamos al dashboard antes de pasar null al client component.
  if (!persistedResults) {
    redirect(user ? "/dashboard" : "/");
  }

  // Recompute-on-load (espejo LTR, rama comparabilidad-motores). El motor STR
  // evolucionó (patrimonio sin flujo, equity/multiplicador homologados, inflación);
  // recomputamos desde input_data + airbnbRaw congelado para que las filas persistidas
  // reflejen la verdad actual SIN escribir la DB. UF y fecha CONGELADAS a la creación
  // (precioCompra/precioCompraUF + created_at) → idempotente. Si falta airbnbRaw (legacy
  // irreconstruible), `recompute` es null y caemos al persistido tal cual.
  const inputDataStr = data.input_data as Record<string, unknown> | null;
  const precioCompraUF = Number(inputDataStr?.precioCompraUF) || 0;
  const precioCompraCLP = Number(inputDataStr?.precioCompra) || 0;
  const ufFrozen = precioCompraUF > 0 ? precioCompraCLP / precioCompraUF : ufValue;
  const asOfFrozen = new Date(data.created_at ?? new Date().toISOString());
  const medianaStr = inputDataStr
    ? await prefetchMercadoStr(
        supabase,
        {
          comuna: (inputDataStr.comuna as string) ?? "",
          superficie: Number(inputDataStr.superficieUtil) || 0,
          dormitorios: Number(inputDataStr.dormitorios) || 0,
          esNuevo: inputDataStr.tipoPropiedad === "nuevo",
          antiguedad: typeof inputDataStr.antiguedad === "number" ? inputDataStr.antiguedad : undefined,
        },
        ufFrozen,
        ((data as Record<string, unknown>).strref_zona_snapshot as StrRefZonaSnapshot | null | undefined) ?? null,
      )
    : { mediana: null, n: 0 };
  const recomputed = recomputeShortTermForLegacy(
    inputDataStr,
    persistedResults,
    ufFrozen,
    asOfFrozen,
    medianaStr,
  );
  const results = (recomputed ?? persistedResults) as ShortTermResult & { tipoAnalisis?: string };

  // Access level determination (same pattern as LTR)
  const isAdmin = isAdminUser(user?.email);
  const isLoggedIn = !!user;
  const isOwner = user?.id === data.user_id && data.user_id !== null;
  const isSharedView = isLoggedIn && !isOwner && !isAdmin;
  // Anónimo-DUEÑO (cap F2-2): espejo de /analisis/[id] — cookie httpOnly de
  // este navegador calza con el hash de la fila sin dueño.
  const anonToken = !isLoggedIn ? tokenAnonDelRequest() : null;
  const anonHash = (data as Record<string, unknown>).anon_claim_token_hash as string | null | undefined;
  const isAnonOwner =
    !isLoggedIn && data.user_id === null && !!anonToken && !!anonHash &&
    sha256Hex(anonToken) === anonHash;
  const isPremium = isAdmin || !!data.is_premium;

  const userTier = user ? await getUserAccessLevel(user.id) : "guest";

  let userCredits = 0;
  let welcomeAvailable = true;
  if (user) {
    // SALDO real = ledger + legacy vía getAvailableCredits (mismo fix que
    // /analisis/[id], /cuenta, /perfil). welcome sale del contador.
    const { data: credits } = await supabase
      .from("user_credits")
      .select("welcome_credit_used")
      .eq("user_id", user.id)
      .single();
    welcomeAvailable = !(credits?.welcome_credit_used ?? false);
    userCredits = await getAvailableCredits(user.id, supabase);
  }

  let accessLevel: "guest" | "free" | "premium" | "subscriber";
  if (isAdmin) {
    accessLevel = "subscriber";
  } else if (isAnonOwner) {
    // Anónimo-dueño: informe completo (el cap entrega el análisis entero).
    accessLevel = "premium";
  } else if (!isLoggedIn) {
    accessLevel = "guest";
  } else if (userTier === "subscriber") {
    accessLevel = "subscriber";
  } else if (isSharedView) {
    accessLevel = data.is_premium ? "premium" : "free";
  } else {
    accessLevel = isPremium ? "premium" : "free";
  }

  // Subordinación AMBAS (migración 20260715): si esta fila STR es hijo de un
  // par, resolvemos el hermano LTR por group_id para el link al comparativo y
  // ocultar el share propio. Hermano ausente (huérfano) → análisis suelto.
  let subordinatedHref: string | null = null;
  const strRole = (data as Record<string, unknown>).ambas_role as string | null | undefined;
  const strGroupId = (data as Record<string, unknown>).ambas_group_id as string | null | undefined;
  if (strRole === "str" && strGroupId) {
    const { data: sibling } = await supabase
      .from("analisis")
      .select("id")
      .eq("ambas_group_id", strGroupId)
      .eq("ambas_role", "ltr")
      .maybeSingle();
    if (sibling?.id) {
      subordinatedHref = `/analisis/comparativa?ltr=${sibling.id}&str=${data.id}`;
    }
  }

  // Fase D — hijo STR BLOQUEADO de un par AMBAS: espejo de LTR. El resumen vive
  // como MODAL sobre el comparativo; el acceso directo por URL a un hijo bloqueado
  // redirige al comparativo con el modal abierto (?ver=str). Íntegro (unlocked /
  // subscriber) y standalone → página completa. El PDF ya no pasa por acá.
  const isUnlocked = !!(data as Record<string, unknown>).ambas_unlocked_at;
  const isSubordinated = !!subordinatedHref;
  const childBlocked =
    isSubordinated &&
    accessLevel !== "subscriber" &&
    (isOwner ? !isUnlocked : true);
  if (childBlocked && subordinatedHref) {
    redirect(`${subordinatedHref}&ver=str`);
  }

  // La prosa IA salió del informe (25-sep-2026) y ya no se genera; no se juzga su versión.
  const strAiPersisted = data.ai_analysis;

  // CTA post-análisis welcome: espejo del gate LTR — columna charge_mode
  // escrita al crear (opción B; históricos NULL → false). Solo dueño.
  const showCtaWelcome =
    isOwner &&
    (data as Record<string, unknown>).charge_mode === "welcome";
  // ⛔ ACÁ VIVIÓ EL RECOMPUTE DE `nivelesPlazo` (17→21-sep-2026), la cañería de la escalera del
  // pie reusada para la línea del plazo. La línea salió de «Cómo lo pagas» el 21-sep y va al
  // pop-up de la recomendación (cola-popup-interes-total-del-credito): hasta que se monte
  // ahí, no hay consumidor y no se calcula. `simularPlazoStr` sigue en su módulo.

  // SIMULACIONES DEL CONGELADO (T0 · 04-sep-2026): fronteras de los diales y las dos
  // matrices, en el server por la misma razón que la escalera. Nada se bisecciona en el
  // render; T1 las consume.
  const simulacionStr = (() => {
    const raw = data.input_data as Record<string, unknown> | null;
    const uf = Number(raw?.ufCongelada) || ufFrozen;
    if (!raw || !data.created_at || !(uf > 0)) return null;
    try {
      return simularStrDesdePersistido(raw, results as unknown as { airbnbRaw?: unknown }, uf, new Date(data.created_at), medianaStr);
    } catch {
      return null;
    }
  })();

  // LA ZONA (T2 · 05-sep-2026): tarifa, ocupación y contra quién te comparan, con
  // procedencia, calculadas ACÁ. Los 25 avisos parecidos viven en `airbnb_estimates`
  // (raw_response.comparable_listings) y se buscan por la misma llave de caché que usó
  // el estimate; sin fila, la celda dice "sin datos suficientes". Cero llamadas al modelo.
  const zonaStr = await (async () => {
    const raw = data.input_data as Record<string, unknown> | null;
    if (!raw) return null;
    try {
      // Cliente admin adentro del loader (RLS sin políticas en airbnb_estimates), acotado por cache_key.
      const estimate = await loadAirbnbEstimateCrudo({
        direccion: String(raw.direccion ?? ""),
        comuna: String(raw.comuna ?? data.comuna ?? ""),
        dormitorios: Number(raw.dormitorios) || 0,
        banos: Number(raw.banos) || 0,
        huespedes: Number(raw.capacidadHuespedes) || 2,
      });
      return buildZonaStr({ results: results as unknown as ShortTermResult, inputData: raw, comuna: String(data.comuna ?? ""), estimate, createdAt: String(data.created_at) });
    } catch {
      return null;
    }
  })();

  const sharedProps = {
    analysisId: data.id,
    results,
    inputData: data.input_data,
    accessLevel,
    ufValue: ufFrozen,
    nombre: data.nombre ?? "",
    comuna: data.comuna ?? "",
    ciudad: data.ciudad ?? "",
    superficie: data.superficie ?? 0,
    createdAt: data.created_at ?? "",
    fechaProsa: fechaProsaVigente((data as Record<string, unknown>).pipeline_timing, "str") ?? undefined,
    userId: user?.id ?? null,
    isSharedView,
    userCredits,
    welcomeAvailable,
    aiAnalysisInitial: strAiPersisted ? data.ai_analysis : null,
    subordinatedHref,
    showCtaWelcome,
    isAnonOwner,
    simulacionStr,
    zonaStr,
  };

  return <STRResultsClient {...sharedProps} />;
}
