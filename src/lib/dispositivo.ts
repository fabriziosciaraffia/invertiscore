// El dispositivo (16-oct-2026, el regalo al registrarse): una cookie propia de larga vida con un id al azar, que el
// middleware pone en la primera página que se abre. Sirve solo para el tope de regalos por dispositivo
// (regalo-alta.ts); se guarda en hash. Sin dependencias de Node: corre en el middleware.
export const COOKIE_DISPOSITIVO = "franco_disp";
/** Lo que dura: el máximo que aceptan los navegadores (400 días). */
export const VIDA_DISPOSITIVO_S = 400 * 24 * 60 * 60;

export function dispositivoValido(v: string | null | undefined): string | null {
  return v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null;
}
