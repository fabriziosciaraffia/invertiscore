"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LA TARJETA DEL PIN (28-oct-2026, estado C de 5b-explorar-portal.html): chica, sobre el mapa. La imagen de la calle
// (etiqueta «Vista de la calle», nunca «el edificio») o, si no hay foto que cumpla, el mapa chico con el pin en la cuadra
// (lib/explorar/calle.ts); comuna · tipología · m² · Usado/Nuevo; el precio; veredicto y puntaje; el flujo mensual; cap rate
// y UF por m²; el corazón para guardar y «Analizar este», que abre el pop-up de siempre. Se desliza de lado entre los pines
// cercanos (los puntos de abajo). SIN «visto publicado», SIN «revisado con pie y plazo», SIN caja gris: lo fija el tier
// EXPLORAR-PORTAL.
// EN EL PC (30-oct-2026, recorrido real de Fabrizio): flechas ‹ › a los costados para pasar entre los cercanos, y también con
// las flechas del teclado. RECIÉN REGISTRADA desde un pin: la tarjeta de ese pin vuelve desbloqueada —las cifras pasan de
// borrosas a nítidas— con la banda «Listo, ya tienes tu cuenta…» y el botón «Analizar este · usa tu regalo»; el pop-up lo
// abre la persona, no se abre solo.
// FILTROS V2 Y «SI NEGOCIAS» (02-nov-2026, mockup 8, estado C): el veredicto es el chip de la casa (ChipVeredicto) con su puntaje
// y «al precio publicado». Un NEGOCIADO muestra los dos veredictos con sus chips —«Al precio publicado [Ajustar]» y «Si consigues
// UF 2.950 (−4,2 %) [✓ Comprar · 71]»— y el botón «Analizar a UF 2.950».
// COMPARTIR (02-nov-2026, goal «Compartir un depto desde Explorar»): junto al corazón, con y sin cuenta, el botón «Compartir»
// (explorar-cliente.tsx › compartir: la hoja del sistema en el teléfono, copiar el enlace en el PC).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { botonOcupado } from "@/lib/carga-global";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { GUIA } from "@/lib/guia/copy";
import { lineaDepto } from "@/lib/guia/linea-depto";
import { capRatePct, flujoTexto, pctUno, ufPorM2 } from "@/lib/explorar/explorar";
import { PORTAL_COPY, type PinMapa } from "@/lib/explorar/portal";
import { ImagenDepto, useCalle } from "@/components/guia/ImagenDepto";
import { YA_ANALIZADO } from "@/lib/guia/semanal-str";
import { ABIERTO_COPY, BORROSO } from "@/lib/explorar/abierto";
import { ChipVeredicto } from "@/components/analysis/shared/ChipVeredicto";
import { conCifrasNegociado, esNegociado, NEGOCIAR_COPY, type PinNegociado } from "@/lib/explorar/capa-negociar";
import { AL_PRECIO_PUBLICADO } from "@/lib/precio-publicado";
import type { Veredicto } from "@/lib/types";
import { COMPARTIR_COPY } from "@/lib/explorar/compartir";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

// La imagen del depto (la foto de la calle o el mapa chico, con su versión oscura) vive en components/guia/ImagenDepto.tsx:
// la comparten la lista y el pop-up de «Analizar este».
export { ImagenDepto, useCalle } from "@/components/guia/ImagenDepto";

/** El corazón: guardar el depto (aparece en el dashboard, en «Guardados»). De contorno gris y, guardado, relleno en tinta
 *  —el negro de los botones—; el rojo queda para comprar, la oferta y el regalo (decisión de Fabrizio, 29-oct-2026). Un SVG
 *  y no el carácter ♥: en iPhone ese carácter puede salir como emoji rojo, diga lo que diga el CSS. */
export function Corazon({ guardado, alTocar }: { guardado: boolean; alTocar: () => void }) {
  return (
    <button type="button" className="ex-corazon" aria-pressed={guardado} aria-label={guardado ? `${PORTAL_COPY.guardado}. Quitar` : PORTAL_COPY.guardar} data-explorar="corazon" data-guardado={guardado ? "1" : undefined} onClick={(e) => { e.stopPropagation(); alTocar(); }}>
      <svg className="ex-corazon-svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    </button>
  );
}

