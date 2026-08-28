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
// Signal Red solo en la brecha negativa (uso #2 de Capa 1). La marca de muestra
// chica va en Ink + tipografía — no es uso permitido del rojo.
// ─────────────────────────────────────────────────────────────────────────

import type { ComunaStats, TipologiaStats } from "@/lib/data/comunas-seo";
import { fmtCLP } from "@/lib/data/comunas-seo";

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

/** Encabezado en dos líneas: rótulo arriba, unidad abajo. Sin `nowrap`. */
function Th({ children, unidad, alineado = "right", destacado = false }: {
  children: React.ReactNode;
  unidad?: string;
  alineado?: "left" | "right";
  destacado?: boolean;
}) {
  return (
    <th
      className={`px-3 py-3.5 align-bottom font-mono text-[10px] font-medium uppercase leading-tight tracking-[0.06em] text-[var(--franco-text-tertiary)] ${
        alineado === "left" ? "text-left" : "text-right"
      } ${destacado ? "bg-[var(--franco-sunken,var(--franco-bg))]" : ""}`}
    >
      {children}
      {unidad && <span className="mt-0.5 block font-normal normal-case tracking-normal">{unidad}</span>}
    </th>
  );
}

/** La marca de muestra chica, en Ink. Se reusa en tabla y tarjetas. */
function MarcaMuestraChica() {
  return (
    <span className="mt-1 inline-block rounded-full border border-[var(--franco-border)] px-1.5 py-px font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--franco-text-secondary)]">
      Muestra chica
    </span>
  );
}

function textoEquilibrio(t: TipologiaStats): string {
  if (t.cubre) return `+${pct1(t.deltaPct)} de margen`;
  return `${pct1(t.deltaPct)}${t.pieNecesarioPct !== null ? ` · o pie ${t.pieNecesarioPct}%` : ""}`;
}

