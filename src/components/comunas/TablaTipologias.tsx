// ─────────────────────────────────────────────────────────────────────────
// Tabla por tipología + bloque de supuestos + procedencia de la muestra.
// Contrato: assets-export/mockup-comunas-enriquecido.html (rev. 4).
//
// UNIDADES — el cuidado central de esta página. Acá los precios son **UF del
// departamento completo**; la sección de plusvalía, unos centímetros más abajo,
// habla en **UF por m²** cuando su fuente es GfK. Son magnitudes de órdenes
// distintos (UF 5.000 vs UF 106) y no puede quedar en deducción del lector: los
// encabezados dicen su unidad, las tarjetas de móvil también, y el bloque de
// supuestos la repite en prosa.
//
// FUENTE DEL ARRIENDO — el segundo cuidado. Una fila puede traer la mediana de
// sus propios arriendos o un ESTIMADO desde el m² comunal cuando la tipología
// no junta muestra (referencia-arriendo.ts). La fila estimada se marca, publica
// su arriendo como RANGO y dice cuántos arriendos de la comuna hay detrás. Nunca
// se presenta con el mismo rótulo que una mediana.
//
// ANCHO — la primera versión se pasaba ~257px del contenedor (1.052px útiles) y
// truncaba justo la columna del precio de equilibrio, que es el dato más
// diferenciador. El culpable no eran los datos sino DOS ENCABEZADOS con
// `whitespace-nowrap`: "Precio de equilibrio · UF depto" pedía 229px de header
// para 112px de dato. Ahora el encabezado se parte en dos líneas (rótulo +
// unidad) y la marca de muestra chica bajó a su propia línea. Bajo 1024px la
// tabla deja de ser tabla: se reorganiza en tarjetas, que es donde llega el
// tráfico de búsqueda. El corte es `lg` (1024px) y no `md`: a 768px la tabla
// mide 821px naturales contra 703px de contenedor y seguía pidiendo scroll
// lateral. Desde 1024 el contenedor da 976px y entra con holgura.
//
// Signal Red solo en la brecha negativa (uso #2 de Capa 1). Las marcas de
// muestra chica y de estimado van en Ink + tipografía — no es uso permitido
// del rojo.
//
// Diseño plano (20-oct-2026, comunas.css): tabla y tarjetas con borde y sin sombra, encabezados en Inter sin
// versalitas, cifras en Inter con números tabulares. El texto no cambió.
// ─────────────────────────────────────────────────────────────────────────

import type { ComunaStats, TipologiaStats } from "@/lib/data/comunas-seo";
import { MIN_PER_TYPE, fmtCLP } from "@/lib/data/comunas-seo";
import { MIN_ARRIENDOS_COMUNAL_ENTRA, MIN_ARRIENDOS_TIPOLOGIA } from "@/lib/referencia-arriendo";
import { COPY_DEPENDE, ETIQUETA_VEREDICTO, brechaRango } from "@/lib/veredicto-fila";

const NOMBRE_TIPOLOGIA: Record<number, string> = {
  1: "1 dormitorio",
  2: "2 dormitorios",
  3: "3 dormitorios",
  4: "4 dormitorios",
};

function pct1(n: number): string {
  // Signo menos tipográfico, no guion ASCII: la columna de al lado usa "−$" y
  // las dos cifras se leen juntas.
  return `${n.toFixed(1).replace(".", ",").replace("-", "−")}%`;
}

function uf(n: number): string {
  return `UF ${n.toLocaleString("es-CL")}`;
}

function esEstimada(t: TipologiaStats): boolean {
  return t.referencia.fuente === "comunalPorM2";
}

/** "$839.000–$1.061.000" para una fila estimada. */
function rangoArriendo(t: TipologiaStats): string {
  if (t.referencia.fuente !== "comunalPorM2") return fmtCLP(t.arriendoCLP);
  return `${fmtCLP(t.referencia.rangoCLP.min)}–${fmtCLP(t.referencia.rangoCLP.max)}`;
}

/** Línea de muestra: los avisos propios, o los de la comuna si la fila es estimada. */
function lineaMuestra(t: TipologiaStats): string {
  if (t.referencia.fuente === "comunalPorM2") {
    return `${t.referencia.nComunal.toLocaleString("es-CL")} arriendos de la comuna · ${t.nVentas.toLocaleString("es-CL")} ventas`;
  }
  return `${t.nArriendos.toLocaleString("es-CL")} arriendos · ${t.nVentas.toLocaleString("es-CL")} ventas`;
}