/** «Compartir» (02-nov-2026): el ícono de compartir, del mismo gris que el corazón; su nombre es «Compartir». `alPreparar`
 *  (al apoyar el dedo o el mouse) adelanta lo que el texto necesite antes del toque: la hoja del sistema tiene que abrirse en
 *  el mismo toque, sin esperas, o el teléfono no la abre. */
export function BotonCompartir({ alTocar, alPreparar }: { alTocar: () => void; alPreparar?: () => void }) {
  return (
    <button type="button" className="ex-compartir" aria-label={COMPARTIR_COPY.boton} title={COMPARTIR_COPY.boton} data-explorar="compartir" onPointerDown={alPreparar} onClick={(e) => { e.stopPropagation(); alTocar(); }}>
      <svg className="ex-compartir-svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path d="M12 3.5v11M7.5 8 12 3.5 16.5 8M6 12.5v6A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5v-6" />
      </svg>
    </button>
  );
}

/** Una cifra que sin cuenta no viaja (29-oct-2026, la puerta E): un relleno fijo, borroso y oculto a los lectores de
 *  pantalla, NUNCA el valor (el universo sin cuenta no lo trae: abierto.ts › sinCifras). */
export function Borroso({ texto }: { texto: string }) {
  return <b className="ex-borroso" aria-hidden="true" data-explorar="borroso">{texto}</b>;
}

/** «Comprar · 84»: el veredicto (el color de la tríada) y el puntaje, en texto (la etiqueta accesible de la fila). */
export const veredictoConPuntaje = (p: Pick<PinMapa, "veredicto" | "score">): string => `${etiquetaVeredicto(p.veredicto, "frase")}${p.score != null ? ` · ${p.score}` : ""}`;

/** EL VEREDICTO DE UN DEPTO (02-nov-2026): el chip de la casa con su puntaje y, para los que convienen, «al precio publicado». */
export function VeredictoDelPin({ p }: { p: PinMapa }) {
  return (
    <>
      <ChipVeredicto v={p.veredicto as Veredicto} puntaje={p.score} /> <span className="ex-publicado" data-explorar="al-precio-publicado">{AL_PRECIO_PUBLICADO}</span>
    </>
  );
}

/** LOS DOS VEREDICTOS DE UN NEGOCIADO (02-nov-2026, mockup 8, estado C): al precio publicado da Ajustar; si consigue el precio
 *  negociado, Comprar con su puntaje. Los dos, chips de la casa. */
export function VeredictosNegociado({ p }: { p: PinNegociado }) {
  // Sin cuenta el precio negociado no viaja: el precio y el descuento van borrosos, como el flujo del resto.
  const siConsigues = conCifrasNegociado(p) ? NEGOCIAR_COPY.siConsigues(p.neg.p, p.neg.d) : null;
  return (
    <>
      <span className="ex-linea2 ex-dos-v" data-explorar="veredicto-publicado">{NEGOCIAR_COPY.alPublicado} <ChipVeredicto v="AJUSTA SUPUESTOS" /></span>
      {siConsigues ? (
        <span className="ex-linea2 ex-dos-v" data-explorar="veredicto-negociado">{siConsigues.antes} <strong>{siConsigues.precio}</strong> {siConsigues.despues} <ChipVeredicto v="COMPRAR" puntaje={p.neg.s} /></span>
      ) : (
        <span className="ex-linea2 ex-dos-v" data-explorar="veredicto-negociado">{NEGOCIAR_COPY.consigues} <Borroso texto={NEGOCIAR_COPY.borroso.precio} /> <Borroso texto={NEGOCIAR_COPY.borroso.descuento} /> <ChipVeredicto v="COMPRAR" puntaje={p.neg.s} /></span>
      )}
    </>
  );
}

