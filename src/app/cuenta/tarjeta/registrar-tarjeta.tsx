"use client";

// El botón de /cuenta/tarjeta (05-nov-2026): pide el registro de la tarjeta con `cambiarTarjeta` (subscriptions/create solo lo
// acepta en la gracia) y va a Flow.
import { useState } from "react";
import { botonOcupado, claveActual, iniciarCarga } from "@/lib/carga-global";
import { PLANO } from "@/components/plano/plano";
import { PRODUCTO_PLAN } from "@/lib/planes";
import { CAMBIAR_TARJETA_COPY } from "@/lib/subscriptions/suscripcion";

export function RegistrarTarjeta() {
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const C = CAMBIAR_TARJETA_COPY;

  async function registrar() {
    setYendo(true);
    setError(null);
    const soltar = iniciarCarga(claveActual());
    try {
      const res = await fetch("/api/subscriptions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: PRODUCTO_PLAN, cambiarTarjeta: true }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error || C.error);
    } catch {
      setError(C.error);
    }
    soltar();
    setYendo(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={registrar} disabled={yendo} {...botonOcupado(yendo)} className={PLANO.principal} data-tarjeta="registrar">
        {yendo ? C.yendo : C.boton}
      </button>
      {error && <p className={PLANO.error} role="alert">{error}</p>}
    </div>
  );
}
