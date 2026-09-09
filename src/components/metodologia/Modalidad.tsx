"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Toggle LTR/STR de /metodologia — UN solo estado para todo lo que cambia con la
// modalidad: la tabla de datos, la tabla de supuestos y los ejes del score (que
// en el motor son distintos entre LTR y STR, no los mismos con otros pesos).
// Si eliges "Renta corta" arriba, la tabla de supuestos y los ejes cambian con
// ella: es un contexto, no tres estados sueltos.
//
// Las dos versiones se renderizan en el SERVIDOR y viven las dos en el HTML; el
// toggle solo cambia `data-modalidad` en el envoltorio y el CSS decide cuál se
// ve. Así la página es citable e indexable completa (el goal pide SEO), el
// contenido no depende de JS y el cambio es instantáneo.
//
// El estado persiste en la URL (?modalidad=str) con replaceState: se puede
// linkear directo a la versión de renta corta sin ensuciar el historial ni
// disparar una navegación de Next.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Modo = "ltr" | "str";

const ETIQUETA: Record<Modo, string> = { ltr: "Arriendo tradicional", str: "Renta corta" };

const Ctx = createContext<{ modo: Modo; elegir: (m: Modo) => void }>({ modo: "ltr", elegir: () => {} });

function leerDeUrl(): Modo {
  if (typeof window === "undefined") return "ltr";
  return new URLSearchParams(window.location.search).get("modalidad") === "str" ? "str" : "ltr";
}

export function Modalidad({ children }: { children: ReactNode }) {
  const [modo, setModo] = useState<Modo>("ltr");

  // La URL se lee después de montar: el HTML del servidor no la conoce y
  // renderizar distinto en el primer paint rompería la hidratación.
  useEffect(() => setModo(leerDeUrl()), []);

  const elegir = (m: Modo) => {
    setModo(m);
    const url = new URL(window.location.href);
    if (m === "str") url.searchParams.set("modalidad", "str");
    else url.searchParams.delete("modalidad");
    window.history.replaceState(null, "", url.toString());
  };

  return (
    <div className="mtd-modal" data-modalidad={modo}>
      <Ctx.Provider value={{ modo, elegir }}>{children}</Ctx.Provider>
    </div>
  );
}

/** Los dos botones. Se puede montar tantas veces como haga falta: todos leen y
 *  escriben el mismo estado. */
export function ToggleModalidad({ etiqueta }: { etiqueta: string }) {
  const { modo, elegir } = useContext(Ctx);
  return (
    <div className="mtd-toggle" role="group" aria-label={etiqueta}>
      {(["ltr", "str"] as const).map((m) => (
        <button key={m} type="button" aria-pressed={modo === m} onClick={() => elegir(m)}>
          {ETIQUETA[m]}
        </button>
      ))}
    </div>
  );
}
