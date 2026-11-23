// ─────────────────────────────────────────────────────────────────────────────
// LA PÁGINA DE UN DEPTO, COMO TABLERO (etapa 3; rediseño del 23-nov-2026, láminas 4.2, 4.2-pc y 4.2-estados, y su LEEME). Orden: quién
// es el depto (foto, dirección con número si la ubicación está confirmada, cifras y el mapa chico), la acción que toca en la única
// tarjeta con sombra (solo cuando le toca a la persona; si lo lleva Franco, plana y sin botón), el camino completo con el paso actual
// marcado (ciruela si le toca a la persona, negro si lo lleva Franco), y cada tema en su tarjeta con encabezado y contador: lo que
// Franco averiguó (lo respondido primero), los cambios de la publicación y los documentos. Sale la tarjeta «Oferta · Sin presentar»:
// la oferta y la visita son pasos del camino. En PC el camino va arriba en una línea, «Lo que sigue» a la izquierda y lo averiguado a
// la derecha. «Pregúntale a Franco» abre WhatsApp con el depto ya escrito. Sin enlace al portal. La visita (B5) y «No sigo» (B7) no se
// dibujan todavía. Sin "use client": la usan la página y /dev/invierte-v2/depto.
// ─────────────────────────────────────────────────────────────────────────────
import Link from "next/link";
import { ChipVeredicto } from "@/components/analysis/shared/ChipVeredicto";
import type { Veredicto } from "@/lib/types";
import { fmtUF } from "@/lib/invierte-v2/opciones";
import { lineaDepto, urlWhatsapp } from "@/lib/invierte-v2/base";
import { AVERIGUO_COPY as AV, DEPTO_COPY as D, caminoDepto, conDocumentos, cuadrasMetro, diaMes, loQueSigue, metaPregunta, preguntasOrdenadas, urlOferta } from "@/lib/invierte-v2/depto-flujo";
import { OFERTA_COPY, fuerteDesde } from "@/lib/invierte-v2/rango";
import { MAPA_DEPTO, puntoValido, urlMapaDepto } from "@/lib/invierte-v2/mapa-depto";
import { VerTexto } from "./VerTexto";
import { URL_OPCIONES } from "@/lib/invierte-v2/destino";
import { URL_PREAPROBACION } from "@/lib/invierte-v2/preaprobacion";
import type { PaginaDepto } from "@/lib/invierte-v2/depto-pagina-servidor";
import { BotonDetalles } from "./BotonDetalles";
import { FotosDepto } from "./FotosDepto";
import { FotoPortada } from "./TarjetaDepto";
import { IconoWhatsapp } from "./IconoWhatsapp";
import { SumarDepto } from "./SumarDepto";
import { BarraRango } from "./BarraRango";
import { MapaDepto } from "./MapaDepto";
import { LoQueVeFrancoDepto } from "./LoQueVeFrancoDepto";
import { CuatroCifras, CifrasAOtroPrecio } from "./CuatroCifras";
import { CIFRAS_COPY } from "@/lib/invierte-v2/cifras";


function Cabeza({ p }: { p: PaginaDepto }) {
  const v = p.datos.veredicto as Veredicto | null | undefined;
  const metro = p.ficha?.metro && p.ficha.metro.metros <= 1000 ? `Metro ${p.ficha.metro.estacion.replace(/^(Estación|Metro)\s+/i, "")}` : null;
  const sub = p.direccion ? [metro, lineaDepto(p.datos)].filter(Boolean).join(" · ") : lineaDepto(p.datos);
  const punto = p.ubicacion ? { lat: p.ubicacion.lat, lng: p.ubicacion.lng } : p.ficha?.punto ?? null;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const ajustar = v === "AJUSTA SUPUESTOS";
  const chico = puntoValido(punto) && key ? urlMapaDepto(punto, key, MAPA_DEPTO.chico, ajustar) : null;
  const grande = puntoValido(punto) && key ? urlMapaDepto(punto, key, MAPA_DEPTO.grande, ajustar) : null;
  return (
    <div className="iv2-dp-cabeza iv2-ficha" data-inv2="depto-cabeza">
      <FotosDepto avisoId={p.avisoId} n={p.ficha?.fotos ?? 0} clase="iv2-dp-fotos" titulo={[p.direccion ?? p.tituloConNumero, p.datos.comuna].filter(Boolean).join(" · ")} />
      <div className="iv2-dp-info">
        <div className="iv2-dp-fila">
          <div className="iv2-dp-id">
            <h1 className="iv2-dp-t" id="iv2-t" data-inv2="titulo-depto">{p.direccion ?? p.tituloConNumero}</h1>
            <p className="iv2-dp-sub">{sub}</p>
          </div>
          {v && <ChipVeredicto v={v} puntaje={v === "COMPRAR" ? p.datos.score ?? null : null} />}
        </div>
        {p.ficha && <CuatroCifras c={p.ficha.cifras} variante="ficha" />}
        {p.bloqueOferta && (
          <CifrasAOtroPrecio clave="cifras-oferta" a={p.bloqueOferta.a} publicado={p.bloqueOferta.publicado}
            titulo={p.bloqueOferta.tipo === "acordado" ? CIFRAS_COPY.acordado(p.bloqueOferta.a.precioUF) : CIFRAS_COPY.conOferta(p.bloqueOferta.a.precioUF)} />
        )}
        <BotonDetalles avisoId={p.avisoId} etiqueta={D.verDetallesDepto} clase="iv2-enlace-azul iv2-dp-detalles iv2-dp-solo-pc" />
      </div>
      <div className="iv2-dp-mapa-fila">
        <MapaDepto chico={chico} grande={grande} confirmada={!!p.ubicacion} linea={cuadrasMetro(p.ficha?.metro?.metros)} />
      </div>
      <BotonDetalles avisoId={p.avisoId} etiqueta={D.verDetallesDepto} clase="iv2-enlace-azul iv2-ficha-pie iv2-dp-solo-movil" />
    </div>
  );
}

