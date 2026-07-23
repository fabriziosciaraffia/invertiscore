"use client";

// Wizard v4 — Pantallas del Acto 1 (QUÉ COMPRAS).
// dir (Places + mapa + gate de cobertura), tipo, entrega, antigüedad, tamaño.

import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
import { COMUNAS } from "@/lib/comunas";
import { isComunaDisponible } from "@/lib/comunas-disponibles";
import { MapaThumbnail } from "@/components/formulario-v3/MapaThumbnail";
import type { WizardV4Answers, NodeId, Antiguedad } from "./wizardV4Nodes";
import type { WizardV4Data } from "./useWizardV4Data";
import { ChoiceTile, FieldLabel, FuenteLine, PrimaryBtn, Segmented, TextInput } from "./ui";

export interface ScreenProps {
  answers: WizardV4Answers;
  data: WizardV4Data;
  patchAnswers: (p: Partial<WizardV4Answers>) => void;
  answer: (node: NodeId, patch?: Partial<WizardV4Answers>) => void;
  goDetour: (fix: NodeId, patch?: Partial<WizardV4Answers>) => void;
}

const num = (v: string) => (/^\d*[.,]?\d*$/.test(v) ? v : null);

// ── dir ──────────────────────────────────────────────────────────────────────

export function DireccionScreen({ answers, data, patchAnswers, answer }: ScreenProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const acRef = useRef<any>(null);

  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        if (!inputRef.current || acRef.current) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const google = (window as any).google;
        if (!google?.maps?.places) return;
        const ac = new google.maps.places.Autocomplete(inputRef.current, {
          types: ["address"],
          componentRestrictions: { country: "cl" },
          fields: ["geometry", "formatted_address", "address_components"],
        });
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (!place?.geometry?.location) return;
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const addr = place.formatted_address || inputRef.current?.value || "";
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const comps = (place.address_components || []) as any[];
          // En la RM, Google mapea la comuna a `locality` (fallback admin_level_3).
          const comunaRaw =
            comps.find((c) => c.types.includes("locality"))?.long_name ||
            comps.find((c) => c.types.includes("administrative_area_level_3"))?.long_name ||
            "";
          const match = COMUNAS.find((c) => c.comuna.toLowerCase() === comunaRaw.toLowerCase());
          const comunaFinal = match?.comuna || comunaRaw;
          const cubierta = isComunaDisponible(comunaFinal);
          // REGRESIÓN-7: Google rellena el input con un texto distinto al
          // formatted_address, y su `input` event (onChange de React) puede correr
          // DESPUÉS de este handler → direccion (input) ≠ direccionConfirmada
          // (formatted) → "no confirmada". Sincronizamos el input a la dirección
          // canónica y usamos ESA misma cadena para ambos, de modo que un onChange
          // posterior lea el mismo valor y no desincronice. También cura el caso en
          // que Google no autocompleta el input (queda el texto tipeado).
          if (inputRef.current) inputRef.current.value = addr;
          // Fuera de cobertura: registramos la comuna (para el mensaje explícito)
          // pero NO confirmamos ni guardamos coords → el draft no persiste una
          // dirección fuera de cobertura como válida y Continuar queda bloqueado.
          patchAnswers({
            direccion: addr,
            comuna: comunaFinal,
            ciudad: match?.ciudad || "Santiago",
            ...(cubierta
              ? { direccionConfirmada: addr, lat, lng }
              : { direccionConfirmada: undefined, lat: undefined, lng: undefined }),
          });
        });
        acRef.current = ac;
      })
      .catch(() => { /* ignore */ });
  }, [patchAnswers]);

  const { direccion, direccionConfirmada, comuna, ciudad, lat, lng } = answers;
  const confirmada = !!direccionConfirmada && direccion === direccionConfirmada;
  const fueraDeZona = !!comuna && !isComunaDisponible(comuna);
  const puedeSeguir = confirmada && !!comuna && !fueraDeZona;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <FieldLabel tooltip="La ubicación define los comparables, cercanía a metro y servicios. Escribe y elige una opción del dropdown.">
          Dirección
        </FieldLabel>
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          placeholder="Ej: Av. Providencia 1234, Providencia"
          defaultValue={direccion}
          onChange={(e) => patchAnswers({ direccion: e.target.value })}
          className="w-full h-11 rounded-lg border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] px-3 text-[15px] font-body text-[var(--franco-text)] focus:border-signal-red focus:outline-none focus:ring-1 focus:ring-signal-red/20 transition-colors"
        />
        {/* Prioridad del mensaje: la cobertura manda. Si la comuna elegida está
            fuera del Gran Santiago se muestra el mensaje de cobertura aunque el
            estado "confirmado" no se haya seteado (BUG-1: antes ganaba el genérico). */}
        {fueraDeZona ? (
          <p className="font-body text-[12px] mt-1.5 text-signal-red leading-snug">
            {comuna} está fuera del Gran Santiago — por ahora Franco no tiene datos suficientes acá.
            Prueba con otra comuna de la Región Metropolitana.
          </p>
        ) : direccion && !confirmada ? (
          <p className="font-body text-[11px] mt-1.5 text-signal-red">
            Selecciona la dirección de la lista de sugerencias.
          </p>
        ) : comuna ? (
          <p className="font-body text-[11px] text-[var(--franco-text-muted)] mt-1.5">
            {comuna}
            {ciudad ? ` · ${ciudad}` : ""}
          </p>
        ) : null}
      </div>

      {lat && lng && !fueraDeZona && (
        <div>
          <FieldLabel>Ubicación en el mapa</FieldLabel>
          <MapaThumbnail
            lat={lat}
            lng={lng}
            comparables={data.comparables}
            comparablesCount={data.comparablesCount}
            locationLabel={[comuna, ciudad].filter(Boolean).join(" · ")}
            countLabel="propiedades en el sector"
          />
        </div>
      )}

      <div className="mt-1">
        <PrimaryBtn onClick={() => answer("dir")} disabled={!puedeSeguir}>
          Continuar →
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ── tipo ─────────────────────────────────────────────────────────────────────

