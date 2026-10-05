// ─────────────────────────────────────────────────────────────────────────────
// Las comunas vecinas (05-oct-2026): las que comparten límite con cada comuna cubierta, dentro de la
// cobertura (comunas-disponibles.ts). Las usa el correo semanal para completar cuando en las comunas de
// la persona no hay tres Comprar. Se escribe cada par una vez y la relación se hace simétrica abajo.
// A mano a propósito: derivarla de las coordenadas de los avisos daba pares falsos (avisos rotulados
// «Santiago» en toda la ciudad).
// ─────────────────────────────────────────────────────────────────────────────
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";

const PARES: Readonly<Record<string, readonly string[]>> = {
  Santiago: ["Independencia", "Recoleta", "Providencia", "Ñuñoa", "San Joaquín", "San Miguel", "Estación Central", "Quinta Normal"],
  Providencia: ["Recoleta", "Las Condes", "Vitacura", "Ñuñoa"],
  "Las Condes": ["Vitacura", "Lo Barnechea", "La Reina", "Ñuñoa", "Peñalolén"],
  Vitacura: ["Lo Barnechea", "Huechuraba"],
  "Lo Barnechea": ["Huechuraba"],
  Ñuñoa: ["La Reina", "Peñalolén", "Macul", "San Joaquín"],
  "La Reina": ["Peñalolén"],
  Macul: ["Peñalolén", "La Florida", "San Joaquín"],
  Peñalolén: ["La Florida"],
  "La Florida": ["Puente Alto"],
  "San Joaquín": ["San Miguel"],
  Maipú: ["Pudahuel", "Cerrillos", "Estación Central"],
  Pudahuel: ["Quilicura", "Estación Central"],
  Cerrillos: ["Estación Central"],
  "Estación Central": ["Quinta Normal"],
  "Quinta Normal": ["Independencia"],
  Independencia: ["Recoleta", "Conchalí"],
  Recoleta: ["Conchalí", "Huechuraba"],
  Huechuraba: ["Conchalí", "Quilicura"],
  Conchalí: ["Quilicura"],
  "San Miguel": ["La Cisterna"],
};

const VECINAS = new Map<string, Set<string>>();
for (const [a, bs] of Object.entries(PARES)) {
  for (const b of bs) {
    for (const [x, y] of [[a, b], [b, a]]) {
      if (!VECINAS.has(x)) VECINAS.set(x, new Set());
      VECINAS.get(x)!.add(y);
    }
  }
}

/** Las vecinas de una comuna cubierta (vacío si no la conoce). */
export function vecinasDe(comuna: string): string[] {
  return Array.from(VECINAS.get(comuna) ?? []);
}

/** Las vecinas de un grupo de comunas, sin las del grupo ni repetidas, en el orden en que aparecen. */
export function comunasVecinas(comunas: readonly string[]): string[] {
  const propias = new Set(comunas);
  const out: string[] = [];
  for (const c of comunas) for (const v of vecinasDe(c)) if (!propias.has(v) && !out.includes(v)) out.push(v);
  return out;
}

/** Toda comuna cubierta tiene al menos una vecina (lo verifica el tier SEMANAL). */
export const COMUNAS_SIN_VECINAS = (COMUNAS_DISPONIBLES as readonly string[]).filter((c) => vecinasDe(c).length === 0);
