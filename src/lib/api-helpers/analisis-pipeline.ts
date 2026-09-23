// Helpers compartidos entre /api/analisis (LTR) y /api/analisis/short-term
// (STR). Extraídos para reducir duplicación: ~80 líneas idénticas viven en
// ambos endpoints.
//
// Patrón:
//   1. createSupabaseServer()      — server-side Supabase client con cookies.
//   2. createPaymentsAdminClient() — admin client para validar/claim payments.
//   3. requireAuthenticatedUser()  — auth gate, returns 401 NextResponse if no user.
//   4. guardPlausibilidad()        — 422 si el input es aritméticamente
//                                    imposible. SIEMPRE antes de cobrar.
//   5. ensureCreditCharged()       — handle prepaid charge OR cobro normal,
//                                    con admin bypass.
//   6. markPremiumAndClaimPrepaid()— post-insert: mark is_premium=true +
//                                    claim del prepaid charge si aplica.

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { chargeAnalysisCredit } from "@/lib/access";
import { isAdminUser } from "@/lib/admin";
import { resolverCapRefComunaVivo } from "@/lib/capref-comuna-query";
import type { CapRefComunaSnapshot } from "@/lib/capref-comuna";
import { resolverStrRefZonaVivo } from "@/lib/strref-zona-query";
import type { StrRefZonaSnapshot } from "@/lib/strref-zona";
import {
  getComunaMedianaVentaUF,
  resolverCondicionMercado,
  type CondicionMercado,
  type MedianaComunaVenta,
  type MedianaComunaInyectada,
} from "@/lib/comuna-stats";
import { evaluarPlausibilidad, type Anomalia, type PlausibilidadInput } from "@/lib/plausibilidad";
import { redondearPiePct } from "@/lib/analysis/pie-input-data";
import { METHODOLOGY_VERSION_ACTUAL } from "@/lib/modelo-costos";
import type { AnalisisInput, RazonSinCapital } from "@/lib/types";
import {
  calcShortTerm,
  type ShortTermInputs,
  type TipoEdificioSTR,
  type HabilitacionSTR,
} from "@/lib/engines/short-term-engine";
import { calcFrancoScoreSTR, type ScoreSTRInputs } from "@/lib/engines/short-term-score";
import { buildStrHallazgos, mergeHallazgosStr } from "@/lib/str-hallazgos";
import { getAirbnbEstimate } from "@/lib/airbnb/get-estimate";

// ─── Pre-fetch de mediana comunal (para inyectar al motor) ───

/**
 * Pre-fetch defensivo de la mediana comunal de venta UF/m² (scraped_properties)
 * para inyectarla al motor SÍNCRONO (calcMetrics/runAnalysis) igual que ufClp.
 * Centraliza el try/catch: un fallo de la query NO debe romper la creación o el
 * recálculo del análisis — cae a { mediana: null, n: 0 } y el motor emite
 * precioVsComuna con sujetoUfM2 presente y desviación null.
 *
 * El UNIVERSO (nuevo|usado) se deriva acá del propio input, así que todos los
 * bordes que ya pasaban el input completo quedan segmentados sin tocarlos. Los
 * bordes STR, que arman un literal con comuna/superficie/dormitorios, pueden
 * pasar `esNuevo`/`antiguedad` explícitos; si no los pasan cae a "usado", que es
 * el universo del ~96% del inventario y el comportamiento previo.
 */
export async function prefetchMedianaComunaVenta(
  supabase: SupabaseClient,
  input: Pick<AnalisisInput, "comuna" | "superficie" | "dormitorios"> &
    Partial<Pick<AnalisisInput, "esNuevo" | "antiguedad">>,
  ufValue: number
): Promise<MedianaComunaVenta & { capRefComuna: CapRefComunaSnapshot | null }> {
  const condicion = resolverCondicionMercado(input);
  // La referencia de cap rate de la comuna se resuelve JUNTO con la mediana (mismo dato: el
  // mercado de la comuna, ya resuelto, que el motor recibe): todo caller de este prefetch —
  // creación, recalculate, comparativa, filas viejas sin snapshot— la obtiene sin cablear nada.
  const [mediana, capRefComuna] = await Promise.all([
    (async () => {
      try {
        return await getComunaMedianaVentaUF(supabase, input.comuna, input.superficie, input.dormitorios, ufValue, condicion);
      } catch (e) {
        console.error("[prefetchMedianaComunaVenta] falló (no bloquea el análisis):", e);
        return { mediana: null, n: 0, universo: condicion, ventanaDias: null, p25: null, p75: null } as MedianaComunaVenta;
      }
    })(),
    prefetchCapRefComuna(supabase, input, ufValue),
  ]);
  return { ...mediana, capRefComuna };
}

