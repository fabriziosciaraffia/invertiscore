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
// «PRONTO: INVIERTE CON FRANCO» (11-nov-2026): en un usado o un nuevo de inmobiliaria que da ✓ Comprar o − Ajustar negociable, debajo de lo que la tarjeta
// ya tiene, el botón secundario «Invierte con Franco» (con y sin cuenta); inscrito, la etiqueta. «Analizar este» sigue primero.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { metroCercano, textoLugar } from "@/lib/explorar/lugar";
import { botonOcupado } from "@/lib/carga-global";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { GUIA } from "@/lib/guia/copy";

import { capRatePct, pctUno } from "@/lib/explorar/explorar";
import { PORTAL_COPY, type PinMapa } from "@/lib/explorar/portal";
import { ImagenDepto, useCalle } from "@/components/guia/ImagenDepto";
import { YA_ANALIZADO } from "@/lib/guia/semanal-str";
import { BORROSO } from "@/lib/explorar/abierto";
import { ChipVeredicto } from "@/components/analysis/shared/ChipVeredicto";
import { claseDePin, conCifrasNegociado, esNegociado, NEGOCIAR_COPY, type PinNegociado } from "@/lib/explorar/capa-negociar";
import { TARJETA_COPY } from "@/lib/explorar/mapa-todos";
import { AL_PRECIO_PUBLICADO } from "@/lib/precio-publicado";
import type { Veredicto } from "@/lib/types";
import { COMPARTIR_COPY } from "@/lib/explorar/compartir";
import { ChipInformePropio } from "@/components/guia/ChipInformePropio";
import { SIN_REGALO_COPY, VER_PLANES, type MotivoSinRegalo } from "@/lib/regalo-alta";
import type { ResumenInforme } from "@/lib/informe-propio";
import { puedeInvertir } from "@/lib/invierte/invierte";
import { BotonInvierte } from "@/components/invierte/BotonInvierte";

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

/** EL LUGAR DE CADA DEPTO (25-nov-2026, lugar.ts): el barrio o sector, o la avenida, que guarda el servidor; lo pide a POST
 *  /api/explorar/lugar para los cercanos del carrusel SIN metro (el metro sale de la lista del repo, al instante: TarjetaPin), una vez
 *  por aviso en esta visita. Devuelve `undefined` mientras llega (la línea le reserva el espacio) y `null` sin lugar o si el pedido
 *  falló (26-nov-2026: la tarjeta se completaba uno o dos segundos después y la línea saltaba). */
