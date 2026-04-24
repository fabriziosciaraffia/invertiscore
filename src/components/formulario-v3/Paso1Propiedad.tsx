"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
import { COMUNAS } from "@/lib/comunas";
import { MapaThumbnail, type Comparable } from "./MapaThumbnail";
import { ModalDetallesDepto } from "./ModalDetallesDepto";
import { ModalEntregaNuevo } from "./ModalEntregaNuevo";
import {
  previewDetalles,
  previewEntrega,
  type WizardV3State,
} from "./wizardV3State";

export function Paso1Propiedad({
  state,
  setState,
  comparablesCount,
  comparables,
}: {
  state: WizardV3State;
  setState: (patch: Partial<WizardV3State>) => void;
  comparablesCount: number;
  comparables?: Comparable[];
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [entregaOpen, setEntregaOpen] = useState(false);
  const direccionRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autocompleteRef = useRef<any>(null);

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
        const comuna = comps.find((c) => c.types.includes("administrative_area_level_3"))?.long_name
          || comps.find((c) => c.types.includes("locality"))?.long_name
          || "";
        const match = COMUNAS.find((c) => c.comuna.toLowerCase() === comuna.toLowerCase());
        setState({
          direccion: addr,
          lat,
          lng,
          comuna: match?.comuna || comuna,
          ciudad: match?.ciudad || "Santiago",
        });
      });
      autocompleteRef.current = ac;
    }).catch(() => { /* ignore */ });
  }, [setState]);

  const inputBase =
    "w-full h-10 rounded-lg border bg-[var(--franco-card)] px-3 text-[14px] text-[var(--franco-text)] focus:ring-1 focus:ring-[#C8323C]/20 focus:outline-none transition-colors";
  const inputOk = "border-[var(--franco-border)] focus:border-[#C8323C]";

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
          placeholder="Ej: Av. Providencia 1234, Providencia"
          className={`${inputBase} ${inputOk} font-body`}
          defaultValue={state.direccion}
          onChange={(e) => setState({ direccion: e.target.value })}
        />
        {state.comuna && (
          <p className="font-body text-[11px] text-[var(--franco-text-muted)] mt-1">
            {state.comuna}{state.ciudad ? ` · ${state.ciudad}` : ""}
          </p>
        )}
      </div>

      {/* ── Mapa thumbnail (solo si hay lat/lng) ── */}
      {state.lat && state.lng && (
        <MapaThumbnail
          lat={state.lat}
          lng={state.lng}
          comparables={comparables}
          comparablesCount={comparablesCount}
          locationLabel={[state.comuna, state.ciudad].filter(Boolean).join(" · ")}
        />
      )}

      {/* ── Tipo + Superficie ── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="font-body text-[13px] font-medium text-[var(--franco-text)] block mb-1.5">
            Tipo
          </label>
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
                    : "bg-[var(--franco-card)] text-[var(--franco-text-secondary)] border border-[var(--franco-border)] hover:border-[var(--franco-border-hover)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="font-body text-[13px] font-medium text-[var(--franco-text)] block mb-1.5">
            Superficie útil
          </label>
          <div className="relative">
            <input
              type="number"
              inputMode="numeric"
              placeholder="50"
              className={`${inputBase} ${inputOk} font-mono pr-10`}
              value={state.superficieUtil}
              onChange={(e) => setState({ superficieUtil: e.target.value })}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[12px] text-[var(--franco-text-muted)] pointer-events-none">
              m²
            </span>
          </div>
        </div>
      </div>

      {/* ── Card Entrega del proyecto (solo nuevo) ── */}
      {state.tipoPropiedad === "nuevo" && (
        <div
          className="rounded-xl p-4 flex items-center justify-between gap-3"
          style={{
            border: "1px dashed var(--franco-border-hover)",
            background: "color-mix(in srgb, var(--franco-text) 2%, transparent)",
          }}
        >
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-[var(--franco-text-muted)] m-0 mb-1">
              Entrega del proyecto
            </p>
            <p className="font-body text-[13px] text-[var(--franco-text)] m-0 truncate">
              {previewEntrega(state)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEntregaOpen(true)}
            className="shrink-0 font-body text-[12px] font-semibold text-[#C8323C] hover:underline"
          >
            Ajustar entrega →
          </button>
        </div>
      )}

      {/* ── Card Detalles del depto ── */}
      <div
        className="rounded-xl p-4 flex items-center justify-between gap-3"
        style={{
          border: "1px dashed var(--franco-border-hover)",
          background: "color-mix(in srgb, var(--franco-text) 2%, transparent)",
        }}
      >
        <div className="min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-[var(--franco-text-muted)] m-0 mb-1">
            Detalles del depto
          </p>
          <p className="font-body text-[13px] text-[var(--franco-text)] m-0 truncate">
            {previewDetalles(state)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="shrink-0 font-body text-[12px] font-semibold text-[#C8323C] hover:underline"
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

      <ModalEntregaNuevo
        open={entregaOpen}
        onClose={() => setEntregaOpen(false)}
        state={state}
        onSave={setState}
      />
    </div>
  );
}
