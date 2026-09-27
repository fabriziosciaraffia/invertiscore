"use client";

// Wizard v4 — Pantallas del Acto 1 (QUÉ COMPRAS).
// tipo, entrega, antigüedad, tamaño. La dirección vive en `screenEntrada.tsx`
// (es la pantalla de entrada, no un paso más del acto).
//
// Formato del informe desde el 27-sep-2026 (entrega 2): tarjetas grises, selección en tinta,
// dormitorios en una fila y los años de entrega calculados desde el año en curso.

import type { WizardV4Answers, NodeId, Antiguedad } from "./wizardV4Nodes";
import { DEC } from "./wizardV4Nodes";
import type { WizardV4Data } from "./useWizardV4Data";
import { ChoiceTile, FieldLabel, FuenteLine, PrimaryBtn, Segmented, TileTexto } from "./ui";
import { NumericInput } from "./NumericInput";
import { leerNum } from "./derive";
import { escalaSuperficie } from "./avisoEscala";

export interface ScreenProps {
  answers: WizardV4Answers;
  data: WizardV4Data;
  patchAnswers: (p: Partial<WizardV4Answers>) => void;
  answer: (node: NodeId, patch?: Partial<WizardV4Answers>) => void;
  goDetour: (fix: NodeId, patch?: Partial<WizardV4Answers>) => void;
}

// La pantalla de `dir` se mudó a `screenEntrada.tsx` (19-ago-2026): dejó de ser
// "un campo de dirección" y pasó a ser la portada del producto, con sus tres
// estados. Este archivo se queda con el resto del Acto 1.

// ── tipo ─────────────────────────────────────────────────────────────────────

export function TipoScreen({ answers, answer }: ScreenProps) {
  return (
    <div className="wz-gap">
      <ChoiceTile
        selected={answers.tipoPropiedad === "usado"}
        onClick={() => answer("tipo", { tipoPropiedad: "usado" })}
        ariaLabel="Usado. Ya tuvo dueño: se vende por particular o corredor."
      >
        <TileTexto t="Usado" s="Ya tuvo dueño: se vende por particular o corredor." />
      </ChoiceTile>
      <ChoiceTile
        selected={answers.tipoPropiedad === "nuevo"}
        onClick={() => answer("tipo", { tipoPropiedad: "nuevo" })}
        ariaLabel="Nuevo. Primera venta de la inmobiliaria, incluida la entrega futura o en verde."
      >
        <TileTexto t="Nuevo" s="Primera venta de la inmobiliaria, incluida la entrega futura o en verde." />
      </ChoiceTile>
    </div>
  );
}

// ── ent (solo nuevo) ──────────────────────────────────────────────────────────

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** Los cuatro años que se ofrecen para la entrega: el actual y los tres siguientes. Hasta el
 *  27-sep-2026 partían de un 2026 escrito a mano, que en enero habría ofrecido un año pasado. */
export function aniosEntrega(hoy: Date = new Date()): number[] {
  const a = hoy.getFullYear();
  return [a, a + 1, a + 2, a + 3];
}

