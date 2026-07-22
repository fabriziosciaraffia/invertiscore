"use client";

/**
 * ZonaCardSTR — card recesiva de "destino zona" (E.2 · E.1a). Reemplaza la
 * ex-card 06 "Tipo de huésped" del grid muerto: ya no es una card paralela del
 * cálculo, sino una card wide recesiva al pie de la página (espejo del
 * ZoneInsightMiniCard LTR). Abre el drawer tipoHuesped (guest-insight).
 *
 * Preserva el info-scent de la card 06: el teaser muestra el perfil de huésped
 * dominante calculado sync desde lat/lng + comuna (calcGuestProfile). El detalle
 * completo (perfiles secundarios, amoblamiento) vive en el drawer.
 */

import { useMemo } from "react";
import { calcGuestProfile, PERFIL_LABEL } from "@/lib/str-guest-profile";

export function ZonaCardSTR({
  lat,
  lng,
  comuna,
  onOpen,
}: {
  lat: number | null;
  lng: number | null;
  comuna: string;
  onOpen: () => void;
}) {
  const perfil = useMemo(() => {
    if (typeof lat !== "number" || typeof lng !== "number" || !comuna) return null;
    try {
      return calcGuestProfile(lat, lng, comuna);
    } catch {
      return null;
    }
  }, [lat, lng, comuna]);

  const cita = perfil
    ? `Perfil dominante: ${PERFIL_LABEL[perfil.dominante.perfil]} · ${perfil.dominante.porcentaje}% del flujo esperado${perfil.secundarios.length > 0 ? ` · ${perfil.secundarios.length} perfil${perfil.secundarios.length > 1 ? "es" : ""} secundari${perfil.secundarios.length > 1 ? "os" : "o"}` : ""}.`
    : `Cada zona atrae un perfil de huésped distinto — turismo, negocios, salud, familia. Abre el detalle para ver el de ${comuna}.`;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="franco-card-target w-full text-left rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] transition-colors"
      style={{ padding: "16px 18px" }}
    >
      <div className="grid grid-cols-[auto_1fr_auto] gap-4 items-center max-md:grid-cols-[auto_1fr]">
        <div
          className="w-10 h-10 rounded-full border flex items-center justify-center shrink-0"
          style={{ borderColor: "var(--franco-border-strong)", opacity: 0.7, fontSize: 16 }}
          aria-hidden
        >
          ◎
        </div>
        <div className="min-w-0">
          <span
            className="font-mono uppercase block"
            style={{ fontSize: 9, letterSpacing: "0.06em", color: "var(--franco-text-tertiary)" }}
          >
            Zona · destino
          </span>
          <span className="font-heading font-bold block mt-0.5" style={{ fontSize: 16, lineHeight: 1.25 }}>
            ¿Quién va a alojarse acá?
          </span>
          <span className="font-body italic block mt-1" style={{ fontSize: 12.5, color: "var(--franco-text-secondary)", lineHeight: 1.5 }}>
            {cita}
          </span>
        </div>
        <span
          className="font-mono uppercase shrink-0 max-md:col-span-2 max-md:text-right"
          style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--franco-text-tertiary)" }}
        >
          Explorar →
        </span>
      </div>
    </button>
  );
}
