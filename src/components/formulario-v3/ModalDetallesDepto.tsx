"use client";

import { Modal } from "@/components/ui/Modal";
import { StateBox } from "@/components/ui/StateBox";
import { InfoTooltip } from "@/components/ui/tooltip";
import { useResetOnOpen } from "@/hooks/useResetOnOpen";
import type { WizardV3State } from "./wizardV3State";

export function ModalDetallesDepto({
  open,
  onClose,
  state,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  state: WizardV3State;
  onSave: (patch: Partial<WizardV3State>) => void;
}) {
  // arriendoEstac y arriendoBodega NO se editan aqui — viven en Paso 3
  // (ModalAjusteCondiciones · TabArriendo). State global persiste intacto.
  const [local, setLocal] = useResetOnOpen(open, {
    dormitorios: state.dormitorios,
    esStudio: state.esStudio === true,
    banos: state.banos,
    estacionamientos: state.estacionamientos,
    bodegas: state.bodegas,
    antiguedad: state.antiguedad,
    capacidadHuespedes: state.capacidadHuespedes,
  });

  function handleSave() {
    onSave(local);
    onClose();
  }

  const inputClass =
    "w-full h-10 rounded-lg border border-[var(--franco-border)] bg-[var(--franco-bg)] px-3 text-[14px] font-mono text-[var(--franco-text)] focus:border-signal-red focus:ring-1 focus:ring-signal-red/20 focus:outline-none";

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissOnBackdropClick={true}
      title="Detalles del depto"
      subtitle="Si no los conoces, los valores por defecto son un buen punto de partida."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="font-body font-medium text-[14px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] px-4 py-2"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="font-body font-medium text-[14px] text-white px-5 py-2.5 rounded-lg bg-signal-red hover:bg-signal-red/90 transition-colors min-h-[40px]"
          >
            Guardar
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Dormitorios">
          <select
            className={`${inputClass} appearance-none pr-8`}
            value={local.esStudio ? "studio" : local.dormitorios}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "studio") {
                setLocal({ ...local, dormitorios: "1", esStudio: true });
              } else {
                setLocal({ ...local, dormitorios: v, esStudio: false });
              }
            }}
          >
            <option value="studio">Studio</option>
            <option value="1">1 dormitorio</option>
            <option value="2">2 dormitorios</option>
            <option value="3">3 dormitorios</option>
            <option value="4">4+ dormitorios</option>
          </select>
        </Field>
        <Field label="Baños">
          <select
            className={`${inputClass} appearance-none pr-8`}
            value={local.banos}
            onChange={(e) => setLocal({ ...local, banos: e.target.value })}
          >
            <option value="1">1 baño</option>
            <option value="2">2 baños</option>
            <option value="3">3 baños</option>
            <option value="4">4+ baños</option>
          </select>
        </Field>
        <Field label="Estacionamientos">
          <select
            className={`${inputClass} appearance-none pr-8`}
            value={local.estacionamientos}
            onChange={(e) => setLocal({ ...local, estacionamientos: e.target.value })}
          >
            <option value="0">Sin estac</option>
            <option value="1">1 estac</option>
            <option value="2">2 estac</option>
            <option value="3">3 estac</option>
            <option value="4">4+ estac</option>
          </select>
        </Field>
        <Field label="Bodegas">
          <select
            className={`${inputClass} appearance-none pr-8`}
            value={local.bodegas}
            onChange={(e) => setLocal({ ...local, bodegas: e.target.value })}
          >
            <option value="0">Sin bodega</option>
            <option value="1">1 bodega</option>
            <option value="2">2 bodegas</option>
            <option value="3">3+ bodegas</option>
          </select>
        </Field>
        <Field
          label="Capacidad de huéspedes"
          tooltip="Cantidad máxima de personas que pueden alojarse. Se usa para estimar ingresos en análisis de Renta Corta (Airbnb)."
        >
          <select
            className={`${inputClass} appearance-none pr-8`}
            value={local.capacidadHuespedes}
            onChange={(e) => setLocal({ ...local, capacidadHuespedes: e.target.value })}
          >
            <option value="1">1 huésped</option>
            <option value="2">2 huéspedes</option>
            <option value="3">3 huéspedes</option>
            <option value="4">4 huéspedes</option>
            <option value="5">5 huéspedes</option>
            <option value="6">6+ huéspedes</option>
          </select>
        </Field>
      </div>

      {state.tipoPropiedad === "usado" && (
        <div className="mt-4">
          <label className="block">
            <span className="flex items-center gap-1.5 mb-1.5">
              <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
                Antigüedad
              </span>
              <InfoTooltip
                content="Afecta la proyección de plusvalía. Deptos sobre 30 años suelen apreciarse menos que nuevos en la misma zona."
              />
            </span>
            <select
              className={`${inputClass} appearance-none`}
              value={local.antiguedad}
              onChange={(e) => setLocal({ ...local, antiguedad: e.target.value as WizardV3State["antiguedad"] })}
            >
              <option value="0-2">0-2 años</option>
              <option value="3-5">3-5 años</option>
              <option value="6-10">6-10 años</option>
              <option value="11-20">11-20 años</option>
              <option value="20+">20+ años</option>
            </select>
          </label>
        </div>
      )}

      <div className="mt-5">
        <StateBox variant="left-border" state="info">
          Los precios de arriendo sugeridos (depto, estacionamiento y bodega) los verás en el paso 3, calculados según tu zona. Podrás ajustarlos si tienes información distinta.
        </StateBox>
      </div>
    </Modal>
  );
}

function Field({ label, children, tooltip }: { label: string; children: React.ReactNode; tooltip?: string }) {
  return (
    <label className="block">
      {tooltip ? (
        <span className="flex items-center gap-1.5 mb-1.5">
          <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
            {label}
          </span>
          <InfoTooltip content={tooltip} />
        </span>
      ) : (
        <span className="font-body text-[12px] font-medium text-[var(--franco-text)] block mb-1.5">
          {label}
        </span>
      )}
      {children}
    </label>
  );
}
