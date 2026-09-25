"use client";

// ─────────────────────────────────────────────────────────────────────────────
// «CÓMO LO PAGAS» — el cuerpo del capítulo, compartido LTR/STR (21-sep-2026).
//
// Dibuja lo que `construirComoLoPagas` arma. Sin lógica propia: si acá hay un `if` que
// decide QUÉ decir, está en el archivo equivocado — el modelo es puro y se testea aparte.
// Contrato visual: docs/wireframes/rediseno-informe/capitulo-como-lo-pagas.html.
//
// Lo único con geometría propia es la FRANJA DE CUARTILES: p25 · mediana · p75 de la
// misma muestra que calcula la mediana, con dos pines —tu precio y el recomendado— en
// UF/m². Los porcentajes se calculan desde los datos; el pin del recomendado va en fila
// propia bajo la barra porque en la misma fila se solapaban en 4 de 6 filas reales.
// ─────────────────────────────────────────────────────────────────────────────

import type { CSSProperties, ReactNode } from "react";
import { ChipVeredicto } from "./ChipVeredicto";
import type { Veredicto } from "@/lib/types";
import type { FranjaPagas, ModeloComoLoPagas, Seg } from "@/lib/como-lo-pagas";
import { BANDA_PAGAS } from "@/lib/como-lo-pagas";
import { Glosa } from "./Glosa";
import { VProsa, VSub } from "@/components/analysis/hallazgos/vocabulario";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const uf1 = (n: number) => `UF ${n.toFixed(1).replace(".", ",")}`;
const pct1 = (n: number) => n.toFixed(1).replace(".", ",");

function Segs({ segs }: { segs: Seg[] }) {
  return (
    <>
      {segs.map((s, i) => (s.b ? <b key={i}>{s.t}</b> : <span key={i}>{s.t}</span>))}
    </>
  );
}

const K: CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--doc-tx4)", paddingTop: 2 };

/** Franja de cuartiles con los dos pines. Toda la geometría sale de los datos. */
export function FranjaCuartiles({ f }: { f: FranjaPagas }) {
  const p25 = f.p25UfM2, p75 = f.p75UfM2;
  const puntos = [f.sujetoUfM2, f.medianaUfM2, ...(p25 != null ? [p25] : []), ...(p75 != null ? [p75] : []), ...(f.recUfM2 != null ? [f.recUfM2] : [])];
  const lo = Math.min(...puntos) * 0.92;
  const hi = Math.max(...puntos) * 1.08;
  const x = (v: number) => `${(((v - lo) / (hi - lo)) * 100).toFixed(2)}%`;
  const tick = (v: number, fuerte = false): CSSProperties => ({ position: "absolute", left: x(v), top: fuerte ? 17 : 19, width: fuerte ? 2 : 1, height: fuerte ? 20 : 16, background: fuerte ? "var(--doc-tx)" : "var(--doc-tx2)" });
  const lab = (v: number): CSSProperties => ({ position: "absolute", left: x(v), top: 40, fontSize: 9.5, color: "var(--doc-tx4)", whiteSpace: "nowrap", transform: "translateX(-50%)", fontVariantNumeric: "tabular-nums" });
  const pin = (v: number, rec: boolean): CSSProperties => ({
    position: "absolute",
    left: x(v),
    ...(rec ? { bottom: 0 } : { top: 0 }),
    transform: "translateX(-50%)",
    fontSize: 10,
    fontWeight: 700,
    whiteSpace: "nowrap",
    padding: "2px 6px",
    borderRadius: 5,
    lineHeight: 1.2,
    ...(rec ? { background: "var(--doc-bg, var(--franco-card))", color: "var(--doc-tx)", border: "1px solid var(--doc-tx2)" } : { background: "var(--doc-tx)", color: "var(--doc-bg, var(--franco-card))" }),
  });
  return (
    <div style={{ position: "relative", height: f.recUfM2 != null ? 82 : 58, margin: "8px 0 6px" }} role="img" aria-label={`Tu precio ${uf1(f.sujetoUfM2)} por m² contra una mediana comunal de ${uf1(f.medianaUfM2)}`}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 24, height: 6, background: "var(--doc-line2)", borderRadius: 3 }} />
      {p25 != null && p75 != null && <div style={{ position: "absolute", left: x(p25), width: `${(((p75 - p25) / (hi - lo)) * 100).toFixed(2)}%`, top: 24, height: 6, background: "var(--doc-tx3)", borderRadius: 3 }} />}
      {p25 != null && <div style={tick(p25)} />}
      <div style={tick(f.medianaUfM2, true)} />
      {p75 != null && <div style={tick(p75)} />}
      {p25 != null && <div style={lab(p25)}>p25 {uf1(p25)}</div>}
      <div style={{ ...lab(f.medianaUfM2), color: "var(--doc-tx3)", fontWeight: 600 }}>mediana {uf1(f.medianaUfM2)}</div>
      {p75 != null && <div style={lab(p75)}>p75 {uf1(p75)}</div>}
      <div style={pin(f.sujetoUfM2, false)}>tu precio {uf1(f.sujetoUfM2)}/m²</div>
      {f.recUfM2 != null && <div style={pin(f.recUfM2, true)}>recomendado {uf1(f.recUfM2)}/m²</div>}
    </div>
  );
}

