// Scoring de perfil de huésped esperado para análisis STR (Commit 2c — 2026-05-12).
//
// Mapea POIs cercanos al depto + comuna a 4 perfiles candidatos:
//   - turista_leisure  : turismo + cultura + nightlife
//   - ejecutivo_corto  : hubs corporativos + metro + accesos
//   - nomada_digital   : universidades + cafés/coworking + zonas residenciales activas
//   - familia          : parques + malls familiares + zona residencial estable
//
// Perfil paciente_medico OMITIDO en Fase 1 — el dataset de clínicas existe pero
// fase 1 requiere data más rica (acompañantes médicos buscan estadías 5-15 días
// con perfil específico; meterlo sin investigación dedicada dejaría false
// positives en cualquier depto a < 1.5km de una clínica grande). Agregar en
// Fase 2 cuando ux-cx-franco apruebe el flow.
//
// La heurística es DEFENDIBLE pero NO definitiva — futuras iteraciones pueden
// incorporar señales adicionales (eventos locales, percentil ADR por tipología,
// estacionalidad). El score se normaliza 0-100; el perfil dominante es el de
// score más alto; secundarios solo aparecen si score > UMBRAL_SECUNDARIO.

import { type Attractor, getNearbyAttractors } from "./data/attractors";

export type PerfilHuespedSTR =
  | "turista_leisure"
  | "ejecutivo_corto"
  | "nomada_digital"
  | "familia";

export const PERFIL_LABEL: Record<PerfilHuespedSTR, string> = {
  turista_leisure: "Turista de leisure",
  ejecutivo_corto: "Ejecutivo en visita corta",
  nomada_digital: "Nómada digital",
  familia: "Familia visitando",
};

export const PERFIL_DESCRIPCION: Record<PerfilHuespedSTR, string> = {
  turista_leisure:
    "Visita Santiago por turismo (2-5 noches). Prioriza ubicación walkable, cerca de barrios con vida (Lastarria, Bellavista, centro histórico), restaurantes y transporte público.",
  ejecutivo_corto:
    "Visita por trabajo (3-7 noches). Prioriza cercanía a zona de negocios (El Golf, Sanhattan, Apoquindo), wifi rápido, escritorio funcional y conexión rápida con aeropuerto.",
  nomada_digital:
    "Estadía media-larga (1-3 meses). Prioriza cocina equipada, lavadora, espacio de trabajo cómodo, internet sólido y barrio activo con cafés.",
  familia:
    "Familia en visita corta (3-5 noches), a veces acompañando a estudiantes o eventos. Prioriza parques cercanos, malls familiares y depto amplio sobre lujo.",
};

export interface PerfilScore {
  perfil: PerfilHuespedSTR;
  score: number;       // 0-100
  porcentaje: number;  // share normalizado entre perfiles activos
  driver: string;      // explicación breve del motivo del score
}

export interface GuestProfileResult {
  dominante: PerfilScore;
  secundarios: PerfilScore[];     // 0-2 secundarios con score > UMBRAL_SECUNDARIO
  todos: PerfilScore[];           // ranking completo
  poisRelevantes: Array<Attractor & { distancia: number; categoria: string }>;
}

// Umbrales (% del max score) para mostrar secundarios. Si el dominante es muy
// claro (e.g. 90 vs 30 vs 20), no mostramos los demás. Si están parejos
// (e.g. 60 vs 55 vs 30), mostramos 1-2 más.
const UMBRAL_SECUNDARIO_PCT = 0.55;

// ── Scoring functions ─────────────────────────────────────────

/**
 * Calcula score 0-100 para cada perfil basado en POIs cercanos + comuna.
 * Cercanía mide proximidad lineal con decay: < 500m = 100%, 1km = 60%, 2km = 20%, > 2km = 0.
 */
function decay(distanciaMetros: number, idealMetros = 1000): number {
  if (distanciaMetros <= 300) return 1.0;
  if (distanciaMetros >= idealMetros * 2.5) return 0;
  // Lineal entre 300m (1.0) y 2.5x ideal (0).
  const max = idealMetros * 2.5;
  return Math.max(0, 1 - (distanciaMetros - 300) / (max - 300));
}

