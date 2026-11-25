// ─────────────────────────────────────────────────────────────────────────────
// RESPONDER LA CONTRAOFERTA (B4, 23-nov-2026; lámina 5.2, dos casos, y los puntos 4, 11 y 12 de Fabrizio). El título dice lo que piden;
// la barra muestra dónde quedó cada uno frente a lo recomendado (franja azul clara) y al precio publicado; la tabla compara los números a
// cada precio, con la columna de lo que sugiere Franco destacada (salen del motor: cifras-motor.ts, la misma fuente que la ficha). El
// botón rojo es lo que sugiere Franco; la otra salida va como segundo botón, nunca escondida. «Proponer otro monto» abre la oferta con el
// tope en la contraoferta y el piso en la oferta anterior. Cualquier monto distinto al firmado pasa por «Revisa y firma». «No aceptar la
// contraoferta» cierra la oferta (o, si llegó fuera de plazo, es «No, gracias»). Sin "use client": la usan la página y /dev.
// La visita antes del precio (24-nov-2026, lámina 5.2 del 24-nov): si todavía no visita, Franco sugiere visitar y ese es el botón rojo
// («Responder sin visitar» abre las mismas opciones de después); ya visitó, aparece la línea del reporte y lo que sugiere Franco vuelve
// a ser el botón rojo, recalculado con el reporte.
// ─────────────────────────────────────────────────────────────────────────────
import Link from "next/link";
import { B4_COPY as B, lineaVence, textoOtraFirme, type OtraViva } from "@/lib/invierte-v2/b4";
import { cuartaCifra, pctCifra, clpCifra, type CifrasAPrecio } from "@/lib/invierte-v2/cifras";
import { diaMes, urlContraoferta, urlFirmaRonda, urlOferta, urlReporteVisita } from "@/lib/invierte-v2/depto-flujo";
import { AccionOferta } from "./AccionesOferta";
import { AccionVisita } from "./AccionesVisita";
import { VISITA_COPY as VC, conArreglo, visitaAbierta, visitaPublicada, type VisitaResumen } from "@/lib/invierte-v2/visita";

const uf0 = (n: number) => `UF ${Math.round(n).toLocaleString("es-CL")}`;

export interface DatosContraoferta {
  avisoId: string;
  ofertaId: string;
  tuUF: number;
  ellosUF: number;
  sugeridaUF: number;
  /** aceptar: la contraoferta cae dentro de lo recomendado; proponer: el punto medio con tope. */
  accion: "aceptar" | "proponer";
  /** En un Ajusta supuestos, el tope de lo que sugiere Franco es el precio al que vuelve a Comprar. */
  topeEsComprar: boolean;
  pisoUF: number;
  altoUF: number;
  publicadoUF: number;
  venceAt: string | null;
  fueraDePlazo: boolean;
  /** Otra oferta viva en otro depto: aceptar la retira (una a la vez). */
  otraViva: OtraViva | null;
  /** Con un acuerdo en otro depto (25-nov-2026): en pausa, sin botones para firmar. */
  pausaAcuerdo?: boolean;
  /** Las cifras del motor a cada precio (sin datos fijos del motor, la tabla queda solo con el precio). */
  cifras: { tu: CifrasAPrecio | null; sugerida: CifrasAPrecio | null; ellos: CifrasAPrecio | null };
  /** La visita del depto (24-nov-2026) y si la persona eligió «Responder sin visitar». */
  visita?: VisitaResumen | null;
  sinVisitar?: boolean;
  /** «Se mantiene hasta el jueves 26» si quien vende aceptó esperar la visita. */
  mantiene?: boolean;
}

