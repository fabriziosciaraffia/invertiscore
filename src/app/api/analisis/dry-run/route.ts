import { NextResponse } from "next/server";
import type { AnalisisInput } from "@/lib/types";
import { getUFValue } from "@/lib/uf";
import {
  createSupabaseServer,
  requireAuthenticatedUser,
  buildAirbnbData,
  type ShortTermAnalysisBody,
} from "@/lib/api-helpers/analisis-pipeline";
import { getAirbnbEstimate } from "@/lib/airbnb/get-estimate";
import type { ShortTermInputs } from "@/lib/engines/short-term-engine";
import {
  evaluarLtr,
  evaluarStr,
  type StrScoreCtx,
  STR_DELTA_TARIFA,
  STR_DELTA_OCC_PP,
} from "@/lib/dry-run/evaluar";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/analisis/dry-run — FASE 5
//
// Corre el motor determinístico (SIN IA, SIN persistir, SIN cobrar) y responde
// SOLO si el análisis está "al filo" y qué variables lo mueven:
//   { alFilo: boolean, variablesSensibles: string[] }
// El score / veredicto / Δ / distancia al borde viven y mueren acá dentro.
//
// Δ elegido por calibración empírica del golden set (GS-2 y BE-sensibilidad
// activan; GS-1 y los robustos no): 5%.
//
// Exige sesión (401). Rate-limit básico ~15/min por user.id. Cualquier fallo →
// { alFilo:false } silencioso (la card es no-bloqueante; el submit no depende).
// ─────────────────────────────────────────────────────────────────────────────

const DELTA = 0.05;
const RL_MAX = 15;
const RL_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const arr = (hits.get(userId) ?? []).filter((t) => now - t < RL_WINDOW_MS);
  arr.push(now);
  hits.set(userId, arr);
  return arr.length > RL_MAX;
}

interface DryRunBody {
  modalidad?: "ltr" | "str" | "both";
  ltr?: AnalisisInput;
  str?: ShortTermAnalysisBody;
  flags?: {
    arriendoEstimacion?: boolean;
    tasaPerturbable?: boolean; // solo si el usuario aceptó la tasa estimada
    tasaEstimacion?: boolean;
    adrEstimacion?: boolean; // false = el usuario corrigió tarifa/ocupación en el Acto 3
  };
}

// Rama STR: reconstruye el input del motor sobre AirROI cacheado (mismo mapeo que
// buildShortTermAnalysisRow, sin persistir ni cobrar) y delega a evaluarStr. Fallo
// silencioso (AirROI caído / sin datos) → sin variables. No toca el builder de
// producción: replica su mapeo, como el calib.
async function evaluarStrBranch(
  str: ShortTermAnalysisBody,
  uf: number,
  asOf: Date,
  esEstimacion: boolean,
): Promise<string[]> {
  const airbnb = await getAirbnbEstimate(
    str.direccion,
    str.comuna ?? "",
    str.dormitorios,
    str.banos,
    str.capacidadHuespedes || 2,
  );
  if (!airbnb.success) return []; // AirROI caído o sin datos → sin card
  const airbnbData = buildAirbnbData(airbnb.data, uf);

  const antiguedadEsFallback = str.antiguedad == null;
  const antiguedadResuelta = str.antiguedad ?? (str.tipoPropiedad === "nuevo" ? 0 : 5);

  const inputs: ShortTermInputs = {
    precioCompra: str.precioCompra,
    superficie: str.superficieUtil,
    dormitorios: str.dormitorios,
    banos: str.banos,
    tipoPropiedad: typeof str.tipoPropiedad === "string" ? str.tipoPropiedad : undefined,
    antiguedad: antiguedadResuelta,
    antiguedadEsFallback,
    comuna: typeof str.comuna === "string" ? str.comuna : undefined,
    piePercent: str.piePct / 100,
    tasaCredito: str.tasaInteres / 100,
    plazoCredito: str.plazoCredito,
    airbnbData,
    modoGestion: str.modoGestion,
    comisionAdministrador: str.comisionAdministrador,
    tipoEdificio: str.tipoEdificio,
    habilitacion: str.habilitacion,
    adminPro: str.adminPro === true,
    adrOverride: typeof str.adrOverride === "number" ? str.adrOverride : null,
    occOverride: typeof str.occOverride === "number" ? str.occOverride : null,
    costoElectricidad: str.costoElectricidad,
    costoAgua: str.costoAgua,
    costoWifi: str.costoWifi,
    costoInsumos: str.costoInsumos,
    gastosComunes: str.gastosComunes,
    mantencion: str.mantencion,
    contribuciones: str.contribuciones || 0,
    costoAmoblamiento: str.estaAmoblado ? 0 : (str.costoAmoblamiento || 0),
    arriendoLargoMensual: str.arriendoLargoMensual,
    valorUF: uf,
  };

  const scoreCtx: StrScoreCtx = {
    precioCompra: str.precioCompra,
    dormitorios: str.dormitorios,
    superficie: str.superficieUtil,
    regulacionEdificio: str.edificioPermiteAirbnb || "no_seguro",
    lat: typeof str.lat === "number" ? str.lat : -33.4378,
    lng: typeof str.lng === "number" ? str.lng : -70.6504,
    revenueP50: airbnbData.percentiles?.revenue?.p50 ?? airbnbData.estimated_annual_revenue ?? 0,
    monthlyRevenue: Array.isArray(airbnbData.monthly_revenue) ? airbnbData.monthly_revenue : [],
  };

  const d = evaluarStr(inputs, scoreCtx, asOf, STR_DELTA_TARIFA, STR_DELTA_OCC_PP, { esEstimacion });
  return d.variablesSensibles;
}

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServer();
    const auth = await requireAuthenticatedUser(supabase);
    if (!auth.ok) return auth.response; // 401
    const { user } = auth;

    if (rateLimited(user.id)) {
      return NextResponse.json({ error: "Demasiadas consultas. Espera un momento." }, { status: 429 });
    }

    const body: DryRunBody = await request.json().catch(() => ({}));
    const flags = body.flags ?? {};
    const uf = await getUFValue();
    const asOf = new Date();

    const variables: string[] = [];

    // Rama LTR (modalidad ltr, o el lado LTR de both).
    if (body.ltr && (body.modalidad === "ltr" || body.modalidad === "both")) {
      const d = evaluarLtr(body.ltr, uf, undefined, asOf, DELTA, {
        perturbarTasa: flags.tasaPerturbable === true,
        arriendoEsEstimacion: flags.arriendoEstimacion,
        tasaEsEstimacion: flags.tasaEstimacion,
      });
      for (const v of d.variablesSensibles) if (!variables.includes(v)) variables.push(v);
    }

    // Rama STR (str / lado STR de both): reconstruye sobre AirROI cacheado y
    // perturba tarifa (±10% rel) + ocupación (±5pp abs). En BOTH se une con LTR.
    if (body.str && (body.modalidad === "str" || body.modalidad === "both")) {
      const strVars = await evaluarStrBranch(
        body.str,
        uf,
        asOf,
        flags.adrEstimacion !== false,
      );
      for (const v of strVars) if (!variables.includes(v)) variables.push(v);
    }

    return NextResponse.json({ alFilo: variables.length > 0, variablesSensibles: variables });
  } catch {
    // Fallo silencioso: sin card, jamás un error visible por el dry-run.
    return NextResponse.json({ alFilo: false, variablesSensibles: [] });
  }
}