export function EntregaScreen({ answers, patchAnswers, answer }: ScreenProps) {
  const estado = answers.estadoVenta;
  const futura = estado === "futura";
  const puedeSeguir = estado === "inmediata" || (futura && !!answers.fechaEntregaMes && !!answers.fechaEntregaAnio);
  const anios = aniosEntrega();

  return (
    <div>
      <div className="wz-gap">
        <ChoiceTile
          selected={estado === "inmediata"}
          onClick={() => patchAnswers({ estadoVenta: "inmediata" })}
          ariaLabel="Entrega inmediata. Ya construido, listo para escriturar."
        >
          <TileTexto t="Entrega inmediata" s="Ya construido, listo para escriturar." />
        </ChoiceTile>
        <ChoiceTile
          selected={futura}
          onClick={() => patchAnswers({ estadoVenta: "futura" })}
          ariaLabel="Entrega futura, en verde o en blanco. En construcción: se entrega más adelante."
        >
          <TileTexto t="Entrega futura (en verde o en blanco)" s="En construcción: se entrega más adelante." />
        </ChoiceTile>

        {futura && (
          <>
            <div className="wz-campo">
              <FieldLabel htmlFor="wz-mes-entrega">Mes estimado</FieldLabel>
              <div className="wz-input-caja">
                <select
                  id="wz-mes-entrega"
                  value={answers.fechaEntregaMes ?? ""}
                  onChange={(e) => patchAnswers({ fechaEntregaMes: e.target.value })}
                  className="wz-input wz-select con-suf"
                >
                  <option value="">Elige el mes</option>
                  {MESES.map((m, i) => (
                    <option key={m} value={String(i + 1)}>{m}</option>
                  ))}
                </select>
                <span className="wz-suf" aria-hidden>▾</span>
              </div>
            </div>
            <div className="wz-campo">
              <FieldLabel>Año</FieldLabel>
              <Segmented
                lleno
                ariaLabel="Año de entrega"
                options={anios.map((y) => ({ value: String(y), label: String(y) }))}
                value={answers.fechaEntregaAnio}
                onChange={(v) => patchAnswers({ fechaEntregaAnio: v })}
              />
            </div>
          </>
        )}
      </div>

      <PrimaryBtn onClick={() => answer("ent")} disabled={!puedeSeguir}>
        Continuar →
      </PrimaryBtn>
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

export function AntiguedadScreen({ answers, answer }: ScreenProps) {
  return (
    <div className="wz-gap">
      {ANTIGUEDADES.map((a) => (
        <ChoiceTile key={a.value} selected={answers.antiguedad === a.value} onClick={() => answer("ant", { antiguedad: a.value })}>
          <TileTexto t={a.label} />
        </ChoiceTile>
      ))}
    </div>
  );
}

// ── tam ──────────────────────────────────────────────────────────────────────

export function TamanoScreen({ answers, patchAnswers, answer }: ScreenProps) {
  const sup = leerNum(answers.superficieUtil, DEC.superficie);
  const dorm = answers.esStudio ? "0" : answers.dormitorios;
  const puedeSeguir = sup > 0 && !!dorm && !!answers.banos;

  return (
    <div>
      <div className="wz-gap">
        <NumericInput
          label="Superficie útil"
          tooltip="Los metros cuadrados al interior del depto, sin terrazas ni espacios comunes. Es la que define los comparables: se buscan deptos de tamaño parecido."
          value={answers.superficieUtil ?? ""}
          onChange={(v) => patchAnswers({ superficieUtil: v })}
          decimales={DEC.superficie}
          placeholder="50"
          sufijo="m²"
          ecoSufijo=" m²"
          escala={escalaSuperficie}
        />

        {/* Dormitorios en UNA fila (Studio, 1, 2, 3, 4+) y los baños debajo, a todo el ancho:
            a 390 px el par lado a lado partía los dormitorios en dos renglones. */}
        <div className="wz-campo">
          <FieldLabel>Dormitorios</FieldLabel>
          <div className="wz-fila-dorm" role="group" aria-label="Dormitorios">
            <button type="button" aria-pressed={!!answers.esStudio} onClick={() => patchAnswers({ esStudio: true, dormitorios: "0" })}>
              Studio
            </button>
            {["1", "2", "3", "4"].map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={!answers.esStudio && answers.dormitorios === d}
                onClick={() => patchAnswers({ esStudio: false, dormitorios: d })}
              >
                {d === "4" ? "4+" : d}
              </button>
            ))}
          </div>
        </div>

        <div className="wz-campo">
          <FieldLabel>Baños</FieldLabel>
          <div className="wz-fila-banos" role="group" aria-label="Baños">
            {[
              { value: "1", label: "1" },
              { value: "2", label: "2" },
              { value: "3", label: "3+" },
            ].map((b) => (
              <button key={b.value} type="button" aria-pressed={answers.banos === b.value} onClick={() => patchAnswers({ banos: b.value })}>
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="wz-dos">
          <NumericInput
            label="Estacionamientos"
            tooltip="Cuántos estacionamientos incluye. 0 si no tiene."
            value={answers.estacionamientos ?? ""}
            onChange={(v) => patchAnswers({ estacionamientos: v })}
            decimales={DEC.estacionamientos}
            placeholder="0"
            formatEco={(v) => `${v} ${v === 1 ? "estacionamiento" : "estacionamientos"}`}
          />
          <NumericInput
            label="Bodegas"
            tooltip="Cuántas bodegas incluye. 0 si no tiene."
            value={answers.bodegas ?? ""}
            onChange={(v) => patchAnswers({ bodegas: v })}
            decimales={DEC.bodegas}
            placeholder="0"
            formatEco={(v) => `${v} ${v === 1 ? "bodega" : "bodegas"}`}
          />
        </div>

        <FuenteLine>Estacionamiento y bodega afectan el precio y el arriendo: déjalos en 0 si no vienen.</FuenteLine>
      </div>

      <PrimaryBtn onClick={() => answer("tam")} disabled={!puedeSeguir}>
        Continuar →
      </PrimaryBtn>
    </div>
  );
}