function scoreTurista(
  pois: Array<Attractor & { distancia: number }>,
  comuna: string,
): { score: number; driver: string } {
  const drivers: string[] = [];
  let score = 0;
  // Bonus por comuna turística clásica.
  const comunaTuristica = ["Santiago", "Providencia"].includes(comuna);
  if (comunaTuristica) {
    score += 20;
    drivers.push(`Comuna ${comuna} con tráfico turístico estable`);
  }
  // Cercanía a zonas turísticas (Lastarria/Bellavista/Centro Histórico).
  const turismo = pois.find((p) => p.tipo === "turismo");
  if (turismo) {
    const w = decay(turismo.distancia, 1500);
    if (w > 0) {
      score += w * 40;
      drivers.push(`${turismo.nombre} a ${Math.round(turismo.distancia)}m`);
    }
  }
  // Metro cercano (turistas no manejan).
  const metro = pois.find((p) => p.tipo === "metro");
  if (metro) {
    const w = decay(metro.distancia, 800);
    score += w * 25;
    if (w > 0.5) drivers.push(`Metro ${metro.nombre} a ${Math.round(metro.distancia)}m`);
  }
  // Parque cultural cercano.
  const parque = pois.find((p) => p.tipo === "parque");
  if (parque && parque.distancia < 1200) {
    score += 10;
    drivers.push(`Parque ${parque.nombre}`);
  }
  // Cap a 100.
  score = Math.min(100, score);
  return {
    score,
    driver: drivers.length > 0 ? drivers.slice(0, 2).join(" + ") : "Demanda turística baja para esta zona",
  };
}

function scoreEjecutivo(
  pois: Array<Attractor & { distancia: number }>,
  comuna: string,
): { score: number; driver: string } {
  const drivers: string[] = [];
  let score = 0;
  // Comunas con tráfico corporativo histórico.
  const comunaCorp = ["Las Condes", "Vitacura", "Providencia"].includes(comuna);
  if (comunaCorp) {
    score += 25;
    drivers.push(`Comuna ${comuna} con flujo corporativo`);
  }
  // Cercanía a hubs de negocios (Sanhattan, Nueva Las Condes, Centro Financiero).
  const hub = pois.find((p) => p.tipo === "negocios");
  if (hub) {
    const w = decay(hub.distancia, 1500);
    if (w > 0) {
      score += w * 50;
      drivers.push(`${hub.nombre} a ${Math.round(hub.distancia)}m`);
    }
  }
  // Metro útil para movilidad.
  const metro = pois.find((p) => p.tipo === "metro");
  if (metro) {
    const w = decay(metro.distancia, 600);
    score += w * 15;
  }
  // Mall (logística días largos: comida, gym, retiros bancarios).
  const mall = pois.find((p) => p.tipo === "mall");
  if (mall && mall.distancia < 1500) {
    score += 10;
    drivers.push(`Mall ${mall.nombre}`);
  }
  score = Math.min(100, score);
  return {
    score,
    driver: drivers.length > 0 ? drivers.slice(0, 2).join(" + ") : "Sin hubs corporativos cercanos relevantes",
  };
}

function scoreNomada(
  pois: Array<Attractor & { distancia: number }>,
  comuna: string,
): { score: number; driver: string } {
  const drivers: string[] = [];
  let score = 0;
  // Comunas con cultura coworking / vida de barrio.
  const comunaNomada = ["Providencia", "Santiago", "Ñuñoa", "Vitacura"].includes(comuna);
  if (comunaNomada) {
    score += 20;
    drivers.push(`Comuna ${comuna} con cafés y barrios activos`);
  }
  // Cercanía a universidades (proxy de zona universitaria/coworking).
  const universidad = pois.find((p) => p.tipo === "universidad");
  if (universidad) {
    const w = decay(universidad.distancia, 1500);
    if (w > 0) {
      score += w * 30;
      drivers.push(`${universidad.nombre} a ${Math.round(universidad.distancia)}m`);
    }
  }
  // Metro (movilidad sin auto).
  const metro = pois.find((p) => p.tipo === "metro");
  if (metro) {
    const w = decay(metro.distancia, 700);
    score += w * 20;
  }
  // Zonas turísticas también atraen nómadas (Lastarria es nómada-magnet).
  const turismo = pois.find((p) => p.tipo === "turismo");
  if (turismo && turismo.distancia < 1200) {
    score += 15;
    drivers.push(`Barrio ${turismo.nombre}`);
  }
  // Penaliza zonas sin barrio caminable (sin metro + sin turismo + sin uni).
  if (!metro && !turismo && !universidad) score = Math.max(0, score - 15);
  score = Math.min(100, score);
  return {
    score,
    driver: drivers.length > 0 ? drivers.slice(0, 2).join(" + ") : "Zona sin densidad de cafés/coworking visible",
  };
}

