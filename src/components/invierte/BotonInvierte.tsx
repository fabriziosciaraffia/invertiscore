"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EL BOTÓN SECUNDARIO «Invierte con Franco» de las tarjetas (11-nov-2026): debajo de lo que la tarjeta ya tiene —«Analizar
// este» sigue siendo la acción principal—, con contorno en tinta y sin promesa al lado. Inscrito, la etiqueta «Inscrito en
// Invierte con Franco» en su lugar. Lo dibuja quien ya decidió que va (invierte.ts › puedeInvertir): este componente no decide.
// `invierte_ver` sale una vez por depto y superficie en la carga de la página.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from "react";
import { usePostHog } from "@/lib/posthog-react";
import { EVENTOS_INVIERTE, INVIERTE_COPY, type OrigenInvierte } from "@/lib/invierte/invierte";
// Sin import del CSS acá: la tarjeta de Explorar (que los tiers dibujan sin bundler) importa este módulo. Los estilos los
// cargan quienes montan la tarjeta (explorar-cliente.tsx, semanal-lista.tsx) y la hoja.

const vistos = new Set<string>();

export function EtiquetaInscrito({ clase = "" }: { clase?: string }) {
  return <span className={`inv-etiqueta ${clase}`} data-invierte="inscrito">{INVIERTE_COPY.inscrito}</span>;
}

export function BotonInvierte({ avisoId, origen, veredicto, inscrito, alTocar, sinCuenta = false }: {
  avisoId: string;
  origen: OrigenInvierte;
  veredicto: string;
  inscrito: boolean;
  alTocar: () => void;
  sinCuenta?: boolean;
}) {
  const posthog = usePostHog();
  useEffect(() => {
    const k = `${origen}:${avisoId}`;
    if (inscrito || vistos.has(k)) return;
    vistos.add(k);
    posthog?.capture(EVENTOS_INVIERTE.ver, { aviso_id: avisoId, origen, veredicto, sin_cuenta: sinCuenta });
  }, [avisoId, origen, veredicto, inscrito, sinCuenta, posthog]);
  if (inscrito) return <EtiquetaInscrito />;
  return (
    <button
      type="button"
      className="inv-boton"
      data-invierte="boton"
      onClick={(e) => {
        e.stopPropagation();
        posthog?.capture(EVENTOS_INVIERTE.abrir, { aviso_id: avisoId, origen, veredicto, sin_cuenta: sinCuenta });
        alTocar();
      }}
    >
      {INVIERTE_COPY.boton}
    </button>
  );
}
