"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EL POP-UP DE AJUSTES (13-sep-2026) — LTR y STR, un solo componente.
//
// Contrato visual: docs/wireframes/rediseno-informe/popup-palancas-final.html
// Datos: los emite el motor (bloque A). Este componente NO recalcula nada: pinta
// `mixPalancas.celdas`, `.despues`, `.score` y `palancas[].score/destino`. Si acá
// hubiera aritmética de veredicto, el informe podría decir dos cosas distintas del
// mismo caso a dos clics de distancia.
//
// CUATRO ESTADOS, y son cuatro renders:
//   · con grilla  — matriz pie × plazo + el ajuste óptimo + la tabla de las solas
//   · sin grilla, con solas — solo la tabla (6 filas STR; ninguna LTR)
//   · COMPRAR     — no hay a dónde subir: los márgenes de la card y las solas si mueven
//   · sin nada    — NO SE ABRE. El botón no se dibuja; lo decide el hero.
//
// Medido sobre el parque recomputado el 13-sep-2026:
//                con grilla   sin grilla+solas   sin nada   COMPRAR
//      LTR           772            0              270        160
//      STR           114            6               73         56
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import type { CeldaMix, MetricasCelda } from "@/lib/mix-palancas";
import type { FilaLoQueHariaYo } from "@/lib/lo-que-haria-yo";
import type { HallazgoDistanciaVeredicto, PalancaDistancia, Veredicto } from "@/lib/types";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";

type Currency = "CLP" | "UF";

/** Guion para el par que no aplica. Con pie 0 el retorno sobre lo puesto no existe y la
 *  fila VA IGUAL: omitirla dejaría seis pares donde el contrato dice siete. */
const PAR_SIN_VALOR = "—";

const dec1 = (n: number) => n.toFixed(1).replace(".", ",").replace("-", "−");
const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const pct1 = (n: number) => `${dec1(n)}%`;
/** El signo va ANTES del símbolo, no entre el símbolo y el número: «−$283.194», no
 *  «$−283.194». Es la forma del resto del informe. */
const plata = (n: number, currency: Currency, valorUF: number) => {
  const signo = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  return currency === "UF" ? `${signo}UF ${dec1(abs / valorUF)}` : `${signo}$${miles(abs)}`;
};
const plataFirmada = (n: number, currency: Currency, valorUF: number) =>
  `${n > 0 ? "+" : ""}${plata(n, currency, valorUF)}`;

/** Quién mueve cada palanca. Es la columna «Si cambia» de la tabla. */
const QUIEN: Record<PalancaDistancia["palanca"], string> = {
  precio: "lo pone el vendedor",
  arriendo: "lo pone el mercado",
  adr: "lo pone el mercado",
  plazo: "lo pone el banco",
  pie: "lo pones tú",
  gestion: "lo decides tú",
};

const NOMBRE: Record<PalancaDistancia["palanca"], string> = {
  precio: "Precio",
  arriendo: "Arriendo",
  adr: "Tarifa",
  plazo: "Plazo",
  pie: "Pie",
  gestion: "Gestión",
};

/**
 * EL MIX QUE LLEGA A COMPRAR, y solo ese (contrato §5 · 13-sep-2026).
 *
 * `mixPalancas` apunta al veredicto INMEDIATAMENTE superior: desde AJUSTA eso ya es
 * COMPRAR, pero desde BUSCAR OTRA es el escalón intermedio, y **el escalón no se muestra
 * nunca**. Hasta hoy el pop-up tomaba `mixPalancas ?? mixPalancasHastaComprar`, o sea
 * prefería el del escalón: 399 filas LTR y 55 STR estaban sensibilizando hacia Ajustar y
 * ofreciendo un plan que no lleva a Comprar, sin decirlo.
 *
 * Misma regla que la card (`salidaPorMixStr`), que ya lo hacía bien.
 */
function mixAComprar(v: HallazgoDistanciaVeredicto["valor"]) {
  return v.veredictoBase === "BUSCAR OTRA" ? v.mixPalancasHastaComprar ?? null : v.mixPalancas ?? null;
}