/**
 * El mercado de la comuna para un análisis STR: la mediana de venta (sobreprecio) y la referencia
 * STR contra STR de la zona (strref-zona-query.ts), que alimenta el umbral de rentabilidad_str.
 * Con `snapshot` (la fila ya lo persistió) no se resuelve vivo: la foto fija gana, como en LTR.
 * Defensivo: si la referencia falla queda null y el hallazgo declara «sin referencia».
 */
export async function prefetchMercadoStr(
  supabase: SupabaseClient,
  input: Pick<AnalisisInput, "comuna" | "superficie" | "dormitorios"> &
    Partial<Pick<AnalisisInput, "esNuevo" | "antiguedad">>,
  ufValue: number,
  snapshot?: StrRefZonaSnapshot | null,
): Promise<MedianaComunaVenta & { strRefZona: StrRefZonaSnapshot | null }> {
  const condicion = resolverCondicionMercado(input);
  const [mediana, strRefZona] = await Promise.all([
    (async () => {
      try {
        return await getComunaMedianaVentaUF(supabase, input.comuna, input.superficie, input.dormitorios, ufValue, condicion);
      } catch (e) {
        console.error("[prefetchMercadoStr] mediana falló (no bloquea el análisis):", e);
        return { mediana: null, n: 0, universo: condicion, ventanaDias: null, p25: null, p75: null } as MedianaComunaVenta;
      }
    })(),
    (async () => {
      if (snapshot) return snapshot;
      try {
        return await resolverStrRefZonaVivo(supabase, { comuna: input.comuna, dormitorios: input.dormitorios }, ufValue);
      } catch (e) {
        console.error("[prefetchMercadoStr] referencia STR de la zona falló (sin referencia):", e);
        return null;
      }
    })(),
  ]);
  return { ...mediana, strRefZona };
}

/**
 * Referencia de cap rate de la comuna (capref-comuna-query.ts), defensiva: null si la
 * resolución falla, y el motor cae al promedio nacional declarándolo. Se usa sola cuando la
 * fila ya tiene snapshot de mediana pero no de referencia (filas anteriores al 21-sep-2026).
 */
export async function prefetchCapRefComuna(
  supabase: SupabaseClient,
  input: Pick<AnalisisInput, "comuna" | "superficie" | "dormitorios"> &
    Partial<Pick<AnalisisInput, "esNuevo" | "antiguedad">>,
  ufValue: number,
): Promise<CapRefComunaSnapshot | null> {
  try {
    return await resolverCapRefComunaVivo(supabase, input, ufValue);
  } catch (e) {
    console.error("[prefetchCapRefComuna] falló (no bloquea el análisis):", e);
    return null;
  }
}

/** Shape persistido en analisis.mediana_comuna_snapshot (ver migración
 * 20260627). Snapshot determinista de la mediana resuelta al crear; las
 * superficies que comparan precio vs comuna lo leerán como fuente única (Fase B).
 * `nivel` = "prefetch" porque hoy la única fuente es prefetchMedianaComunaVenta. */
export interface MedianaComunaSnapshot {
  mediana: number | null;
  n: number;
  resolvedAt: string;
  nivel: string;
  /** Universo de la muestra (nuevo|usado). OPCIONAL: los snapshots anteriores al
   *  fix de segmentación no lo tienen, y su mediana es de universo MIXTO. Ausente
   *  ⇒ la prosa no declara universo (no se le pone etiqueta a un número que no la
   *  tiene). Ver sobreprecio-hallazgo.ts. */
  universo?: CondicionMercado;
  /** Cuartiles UF/m² de la misma muestra que la mediana (21-sep-2026). OPCIONALES: los
   *  snapshots anteriores no los tienen y el motor no les inventa posición. Sin ellos
   *  «caro» es la misma frase en Providencia y en Santiago centro. */
  p25?: number | null;
  p75?: number | null;
}

