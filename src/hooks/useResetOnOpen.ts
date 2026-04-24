"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/**
 * Mantiene un estado local sincronizado con un "snapshot" cada vez que el
 * contenedor (modal, drawer, panel) se abre. Entre `open=true` y `open=false`,
 * el estado vive libre (el consumidor puede editarlo sin que se reset).
 *
 * Diseñado para componentes tipo modal que:
 *  - Se mantienen montados aunque estén cerrados (parent solo toggle `open`).
 *  - Reciben el "snapshot" desde props (valores actuales del parent al abrir).
 *  - Deben descartar ediciones previas si el usuario canceló y reabre.
 *
 * Importante: el `snapshot` NO está en las deps del effect. El reset se dispara
 * solo cuando `open` transita — evita resetear el local mientras el user edita
 * (cualquier re-render del parent que derive un snapshot nuevo no afecta).
 *
 * El setter devuelto es equivalente a `React.Dispatch<SetStateAction<T>>`,
 * por lo que soporta tanto `setLocal(nuevo)` como `setLocal(prev => ...)`.
 */
export function useResetOnOpen<T>(open: boolean, snapshot: T): [T, Dispatch<SetStateAction<T>>] {
  const [local, setLocal] = useState<T>(snapshot);

  useEffect(() => {
    if (open) setLocal(snapshot);
    // snapshot intencionalmente fuera de las deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return [local, setLocal];
}
