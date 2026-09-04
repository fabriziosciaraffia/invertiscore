// ─────────────────────────────────────────────────────────────────────────────
// LA ZONA · STR (T2 · 05-sep-2026) — un solo objeto con procedencia para la sección y
// el drawer "Explorar". Se calcula en el server (page.tsx) y el render solo dibuja.
//
// Fuentes, cada una con su n y su fecha:
//   · tarifaZona    — la mediana de tarifa que estima el mercado para este depto
//                     (results.zonaSTR.adrZona) contra la tuya (metrics.tarifaNoche).
//   · ocupacion     — la tuya (estimada o definida por ti) contra lo típico de la comuna
//                     (universo Franco V2: results.zonaSTR.comunaOcupacion {valor, n, fecha}).
//   · comparables   — los 25 avisos parecidos que devolvió el proveedor de datos de
//                     mercado (airbnb_estimates.raw_response.comparable_listings, por la misma
//                     llave de caché del estimate): cuántos, cuántos superhost, hasta qué
//                     distancia, estadía típica y la fecha de esa consulta. Son "contra quién
//                     te comparan", no "cuántos compiten": el proveedor elige 25 parecidos,
//                     nunca se dice "más de 25".
//   · tipologia     — lo que declaraste del depto, en una línea.
//   · lugares       — los atractores cercanos del dataset Franco (sin IA).
//   · perfiles      — los perfiles de huésped ORDENADOS por calcGuestProfile, con la
//                     descripción fija de PERFIL_DESCRIPCION. Sin porcentajes: el share
//                     normalizado entre perfiles no es un dato.
// Nada de acá entra al prompt ni al score.
// ─────────────────────────────────────────────────────────────────────────────
import type { ShortTermResult } from "./engines/short-term-engine";
import { distanciaMetros, getNearbyAttractors } from "./data/attractors";
import { calcGuestProfile, PERFIL_DESCRIPCION, PERFIL_LABEL, type PerfilHuespedSTR } from "./str-guest-profile";

export interface DatoConProcedencia {
  valor: number;
  n: number;
  fecha: string;
}

export interface AvisoZona {
  /** Tarifa promedio cobrada en 12 meses (CLP/noche). */
  tarifa: number | null;
  /** Ocupación realizada en 12 meses (0-1). */
  ocupacion: number | null;
  /** Estadía promedio en noches. */
  estadiaNoches: number | null;
  superhost: boolean;
  distanciaM: number | null;
  resenas: number | null;
  nota: number | null;
  dormitorios: number | null;
}

export interface ZonaStr {
  tarifaZona: { mediana: number; tuya: number; esTuya: boolean; posicion: "arriba" | "abajo" | "igual"; n: number | null; fecha: string } | null;
  ocupacion: { tuya: number; esTuya: boolean; comuna: DatoConProcedencia | null; relacion: "mas" | "menos" | "similar" | "sin_datos" };
  comparables: { n: number; nSuperhost: number; radioM: number | null; estadiaNoches: number | null; fecha: string } | null;
  tipologia: string;
  lugares: { nombre: string; tipo: string; distanciaM: number }[];
  perfiles: { perfil: PerfilHuespedSTR; label: string; descripcion: string }[];
  /** Los avisos en detalle para el drawer (mismo n que `comparables`). */
  avisos: AvisoZona[];
}

