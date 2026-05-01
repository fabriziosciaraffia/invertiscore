import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Marca un valor como "listo para validar" tras `delay` ms sin cambios, o
 * cuando se llama explícitamente a `forceReady()` (típicamente onBlur).
 *
 * Pensado para suprimir alertas/warnings durante la edición activa: mientras
 * el user tipea, `ready=false` (alerta oculta); al pausar 600ms o salir del
 * input, `ready=true` (alerta aparece).
 *
 * Inicial `ready=true`: si el valor empieza estable (vacío o prefilled), no
 * hay flash de "false → true" en el mount.
 */
export function useDebouncedReady<T>(value: T, delay = 600): [boolean, () => void] {
  const [ready, setReady] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRun = useRef(true);

  useEffect(() => {
    // Skip primer render — el initial value no cuenta como "edición".
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    setReady(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setReady(true);
      timerRef.current = null;
    }, delay);
  }, [value, delay]);

  // Cleanup en unmount.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const forceReady = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setReady(true);
  }, []);

  return [ready, forceReady];
}