export function TipoScreen({ answers, answer }: ScreenProps) {
  return (
    <div className="flex flex-col gap-3">
      <ChoiceTile
        selected={answers.tipoPropiedad === "usado"}
        onClick={() => answer("tipo", { tipoPropiedad: "usado" })}
        ariaLabel="Usado. Ya tuvo dueño — se vende por particular o corredor."
      >
        <span className="font-medium">Usado</span>
        <span className="block font-body text-[13px] text-[var(--franco-text-secondary)] mt-0.5">
          Ya tuvo dueño — se vende por particular o corredor.
        </span>
      </ChoiceTile>
      <ChoiceTile
        selected={answers.tipoPropiedad === "nuevo"}
        onClick={() => answer("tipo", { tipoPropiedad: "nuevo" })}
        ariaLabel="Nuevo. Primera venta directa de la inmobiliaria, incluye entrega futura o en verde."
      >
        <span className="font-medium">Nuevo</span>
        <span className="block font-body text-[13px] text-[var(--franco-text-secondary)] mt-0.5">
          Primera venta directa de la inmobiliaria (incluye entrega futura / en verde).
        </span>
      </ChoiceTile>
    </div>
  );
}

// ── ent (solo nuevo) ──────────────────────────────────────────────────────────

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function EntregaScreen({ answers, patchAnswers, answer }: ScreenProps) {
  const estado = answers.estadoVenta;
  const futura = estado === "futura";
  const puedeSeguir = estado === "inmediata" || (futura && !!answers.fechaEntregaMes && !!answers.fechaEntregaAnio);
  const anioActual = 2026;
  const anios = [anioActual, anioActual + 1, anioActual + 2, anioActual + 3];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <ChoiceTile
          selected={estado === "inmediata"}
          onClick={() => patchAnswers({ estadoVenta: "inmediata" })}
          ariaLabel="Entrega inmediata. Ya construido, listo para escriturar."
        >
          <span className="font-medium">Entrega inmediata</span>
          <span className="block font-body text-[13px] text-[var(--franco-text-secondary)] mt-0.5">
            Ya construido, listo para escriturar.
          </span>
        </ChoiceTile>
        <ChoiceTile
          selected={futura}
          onClick={() => patchAnswers({ estadoVenta: "futura" })}
          ariaLabel="Entrega futura, en verde o en blanco. En construcción, se entrega más adelante."
        >
          <span className="font-medium">Entrega futura (en verde / blanco)</span>
          <span className="block font-body text-[13px] text-[var(--franco-text-secondary)] mt-0.5">
            En construcción — se entrega más adelante.
          </span>
        </ChoiceTile>
      </div>

      {futura && (
        <div className="flex items-end gap-3">
          <div>
            <FieldLabel>Mes estimado</FieldLabel>
            <select
              value={answers.fechaEntregaMes ?? ""}
              onChange={(e) => patchAnswers({ fechaEntregaMes: e.target.value })}
              className="h-11 rounded-lg border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] px-3 text-[15px] font-mono text-[var(--franco-text)] focus:border-signal-red focus:outline-none appearance-none"
            >
              <option value="">Mes…</option>
              {MESES.map((m, i) => (
                <option key={m} value={String(i + 1)}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Año</FieldLabel>
            <select
              value={answers.fechaEntregaAnio ?? ""}
              onChange={(e) => patchAnswers({ fechaEntregaAnio: e.target.value })}
              className="h-11 rounded-lg border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] px-3 text-[15px] font-mono text-[var(--franco-text)] focus:border-signal-red focus:outline-none appearance-none"
            >
              <option value="">Año…</option>
              {anios.map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="mt-1">
        <PrimaryBtn onClick={() => answer("ent")} disabled={!puedeSeguir}>
          Continuar →
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ── ant (solo usado) ────────────────────────────────────────────────────────

const ANTIGUEDADES: Array<{ value: Antiguedad; label: string }> = [
  { value: "0-2", label: "0–2 años" },
  { value: "3-5", label: "3–5 años" },
  { value: "6-10", label: "6–10 años" },
  { value: "11-20", label: "11–20 años" },
  { value: "20+", label: "20+ años" },
];

export function AntiguedadScreen({ answer }: ScreenProps) {
  return (
    <div className="flex flex-col gap-3">
      {ANTIGUEDADES.map((a) => (
        <ChoiceTile key={a.value} onClick={() => answer("ant", { antiguedad: a.value })}>
          {a.label}
        </ChoiceTile>
      ))}
    </div>
  );
}

// ── tam ──────────────────────────────────────────────────────────────────────

export function TamanoScreen({ answers, patchAnswers, answer }: ScreenProps) {
  const sup = parseFloat((answers.superficieUtil ?? "").replace(",", ".")) || 0;
  const dorm = answers.esStudio ? "0" : answers.dormitorios;
  const puedeSeguir = sup > 0 && !!dorm && !!answers.banos;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <FieldLabel tooltip="Metros cuadrados al interior del depto, sin terrazas ni espacios comunes.">
          Superficie útil
        </FieldLabel>
        <TextInput
          value={answers.superficieUtil ?? ""}
          onChange={(v) => { if (num(v) !== null) patchAnswers({ superficieUtil: v }); }}
          placeholder="50"
          inputMode="decimal"
          mono
          suffix="m²"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel>Dormitorios</FieldLabel>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => patchAnswers({ esStudio: true, dormitorios: "0" })}
              className={`font-mono text-[13px] px-3 h-10 rounded-lg border-[0.5px] transition-colors ${
                answers.esStudio
                  ? "bg-[var(--franco-text)] text-[var(--franco-bg)] border-[var(--franco-text)]"
                  : "franco-tile-target bg-[var(--franco-card)] text-[var(--franco-text-secondary)] border-[var(--franco-border)]"
              }`}
            >
              Studio
            </button>
            {["1", "2", "3", "4"].map((d) => {
              const active = !answers.esStudio && answers.dormitorios === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => patchAnswers({ esStudio: false, dormitorios: d })}
                  className={`font-mono text-[13px] w-10 h-10 rounded-lg border-[0.5px] transition-colors ${
                    active
                      ? "bg-[var(--franco-text)] text-[var(--franco-bg)] border-[var(--franco-text)]"
                      : "franco-tile-target bg-[var(--franco-card)] text-[var(--franco-text-secondary)] border-[var(--franco-border)]"
                  }`}
                >
                  {d === "4" ? "4+" : d}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <FieldLabel>Baños</FieldLabel>
          <Segmented
            options={[
              { value: "1", label: "1" },
              { value: "2", label: "2" },
              { value: "3", label: "3+" },
            ]}
            value={answers.banos}
            onChange={(v) => patchAnswers({ banos: v })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel tooltip="Cuántos estacionamientos incluye. 0 si no tiene.">Estacionamientos</FieldLabel>
          <TextInput
            value={answers.estacionamientos ?? ""}
            onChange={(v) => { if (num(v) !== null) patchAnswers({ estacionamientos: v }); }}
            placeholder="0"
            inputMode="numeric"
            mono
          />
        </div>
        <div>
          <FieldLabel tooltip="Cuántas bodegas incluye. 0 si no tiene.">Bodegas</FieldLabel>
          <TextInput
            value={answers.bodegas ?? ""}
            onChange={(v) => { if (num(v) !== null) patchAnswers({ bodegas: v }); }}
            placeholder="0"
            inputMode="numeric"
            mono
          />
        </div>
      </div>

      <FuenteLine>Estac. y bodega afectan precio y arriendo — déjalos en 0 si no aplican.</FuenteLine>

      <div className="mt-1">
        <PrimaryBtn onClick={() => answer("tam")} disabled={!puedeSeguir}>
          Continuar →
        </PrimaryBtn>
      </div>
    </div>
  );
}
