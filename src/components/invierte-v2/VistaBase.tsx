// ─────────────────────────────────────────────────────────────────────────────
// LO QUE DIBUJA LA BASE (etapa 2, entrega 2, 19-nov-2026; láminas 3.3-base y 3.3-base-pc). Sus deptos elegidos (cada uno con su
// veredicto, lo que cambió en su publicación, lo que deja o pide al mes; la tarjeta entera abre los detalles, sin créditos), las otras opciones
// que convienen con «Seguir con este», «Comparar todas», «Buscar otro en el mapa» y «Escribirle». Perfil, documentos y preguntas
// van en el menú (hoja en el celular; en el PC, la columna derecha). No se construyen en esta etapa: la barra de cuatro tramos y
// el paso de cada depto, ni «Lo que te toca hoy» (espera a la preaprobación, etapa 3). Sin "use client": la usan la página y
// /dev/invierte-v2/base.
// ─────────────────────────────────────────────────────────────────────────────
import Link from "next/link";
import { URL_OPCIONES } from "@/lib/invierte-v2/destino";
import { BASE_COPY, MENU_COPY, lineaDepto, urlWhatsapp } from "@/lib/invierte-v2/base";
import type { Base } from "@/lib/invierte-v2/base-servidor";
import { BotonDetalles, PrepararDetalles } from "./BotonDetalles";
import { caminoDepto, estadoEnBase, urlDepto, type NivelBase } from "@/lib/invierte-v2/depto-flujo";

const NIVEL_CLASE: Record<NivelBase, string> = { tuyo: " iv2-depto-tuyo", curso: " iv2-depto-curso", partiendo: "" };
import { TarjetaBase, TarjetaOtra } from "./TarjetaDepto";
import { LupaFotos } from "./VisorFotos";
import { EnlacesBase, MenuBase } from "./MenuBase";
import { SumarDepto } from "./SumarDepto";
import { IconoWhatsapp } from "./IconoWhatsapp";
import { PREAPROB_COPY, TE_TOCA_COPY, TE_TOCA_ROTULO, URL_PREAPROBACION, lineaCapacidad, teTocaHoy } from "@/lib/invierte-v2/preaprobacion";
import { VerPreaprobacion } from "./Preaprobacion";


const B = BASE_COPY;

/** «pones $120.500» dentro de la línea de lo que cambió: sin partirse y en negro (24-nov-2026, Fabrizio: en Invierte el rojo es solo el
 *  botón principal; la palabra ya dice «pones»). */
export function ConMontoNegativo({ texto }: { texto: string }) {
  const partes = texto.split(/(pones \$[\d.]+)/);
  return <>{partes.map((x, i) => (i % 2 ? <span key={i} className="iv2-nowrap">{x}</span> : x))}</>;
}