/** Vista de tarjetas bajo 1024px: la tabla se reorganiza, no se encoge. */
function TarjetasTipologias({ tips }: { tips: TipologiaStats[] }) {
  return (
    <div className="mt-4 grid gap-3 lg:hidden">
      {tips.map((t) => (
        <div key={t.dorms} className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-body text-[15px] font-medium text-[var(--franco-text)]">
              {NOMBRE_TIPOLOGIA[t.dorms]}
            </span>
            <span
              className="font-mono text-[11px] font-medium uppercase tracking-[0.08em]"
              style={{ color: t.cubre ? "var(--franco-text-secondary)" : "#C8323C" }}
            >
              {t.cubre ? "Se paga solo" : "No se paga solo"}
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[10px] tracking-[0.04em] text-[var(--franco-text-muted)]">
            {t.nArriendos} arriendos · {t.nVentas} ventas
          </p>
          {t.muestraChica && <MarcaMuestraChica />}

          <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-3">
            {[
              { l: "Arriendo mediana", v: fmtCLP(t.arriendoCLP) },
              { l: "Precio mediana", v: uf(t.ventaUF), u: "UF del depto" },
              { l: "Rentab. bruta", v: pct1(t.rentabilidadBruta) },
              { l: "Dividendo est.", v: fmtCLP(t.dividendoCLP) },
            ].map((d) => (
              <div key={d.l}>
                <dt className="font-body text-[11px] text-[var(--franco-text-muted)]">{d.l}</dt>
                <dd className="mt-0.5 font-mono text-[13px] text-[var(--franco-text)]">
                  {d.v}
                  {d.u && (
                    <span className="mt-px block font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--franco-text-muted)]">
                      {d.u}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>

          {/* Diferencia y equilibrio: el par que decide, con más peso visual. */}
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[var(--franco-border)] pt-3.5">
            <div>
              <p className="font-body text-[11px] text-[var(--franco-text-muted)]">Diferencia</p>
              <p
                className="mt-0.5 font-mono text-[15px] font-bold"
                style={{ color: t.cubre ? "var(--franco-text)" : "#C8323C" }}
              >
                {t.cubre ? "+" : "−"}
                {fmtCLP(Math.abs(t.brechaCLP))}
              </p>
            </div>
            <div className="rounded-lg bg-[var(--franco-sunken,var(--franco-bg))] p-2.5">
              <p className="font-body text-[11px] text-[var(--franco-text-muted)]">Precio de equilibrio</p>
              <p className="mt-0.5 font-mono text-[15px] font-bold text-[var(--franco-text)]">
                {uf(t.precioCuotaUF)}
              </p>
              <p className="mt-px font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--franco-text-muted)]">
                UF del depto
              </p>
              <p className="mt-1 font-mono text-[10px] font-medium text-[var(--franco-text-secondary)]">
                {textoEquilibrio(t)}
              </p>
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
  const algunaCubre = tips.some((t) => t.cubre);

  return (
    <section className="mt-14">
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--franco-text-tertiary)]">
        Los números de {stats.nombre}
      </p>
      <h2 className="mt-2 font-heading text-2xl font-bold text-[var(--franco-text)]">
        {algunaCubre
          ? "Qué cuesta, qué renta y hasta qué precio aguanta"
          : "Qué cuesta, qué renta y a qué precio se equilibra"}
      </h2>

      {/* Móvil: tarjetas. Desktop: tabla. */}
      <TarjetasTipologias tips={tips} />

      <div className="mt-4 hidden overflow-x-auto rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--franco-border)]">
              <Th alineado="left">Tipología</Th>
              <Th>Arriendo mediana</Th>
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
              <tr key={t.dorms} className="border-b border-[var(--franco-border)] last:border-b-0">
                <td className="px-3 py-4 text-left">
                  <span className="font-body text-sm font-medium text-[var(--franco-text)]">
                    {NOMBRE_TIPOLOGIA[t.dorms]}
                  </span>
                  <span className="mt-0.5 block whitespace-nowrap font-mono text-[10px] tracking-[0.04em] text-[var(--franco-text-muted)]">
                    {t.nArriendos} arriendos · {t.nVentas} ventas
                  </span>
                  {t.muestraChica && <MarcaMuestraChica />}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-right font-mono text-[13px] text-[var(--franco-text)]">
                  {fmtCLP(t.arriendoCLP)}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-right font-mono text-[13px] text-[var(--franco-text)]">
                  {uf(t.ventaUF)}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-right font-mono text-[13px] text-[var(--franco-text)]">
                  {pct1(t.rentabilidadBruta)}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-right font-mono text-[13px] text-[var(--franco-text)]">
                  {fmtCLP(t.dividendoCLP)}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-right font-mono text-[13px]">
                  <span className="font-bold" style={{ color: t.cubre ? "var(--franco-text)" : "#C8323C" }}>
                    {t.cubre ? "+" : "−"}
                    {fmtCLP(Math.abs(t.brechaCLP))}
                  </span>
                  <span
                    className="mt-0.5 block font-mono text-[10px] font-medium uppercase tracking-[0.06em]"
                    style={{ color: t.cubre ? "var(--franco-text-secondary)" : "#C8323C" }}
                  >
                    {t.cubre ? "Se paga solo" : "No se paga solo"}
                  </span>
                </td>
                <td className="whitespace-nowrap bg-[var(--franco-sunken,var(--franco-bg))] px-3 py-4 text-right font-mono text-[13px] font-bold text-[var(--franco-text)]">
                  {uf(t.precioCuotaUF)}
                  <span className="mt-0.5 block font-mono text-[10px] font-medium tracking-[0.04em] text-[var(--franco-text-secondary)]">
                    {textoEquilibrio(t)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Supuestos: visibles junto al resultado, nunca en letra chica. */}
      <div className="mt-3.5 rounded-xl border border-[var(--franco-border)] bg-[var(--franco-sunken,var(--franco-bg))] p-5">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--franco-text-tertiary)]">
          Con qué supuestos está calculado
        </p>
        <div className="mt-3 flex flex-wrap gap-7">
          {[
            { l: "Pie", v: `${s.piePct}%` },
            { l: "Plazo", v: `${s.plazoAnos} años` },
            { l: "Tasa", v: `${s.tasaAnual.toFixed(1).replace(".", ",")}% anual` },
            { l: "UF", v: fmtCLP(s.ufCLP) },
          ].map((d) => (
            <div key={d.l} className="font-body text-[13px] text-[var(--franco-text-secondary)]">
              {d.l}
              <b className="mt-0.5 block font-mono text-sm font-bold text-[var(--franco-text)]">{d.v}</b>
            </div>
          ))}
        </div>
        <p className="mt-3.5 max-w-[78ch] font-body text-xs text-[var(--franco-text-muted)]">
          {s.tasaEsViva
            ? "La tasa es la promedio de créditos de vivienda que publica el Banco Central, actualizada cada día."
            : "La tasa es la referencia de mercado que usa Franco cuando el dato del Banco Central no está disponible."}{" "}
          El dividendo es <b>solo la cuota del crédito</b>: no incluye gastos comunes, contribuciones ni
          seguros. Por eso el precio de equilibrio de esta tabla es el precio al que el arriendo cubre{" "}
          <b>la cuota</b> — los gastos reales del edificio lo empujan más abajo, y cuánto depende de cada
          propiedad. Todos los precios de esta tabla son <b>UF del departamento completo</b>, no UF por m².
        </p>
      </div>

      <p className="mt-5 max-w-[82ch] border-l-[3px] border-[var(--franco-border)] py-1 pl-4 font-body text-[13px] text-[var(--franco-text-muted)]">
        Solo aparecen las tipologías con al menos 20 arriendos y 20 ventas publicadas. Si un segmento no
        llega, la fila no existe: no se interpola ni se promedia con el vecino.
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

  return (
    <section className="mt-14">
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--franco-text-tertiary)]">
        De dónde salen estos números
      </p>
      <div className="mt-4 flex flex-wrap gap-8 rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-6">
        <div className="font-body text-xs text-[var(--franco-text-muted)]">
          Avisos que entran en el cálculo
          <b className="mt-0.5 block font-mono text-[17px] font-bold text-[var(--franco-text)]">
            {p.enCalculo.toLocaleString("es-CL")}
          </b>
        </div>
        <div className="font-body text-xs text-[var(--franco-text-muted)]">
          Última actualización
          <b className="mt-0.5 block font-mono text-[17px] font-bold text-[var(--franco-text)]">{fecha}</b>
        </div>
        <div className="font-body text-xs text-[var(--franco-text-muted)]">
          Tipologías con muestra suficiente
          <b className="mt-0.5 block font-mono text-[17px] font-bold text-[var(--franco-text)]">
            {stats.tipologias.length} de 4
          </b>
        </div>
      </div>
      {excluidos > 0 && (
        <p className="mt-4 max-w-[82ch] border-l-[3px] border-[var(--franco-border)] py-1 pl-4 font-body text-[13px] text-[var(--franco-text-muted)]">
          <b className="text-[var(--franco-text-secondary)]">Qué cuenta ese número.</b> {stats.nombre} tiene{" "}
          {p.activosTotales.toLocaleString("es-CL")} avisos activos y{" "}
          {p.enCalculo.toLocaleString("es-CL")} entran en el cálculo. Los {excluidos.toLocaleString("es-CL")}{" "}
          restantes quedaron fuera porque no publican superficie ({p.sinSuperficie.toLocaleString("es-CL")}) o
          están fuera del rango de 1 a 4 dormitorios ({p.fueraDeRango.toLocaleString("es-CL")}) — hay avisos
          que fallan las dos cosas, así que las dos cifras no suman el total.
          {p.bajoUmbral > 0 && (
            <> Otros {p.bajoUmbral.toLocaleString("es-CL")} cayeron en tipologías sin muestra suficiente.</>
          )}{" "}
          El label dice &ldquo;que entran en el cálculo&rdquo; justamente para no leerse como el tamaño del
          mercado de la comuna.
        </p>
      )}
    </section>
  );
}