/**
 * ¿ESTA CELDA LLEGA AL DESTINO? Y que el color diga lo mismo que la palabra.
 *
 * `alcanzable` sale de la bisección —hay un descuento que cruza y cuesta dentro del tope—,
 * pero el veredicto que la celda ESCRIBE sale de recomputar en el descuento publicado, que
 * es el de la bisección redondeado. Cuando el redondeo cae hacia abajo, el recompute ya no
 * cruza: la celda quedaba pintada de «llega a Comprar» y con la palabra «Ajustar» adentro.
 * Con el verde eso no se notaba; con el azul del veredicto la contradicción es literal.
 *
 * Acá manda la palabra, que es un recompute de verdad. El redondeo del motor es un arreglo
 * aparte —anotado el 13-sep-2026— y hasta que se haga el color no promete de más.
 */
function cruzaDeVerdad(c: CeldaMix, destino: Veredicto) {
  return c.descuentoPct !== null && c.alcanzable && c.veredicto === destino;
}

export interface PopupAjustesProps {
  modalidad: "ltr" | "str";
  veredicto: Veredicto;
  /** El hallazgo de distancia con la grilla y las palancas. Ausente en COMPRAR. */
  distancia?: HallazgoDistanciaVeredicto | null;
  /** Las filas de la card en COMPRAR: Margen, Precio, Verifica. */
  filasComprar?: FilaLoQueHariaYo[] | null;
  currency: Currency;
  valorUF: number;
  /** Precio del caso, en UF: el CTA lo necesita para nombrar el precio negociado. */
  precioUF: number;
  /** EL LADO «ANTES» de los pares: lo que el caso es hoy. Lo pasa el hero desde los
   *  resultados ya recomputados — el pop-up no vuelve a medir nada. */
  antes?: (MetricasCelda & { score?: number | null }) | null;
}

/** ¿Hay algo que mostrar? Lo usan los heros para decidir si dibujan el botón. */
export function hayAjustesQueMostrar(p: {
  veredicto: Veredicto;
  distancia?: HallazgoDistanciaVeredicto | null;
  filasComprar?: FilaLoQueHariaYo[] | null;
}): boolean {
  if (p.veredicto === "COMPRAR") return (p.filasComprar?.length ?? 0) > 0;
  const v = p.distancia?.valor;
  if (!v) return false;
  return (mixAComprar(v)?.celdas?.length ?? 0) > 0 || (v.palancas?.length ?? 0) > 0;
}

export function PopupAjustes({
  modalidad,
  veredicto,
  distancia,
  filasComprar,
  currency,
  valorUF,
  precioUF,
  antes,
}: PopupAjustesProps) {
  const v = distancia?.valor;
  const mix = v ? mixAComprar(v) : null;
  const celdas = mix?.celdas ?? [];
  const solas = v?.palancas ?? [];
  const [sel, setSel] = useState<CeldaMix | null>(null);

  const esComprar = veredicto === "COMPRAR";
  // El destino de la matriz es COMPRAR siempre que haya matriz: el escalón no se dibuja.
  const destino: Veredicto = "COMPRAR";

  return (
    <div className="paj">
      {/* LOS CHIPS DE VEREDICTO, con signo, igual que la card. En COMPRAR es uno solo:
          no hay a dónde subir y una flecha a ninguna parte sería una promesa vacía. */}
      <div className="paj-chips">
        <Pill veredicto={veredicto} />
        {!esComprar && (
          <>
            <span className="paj-fl">→</span>
            <Pill veredicto={destino} destacado />
          </>
        )}
      </div>

      {esComprar ? (
        <SeccionComprar filas={filasComprar ?? []} />
      ) : (
        celdas.length > 0 && (
          <SeccionMatriz
            celdas={celdas}
            destino={destino}
            sel={sel}
            onSel={setSel}
            currency={currency}
            valorUF={valorUF}
          />
        )
      )}

      {!esComprar && mix && celdas.length > 0 && (
        <SeccionOptimo mix={mix} currency={currency} valorUF={valorUF} precioUF={precioUF} antes={antes ?? null} />
      )}

      {solas.length > 0 && <SeccionSolas solas={solas} modalidad={modalidad} currency={currency} valorUF={valorUF} />}

      {!esComprar && mix && celdas.length > 0 && <Cta mix={mix} precioUF={precioUF} />}
    </div>
  );
}

function Pill({ veredicto, destacado }: { veredicto: Veredicto; destacado?: boolean }) {
  const signo = veredicto === "COMPRAR" ? "✓" : veredicto === "AJUSTA SUPUESTOS" ? "−" : "✕";
  return (
    <span className={`paj-pill${destacado ? " dest" : ""}`}>
      <span className="paj-signo">{signo}</span>
      {etiquetaVeredicto(veredicto, "banda")}
    </span>
  );
}

