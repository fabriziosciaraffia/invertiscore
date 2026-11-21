// ─────────────────────────────────────────────────────────────────────────────
// LA PÁGINA DE UN DEPTO (etapa 3, B1, 21-nov-2026; láminas 4.1-confirmando, 4.1-no-avanza y 4.2-pagina-del-depto y -pc). La misma de
// principio a fin; solo cambia «Lo que sigue», con un único botón (rojo solo cuando le toca a la persona). En B1: confirmando, sin
// preaprobación y listo (todavía sin oferta ni visita), y «no avanza», que cambia la página entera. La ubicación se dice aproximada
// hasta que Franco la confirma con quien vende. «Pregúntale a Franco» abre WhatsApp con el depto ya escrito. Sin enlace al portal.
// Lo que viene en las entregas siguientes no se dibuja todavía: oferta y visita (B3-B5), el camino en tres hitos (B6), «Lo que Franco
// averiguó» y los documentos (B2), «No sigo» (B7). Sin "use client": la usan la página y /dev/invierte-v2/depto.
// ─────────────────────────────────────────────────────────────────────────────
import Link from "next/link";
import { ChipVeredicto } from "@/components/analysis/shared/ChipVeredicto";
import type { Veredicto } from "@/lib/types";
import { fmtUF } from "@/lib/invierte-v2/opciones";
import { lineaDepto, urlWhatsapp } from "@/lib/invierte-v2/base";
import { DEPTO_COPY as D, loQueSigue } from "@/lib/invierte-v2/depto-flujo";
import { URL_OPCIONES } from "@/lib/invierte-v2/destino";
import { URL_PREAPROBACION } from "@/lib/invierte-v2/preaprobacion";
import type { PaginaDepto } from "@/lib/invierte-v2/depto-pagina-servidor";
import { BotonDetalles } from "./BotonDetalles";
import { FotosDepto } from "./FotosDepto";
import { FotoPortada } from "./TarjetaDepto";
import { IconoWhatsapp } from "./IconoWhatsapp";
import { SumarDepto } from "./SumarDepto";

function Cabeza({ p }: { p: PaginaDepto }) {
  const v = p.datos.veredicto as Veredicto | null | undefined;
  return (
    <div className="iv2-dp-cabeza" data-inv2="depto-cabeza">
      <FotosDepto avisoId={p.avisoId} n={p.ficha?.fotos ?? 0} clase="iv2-dp-fotos" />
      <div className="iv2-dp-info">
        <div className="iv2-dp-fila">
          <h1 className="iv2-dp-t" id="iv2-t" data-inv2="titulo-depto">{p.tituloConNumero}</h1>
          {v && <ChipVeredicto v={v} puntaje={v === "COMPRAR" ? p.datos.score ?? null : null} />}
        </div>
        <p className="iv2-depto-s">{lineaDepto(p.datos)}</p>
        <div className="iv2-dp-fila iv2-dp-precio">
          <span className="iv2-depto-s">{p.datos.precioUF ? D.publicado(fmtUF(p.datos.precioUF)) : ""}</span>
          <BotonDetalles avisoId={p.avisoId} etiqueta={D.verDetalles} clase="iv2-enlace-azul iv2-dp-detalles" />
        </div>
        {/* Antes del contacto con quien vende, la ubicación es la de la publicación (decisión de Fabrizio, 20-nov-2026). */}
        {!p.ubicacion && <p className="iv2-dp-aprox" data-inv2="ubicacion-aproximada">{D.ubicacionAproximada}</p>}
      </div>
    </div>
  );
}

function LoQueSigueBloque({ p }: { p: PaginaDepto }) {
  const s = loQueSigue(p.etapa, p.preaprobacion, URL_PREAPROBACION);
  if (!s) return null;
  return (
    <section className="iv2-dp-sigue" aria-labelledby="iv2-sigue-t" data-inv2="lo-que-sigue" data-etapa={p.etapa}>
      <div className="iv2-dp-sigue-cab">
        <span className="iv2-dp-rotulo">{D.loQueSigue}</span>
        <span className={s.tono === "ciruela" ? "iv2-estado-ciruela" : "iv2-estado-gris"} data-inv2="sigue-chip">{s.chip}</span>
      </div>
      <h2 className="iv2-dp-sigue-t" id="iv2-sigue-t">{s.titulo}</h2>
      {s.texto && <p className="iv2-dp-sigue-txt">{s.texto}</p>}
      {s.boton && <Link href={s.boton.href} className="inv-principal" data-inv2="sigue-boton">{s.boton.texto}</Link>}
    </section>
  );
}

function Cambios({ p }: { p: PaginaDepto }) {
  if (!p.cambios.length) return null;
  return (
    <section className="iv2-dp-sec" aria-labelledby="iv2-cambios-t" data-inv2="cambios-publicacion">
      <h2 className="iv2-dp-h2" id="iv2-cambios-t">{D.cambiosT}</h2>
      <ul className="iv2-dp-filas">{p.cambios.map((c, i) => <li key={i} className="iv2-dp-fila-item">{c}</li>)}</ul>
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
            <FotoPortada avisoId={a.avisoId} n={a.ficha?.fotos ?? 0} clase="iv2-dp-alt-foto" />
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
    <div className="iv2-dp" data-etapa={p.etapa}>
      <div className="iv2-dp-izq">
        <Cabeza p={p} />
        <LoQueSigueBloque p={p} />
      </div>
      <div className="iv2-dp-der">
        <Cambios p={p} />
        <Preguntale p={p} />
      </div>
    </div>
  );
}