/** Encabezado en dos líneas: rótulo arriba, unidad abajo. Sin `nowrap`. */
function Th({ children, unidad, alineado = "right", destacado = false }: {
  children: React.ReactNode;
  unidad?: string;
  alineado?: "left" | "right";
  destacado?: boolean;
}) {
  return (
    <th className={destacado ? "cm-destacada" : undefined} style={alineado === "left" ? { textAlign: "left" } : undefined}>
      {children}
      {unidad && <span>{unidad}</span>}
    </th>
  );
}

/**
 * La marca de respaldo de la fila, en Ink. Se reusa en tabla y tarjetas. Una
 * fila estimada nunca lleva "muestra chica": no es una mediana con pocos datos,
 * es otra cosa, y se llama por su nombre.
 */
function MarcaRespaldo({ t }: { t: TipologiaStats }) {
  const texto = esEstimada(t) ? "Estimado · m² comunal" : t.muestraChica ? "Muestra chica" : null;
  if (!texto) return null;
  return (
    <span className="cm-chip cm-chip-solo cm-marca">{texto}</span>
  );
}

function textoEquilibrio(t: TipologiaStats): string {
  if (t.veredictoFila === "dependeDelArriendoReal") return "al punto medio · piso no cubre, techo sí";
  if (t.veredictoFila === "sePagaSola") return `+${pct1(t.deltaPct)} de margen`;
  return `${pct1(t.deltaPct)}${t.pieNecesarioPct !== null ? ` · o pie ${t.pieNecesarioPct}%` : ""}`;
}

/** Solo el veredicto negativo lleva Signal Red; "depende" va en Ink como el positivo. */
function claseVeredicto(t: TipologiaStats): string {
  return t.veredictoFila === "noSePagaSola" ? " cm-negativo" : "";
}

/**
 * La diferencia arriendo − cuota. Una fila sin veredicto la muestra en sus dos
 * extremos ("−$a a +$b"): el punto medio solo sería un número con cara de dato.
 */
function textoDiferencia(t: TipologiaStats): string {
  if (t.veredictoFila === "dependeDelArriendoReal") {
    const r = brechaRango(t);
    if (r) return `${r.min < 0 ? "−" : "+"}${fmtCLP(Math.abs(r.min))} a ${r.max < 0 ? "−" : "+"}${fmtCLP(Math.abs(r.max))}`;
  }
  return `${t.cubre ? "+" : "−"}${fmtCLP(Math.abs(t.brechaCLP))}`;
}