/** Envuelve el `{ mediana, n }` del prefetch con el timestamp y el nivel de
 * procedencia, en el shape único que persisten los flujos de creación. */
export function buildMedianaSnapshot(
  resuelta: { mediana: number | null; n: number; universo?: CondicionMercado; p25?: number | null; p75?: number | null }
): MedianaComunaSnapshot {
  return {
    mediana: resuelta.mediana,
    n: resuelta.n,
    resolvedAt: new Date().toISOString(),
    nivel: "prefetch",
    ...(resuelta.universo ? { universo: resuelta.universo } : {}),
    // Se persisten aunque sean null: distingue «se midió y no alcanzó» de «snapshot
    // anterior al campo», que es ausencia.
    ...(resuelta.p25 !== undefined ? { p25: resuelta.p25 } : {}),
    ...(resuelta.p75 !== undefined ? { p75: resuelta.p75 } : {}),
  };
}

// ─── Clients ───────────────────────────────────────────

export function createSupabaseServer() {
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
              cookieStore.set(name, value, options),
            );
          } catch {
            // ignored in route handler
          }
        },
      },
    },
  );
}

export function createPaymentsAdminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── Auth gate ─────────────────────────────────────────

export interface AuthOk {
  ok: true;
  user: User;
}
export interface AuthErr {
  ok: false;
  response: NextResponse;
}

/**
 * Resuelve el user autenticado del request o devuelve 401.
 * El caller hace `if (!auth.ok) return auth.response;` y luego usa `auth.user`.
 */
export async function requireAuthenticatedUser(
  supabase: SupabaseClient,
): Promise<AuthOk | AuthErr> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Debes iniciar sesión para crear un análisis" },
        { status: 401 },
      ),
    };
  }
  return { ok: true, user };
}

// ─── Guard de plausibilidad (PRE-COBRO) ────────────────

export interface PlausibilidadOk {
  ok: true;
}
export interface PlausibilidadErr {
  ok: false;
  response: NextResponse;
}

/**
 * Gate de plausibilidad. Va SIEMPRE entre el parse del body y
 * `ensureCreditCharged`: si el input es aritméticamente imposible no se cobra
 * el crédito ni se inserta la fila.
 *
 * Motivo (auditoría PIEZA A): los endpoints hacían `request.json()` y llamaban
 * a cobrar sin validar nada. Un precio de UF 4.800.000 (tipeo de UF 4.800) se
 * procesaba completo y cobraba. Como el cobro ocurre ANTES del insert y no hay
 * rollback, ese crédito se perdía sin dejar fila.
 *
 * 422 (no 400): el body está bien formado, lo que no es procesable es su
 * contenido. El caller hace `if (!guard.ok) return guard.response;`.
 *
 * El `console.error` es deliberado y no un error real: es la señal para contar
 * cuántas veces dispara en prod la primera semana y decidir si los rangos están
 * bien calibrados. Prefijo `[PLAUSIBILIDAD]` para grepear en los logs de Vercel.
 */
export function guardPlausibilidad(
  input: PlausibilidadInput,
  // `userId` opcional (cap anónimo F2-2): la rama anónima valida igual que la
  // logueada — el guard no depende de la identidad, solo la loguea.
  ctx: { userId: string | undefined; ruta: string },
): PlausibilidadOk | PlausibilidadErr {
  const anomalias: Anomalia[] = evaluarPlausibilidad(input);
  if (anomalias.length === 0) return { ok: true };

  console.error(
    `[PLAUSIBILIDAD] rechazo ${ctx.ruta} · user=${ctx.userId ?? "anon"} · reglas=${anomalias
      .map((a) => a.regla)
      .join(",")}`,
    JSON.stringify(anomalias.map((a) => ({ regla: a.regla, campo: a.campo, valor: a.valor }))),
  );

  return {
    ok: false,
    response: NextResponse.json(
      { error: "input_implausible", anomalias },
      { status: 422 },
    ),
  };
}