const lugaresVistos = new Map<string, string | null>();
const lugaresPedidos = new Set<string>();
const lugaresFallidos = new Set<string>();
/** Cuánto espera la tarjeta el barrio o la avenida antes de soltar la reserva (el pedido tarda 0,2 s; el primero en frío, ~1,5 s). */
export const TOPE_LUGAR_MS = 8000;
export function useLugares(ids: readonly string[]): Record<string, string | null | undefined> {
  const [, setTick] = useState(0);
  const clave = ids.join(",");
  // Redibuja mientras la tarjeta siga montada, aunque entretanto cambien los cercanos (un pedido lento no se pierde).
  const montada = useRef(true);
  useEffect(() => () => { montada.current = false; }, []);
  useEffect(() => {
    const faltan = ids.filter((id) => !lugaresVistos.has(id) && !lugaresPedidos.has(id)).slice(0, 40);
    if (!faltan.length) return;
    for (const id of faltan) lugaresPedidos.add(id);
    // Un pedido que no vuelve no deja la reserva gris para siempre: a los TOPE_LUGAR_MS se corta y la línea sigue sin lugar.
    const corte = new AbortController();
    const tope = window.setTimeout(() => corte.abort(), TOPE_LUGAR_MS);
    fetch("/api/explorar/lugar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: faltan }), signal: corte.signal })
      // Una respuesta mala no se recuerda: el próximo carrusel lo vuelve a pedir.
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((d: Record<string, string | null>) => { for (const id of faltan) { lugaresVistos.set(id, typeof d[id] === "string" ? d[id] : null); lugaresFallidos.delete(id); } if (montada.current) setTick((n) => n + 1); })
      // Sin lugar: la reserva se va y la línea sigue con tipología y m² (el próximo carrusel lo vuelve a pedir).
      .catch(() => { for (const id of faltan) lugaresFallidos.add(id); if (montada.current) setTick((n) => n + 1); })
      .finally(() => { window.clearTimeout(tope); for (const id of faltan) lugaresPedidos.delete(id); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  return Object.fromEntries(ids.map((id) => [id, lugaresVistos.has(id) ? lugaresVistos.get(id) ?? null : lugaresFallidos.has(id) ? null : undefined]));
}

export function TarjetaPin({ pines, seleccionado, uf, analizados, resumenes = {}, guardados, generando, error, alCambiar, alCerrar, alGuardar, alAnalizar, alCompartir, alPrepararCompartir, alVerInforme, sinCuenta = false, recien = null, inscritos, alInvertir, etiquetaInvertir }: {
  /** Los cercanos, el tocado primero. */
  pines: PinMapa[];
  seleccionado: string;
  uf: number | null;
  analizados: Record<string, string>;
  /** El resumen de cada informe propio, por id (05-nov-2026): la tarjeta de un analizado dice SU informe, no la noche. */
  resumenes?: Record<string, ResumenInforme>;
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
  recien?: { avisoId: string; regalo: boolean; sinRegalo?: MotivoSinRegalo | null } | null;
  /** «Invierte con Franco» (11-nov-2026): los deptos en que ya está inscrita y qué hacer al tocar el botón. Sin `alInvertir`, no va. */
  inscritos?: ReadonlySet<string>;
  alInvertir?: (p: PinMapa) => void;
  /** El texto del botón cuando ya firmó la orden de Invierte con Franco (20-nov-2026), solo en los usados. */
  etiquetaInvertir?: (p: PinMapa) => string | undefined;
}) {
  const fila = useRef<HTMLDivElement>(null);
  const tipos = useCalle(pines.map((p) => p.avisoId));
  // EL METRO, AL INSTANTE (26-nov-2026): sale de la lista de estaciones del repo (lugar.ts › metroCercano), sin esperar al servidor; al
  // servidor solo se le pide el barrio o la avenida de los que no tienen metro a menos de 1 km.
  const metros = useMemo(() => new Map(pines.map((p) => [p.avisoId, Number.isFinite(p.lat) && Number.isFinite(p.lng) ? metroCercano(p.lat, p.lng) : null])), [pines]);
  const lugares = useLugares(pines.filter((p) => !metros.get(p.avisoId)).map((p) => p.avisoId));
  const lugarDe = (id: string): string | null | undefined => { const m = metros.get(id); return m ? textoLugar(m, null) : lugares[id]; };
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
          const neg = (p.flujo ?? 0) < 0;
          const clase = claseDePin(p);
          const analizadoAqui = !!informe && !sinCuenta;
          const nueva = !sinCuenta && recien?.avisoId === p.avisoId;
          return (
            <article key={p.avisoId} className="ex-tarjeta" data-explorar="tarjeta" data-aviso={p.avisoId} data-sel={p.avisoId === seleccionado ? "1" : undefined} data-recien={nueva ? "1" : undefined} aria-current={p.avisoId === seleccionado ? "true" : undefined}>
              <div className="ex-tarjeta-caja">
              {nueva && (
                <p className="ex-recien" role="status" data-explorar="recien">
                  <b>{PORTAL_COPY.vuelta.listo}</b>{recien.regalo ? ` ${PORTAL_COPY.vuelta.regalo}` : ""}
                  {/* SIN REGALO, DICHO (05-nov-2026, regalo-alta.ts › SIN_REGALO_COPY): el motivo y «Ver planes». */}
                  {!recien.regalo && recien.sinRegalo && (
                    <span data-explorar="sin-regalo" data-motivo={recien.sinRegalo}> {SIN_REGALO_COPY[recien.sinRegalo].titulo} <EnlaceCarga href={VER_PLANES.href}>{VER_PLANES.texto}</EnlaceCarga></span>
                  )}
                </p>
              )}
              <div className="ex-tarjeta-fila">
                <ImagenDepto avisoId={p.avisoId} tipo={tipos[p.avisoId]} clase="ex-img" ajustar={esNegociado(p)} />
                <div className="ex-tarjeta-datos">
                  {/* LA CABECERA (25-nov-2026, lámina 7): la comuna en mayúsculas y, debajo, el lugar —el metro a menos de 1 km, el
                      barrio o sector, o la avenida principal (lugar.ts)—, la tipología y los m². A la derecha, el chip del veredicto. */}
                  <div className="ex-tarjeta-cab">
                    <div className="ex-tarjeta-titulo">
                      <b className="ex-comuna" data-explorar="comuna">{p.comuna.toLocaleUpperCase("es-CL")}</b>
                      {/* Una sola línea que no salta: el lugar (o, mientras llega del servidor, un espacio gris de su tamaño) y, siempre
                          enteros, la tipología y los m²; un lugar largo se corta con «…». */}
                      {(() => {
                        const lugar = lugarDe(p.avisoId);
                        const resto = [p.tipologia, `${miles(p.m2)} m²`].filter(Boolean).join(" · ");
                        return (
                          <span className="ex-ojo ex-linea-lugar" data-explorar="linea">
                            {lugar === undefined ? <span className="ex-lugar ex-lugar-carga" aria-hidden="true" data-explorar="lugar-carga" /> : lugar ? <span className="ex-lugar" data-explorar="lugar">{lugar}</span> : null}
                            <span className="ex-linea-resto">{lugar !== null ? ` · ${resto}` : resto}</span>
                          </span>
                        );
                      })()}
                    </div>
                    <span className="ex-iconos">
                      <BotonCompartir alTocar={() => alCompartir(p)} alPreparar={alPrepararCompartir ? () => alPrepararCompartir(p) : undefined} />
                      <Corazon guardado={guardados.has(p.avisoId)} alTocar={() => alGuardar(p.avisoId)} />
                    </span>
                  </div>
                  <span className="ex-linea2" data-explorar="veredicto">
                    {informe && !sinCuenta && resumenes[informe] ? (
                      // YA LO ANALIZÓ (05-nov-2026, lib/informe-propio.ts): lo que dice SU informe, no la noche.
                      <span data-explorar="informe-propio"><ChipInformePropio resumen={resumenes[informe]} noche={{ veredicto: p.veredicto, score: p.score }} /></span>
                    ) : clase === "no" ? (
                      <span className="chip-v b" data-veredicto="BUSCAR OTRA" data-explorar="no-conviene">{TARJETA_COPY.noConviene}</span>
                    ) : (
                      <ChipVeredicto v={(clase === "ajustar" ? "AJUSTA SUPUESTOS" : "COMPRAR") as Veredicto} puntaje={sinCuenta ? null : p.score} />
                    )}
                  </span>
                  {/* LA FRANJA DE CUATRO CIFRAS (lámina 7): publicado, arriendo estimado, cap rate y te sobran o pones al mes. No conviene
                      muestra solo el publicado (sus cifras quedan dentro del depto). Sin cuenta, solo el publicado se ve nítido. */}
                  <div className="ex-franja" data-explorar="franja" data-n={clase === "no" ? 1 : analizadoAqui ? 3 : 4}>
                    <div className="ex-cifra"><span>{TARJETA_COPY.publicado}</span><b data-explorar="precio">UF {miles(p.precioUF)}</b></div>
                    {clase !== "no" && (sinCuenta ? (
                      <>
                        <div className="ex-cifra"><span>{TARJETA_COPY.arriendo}</span><Borroso texto={BORROSO.flujo} /></div>
                        <div className="ex-cifra"><span>{TARJETA_COPY.capRate}</span><Borroso texto={BORROSO.capRate} /></div>
                        <div className="ex-cifra"><span>{TARJETA_COPY.teSobran}</span><Borroso texto={BORROSO.flujo} /></div>
                      </>
                    ) : (
                      <>
                        <div className="ex-cifra"><span>{TARJETA_COPY.arriendo}</span><b data-explorar="arriendo">{p.arriendo != null ? `$${miles(p.arriendo)}` : "—"}</b></div>
                        <div className="ex-cifra"><span>{TARJETA_COPY.capRate}</span><b data-explorar="cap-rate">{cap != null ? pctUno(cap) : "—"}</b></div>
                        {/* YA LO ANALIZÓ (05-nov-2026): el flujo es el de su informe, no el de la noche; la franja no lo repite. */}
                        {!analizadoAqui && <div className="ex-cifra"><span>{neg ? TARJETA_COPY.pones : TARJETA_COPY.teSobran}</span><b data-explorar="flujo" className={neg ? "ex-neg" : undefined}>{p.flujo != null ? `$${miles(Math.abs(p.flujo))}` : "—"}</b></div>}
                      </>
                    ))}
                  </div>
                  {/* AJUSTAR SUMA «Conviene desde UF X · N % menos» (decisión 7). Sin cuenta, el precio y el descuento van difuminados. */}
                  {esNegociado(p) && (
                    <span className="ex-conviene-desde" data-explorar="conviene-desde">
                      {conCifrasNegociado(p) ? TARJETA_COPY.convieneDesde(p.neg.p, p.neg.d) : <>{TARJETA_COPY.convieneDesde(0, 0).split(" UF")[0]} <Borroso texto={NEGOCIAR_COPY.borroso.precio} /> <Borroso texto={NEGOCIAR_COPY.borroso.descuento} /></>}
                    </span>
                  )}
                </div>
              </div>
              {sinCuenta ? (
                <button type="button" className="ex-cta" onClick={() => alAnalizar(p)} data-explorar="registrate">{TARJETA_COPY.verGratis}</button>
              ) : informe ? (
                // «Ya lo analizaste · Ver informe» (03-nov-2026): la misma frase de la selección y del dashboard (YA_ANALIZADO).
                <EnlaceCarga href={`/analisis/${informe}`} className="ex-cta ex-cta-enlace" data-explorar="ver-informe" onClick={() => alVerInforme?.(p.avisoId, informe)}>{YA_ANALIZADO.texto} · {YA_ANALIZADO.enlace}</EnlaceCarga>
              ) : (
                // «VER ESTE DEPTO» (cambio de textos del 17-nov-2026, decisión 4 del 25-nov): gasta un crédito, como siempre. También en
                // un Ajustar: el precio con descuento ya lo dice la línea de arriba.
                <button type="button" className="ex-cta" onClick={() => alAnalizar(p)} disabled={!!generando} {...botonOcupado(generando === p.avisoId)} data-explorar="analizar">
                  {generando === p.avisoId ? GUIA.analizando : nueva && recien.regalo ? PORTAL_COPY.vuelta.analizarRegalo : TARJETA_COPY.verDepto}
                </button>
              )}
              {error?.avisoId === p.avisoId && <p className="ex-error" role="alert">{error.texto}</p>}
              {alInvertir && puedeInvertir({ condicion: p.condicion, veredicto: p.veredicto, negociable: esNegociado(p) }) && (
                <BotonInvierte avisoId={p.avisoId} origen="explorar" veredicto={esNegociado(p) ? "AJUSTA SUPUESTOS" : p.veredicto} inscrito={!!inscritos?.has(p.avisoId)} sinCuenta={sinCuenta} alTocar={() => alInvertir(p)} etiqueta={etiquetaInvertir?.(p)} />
              )}
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