/** La barra: la franja recomendada, las tres marcas y el publicado al final (lámina 5.2). */
function BarraContraoferta({ d }: { d: DatosContraoferta }) {
  const min = Math.min(d.pisoUF, d.tuUF) - Math.max(20, (d.publicadoUF - Math.min(d.pisoUF, d.tuUF)) * 0.35);
  const max = d.publicadoUF;
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100)).toFixed(1)}%`;
  const proponer = d.accion === "proponer";
  return (
    <div className="iv2-co-barra" data-inv2="barra-contraoferta" role="img" aria-label={`${B.tu} ${uf0(d.tuUF)}, ${B.ellos} ${uf0(d.ellosUF)}${proponer ? `, ${B.francoSugiere} ${uf0(d.sugeridaUF)}` : ""}, publicado ${uf0(d.publicadoUF)}`}>
      <div className="iv2-co-chips">
        <span className="iv2-co-chip iv2-co-chip-tu" style={{ left: pos(d.tuUF) }}>{B.tu}</span>
        <span className="iv2-co-chip iv2-co-chip-ellos" style={{ left: pos(d.ellosUF) }}>{B.ellos}</span>
      </div>
      <div className="iv2-co-pista">
        <span className="iv2-co-franja" style={{ left: pos(d.pisoUF), width: `calc(${pos(d.altoUF)} - ${pos(d.pisoUF)})` }} />
        <span className="iv2-co-fin" aria-hidden="true" />
        <span className="iv2-co-punto iv2-co-punto-tu" style={{ left: pos(d.tuUF) }} />
        {proponer && <span className="iv2-co-punto iv2-co-punto-sug" style={{ left: pos(d.sugeridaUF) }} data-inv2="punto-sugerida" />}
        <span className="iv2-co-punto iv2-co-punto-ellos" style={{ left: pos(d.ellosUF) }} />
      </div>
      <div className="iv2-co-rotulos">
        {proponer && <span className="iv2-co-rot iv2-co-rot-sug" style={{ left: pos(d.sugeridaUF) }}><b>{B.francoSugiere}</b>{uf0(d.sugeridaUF)}</span>}
        <span className="iv2-co-rot iv2-co-rot-pub"><b>Publicado</b>{uf0(d.publicadoUF)}</span>
      </div>
    </div>
  );
}

export function ResponderContraoferta({ d, volverA }: { d: DatosContraoferta; volverA: string }) {
  const v = d.venceAt ? lineaVence(new Date(d.venceAt)) : null;
  const proponer = d.accion === "proponer";
  // Las columnas: tu oferta, lo que sugiere Franco (si es proponer) y lo que piden; la destacada es la de Franco.
  const cols = [
    { k: "tu", t: B.tuOferta, uf: d.tuUF, c: d.cifras.tu, dest: false },
    ...(proponer ? [{ k: "sugerida", t: B.francoSugiere, uf: d.sugeridaUF, c: d.cifras.sugerida, dest: true }] : []),
    { k: "ellos", t: B.ellos, uf: d.ellosUF, c: d.cifras.ellos, dest: !proponer },
  ];
  const flujos = cols.map((x) => x.c?.flujoCLP ?? null).filter((x): x is number => x != null);
  const etMes = flujos.length && flujos.every((f) => f > 0) ? "Te sobran al mes" : flujos.every((f) => f <= 0) ? "Pones al mes" : "Al mes";
  const mixto = etMes === "Al mes";
  const retirarOtra = !!d.otraViva;
  const firmaSug = urlFirmaRonda(d.avisoId, d.sugeridaUF, d.ofertaId, retirarOtra && !proponer);
  const firmaEllos = urlFirmaRonda(d.avisoId, d.ellosUF, d.ofertaId, retirarOtra);
  const visito = visitaPublicada(d.visita);
  // Antes de visitar (y sin haber elegido «Responder sin visitar», ni con la visita ya pedida, ni fuera de plazo): la visita es lo que sigue.
  const antesDeVisitar = !visito && !d.sinVisitar && !visitaAbierta(d.visita) && !d.fueraDePlazo;
  const porque = visito
    ? (conArreglo(d.visita) && d.visita!.delta > 0 ? "Con lo que se vio en la visita, el tope de lo que recomendamos bajó." : proponer ? `Es el tope de lo que recomendamos. ${VC.sinCambioRango}` : B.porqueDentro(uf0(d.ellosUF - d.tuUF)))
    : proponer ? (d.topeEsComprar ? B.porqueComprar(uf0(d.ellosUF - d.sugeridaUF)) : B.porqueTope(uf0(d.ellosUF - d.sugeridaUF))) : B.porqueDentro(uf0(d.ellosUF - d.tuUF));
  return (
    <div className="iv2-co" data-inv2="responder-contraoferta" data-accion={d.accion}>
      <div className="iv2-co-cab">
        <div>
          <h1 className="iv2-co-t" id="iv2-t">{B.piden(uf0(d.ellosUF))}</h1>
          {v && <p className="iv2-co-vence" data-inv2="co-vence">{v.vencida ? "Venció" : [d.mantiene ? VC.seMantieneCorto(v.vence.replace(/^Vence (el )?/i, "")) : v.vence, v.quedan ? `te ${v.quedan}` : null].filter(Boolean).join(" · ")}</p>}
        </div>
        {d.pausaAcuerdo ? <span className="iv2-chip-franco" data-inv2="co-chip">{B.pausaChip}</span> : <span className="iv2-chip-tuyo" data-inv2="co-chip"><i aria-hidden="true" />Te toca a ti</span>}
      </div>
      {d.fueraDePlazo && <p className="iv2-co-fuera" data-inv2="fuera-de-plazo">{B.fueraDePlazo}</p>}
      <BarraContraoferta d={d} />
      <table className="iv2-co-tabla" data-inv2="co-tabla">
        <thead><tr><th scope="col"><span className="iv2-sr">Cifra</span></th>{cols.map((x) => <th key={x.k} scope="col" data-destacada={x.dest ? "1" : undefined}>{x.t}</th>)}</tr></thead>
        <tbody>
          <tr><th scope="row">{B.precio}</th>{cols.map((x) => <td key={x.k} data-destacada={x.dest ? "1" : undefined} data-inv2={`co-precio-${x.k}`}><b>{uf0(x.uf)}</b></td>)}</tr>
          <tr><th scope="row">Cap rate</th>{cols.map((x) => <td key={x.k} data-destacada={x.dest ? "1" : undefined} data-inv2={`co-cap-${x.k}`}>{pctCifra(x.c?.capRatePct)}</td>)}</tr>
          <tr><th scope="row">{etMes}</th>{cols.map((x) => { const q = cuartaCifra(x.c?.flujoCLP); return <td key={x.k} data-destacada={x.dest ? "1" : undefined} data-inv2={`co-mes-${x.k}`}>{mixto && x.c?.flujoCLP != null ? `${q.pones ? "Pones" : "Sobran"} ${clpCifra(x.c.flujoCLP)}` : clpCifra(x.c?.flujoCLP)}</td>; })}</tr>
        </tbody>
      </table>
      {visito && d.visita!.visitadaAt && (
        <p className="iv2-dp-reporte" data-inv2="co-reporte">
          <span className={`iv2-dp-ic ${conArreglo(d.visita) ? "iv2-dp-ic-arreglo" : "iv2-dp-ic-ok"}`} aria-hidden="true">{conArreglo(d.visita) ? "!" : "✓"}</span>
          <span className="iv2-dp-reporte-l">{VC.visitasteEl(diaMes(d.visita!.visitadaAt))} · {(d.visita!.reporteLinea ?? VC.coincide).replace(/^El estado/, "el estado")}</span>
          <Link href={urlReporteVisita(d.avisoId)} className="iv2-enlace-azul" data-inv2="co-ver-reporte">{VC.verReporte}</Link>
        </p>
      )}
      {!d.pausaAcuerdo && <section className="iv2-co-sugiere" data-inv2="co-sugiere" aria-label={B.francoSugiere}>
        <span className="iv2-co-sugiere-r">{B.francoSugiere}</span>
        <p className="iv2-co-sugiere-t">{antesDeVisitar ? VC.sugiereVisitaT : proponer ? B.proponer(uf0(d.sugeridaUF)) : B.aceptar(uf0(d.ellosUF))}</p>
        <p className="iv2-co-sugiere-txt">{antesDeVisitar ? VC.sugiereVisita(uf0(d.sugeridaUF)) : porque}</p>
      </section>}
      {d.pausaAcuerdo && <p className="iv2-dp-sigue-aviso" data-inv2="co-pausa">{B.pausaDeptoT} {B.pausaDeptoTxt}</p>}
      {!d.pausaAcuerdo && d.otraViva && <p className="iv2-dp-sigue-aviso" data-inv2="co-otra-viva">{d.otraViva.firme ? textoOtraFirme(d.otraViva.firme.venceAt) : B.tardiaOtra(d.otraViva.titulo)}</p>}
      <div className="iv2-acciones iv2-co-acciones">
        {antesDeVisitar ? (
          <>
            <AccionVisita avisoId={d.avisoId} tipo="pedir_visita" texto={VC.visitarAntes} volverA={volverA} />
            <Link href={urlContraoferta(d.avisoId, true)} className="iv2-secundario" data-inv2="co-sin-visitar">{VC.responderSinVisitar}</Link>
          </>
        ) : d.otraViva?.firme || d.pausaAcuerdo ? null : (
          <>
            <Link href={proponer ? firmaSug : firmaEllos} className="inv-principal" data-inv2="co-principal">{proponer ? B.proponer(uf0(d.sugeridaUF)) : B.aceptar(uf0(d.ellosUF))}</Link>
            {proponer && <Link href={firmaEllos} className="iv2-secundario" data-inv2="co-aceptar">{B.aceptar(uf0(d.ellosUF))}</Link>}
            <Link href={`${urlOferta(d.avisoId)}?desde=${encodeURIComponent(d.ofertaId)}&monto=${Math.round(proponer ? d.sugeridaUF : d.tuUF)}`} className="iv2-enlace-azul iv2-co-enlace" data-inv2="co-otro-monto">{B.proponerOtro}</Link>
          </>
        )}
        <AccionOferta avisoId={d.avisoId} accion={d.fueraDePlazo ? "no_aceptar_tardia" : "no_aceptar"} clase="iv2-enlace-gris iv2-co-enlace" volverA={volverA} />
        {!d.otraViva?.firme && !d.pausaAcuerdo && <p className="iv2-co-nota">{B.firmaNota}</p>}
      </div>
    </div>
  );
}
