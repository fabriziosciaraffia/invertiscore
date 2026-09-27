"use client";

// Wizard v4 — Pantallas del Acto 2 (CÓMO LO FINANCIAS).
// precio (dual UF/CLP, SIN prefill), pie (toggle $/UF/% + equivalencias, y «otra fuente»), tasa +
// tasaFix (estimación con corrección inline), plazo (slider con la cuota en vivo).
//
// Formato del informe desde el 27-sep-2026 (entrega 2). Mockup aprobado:
// docs/wireframes/rediseno-informe/wizard-v4-actualizado.html (pantallas pie, pie0, pie0-otra,
// tasa, tasa-sub, plazo).

import { useState } from "react";
import { usePostHog } from "posthog-js/react";
import { trackWizard } from "./track";
import { calcDividendo, mesesHastaEntrega } from "./helpers-wizard";
import type { ScreenProps } from "./screensActo1";
import { avisoPie, escalaPie, escalaPrecio, escalaTasa } from "./avisoEscala";
import type { PieUnidad, WizardV4Answers } from "./wizardV4Nodes";
import { DEC, decPie, PIE_RAZON_OPCIONES } from "./wizardV4Nodes";
import { BarraCta, ChoiceTile, FieldLabel, FuenteLine, LinkBtn, PrimaryBtn, Segmented, TileTexto } from "./ui";
import { NumericInput, convertirUnidad, decimalesUtiles } from "./NumericInput";
import { formatNumeroCL } from "@/lib/numero-cl";
import {
  convertirPieTexto,
  cuotaCLP,
  cuotaCreditoPieCLP,
  fmtCLP,
  fmtUF,
  leerNum,
  otraFuentePctCrudo,
  pieEfectivoPct,
  piePct,
  pieCLP,
  precioUF,
} from "./derive";
import { calificaSubsidioV4, tasaConSubsidioV4 } from "./wizardV4Subsidio";

const MES_ABBR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Número exacto, sin redondear: el eco nunca miente sobre lo que se leyó. */
const exacto = (v: number) => formatNumeroCL(v, decimalesUtiles(v));

/** De dónde sale la tasa de mercado (`config.tasa_hipotecaria`, que escribe update-market desde
 *  la serie mensual del Banco Central de créditos para vivienda en UF). */
const FUENTE_TASA = "Promedio de los créditos hipotecarios en UF que dieron los bancos el último mes, según el Banco Central.";

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
    <div>
      <div className="wz-gap">
        <div className="wz-fila-der">
          <Segmented
            ariaLabel="Moneda del precio"
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
          tooltip="El precio que pide el vendedor. Franco no lo prellena: lo evalúa contra el mercado."
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
          // otra moneda al lado.
          formatEco={(v) =>
            unidad === "uf"
              ? `UF ${exacto(v)}${data.ufCLP > 0 ? ` · ${fmtCLP(v * data.ufCLP)}` : ""}`
              : `$${exacto(v)}${data.ufCLP > 0 ? ` · ${fmtUF(v / data.ufCLP)}` : ""}`
          }
        />

        <FuenteLine>Este número lo pones tú: Franco no lo sugiere, lo evalúa.</FuenteLine>
      </div>

      <PrimaryBtn onClick={() => answer("precio")} disabled={uf <= 0}>
        Continuar →
      </PrimaryBtn>
    </div>
  );
}

// ── pie ─────────────────────────────────────────────────────────────────────

const PIE_UNITS: Array<{ value: PieUnidad; label: string }> = [
  { value: "pct", label: "%" },
  { value: "uf", label: "UF" },
  { value: "clp", label: "$" },
];

/** Las otras dos unidades de un monto de pie, para el eco («UF 840 · $33.600.000»). */
function equivalencias(pct: number, unidad: PieUnidad, answers: WizardV4Answers, ufCLP: number): string[] {
  if (pct <= 0) return [];
  const uf = (precioUF(answers) * pct) / 100;
  const out: string[] = [];
  if (unidad !== "uf") out.push(fmtUF(uf));
  if (unidad !== "clp") out.push(fmtCLP(uf * ufCLP));
  if (unidad !== "pct") out.push(`${Math.round(pct)}% del precio`);
  return out;
}

const ecoMonto = (v: number, unidad: PieUnidad) =>
  unidad === "pct" ? `${exacto(v)}% del precio` : unidad === "uf" ? `UF ${exacto(v)}` : `$${exacto(v)}`;

