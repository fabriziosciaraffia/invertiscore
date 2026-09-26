"use client";
// ============================================================================
// DEV · QA visual de las piezas compartidas (T1 · bloque 1) sobre el fixture de
// Sta. Rosa (`staRosaStr`, recompute volcado al JSON). `?comp=matriz|planilla|filadato|
// tramos|curva|cifras|dia1|patrimonio|all`. Cero cálculo nuevo: todo sale de
// `results.metrics`, `results.projections`, `results.flujoEstacional`, `results.exitScenario`
// y `simulacion` del fixture.
// ============================================================================
import { VViz } from "@/components/analysis/hallazgos/vocabulario";
import { Planilla, FilaDato, FilasDato, CurvaFlujoAnual, SeisCifras, PatrimonioBarras, BarraApiladaB } from "@/components/analysis/shared";

const clp = (n: number) => `${n < 0 ? "−" : ""}$${Math.round(Math.abs(n)).toLocaleString("es-CL")}`;
const mm = (n: number) => `$${(n / 1_000_000).toFixed(1).replace(".", ",")} MM`;
const pct1 = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PiezasShared({ fix, comp }: { fix: any; comp: string }) {
  const r = fix.results;
  const m = r.metrics;
  const todo = comp === "all";
  const on = (c: string) => todo || comp === c;

  const bloques: { id: string; titulo: string; node: React.ReactNode }[] = [];

  if (on("cifras") && m) {
    bloques.push({
      id: "cifras", titulo: "Seis cifras", node: (
        <SeisCifras
          cifras={[
            { k: "Ingreso mensual estabilizado", v: clp(m.ingresoEstabilizadoMensual), tr: <>Lo que factura un mes típico con la ocupación estimada, <b>antes</b> de costos y cuota.</> },
            { k: "Flujo mensual", v: clp(m.flujoMensual), neg: m.flujoMensual < 0, tr: <>Lo que sale de tu bolsillo cada mes, <b>después de todo</b>.</> },
            { k: "Cap rate", v: pct1(m.capRatePct), tr: <>El ingreso neto de un año sobre el precio.</> },
            { k: "TIR a 10 años", v: m.tirPct != null ? pct1(m.tirPct) : "—", tr: <>Lo que rinde tu plata al año, sumando operación, aportes y venta.</> },
            { k: "Tarifa por noche · ADR", v: clp(m.tarifaNoche), tr: <>La mediana que cobra la zona hoy.</> },
            { k: "Ocupación base", v: `${Math.round(m.ocupacion * 100)}%`, tr: <>La estimada para este depto, estabilizado.</> },
          ]}
          onCalculo={() => {}}
        />
      ),
    });
  }
  if (on("tramos") && m) {
    // LA BARRA DE TRAMOS SE RETIRÓ (16-sep-2026): salió del capítulo II de las dos
    // modalidades por cambiar de unidad a mitad del parque, y esta página era su último
    // consumidor. Reemplazado se retira. El bloque conserva sus filas de dato, que es lo
    // que el capítulo sigue mostrando; el título deja de prometer una barra que no está.
    const f = m.desgloseFall;
    bloques.push({
      id: "tramos", titulo: "Filas de dato del flujo (II)", node: (
        <VViz t={`Qué pasa con los ${clp(f.ingreso)} del ingreso`}>
          <FilasDato>
            <FilaDato tono="in" k="Ingreso mensual estabilizado" tip="Tarifa por noche × ocupación × 365 ÷ 12" sub="lo que factura un mes típico con la ocupación estimada" v={clp(f.ingreso)} unidad="/mes" />
            <FilaDato k="Comisión de la plataforma" tip="La plataforma cobra 3% al anfitrión" sub="3% del ingreso" v={clp(-f.comisionPlataforma)} unidad="/mes" />
            <FilaDato k="Luz, agua, internet e insumos" tip="Costos directos declarados por ti" v={clp(-f.costosDirectos)} unidad="/mes" />
            <FilaDato k="Gastos comunes y mantención" tip="Declarados por ti" v={clp(-f.gastosComunesMantencion)} unidad="/mes" />
            <FilaDato k="Contribuciones" tip="Contribuciones ÷ 3" v={clp(-f.contribucionesMensuales)} unidad="/mes" />
            <FilaDato k="Cuota del crédito" tip="Dividendo del crédito hipotecario" v={clp(-f.cuota)} unidad="/mes" />
            <FilaDato tono={f.saleDeTuBolsillo < 0 ? "tot" : "tot"} k={f.saleDeTuBolsillo < 0 ? "Sale de tu bolsillo" : "Te queda"} tip="Ingreso − comisión − costos − cuota" v={<span style={{ color: f.saleDeTuBolsillo < 0 ? "var(--signal-red)" : undefined }}>{clp(f.saleDeTuBolsillo)}</span>} unidad="/mes" />
          </FilasDato>
        </VViz>
      ),
    });
  }
  if (on("planilla") && r.projections) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filas = (r.projections as any[]).slice(0, 10);
    const n = (v: number) => ({ v: clp(v), neg: v < 0 });
    bloques.push({
      id: "planilla", titulo: "Planilla (modal Cómo se calcula)", node: (
        <div className="m-block">
          <div className="bt">a · Flujo por año</div>
          <div className="bq">Cada año con el ingreso y los costos reajustados.</div>
          <Planilla
            columnas={["Año", "Ingreso", "Comisión y costos", "Ingreso neto", "Cuota", "Estabilización", "Flujo neto", "Acumulado"]}
            filas={[
              ...filas.map((p) => ({ th: String(p.year), celdas: [n(p.ingresoAnual ?? 0), n(-((p.comisionAnual ?? 0) + (p.costosAnual ?? 0))), n(p.ingresoNetoAnual ?? 0), n(-(p.cuotaAnual ?? 0)), (p.estabilizacionAnual ?? 0) > 0 ? n(-(p.estabilizacionAnual ?? 0)) : { v: "—" }, n(p.flujoOperacionalAnual), n(p.flujoAcumulado)] })),
              { th: "Total 10 años", clase: "tot" as const, celdas: [n(filas.reduce((a, p) => a + (p.ingresoAnual ?? 0), 0)), n(-filas.reduce((a, p) => a + (p.comisionAnual ?? 0) + (p.costosAnual ?? 0), 0)), n(filas.reduce((a, p) => a + (p.ingresoNetoAnual ?? 0), 0)), n(-filas.reduce((a, p) => a + (p.cuotaAnual ?? 0), 0)), n(-filas.reduce((a, p) => a + (p.estabilizacionAnual ?? 0), 0)), n(filas.reduce((a, p) => a + p.flujoOperacionalAnual, 0)), { v: "" }] },
            ]}
          />
        </div>
      ),
    });
  }
  if (on("curva") && r.flujoEstacional) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fe = r.flujoEstacional as any[];
    bloques.push({
      id: "curva", titulo: "Curva anual (III)", node: (
        <VViz t="Lo que deja o cuesta cada mes, según la temporada">
          <CurvaFlujoAnual flujos={fe.map((x) => Number(x.flujo ?? 0))} fmt={(n) => `${n < 0 ? "−" : ""}$${Math.round(Math.abs(n)).toLocaleString("es-CL")}`} />
        </VViz>
      ),
    });
  }
  if (on("patrimonio") && r.projections && r.exitScenario) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pr = (r.projections as any[]).slice(0, 10);
    const inv = r.exitScenario.inversionInicial ?? r.pie;
    bloques.push({
      id: "patrimonio", titulo: "Barras de patrimonio (VI)", node: (
        <VViz t="Lo que pusiste, lo que vale y tu parte · año a año">
          <PatrimonioBarras filas={pr.map((p) => ({ anio: p.year, aporte: inv + Math.max(0, -p.flujoAcumulado), precio: r.pie + r.montoCredito, valor: p.valorDepto, parte: p.parteAlVender ?? p.patrimonioNeto }))} fmtEje={(n) => `${Math.round(n / 1e6)}M`} />
        </VViz>
      ),
    });
  }
  if (on("dia1") && m && r.exitScenario) {
    const amort = Math.max(r.montoCredito - r.exitScenario.saldoCreditoAlVender, 0);
    const plus = r.exitScenario.equityCLP - r.pie - amort;
    bloques.push({
      id: "dia1", titulo: "Barra apilada forma B (VI)", node: (
        <VViz t={`De dónde salen tus ${mm(r.exitScenario.equityCLP)}`}>
          <BarraApiladaB tramos={[{ tono: "pie", k: "Pie", v: r.pie }, { tono: "amort", k: "Amortización", v: amort }, { tono: "plus", k: "Plusvalía", v: plus }]} leyenda={{ izq: "Firme", der: "Proyectado" }} fmt={mm} />
        </VViz>
      ),
    });
  }
  if (on("filadato") && r.exitScenario) {
    const e = r.exitScenario;
    bloques.push({
      id: "filadato", titulo: "Filas de dato (venta año 10)", node: (
        <FilasDato>
          <FilaDato k="Valor de venta estimado" tip="Precio × 1,03¹⁰" sub="3% al año desde la compra" v={clp(e.valorVenta)} />
          <FilaDato k="Deuda pendiente" tip="Saldo del crédito al vender" sub="lo que queda del crédito el año 10" v={clp(-e.saldoCreditoAlVender)} />
          <FilaDato k="Gastos de venta" tip="Comisión de corretaje" sub="2% del valor de venta" v={clp(-e.gastosCierre)} />
          <FilaDato tono="tot" k="Te queda" tip="Valor − deuda − gastos" v={clp(e.equityCLP)} />
        </FilasDato>
      ),
    });
  }

  return (
    <div style={{ maxWidth: 936, margin: "0 auto", padding: "24px 20px 60px" }}>
      {bloques.map((b) => (
        <section key={b.id} id={b.id} style={{ marginBottom: 40 }}>
          <p className="font-mono" style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--doc-tx4)", marginBottom: 10 }}>
            {b.titulo}
          </p>
          {b.node}
        </section>
      ))}
      {bloques.length === 0 && <p>Nada que mostrar para comp={comp}: el fixture no trae metrics/simulación (¿no es staRosaStr?).</p>}
    </div>
  );
}
