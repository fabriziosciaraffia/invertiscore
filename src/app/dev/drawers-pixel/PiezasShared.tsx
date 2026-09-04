"use client";
// ============================================================================
// DEV · QA visual de las piezas compartidas (T1 · bloque 1) sobre el fixture de
// Sta. Rosa (`staRosaStr`, recompute volcado al JSON). `?comp=matriz|planilla|filadato|
// tramos|curva|cifras|dia1|patrimonio|all`. Cero cálculo nuevo: todo sale de
// `results.metrics`, `results.projections`, `results.flujoEstacional`, `results.exitScenario`
// y `simulacion` del fixture.
// ============================================================================
import { useState } from "react";
import { barraDia1 } from "@/lib/plata-dia1";
import { metricaValorONull } from "@/lib/types";
import { VViz } from "@/components/analysis/hallazgos/vocabulario";
import { Matriz, Planilla, FilaDato, FilasDato, BarraTramos, CurvaAnual, SeisCifras, BloqueDia1, CurvaPatrimonio } from "@/components/analysis/shared";

const clp = (n: number) => `${n < 0 ? "−" : ""}$${Math.round(Math.abs(n)).toLocaleString("es-CL")}`;
const k = (n: number) => `${n < 0 ? "−" : ""}$${Math.round(Math.abs(n) / 1000)}k`;
const mm = (n: number) => `$${(n / 1_000_000).toFixed(1).replace(".", ",")} MM`;
const pct1 = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PiezasShared({ fix, comp }: { fix: any; comp: string }) {
  const r = fix.results;
  const sim = fix.simulacion;
  const m = r.metrics;
  const [serie, setSerie] = useState<"flujo" | "tir">("flujo");
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
    const t = m.tramosBarra;
    const f = m.desgloseFall;
    bloques.push({
      id: "tramos", titulo: "Barra de tramos + filas de dato (II)", node: (
        <VViz t={`Qué pasa con los ${clp(t.ingreso)} del ingreso`}>
          <BarraTramos {...t} title={`Ingreso ${clp(t.ingreso)} · costos de operar ${clp(t.costosOperar)} · cuota ${clp(t.cuota)} · sale de tu bolsillo ${clp(t.exceso)}`} />
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
  if (on("matriz") && sim) {
    const mto = sim.matrizTarifaOcupacion;
    const mpp = sim.matrizPiePlazo;
    bloques.push({
      id: "matriz", titulo: "Matriz tarifa × ocupación (I) y pie × plazo (IV, con toggle)", node: (
        <>
          <VViz t="Lo que queda cada mes después de comisión, costos y cuota">
            <Matriz
              ejeX={{ label: "→ más tarifa", niveles: mto.tarifas.map((t: number) => ({ k: clp(t), sub: "por noche" })) }}
              ejeY={{ label: "↓ más ocupación", niveles: mto.ocupaciones.map((o: number) => ({ k: `${Math.round(o * 100)}%`, sub: `${Math.round(o * 365 / 12)} noches` })) }}
              celdas={mto.ocupaciones.map((o: number) => mto.tarifas.map((t: number) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const c = mto.celdas.find((x: any) => x.tarifaCLP === t && x.ocupacion === o);
                return c ? { v: k(c.flujoMensual), neg: c.flujoMensual < 0, cruza: c.cruza, hoy: c.esActual, title: `${clp(c.flujoMensual)} al mes · ${c.veredicto}` } : { v: "—" };
              }))}
              leyenda={{ hoy: "hoy", cruza: "cruza a Comprar", cruzaCorto: "cruza" }}
            />
          </VViz>
          <VViz t="Tu flujo mensual según pie y plazo">
            <Matriz
              cabecera="Cuánto cambia el mes según pie y plazo"
              toggle={{ opciones: [{ id: "flujo", label: "Flujo" }, { id: "tir", label: "TIR" }], activo: serie, onChange: (id) => setSerie(id as "flujo" | "tir") }}
              ejeX={{ label: "→ más plazo", niveles: mpp.plazos.map((p: number) => ({ k: String(p), sub: "años" })) }}
              ejeY={{ label: "↓ más pie", niveles: mpp.pies.map((p: number) => ({ k: `${p}%`, sub: mm((r.pie / (fix.input_data.piePct / 100)) * (p / 100)) })) }}
              celdas={mpp.pies.map((p: number) => mpp.plazos.map((pl: number) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const c = mpp.celdas.find((x: any) => x.piePct === p && x.plazoAnios === pl);
                if (!c) return { v: "—" };
                const v = serie === "flujo" ? k(c.flujoMensual) : c.tirPct != null ? pct1(c.tirPct) : "—";
                return { v, neg: serie === "flujo" ? c.flujoMensual < 0 : false, cruza: c.cruza, hoy: c.esActual, title: `${clp(c.flujoMensual)} al mes · TIR ${c.tirPct != null ? pct1(c.tirPct) : "—"} · ${c.veredicto}` };
              }))}
              leyenda={{ hoy: "hoy", cruza: "cruza a Comprar", cruzaCorto: "cruza" }}
            />
          </VViz>
        </>
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
    const ingresos = fe.map((x) => x.ingresoBruto ?? 0);
    const prom = ingresos.reduce((a, b) => a + b, 0) / (ingresos.length || 1);
    bloques.push({
      id: "curva", titulo: "Curva anual (III)", node: (
        <VViz t="Ingreso de cada mes frente al mes promedio · curva real de la zona">
          <CurvaAnual puntos={fe.map((x, i) => ({ v: ingresos[i], positivo: (x.flujo ?? 0) > 0 }))} promedio={prom} />
        </VViz>
      ),
    });
  }
  if (on("patrimonio") && r.projections && r.exitScenario) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pr = (r.projections as any[]).slice(0, 10);
    const inv = r.exitScenario.inversionInicial ?? r.pie;
    bloques.push({
      id: "patrimonio", titulo: "Curva de patrimonio (VI)", node: (
        <VViz t="Lo que pusiste, lo que vale y tu parte · año a año">
          <CurvaPatrimonio anios={pr.map((p) => ({ year: p.year, valor: p.valorDepto, aporte: inv + Math.max(0, -p.flujoAcumulado), patrimonio: p.patrimonioNeto }))} etiquetaFinal={mm(pr[pr.length - 1].patrimonioNeto)} />
        </VViz>
      ),
    });
  }
  if (on("dia1") && m && r.exitScenario) {
    const d = m.dia1;
    const barra = barraDia1({ pieCLP: d.pieCLP, gastosCompraCLP: d.gastosCompraCLP, amoblamientoCLP: d.amoblamientoCLP, capexCLP: d.capexCLP, inversionInicial: d.inversionInicial, patrimonio: r.exitScenario.equityCLP });
    const multV = metricaValorONull(r.exitScenario.multiplicadorCapital);
    const mult = multV != null ? `×${multV.toFixed(2).replace(".", ",")}` : null;
    bloques.push({
      id: "dia1", titulo: "Bloque del día 1 (VI, cuatro tonos)", node: (
        <VViz t={`De dónde salen tus ${mm(r.exitScenario.equityCLP)} si vendes el año 10`}>
          <BloqueDia1 barra={barra} total={clp(d.inversionInicial)} totalAlt={`UF ${Math.round(d.inversionInicial / fix.uf).toLocaleString("es-CL")}`} multiplicador={mult} fmt={clp} />
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
