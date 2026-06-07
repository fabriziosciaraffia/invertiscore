"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
import { COMUNAS } from "@/lib/comunas";
import { isComunaDisponible } from "@/lib/comunas-disponibles";
import { MapaThumbnail, type Comparable } from "./MapaThumbnail";
import { ModalDetallesDepto } from "./ModalDetallesDepto";
import { ModalZonaNoDisponible } from "./ModalZonaNoDisponible";
import { InfoTooltip } from "@/components/ui/tooltip";
import {
  previewDetalles,
  type WizardV3State,
} from "./wizardV3State";

export function Paso1Propiedad({
  state,
  setState,
  comparablesCount,
  comparables,
  userEmail,
}: {
  state: WizardV3State;
  setState: (patch: Partial<WizardV3State>) => void;
  comparablesCount: number;
  comparables?: Comparable[];
  /** Email del usuario logueado, para prefill del modal de zona no cubierta. */
  userEmail?: string | null;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [zonaModalOpen, setZonaModalOpen] = useState(false);
  const direccionRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autocompleteRef = useRef<any>(null);

  // ¿La comuna seleccionada está fuera de cobertura (no Gran Santiago)?
  // state.comuna se llena solo al elegir una opción del autocomplete.
  const fueraDeZona = !!state.comuna && !isComunaDisponible(state.comuna);

  // Google Places autocomplete
  useEffect(() => {
    loadGoogleMaps().then(() => {
      if (!direccionRef.current || autocompleteRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const google = (window as any).google;
      if (!google?.maps?.places) return;
      const ac = new google.maps.places.Autocomplete(direccionRef.current, {
        types: ["address"],
        componentRestrictions: { country: "cl" },
        fields: ["geometry", "formatted_address", "address_components"],
      });
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (!place?.geometry?.location) return;
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const addr = place.formatted_address || direccionRef.current?.value || "";
        // Extract comuna from address components
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const comps = (place.address_components || []) as any[];
        // En la RM chilena Google Places mapea la COMUNA a `locality` y la
        // PROVINCIA a `administrative_area_level_3` (ej. Providencia: locality=
        // Providencia, admin_level_3=Santiago). Priorizar locality; admin_level_3
        // solo como fallback.
        const comuna = comps.find((c) => c.types.includes("locality"))?.long_name
          || comps.find((c) => c.types.includes("administrative_area_level_3"))?.long_name
          || "";
        const match = COMUNAS.find((c) => c.comuna.toLowerCase() === comuna.toLowerCase());
        const comunaFinal = match?.comuna || comuna;
        setState({
          direccion: addr,
          direccionConfirmada: addr,
          lat,
          lng,
          comuna: comunaFinal,
          ciudad: match?.ciudad || "Santiago",
        });
        // Gate de cobertura: si la comuna no es Gran Santiago, abrimos el
        // warning bloqueante. El paso 1 no avanza mientras siga fuera de zona.
        if (comunaFinal && !isComunaDisponible(comunaFinal)) {
          setZonaModalOpen(true);
        }
      });
      autocompleteRef.current = ac;
    }).catch(() => { /* ignore */ });
  }, [setState]);

  const inputBase =
    "w-full h-10 rounded-lg border-[0.5px] bg-[var(--franco-card)] px-3 text-[14px] text-[var(--franco-text)] focus:ring-1 focus:ring-signal-red/20 focus:outline-none transition-colors";
  const inputOk = "border-[var(--franco-border)] focus:border-signal-red";

  return (
    <div className="flex flex-col gap-5">
      {/* ── Dirección ── */}
      <div>
        <label className="font-body text-[13px] font-medium text-[var(--franco-text)] block mb-1.5">
          Dirección
        </label>
        <input
          ref={direccionRef}
          type="text"
          autoComplete="off"
          placeholder="Ej: Av. Providencia 1234, Providencia"
          className={`${inputBase} ${inputOk} font-body`}
          defaultValue={state.direccion}
          onChange={(e) => setState({ direccion: e.target.value })}
        />
        {state.direccion && state.direccion !== state.direccionConfirmada ? (
          <p className="font-body text-[11px] mt-1 text-[#C8323C]">
            Selecciona la dirección de la lista de sugerencias.
          </p>
        ) : state.comuna ? (
          fueraDeZona ? (
            <p className="font-body text-[11px] mt-1 text-[#C8323C]">
              {state.comuna} está fuera del Gran Santiago — por ahora no disponible.{" "}
              <button
                type="button"
                onClick={() => setZonaModalOpen(true)}
                className="underline underline-offset-2 font-medium"
              >
                Ver detalle
              </button>
            </p>
          ) : (
            <p className="font-body text-[11px] text-[var(--franco-text-muted)] mt-1">
              {state.comuna}{state.ciudad ? ` · ${state.ciudad}` : ""}
            </p>
          )
        ) : (
          <p className="font-body text-[11px] text-[var(--franco-text-secondary)] mt-1">
            Escribe y selecciona una opción del dropdown para ubicar en el mapa.
          </p>
        )}
      </div>

      {/* ── Mapa thumbnail (solo si hay lat/lng) ── */}
      {state.lat && state.lng && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <label className="font-body text-[13px] font-medium text-[var(--franco-text)]">
              Ubicación en el mapa
            </label>
            <InfoTooltip
              content="La ubicación afecta el cálculo de comparables, cercanía a metro y servicios cercanos."
            />
          </div>
          <MapaThumbnail
            lat={state.lat}
            lng={state.lng}
            comparables={comparables}
            comparablesCount={comparablesCount}
            locationLabel={[state.comuna, state.ciudad].filter(Boolean).join(" · ")}
          />
        </div>
      )}

      {/* ── Tipo + Superficie ── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <label className="font-body text-[13px] font-medium text-[var(--franco-text)]">
              Tipo
            </label>
            <InfoTooltip
              content="Nuevo: en venta directa por inmobiliaria. Usado: vendido por particular o corredor."
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["usado", "nuevo"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setState({
                  tipoPropiedad: t,
                  // reset condicional al cambiar
                  estadoVenta: t === "usado" ? "inmediata" : state.estadoVenta,
                })}
                className={`h-10 rounded-lg font-body text-[13px] font-medium capitalize transition-colors ${
                  state.tipoPropiedad === t
                    ? "bg-[var(--franco-text)] text-[var(--franco-bg)]"
                    : "bg-[var(--franco-card)] text-[var(--franco-text-secondary)] border-[0.5px] border-[var(--franco-border)] hover:border-[var(--franco-border-hover)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {state.tipoPropiedad === "nuevo" && (
            <p className="font-mono text-[11px] mt-2 m-0 leading-[1.5] text-[var(--franco-text-secondary)]">
              ● En el paso 2 te pediremos estado del proyecto, fecha estimada de entrega y detalles del pie en cuotas para proyectar el flujo durante la pre-entrega.
            </p>
          )}
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <label className="font-body text-[13px] font-medium text-[var(--franco-text)]">
              Superficie útil
            </label>
            <InfoTooltip
              content="Superficie del depto en m², según el aviso o plano."
            />
          </div>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              placeholder="50"
              className={`${inputBase} ${inputOk} font-mono pr-10`}
              value={state.superficieUtil}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d*[.,]?\d*$/.test(v)) setState({ superficieUtil: v });
              }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[12px] text-[var(--franco-text-muted)] pointer-events-none">
              m²
            </span>
          </div>
        </div>
      </div>

      {/* ── Card Detalles del depto ── */}
      <div
        className="rounded-xl p-4 flex items-center justify-between gap-3"
        style={{
          border: "1px dashed var(--franco-border-hover)",
          background: "color-mix(in srgb, var(--franco-text) 2%, transparent)",
        }}
      >
        <div className="min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--franco-text-muted)] m-0 mb-1">
            Detalles del depto
          </p>
          <p className="font-body text-[13px] text-[var(--franco-text)] m-0 truncate">
            {previewDetalles(state)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="shrink-0 font-body text-[12px] font-medium text-signal-red hover:underline"
        >
          Ajustar detalles →
        </button>
      </div>

      <ModalDetallesDepto
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        state={state}
        onSave={setState}
      />

      <ModalZonaNoDisponible
        open={zonaModalOpen}
        onClose={() => setZonaModalOpen(false)}
        comuna={state.comuna}
        defaultEmail={userEmail}
      />
    </div>
  );
}
