"use client";

// Wizard v4 — Pantallas del Acto 3 (CÓMO LO RENTABILIZAS).
// arr + arrFix (arriendo LTR: mediana real + N comparables), adr + adrFix
// (baseline AirROI: tarifa/noche + ocupación).
//
// LOS SUPUESTOS A LA VISTA (entrega 2, 27-sep-2026). Hasta acá vivían en un desplegable cerrado
// y de solo lectura, DEBAJO del botón de aceptar: el arriendo se aceptaba sin ver lo que se le
// descuenta, y los gastos comunes quedaban a tres toques en el resumen. Ahora son filas
// editables antes del botón, con el mismo formato que el resumen (`filas.tsx`).
//
// En la tarifa, además, se pregunta lo que el motor suponía en silencio: quién lo opera (marcado
// en «lo opero yo», que es lo que el motor supone hoy para todo el parque: 3% de la plataforma),
// si está amoblado (sin esa pregunta entraban siempre $3,5M de amoblamiento) y los huéspedes.

import { estimarContribuciones } from "@/lib/contribuciones";
import { datosDfl2 } from "./wizardV4Submit";
import { getGgccFallback } from "@/lib/services/market-suggestions";
import { getCostosDefault } from "@/lib/engines/short-term-engine";
import { formatNumeroCL, parseNumeroCL } from "@/lib/numero-cl";
import type { ScreenProps } from "./screensActo1";
import { escalaArriendo, escalaComision, escalaOcupacion, escalaTarifa, escalaVacancia } from "./avisoEscala";
import { DEC, type WizardV4Answers } from "./wizardV4Nodes";
import { BarraCta, ChoiceTile, FieldLabel, FuenteLine, LinkBtn, PrimaryBtn, Segmented, TileTexto } from "./ui";
import { NumericInput, decimalesUtiles, ecoPorDefecto } from "./NumericInput";
import { FilaNum } from "./filas";
import {
  HUESPEDES_MAX,
  costosOperativosEditados,
  dormLabel,
  dormitoriosNum,
  fmtCLP,
  fuenteArriendoLine,
  huespedesNum,
  leerNum,
  precioUF,
  superficieM2,
} from "./derive";
import type { WizardV4Data } from "./useWizardV4Data";

/** Texto guardado → cifra para la píldora, con los decimales que el valor realmente tiene. */
function num(raw: string | undefined, decimales: 0 | 1 | 2, def: number): string {
  const v = parseNumeroCL(raw ?? "", decimales);
  const x = v === null ? def : v;
  return formatNumeroCL(x, decimalesUtiles(x));
}

/** Los dos supuestos del inmueble (se descuentan en renta larga y se pagan en renta corta). */
function supuestosInmueble(answers: WizardV4Answers, data: WizardV4Data) {
  const sup = superficieM2(answers);
  const ggcc = data.ggccSugerido ?? getGgccFallback(answers.comuna ?? "", sup) ?? 0;
  const contrib = estimarContribuciones(precioUF(answers) * data.ufCLP, datosDfl2(answers));
  return { sup, ggcc: Math.round(ggcc), contrib: Math.round(contrib) };
}

/** Las filas de gastos comunes y contribuciones. `completas` = con la procedencia larga. */
function FilasInmueble({ answers, data, patchAnswers, completas }: Pick<ScreenProps, "answers" | "data" | "patchAnswers"> & { completas: boolean }) {
  const { sup, ggcc, contrib } = supuestosInmueble(answers, data);
  const supTxt = sup > 0 ? ` para ${formatNumeroCL(sup, decimalesUtiles(sup))} m²` : "";
  return (
    <>
      <FilaNum
        label="Gastos comunes"
        sub={answers.gastosComunes ? "Lo corregiste tú" : `Típicos de la comuna${completas ? supTxt : ""}`}
        raw={answers.gastosComunes ?? formatNumeroCL(ggcc, DEC.gastosComunes)}
        display={`$${num(answers.gastosComunes, DEC.gastosComunes, ggcc)}`}
        unidad="/mes"
        decimales={DEC.gastosComunes}
        formatEco={ecoPorDefecto("$", " al mes")}
        onCommit={(v) => patchAnswers({ gastosComunes: v })}
      />
      <FilaNum
        label="Contribuciones"
        sub={answers.contribuciones ? "Lo corregiste tú" : completas ? "Fórmula del SII sobre el avalúo estimado" : "Fórmula del SII"}
        raw={answers.contribuciones ?? formatNumeroCL(contrib, DEC.contribuciones)}
        display={`$${num(answers.contribuciones, DEC.contribuciones, contrib)}`}
        unidad="/trim"
        decimales={DEC.contribuciones}
        formatEco={ecoPorDefecto("$", " al trimestre")}
        onCommit={(v) => patchAnswers({ contribuciones: v })}
      />
    </>
  );
}

