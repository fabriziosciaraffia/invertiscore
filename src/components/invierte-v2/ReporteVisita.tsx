// ─────────────────────────────────────────────────────────────────────────────
// EL REPORTE DE LA VISITA (24-nov-2026; lámina 4.4-reporte-de-la-visita del 24-nov, dos casos). Solo lectura: sin botones de decisión
// (confirmar, ajustar o retirar viven en «Lo que sigue» y en la contraoferta). Arriba el resultado en una frase; después las fotos de la
// visita si las hay, lo que se revisó punto por punto (✓ azul si está bien, ! negro si hay un arreglo) y qué cambia en el precio: lo que
// Franco sugería y lo que sugiere ahora, con la razón en una línea. Se abre desde «Ver reporte» y queda en «Documentos de este depto».
// Sin "use client": la usan la página y /dev/invierte-v2/visita.
// ─────────────────────────────────────────────────────────────────────────────
import Link from "next/link";
import { VISITA_COPY as VC, tituloReporte, type VisitaResumen } from "@/lib/invierte-v2/visita";
import { diaMes } from "@/lib/invierte-v2/depto-flujo";

const uf0 = (n: number) => `UF ${Math.round(n).toLocaleString("es-CL")}`;

/** La razón en una línea de por qué cambió lo que sugiere Franco. */
function razon(v: VisitaResumen): string {
  if (v.reporteEstado === "remodelacion") return "Estimamos más rebaja por la remodelación que necesita.";
  const n = v.puntos.filter((p) => p.arreglo && !p.enFotos).length;
  return VC.unPuntoMas(n === 1 ? "el arreglo que no se veía en las fotos" : "los arreglos que no se veían en las fotos");
}

export function ReporteVisita({ v, volverA, aceptada }: { v: VisitaResumen; volverA: string; aceptada: boolean }) {
  const cambia = v.delta > 0 && v.sugeridaAntesUF != null && v.sugeridaDespuesUF != null && v.sugeridaDespuesUF !== v.sugeridaAntesUF;
  const sub = v.reporteEstado === "coincide" ? VC.reporteSinCambio : `${(v.reporteLinea ?? "").replace(/\.$/, "")}.`;
  return (
    <div className="iv2-rv" data-inv2="reporte-visita" data-estado={v.reporteEstado ?? ""}>
      <section className="iv2-rv-cab">
        {v.visitadaAt && <span className="iv2-dp-rotulo" data-inv2="rv-fecha">{VC.reporteFecha(diaMes(v.visitadaAt))}</span>}
        <h1 className="iv2-rv-t" id="iv2-t">{tituloReporte(v)}</h1>
        <p className="iv2-rv-sub">{sub}</p>
      </section>
      {v.fotos.length > 0 && <p className="iv2-rv-fotos" data-inv2="rv-fotos">{VC.fotosVisita(v.fotos.length)}</p>}
      <section className="iv2-dp-tj" aria-labelledby="iv2-rv-reviso">
        <div className="iv2-dp-th"><h2 className="iv2-dp-th-t" id="iv2-rv-reviso">{VC.seReviso}</h2><span className="iv2-dp-th-n">{v.puntos.length}</span></div>
        <ul className="iv2-dp-filas-t">
          {v.puntos.map((p, i) => (
            <li key={i} className="iv2-dp-tr" data-arreglo={p.arreglo ? "1" : undefined}>
              <span className={`iv2-dp-ic ${p.arreglo ? "iv2-dp-ic-arreglo" : "iv2-dp-ic-ok"}`} aria-hidden="true">{p.arreglo ? "!" : "✓"}</span>
              <span className="iv2-dp-tr-txt"><span className="iv2-dp-q">{p.tema}</span><span className="iv2-dp-a">{p.texto}</span></span>
            </li>
          ))}
        </ul>
      </section>
      {v.sugeridaAntesUF != null && (
        <section className="iv2-rv-precio" aria-labelledby="iv2-rv-precio" data-inv2="rv-precio">
          <span className="iv2-dp-rotulo" id="iv2-rv-precio">{VC.cambiaPrecio}</span>
          {cambia ? (
            <>
              <div className="iv2-rv-cifras">
                <div><span className="iv2-rv-et">{aceptada ? "Precio aceptado" : VC.francoSugeria}</span><span className="iv2-rv-v">{uf0(v.sugeridaAntesUF!)}</span></div>
                <span className="iv2-rv-flecha" aria-hidden="true">→</span>
                <div><span className="iv2-rv-et">{VC.ahoraSugiere}</span><span className="iv2-rv-v iv2-dp-azul">{uf0(v.sugeridaDespuesUF!)}</span></div>
              </div>
              <p className="iv2-rv-razon">{razon(v)}</p>
            </>
          ) : (
            <>
              <div className="iv2-rv-cifras"><div><span className="iv2-rv-et">{aceptada ? "Precio aceptado" : "Franco sugiere"}</span><span className="iv2-rv-v iv2-dp-azul">{uf0(v.sugeridaDespuesUF ?? v.sugeridaAntesUF!)}</span></div></div>
              <p className="iv2-rv-razon">{VC.noCambia}</p>
            </>
          )}
        </section>
      )}
      <Link href={volverA} className="iv2-secundario iv2-rv-volver" data-inv2="rv-volver">{VC.volverDepto}</Link>
    </div>
  );
}