export function TarjetaPin({ pines, seleccionado, uf, analizados, guardados, generando, error, alCambiar, alCerrar, alGuardar, alAnalizar, alCompartir, alPrepararCompartir, alVerInforme, sinCuenta = false, recien = null }: {
  /** Los cercanos, el tocado primero. */
  pines: PinMapa[];
  seleccionado: string;
  uf: number | null;
  analizados: Record<string, string>;
  guardados: ReadonlySet<string>;
  generando: string | null;
  error: { avisoId: string; texto: string } | null;
  alCambiar: (avisoId: string) => void;
  alCerrar: () => void;
  alGuardar: (avisoId: string) => void;
  /** Con cuenta, «Analizar este»; sin cuenta, «Regístrate gratis para ver este depto» (abre la hoja de registro). */
  alAnalizar: (p: PinMapa) => void;
  /** «Compartir» (02-nov-2026), con y sin cuenta. */
  alCompartir: (p: PinMapa) => void;
  alPrepararCompartir?: (p: PinMapa) => void;
  /** «Ver informe» de un ya analizado (04-nov-2026): antes de irse, la vuelta al mapa queda anotada (volver-al-mapa.ts). */
  alVerInforme?: (avisoId: string, informeId: string) => void;
  /** Sin cuenta (estado C del mockup 6-puerta-e): el flujo, el cap rate y la UF por m² van borrosos y el botón pide registro. */
  sinCuenta?: boolean;
  /** Recién registrada desde este pin (30-oct-2026): su tarjeta se desbloquea con la banda; `regalo`, si tiene el análisis de regalo. */
  recien?: { avisoId: string; regalo: boolean } | null;
}) {
  const fila = useRef<HTMLDivElement>(null);
  const tipos = useCalle(pines.map((p) => p.avisoId));
  const i = Math.max(0, pines.findIndex((p) => p.avisoId === seleccionado));
  const desdeAfuera = useRef(true);

  // El elegido cambia desde el mapa: la fila se mueve a su tarjeta (sin animar, para no disparar el cambio de vuelta).
  useEffect(() => {
    const el = fila.current;
    if (!el || !desdeAfuera.current) { desdeAfuera.current = true; return; }
    el.scrollTo({ left: i * el.clientWidth, behavior: "auto" });
  }, [i, pines.length]);

  // Deslizar: al detenerse, la tarjeta a la vista pasa a ser la elegida.
  const tope = useRef<number | null>(null);
  const alDeslizar = () => {
    const el = fila.current;
    if (!el) return;
    if (tope.current) window.clearTimeout(tope.current);
    tope.current = window.setTimeout(() => {
      const k = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      const p = pines[Math.min(Math.max(k, 0), pines.length - 1)];
      if (p && p.avisoId !== seleccionado) { desdeAfuera.current = false; alCambiar(p.avisoId); }
    }, 90);
  };
  // Escape la cierra; en el PC, las flechas del teclado pasan al depto anterior o al siguiente (no mientras se escribe).
  const anterior = i > 0 ? pines[i - 1] : null;
  const siguiente = i < pines.length - 1 ? pines[i + 1] : null;
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { alCerrar(); return; }
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName))) return;
      if (e.key === "ArrowLeft" && anterior) { e.preventDefault(); alCambiar(anterior.avisoId); }
      if (e.key === "ArrowRight" && siguiente) { e.preventDefault(); alCambiar(siguiente.avisoId); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [alCerrar, alCambiar, anterior, siguiente]);

  return (
    <section className="ex-tarjeta-wrap" aria-label="Depto elegido" data-explorar="tarjeta-pin">
      {pines.length > 1 && (
        <>
          <button type="button" className="ex-flecha ex-flecha-izq" aria-label={PORTAL_COPY.anterior} disabled={!anterior} onClick={() => anterior && alCambiar(anterior.avisoId)} data-explorar="flecha-anterior">‹</button>
          <button type="button" className="ex-flecha ex-flecha-der" aria-label={PORTAL_COPY.siguiente} disabled={!siguiente} onClick={() => siguiente && alCambiar(siguiente.avisoId)} data-explorar="flecha-siguiente">›</button>
        </>
      )}
      <div className="ex-tarjetas" ref={fila} onScroll={alDeslizar} data-explorar="carrusel">
        {pines.map((p) => {
          const informe = analizados[p.avisoId];
          const cap = capRatePct(p.arriendo, p.precioUF, uf);
          const m2 = ufPorM2(p.precioUF, p.m2);
          const neg = (p.flujo ?? 0) < 0;
          const nueva = !sinCuenta && recien?.avisoId === p.avisoId;
          return (
            <article key={p.avisoId} className="ex-tarjeta" data-explorar="tarjeta" data-aviso={p.avisoId} data-sel={p.avisoId === seleccionado ? "1" : undefined} data-recien={nueva ? "1" : undefined} aria-current={p.avisoId === seleccionado ? "true" : undefined}>
              <div className="ex-tarjeta-caja">
              {nueva && (
                <p className="ex-recien" role="status" data-explorar="recien">
                  <b>{PORTAL_COPY.vuelta.listo}</b>{recien.regalo ? ` ${PORTAL_COPY.vuelta.regalo}` : ""}
                </p>
              )}
              <div className="ex-tarjeta-fila">
                <ImagenDepto avisoId={p.avisoId} tipo={tipos[p.avisoId]} clase="ex-img" ajustar={esNegociado(p)} />
                <div className="ex-tarjeta-datos">
                  <div className="ex-tarjeta-cab">
                    <span className="ex-ojo" data-explorar="linea">{lineaDepto(p)}</span>
                    <span className="ex-iconos">
                      <BotonCompartir alTocar={() => alCompartir(p)} alPreparar={alPrepararCompartir ? () => alPrepararCompartir(p) : undefined} />
                      <Corazon guardado={guardados.has(p.avisoId)} alTocar={() => alGuardar(p.avisoId)} />
                    </span>
                  </div>
                  <b className="ex-precio" data-explorar="precio">UF {miles(p.precioUF)}{esNegociado(p) && <span className="ex-publicado"> {NEGOCIAR_COPY.publicado}</span>}</b>
                  {esNegociado(p) ? (
                    <VeredictosNegociado p={p} />
                  ) : sinCuenta ? (
                    <>
                      <span className="ex-linea2" data-explorar="veredicto"><VeredictoDelPin p={p} /></span>
                      <span className="ex-linea2" data-explorar="flujo-oculto">{ABIERTO_COPY.flujo} <Borroso texto={BORROSO.flujo} /> {ABIERTO_COPY.alMes}</span>
                      <span className="ex-linea3" data-explorar="cifras">{ABIERTO_COPY.capRate} <Borroso texto={BORROSO.capRate} /> · <Borroso texto={BORROSO.porM2} /></span>
                    </>
                  ) : (
                    <>
                      <span className="ex-linea2" data-explorar="veredicto"><VeredictoDelPin p={p} /></span>
                      {p.flujo != null && <span className="ex-linea2" data-explorar="flujo"><b className={neg ? "ex-neg" : undefined}>{flujoTexto(p.flujo)}</b> {PORTAL_COPY.alMes}</span>}
                      <span className="ex-linea3" data-explorar="cifras">
                        {[cap != null ? `${PORTAL_COPY.capRate} ${pctUno(cap)}` : null, m2 != null ? `${miles(m2)} ${PORTAL_COPY.porM2}` : null].filter(Boolean).join(" · ")}
                      </span>
                    </>
                  )}
                </div>
              </div>
              {sinCuenta ? (
                <button type="button" className="ex-cta ex-cta-triada" onClick={() => alAnalizar(p)} data-explorar="registrate">{ABIERTO_COPY.cta}</button>
              ) : informe ? (
                // «Ya lo analizaste · Ver informe» (03-nov-2026): la misma frase de la selección y del dashboard (YA_ANALIZADO).
                <EnlaceCarga href={`/analisis/${informe}`} className="ex-cta ex-cta-enlace" data-explorar="ver-informe" onClick={() => alVerInforme?.(p.avisoId, informe)}>{YA_ANALIZADO.texto} · {YA_ANALIZADO.enlace}</EnlaceCarga>
              ) : (
                <button type="button" className="ex-cta" onClick={() => alAnalizar(p)} disabled={!!generando} {...botonOcupado(generando === p.avisoId)} data-explorar="analizar">
                  {generando === p.avisoId ? GUIA.analizando : esNegociado(p) && conCifrasNegociado(p) ? NEGOCIAR_COPY.analizarA(p.neg.p) : nueva && recien.regalo ? PORTAL_COPY.vuelta.analizarRegalo : PORTAL_COPY.analizar}
                </button>
              )}
              {error?.avisoId === p.avisoId && <p className="ex-error" role="alert">{error.texto}</p>}
              </div>
            </article>
          );
        })}
      </div>
      {pines.length > 1 && (
        <div className="ex-puntos" aria-hidden="true">
          {pines.map((p) => <span key={p.avisoId} className="ex-punto" data-on={p.avisoId === seleccionado ? "1" : undefined} />)}
        </div>
      )}
    </section>
  );
}
