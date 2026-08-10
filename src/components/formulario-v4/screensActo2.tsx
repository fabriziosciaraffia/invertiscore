"use client";

// Wizard v4 — Pantallas del Acto 2 (CÓMO LO FINANCIAS).
// precio (dual UF/CLP, SIN prefill), pie (toggle $/UF/% + equivalencias), tasa +
// tasaFix (estimación con corrección inline), plazo (segmented).

import { useState } from "react";
import { usePostHog } from "posthog-js/react";
import { trackWizard } from "./track";
import { mesesHastaEntrega } from "@/components/formulario-v3/wizardV3State";
import type { ScreenProps } from "./screensActo1";
import { escalaPie, escalaPrecio, escalaTasa } from "./avisoEscala";
import type { PieUnidad } from "./wizardV4Nodes";
import { DEC, decPie, PIE_RAZON_OPCIONES } from "./wizardV4Nodes";
import { ChoiceTile, FieldLabel, FuenteLine, PrimaryBtn, GhostBtn, Segmented } from "./ui";
import { NumericInput, convertirUnidad, decimalesUtiles } from "./NumericInput";
import { formatNumeroCL } from "@/lib/numero-cl";
import { factorPie, fmtCLP, fmtUF, leerNum, piePct, pieUF, pieCLP, precioUF } from "./derive";
import { calificaSubsidioV4, tasaConSubsidioV4 } from "./wizardV4Subsidio";

const MES_ABBR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Número exacto, sin redondear: el eco nunca miente sobre lo que se leyó. */
const exacto = (v: number) => formatNumeroCL(v, decimalesUtiles(v));

// ── precio ────────────────────────────────────────────────────────────────────

