// ─────────────────────────────────────────────────────────────────────────────
// LO QUE DIBUJA LA BASE (etapa 2, entrega 2, 19-nov-2026; láminas 3.3-base y 3.3-base-pc). Sus deptos elegidos (cada uno con su
// veredicto, lo que cambió en su publicación, lo que deja o pide al mes; la tarjeta entera abre los detalles, sin créditos), las otras opciones
// que convienen con «Seguir con este», «Comparar todas», «Buscar otro en el mapa» y «Escribirle». Perfil, documentos y preguntas
// van en el menú (hoja en el celular; en el PC, la columna derecha). No se construyen en esta etapa: la barra de cuatro tramos y
// el paso de cada depto, ni «Lo que te toca hoy» (espera a la preaprobación, etapa 3). Sin "use client": la usan la página y
// /dev/invierte-v2/base.
// ─────────────────────────────────────────────────────────────────────────────
import Link from "next/link";
import { ChipVeredicto } from "@/components/analysis/shared/ChipVeredicto";
import type { Veredicto } from "@/lib/types";
import { URL_OPCIONES } from "@/lib/invierte-v2/destino";
import { RESULTADO_COPY, fmtUF, textoAlMes } from "@/lib/invierte-v2/opciones";
import { BASE_COPY, MENU_COPY, lineaDepto, urlWhatsapp } from "@/lib/invierte-v2/base";
import type { Base } from "@/lib/invierte-v2/base-servidor";
import { etiquetaVeredicto, signoVeredicto } from "@/lib/veredicto-etiqueta";
import { PrepararDetalles, TarjetaDetalles } from "./BotonDetalles";
import { EnlacesBase, MenuBase } from "./MenuBase";
import { SumarDepto } from "./SumarDepto";
import { IconoWhatsapp } from "./IconoWhatsapp";
import { TE_TOCA_ROTULO, URL_PREAPROBACION, teTocaHoy } from "@/lib/invierte-v2/preaprobacion";


const B = BASE_COPY;

/** «pones $120.500» es un monto negativo: va en rojo (regla del rojo, 18-nov-2026), también dentro de la línea de lo que cambió. */
export function ConMontoNegativo({ texto }: { texto: string }) {
  const partes = texto.split(/(pones \$[\d.]+)/);
  return <>{partes.map((x, i) => (i % 2 ? <span key={i} className="iv2-pones iv2-nowrap">{x}</span> : x))}</>;
}

export function VistaBase({ base }: { base: Base }) {
  const sinPreparar = base.elegidos.filter((d) => !d.preparado).map((d) => d.avisoId);
  const activos = base.elegidos.map((d) => ({ avisoId: d.avisoId, datos: d.datos }));
  const perfilLinea = MENU_COPY.perfilLinea(base.perfil?.topeUF ?? null, base.perfil?.comunas ?? []);
  // «Lo que te toca hoy» (entrega 3): solo cuando le toca a la persona; es la única acción principal (en rojo) de la base.
  const toca = teTocaHoy(base.preaprobacion);
  return (
    <>
      <PrepararDetalles avisoIds={sinPreparar} />
      <div className="iv2-base">
        <div className="iv2-base-izq">
          <div className="iv2-base-cab">
            <h1 className="iv2-titulo-res" id="iv2-t">{B.titulo}</h1>
            <span className="iv2-solo-movil-base"><MenuBase nombre={base.orden.nombre} perfilLinea={perfilLinea} whatsapp={base.whatsapp} /></span>
          </div>
          {toca && (
            <section className="iv2-toca" aria-labelledby="iv2-toca-t" data-inv2="te-toca-hoy">
              <p className="iv2-toca-et">{TE_TOCA_ROTULO}</p>
              <div className="iv2-toca-fila">
                <h2 className="iv2-toca-t" id="iv2-toca-t">{toca.titulo}</h2>
                <Link href={URL_PREAPROBACION} className="inv-principal" data-inv2="te-toca-boton">{toca.boton}</Link>
              </div>
            </section>
          )}
          <section aria-labelledby="iv2-tus-t" data-inv2="tus-deptos" className="iv2-base-sec">
            <div className="iv2-base-sec-cab">
              <h2 className="iv2-base-h2" id="iv2-tus-t">{B.tusDeptos}</h2>
              <p className="iv2-linea-chica">{B.tusDeptosLinea(base.elegidos.length)}</p>
            </div>
            <ul className="iv2-deptos">
              {base.elegidos.map((d) => {
                const alMes = textoAlMes({ flujoCLP: d.datos.flujoCLP ?? null });
                return (
                  <li key={d.avisoId} className="iv2-depto-li" data-inv2="depto-base">
                    {/* La tarjeta entera abre los detalles, con la flecha a la derecha (20-nov-2026, decisión de Fabrizio). */}
                    <TarjetaDetalles avisoId={d.avisoId} etiqueta={B.abrirDepto(lineaDepto(d.datos))}>
                      <span className="iv2-depto-fila">
                        <span className="iv2-depto-id">
                          <span className="iv2-depto-t">{lineaDepto(d.datos)}</span>
                          <span className="iv2-depto-s">{d.datos.precioUF ? `UF ${fmtUF(d.datos.precioUF)}` : ""}{d.alcanza ? "" : ` · ${B.fueraDeAlcance}`}</span>
                        </span>
                        {d.datos.veredicto && <ChipVeredicto v={d.datos.veredicto as Veredicto} puntaje={d.datos.veredicto === "COMPRAR" ? d.datos.score ?? null : null} />}
                      </span>
                      {d.lineas.map((l, i) => <span key={i} className={i === 0 ? "iv2-cambio" : "iv2-cambio-sub"} data-inv2="cambio"><ConMontoNegativo texto={l} /></span>)}
                      {/* Si lo que cambió ya dice lo que deja al mes, la fila fija no lo repite. */}
                      {d.datos.flujoCLP != null && !d.alMesEnCambio && <span className="iv2-depto-s" data-inv2="base-al-mes">{RESULTADO_COPY.filas.pones}: <span className={alMes.pones ? "iv2-nowrap iv2-pones" : "iv2-nowrap"}>{alMes.t}</span></span>}
                      <span className="iv2-depto-fila">
                        <span className="iv2-estado-gris" data-inv2="estado-depto">{B.francoEnEso}</span>
                      </span>
                    </TarjetaDetalles>
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
                  <li key={o.avisoId} className="iv2-otra" data-inv2="otra">
                    <div className="iv2-depto-id">
                      <p className="iv2-depto-t">{lineaDepto(o.datos)}</p>
                      <p className="iv2-depto-s">{[o.datos.precioUF ? `UF ${fmtUF(o.datos.precioUF)}` : null, `${signoVeredicto("COMPRAR")} ${etiquetaVeredicto("COMPRAR", "frase")}${o.datos.score != null ? ` · ${o.datos.score}` : ""}`].filter(Boolean).join(" · ")}</p>
                    </div>
                    <SumarDepto avisoId={o.avisoId} etiqueta={B.seguirConEste} origen="base" activos={activos} variante="enlace" />
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
