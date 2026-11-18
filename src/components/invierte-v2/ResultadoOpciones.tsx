"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EL RESULTADO Y LA ELECCIÓN (Invierte con Franco, etapa 2, 18-nov-2026; láminas 3.2-resultado-lista, -comparar, -pc, caso1 y
// caso2). Una sola pantalla para decidir: arriba el resultado (la línea de hasta cuánto, secundaria); debajo las opciones con
// casilla. En el celular, dos vistas (Lista y Comparar) con las mismas casillas y el mismo botón; en el PC, la tabla con todas.
//   · «Ver detalles» abre todos los detalles del depto SIN gastar créditos (charge_mode 'invierte', ruta de la guía).
//   · Caso 1 (el suyo no le alcanza, otros sí): por qué, y «Seguir con los que me alcanzan» abre la elección normal.
//   · Caso 2 (no le alcanza ninguno): cuánto le falta (pie, crédito o los dos), «Avísenme cuando algo me alcance» y
//     «actualizar». El bloque de deptos nuevos con pie en cuotas NO se construye en esta etapa.
// ─────────────────────────────────────────────────────────────────────────────
import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { botonOcupado } from "@/lib/carga-global";
import { ChipVeredicto } from "@/components/analysis/shared/ChipVeredicto";
import { CargandoDetalles } from "./CargandoDetalles";
import type { Veredicto } from "@/lib/types";
import { lineaTope, type Objetivo, type Preocupacion, type Tope } from "@/lib/invierte-v2/perfil";
import {
  MAX_ACTIVOS, RESULTADO_COPY as R, comunasEnFrase, estaCerca, fmtCLP, fmtUF, lecturaDeFranco, pieDe, porQueNoAlcanza,
  textoAlMes, textoEtiqueta, textoMetro, textoVsParecidos, type Caso, type Etiqueta, type OpcionDepto,
} from "@/lib/invierte-v2/opciones";

export const URL_BASE = "/invierte/base";
const URL_PERFIL_INV = "/invierte/perfil";

export interface PropsResultado {
  caso: Caso;
  opciones: OpcionDepto[];
  etiquetas: Record<string, Etiqueta>;
  elegidos: string[];
  tope: Pick<Tope, "topeUF" | "fuente" | "limita" | "creditoUF" | "porPieUF" | "menosPreciso">;
  pieUF: number | null;
  masBaratoUF: number | null;
  objetivo: Objetivo;
  preocupaciones: Preocupacion[];
  comunas: string[];
}

const nombreDepto = (o: OpcionDepto) => [o.comuna, o.dormitorios != null ? `${o.dormitorios}D${o.banos ?? 1}B` : null, o.m2 ? `${Math.round(o.m2)} m²` : null].filter(Boolean).join(" · ");

function Chip({ o }: { o: OpcionDepto }) {
  return o.veredicto ? <ChipVeredicto v={o.veredicto as Veredicto} puntaje={o.veredicto === "COMPRAR" ? o.score : null} /> : null;
}