/** Vista de tarjetas bajo 1024px: la tabla se reorganiza, no se encoge. */
function TarjetasTipologias({ tips }: { tips: TipologiaStats[] }) {
  return (
    <div className="cm-tipos cm-solo-tel">
      {tips.map((t) => (
        <div key={t.dorms} className="cm-tipo">
          <div className="cm-tipo-cabeza">
            <span className="cm-tipo-nombre">{NOMBRE_TIPOLOGIA[t.dorms]}</span>
            <span className={`cm-tipo-veredicto${claseVeredicto(t)}`}>{ETIQUETA_VEREDICTO[t.veredictoFila]}</span>
          </div>
          <p className="cm-comuna-pie">{lineaMuestra(t)}</p>
          <MarcaRespaldo t={t} />

          <dl className="cm-tipo-datos">
            {[
              esEstimada(t)
                ? { l: "Arriendo estimado", v: rangoArriendo(t), u: "rango · m² comunal" }
                : { l: "Arriendo mediana", v: fmtCLP(t.arriendoCLP) },
              { l: "Precio mediana", v: uf(t.ventaUF), u: "UF del depto" },
              { l: "Rentab. bruta", v: pct1(t.rentabilidadBruta) },
              { l: "Dividendo est.", v: fmtCLP(t.dividendoCLP) },
            ].map((d) => (
              <div key={d.l}>
                <dt>{d.l}</dt>
                <dd>
                  {d.v}
                  {d.u && <span className="cm-unidad">{d.u}</span>}
                </dd>
              </div>
            ))}
          </dl>

          {/* Diferencia y equilibrio: el par que decide, con más peso visual. */}
          <div className="cm-tipo-par">
            <div className="cm-dato">
              Diferencia
              <b className={`cm-cifra${claseVeredicto(t)}`}>{textoDiferencia(t)}</b>
            </div>
            <div className="cm-dato cm-tipo-equilibrio">
              Precio de equilibrio
              <b className="cm-cifra">{uf(t.precioCuotaUF)}</b>
              <span className="cm-unidad">UF del depto</span>
              <span className="cm-unidad">{textoEquilibrio(t)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TablaTipologias({ stats }: { stats: ComunaStats }) {
  const tips = stats.tipologias;
  if (!tips.length) return null;
  const s = stats.supuestos;
  const algunaCubre = tips.some((t) => t.veredictoFila === "sePagaSola");
  const estimadas = tips.filter(esEstimada);
  const dependen = tips.filter((t) => t.veredictoFila === "dependeDelArriendoReal");

  return (
    <section className="cm-seccion" data-comuna="tipologias">
      <p className="cm-rotulo">Los números de {stats.nombre}</p>
      <h2 className="cm-h2">
        {algunaCubre
          ? "Qué cuesta, qué renta y hasta qué precio aguanta"
          : "Qué cuesta, qué renta y a qué precio se equilibra"}
      </h2>

      {/* Móvil: tarjetas. Desktop: tabla. */}
      <TarjetasTipologias tips={tips} />

      <div className="cm-tabla-caja cm-solo-ancho">
        <table className="cm-tabla">
          <thead>
            <tr>
              <Th alineado="left">Tipología</Th>
              <Th unidad={estimadas.length ? "mediana, o rango estimado" : undefined}>Arriendo</Th>
              <Th unidad="UF del depto">Precio mediana</Th>
              <Th>Rentab. bruta</Th>
              <Th>Dividendo est.</Th>
              <Th>Diferencia</Th>
              <Th unidad="UF del depto" destacado>
                Precio de equilibrio
              </Th>
            </tr>
          </thead>
          <tbody>
            {tips.map((t) => (
              <tr key={t.dorms}>
                <td>
                  <b>{NOMBRE_TIPOLOGIA[t.dorms]}</b>
                  <span className="cm-sub">{lineaMuestra(t)}</span>
                  <MarcaRespaldo t={t} />
                </td>
                <td>
                  {rangoArriendo(t)}
                  {esEstimada(t) && <span className="cm-sub">estimado</span>}
                </td>
                <td>{uf(t.ventaUF)}</td>
                <td>{pct1(t.rentabilidadBruta)}</td>
                <td>{fmtCLP(t.dividendoCLP)}</td>
                <td>
                  <b className={claseVeredicto(t).trim() || undefined}>{textoDiferencia(t)}</b>
                  <span className={`cm-sub${claseVeredicto(t)}`}>{ETIQUETA_VEREDICTO[t.veredictoFila]}</span>
                </td>
                <td className="cm-destacada">
                  {uf(t.precioCuotaUF)}
                  <span className="cm-sub">{textoEquilibrio(t)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Supuestos: visibles junto al resultado, nunca en letra chica. */}
      <div className="cm-tarjeta cm-hundida" data-comuna="supuestos">
        <p className="cm-rotulo">Con qué supuestos está calculado</p>
        <div className="cm-datos" style={{ marginTop: 12 }}>
          {[
            { l: "Pie", v: `${s.piePct}%` },
            { l: "Plazo", v: `${s.plazoAnos} años` },
            { l: "Tasa", v: `${s.tasaAnual.toFixed(1).replace(".", ",")}% anual` },
            { l: "UF", v: fmtCLP(s.ufCLP) },
          ].map((d) => (
            <div key={d.l} className="cm-dato">
              {d.l}
              <b className="cm-cifra">{d.v}</b>
            </div>
          ))}
        </div>
        <p className="cm-chico">
          {s.tasaEsViva
            ? "La tasa es la promedio de créditos de vivienda que publica el Banco Central, actualizada cada día."
            : "La tasa es la referencia de mercado que usa Franco cuando el dato del Banco Central no está disponible."}{" "}
          El dividendo es <b>solo la cuota del crédito</b>: no incluye gastos comunes, contribuciones ni
          seguros. Por eso el precio de equilibrio de esta tabla es el precio al que el arriendo cubre{" "}
          <b>la cuota</b> — los gastos reales del edificio lo empujan más abajo, y cuánto depende de cada
          propiedad. Todos los precios de esta tabla son <b>UF del departamento completo</b>, no UF por m².
          {estimadas.length > 0 && (
            <>
              {" "}
              En {estimadas.length === 1 ? "la fila estimada" : "las filas estimadas"}, el precio de equilibrio usa el
              punto medio del rango de arriendo, pero el veredicto se decide con el rango completo: se paga solo
              solo si el piso cubre la cuota, y no se paga solo solo si ni el techo la cubre.
              {dependen.length > 0 && (
                <>
                  {" "}
                  {dependen.length === 1 ? "Una fila queda" : `${dependen.length} filas quedan`} sin veredicto:{" "}
                  {COPY_DEPENDE}
                </>
              )}
            </>
          )}
        </p>
      </div>

      <p className="cm-nota">
        Cada fila necesita al menos {MIN_PER_TYPE} ventas publicadas: sin eso no hay precio mediano y la
        fila no existe. El arriendo sale de los avisos propios de la tipología cuando hay{" "}
        {MIN_ARRIENDOS_TIPOLOGIA} o más. Si no los hay pero la comuna junta {MIN_ARRIENDOS_COMUNAL_ENTRA}{" "}
        arriendos entre todas sus tipologías, Franco lo estima desde el metro cuadrado comunal ajustado por
        tipología, lo marca como estimado y lo publica como rango, no como cifra exacta. Cuando ni eso
        alcanza, la fila no aparece: no se interpola ni se promedia con el vecino.
      </p>
    </section>
  );
}

export function ProcedenciaMuestraBloque({ stats }: { stats: ComunaStats }) {
  const p = stats.procedencia;
  const fecha = p.ultimaActualizacion
    ? new Date(`${p.ultimaActualizacion}T12:00:00`).toLocaleDateString("es-CL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";
  const excluidos = p.activosTotales - p.enCalculo;
  const estimadas = stats.tipologias.filter(esEstimada);
  const propias = stats.tipologias.length - estimadas.length;
  const nComunal = estimadas[0]?.referencia.fuente === "comunalPorM2" ? estimadas[0].referencia.nComunal : 0;

  return (
    <section className="cm-seccion" data-comuna="procedencia">
      <p className="cm-rotulo">De dónde salen estos números</p>
      <div className="cm-tarjeta cm-datos" style={{ gap: "16px 32px" }}>
        <div className="cm-dato">
          Avisos que entran en el cálculo
          <b className="cm-cifra">
            {p.enCalculo.toLocaleString("es-CL")}
          </b>
        </div>
        <div className="cm-dato">
          Última actualización
          <b className="cm-cifra">{fecha}</b>
        </div>
        <div className="cm-dato">
          Tipologías publicadas
          <b className="cm-cifra">
            {stats.tipologias.length} de 4
          </b>
          {estimadas.length > 0 && (
            <span className="cm-unidad">
              {propias} con arriendos propios · {estimadas.length} con arriendo estimado
            </span>
          )}
        </div>
      </div>
      {(excluidos > 0 || estimadas.length > 0) && (
        <p className="cm-nota">
          <b>Qué cuenta ese número.</b> {stats.nombre} tiene{" "}
          {p.activosTotales.toLocaleString("es-CL")} avisos activos y{" "}
          {p.enCalculo.toLocaleString("es-CL")} entran en el cálculo.
          {excluidos > 0 && (
            <>
              {" "}
              {/* La tercera razón (20-oct-2026): la venta pasa la regla de la evaluación de la noche (plausible.ts). */}
              {p.ventasDescartadas > 0 ? (
                <>
                  Los {excluidos.toLocaleString("es-CL")} restantes quedaron fuera porque no publican superficie (
                  {p.sinSuperficie.toLocaleString("es-CL")}), están fuera del rango de 1 a 4 dormitorios (
                  {p.fueraDeRango.toLocaleString("es-CL")}) o son ventas que la evaluación de cada noche también
                  descarta: un precio fuera de lo plausible o el mismo depto publicado dos veces (
                  {p.ventasDescartadas.toLocaleString("es-CL")}). Hay avisos que fallan más de una cosa, así que las
                  cifras no suman el total.
                </>
              ) : (
                <>
                  Los {excluidos.toLocaleString("es-CL")} restantes quedaron fuera porque no publican superficie (
                  {p.sinSuperficie.toLocaleString("es-CL")}) o están fuera del rango de 1 a 4 dormitorios (
                  {p.fueraDeRango.toLocaleString("es-CL")}) — hay avisos que fallan las dos cosas, así que las dos
                  cifras no suman el total.
                </>
              )}
              {p.bajoUmbral > 0 && (
                <>
                  {" "}
                  {p.bajoUmbral === 1
                    ? "Otro aviso cayó en una tipología que no llega a publicarse."
                    : `Otros ${p.bajoUmbral.toLocaleString("es-CL")} cayeron en tipologías que no llegan a publicarse.`}
                </>
              )}
            </>
          )}
          {estimadas.length > 0 && (
            <>
              {" "}
              {estimadas.length === 1 ? "La fila estimada no suma" : "Las filas estimadas no suman"} arriendos
              propios a ese número: su arriendo sale del metro cuadrado de los {nComunal.toLocaleString("es-CL")} arriendos publicados en
              la comuna.
            </>
          )}{" "}
          El label dice &ldquo;que entran en el cálculo&rdquo; justamente para no leerse como el tamaño del
          mercado de la comuna.
        </p>
      )}
    </section>
  );
}