// ── arr (arriendo LTR) ────────────────────────────────────────────────────────

export function ArrScreen({ answers, data, answer, goDetour, patchAnswers }: ScreenProps) {
  const sugerido = data.arriendoSugerido;
  const listo = sugerido != null && sugerido > 0;
  // Tres estados, no dos: con dato, buscando y SIN dato. El tercero apareció el
  // 2026-08-04, cuando se retiraron los dos niveles de relleno — antes siempre
  // llegaba un número, aunque fuera inventado.
  const buscando = data.suggestionsLoading;
  const sinDato = !listo && !buscando;

  const supuestos = (
    <div className="wz-filas">
      <div className="wz-ft">Lo que se descuenta del arriendo</div>
      <FilasInmueble answers={answers} data={data} patchAnswers={patchAnswers} completas />
      <FilaNum
        label="Vacancia"
        sub={answers.vacanciaPct ? "Lo corregiste tú" : "Meses sin arrendatario al año, en promedio"}
        raw={answers.vacanciaPct ?? "5"}
        display={num(answers.vacanciaPct, DEC.vacancia, 5)}
        unidad="%"
        decimales={DEC.vacancia}
        formatEco={ecoPorDefecto("", "% del año")}
        escala={escalaVacancia}
        onCommit={(v) => patchAnswers({ vacanciaPct: v })}
      />
    </div>
  );

  // Sin comparables no hay estimación que ofrecer. Franco lo dice y pide el número
  // en vez de rellenar el campo con una cifra que no puede respaldar.
  if (sinDato) {
    const val = answers.arriendo ?? "";
    return (
      <div>
        <div className="wz-gap">
          <NumericInput
            label="Arriendo mensual"
            value={val}
            onChange={(v) => patchAnswers({ arriendo: v })}
            decimales={DEC.arriendo}
            placeholder="650.000"
            sufijo="$"
            ecoPrefijo="$"
            ecoSufijo=" al mes"
            escala={escalaArriendo}
          />
          <FuenteLine>No hay arriendos publicados cerca de esta dirección para comparar. Ingresa el que estimas cobrar.</FuenteLine>
          {supuestos}
        </div>
        <PrimaryBtn onClick={() => answer("arr", { arrModo: "corregir" })} disabled={leerNum(val, DEC.arriendo) <= 0}>
          Guardar y continuar →
        </PrimaryBtn>
      </div>
    );
  }

  return (
    <div>
      <div className="wz-gap">
        <div className="wz-bloque" aria-live="polite">
          <div className="wz-rot-cifra">Arriendo estimado</div>
          <div className="wz-cifra">
            {listo ? fmtCLP(sugerido ?? 0) : "Estimando…"}
            {listo && <small>/mes</small>}
          </div>
          {listo && <FuenteLine>{fuenteArriendoLine(data.arriendoFuente, data.arriendoN, data.radiusUsed, data.arriendoRango)}</FuenteLine>}
        </div>
        {supuestos}
      </div>

      <PrimaryBtn
        onClick={() => answer("arr", { arrModo: "estimacion", arriendo: listo ? String(sugerido) : "" })}
        disabled={!listo}
      >
        Usar estimación →
      </PrimaryBtn>
      <LinkBtn onClick={() => goDetour("arrFix", { arrModo: "corregir" })}>Corregir el arriendo</LinkBtn>
    </div>
  );
}

export function ArrFixScreen({ answers, data, patchAnswers, answer }: ScreenProps) {
  const val = answers.arriendo ?? (data.arriendoSugerido ? String(data.arriendoSugerido) : "");
  const valido = leerNum(val, DEC.arriendo) > 0;
  const sug = data.arriendoSugerido;
  return (
    <div>
      <div className="wz-gap">
        <NumericInput
          label="Arriendo mensual"
          value={answers.arriendo ?? ""}
          onChange={(v) => patchAnswers({ arriendo: v })}
          decimales={DEC.arriendo}
          placeholder={sug ? formatNumeroCL(sug, 0) : "650.000"}
          sufijo="$"
          formatEco={(v) => `$${formatNumeroCL(v, decimalesUtiles(v))} al mes${sug ? ` · Franco estimaba ${fmtCLP(sug)}` : ""}`}
          escala={escalaArriendo}
        />
        <FuenteLine>Lo que crees que puedes cobrar de arriendo al mes.</FuenteLine>
      </div>
      <PrimaryBtn onClick={() => answer("arrFix")} disabled={!valido}>Guardar y continuar →</PrimaryBtn>
    </div>
  );
}