function Bloque({ n, titulo, children }: { n: string; titulo: ReactNode; children: ReactNode }) {
  return (
    <div style={{ marginTop: n === "1" ? 0 : 22, paddingTop: n === "1" ? 0 : 18, borderTop: n === "1" ? "none" : "1px solid var(--doc-line, var(--franco-border))" }}>
      <VSub>
        <span style={{ marginRight: 6, color: "var(--doc-tx4)" }}>{n}</span>
        {titulo}
      </VSub>
      {children}
    </div>
  );
}

export function CapituloComoLoPagas({ modelo, valorUF }: { modelo: ModeloComoLoPagas; valorUF: number }) {
  const m = modelo;
  const r = m.rec;
  return (
    <div>
      {/* ── 1 · CARO O BARATO ── */}
      {m.franja && m.fraseFranja && (
        <Bloque n="1" titulo={<>Caro o barato{m.notaFranja && <Glosa titulo="Caro o barato" texto={m.notaFranja} />}</>}>
          <FranjaCuartiles f={m.franja} />
          <VProsa>
            <p>
              <Segs segs={m.fraseFranja} />
            </p>
          </VProsa>
        </Bloque>
      )}

      {/* ── 2 · LA ESTRATEGIA, ANCLADA AL PRECIO RECOMENDADO ── */}
      <Bloque n={m.franja ? "2" : "1"} titulo={m.tituloBloque2}>
        {r && m.caso !== "comprar" && m.caso !== "sin_salida" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 10, padding: "14px 14px", background: "var(--doc-inset, color-mix(in srgb, var(--franco-text) 4%, transparent))", borderRadius: 10 }}>
              <div>
                <div style={K}>Hoy</div>
                <div className="font-mono" style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1, color: "var(--doc-tx3)", textDecoration: r.descuentoPct > 0 ? "line-through" : "none", textDecorationThickness: 1.5, fontVariantNumeric: "tabular-nums" }}>
                  UF {miles(m.precioUF)}
                  <small style={{ display: "block", fontSize: 11, fontWeight: 500, marginTop: 3 }}>${miles(m.precioUF * valorUF)}</small>
                </div>
              </div>
              <div style={{ fontSize: 18, color: "var(--doc-tx3)" }}>→</div>
              <div>
                <div style={K}>Lo que Franco recomienda</div>
                <div className="font-mono" style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1, color: "var(--doc-tx)", fontVariantNumeric: "tabular-nums" }}>
                  UF {miles(r.precioUF)}
                  <small style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--doc-tx3)", marginTop: 3 }}>
                    ${miles(r.precioUF * valorUF)}
                    {r.descuentoPct > 0 ? ` · −${pct1(r.descuentoPct)}%` : " · sin descuento"}
                  </small>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0 0", fontSize: 11.5 }}>
              <Chip>{r.pieA !== r.pieDe ? <>Pie <s style={{ color: "var(--doc-tx4)" }}>{pct1(r.pieDe).replace(",0", "")}%</s> {pct1(r.pieA).replace(",0", "")}%</> : <>Pie {pct1(r.pieDe).replace(",0", "")}%</>}</Chip>
              <Chip>{r.plazoA !== r.plazoDe ? <>Plazo <s style={{ color: "var(--doc-tx4)" }}>{r.plazoDe}</s> {r.plazoA} años</> : <>Plazo {r.plazoDe} años</>}</Chip>
              <Chip fuerte>{r.descuentoPct > 0 ? `Negocias −${pct1(r.descuentoPct)}% de precio` : "Sin pedirle un peso al vendedor"}</Chip>
              <Chip>
                → <ChipVeredicto v={r.destino as Veredicto} />
              </Chip>
            </div>
            {r.descuentoPct > 0 && (
              <p style={{ marginTop: 10, fontSize: 11.5, color: "var(--doc-tx3)", lineHeight: 1.5 }}>
                <b style={{ color: "var(--doc-tx)", fontWeight: 600 }}>{BANDA_PAGAS[r.banda]}</b>
                {typeof r.descuentoSoloPrecioPct === "number" && r.descuentoSoloPrecioPct !== r.descuentoPct ? ` · −${pct1(r.descuentoSoloPrecioPct)}% si solo modificas el precio` : ""}
                {r.costoDiaUnoUF > 0 ? ` · poner ese pie cuesta UF ${miles(r.costoDiaUnoUF)} más el día uno.` : r.costoDiaUnoUF < 0 ? ` · con el precio negociado, el mismo pie son UF ${miles(-r.costoDiaUnoUF)} menos el día uno.` : "."}
              </p>
            )}
          </>
        )}
        <div style={{ marginTop: 14 }}>
          {m.pasos.map((p, i) => (
            <div key={p.k} className="paso-pagas" style={{ display: "grid", gridTemplateColumns: "118px 1fr", gap: 12, padding: i === 0 ? "0 0 10px" : "10px 0", borderTop: i === 0 ? "none" : "1px solid var(--doc-line, var(--franco-border))" }}>
              <div style={K}>{p.k}</div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--doc-tx2)" }}>
                <Segs segs={p.segs} />
              </div>
            </div>
          ))}
        </div>
      </Bloque>

      {/* ── 3 · PUESTA A PUNTO ── */}
      {m.capex && (
        <Bloque n={m.franja ? "3" : "2"} titulo={`Puesta a punto antes de ${m.modalidad === "STR" ? "publicar" : "arrendar"}`}>
          <VProsa>
            <p>
              <Segs segs={m.capex.intro} />
            </p>
          </VProsa>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 12 }}>
            <Kpi k={m.capex.montoMinUF != null && m.capex.montoMaxUF != null ? "Rango estimado" : "Inversión"} v={m.capex.montoMinUF != null && m.capex.montoMaxUF != null ? `UF ${miles(m.capex.montoMinUF)}–${miles(m.capex.montoMaxUF)}` : `UF ${miles(m.capex.montoUF)}`} />
            <Kpi k="Por m²" v={<>{pct1(m.capex.ufM2)} <small style={{ fontSize: 12, fontWeight: 500, color: "var(--doc-tx3)" }}>UF/m²</small></>} />
            <Kpi k="De tu plata día 1" v={`${m.capex.fraccionPct}%`} />
          </div>
        </Bloque>
      )}
      <style jsx>{`
        @media (max-width: 480px) {
          .paso-pagas { grid-template-columns: 1fr !important; gap: 3px !important; }
        }
      `}</style>
    </div>
  );
}

function Chip({ children, fuerte }: { children: ReactNode; fuerte?: boolean }) {
  return (
    <span style={{ padding: "3px 8px", border: `1px solid ${fuerte ? "var(--doc-tx2)" : "var(--doc-line2, var(--franco-border))"}`, borderRadius: 999, color: fuerte ? "var(--doc-tx)" : "var(--doc-tx2)", fontWeight: fuerte ? 700 : 400, background: "var(--doc-bg, transparent)", display: "inline-flex", alignItems: "center", gap: 4 }}>
      {children}
    </span>
  );
}

function Kpi({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div>
      <p className="font-mono uppercase m-0" style={{ fontSize: 9.5, letterSpacing: "0.06em", color: "var(--doc-tx4)", marginBottom: 4 }}>{k}</p>
      <p className="font-mono font-bold m-0" style={{ fontSize: 18, lineHeight: 1.05, color: "var(--doc-tx)", fontVariantNumeric: "tabular-nums" }}>{v}</p>
    </div>
  );
}
