import { normalizarResultsStrPersistidos } from "@/lib/analysis/normalizar-results-str";
import { loadAirbnbEstimateCrudo } from "@/lib/airbnb/get-estimate";
import { buildZonaStr } from "@/lib/zona-str";
import { fechaProsaVigente } from "@/lib/pipeline-timing";
import { redirect } from "next/navigation";
import { esDemo } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { getUFValue } from "@/lib/uf";
import { getUserAccessLevel } from "@/lib/access";
import { simularStrDesdePersistido } from "@/lib/analysis/simular-str";
import { getAvailableCredits } from "@/lib/credits-grant";
import { isAdminUser } from "@/lib/admin";
import { STRResultsClient } from "./results-client";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import { recomputeShortTermForLegacy } from "@/lib/analysis/recompute-short-term-for-legacy";
import { prefetchMercadoStr } from "@/lib/api-helpers/analisis-pipeline";
import { conOcupacionRealizadaDelCache } from "@/lib/airbnb/ocupacion-realizada-cache";
import type { StrRefZonaSnapshot } from "@/lib/strref-zona";
import { sha256Hex, tokenAnonDelRequest } from "@/lib/api-helpers/anon-cap";

/**
 * EL INFORME STR, fuera de la ruta (25-sep-2026). Espejo de `InformeLtr`: lo dibujan
 * `/analisis/renta-corta/[id]` y el demo público (`/demo/renta-corta`), recalculado por el motor.
 * `demo` solo quita la barra del informe (la ruta del demo pone la suya con el selector); el
 * acceso completo de las filas del demo sale del id (`esDemo`), también por su URL.
 */
export async function InformeStr({ id, demo = false }: { id: string; demo?: boolean }) {
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
    .eq("id", id)
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
    redirect(`/analisis/${id}`);
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
  const isPremium = isAdmin || esDemo(data.id) || !!data.is_premium;

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
  } else if (esDemo(data.id)) {
    // El demo público: completo para cualquiera, también por su URL (`src/lib/demo.ts`).
    accessLevel = "premium";
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
    subordinatedHref,
    showCtaWelcome,
    isAnonOwner,
    simulacionStr,
    zonaStr,
    demo,
  };

  return <STRResultsClient {...sharedProps} />;
}