/** Fila cruda del estimate, ya reducida a lo que La zona lee. */
export interface EstimateCrudo {
  createdAt: string;
  listings: unknown[];
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

type RawListing = {
  host_info?: { superhost?: boolean };
  location_info?: { latitude?: number; longitude?: number };
  performance_metrics?: { ttm_avg_rate?: number; ttm_occupancy?: number; ttm_avg_length_of_stay?: number; ttm_revenue?: number };
  ratings?: { num_reviews?: number; rating_overall?: number };
  property_details?: { bedrooms?: number };
};

export function avisosDesdeListings(listings: unknown[], lat: number | null, lng: number | null): AvisoZona[] {
  return (listings as RawListing[]).map((l) => {
    const la = num(l.location_info?.latitude);
    const lo = num(l.location_info?.longitude);
    return {
      tarifa: num(l.performance_metrics?.ttm_avg_rate),
      ocupacion: num(l.performance_metrics?.ttm_occupancy),
      estadiaNoches: num(l.performance_metrics?.ttm_avg_length_of_stay),
      superhost: l.host_info?.superhost === true,
      distanciaM: lat != null && lng != null && la != null && lo != null ? Math.round(distanciaMetros(lat, lng, la, lo)) : null,
      resenas: num(l.ratings?.num_reviews),
      nota: num(l.ratings?.rating_overall),
      dormitorios: num(l.property_details?.bedrooms),
    };
  });
}

export function buildZonaStr(p: {
  results: ShortTermResult;
  inputData: Record<string, unknown>;
  comuna: string;
  estimate: EstimateCrudo | null;
  createdAt: string;
}): ZonaStr {
  const { results: r, inputData: d, comuna } = p;
  const m = r.metrics;
  const base = r.escenarios.base;
  const lat = num(d.lat);
  const lng = num(d.lng);
  const fechaEstimate = p.estimate?.createdAt ?? p.createdAt;

  // ── comparables ──
  const avisos = p.estimate ? avisosDesdeListings(p.estimate.listings, lat, lng) : [];
  const distancias = avisos.map((a) => a.distanciaM).filter((x): x is number => x != null);
  const comparables =
    avisos.length > 0
      ? {
          n: avisos.length,
          nSuperhost: avisos.filter((a) => a.superhost).length,
          radioM: distancias.length ? Math.max(50, Math.ceil(Math.max(...distancias) / 50) * 50) : null,
          estadiaNoches: (() => {
            const md = median(avisos.map((a) => a.estadiaNoches).filter((x): x is number => x != null && x > 0));
            return md != null ? Math.round(md * 10) / 10 : null;
          })(),
          fecha: fechaEstimate,
        }
      : null;

  // ── tarifa ──
  const tuya = m?.tarifaNoche ?? r.ejesAplicados?.adrFinal ?? base.adrReferencia;
  const mediana = r.zonaSTR?.adrZona ?? null;
  const tarifaZona =
    mediana != null && mediana > 0 && tuya > 0
      ? {
          mediana,
          tuya,
          esTuya: r.adrFuente === "override",
          posicion: (Math.abs(tuya - mediana) / mediana < 0.01 ? "igual" : tuya > mediana ? "arriba" : "abajo") as "arriba" | "abajo" | "igual",
          n: comparables?.n ?? null,
          fecha: fechaEstimate,
        }
      : null;

  // ── ocupación ──
  const occTuya = m?.ocupacion ?? r.ejesAplicados?.ocupacionFinal ?? base.ocupacionReferencia;
  const comunaOcc = r.zonaSTR?.comunaOcupacion ?? null;
  const ocupacion = {
    tuya: occTuya,
    esTuya: r.occFuente === "override",
    comuna: comunaOcc ? { valor: comunaOcc.valor, n: comunaOcc.n, fecha: comunaOcc.fecha } : null,
    relacion: (r.zonaSTR?.ocupacionVsComuna ?? "sin_datos") as ZonaStr["ocupacion"]["relacion"],
  };

  // ── tipología (declarada por ti) ──
  const dorms = num(d.dormitorios);
  const m2 = num(d.superficieUtil);
  const huespedes = num(d.capacidadHuespedes);
  const permite = d.edificioPermiteAirbnb;
  const reglamento = permite === "si" || permite === true ? "el reglamento permite renta corta · declarado por ti, no verificado" : permite === "no" ? "el reglamento no permite renta corta · declarado por ti" : "reglamento del edificio sin confirmar";
  const tipologia = [dorms != null ? `${dorms}D` : null, m2 != null ? `${Math.round(m2)} m²` : null, huespedes != null ? `${huespedes} huéspedes` : null, reglamento].filter(Boolean).join(" · ");

  // ── lugares y perfiles (dataset Franco, sin IA) ──
  const lugares = lat != null && lng != null ? getNearbyAttractors(lat, lng, 1500).slice(0, 6).map((a) => ({ nombre: a.meta ? `${a.nombre} · ${a.meta}` : a.nombre, tipo: a.tipo, distanciaM: Math.round(a.distancia) })) : [];
  const perfiles = (() => {
    if (lat == null || lng == null || !comuna) return [];
    try {
      const g = calcGuestProfile(lat, lng, comuna);
      return g.todos.map((s) => ({ perfil: s.perfil, label: PERFIL_LABEL[s.perfil], descripcion: PERFIL_DESCRIPCION[s.perfil] }));
    } catch {
      return [];
    }
  })();

  return { tarifaZona, ocupacion, comparables, tipologia, lugares, perfiles, avisos };
}
