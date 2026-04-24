"use client";

import { Modal } from "@/components/ui/Modal";
import { MoneyInput } from "@/components/ui/MoneyInput";
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
  const [local, setLocal] = useResetOnOpen(open, {
    dormitorios: state.dormitorios,
    esStudio: state.esStudio === true,
    banos: state.banos,
    estacionamientos: state.estacionamientos,
    bodegas: state.bodegas,
    arriendoEstac: state.arriendoEstac,
    arriendoBodega: state.arriendoBodega,
    antiguedad: state.antiguedad,
  });

  const nEstac = Number(local.estacionamientos) || 0;
  const nBodega = Number(local.bodegas) || 0;

  function handleSave() {
    onSave(local);
    onClose();
  }

  const inputClass =
    "w-full h-10 rounded-lg border border-[var(--franco-border)] bg-[var(--franco-bg)] px-3 text-[14px] font-mono text-[var(--franco-text)] focus:border-[#C8323C] focus:ring-1 focus:ring-[#C8323C]/20 focus:outline-none";

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
            className="font-body font-semibold text-[14px] text-white px-5 py-2.5 rounded-lg bg-[#C8323C] hover:bg-[#B02A34] transition-colors min-h-[40px]"
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
      </div>

      {(nEstac > 0 || nBodega > 0) && (
        <div className="grid grid-cols-2 gap-4 mt-4">
          {nEstac > 0 && (
            <Field label="Arriendo estacionamiento ($/mes)">
              <MoneyInput
                placeholder={(40000 * nEstac).toLocaleString("es-CL")}
                className={inputClass}
                value={local.arriendoEstac}
                onChange={(raw) => setLocal({ ...local, arriendoEstac: raw })}
              />
            </Field>
          )}
          {nBodega > 0 && (
            <Field label="Arriendo bodega ($/mes)">
              <MoneyInput
                placeholder={(15000 * nBodega).toLocaleString("es-CL")}
                className={inputClass}
                value={local.arriendoBodega}
                onChange={(raw) => setLocal({ ...local, arriendoBodega: raw })}
              />
            </Field>
          )}
        </div>
      )}

      {state.tipoPropiedad === "usado" && (
        <div className="mt-4">
          <Field label="Antigüedad">
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
          </Field>
        </div>
      )}
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-body text-[12px] font-medium text-[var(--franco-text)] block mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