// ── 2 · la matriz ───────────────────────────────────────────────────────────
function SeccionMatriz({
  celdas,
  destino,
  sel,
  onSel,
  currency,
  valorUF,
}: {
  celdas: CeldaMix[];
  destino: Veredicto;
  sel: CeldaMix | null;
  onSel: (c: CeldaMix | null) => void;
  currency: Currency;
  valorUF: number;
}) {
  const pies = Array.from(new Set(celdas.map((c) => c.piePct))).sort((a, b) => a - b);
  const plazos = Array.from(new Set(celdas.map((c) => c.plazoAnios))).sort((a, b) => a - b);
  const at = (pie: number, plazo: number) => celdas.find((c) => c.piePct === pie && c.plazoAnios === plazo) ?? null;
  // «HOY» NO SE INVENTA: 16 filas LTR y 2 STR no tienen celda actual porque su plazo
  // declarado no está en la grilla. Ahí no se marca nada y la leyenda tampoco la nombra.
  const hayActual = celdas.some((c) => c.esActual);
  // LA GRILLA REAL NO ES 3×3 (medido el 13-sep-2026). Los pies van del declarado hasta 30
  // de cinco en cinco y los plazos son los del wizard que no acortan el crédito, así que la
  // forma depende del caso: de 1×1 a 7×3, con 3×2 como la más común (47% LTR, 38% STR) y
  // una de cada tres grillas con UNA SOLA COLUMNA.
  //
  // Con una sola columna esto no es una matriz: es una lista de pies para un plazo fijo, y
  // dibujarle un eje horizontal que rotula una sola cosa es ruido. Ahí el plazo se dice en
  // el encabezado y el eje desaparece.
  const unaColumna = plazos.length === 1;
  // Y con UNA SOLA FILA tampoco: son 63 filas LTR y 2 STR donde el pie ya está en el techo
  // o no califica, así que la grilla es una línea de plazos para un pie fijo. Rotular un eje
  // vertical sobre una sola fila es la misma clase de ruido: el pie se dice en su cabecera.
  const unaFila = pies.length === 1;
  // UNA SOLA CELDA no es ni matriz ni línea: es UNA combinación. Son 23 filas LTR, donde el
  // pie ya está en el techo y el plazo también. Dibujarle ejes, cabeceras y leyenda a un
  // cuadrito solo sería andamiaje alrededor de una sola afirmación, así que se dice en
  // palabras y el detalle queda a un clic, igual que en la matriz.
  const unaSola = celdas.length === 1;

  if (unaSola) {
    const c = celdas[0];
    const cruza = cruzaDeVerdad(c, destino);
    return (
      <section className="paj-sec">
        <div className="paj-st">Ajustes que dependen de ti</div>
        <div className="paj-unica" onClick={() => onSel(sel ? null : c)} role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSel(sel ? null : c); }}>
          <span className="k">
            Con pie {dec1(c.piePct).replace(",0", "")}% a {c.plazoAnios} años
          </span>
          <span className={`v${cruza ? " cruza" : ""}`}>
            {etiquetaVeredicto(c.veredicto, "frase")} · score {c.score ?? PAR_SIN_VALOR}
          </span>
        </div>
        <p className="paj-sx paj-pie">Es la única combinación que Franco puede probar: tu pie y tu plazo ya están en el techo.</p>
        {sel && <PanelCelda sel={sel} destino={destino} currency={currency} valorUF={valorUF} onCerrar={() => onSel(null)} />}
      </section>
    );
  }

  return (
    <section className="paj-sec">
      <div className="paj-st">Ajustes que dependen de ti</div>
      <p className="paj-sx">El descuento que pides se ajusta en consecuencia.</p>
      {!unaColumna && <div className="paj-ejex">Plazo del crédito</div>}
      <div className={`paj-mwrap${unaColumna ? " sola" : ""}${unaFila ? " linea" : ""}`}>
        {!unaFila && <div className="paj-ejey">Pie que pones</div>}
        <div className="paj-mtxbox">
        <table className="paj-mtx">
          <tbody>
            <tr>
              <th className="rot" />
              {plazos.map((p) => (
                <th key={p}>
                  {p} años
                  {unaColumna && <small>el único plazo que no acorta tu crédito</small>}
                </th>
              ))}
            </tr>
            {pies.map((pie) => (
              <tr key={pie}>
                <th className="rot">
                  {unaFila ? "Pie " : ""}{dec1(pie).replace(",0", "")}%
                  {unaFila && <small>tu pie, el único que Franco prueba acá</small>}
                </th>
                {plazos.map((plazo) => {
                  const c = at(pie, plazo);
                  if (!c) return <td key={plazo} className="vacia" />;
                  const cruza = cruzaDeVerdad(c, destino);
                  const clases = [
                    c.esElegida ? "mix" : cruza ? "cruza" : "",
                    c.esActual ? "hoy" : "",
                    sel && sel.piePct === c.piePct && sel.plazoAnios === c.plazoAnios ? "sel" : "",
                  ].filter(Boolean).join(" ");
                  return (
                    <td
                      key={plazo}
                      className={clases}
                      onClick={() => onSel(c)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") onSel(c);
                      }}
                    >
                      {etiquetaVeredicto(c.veredicto, "frase")}
                      <small>score {c.score ?? PAR_SIN_VALOR}</small>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      <div className="paj-leyenda">
        {hayActual && (
          <span>
            <i className="paj-sw c" />
            hoy
          </span>
        )}
        <span>
          <i className="paj-sw b" />
          llega a {etiquetaVeredicto(destino, "frase")}
        </span>
        <span>
          <i className="paj-sw a" />
          el óptimo
        </span>
      </div>

      {sel && <PanelCelda sel={sel} destino={destino} currency={currency} valorUF={valorUF} onCerrar={() => onSel(null)} />}
    </section>
  );
}

/** El detalle de una celda: los DOS datos que la matriz no muestra y su ✕. */
function PanelCelda({
  sel,
  destino,
  currency,
  valorUF,
  onCerrar,
}: {
  sel: CeldaMix;
  destino: Veredicto;
  currency: Currency;
  valorUF: number;
  onCerrar: () => void;
}) {
  return (
    <div className="paj-cel">
      <span className="x" onClick={onCerrar} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onCerrar(); }}>
        ✕
      </span>
      <div className="ct">
        Pie {dec1(sel.piePct).replace(",0", "")}% · {sel.plazoAnios} años
      </div>
      <div className="paj-cg">
        <span className="l">Pides de descuento</span>
        <span className="v">
          {sel.descuentoPct === null || !sel.alcanzable
            ? `no llega a ${etiquetaVeredicto(destino, "frase")}`
            : sel.descuentoPct === 0
              ? "nada"
              : `−${pct1(sel.descuentoPct)}`}
        </span>
        <span className="l">Pie extra el día uno</span>
        <span className={`v${sel.costoDiaUnoUF > 0 ? " mal" : ""}`}>
          {sel.costoDiaUnoUF === 0 ? "—" : plataFirmada(sel.costoDiaUnoUF * valorUF, currency, valorUF)}
        </span>
      </div>
    </div>
  );
}

// ── 3 · el ajuste óptimo ────────────────────────────────────────────────────
function SeccionOptimo({
  mix,
  currency,
  valorUF,
  precioUF,
  antes,
}: {
  mix: NonNullable<HallazgoDistanciaVeredicto["valor"]["mixPalancas"]>;
  currency: Currency;
  valorUF: number;
  precioUF: number;
  antes: (MetricasCelda & { score?: number | null }) | null;
}) {
  const d = mix.despues ?? null;
  const elegida = (mix.celdas ?? []).find((c) => c.esElegida) ?? null;
  const actual = (mix.celdas ?? []).find((c) => c.esActual) ?? null;
  const precioObjetivo = precioUF * (1 - mix.descuentoPct / 100);
  const pieAntesUF = actual ? (precioUF * actual.piePct) / 100 : null;
  const pieDespuesUF = pieAntesUF != null && elegida ? pieAntesUF + elegida.costoDiaUnoUF : null;

  return (
    <section className="paj-sec">
      <div className="paj-st">El ajuste óptimo</div>
      <div className="paj-eleg">
        <div className="paj-chipsm">
          {mix.piePctDelta !== 0 && (
            <span className="paj-chip">
              Pie <s>{dec1(mix.piePct - mix.piePctDelta).replace(",0", "")}%</s>{" "}
              {dec1(mix.piePct).replace(",0", "")}%
            </span>
          )}
          {mix.piePctDelta !== 0 && mix.plazoAniosDelta !== 0 && <span className="paj-plus">+</span>}
          {mix.plazoAniosDelta !== 0 && (
            <span className="paj-chip">
              Plazo <s>{mix.plazoAnios - mix.plazoAniosDelta}</s> {mix.plazoAnios} años
            </span>
          )}
        </div>
        <div className="paj-neg">
          {mix.sinDescuento ? (
            "→ Sin pedir descuento"
          ) : (
            <>
              → Negocias −{pct1(mix.descuentoPct)} dcto. en precio
              <small>
                UF {miles(precioUF)} → UF {miles(precioObjetivo)}
              </small>
            </>
          )}
        </div>
        <Par
          label="Pie el día uno"
          antes={pieAntesUF != null ? plata(pieAntesUF * valorUF, currency, valorUF) : PAR_SIN_VALOR}
          despues={pieDespuesUF != null ? plata(pieDespuesUF * valorUF, currency, valorUF) : PAR_SIN_VALOR}
          tono={elegida && elegida.costoDiaUnoUF > 0 ? "mal" : undefined}
        />
        <Par label="Cuota mensual" antes={antes?.cuotaMensual != null ? plata(antes.cuotaMensual, currency, valorUF) : PAR_SIN_VALOR} despues={d?.cuotaMensual != null ? plata(d.cuotaMensual, currency, valorUF) : PAR_SIN_VALOR} />
        <Par
          label="Flujo mensual"
          antes={antes?.flujoMensual != null ? plataFirmada(antes.flujoMensual, currency, valorUF) : PAR_SIN_VALOR}
          despues={d?.flujoMensual != null ? plataFirmada(d.flujoMensual, currency, valorUF) : PAR_SIN_VALOR}
          tono={d?.flujoMensual != null ? (d.flujoMensual >= 0 ? "bien" : "mal") : undefined}
        />
        {/* EL PAR DEL RETORNO VA SIEMPRE. Con pie 0 no existe y va con guion: omitirlo
            dejaría seis pares donde el contrato dice siete (21 filas LTR, 8 STR). */}
        <Par
          label="Por cada $100 que pones, al año"
          antes={antes?.cocPct != null ? `${antes.cocPct >= 0 ? "+" : "−"}$${dec1(Math.abs(antes.cocPct)).replace("−", "")}` : PAR_SIN_VALOR}
          despues={d?.cocPct != null ? `${d.cocPct >= 0 ? "+" : "−"}$${dec1(Math.abs(d.cocPct)).replace("−", "")}` : PAR_SIN_VALOR}
          tono={d?.cocPct != null ? (d.cocPct >= 0 ? "bien" : "mal") : undefined}
        />
        <Par label="Cap rate neto" antes={antes?.capRateNetoPct != null ? pct1(antes.capRateNetoPct) : PAR_SIN_VALOR} despues={d?.capRateNetoPct != null ? pct1(d.capRateNetoPct) : PAR_SIN_VALOR} />
        <Par label="TIR a 10 años" antes={antes?.tirPct != null ? pct1(antes.tirPct) : PAR_SIN_VALOR} despues={d?.tirPct != null ? pct1(d.tirPct) : PAR_SIN_VALOR} />
        <Par
          label="Franco Score"
          antes={antes?.score != null ? String(antes.score) : actual?.scoreSinDescuento != null ? String(actual.scoreSinDescuento) : PAR_SIN_VALOR}
          despues={mix.score != null ? String(mix.score) : PAR_SIN_VALOR}
          tono="destino"
        />
      </div>
    </section>
  );
}

/**
 * Un par antes → después. El `tono` NO es decoración:
 *   · `bien` / `mal` es el semáforo del DATO, y solo va donde el dato tiene signo (flujo
 *     mensual, retorno por cada $100). Verde y rojo ahí son la lectura convencional.
 *   · `destino` es el Franco Score de después, que no es un dato con signo sino el número
 *     que declara el veredicto al que llegas: va con el azul de Comprar.
 */
function Par({ label, antes, despues, tono }: { label: string; antes: string; despues: string; tono?: "bien" | "mal" | "destino" }) {
  return (
    <div className="paj-par">
      <div className="l">{label}</div>
      <div className="p">
        <span className="a1">{antes}</span>
        <span className="fl">→</span>
        <span className={`b1${tono ? ` ${tono}` : ""}`}>{despues}</span>
      </div>
    </div>
  );
}

// ── 4 · no depende de ti ────────────────────────────────────────────────────
function SeccionSolas({
  solas,
  modalidad,
  currency,
  valorUF,
}: {
  solas: PalancaDistancia[];
  modalidad: "ltr" | "str";
  currency: Currency;
  valorUF: number;
}) {
  const cifra = (p: PalancaDistancia) => {
    if (p.palanca === "plazo") return `${p.objetivo} años`;
    if (p.palanca === "pie") return `${dec1(p.objetivo).replace(",0", "")}%`;
    if (p.palanca === "gestion") return p.modoGestionObjetivo === "auto" ? "Tú mismo" : "Administrador";
    return `${p.deltaPct >= 0 ? "+" : "−"}${pct1(Math.abs(p.deltaPct))}`;
  };
  const detalle = (p: PalancaDistancia) => {
    if (p.palanca === "precio") return `UF ${miles(p.objetivo)}`;
    if (p.palanca === "arriendo") return plata(p.objetivo, currency, valorUF);
    if (p.palanca === "adr") return `${plata(p.objetivo, currency, valorUF)} la noche`;
    if (p.palanca === "gestion") return `comisión ${pct1(p.objetivo)}`;
    return null;
  };
  return (
    <section className="paj-sec paj-nod">
      <div className="paj-st">No depende de ti</div>
      <table>
        <tbody>
          <tr>
            <th>Si cambia</th>
            <th>Cuánto</th>
            <th>Llegas a</th>
          </tr>
          {solas.map((p, i) => (
            <tr key={`${p.palanca}-${i}`}>
              <td>
                {NOMBRE[p.palanca]}
                <em>{QUIEN[p.palanca]}</em>
              </td>
              <td className="num">
                {cifra(p)}
                {detalle(p) && <small>{detalle(p)}</small>}
              </td>
              <td className={`dst${p.destino === "COMPRAR" ? " comprar" : ""}`}>
                {p.destino ? etiquetaVeredicto(p.destino, "frase") : PAR_SIN_VALOR}
                <small>score {p.score ?? PAR_SIN_VALOR}</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {modalidad === "str" && <p className="paj-sx paj-pie">La tarifa la pone el mercado, no tú.</p>}
    </section>
  );
}

// ── COMPRAR · cuánto aguanta el veredicto ───────────────────────────────────
//
// NO HAY MATRIZ NI ÓPTIMO: no hay a dónde subir, y sensibilizar hacia arriba sería
// inventar un veredicto que no existe.
//
// Y TAMPOCO HAY BARRAS (13-sep-2026). Hubo dos rieles dibujando las fronteras —el arriendo
// que puede caer y el precio que puede subir— y se retiraron: las tres filas ya dicen lo
// mismo con oraciones completas, y una barra que repite una oración no agrega profundidad,
// agrega una segunda lectura que hay que reconciliar con la primera. Peor todavía, las dos
// se leían en direcciones opuestas —una cae, la otra sube— así que el mismo riel
// significaba cosas distintas según cuál mirabas. La frontera es un número con su oración;
// eso ya está.
//
// Queda el pop-up más corto que el resto, y está bien: en COMPRAR hay menos que decir.
function SeccionComprar({ filas }: { filas: FilaLoQueHariaYo[] }) {
  const verifica = filas.some((f) => f.rotuloCorto === "Verifica");
  return (
    <section className="paj-sec paj-nod">
      <div className="paj-st">{verifica ? "Cuánto aguanta, y qué verificar" : "Cuánto aguanta este veredicto"}</div>
      <table>
        <tbody>
          {filas.map((f, i) => (
            <tr key={`${f.titulo}-${i}`}>
              <td>{f.rotuloCorto ?? f.titulo}</td>
              <td className="paj-oracion">{f.oracion ?? f.cifra}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ── el CTA, INERTE hasta el bloque C ────────────────────────────────────────
function Cta({
  mix,
  precioUF,
}: {
  mix: NonNullable<HallazgoDistanciaVeredicto["valor"]["mixPalancas"]>;
  precioUF: number;
}) {
  const objetivo = precioUF * (1 - mix.descuentoPct / 100);
  // INERTE A PROPÓSITO (13-sep-2026): el botón se dibuja con el precio negociado y NO
  // navega. Conectarlo pide que el wizard acepte un precio por query y, sobre todo, que
  // esté tomada la decisión de si un re-análisis consume crédito. Hasta entonces, un CTA
  // que navega cobraría un análisis que nadie decidió cobrar.
  if (mix.sinDescuento) return null;
  return (
    <div className="paj-cta">
      <p>Si consigues ese precio, el informe cambia entero.</p>
      <span className="paj-btn" aria-disabled="true">
        <span className="ico" />
        Analízalo a UF {miles(objetivo)}
      </span>
    </div>
  );
}