// ─── Credit charge ─────────────────────────────────────

/** Vía por la que se pagó el análisis. Espejo del `mode` de chargeAnalysisCredit
 *  más `admin` (bypass, que nunca llega a cobrar). Solo `welcome` significa que
 *  el usuario estrenó su análisis de bienvenida. */
export type ChargeMode = "welcome" | "paid" | "subscription" | "admin";

export interface ChargeOk {
  ok: true;
  /** True cuando llegamos PRIMERO al claim del prepaid charge (flujo AMBAS).
   * Caller debe llamar markPremiumAndClaimPrepaid con prepaidNeedClaim=true. */
  prepaidNeedClaim: boolean;
  /** Cómo se pagó ESTE análisis. Lo consumen los endpoints para el evento Lead
   * de Meta (solo `welcome` dispara). Aditivo: los callers destructuran parcial. */
  mode: ChargeMode;
}
export interface ChargeErr {
  ok: false;
  response: NextResponse;
}

/**
 * Maneja el cobro de crédito unificado:
 *   - Si viene `prepaidChargeId`: valida contra payments. Permite consume si
 *     intent='both'. Marca prepaidNeedClaim=true si somos los primeros.
 *   - Si NO viene prepaidChargeId y NO es admin: cobra crédito vía
 *     `chargeAnalysisCredit`.
 *   - Si NO viene y ES admin: bypass, no cobra.
 *
 * Devuelve además el `mode` (cómo se pagó): del propio chargeAnalysisCredit en el
 * cobro normal, de payment_data.mode en el prepago AMBAS, y "admin" en el bypass.
 */
export async function ensureCreditCharged(opts: {
  user: User;
  prepaidChargeId?: string | null;
}): Promise<ChargeOk | ChargeErr> {
  const { user, prepaidChargeId } = opts;
  const isAdmin = isAdminUser(user.email);

  if (prepaidChargeId) {
    const paymentsAdmin = createPaymentsAdminClient();
    const { data: charge } = await paymentsAdmin
      .from("payments")
      .select("payment_data, consumed_at")
      .eq("commerce_order", prepaidChargeId)
      .eq("user_id", user.id)
      .eq("status", "paid")
      .maybeSingle();

    if (!charge) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Charge inválido o no encontrado" },
          { status: 403 },
        ),
      };
    }

    // El `mode` real del cobro AMBAS lo persistió /api/credits/charge en
    // payment_data junto al intent; acá solo lo leemos (el cobro ya ocurrió).
    // Un valor ausente o desconocido cae a "paid" — el fallback conservador: no
    // dispara Lead. Preferimos perder un evento antes que inventar un welcome.
    const paymentData = charge.payment_data as
      | { intent?: string; mode?: string }
      | null;
    const prepaidMode: ChargeMode =
      paymentData?.mode === "welcome" ||
      paymentData?.mode === "subscription" ||
      paymentData?.mode === "admin"
        ? paymentData.mode
        : "paid";

    if (charge.consumed_at === null) {
      return { ok: true, prepaidNeedClaim: true, mode: prepaidMode };
    }

    // Ya consumido: solo permitido si intent='both' (segundo análisis del flujo AMBAS).
    if (paymentData?.intent !== "both") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Charge ya consumido" },
          { status: 403 },
        ),
      };
    }
    return { ok: true, prepaidNeedClaim: false, mode: prepaidMode };
  }

  if (!isAdmin) {
    const charge = await chargeAnalysisCredit(user.id, null);
    if (!charge.ok) {
      return {
        ok: false,
        response: NextResponse.json({ error: charge.message }, { status: 403 }),
      };
    }
    return { ok: true, prepaidNeedClaim: false, mode: charge.mode };
  }
  return { ok: true, prepaidNeedClaim: false, mode: "admin" };
}

// ─── Post-insert: premium + claim ──────────────────────