function scoreFamilia(
  pois: Array<Attractor & { distancia: number }>,
  comuna: string,
): { score: number; driver: string } {
  const drivers: string[] = [];
  let score = 0;
  // Comunas residenciales con perfil familiar.
  const comunaFamiliar = ["Las Condes", "Vitacura", "La Reina", "Ñuñoa", "Lo Barnechea"].includes(comuna);
  if (comunaFamiliar) {
    score += 25;
    drivers.push(`Comuna ${comuna} con perfil residencial familiar`);
  }
  // Parques grandes cercanos.
  const parque = pois.find((p) => p.tipo === "parque");
  if (parque) {
    const w = decay(parque.distancia, 1000);
    if (w > 0) {
      score += w * 35;
      drivers.push(`${parque.nombre} a ${Math.round(parque.distancia)}m`);
    }
  }
  // Malls (espacio familiar).
  const mall = pois.find((p) => p.tipo === "mall");
  if (mall) {
    const w = decay(mall.distancia, 1500);
    if (w > 0) score += w * 20;
  }
  // Colegios top (señal de zona familiar consolidada).
  const colegio = pois.find((p) => p.tipo === "colegio");
  if (colegio && colegio.distancia < 1500) {
    score += 15;
    drivers.push(`Colegios top cercanos`);
  }
  // Penaliza si hay mucho tráfico de turismo/negocios (zona ruidosa para familia).
  const turismo = pois.find((p) => p.tipo === "turismo");
  if (turismo && turismo.distancia < 500) score = Math.max(0, score - 10);
  score = Math.min(100, score);
  return {
    score,
    driver: drivers.length > 0 ? drivers.slice(0, 2).join(" + ") : "Sin señales fuertes de zona familiar",
  };
}

/**
 * Calcula el perfil de huésped esperado para un depto STR.
 * Reusa `getNearbyAttractors` del LTR (radio 2500m por defecto).
 */
export function calcGuestProfile(
  lat: number,
  lng: number,
  comuna: string,
  radioMetros = 2500,
): GuestProfileResult {
  const nearby = getNearbyAttractors(lat, lng, radioMetros);

  // 4 perfiles candidatos (paciente_medico omitido en Fase 1).
  const perfiles: PerfilScore[] = [
    {
      perfil: "turista_leisure",
      ...scoreTurista(nearby, comuna),
      porcentaje: 0,
    },
    {
      perfil: "ejecutivo_corto",
      ...scoreEjecutivo(nearby, comuna),
      porcentaje: 0,
    },
    {
      perfil: "nomada_digital",
      ...scoreNomada(nearby, comuna),
      porcentaje: 0,
    },
    {
      perfil: "familia",
      ...scoreFamilia(nearby, comuna),
      porcentaje: 0,
    },
  ];

  // Ordenar por score desc.
  perfiles.sort((a, b) => b.score - a.score);

  // Calcular porcentaje normalizado entre los que pasan el umbral.
  const totalScore = perfiles.reduce((s, p) => s + p.score, 0);
  perfiles.forEach((p) => {
    p.porcentaje = totalScore > 0 ? Math.round((p.score / totalScore) * 100) : 0;
  });

  const dominante = perfiles[0];
  const umbral = dominante.score * UMBRAL_SECUNDARIO_PCT;
  const secundarios = perfiles.slice(1).filter((p) => p.score >= umbral);

  // POIs relevantes (top 5 por categorías que aportan a algún perfil).
  const categoriasRelevantes = new Set(["turismo", "negocios", "universidad", "parque", "mall", "metro"]);
  const poisRelevantes = nearby
    .filter((p) => categoriasRelevantes.has(p.tipo))
    .slice(0, 8)
    .map((p) => ({ ...p, categoria: p.tipo as string }));

  return {
    dominante,
    secundarios,
    todos: perfiles,
    poisRelevantes,
  };
}
