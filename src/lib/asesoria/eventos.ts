// ─────────────────────────────────────────────────────────────────────────────
// LA MEDICIÓN DE LA ASESORÍA (27-nov-2026): eventos de PostHog `asesoria_*`, SIN MONTOS (ni renta, ni pie, ni deudas, ni aporte,
// ni capacidad: tampoco el id del chip, que es un rango), y cada uno con `es_prueba` (dispositivo habilitado o cuenta de prueba),
// para leer el embudo sin las corridas de prueba. Nada a Meta. Lo fija el tier ASESORIA.
// ─────────────────────────────────────────────────────────────────────────────
import type { Paso } from "./estado";

export const EVENTOS_ASESORIA = {
  burbujaVista: "asesoria_burbuja_vista",
  abierta: "asesoria_abierta",
  cerrada: "asesoria_cerrada",
  retomada: "asesoria_retomada",
  paso: "asesoria_paso",
  cuenta: "asesoria_cuenta_creada",
  perfil: "asesoria_perfil",
  deptos: "asesoria_deptos",
  verDepto: "asesoria_ver_depto",
  nuevos: "asesoria_interes_nuevos",
  // «Seguir con estos deptos» (D14, 27-nov-2026): el botón rojo del perfil que lleva a Invierte con Franco.
  seguirDeptos: "asesoria_seguir_deptos",
} as const;

/** Las respuestas que SÍ pueden viajar (no son montos): experiencia, objetivo, el modo de dónde y la lupa. */
const RESPUESTAS_LIBRES: Partial<Record<Paso, readonly string[]>> = {
  gancho: ["primera", "uno", "varios"],
  objetivo: ["arriendo", "plusvalia", "ambas", "no_se"],
  donde: ["comunas", "metro", "rinde"],
  lupa: ["si", "no", "prefiero"],
};

/** Las propiedades de un evento de paso: el paso y, si es de las libres, la respuesta; nunca una cifra. */
export function propsPaso(paso: Paso, respuesta: string | null, esPrueba: boolean): Record<string, string | boolean> {
  const libre = respuesta != null && (RESPUESTAS_LIBRES[paso] ?? []).includes(respuesta);
  return { paso, ...(libre ? { respuesta: respuesta as string } : {}), es_prueba: esPrueba };
}

export const propsBase = (esPrueba: boolean, extra: Record<string, string | number | boolean> = {}) => ({ ...extra, es_prueba: esPrueba });