/**
 * Marca el análisis como premium y, si el caller llegó primero al claim del
 * prepaid charge (prepaidNeedClaim=true), lo claim-ea de forma idempotente.
 * El UPDATE con `.is('consumed_at', null)` garantiza que el segundo POST del
 * flujo AMBAS no sobrescribe el claim del primero.
 */
export async function markPremiumAndClaimPrepaid(opts: {
  dbClient: SupabaseClient;
  analysisId: string;
  prepaidChargeId?: string | null;
  prepaidNeedClaim: boolean;
}): Promise<void> {
  const { dbClient, analysisId, prepaidChargeId, prepaidNeedClaim } = opts;

  await dbClient.from("analisis").update({ is_premium: true }).eq("id", analysisId);

  if (prepaidChargeId && prepaidNeedClaim) {
    const paymentsAdmin = createPaymentsAdminClient();
    await paymentsAdmin
      .from("payments")
      .update({
        consumed_at: new Date().toISOString(),
        consumed_by_analysis_id: analysisId,
      })
      .eq("commerce_order", prepaidChargeId)
      .is("consumed_at", null);
  }
}

// ─── STR: AirROI → motor → row (compartido inline ⇄ locked) ────────────
//
// buildShortTermAnalysisRow corre el bloque medio del análisis STR
// (getAirbnbEstimate → buildAirbnbData → calcShortTerm → calcFrancoScoreSTR →
// armado del row) y devuelve los campos computados del row SIN decidir
// is_premium / pending_payment / user_id / creator_name (eso lo resuelve cada
// ruta). Es el espejo STR de runAnalysis (LTR), pero async porque incluye el
// fetch a AirROI. Vive acá para que getAirbnbEstimate tenga UN solo call-site
// (key AirROI sin drift de hash), compartido por /api/analisis/short-term
// (inline cobrado) y /api/analisis/locked (STR bloqueado pre-pago).

/** Distribución mensual plana — 1/12 cada mes (fallback). */
// `buildAirbnbData` (y sus dos ayudantes) se mudaron a `@/lib/analysis/airbnb-data`: son
// puros y este archivo arrastra `next/headers`, que los volvía inimportables desde el
// cliente. Se re-exportan para que ningún llamador cambie.
import { buildAirbnbData } from "@/lib/analysis/airbnb-data";
export { buildAirbnbData };


/** Shape del body STR que consume el helper. El call-site pasa el payload del
 * wizard (request.json()); los campos passthrough al motor usan los tipos del
 * engine para typecheck estricto sin `any`. */
export interface ShortTermAnalysisBody {
  direccion: string;
  comuna?: string;
  ciudad?: string;
  tipoPropiedad?: string;
  /** Antigüedad real en años (la manda nuevo-v2). Ausente en renta-corta legacy
   * → el pipeline deriva un fallback (usado=5) y marca confianza baja. */
  antiguedad?: number;
  dormitorios: number;
  banos: number;
  superficieUtil: number;
  capacidadHuespedes?: number;
  precioCompra: number;
  precioCompraUF: number;
  piePct: number;
  /** Fase 5b · origen del pie 0 declarado en el wizard (solo con piePct === 0). */
  razonSinPie?: RazonSinCapital;
  /** Entrega futura declarada en el wizard. El motor todavía NO la usa (paso 3);
   *  viaja para persistirse en input_data y quedar disponible. */
  estadoVenta?: "inmediata" | "futura";
  fechaEntrega?: string;
  tasaInteres: number;
  /** Tasa hipotecaria de mercado vigente (%, ej. 4,72). OPCIONAL: solo v4.
   *  Alimenta subsidioTasa. Ausente ⇒ fallback en el motor (idéntico al previo). */
  tasaMercado?: number;
  plazoCredito: number;
  modoGestion: "auto" | "administrador";
  comisionAdministrador: number;
  tipoEdificio?: TipoEdificioSTR;
  habilitacion?: HabilitacionSTR;
  adminPro?: boolean;
  adrOverride?: number | null;
  occOverride?: number | null;
  costoElectricidad: number;
  costoAgua: number;
  costoWifi: number;
  costoInsumos: number;
  gastosComunes: number;
  mantencion: number;
  contribuciones?: number;
  estaAmoblado?: boolean;
  costoAmoblamiento?: number;
  arriendoLargoMensual: number;
  lat?: number;
  lng?: number;
}

