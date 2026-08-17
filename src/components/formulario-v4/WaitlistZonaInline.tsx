"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Captura de demanda fuera de cobertura (I-2) — aditivo al mensaje de rechazo
// del paso `dir`. El rechazo NO cambia: mismo texto, misma imposibilidad de
// avanzar. Lo único nuevo es que la demanda deja rastro.
//
// La tabla `waitlist_zonas` y su endpoint (POST /api/waitlist/zona, service-role
// porque la tabla tiene RLS sin policies) ya existían: los usaba el modal del
// wizard v3 y quedaron sin tráfico en el cutover a v4 (ca3106f). Acá se
// re-cablean tal cual — cero backend nuevo.
//
// Voz: honesta y sin promesa de fecha. Franco no sabe cuándo llega a esa zona y
// no lo va a inventar.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { usePostHog } from "posthog-js/react";
import { trackWizard } from "./track";

export function WaitlistZonaInline({
  comuna,
  region,
}: {
  comuna: string;
  /** Región normalizada desde Places. Solo para el evento y el copy. */
  region: string | null;
}) {
  const posthog = usePostHog();
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "listo" | "error">("idle");

  const enviar = async () => {
    if (estado === "enviando" || estado === "listo") return;
    if (!email.includes("@")) {
      setEstado("error");
      return;
    }
    setEstado("enviando");
    try {
      const res = await fetch("/api/waitlist/zona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, comuna }),
      });
      if (!res.ok) {
        setEstado("error");
        return;
      }
      setEstado("listo");
      // El email NO viaja al evento: la demanda se mide por zona, y el dato
      // personal ya quedó en la tabla, que es donde corresponde.
      trackWizard(posthog, "waitlist_zona_capturada", { comuna, region: region ?? "sin_dato" });
    } catch {
      setEstado("error");
    }
  };

  if (estado === "listo") {
    return (
      <p className="font-body text-[12px] mt-2 text-[var(--franco-text-secondary)] leading-snug">
        Listo — te escribimos apenas Franco tenga datos de {comuna}.
      </p>
    );
  }

  return (
    <div className="mt-2.5">
      <p className="font-body text-[12px] text-[var(--franco-text-secondary)] m-0 mb-1.5 leading-snug">
        ¿Te avisamos cuando Franco llegue a {region || comuna}?
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="tu@correo.cl"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (estado === "error") setEstado("idle"); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void enviar(); } }}
          aria-label="Tu correo para avisarte cuando Franco llegue a tu zona"
          className="h-11 flex-1 min-w-0 rounded-lg border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] px-3 text-[15px] font-body text-[var(--franco-text)] focus:border-signal-red focus:outline-none focus:ring-1 focus:ring-signal-red/20 transition-colors"
        />
        <button
          type="button"
          onClick={() => void enviar()}
          disabled={estado === "enviando"}
          className="h-11 shrink-0 rounded-lg border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] px-4 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--franco-text)] transition-colors hover:border-[var(--franco-border-hover)] disabled:opacity-50"
        >
          {estado === "enviando" ? "Enviando…" : "Avísame"}
        </button>
      </div>
      {estado === "error" && (
        <p className="font-body text-[11px] mt-1 text-[var(--franco-text-muted)]">
          No pudimos guardarlo. Revisa el correo e intenta de nuevo.
        </p>
      )}
    </div>
  );
}