// ── adr (STR: tarifa/noche + ocupación) ───────────────────────────────────────

const DIAS_MES = 30.44;

/** La tarifa por noche que implica la estimación de AirROI (0 si todavía no llega). */
function tarifaEstimada(data: WizardV4Data): number {
  const { airRoi } = data;
  const occ = airRoi.ocupacionReferencia;
  return airRoi.ingresoBrutoMensual > 0 && occ > 0 ? Math.round(airRoi.ingresoBrutoMensual / (DIAS_MES * occ)) : 0;
}

export function AdrScreen({ answers, data, answer, goDetour, patchAnswers }: ScreenProps) {
  const { airRoi } = data;
  const occ = airRoi.ocupacionReferencia;
  const tarifa = tarifaEstimada(data);
  const listo = !airRoi.isLoading && tarifa > 0;
  const dorm = dormitoriosNum(answers);
  const costos = getCostosDefault(dorm, "basico");
  const totalOps = costos.costoElectricidad + costos.costoAgua + costos.costoWifi + costos.costoInsumos;
  const totalOpsEditado = costosOperativosEditados(answers);
  const admin = answers.modoGestion === "administrador";
  const amoblado = answers.estaAmoblado === true;
  const huespedes = huespedesNum(answers);
  const tipologia = dormLabel(dorm);

  return (
    <div>
      <div className="wz-gap">
        <div className="wz-bloque" aria-live="polite">
          <div className="wz-dos">
            <div>
              <div className="wz-rot-cifra">Tarifa por noche</div>
              <div className="wz-cifra">{listo ? fmtCLP(tarifa) : "…"}</div>
            </div>
            <div>
              <div className="wz-rot-cifra">Ocupación</div>
              <div className="wz-cifra">{listo ? `${Math.round(occ * 100)}%` : "…"}</div>
            </div>
          </div>
          <FuenteLine>Datos de mercado de Airbnb de la zona, últimos 90 días.</FuenteLine>
        </div>

        {/* QUIÉN LO OPERA, marcado en «lo opero yo»: es lo que el motor supone hoy para el 100%
            del parque (el base cobra el 3% de la plataforma). Con 20% por defecto cambiarían 50
            de 191 veredictos (medido el 26-sep-2026): por eso no es el defecto. */}
        <div className="wz-campo">
          <FieldLabel>¿Quién lo opera?</FieldLabel>
          <div className="wz-gap wz-gap-0">
            <ChoiceTile
              selected={!admin}
              onClick={() => patchAnswers({ modoGestion: "auto" })}
              ariaLabel="Lo opero yo. Pagas la comisión de la plataforma: 3% del ingreso."
            >
              <TileTexto t="Lo opero yo" s="Pagas la comisión de la plataforma: 3% del ingreso." />
            </ChoiceTile>
            <ChoiceTile
              selected={admin}
              onClick={() => patchAnswers({ modoGestion: "administrador" })}
              ariaLabel="Un administrador. Cobra un porcentaje del ingreso y se hace cargo de todo."
            >
              <TileTexto t="Un administrador" s="Cobra un porcentaje del ingreso y se hace cargo de todo." />
            </ChoiceTile>
          </div>
        </div>

        {admin && (
          <NumericInput
            label="Comisión del administrador"
            tooltip="El porcentaje del ingreso por noches que cobra quien opera el depto. El motor lo cobra en lugar del 3% de la plataforma. Un 20% es lo típico."
            value={answers.comisionStrPct ?? "20"}
            onChange={(v) => patchAnswers({ comisionStrPct: v })}
            decimales={DEC.comisionAdmin}
            placeholder="20"
            sufijo="%"
            formatEco={(v) => `${formatNumeroCL(v, decimalesUtiles(v))}% del ingreso, en lugar del 3% de la plataforma`}
            escala={escalaComision}
          />
        )}

        <div className="wz-dos">
          <div className="wz-campo">
            <FieldLabel>¿Está amoblado?</FieldLabel>
            <Segmented
              lleno
              ariaLabel="¿Está amoblado?"
              options={[
                { value: "no", label: "No" },
                { value: "si", label: "Sí" },
              ]}
              value={amoblado ? "si" : "no"}
              onChange={(v) => patchAnswers({ estaAmoblado: v === "si" })}
            />
          </div>
          <div className="wz-campo">
            <FieldLabel tooltip={`Cuántas personas recibe a la vez. La estimación de tarifa y ocupación se busca para esa capacidad; sin cambiarlo, son dos por dormitorio (mínimo dos).`}>
              Huéspedes
            </FieldLabel>
            <div className="wz-seg lleno wz-stepper" role="group" aria-label="Huéspedes">
              <button
                type="button"
                aria-label="Un huésped menos"
                disabled={huespedes <= 1}
                onClick={() => patchAnswers({ capacidadHuespedes: String(Math.max(1, huespedes - 1)) })}
              >
                −
              </button>
              <span className="wz-stepper-n" aria-live="polite">{huespedes}</span>
              <button
                type="button"
                aria-label="Un huésped más"
                disabled={huespedes >= HUESPEDES_MAX}
                onClick={() => patchAnswers({ capacidadHuespedes: String(Math.min(HUESPEDES_MAX, huespedes + 1)) })}
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="wz-filas">
          <div className="wz-ft">Lo que cuesta operarlo</div>
          <FilaNum
            label="Luz, agua, wifi e insumos"
            sub={totalOpsEditado ? "Lo corregiste tú" : `Consumo típico para ${tipologia}`}
            raw={totalOpsEditado ?? String(totalOps)}
            display={`$${num(totalOpsEditado, DEC.costos, totalOps)}`}
            unidad="/mes"
            decimales={DEC.costos}
            formatEco={ecoPorDefecto("$", " al mes")}
            onCommit={(v) => patchAnswers({ costosOperativos: v })}
          />
          <FilaNum
            label="Mantención"
            sub={answers.mantencionStr ? "Lo corregiste tú" : `Provisión mensual para ${tipologia}`}
            raw={answers.mantencionStr ?? String(costos.mantencion)}
            display={`$${num(answers.mantencionStr, DEC.costos, costos.mantencion)}`}
            unidad="/mes"
            decimales={DEC.costos}
            formatEco={ecoPorDefecto("$", " al mes")}
            onCommit={(v) => patchAnswers({ mantencionStr: v })}
          />
          <FilasInmueble answers={answers} data={data} patchAnswers={patchAnswers} completas={false} />
          {!amoblado && (
            <FilaNum
              label="Amoblarlo"
              sub={answers.costoAmoblamiento ? "Lo corregiste tú" : `Una vez, estimado para ${tipologia}`}
              raw={answers.costoAmoblamiento ?? String(costos.costoAmoblamiento)}
              display={`$${num(answers.costoAmoblamiento, DEC.costos, costos.costoAmoblamiento)}`}
              decimales={DEC.costos}
              formatEco={ecoPorDefecto("$", ", una vez")}
              onCommit={(v) => patchAnswers({ costoAmoblamiento: v })}
            />
          )}
        </div>
      </div>

      <LinkBtn onClick={() => goDetour("adrFix", { adrModo: "corregir" })}>Corregir tarifa u ocupación</LinkBtn>
      {/* La pantalla es más larga que el teléfono: el botón va en la barra fija de abajo, con el
          mismo ancho que en el resto del wizard. */}
      <BarraCta>
        <PrimaryBtn
          onClick={() => answer("adr", {
            adrModo: "estimacion",
            adrTarifa: listo ? String(tarifa) : "",
            adrOcupacion: listo ? String(Math.round(occ * 100)) : "",
          })}
          disabled={!listo}
        >
          Usar estimación →
        </PrimaryBtn>
      </BarraCta>
    </div>
  );
}