export type BuildShortTermRowResult =
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; response: NextResponse };

/**
 * Corre el bloque medio del análisis STR y devuelve los campos del row (sin
 * is_premium / pending_payment / user_id / creator_name). Devuelve
 * `{ ok:false, response }` con el mismo contrato HTTP que tenía el endpoint
 * inline (502 si AirROI cae, 400 si no hay datos) — el caller hace
 * `if (!built.ok) return built.response`.
 */
export async function buildShortTermAnalysisRow(
  body: ShortTermAnalysisBody,
  ufValue: number,
  /** Mediana comunal de venta UF/m² pre-fetcheada (sobreprecio de la pirámide STR). Si el
   *  caller no la resuelve, el hallazgo de sobreprecio se omite (N−1) — patrón LTR. */
  medianaComuna?: MedianaComunaInyectada,
  /** Colector de timing (Goal A): objeto mutable del caller. Solo medición —
   *  esta función escribe airroi_ms/airroi_cache/motor_ms y nada más. */
  timing?: { airroi_ms?: number; airroi_cache?: "hit" | "miss"; motor_ms?: number },
): Promise<BuildShortTermRowResult> {
  // Precisión canónica del pie (fix pie-redondeo, defensa en profundidad): este
  // body alimenta el motor (piePercent) y se persiste crudo en input_data. El
  // wizard ya redondea; acá se cubre cualquier otro cliente. Único punto para
  // los dos callers (short-term y locked STR).
  if (Number.isFinite(body.piePct)) body.piePct = redondearPiePct(body.piePct);
  // AirROI directo (sin sub-fetch HTTP). Único call-site de getAirbnbEstimate.
  let airbnbResult;
  const tAirroi = Date.now();
  try {
    airbnbResult = await getAirbnbEstimate(
      body.direccion,
      body.comuna ?? "",
      body.dormitorios,
      body.banos,
      body.capacidadHuespedes || 2,
      { origen: "informe" },
    );
    if (timing) {
      timing.airroi_ms = Date.now() - tAirroi;
      if (airbnbResult.success) timing.airroi_cache = airbnbResult.cached ? "hit" : "miss";
    }
  } catch (err) {
    console.error("[short-term] AirROI lib threw:", err);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Estimación de Airbnb no disponible. Intenta de nuevo en unos segundos." },
        { status: 502 },
      ),
    };
  }

  if (!airbnbResult.success) {
    console.error("[short-term] AirROI failed:", airbnbResult.error, airbnbResult.message);
    // Diferenciar AirROI down (502) vs caso legítimo sin data (400)
    if (airbnbResult.error === "airbnb_api_error") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Estimación de Airbnb no disponible. Intenta de nuevo en unos segundos." },
          { status: 502 },
        ),
      };
    }
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No se encontraron datos de Airbnb para esta dirección. Verifica que sea una dirección válida en Santiago." },
        { status: 400 },
      ),
    };
  }

  const tMotor = Date.now();
  const airbnbData = buildAirbnbData(airbnbResult.data, ufValue);

  // Antigüedad: real si el payload la trae (nuevo-v2); fallback derivado si no
  // (renta-corta legacy). El flag de fallback viaja al motor para que el hallazgo
  // de puesta a punto declare confianza baja solo cuando la edad es estimada.
  const antiguedadEsFallback = body.antiguedad == null;
  const antiguedadResuelta = body.antiguedad ?? (body.tipoPropiedad === "nuevo" ? 0 : 5);

  const inputs: ShortTermInputs = {
    // Gate del modelo de costos (curva de CapEx). Mismo valor que se persiste en
    // input_data abajo, para que el recompute-on-load reconstruya idéntico.
    methodologyVersion: METHODOLOGY_VERSION_ACTUAL,
    precioCompra: body.precioCompra,
    superficie: body.superficieUtil,
    // Variante B (22-sep-2026): la mediana comunal entra al motor para el sobreprecio en la venta.
    medianaComunaUfM2: medianaComuna?.mediana ?? null,
    medianaN: medianaComuna?.n ?? 0,
    dormitorios: body.dormitorios,
    banos: body.banos,
    tipoPropiedad: typeof body.tipoPropiedad === "string" ? body.tipoPropiedad : undefined,
    antiguedad: antiguedadResuelta,
    antiguedadEsFallback,
    comuna: typeof body.comuna === "string" ? body.comuna : undefined,
    piePercent: body.piePct / 100,
    // Fase 5b: origen del pie 0 (wizard → payload → motor → prompt).
    razonSinPie: body.razonSinPie,
    tasaCredito: body.tasaInteres / 100,
    // Tasa de mercado real (v4, % → decimal). Ausente en legacy ⇒ motor cae al fallback.
    tasaMercado: typeof body.tasaMercado === "number" ? body.tasaMercado / 100 : undefined,
    plazoCredito: body.plazoCredito,
    airbnbData,
    modoGestion: body.modoGestion,
    comisionAdministrador: body.comisionAdministrador,
    tipoEdificio: body.tipoEdificio,
    habilitacion: body.habilitacion,
    adminPro: body.adminPro === true,
    adrOverride: typeof body.adrOverride === "number" ? body.adrOverride : null,
    occOverride: typeof body.occOverride === "number" ? body.occOverride : null,
    costoElectricidad: body.costoElectricidad,
    costoAgua: body.costoAgua,
    costoWifi: body.costoWifi,
    costoInsumos: body.costoInsumos,
    gastosComunes: body.gastosComunes,
    mantencion: body.mantencion,
    contribuciones: body.contribuciones || 0,
    costoAmoblamiento: body.estaAmoblado ? 0 : (body.costoAmoblamiento || 0),
    arriendoLargoMensual: body.arriendoLargoMensual,
    valorUF: ufValue,
    // Entrega: declarada, no modelada. `calcShortTerm` no la lee todavía —
    // ver la nota de ShortTermInputs. Se mapea acá para que el contrato quede
    // completo desde el borde y el paso 3 no tenga que volver a tocarlo.
    estadoVenta: body.estadoVenta,
    fechaEntrega: body.fechaEntrega,
  };

  // asOf congelada y COMPARTIDA con el closure de distancia al veredicto: si cada uno
  // llamara a `new Date()` por su cuenta, en un borde de fecha de entrega la distancia se
  // mediría contra un asOf distinto del que produjo el resultado.
  const asOfPipeline = new Date();
  const result = calcShortTerm(inputs, asOfPipeline);

  // Default lat/lng a Santiago centro si no vienen (distancias a atractores).
  const lat = typeof body.lat === "number" ? body.lat : -33.4378;
  const lng = typeof body.lng === "number" ? body.lng : -70.6504;

  const ingresoMensualScore = Array.isArray(airbnbData.monthly_revenue) ? airbnbData.monthly_revenue : [];

  const scoreInputs: ScoreSTRInputs = {
    results: result,
    precioCompra: body.precioCompra,
    dormitorios: body.dormitorios,
    superficie: body.superficieUtil,
    lat,
    lng,
    ingresoMensualScore,
    // La demanda de la zona (factibilidad): la ocupación realizada de los comparables que AirROI
    // devolvió para esta estimación, la misma que se guarda en `ocupacionRealizadaComparables`.
    ocupacionRealizadaP50: airbnbResult.realizedOccupancy && airbnbResult.realizedOccupancy.n > 0 ? airbnbResult.realizedOccupancy.p50 : null,
  };

  const francoScore = calcFrancoScoreSTR(scoreInputs);

  // Pirámide STR (E.1b): ensambla los hallazgos con decisividad de las 4 dims del score y los
  // concatena con el capex ya sembrado por calcShortTerm (result.hallazgos). Persistido en
  // results.hallazgos; el render STR lee lo persistido (no recomputa como LTR).
  const strHallazgos = buildStrHallazgos({
    result,
    francoScore,
    comuna: typeof body.comuna === "string" ? body.comuna : "",
    precioUF: body.precioCompraUF,
    superficieM2: body.superficieUtil,
    piePct: body.piePct,
    tasaPct: body.tasaInteres,
    plazoAnios: body.plazoCredito,
    mediana: medianaComuna ?? { mediana: null, n: 0 },
    valorUF: ufValue,
    incluyeCorretaje: false, // STR: capitalInvertido = pie + cierre + amoblamiento + capex, sin corretaje
    // Distancia al veredicto: mismo `inputs` y mismos extras del score que produjeron el
    // veredicto de arriba — una sola ruta, sin posibilidad de divergencia.
    veredictoCtx: {
      inputs,
      scoreExtras: {
        dormitorios: scoreInputs.dormitorios,
        superficie: scoreInputs.superficie,
        lat: scoreInputs.lat,
        lng: scoreInputs.lng,
        ingresoMensualScore: scoreInputs.ingresoMensualScore,
        ocupacionRealizadaP50: scoreInputs.ocupacionRealizadaP50,
      },
      asOf: asOfPipeline,
    },
  });
  const hallazgosSTR = mergeHallazgosStr(result.hallazgos, strHallazgos);
  if (timing) timing.motor_ms = Date.now() - tMotor;

  const nombre = `Renta Corta - ${body.direccion || body.comuna}`;

  return {
    ok: true,
    row: {
      nombre,
      comuna: body.comuna,
      ciudad: body.ciudad || "Santiago",
      direccion: body.direccion || null,
      tipo: "Departamento",
      tipo_analisis: "short-term",
      // Referencia STR contra STR de la zona, resuelta en el mismo prefetch (foto fija; la
      // migración 20260921b_strref_zona_snapshot.sql va ANTES del deploy).
      strref_zona_snapshot: medianaComuna?.strRefZona ?? null,
      // Sep-2026: v3 = modelo de costos recalibrado (curva de CapEx en rango).
      // Espejo de input_data.methodologyVersion (abajo), que es lo que lee el
      // motor. Requiere la migración 20260903_methodology_version_v3.sql
      // aplicada ANTES del deploy, o el INSERT viola el CHECK.
      methodology_version: METHODOLOGY_VERSION_ACTUAL,
      dormitorios: body.dormitorios,
      banos: body.banos,
      superficie: body.superficieUtil,
      antiguedad: antiguedadResuelta,
      precio: body.precioCompraUF,
      arriendo: body.arriendoLargoMensual,
      gastos: body.gastosComunes,
      contribuciones: body.contribuciones || 0,
      score: francoScore.score,
      desglose: francoScore.desglose,
      resumen: francoScore.veredicto,
      // `ocupacionRealizadaComparables` es DISPLAY-ONLY: se adjunta acá, fuera
      // de calcShortTerm/calcFrancoScoreSTR, por lo que NO toca el veredicto.
      // Vive en el helper para que single (short-term/route) y pre-pago
      // (analisis/locked) lo persistan por igual.
      results: {
        ...result,
        hallazgos: hallazgosSTR, // pirámide STR completa (capex + 11 propios/heredados)
        tipoAnalisis: "short-term",
        veredicto: francoScore.veredicto,
        francoScore,
        airbnbRaw: airbnbResult.data,
        ...(airbnbResult.realizedOccupancy
          ? { ocupacionRealizadaComparables: airbnbResult.realizedOccupancy }
          : {}),
      },
      // P2 snapshot (Rama 0b): congelamos la UF viva del server al crear. Hoy las filas STR
      // no guardan la UF real del día (a diferencia de LTR, reconstruible vía precioCLP/precio),
      // así que precioCompra/precioCompraUF puede venir del fallback cliente (~38.800). `ufCongelada`
      // deja el dato registrado para reconstrucción futura y para homologar la base CLP con LTR en
      // el comparativo. Aditivo: no toca precioCompra/precioCompraUF (el ancla UF-vs-CLP del wizard
      // es ambiguo server-side), así que no distorsiona precios entrados en CLP.
      input_data: { ...body, tipoAnalisis: "short-term", ufCongelada: ufValue, methodologyVersion: METHODOLOGY_VERSION_ACTUAL },
    },
  };
}