export function PrecioScreen({ answers, data, patchAnswers, answer }: ScreenProps) {
  const [unidad, setUnidad] = useState<"uf" | "clp">("uf");
  // `answers.precio` guarda SIEMPRE UF: es lo que viaja al payload. `raw` es lo
  // que el usuario ve, en la unidad que eligió. En UF los dos son el mismo
  // texto; en pesos, `raw` son pesos y el precio se guarda convertido.
  const [raw, setRaw] = useState<string>(() => answers.precio ?? "");
  const decUnidad = unidad === "uf" ? DEC.precioUF : DEC.precioCLP;

  const onRaw = (v: string) => {
    setRaw(v);
    if (unidad === "uf") { patchAnswers({ precio: v }); return; }
    // En pesos: se guarda el equivalente en UF. Texto ilegible ⇒ precio vacío,
    // NUNCA un número inventado — el Continuar queda bloqueado y el eco explica.
    const enUF =
      data.ufCLP > 0 ? convertirUnidad(v, DEC.precioCLP, DEC.precioUF, 1 / data.ufCLP) : null;
    patchAnswers({ precio: enUF ?? "" });
  };

  const onToggle = (u: "uf" | "clp") => {
    if (u === unidad) return;
    // El toggle CONVIERTE el valor; no reinterpreta el string con otra
    // precisión. El precio en UF no cambia: cambia en qué unidad se muestra.
    const destino = u === "uf" ? DEC.precioUF : DEC.precioCLP;
    const factor = u === "clp" ? data.ufCLP : 1 / data.ufCLP;
    const convertido = convertirUnidad(raw, decUnidad, destino, factor);
    // Si lo escrito no se puede leer no hay nada que convertir: se deja tal cual
    // para que el usuario vea qué no se entendió, en vez de borrárselo.
    if (convertido !== null) {
      setRaw(convertido);
      if (u === "uf") patchAnswers({ precio: convertido });
    }
    setUnidad(u);
  };

  const uf = precioUF(answers);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-3">
        <Segmented
          options={[
            { value: "uf", label: "UF" },
            { value: "clp", label: "$" },
          ]}
          value={unidad}
          onChange={onToggle}
        />
      </div>

      <NumericInput
        label="Precio pedido"
        tooltip="El precio que pide el vendedor. Franco no lo prellena — lo evalúa contra el mercado."
        value={raw}
        onChange={onRaw}
        decimales={decUnidad}
        placeholder={unidad === "uf" ? "3.200" : "124.000.000"}
        sufijo={unidad === "uf" ? "UF" : "$"}
        strong
        // La regla del guard está en UF, así que en modo pesos hay que convertir
        // antes de preguntar. Sin esto, $124.000.000 se evaluaría como si fueran
        // 124 millones de UF y avisaría siempre.
        escala={(v) =>
          unidad === "uf"
            ? escalaPrecio(v)
            : data.ufCLP > 0
              ? escalaPrecio(v / data.ufCLP)
              : null
        }
        // El eco lleva la equivalencia adentro: el número tipeado va exacto y la
        // otra moneda al lado. Antes era una línea aparte, también con "=".
        formatEco={(v) =>
          unidad === "uf"
            ? `UF ${exacto(v)}${data.ufCLP > 0 ? ` · ${fmtCLP(v * data.ufCLP)}` : ""}`
            : `$${exacto(v)}${data.ufCLP > 0 ? ` · ${fmtUF(v / data.ufCLP)}` : ""}`
        }
      />

      <FuenteLine>Este número lo pones tú — Franco no lo sugiere, lo evalúa.</FuenteLine>

      <div className="mt-1">
        <PrimaryBtn onClick={() => answer("precio")} disabled={uf <= 0}>
          Continuar →
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ── pie ─────────────────────────────────────────────────────────────────────

const PIE_UNITS: Array<{ value: PieUnidad; label: string }> = [
  { value: "pct", label: "%" },
  { value: "uf", label: "UF" },
  { value: "clp", label: "$" },
];

export function PieScreen({ answers, data, patchAnswers, answer }: ScreenProps) {
  const posthog = usePostHog();
  const unidad = answers.pieUnidad ?? "pct";
  const monto = answers.pieMonto ?? "";

  const pct = piePct(answers, data.ufCLP);
  const uf = pieUF(answers, data.ufCLP);
  const clp = pieCLP(answers, data.ufCLP);
  // QA-1: el pie no puede superar el 100% del precio (absurdo aritmético).
  const pieExcede = pct > 100;
  // Fase 5b · D1: el pie 0 deja de bloquear el Continuar. `pieCero` exige monto
  // ESCRITO (no el campo vacío): sin eso, la pantalla mostraría el bloque y el
  // selector antes de que el usuario tipee nada.
  const pieCero = monto.trim() !== "" && pct === 0;
  // Fix pie-cero: el campo VACÍO vuelve a bloquear. Son tres estados distintos:
  // vacío (bloquea — no hay dato), 0 escrito con razón (pasa — pie 0 declarado,
  // fase 5b intacta), monto > 0 (pasa). El gate anterior (`pct < 0`) confundía
  // "vacío" con "no es cero" y dejaba pasar el cero silencioso que producción
  // midió en ~18% de los análisis desde la fase 5b.
  const pieVacio = monto.trim() === "";

  // Equivalencias en vivo: las otras dos unidades respecto a la que escribe.
  const equiv: string[] = [];
  if (pct > 0) {
    if (unidad !== "uf") equiv.push(fmtUF(uf));
    if (unidad !== "clp") equiv.push(fmtCLP(clp));
    if (unidad !== "pct") equiv.push(`${Math.round(pct)}% del precio`);
  }

  // F6: pie en cuotas — solo nuevo + entrega futura. Informativa (NO editable):
  // pie total repartido parejo por los meses hasta la entrega. No aparece en
  // usado ni entrega inmediata.
  // TODO: editable con patrón estimación/corrección cuando exista motor
  // pre-entrega (hoy el motor no consume calendario de pie).
  let enCuotas: string | null = null;
  if (answers.tipoPropiedad === "nuevo" && answers.estadoVenta === "futura" && clp > 0) {
    const meses = mesesHastaEntrega(answers.fechaEntregaMes ?? "", answers.fechaEntregaAnio ?? "");
    if (meses > 0) {
      const mesLbl = MES_ABBR[Number(answers.fechaEntregaMes) - 1] ?? "";
      enCuotas = `≈ ${fmtCLP(Math.round(clp / meses))}/mes si lo pagas parejo hasta la entrega (${mesLbl} ${answers.fechaEntregaAnio})`;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-3">
        <Segmented
          options={PIE_UNITS}
          value={unidad}
          onChange={(u) => {
            // F1 (fix pie-cero): el toggle CONVIERTE el monto a la nueva unidad.
            // Antes lo vaciaba (`pieMonto: ""`), y ese vacío pasaba el gate como
            // pie 0 silencioso — la vía por la que un pie bien tipeado terminaba
            // en un informe con financiamiento 100%. Mismo gesto que el toggle
            // UF/$ del precio: `convertirUnidad` reexpresa el VALOR (no el
            // string) y devuelve null si el texto no se lee o falta la base de
            // conversión — en ese caso se conservan valor y unidad, nunca se
            // borra ni se reinterpreta.
            if (u === unidad) return;
            if (monto.trim() === "") {
              patchAnswers({ pieUnidad: u });
              return;
            }
            const factor = factorPie(unidad, u, precioUF(answers), data.ufCLP);
            const convertido =
              factor != null ? convertirUnidad(monto, decPie(unidad), decPie(u), factor) : null;
            if (convertido != null) patchAnswers({ pieUnidad: u, pieMonto: convertido });
          }}
        />
      </div>

      <NumericInput
        label="Pie"
        tooltip="Lo que pagas al contado al firmar. El resto se financia con crédito hipotecario."
        value={monto}
        onChange={(v) => {
          // Fase 5b: si el pie vuelve a > 0, la razón se descarta EN SILENCIO
          // (decisión cerrada). Un pie con monto ya no necesita explicación.
          const nuevoPct = piePct({ ...answers, pieMonto: v }, data.ufCLP);
          patchAnswers(
            nuevoPct > 0 && answers.pieRazon
              ? { pieMonto: v, pieRazon: undefined }
              : { pieMonto: v },
          );
        }}
        decimales={decPie(unidad)}
        placeholder={unidad === "pct" ? "20" : unidad === "uf" ? "640" : "24.800.000"}
        sufijo={unidad === "pct" ? "%" : unidad === "uf" ? "UF" : "$"}
        // La regla mira el PORCENTAJE. En unidad "%" el valor tipeado YA es ese
        // porcentaje y se pasa crudo; en UF/$ hay que derivarlo, y ahí se usa
        // `pct`.
        //
        // Ojo con la asimetría: `piePct` clampea a 100 (`Math.min(monto, 100)`),
        // así que por la vía derivada un pie de 125% llega como 100 y el aviso no
        // puede dispararse. Sacar ese clamp es decisión aparte —lo consumen
        // `pieUF`, `pieCLP`, `cuotaCLP` y el submit, donde el tope sí tiene
        // sentido— y `derive.ts` está fuera del alcance de este cambio.
        escala={(v) => (unidad === "pct" ? escalaPie(v) : escalaPie(pct))}
        // Igual que en precio: el eco lleva las otras dos unidades adentro en vez
        // de repetir una segunda línea con "=".
        formatEco={(v) =>
          [
            unidad === "pct" ? `${exacto(v)}% del precio` : unidad === "uf" ? `UF ${exacto(v)}` : `$${exacto(v)}`,
            ...equiv,
          ].join(" · ")
        }
      />

      {enCuotas && (
        <p className="font-mono text-[12px] text-[var(--franco-text-muted)] m-0">{enCuotas}</p>
      )}

      {/* El mensaje del pie >100% lo da ahora el aviso de escala del campo, con
          el copy del guard (mismo que el modal). Acá quedaba una versión propia
          en rojo que decía lo mismo: dos mensajes para una condición, y uno de
          ellos gastando Signal Red en algo que el usuario SÍ entendió.
          `pieExcede` sigue bloqueando el Continuar — el gate es de QA-1 y no lo
          toca este cambio; lo que se retira es el texto duplicado. */}

      {/* Fase 5b · pie 0 (mockup 5f7c4f9). D2: permiso informado que nombra la
          consecuencia (el dividendo queda en su punto más alto), no solo el
          hecho. Ocupa el lugar de las equivalencias, que con pie 0 se ocultan
          solas (pct > 0) — "= UF 0 · $0" sería ruido. */}
      {pieCero && (
        <div
          className="rounded-r-lg border-l-2 border-[var(--franco-text-secondary)] pl-4 pr-4 py-3"
          style={{ background: "color-mix(in srgb, var(--franco-text) 3.5%, transparent)" }}
        >
          <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[var(--franco-text-tertiary)] m-0 mb-1">
            Pie 0%
          </p>
          <p className="font-body text-[13px] leading-[1.55] text-[var(--franco-text)] m-0">
            Financias el 100% con crédito: el dividendo queda en su punto más alto. Franco analiza el depto igual y te muestra qué significa mes a mes.
          </p>
        </div>
      )}

      {/* D3 · selector obligatorio, SOLO con pie exactamente 0. */}
      {pieCero && (
        <div className="flex flex-col gap-2.5">
          <FieldLabel>¿Por qué no pones pie?</FieldLabel>
          {PIE_RAZON_OPCIONES.map((o) => (
            <ChoiceTile
              key={o.value}
              selected={answers.pieRazon === o.value}
              onClick={() => patchAnswers({ pieRazon: o.value })}
              ariaLabel={o.label}
            >
              <span className="block">{o.label}</span>
              {o.sub && (
                <span
                  className={`block font-body text-[12px] mt-0.5 ${
                    answers.pieRazon === o.value ? "opacity-60" : "text-[var(--franco-text-secondary)]"
                  }`}
                >
                  {o.sub}
                </span>
              )}
            </ChoiceTile>
          ))}
        </div>
      )}

      <div className="mt-1">
        <PrimaryBtn
          onClick={() => {
            if (pieCero) {
              trackWizard(posthog, "wizard4_pie_cero", { razon: answers.pieRazon });
            }
            answer("pie");
          }}
          disabled={pieVacio || pct < 0 || pieExcede || (pieCero && !answers.pieRazon)}
        >
          Continuar →
        </PrimaryBtn>
        {pieCero && !answers.pieRazon && (
          <p className="font-body text-[12px] text-[var(--franco-text-secondary)] m-0 mt-2.5">
            Elige una opción para continuar.
          </p>
        )}
      </div>
    </div>
  );
}

// ── tasa ──────────────────────────────────────────────────────────────────────

function tasaStr(t: number): string {
  return t.toFixed(2).replace(".", ",");
}

export function TasaScreen({ answers, data, answer, goDetour }: ScreenProps) {
  const posthog = usePostHog();
  const t = data.tasaMercado;

  // Capa aplicación del subsidio: si el precio real + tipo califican (nuevo ≤ UF
  // 4.000), se ofrece la tasa subsidiada como opción explícita (destacada, NO
  // preseleccionada). El delta fluye por tasaInteres, idéntico a v3.
  if (calificaSubsidioV4(answers)) {
    const tSub = tasaConSubsidioV4(t);
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => {
            trackWizard(posthog, "wizard4_subsidio_aplicado", { comuna: answers.comuna });
            answer("tasa", { tasaModo: "estimada", tasaInteres: tasaStr(tSub) });
          }}
          className="franco-tile-target text-left rounded-xl border-[1.5px] border-signal-red bg-[var(--franco-card)] px-5 py-4 w-full transition-colors"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-signal-red block mb-1">
            Con subsidio
          </span>
          <span className="font-mono text-[26px] font-bold text-[var(--franco-text)] leading-none">{tasaStr(tSub)}%</span>
          <span className="block font-body text-[12px] text-[var(--franco-text-secondary)] mt-2">
            aplica solo a primera vivienda — verifica tu elegibilidad
          </span>
          <span className="block font-mono text-[11px] text-[var(--franco-text-muted)] mt-1">
            subsidio estatal a la tasa para viviendas nuevas hasta UF 4.000 (Ley 21.748)
          </span>
        </button>

        <button
          type="button"
          onClick={() => answer("tasa", { tasaModo: "estimada", tasaInteres: tasaStr(t) })}
          className="franco-tile-target text-left rounded-xl border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] px-5 py-4 w-full transition-colors"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--franco-text-muted)] block mb-1">
            Tasa de mercado
          </span>
          <span className="font-mono text-[22px] font-bold text-[var(--franco-text)] leading-none">{tasaStr(t)}%</span>
          <span className="block font-mono text-[11px] text-[var(--franco-text-muted)] mt-2">tasa de mercado vigente hoy</span>
        </button>

        <GhostBtn onClick={() => goDetour("tasaFix", { tasaModo: "preaprobada" })}>
          Tengo una tasa pre-aprobada distinta
        </GhostBtn>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--franco-text-muted)] m-0 mb-1">
          Tasa estimada
        </p>
        <p className="font-mono text-[28px] font-bold text-[var(--franco-text)] m-0 leading-none">
          {tasaStr(t)}%
        </p>
        <FuenteLine>tasa de mercado vigente hoy</FuenteLine>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <PrimaryBtn onClick={() => answer("tasa", { tasaModo: "estimada", tasaInteres: tasaStr(t) })}>
          Usar estimación →
        </PrimaryBtn>
        <GhostBtn onClick={() => goDetour("tasaFix", { tasaModo: "preaprobada" })}>
          Tengo una tasa pre-aprobada distinta
        </GhostBtn>
      </div>
    </div>
  );
}

