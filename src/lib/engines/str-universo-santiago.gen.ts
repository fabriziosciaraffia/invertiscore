// GENERADO — no editar a mano. Regenerar con:
//   node --env-file=.env.local --import tsx scripts/data/generar-str-universo.ts
// Universo STR por comuna (V2 · 2026-09-04): mediana del p50 de ocupación y de tarifa por noche
// que la estimación de mercado devuelve por dirección, sobre 2300 direcciones
// distintas guardadas (2479 respuestas; 1287 sin comuna reconocible quedaron
// fuera). Solo comunas con n ≥ 3 direcciones; el resto es "sin datos suficientes":
// Cerrillos (n=1) · Pudahuel (n=2) · Quilicura (n=2) · San Joaquín (n=1).
// El copy visible dice "datos de mercado"; el proveedor no se nombra al usuario.

export interface DatoComunaSTR { valor: number; n: number; fecha: string }
export interface UniversoComunaSTR { ocupacion: DatoComunaSTR; adr: DatoComunaSTR }

export const STR_UNIVERSO_V2_META = { generado: "2026-09-04", minN: 3, direcciones: 2300, respuestas: 2479, fuente: "datos de mercado (respuestas guardadas por dirección)" } as const;

export const STR_UNIVERSO_V2: Record<string, UniversoComunaSTR> = {
  "El Bosque": { ocupacion: { valor: 0.433, n: 5, fecha: "2026-08-20" }, adr: { valor: 38457, n: 5, fecha: "2026-08-20" } },
  "Estación Central": { ocupacion: { valor: 0.378, n: 34, fecha: "2026-08-24" }, adr: { valor: 38854, n: 34, fecha: "2026-08-24" } },
  "Huechuraba": { ocupacion: { valor: 0.381, n: 14, fecha: "2026-08-25" }, adr: { valor: 69018, n: 14, fecha: "2026-08-25" } },
  "Independencia": { ocupacion: { valor: 0.400, n: 25, fecha: "2026-08-18" }, adr: { valor: 43365, n: 25, fecha: "2026-08-18" } },
  "La Cisterna": { ocupacion: { valor: 0.387, n: 4, fecha: "2026-08-17" }, adr: { valor: 56726, n: 4, fecha: "2026-08-17" } },
  "La Florida": { ocupacion: { valor: 0.367, n: 97, fecha: "2026-09-01" }, adr: { valor: 57363, n: 97, fecha: "2026-09-01" } },
  "La Granja": { ocupacion: { valor: 0.375, n: 27, fecha: "2026-08-05" }, adr: { valor: 61306, n: 27, fecha: "2026-08-05" } },
  "La Reina": { ocupacion: { valor: 0.426, n: 5, fecha: "2026-08-20" }, adr: { valor: 42111, n: 5, fecha: "2026-08-20" } },
  "Las Condes": { ocupacion: { valor: 0.464, n: 170, fecha: "2026-09-02" }, adr: { valor: 68919, n: 170, fecha: "2026-09-02" } },
  "Lo Barnechea": { ocupacion: { valor: 0.467, n: 9, fecha: "2026-08-17" }, adr: { valor: 75798, n: 9, fecha: "2026-08-17" } },
  "Macul": { ocupacion: { valor: 0.402, n: 20, fecha: "2026-08-31" }, adr: { valor: 47166, n: 20, fecha: "2026-08-31" } },
  "Maipú": { ocupacion: { valor: 0.398, n: 10, fecha: "2026-08-23" }, adr: { valor: 61443, n: 10, fecha: "2026-08-23" } },
  "Ñuñoa": { ocupacion: { valor: 0.436, n: 115, fecha: "2026-09-03" }, adr: { valor: 39347, n: 115, fecha: "2026-09-03" } },
  "Peñalolén": { ocupacion: { valor: 0.366, n: 6, fecha: "2026-08-18" }, adr: { valor: 95743, n: 6, fecha: "2026-08-18" } },
  "Providencia": { ocupacion: { valor: 0.459, n: 192, fecha: "2026-08-31" }, adr: { valor: 62113, n: 192, fecha: "2026-08-31" } },
  "Puente Alto": { ocupacion: { valor: 0.363, n: 7, fecha: "2026-07-24" }, adr: { valor: 62156, n: 7, fecha: "2026-07-24" } },
  "Recoleta": { ocupacion: { valor: 0.409, n: 3, fecha: "2026-08-23" }, adr: { valor: 73818, n: 3, fecha: "2026-08-23" } },
  "San Miguel": { ocupacion: { valor: 0.428, n: 6, fecha: "2026-08-15" }, adr: { valor: 45449, n: 6, fecha: "2026-08-15" } },
  "Santiago": { ocupacion: { valor: 0.419, n: 231, fecha: "2026-09-03" }, adr: { valor: 48733, n: 231, fecha: "2026-09-03" } },
  "Vitacura": { ocupacion: { valor: 0.430, n: 27, fecha: "2026-09-01" }, adr: { valor: 63819, n: 27, fecha: "2026-09-01" } },
};