export function AdrFixScreen({ answers, data, patchAnswers, answer }: ScreenProps) {
  const occ = data.airRoi.ocupacionReferencia;
  const tarifaDef = tarifaEstimada(data);
  const valido =
    leerNum(answers.adrTarifa, DEC.tarifa) > 0 && leerNum(answers.adrOcupacion, DEC.ocupacion) > 0;
  return (
    <div>
      <div className="wz-gap">
        <div className="wz-dos">
          <NumericInput
            label="Tarifa por noche"
            value={answers.adrTarifa ?? ""}
            onChange={(v) => patchAnswers({ adrTarifa: v })}
            decimales={DEC.tarifa}
            placeholder={tarifaDef > 0 ? formatNumeroCL(tarifaDef, 0) : "55.000"}
            sufijo="$"
            ecoPrefijo="$"
            ecoSufijo=" la noche"
            escala={escalaTarifa}
          />
          <NumericInput
            label="Ocupación"
            value={answers.adrOcupacion ?? ""}
            onChange={(v) => patchAnswers({ adrOcupacion: v })}
            decimales={DEC.ocupacion}
            placeholder={occ > 0 ? String(Math.round(occ * 100)) : "60"}
            sufijo="%"
            ecoSufijo="% de las noches"
            escala={escalaOcupacion}
          />
        </div>
        <FuenteLine>Ajusta si tienes datos propios de tarifa u ocupación para este depto.</FuenteLine>
      </div>
      <PrimaryBtn onClick={() => answer("adrFix")} disabled={!valido}>Guardar y continuar →</PrimaryBtn>
    </div>
  );
}