export function TasaFixScreen({ answers, data, patchAnswers, answer }: ScreenProps) {
  // El texto crudo se conserva tal cual: filtrarlo acá le borraba al usuario lo
  // que estaba escribiendo. Si no se puede leer, el eco lo dice y `valido` es 0.
  const monto = answers.tasaInteres ?? "";
  const valido = leerNum(monto, DEC.tasa) > 0;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <NumericInput
          label="Tu tasa pre-aprobada"
          tooltip="La tasa anual en UF que te aprobó (o cotizó) tu banco."
          value={monto}
          onChange={(v) => patchAnswers({ tasaInteres: v })}
          decimales={DEC.tasa}
          placeholder={tasaStr(data.tasaMercado)}
          sufijo="%"
          ecoSufijo="% anual"
          escala={escalaTasa}
        />
        {/* Ya no hace falta enseñar la convención: el campo toma coma o punto y
            el eco muestra cómo lo entendió. */}
        <FuenteLine>Como te la dio el banco — con coma o con punto, da lo mismo.</FuenteLine>
      </div>
      <div className="mt-1">
        <PrimaryBtn onClick={() => answer("tasaFix")} disabled={!valido}>
          Guardar y continuar →
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ── plazo ─────────────────────────────────────────────────────────────────────

export function PlazoScreen({ answers, patchAnswers, answer }: ScreenProps) {
  const plazo = answers.plazoCredito || "25";
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <span className="font-mono text-[44px] font-bold text-[var(--franco-text)] leading-none">{plazo}</span>
        <span className="font-mono text-[16px] text-[var(--franco-text-secondary)] ml-2">años</span>
      </div>

      <div>
        <input
          type="range"
          min={15}
          max={30}
          step={5}
          value={Number(plazo)}
          onChange={(e) => patchAnswers({ plazoCredito: e.target.value })}
          className="w-full h-2 cursor-pointer"
          style={{ accentColor: "#C8323C" }}
          aria-label="Plazo del crédito en años"
        />
        <div className="flex justify-between mt-2 px-0.5">
          {["15", "20", "25", "30"].map((p) => (
            <span
              key={p}
              className={`font-mono text-[11px] ${
                p === plazo ? "text-[var(--franco-text)]" : "text-[var(--franco-text-muted)]"
              }`}
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      <FuenteLine>Más plazo baja la cuota mensual, pero pagas más intereses en total.</FuenteLine>

      <div className="mt-1">
        <PrimaryBtn onClick={() => answer("plazo", { plazoCredito: plazo })}>Continuar →</PrimaryBtn>
      </div>
    </div>
  );
}