const sufijoPie = (u: PieUnidad) => (u === "pct" ? "%" : u === "uf" ? "UF" : "$");

/** Sin respuesta de la razón ni de «otra fuente»: lo que se limpia cuando el pie deja de ser 0. */
const SIN_RAZON: Partial<WizardV4Answers> = {
  pieRazon: undefined,
  otraFuenteMonto: undefined,
  otraFuenteCredito: undefined,
  otraFuenteCuota: undefined,
};

export function PieScreen({ answers, data, patchAnswers, answer }: ScreenProps) {
  const posthog = usePostHog();
  const unidad = answers.pieUnidad ?? "pct";
  const monto = answers.pieMonto ?? "";

  const pct = piePct(answers, data.ufCLP);
  const clp = pieCLP(answers, data.ufCLP);
  // QA-1: el pie no puede superar el 100% del precio (absurdo aritmético).
  const pieExcede = pct > 100;
  // Fase 5b · D1: el pie 0 deja de bloquear el Continuar. `pieCero` exige monto
  // ESCRITO (no el campo vacío): sin eso, la pantalla mostraría el bloque y el
  // selector antes de que el usuario tipee nada.
  const pieCero = monto.trim() !== "" && pct === 0;
  // Fix pie-cero: el campo VACÍO vuelve a bloquear. Son tres estados distintos:
  // vacío (bloquea — no hay dato), 0 escrito con razón (pasa — pie 0 declarado,
  // fase 5b intacta), monto > 0 (pasa).
  const pieVacio = monto.trim() === "";

  // «OTRA FUENTE» (27-sep-2026, decisión 1 del mockup): con pie 0 y esa razón, la pantalla pide
  // cuánto cubre y si es un crédito. Para el banco eso es pie; la cuota del crédito va al flujo.
  const conOtraFuente = pieCero && answers.pieRazon === "otra_fuente";
  const otraPct = conOtraFuente ? otraFuentePctCrudo(answers, data.ufCLP) : 0;
  const otraExcede = otraPct > 100;
  const esCredito = answers.otraFuenteCredito === true;
  const cuotaPie = cuotaCreditoPieCLP(answers, data.ufCLP);
  const faltaCuota = conOtraFuente && otraPct > 0 && esCredito && cuotaPie <= 0;

  // F6: pie en cuotas — solo nuevo + entrega futura. Informativa (NO editable):
  // pie total repartido parejo por los meses hasta la entrega.
  let enCuotas: string | null = null;
  if (answers.tipoPropiedad === "nuevo" && answers.estadoVenta === "futura" && clp > 0) {
    const meses = mesesHastaEntrega(answers.fechaEntregaMes ?? "", answers.fechaEntregaAnio ?? "");
    if (meses > 0) {
      const mesLbl = MES_ABBR[Number(answers.fechaEntregaMes) - 1] ?? "";
      enCuotas = `≈ ${fmtCLP(Math.round(clp / meses))} al mes si lo pagas parejo hasta la entrega (${mesLbl} ${answers.fechaEntregaAnio}).`;
    }
  }

  // Lo que financia el banco con «otra fuente»: sobre el pie que ve el banco, con la tasa y el
  // plazo elegidos o —si todavía no se eligieron: la tasa viene después— los de hoy a 25 años.
  const pUF = precioUF(answers);
  const efectivo = pieEfectivoPct(answers, data.ufCLP);
  const tasaElegida = leerNum(answers.tasaInteres, DEC.tasa);
  const plazoElegido = Number(answers.plazoCredito) || 0;
  const cuotaBanco =
    otraPct > 0 && pUF > 0 && data.ufCLP > 0
      ? calcDividendo(pUF, efectivo, plazoElegido || 25, tasaElegida || data.tasaMercado, data.ufCLP)
      : 0;
  const supuestoCuota = tasaElegida > 0 && plazoElegido > 0 ? "" : ", a 25 años con la tasa de mercado de hoy";

  const onUnidad = (u: PieUnidad) => {
    // F1 (fix pie-cero): el toggle CONVIERTE el monto a la nueva unidad —nunca lo vacía: ese
    // vacío pasaba el gate como pie 0 silencioso—. `convertirPieTexto` reexpresa el VALOR
    // redondeado a la precisión de la unidad destino y devuelve null si el texto no se lee: ahí
    // se conservan valor y unidad. El monto de «otra fuente» va en la misma unidad y se convierte
    // igual.
    if (u === unidad) return;
    const patch: Partial<WizardV4Answers> = { pieUnidad: u };
    if (monto.trim() !== "") {
      const c = convertirPieTexto(monto, unidad, u, pUF, data.ufCLP);
      if (c == null) return;
      patch.pieMonto = c;
    }
    const otra = answers.otraFuenteMonto ?? "";
    if (otra.trim() !== "") {
      const c = convertirPieTexto(otra, unidad, u, pUF, data.ufCLP);
      if (c == null) return;
      patch.otraFuenteMonto = c;
    }
    patchAnswers(patch);
  };

  const cuerpo = (
    <div className="wz-gap">
      <div className="wz-fila-der">
        <Segmented ariaLabel="Unidad del pie" options={PIE_UNITS} value={unidad} onChange={onUnidad} />
      </div>

      <NumericInput
        label="Pie"
        tooltip="Lo que pagas al contado al firmar. El resto se financia con crédito hipotecario."
        value={monto}
        onChange={(v) => {
          // Fase 5b: si el pie vuelve a > 0, la razón se descarta EN SILENCIO
          // (decisión cerrada), y con ella lo que se dijo de «otra fuente».
          const nuevoPct = piePct({ ...answers, pieMonto: v }, data.ufCLP);
          patchAnswers(nuevoPct > 0 && answers.pieRazon ? { pieMonto: v, ...SIN_RAZON } : { pieMonto: v });
        }}
        decimales={decPie(unidad)}
        placeholder={unidad === "pct" ? "20" : unidad === "uf" ? "640" : "24.800.000"}
        sufijo={sufijoPie(unidad)}
        // La regla mira el PORCENTAJE. En unidad "%" el valor tipeado YA es ese porcentaje; en
        // UF/$ se deriva (`pct`, que clampea a 100: por esa vía un 125% no puede avisar). Con pie
        // 0 y la razón elegida, el aviso se va (`avisoPie`).
        escala={(v) => avisoPie(unidad === "pct" ? v : pct, answers.pieRazon)}
        formatEco={(v) => [ecoMonto(v, unidad), ...equivalencias(pct, unidad, answers, data.ufCLP)].join(" · ")}
      />

      {enCuotas && <p className="wz-eco">{enCuotas}</p>}

      {/* Fase 5b · pie 0. D2: permiso informado que nombra la consecuencia (el dividendo queda
          en su punto más alto). Con «otra fuente» no va: ahí el banco NO financia el 100%, y lo
          que se financia lo dice el bloque de esa fuente. */}
      {pieCero && !conOtraFuente && (
        <div className="wz-bloque">
          <div className="wz-bt">Pie 0%</div>
          <p>Financias el 100% con crédito: el dividendo queda en su punto más alto. Franco analiza el depto igual y te muestra qué significa mes a mes.</p>
        </div>
      )}

      {/* D3 · selector obligatorio, SOLO con pie exactamente 0. */}
      {pieCero && (
        <>
          <FieldLabel>¿Por qué no pones pie?</FieldLabel>
          <div className="wz-gap wz-gap-0">
            {PIE_RAZON_OPCIONES.map((o) => (
              <ChoiceTile
                key={o.value}
                selected={answers.pieRazon === o.value}
                onClick={() =>
                  patchAnswers(o.value === "otra_fuente" ? { pieRazon: o.value } : { ...SIN_RAZON, pieRazon: o.value })
                }
                ariaLabel={o.sub ? `${o.label}. ${o.sub}` : o.label}
              >
                <TileTexto t={o.label} s={o.sub} />
              </ChoiceTile>
            ))}
          </div>
        </>
      )}

      {conOtraFuente && (
        <div className="wz-sunk">
          <NumericInput
            label="¿Cuánto cubre esa otra fuente?"
            value={answers.otraFuenteMonto ?? ""}
            onChange={(v) => patchAnswers({ otraFuenteMonto: v })}
            decimales={decPie(unidad)}
            placeholder={unidad === "pct" ? "20" : unidad === "uf" ? "640" : "24.800.000"}
            sufijo={sufijoPie(unidad)}
            escala={() => (otraExcede ? escalaPie(otraPct) : null)}
            formatEco={(v) => [ecoMonto(v, unidad), ...equivalencias(Math.min(otraPct, 100), unidad, answers, data.ufCLP)].join(" · ")}
          />
          <div className="wz-campo">
            <FieldLabel>¿Es un crédito?</FieldLabel>
            <Segmented
              lleno
              ariaLabel="¿Es un crédito?"
              options={[
                { value: "no", label: "No" },
                { value: "si", label: "Sí" },
              ]}
              value={esCredito ? "si" : "no"}
              onChange={(v) => patchAnswers(v === "si" ? { otraFuenteCredito: true } : { otraFuenteCredito: false, otraFuenteCuota: undefined })}
            />
          </div>
          {esCredito && (
            <NumericInput
              label="Cuota mensual de ese crédito"
              value={answers.otraFuenteCuota ?? ""}
              onChange={(v) => patchAnswers({ otraFuenteCuota: v })}
              decimales={DEC.cuotaCreditoPie}
              placeholder="520.000"
              sufijo="$"
              ecoPrefijo="$"
              ecoSufijo=" al mes"
            />
          )}
          {cuotaBanco > 0 && !otraExcede && (
            <p className="wz-indic">
              Con esto el banco financia <b>{fmtUF((pUF * (100 - efectivo)) / 100)}</b> ({Math.round(100 - efectivo)}%) y su cuota
              queda en <b>{fmtCLP(cuotaBanco)}</b>{supuestoCuota}.
              {esCredito
                ? cuotaPie > 0 && (
                    <>
                      {" "}La cuota del crédito se suma a tu flujo mensual: en cuotas pagas <b>{fmtCLP(cuotaBanco + cuotaPie)}</b> al mes.
                    </>
                  )
                : " Sin crédito, esa plata es tuya: se mide como pie."}
            </p>
          )}
        </div>
      )}
    </div>
  );

  const bloqueado =
    pieVacio || pct < 0 || pieExcede || (pieCero && !answers.pieRazon) || otraExcede || faltaCuota;
  const boton = (
    <PrimaryBtn
      onClick={() => {
        if (pieCero) {
          trackWizard(posthog, "wizard4_pie_cero", {
            razon: answers.pieRazon,
            otra_fuente_monto: otraPct > 0,
            otra_fuente_credito: otraPct > 0 && esCredito,
          });
        }
        answer("pie");
      }}
      disabled={bloqueado}
    >
      Continuar →
    </PrimaryBtn>
  );
  const aviso = pieCero && !answers.pieRazon
    ? "Elige una opción para continuar."
    : faltaCuota
      ? "Indica la cuota del crédito para continuar."
      : null;

  // Con pie 0 la pantalla es más larga que el teléfono: el botón va en la barra fija de abajo.
  return (
    <div>
      {cuerpo}
      {pieCero ? (
        <BarraCta>
          {boton}
          {aviso && <p className="wz-bajo-cta">{aviso}</p>}
        </BarraCta>
      ) : (
        boton
      )}
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

  // Capa aplicación del subsidio: si el precio real + tipo califican (nuevo en
  // primera venta, dentro del techo), se ofrece la tasa subsidiada como opción
  // explícita (destacada con borde de tinta, NO preseleccionada). El delta fluye
  // por tasaInteres, idéntico a v3.
  //
  // El copy dice "esta es la mínima" y no "aplica solo a primera vivienda": la
  // ley no exige primera vivienda (ver lib/constants/subsidio.ts) y la rebaja
  // real va de 0,61% a 1,16% según el banco, así que 0,6 es un piso —y por eso la
  // tasa ofrecida no redondea a favor (`tasaConSubsidioV4`)—.
  if (calificaSubsidioV4(answers)) {
    const tSub = tasaConSubsidioV4(t);
    return (
      <div>
        <div className="wz-gap">
          <ChoiceTile
            accent
            onClick={() => {
              trackWizard(posthog, "wizard4_subsidio_aplicado", { comuna: answers.comuna });
              answer("tasa", { tasaModo: "estimada", tasaInteres: tasaStr(tSub) });
            }}
            ariaLabel={`Con subsidio, ${tasaStr(tSub)}% anual. La rebaja exacta la fija tu banco: esta es la mínima.`}
          >
            <span className="wz-eb">Con subsidio</span>
            <span className="wz-grande">{tasaStr(tSub)}%</span>
            <span className="wz-s">
              La rebaja exacta la fija tu banco: esta es la mínima. Subsidio a la tasa para vivienda nueva en primera venta hasta UF 6.000 (Ley 21.748).
            </span>
          </ChoiceTile>
          <ChoiceTile
            onClick={() => answer("tasa", { tasaModo: "estimada", tasaInteres: tasaStr(t) })}
            ariaLabel={`Tasa de mercado, ${tasaStr(t)}% anual.`}
          >
            <span className="wz-eb">Tasa de mercado</span>
            <span className="wz-grande">{tasaStr(t)}%</span>
            <span className="wz-s">{FUENTE_TASA}</span>
          </ChoiceTile>
        </div>
        <LinkBtn onClick={() => goDetour("tasaFix", { tasaModo: "preaprobada" })}>Tengo una tasa pre-aprobada distinta</LinkBtn>
      </div>
    );
  }

  return (
    <div>
      <div className="wz-gap">
        <div className="wz-bloque">
          <div className="wz-rot-cifra">Tasa de mercado</div>
          <div className="wz-cifra">
            {tasaStr(t)}
            <small>% anual</small>
          </div>
          <FuenteLine>{FUENTE_TASA}</FuenteLine>
        </div>
      </div>

      <PrimaryBtn onClick={() => answer("tasa", { tasaModo: "estimada", tasaInteres: tasaStr(t) })}>
        Usar esta tasa →
      </PrimaryBtn>
      <LinkBtn onClick={() => goDetour("tasaFix", { tasaModo: "preaprobada" })}>Tengo una tasa pre-aprobada distinta</LinkBtn>
    </div>
  );
}

export function TasaFixScreen({ answers, data, patchAnswers, answer }: ScreenProps) {
  // El texto crudo se conserva tal cual: filtrarlo acá le borraba al usuario lo
  // que estaba escribiendo. Si no se puede leer, el eco lo dice y `valido` es 0.
  const monto = answers.tasaInteres ?? "";
  const valido = leerNum(monto, DEC.tasa) > 0;
  return (
    <div>
      <div className="wz-gap">
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
        {/* No hace falta enseñar la convención: el campo toma coma o punto y el eco muestra
            cómo lo entendió. */}
        <FuenteLine>Como te la dio el banco: con coma o con punto, da lo mismo.</FuenteLine>
      </div>
      <PrimaryBtn onClick={() => answer("tasaFix")} disabled={!valido}>
        Guardar y continuar →
      </PrimaryBtn>
    </div>
  );
}

// ── plazo ─────────────────────────────────────────────────────────────────────

const PLAZOS = ["15", "20", "25", "30"];

export function PlazoScreen({ answers, data, patchAnswers, answer }: ScreenProps) {
  const plazo = answers.plazoCredito || "25";
  // LA CUOTA EN VIVO (27-sep-2026): se mueve con el slider, en esta misma pantalla. Antes
  // aparecía en la siguiente, como reacción: el plazo se elegía sin ver lo que costaba.
  const conPlazo = { ...answers, plazoCredito: plazo };
  const cuota = cuotaCLP(conPlazo, data.ufCLP);
  const pUF = precioUF(answers);
  const efectivo = pieEfectivoPct(answers, data.ufCLP);
  const tasa = leerNum(answers.tasaInteres, DEC.tasa);
  const cuotaPie = cuotaCreditoPieCLP(answers, data.ufCLP);

  return (
    <div>
      <div className="wz-gap">
        <div className="wz-plazo-anos">
          <span className="wz-cifra wz-cifra-xl">{plazo}</span> <span className="wz-plazo-u">años</span>
        </div>
        <div>
          <input
            type="range"
            min={15}
            max={30}
            step={5}
            value={Number(plazo)}
            onChange={(e) => patchAnswers({ plazoCredito: e.target.value })}
            className="wz-range"
            aria-label="Plazo del crédito en años"
            aria-valuetext={`${plazo} años`}
          />
          <div className="wz-marcas" aria-hidden>
            {PLAZOS.map((p) => (
              <span key={p} aria-current={p === plazo}>{p}</span>
            ))}
          </div>
        </div>

        {cuota > 0 && (
          <div className="wz-bloque" aria-live="polite">
            <div className="wz-rot-cifra">Tu cuota mensual</div>
            <div className="wz-cifra">{fmtCLP(cuota)}</div>
            <FuenteLine>
              Crédito de {fmtUF((pUF * (100 - efectivo)) / 100)} ({Math.round(100 - efectivo)}% del precio)
              {tasa > 0 ? ` al ${tasaStr(tasa)}% anual` : ""}. Más plazo baja la cuota, pero pagas más intereses en total.
              {cuotaPie > 0 ? ` Aparte va la cuota del crédito del pie: ${fmtCLP(cuotaPie)} al mes.` : ""}
            </FuenteLine>
          </div>
        )}
      </div>

      <PrimaryBtn onClick={() => answer("plazo", { plazoCredito: plazo })}>Continuar →</PrimaryBtn>
    </div>
  );
}