function LoQueSigueBloque({ p }: { p: PaginaDepto }) {
  const o = p.oferta;
  const s = loQueSigue(p.etapa, p.preaprobacion, URL_PREAPROBACION, o ? { estado: o.estado, postura: o.postura, pisoUF: o.pisoUF, altoUF: o.altoUF, montoUF: o.montoUF, publicadoUF: o.publicadoUF, firmadaAt: o.firmadaAt } : null, urlOferta(p.avisoId));
  if (!s) return null;
  const tuyo = s.tono === "ciruela";
  return (
    <section className={`iv2-dp-sigue${tuyo ? " iv2-dp-sigue-tuyo" : ""}`} aria-labelledby="iv2-sigue-t" data-inv2="lo-que-sigue" data-etapa={p.etapa}>
      <div className="iv2-dp-sigue-cab">
        <span className="iv2-dp-rotulo">{D.loQueSigue}</span>
        <span className={tuyo ? "iv2-chip-tuyo" : "iv2-chip-franco"} data-inv2="sigue-chip">{tuyo && <i aria-hidden="true" />}{s.chip}</span>
      </div>
      <h2 className="iv2-dp-sigue-t" id="iv2-sigue-t">{s.titulo}</h2>
      {s.cifras && s.cifras.length > 0 && (
        <dl className="iv2-dp-sigue-cifras" data-inv2="sigue-cifras">
          {s.cifras.map((c) => <div key={c.et}><dt>{c.et}</dt><dd className={c.azul ? "iv2-dp-azul" : undefined}>{c.v}</dd></div>)}
        </dl>
      )}
      {s.texto && <p className="iv2-dp-sigue-txt">{s.texto}</p>}
      {s.barra && o && (
        <BarraRango chica pisoUF={o.pisoUF} altoUF={o.altoUF} publicadoUF={o.publicadoUF} fuerteUF={fuerteDesde(o.pisoUF, o.publicadoUF)} montoUF={o.recomendadoUF} etiqueta={OFERTA_COPY.recomendado(o.recomendadoUF)} />
      )}
      {s.boton && <Link href={s.boton.href} className="inv-principal" data-inv2="sigue-boton">{s.boton.texto}</Link>}
      {s.nota && <p className="iv2-dp-sigue-nota">{s.nota}</p>}
      {o?.estado === "firmada" && o.texto && <div className="iv2-dp-sigue-enlace"><VerTexto titulo="Oferta de compra" parrafos={o.texto.split("\n\n")} etiqueta={D.verMiOferta} /></div>}
    </section>
  );
}