export function VistaBase({ base }: { base: Base }) {
  const sinPreparar = base.elegidos.filter((d) => !d.preparado).map((d) => d.avisoId);
  const activos = base.elegidos.map((d) => ({ avisoId: d.avisoId, datos: d.datos }));
  const perfilLinea = MENU_COPY.perfilLinea(base.perfil?.topeUF ?? null, base.perfil?.comunas ?? []);
  // «Lo que te toca hoy» (entrega 3; 20-nov-2026): por subir, en revisión (cada vez que sube una) o por corregir (con el motivo).
  const pd = base.preDetalle;
  const toca = teTocaHoy(base.preaprobacion, pd.otra, pd.motivo);
  // Bajo el título, hasta cuánto puede comprar (20-nov-2026): según la preaprobación aprobada, o la estimación.
  const aprobada = base.preaprobacion === "aprobada";
  const capacidad = lineaCapacidad({ topeUF: base.perfil?.topeUF ?? null, aprobada: aprobada ? { banco: pd.banco, vigenteHasta: pd.vigenteHasta } : null });
  return (
    <>
      <PrepararDetalles avisoIds={sinPreparar} />
      <div className="iv2-base">
        <div className="iv2-base-izq">
          <div className="iv2-base-cab">
            <h1 className="iv2-titulo-res" id="iv2-t">{B.titulo}</h1>
            <span className="iv2-solo-movil-base"><MenuBase nombre={base.orden.nombre} perfilLinea={perfilLinea} whatsapp={base.whatsapp} /></span>
          </div>
          {capacidad && (
            <p className="iv2-linea-chica iv2-base-capacidad" data-inv2="capacidad">
              {capacidad}
              {aprobada && <> <VerPreaprobacion etiqueta={B.ver} estado="Aprobada" titulo={PREAPROB_COPY.cabecera} meta={capacidad} mime={pd.mime} /></>}
            </p>
          )}
          {toca && (
            <section className="iv2-toca" aria-labelledby="iv2-toca-t" data-inv2="te-toca-hoy" data-tipo={toca.tipo}>
              <p className="iv2-toca-et">{TE_TOCA_ROTULO}</p>
              {toca.tipo !== "subir" && <span className={toca.tipo === "corregir" ? "iv2-estado-ciruela iv2-toca-chip" : "iv2-estado-gris iv2-toca-chip"} data-inv2="te-toca-chip">{toca.chip}</span>}
              <div className="iv2-toca-fila">
                <h2 className="iv2-toca-t" id="iv2-toca-t">{toca.titulo}</h2>
                {toca.tipo === "subir" && <Link href={URL_PREAPROBACION} className="inv-principal" data-inv2="te-toca-boton">{toca.boton}</Link>}
              </div>
              {toca.tipo === "revision" && (
                <div className="iv2-toca-revision">
                  <p className="iv2-linea-chica" data-inv2="te-toca-linea">{toca.linea}</p>
                  <VerPreaprobacion etiqueta={toca.ver} estado={null} titulo={PREAPROB_COPY.cabecera} meta={toca.linea} mime={pd.otra?.estado === "en_revision" ? pd.otra.mime : pd.mime} ultima />
                </div>
              )}
              {toca.tipo === "corregir" && (
                <>
                  {toca.motivo && <p className="iv2-msj-franco" data-inv2="te-toca-motivo"><span className="iv2-msj-franco-de">{TE_TOCA_COPY.mensajeDeFranco}</span>{toca.motivo}</p>}
                  <Link href={`${URL_PREAPROBACION}?subir=1`} className="inv-principal" data-inv2="te-toca-boton">{toca.boton}</Link>
                </>
              )}
            </section>
          )}
          <section aria-labelledby="iv2-tus-t" data-inv2="tus-deptos" className="iv2-base-sec">
            <div className="iv2-base-sec-cab">
              <h2 className="iv2-base-h2" id="iv2-tus-t">{B.tusDeptos}</h2>
              <p className="iv2-linea-chica">{B.tusDeptosLinea(base.elegidos.length)}</p>
            </div>
            <ul className="iv2-deptos">
              {/* Una tarjeta por fila (etapa 3, parte A; lámina 3.3-base). La tarjeta entera se toca: hoy abre los detalles; cuando exista la
                  página de cada depto (parte B), esa página. Lo que cambió en la publicación pasa a esa página (lámina 4.2). */}
              {base.elegidos.map((d) => {
                const estado = estadoEnBase(d.etapa, base.preaprobacion, d.noAvanzaMotivo, d.oferta);
                // Tres niveles (segunda vuelta, 23-nov, lámina 3.3): «Te toca a ti» se levanta (sombra fuerte, borde oscuro, pulso); «En curso
                // con Franco», borde oscuro y sombra suave; «Recién partiendo», plana. El camino chico sale de caminoDepto, como la página.
                return (
                  <li key={d.avisoId} className="iv2-depto-li" data-inv2="depto-base" data-nivel={estado.nivel} data-tuyo={estado.nivel === "tuyo" ? "si" : undefined}>
                    {/* La tarjeta entera abre la página del depto (etapa 3, B1; lámina 3.3-base) y dice en qué va. */}
                    <Link href={urlDepto(d.avisoId)} className={`iv2-depto iv2-depto-tocable${NIVEL_CLASE[estado.nivel]}`} aria-label={B.abrirDepto(d.ficha?.titulo ?? lineaDepto(d.datos))} data-inv2="abrir-depto">
                      <span className="iv2-depto-cuerpo">
                        <TarjetaBase avisoId={d.avisoId} datos={d.datos} ficha={d.ficha} numeroConfirmado={d.numeroConfirmado} alcanza={d.alcanza} estado={estado} camino={caminoDepto(d.etapa, d.oferta)} />
                      </span>
                    </Link>
                    {/* La lupa abre el visor; va AL LADO del enlace (no adentro), sobre la esquina de la foto: tocarla no navega al depto. */}
                    <LupaFotos avisoId={d.avisoId} n={d.ficha?.fotos ?? 0} titulo={d.ficha?.titulo ?? null} clase="iv2-lupa-base" />
                  </li>
                );
              })}
            </ul>
          </section>
          <div className="iv2-acompana iv2-solo-movil-base" data-inv2="acompana">
            <span>{B.acompana}</span>
            {base.whatsapp && <a href={urlWhatsapp(base.whatsapp)} target="_blank" rel="noopener noreferrer" className="iv2-enlace-azul iv2-con-icono" data-inv2="escribirle"><IconoWhatsapp />{B.escribirle}</a>}
          </div>
        </div>
        <div className="iv2-base-der">
          {base.otras.length > 0 && (
            <section aria-labelledby="iv2-otras-t" data-inv2="otras-opciones" className="iv2-base-sec">
              <h2 className="iv2-base-h3" id="iv2-otras-t">{B.otras(base.otras.length)}</h2>
              <ul className="iv2-otras">
                {base.otras.map((o) => (
                  <li key={o.avisoId} className="iv2-otra-li">
                    <TarjetaOtra avisoId={o.avisoId} datos={o.datos} ficha={o.ficha} acciones={<>
                      <BotonDetalles avisoId={o.avisoId} etiqueta={B.verDetalles} clase="iv2-enlace-azul iv2-otra-accion" />
                      <SumarDepto avisoId={o.avisoId} etiqueta={B.seguirConEste} origen="base" activos={activos} variante="enlace" />
                    </>} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="iv2-base-enlaces">
            <Link href={URL_OPCIONES} className="iv2-enlace-azul" data-inv2="comparar-todas">{B.compararTodas}</Link>
            <Link href="/explorar" className="iv2-enlace-azul" data-inv2="buscar-mapa">{B.buscarEnMapa}</Link>
          </div>
          <div className="iv2-solo-pc-base"><EnlacesBase whatsapp={base.whatsapp} /></div>
        </div>
      </div>
    </>
  );
}
