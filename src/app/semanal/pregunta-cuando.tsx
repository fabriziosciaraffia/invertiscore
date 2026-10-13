"use client";

// ─────────────────────────────────────────────────────────────────────────────
// «¿Cuándo piensas comprar?» arriba de la página semanal (13-oct-2026, decisión de Fabrizio): solo a quien nunca la
// contestó (el perfil sin horizonte, ni de un informe ni editado), una vez, con los tres botones. Al contestar se
// guarda en el perfil de búsqueda (PUT /api/perfil-busqueda, lo mismo que el dashboard) y desaparece. No va en el
// correo. Mismos textos que «Estás dentro».
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { ESTAS_DENTRO, type HorizonteCompra } from "@/lib/lo-que-sigue/copy";
import "@/components/guia/guia.css";

export function PreguntaCuando() {
  const [listo, setListo] = useState(false);
  const [elegido, setElegido] = useState<HorizonteCompra | null>(null);
  const [error, setError] = useState(false);

  async function elegir(h: HorizonteCompra) {
    setElegido(h);
    setError(false);
    try {
      const res = await fetch("/api/perfil-busqueda", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ horizonte: h }) });
      if (res.ok) setListo(true);
      else setError(true);
    } catch {
      setError(true);
    }
  }

  if (listo) return null;
  return (
    <div className="guia-cuando guia-cuando-arriba" data-semanal="cuando">
      <p className="guia-cuando-t">{ESTAS_DENTRO.cuando}</p>
      <div className="guia-cuando-op" role="radiogroup" aria-label={ESTAS_DENTRO.cuando}>
        {ESTAS_DENTRO.horizontes.map((h) => (
          <button key={h.id} type="button" role="radio" aria-checked={elegido === h.id} className="guia-opcion" data-activa={elegido === h.id ? "1" : "0"} onClick={() => elegir(h.id)}>
            {h.texto}
          </button>
        ))}
      </div>
      {error && <p className="guia-error" role="alert">{ESTAS_DENTRO.errorGuardar}</p>}
    </div>
  );
}