/** El camino de este depto: los seis pasos con el actual marcado (en celular, en columna con su encabezado; en PC, en una línea). */
function Camino({ p }: { p: PaginaDepto }) {
  // La misma llamada que el camino chico de la base (VistaBase): el estado, el monto y si quedó en firme sin visitar.
  const c = caminoDepto(p.etapa, p.oferta ? { estado: p.oferta.estado, montoUF: p.oferta.montoUF, enFirmeComo: p.oferta.enFirmeComo ?? null } : null);
  return (
    <section className="iv2-dp-tj iv2-dp-camino" aria-labelledby="iv2-camino-t" data-inv2="camino-depto">
      <div className="iv2-dp-th iv2-dp-camino-th"><h2 className="iv2-dp-th-t" id="iv2-camino-t">{D.caminoT}</h2><span className="iv2-dp-th-n">{D.pasoDe(c.actual, c.pasos.length)}</span></div>
      <ol className="iv2-dp-pasos">
        {c.pasos.map((x) => (
          <li key={x.n} className={`iv2-dp-paso iv2-dp-paso-${x.estado}`} data-estado={x.estado} aria-current={x.estado === "tuyo" || x.estado === "franco" ? "step" : undefined}>
            <span className="iv2-dp-paso-ic" aria-hidden="true">{x.estado === "hecho" ? "✓" : x.n}</span>
            <span className="iv2-dp-paso-txt"><span className="iv2-dp-paso-t">{x.t}</span>{x.s && <span className="iv2-dp-paso-s iv2-dp-solo-movil-i">{x.s}</span>}{x.corto && <span className="iv2-dp-paso-s iv2-dp-solo-pc-i">{x.corto}</span>}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** «Lo que Franco averiguó»: lo respondido primero, con la respuesta a la vista; lo pendiente en gris, «Esperando respuesta». */
function Averiguo({ p }: { p: PaginaDepto }) {
  const vis = preguntasOrdenadas(p.preguntas);
  if (!vis.length) return null;
  const resp = vis.filter((q) => !!q.respuesta).length;
  return (
    <section className="iv2-dp-tj" aria-labelledby="iv2-averiguo-t" data-inv2="lo-que-averiguo">
      <div className="iv2-dp-th"><h2 className="iv2-dp-th-t" id="iv2-averiguo-t">{AV.titulo}</h2><span className="iv2-chip-li" data-inv2="respondidas">{D.respondidas(resp, vis.length)}</span></div>
      <ul className="iv2-dp-filas-t">
        {vis.map((q) => (
          <li key={q.id} className="iv2-dp-tr" data-respondida={q.respuesta ? "1" : undefined}>
            <span className={`iv2-dp-ic ${q.respuesta ? "iv2-dp-ic-ok" : "iv2-dp-ic-es"}`} aria-hidden="true">{q.respuesta ? "✓" : "…"}</span>
            <span className="iv2-dp-tr-txt">
              <span className="iv2-dp-q">{q.pregunta}</span>
              {q.respuesta ? <span className="iv2-dp-a">{q.respuesta}</span> : <span className="iv2-chip-franco iv2-dp-esperando">{D.esperando}</span>}
              {metaPregunta(q) && <span className="iv2-dp-tr-s">{metaPregunta(q)}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Cambios({ p }: { p: PaginaDepto }) {
  if (!p.cambiosFilas.length) return null;
  return (
    <section className="iv2-dp-tj" aria-labelledby="iv2-cambios-t" data-inv2="cambios-publicacion">
      <div className="iv2-dp-th"><h2 className="iv2-dp-th-t" id="iv2-cambios-t">{D.cambiosT}</h2><span className="iv2-dp-th-n">{p.cambiosFilas.length}</span></div>
      <ul className="iv2-dp-filas-t">
        {p.cambiosFilas.map((c, i) => (
          <li key={i} className="iv2-dp-tr">
            <span className="iv2-dp-ic iv2-dp-ic-cambio" aria-hidden="true">{c.icono}</span>
            <span className="iv2-dp-tr-txt"><span className="iv2-dp-q">{c.t}</span><span className="iv2-dp-tr-s">{c.s}</span></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** «Documentos de este depto»: desde que el depto está listo; la oferta firmada con su «Ver». */
function Documentos({ p }: { p: PaginaDepto }) {
  if (!conDocumentos(p.etapa)) return null;
  const oferta = p.oferta?.texto && p.oferta.firmadaAt ? p.oferta : null;
  const n = (oferta ? 1 : 0) + p.documentos.length;
  return (
    <section className="iv2-dp-tj" aria-labelledby="iv2-docs-t" data-inv2="documentos-depto">
      <div className="iv2-dp-th"><h2 className="iv2-dp-th-t" id="iv2-docs-t">{AV.documentosT}</h2><span className="iv2-dp-th-n">{n}</span></div>
      <ul className="iv2-dp-filas-t">
        {oferta && (
          <li className="iv2-dp-tr" data-inv2="doc-oferta">
            <span className="iv2-dp-tr-txt"><span className="iv2-dp-q">Oferta de compra</span><span className="iv2-dp-tr-s">Firmada el {diaMes(oferta.firmadaAt!)}</span></span>
            <VerTexto titulo="Oferta de compra" parrafos={oferta.texto!.split("\n\n")} />
          </li>
        )}
        {n === 0 && (
          <li className="iv2-dp-tr" data-inv2="sin-documentos">
            <span className="iv2-dp-tr-txt"><span className="iv2-dp-q iv2-dp-gris">{AV.sinDocumentosT}</span><span className="iv2-dp-tr-s">{AV.sinDocumentos}</span></span>
          </li>
        )}
      </ul>
    </section>
  );
}

function Preguntale({ p }: { p: PaginaDepto }) {
  if (!p.whatsapp) return null;
  return (
    <a href={urlWhatsapp(p.whatsapp, D.preguntaWhatsapp(p.tituloConNumero))} target="_blank" rel="noopener noreferrer" className="iv2-dp-preguntale" data-inv2="preguntale">
      <IconoWhatsapp />{D.preguntale}
    </a>
  );
}

function NoAvanza({ p }: { p: PaginaDepto }) {
  const a = p.alternativa;
  return (
    <div className="iv2-dp-noavanza" data-inv2="no-avanza">
      <h1 className="iv2-titulo-res" id="iv2-t">{D.noAvanzaT}</h1>
      <p className="inv-parrafo">{p.noAvanzaMotivo === "dejo_de_convenir" ? D.dejoDeConvenirLinea : D.noAvanzaLinea}</p>
      <p className="iv2-depto-s" data-inv2="no-avanza-depto">{[lineaDepto(p.datos), p.datos.precioUF ? `UF ${fmtUF(p.datos.precioUF)}` : null].filter(Boolean).join(" · ")}</p>
      {a && (
        <section className="iv2-dp-alt" aria-labelledby="iv2-alt-t" data-inv2="alternativa-no-avanza">
          <span className="iv2-dp-rotulo" id="iv2-alt-t">{D.alternativaRotulo}</span>
          <div className="iv2-dp-alt-cab">
            <FotoPortada avisoId={a.avisoId} n={a.ficha?.fotos ?? 0} clase="iv2-dp-alt-foto" lupa titulo={a.ficha?.titulo ?? null} />
            <div className="iv2-dp-alt-id">
              <p className="iv2-dp-alt-t" data-inv2="titulo-depto">{a.ficha?.titulo ?? lineaDepto(a.datos)}</p>
              <p className="iv2-depto-s">{lineaDepto(a.datos)}</p>
              {a.datos.veredicto && <span><ChipVeredicto v={a.datos.veredicto as Veredicto} puntaje={a.datos.veredicto === "COMPRAR" ? a.datos.score ?? null : null} /></span>}
              <p className="iv2-depto-s">{a.datos.precioUF ? `UF ${fmtUF(a.datos.precioUF)}` : ""}</p>
            </div>
          </div>
          <div className="iv2-dp-alt-acciones">
            {a.alcanza && <SumarDepto avisoId={a.avisoId} etiqueta={D.seguirConEste} origen="base" activos={p.activos} variante="secundario" />}
            <BotonDetalles avisoId={a.avisoId} etiqueta={D.verDetalles} clase="iv2-enlace-azul" />
          </div>
        </section>
      )}
      <div className="iv2-base-enlaces">
        <Link href={URL_OPCIONES} className="iv2-enlace-azul" data-inv2="ver-mis-opciones">{D.verMisOpciones}</Link>
        <Link href="/explorar" className="iv2-enlace-azul" data-inv2="buscar-mapa">{D.buscarEnMapa}</Link>
      </div>
    </div>
  );
}

export function VistaDepto({ p }: { p: PaginaDepto }) {
  if (p.etapa === "no_avanza") return <NoAvanza p={p} />;
  return (
    <div className="iv2-dp iv2-dp-tablero" data-etapa={p.etapa}>
      <Cabeza p={p} />
      <Camino p={p} />
      <div className="iv2-dp-izq">
        <LoQueSigueBloque p={p} />
        <div className="iv2-dp-bajo">
          <Cambios p={p} />
          <Documentos p={p} />
        </div>
      </div>
      <div className="iv2-dp-der">
        {/* Segunda vuelta (23-nov): en PC arriba de la columna derecha; en celular, después de la acción y antes del camino (CSS). */}
        <LoQueVeFrancoDepto avisoId={p.avisoId} lectura={p.ficha?.lectura ?? null} />
        <Averiguo p={p} />
        <Preguntale p={p} />
      </div>
    </div>
  );
}