export function ResultadoOpciones(p: PropsResultado) {
  const router = useRouter();
  const vivas = p.opciones.filter((o) => o.alcanza);
  const entrada = p.opciones.find((o) => o.esEntrada) ?? null;
  const [vista, setVista] = useState<"lista" | "comparar">("lista");
  const [abrirEleccion, setAbrirEleccion] = useState(p.caso !== "caso1");
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(p.elegidos.length ? p.elegidos.filter((id) => vivas.some((o) => o.avisoId === id)) : entrada?.alcanza ? [entrada.avisoId] : []));
  const [enviando, setEnviando] = useState(false);
  const [abriendo, setAbriendo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avisado, setAvisado] = useState(false);
  const lectura = useMemo(() => lecturaDeFranco(p.opciones, p.objetivo, p.preocupaciones, p.etiquetas), [p.opciones, p.objetivo, p.preocupaciones, p.etiquetas]);
  const tope = p.tope as Tope;

  const toggle = (id: string) => {
    const n = new Set(marcados);
    if (n.has(id)) n.delete(id);
    else if (n.size < MAX_ACTIVOS) n.add(id);
    else { setError(R.maximo); return; }
    setError(null);
    setMarcados(n);
  };

  async function verDetalles(o: OpcionDepto) {
    if (abriendo) return;
    setAbriendo(o.avisoId);
    try {
      const res = await fetch("/api/lo-que-sigue/guia/analizar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avisoId: o.avisoId, explorar: true, piePct: 20, plazoAnios: 30 }) });
      const d = (await res.json().catch(() => ({}))) as { id?: string };
      if (res.ok && d.id) { window.location.assign(`/analisis/${d.id}`); return; }
      setError("No pudimos abrir los detalles. Intenta de nuevo.");
    } catch {
      setError("No pudimos abrir los detalles. Intenta de nuevo.");
    }
    setAbriendo(null);
  }

  async function seguir() {
    if (enviando || !marcados.size) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/invierte-v2/eleccion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avisoIds: Array.from(marcados) }) });
      if (res.ok) { router.push(URL_BASE); return; }
      setError("No pudimos guardar tu elección. Intenta de nuevo.");
    } catch {
      setError("No pudimos guardar tu elección. Intenta de nuevo.");
    }
    setEnviando(false);
  }

  async function avisar(avisoId: string | null) {
    const res = await fetch("/api/invierte-v2/avisar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avisoId }) }).catch(() => null);
    if (res?.ok) setAvisado(true); else setError("No pudimos guardar tu aviso. Intenta de nuevo.");
  }

  const linea = <p className="iv2-linea-chica" data-inv2="linea-tope">{lineaTope(p.tope, fmtUF)}</p>;
  const conPre = p.tope.fuente === "preaprobacion" || p.tope.fuente === "aprobada";

  // ── CASO 2: no le alcanza ninguno ──
  if (p.caso === "caso2") {
    const z = p.masBaratoUF;
    const pq = z ? porQueNoAlcanza(z, tope, p.pieUF) : null;
    const pesaPie = pq?.motivo === "pie" || (pq?.motivo === "pie_y_credito" && tope.limita === "pie");
    const cerca = estaCerca(p.tope.topeUF, z);
    const titulo = pq && !pesaPie ? R.caso2.tituloCredito(cerca) : R.caso2.tituloPie(fmtUF(pq?.faltaPieUF ?? 0), cerca);
    const cuerpo = pq && !pesaPie && pq.creditoUF != null
      ? R.caso2.cuerpoCredito(fmtUF(pq.creditoUF), fmtUF(p.tope.topeUF), z ? fmtUF(z) : "—")
      : R.caso2.cuerpoPie(fmtUF(p.pieUF ?? 0), fmtUF(p.tope.topeUF), z ? fmtUF(z) : "—");
    const segunda = pq?.motivo === "pie_y_credito" ? (pesaPie && pq.creditoUF != null ? R.caso2.segundaCredito(fmtUF(pq.creditoUF)) : R.caso2.segundaPie(fmtUF(pq.faltaPieUF))) : null;
    const nota = pq?.motivo === "pie_y_credito" ? R.caso2.notaAmbas : pesaPie ? (p.tope.fuente === "solo_pie" ? R.caso2.notaPieSinRenta : R.caso2.notaPieRentaOk) : R.caso2.notaCredito;
    return (
      <div className="iv2-resultado" data-inv2="caso2">
        <div className="iv2-res-izq">
          <div className="inv-encabezado">
            <span className="iv2-tarjeta-et">{R.rotulo}</span>
            <h1 className="iv2-titulo-res" id="iv2-t">{titulo}</h1>
            <p className="inv-parrafo">{cuerpo}{segunda ? ` ${segunda}` : ""}</p>
            <p className="iv2-linea-chica">{nota}</p>
          </div>
          {error && <p className="inv-error" role="alert">{error}</p>}
          <div className="iv2-acciones">
            {avisado ? <p className="iv2-guardada" data-inv2="avisado">{R.caso2.avisado}</p> : (
              <button type="button" className="inv-principal" onClick={() => avisar(null)} data-inv2="avisar">{R.caso2.avisar}</button>
            )}
            <a href={URL_PERFIL_INV} className="iv2-secundario" data-inv2="actualizar">{R.caso2.actualizar}</a>
          </div>
        </div>
      </div>
    );
  }

  // ── CASO 1: el suyo no le alcanza, otros sí (antes de abrir la elección) ──
  if (p.caso === "caso1" && !abrirEleccion && entrada) {
    const pq = porQueNoAlcanza(entrada.precioUF, tope, p.pieUF);
    const precio = fmtUF(entrada.precioUF);
    const sub = !pq ? "" : pq.motivo === "pie" ? R.caso1.pie(precio, fmtUF(pq.faltaPieUF))
      : pq.motivo === "credito" ? R.caso1.credito(precio, fmtUF(pq.creditoUF ?? 0), conPre)
      : R.caso1.pieYCredito(precio, fmtUF(pq.faltaPieUF), fmtUF(pq.creditoUF ?? 0), tope.limita === "pie", conPre);
    const otros = vivas.filter((o) => !o.esEntrada);
    return (
      <div className="iv2-resultado" data-inv2="caso1">
        <div className="iv2-res-izq">
          <div className="inv-encabezado">
            <span className="iv2-tarjeta-et">{R.rotulo}</span>
            <h1 className="iv2-titulo-res" id="iv2-t">{R.caso1.titulo(entrada.comuna)}</h1>
            <p className="inv-parrafo" data-inv2="caso1-motivo">{sub}</p>
            {linea}
          </div>
          <section className="iv2-tarjeta" aria-labelledby="iv2-si-t">
            <h2 className="iv2-tarjeta-et" id="iv2-si-t">{R.caso1.siAlcanza}</h2>
            <p className="iv2-linea-chica">{R.caso1.siAlcanzaLinea(otros.length)}</p>
            <ul className="iv2-mini-lista">
              {otros.slice(0, 2).map((o) => (
                <li key={o.avisoId}><div><p className="iv2-paso-t">{nombreDepto(o)}</p><p className="iv2-paso-s">UF {fmtUF(o.precioUF)} · pie UF {fmtUF(pieDe(o.precioUF))}</p></div><Chip o={o} /></li>
              ))}
            </ul>
          </section>
          {error && <p className="inv-error" role="alert">{error}</p>}
          <div className="iv2-acciones">
            <button type="button" className="inv-principal" onClick={() => setAbrirEleccion(true)} data-inv2="seguir-alcanzan">{R.caso1.seguir}</button>
            {avisado ? <p className="iv2-guardada" data-inv2="avisado">{R.caso2.avisado}</p> : (
              <button type="button" className="iv2-secundario" onClick={() => avisar(entrada.avisoId)} data-inv2="avisar-entrada">{R.caso1.avisar(entrada.comuna)}</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── LA ELECCIÓN (el suyo le alcanza, o el caso 1 abierto) ──
  const listaOpciones = p.caso === "caso1" ? vivas : p.opciones;
  const titulo = p.caso === "alcanza" && entrada ? R.alcanza(entrada.comuna, vivas.filter((o) => !o.esEntrada).length) : R.sinEntrada(vivas.length);
  const mejor = (val: (o: OpcionDepto) => number | null, menor: boolean) => {
    const xs = vivas.map(val).filter((x): x is number => x != null);
    return xs.length ? (menor ? Math.min(...xs) : Math.max(...xs)) : null;
  };
  const mejorPones = mejor((o) => o.flujoCLP, false);
  const mejorArriendo = mejor((o) => o.arriendoCLP, false);
  const mejorPar = mejor((o) => o.vsParecidosPct, true);
  const mejorMetro = mejor((o) => o.metro?.metros ?? null, true);
  const mejorScore = mejor((o) => o.score, false);
  const mejorPrecio = mejor((o) => o.precioUF, true);
  const cls = (v: number | null, m: number | null) => (v != null && m != null && v === m ? "iv2-mejor" : undefined);
  const porPlata = p.objetivo === "arriendo" || p.preocupaciones.includes("poner_plata") || p.preocupaciones.includes("no_arriende");

  const filas: { clave: string; rotulo: string; importa?: boolean; celda: (o: OpcionDepto) => { t: React.ReactNode; c?: string } }[] = [
    { clave: "veredicto", rotulo: R.filas.veredicto, celda: (o) => ({ t: <Chip o={o} />, c: cls(o.score, mejorScore) }) },
    { clave: "precio", rotulo: R.filas.precio, celda: (o) => ({ t: `UF ${fmtUF(o.precioUF)}`, c: cls(o.precioUF, mejorPrecio) }) },
    { clave: "pie", rotulo: R.filas.pie, celda: (o) => ({ t: `UF ${fmtUF(pieDe(o.precioUF))}` }) },
    { clave: "alcanza", rotulo: R.filas.alcanza, celda: (o) => ({ t: o.alcanza ? R.si : R.no }) },
    { clave: "pones", rotulo: R.filas.pones, importa: porPlata, celda: (o) => { const m = textoAlMes(o); return { t: m.pones ? <span className="iv2-pones" data-inv2="pones">{m.t}</span> : m.t, c: cls(o.flujoCLP, mejorPones) }; } },
    { clave: "arriendo", rotulo: R.filas.arriendo, celda: (o) => ({ t: o.arriendoCLP ? fmtCLP(o.arriendoCLP) : "—", c: cls(o.arriendoCLP, mejorArriendo) }) },
    { clave: "parecidos", rotulo: R.filas.parecidos, importa: p.objetivo === "plusvalia", celda: (o) => ({ t: textoVsParecidos(o.vsParecidosPct), c: cls(o.vsParecidosPct, mejorPar) }) },
    { clave: "metro", rotulo: R.filas.metro, celda: (o) => ({ t: textoMetro(o.metro), c: cls(o.metro?.metros ?? null, mejorMetro) }) },
  ];

  const lecturaBloque = lectura.destacado ? (
    <section className="iv2-porque iv2-lectura" aria-labelledby="iv2-lec-t" data-inv2="lectura">
      <h2 className="iv2-tarjeta-et" id="iv2-lec-t">{R.lecturaRotulo}</h2>
      <p>{lectura.intro} <b>{lectura.destacado}</b>{lectura.resto}</p>
    </section>
  ) : null;

  const tabla = (claseExtra: string) => (
    <div className={`iv2-tabla-envoltura ${claseExtra}`}>
      <table className="iv2-tabla" data-inv2="tabla">
        <thead>
          <tr>
            <th scope="col"><span className="iv2-sr">Fila</span></th>
            {listaOpciones.map((o) => (
              <th scope="col" key={o.avisoId}>
                <span className="iv2-tabla-comuna">{o.comuna}</span>
                <span className="iv2-tabla-sub">{o.m2 ? `${Math.round(o.m2)} m²` : ""}{o.esEntrada ? " · el que elegiste" : ""}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.clave} data-importa={f.importa ? "1" : undefined}>
              <th scope="row">{f.rotulo}{f.importa ? <span className="iv2-importa">{R.loQueMasImporta}</span> : null}</th>
              {listaOpciones.map((o) => { const c = f.celda(o); return <td key={o.avisoId} className={c.c}>{c.t}</td>; })}
            </tr>
          ))}
          <tr>
            <th scope="row">{R.filas.sigo}</th>
            {listaOpciones.map((o) => (
              <td key={o.avisoId}><label className="iv2-check-celda"><input type="checkbox" className="iv2-check" aria-label={`${R.filas.sigo}: ${nombreDepto(o)}`} checked={marcados.has(o.avisoId)} disabled={!o.alcanza} onChange={() => toggle(o.avisoId)} data-inv2="check-tabla" /></label></td>
            ))}
          </tr>
          <tr>
            <th scope="row">{R.filas.detalle}</th>
            {listaOpciones.map((o) => (
              <td key={o.avisoId}><button type="button" className="iv2-enlace-azul" onClick={() => verDetalles(o)} disabled={!!abriendo} data-inv2="ver-detalles">{abriendo === o.avisoId ? "Abriendo…" : R.verDetalles}</button></td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="iv2-linea-chica iv2-nota-tabla">{R.notaTabla} {R.notaTablaPie}</p>
    </div>
  );

  return (
    <div className="iv2-resultado iv2-resultado-eleccion" data-inv2="eleccion">
      {abriendo && <CargandoDetalles />}
      <div className="iv2-res-izq">
        <div className="inv-encabezado">
          <h1 className="iv2-titulo-res" id="iv2-t">{titulo}</h1>
          {linea}
        </div>
        <div className="inv-encabezado">
          <h2 className="iv2-pregunta">{R.pregunta}</h2>
          <p className="iv2-linea-chica">{R.preguntaLinea}</p>
        </div>
        <div className="iv2-solo-movil-res">
          <div className="iv2-vistas" role="tablist" aria-label="Vista">
            <button type="button" role="tab" aria-selected={vista === "lista"} className="iv2-chip-op" onClick={() => setVista("lista")} data-inv2="vista-lista">{R.lista}</button>
            <button type="button" role="tab" aria-selected={vista === "comparar"} className="iv2-chip-op" onClick={() => setVista("comparar")} data-inv2="vista-comparar">{R.comparar}</button>
          </div>
          {vista === "lista" ? (
            <ul className="iv2-opciones" data-inv2="lista">
              {listaOpciones.map((o) => (
                <li key={o.avisoId}>
                  <label className="iv2-opcion" data-marcado={marcados.has(o.avisoId) ? "1" : undefined} data-alcanza={o.alcanza ? "1" : undefined}>
                    <input type="checkbox" className="iv2-check" checked={marcados.has(o.avisoId)} disabled={!o.alcanza} onChange={() => toggle(o.avisoId)} data-inv2="check" />
                    <span className="iv2-opcion-cuerpo">
                      <span className="iv2-opcion-fila"><span className="iv2-opcion-t">{nombreDepto(o)}</span><Chip o={o} /></span>
                      <span className="iv2-linea-chica">UF {fmtUF(o.precioUF)}</span>
                      <span className="iv2-opcion-et" data-inv2="etiqueta">{o.alcanza ? textoEtiqueta(p.etiquetas[o.avisoId] ?? "tambien_conviene", o) : "Fuera de tu alcance hoy"}</span>
                    </span>
                  </label>
                  <button type="button" className="iv2-enlace-azul iv2-opcion-ver" onClick={() => verDetalles(o)} disabled={!!abriendo} data-inv2="ver-detalles">{abriendo === o.avisoId ? "Abriendo…" : R.verDetalles}</button>
                </li>
              ))}
            </ul>
          ) : (
            <>
              {R.compararAviso(listaOpciones.length) && <p className="iv2-linea-chica">{R.compararAviso(listaOpciones.length)}</p>}
              {tabla("iv2-tabla-movil")}
              {lecturaBloque}
            </>
          )}
        </div>
        {error && <p className="inv-error" role="alert">{error}</p>}
        <div className="iv2-acciones iv2-acciones-res">
          <button type="button" className="inv-principal" onClick={seguir} disabled={enviando || !marcados.size} {...botonOcupado(enviando)} data-inv2="seguir">{enviando ? "Guardando…" : R.seguir(marcados.size || 1)}</button>
        </div>
        <div className="iv2-solo-pc-res">{lecturaBloque}</div>
      </div>
      <div className="iv2-res-der iv2-solo-pc-res">
        {R.compararAvisoPc(listaOpciones.length) && <p className="iv2-linea-chica" data-inv2="desliza-pc">{R.compararAvisoPc(listaOpciones.length)}</p>}
        {tabla("iv2-tabla-pc")}
      </div>
      {listaOpciones.length === 0 && <Fragment />}
      <span className="iv2-sr" aria-live="polite">{comunasEnFrase(p.comunas)}</span>
    </div>
  );
}
