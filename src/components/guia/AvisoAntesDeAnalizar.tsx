"use client";

// ─────────────────────────────────────────────────────────────────────────────
// El aviso antes de gastar un análisis (13-oct-2026; reglas y copy en lib/guia/aviso-analizar.ts). Lo abren
// «Analizar este» de la selección (la primera selección y el dashboard), de la guía y del mapa de Explorar. Es EL MISMO
// modal de confirmación del wizard (ModalPlausibilidad, estado limpio) con su propio cuerpo.
// SEGÚN LOS MOCKUPS D1 Y D2 (23-oct-2026, `docs/puerta-b-mockups/4-ticket-y-popups.html`, decisión de Fabrizio):
//   · D1, como se abre: la tarjeta gris del depto (comuna · tipología · m² · precio, el veredicto y el flujo, y «El
//     informe completo incluye el enlace a la publicación, para que lo veas y contactes a quien lo vende»), «Con pie de
//     20 % y plazo de 30 años · Cambiar», el dividendo y el retorno bruto, qué gasta («Usa tu análisis de regalo.»),
//     «Analizar» y «Cancelar»;
//   · D2, al tocar Cambiar: los selectores de pie y plazo; el veredicto SE RECALCULA AL TIRO (`cambio.recalcular`, POST
//     /api/explorar/recalcular: la sonda del motor sobre la evaluación de la noche) y, si cambia, la tarjeta «Con pie 10 %
//     este depto da Ajustar. Flujo mensual −$X de tu bolsillo. Con 20 % daba Comprar 88 y +$Y.» (textoCambio; en Signal
//     Red solo si empeora), la casilla «Guardar 10 % y 30 años como mi perfil de búsqueda» y, si empeora, «Analizar igual».
//     NUNCA SE COBRA SIN MOSTRAR EL VEREDICTO RECALCULADO (bloqueaAnalizar): mientras recalcula o si no pudo, el botón no
//     deja analizar. Lo elegido viaja en `alAnalizar` (EleccionAnalizar: la combinación y si guarda el perfil); quien lo
//     monta guarda el perfil y analiza con esa combinación. Sin `cambio` (la guía, renta corta) no hay «Cambiar».
// UNA SOLA API (23-oct-2026): la de Explorar (`cambio`, `alAnalizar(eleccion)`), con el cuerpo del mockup para todos.
// DESDE LA SELECCIÓN (21-oct-2026): al tocar «Analizar», el aviso queda abierto con «Franco está analizando este depto…»
// y la barra de carga del header hasta que abre el informe (`analizando`). Sin saldo, el pack de tres es el principal —al
// precio del ticket si la cuenta tiene menos de 24 horas— y debajo «Comprar solo 1 · $9.990» (`compras`).
// CABE EN EL TELÉFONO (24-oct-2026, decisión de Fabrizio): entero en 390 × 740, sin scroll, con todo lo que tiene. La
// tarjeta del depto en dos líneas (comuna · tipología · m² · precio, y veredicto · flujo) más «El informe incluye el
// enlace a la publicación.»; la oferta en una fila y una línea; «Comprar solo 1» es un botón de borde más bajo y
// «Cancelar», texto (el modal en modo `compacto`). Lo mide la sonda popups-alto-webkit-sonda.ts contra /dev/popups.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { claveActual, iniciarCarga } from "@/lib/carga-global";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { EXPLORAR_COPY, PIES_POPUP, PLAZOS_POPUP, textoCambio, type Recalculo } from "@/lib/explorar/explorar";
import { TASAS_ELEGIBLES } from "@/lib/deptos/estandar";
import { COMPRA_DEPTO, nombreDelDepto, type ComprasDelDepto } from "@/lib/guia/compra-desde-depto";
import { ModalPlausibilidad } from "@/components/formulario-v4/ModalPlausibilidad";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { AVISO_ANALIZAR, bloqueaAnalizar, derivadosAviso, lineaVeredicto, textoFlujo, textoUso, type FinanzasAviso, type UsoAnalisis } from "@/lib/guia/aviso-analizar";
import { AL_PRECIO_PUBLICADO, NEGOCIADO_COPY } from "@/lib/precio-publicado";
import { ChipVeredicto, ChipVeredictoTokens } from "@/components/analysis/shared/ChipVeredicto";
import type { Veredicto } from "@/lib/types";
import type { CondicionDepto } from "@/lib/guia/linea-depto";
import { ImagenDepto, useCalle } from "@/components/guia/ImagenDepto";
import { InformeEnCamino } from "@/components/guia/InformeEnCamino";
import type { PasoInforme, VeredictoVisto } from "@/lib/guia/informe-en-camino";
import "@/components/formulario-v4/wizard-v4.css";

export interface EleccionAnalizar {
  combinacion: { piePct: number; plazoAnios: number; tasaPct?: number | null };
  /** Marcó la casilla: el pie, el plazo y la tasa nuevos quedan en su perfil de búsqueda. */
  guardarPerfil: boolean;
  /** El veredicto que vio al tocar «Analizar» (03-nov-2026): el de la tarjeta, o el recalculado si cambió el pie o el plazo.
   *  Si el informe da otro, el pop-up lo dice antes de abrirlo (lib/guia/informe-en-camino.ts). */
  vista?: VeredictoVisto | null;
}

// DESPUÉS DE «ANALIZAR» (03-nov-2026, InformeEnCamino): con `informe`, el mismo pop-up pasa a «Generando el informe de
// [depto]…» con su barra, abre el informe solo, a los 10 s ofrece «Abrir informe» y, si falló o salió otro veredicto, lo dice.
export function AvisoAntesDeAnalizar({ avisoId = null, depto, combinacion, finanzas, uso, rutaCompra, alAnalizar, alCancelar, modalidad = "ltr", analizando = false, compras = null, ticketConSaldo = null, cambio = null, ticketVence = null, planLinea = null, negociado = null, movido = null, informe = null, alCerrarInforme, alReintentarInforme = null }: {
  /** Lo que pasa después de «Analizar» (03-nov-2026): generando, listo, distinto o el fallo. Sin él, el aviso de siempre. */
  informe?: PasoInforme | null;
  /** Cerrar el pop-up del informe (solo cuando se puede): con el informe listo, quien lo monta deja el aviso de arriba. */
  alCerrarInforme?: () => void;
  /** Tras un fallo, volver a intentar con lo mismo. */
  alReintentarInforme?: (() => void) | null;
  /** UN NEGOCIADO DE EXPLORAR (02-nov-2026, mockup 8): el precio que hay que conseguir, el descuento y el puntaje a ese precio. La
   *  tarjeta dice los dos veredictos («Al precio publicado [Ajustar]» y «Si consigues UF 2.950 (−4,2 %) [✓ Comprar · 71]»), el
   *  dividendo y el retorno son a ese precio y el botón dice «Analizar a UF 2.950». Sin «Cambiar»: la noche lo calculó con este
   *  pie y este plazo. */
  negociado?: { precioUF: number; descuentoPct: number; score: number | null } | null;
  /** El precio negociado, verificado con los datos de hoy antes de cobrar (02-nov-2026): se movió o ya no llega. */
  movido?: string | null;
  /** El aviso (30-oct-2026, recorrido real de Fabrizio): su foto de la calle, o el mapa chico, va a la izquierda de la tarjeta
   *  gris, en todas partes. Sin él, la tarjeta sola. */
  avisoId?: string | null;
  /** La tarjeta gris: con la condición del aviso, «… 77 m² · Usado · UF 4.200» (28-oct-2026, linea-depto.ts). */
  depto: { comuna: string; tipologia: string | null; m2: number; precioUF: number; condicion?: CondicionDepto };
  /** Renta corta (14-oct-2026): el ingreso estimado por zona va en `finanzas.arriendo`. La última línea es la de siempre,
   *  «Usa 1 de tus N análisis», sin condición (15-oct-2026). */
  modalidad?: "ltr" | "str";
  /** El pie y el plazo con que se analiza, y la tasa elegida (30-oct-2026; null o ausente = la de hoy, `finanzas.tasa`). */
  combinacion: { piePct: number; plazoAnios: number; tasaPct?: number | null };
  finanzas: FinanzasAviso;
  uso: UsoAnalisis;
  /** El checkout del pack, con su origen y la vuelta a esta página. */
  rutaCompra: string;
  alAnalizar: (eleccion?: EleccionAnalizar) => void;
  alCancelar: () => void;
  /** «Cambiar» el pie y el plazo: cómo recalcular y qué daba con la combinación de apertura (el veredicto y el flujo de la
   *  tarjeta gris). Sin él, la línea del pie y el plazo va sin «Cambiar». */
  cambio?: { recalcular: (combo: { piePct: number; plazoAnios: number; tasaPct?: number | null }) => Promise<Recalculo | null>; base: { veredicto: string; score: number | null; flujo: number | null } } | null;
  /** Se está generando el informe: el aviso queda abierto, cargando, hasta que se abre. */
  analizando?: boolean;
  /** Sin saldo, desde la selección: el pack (principal) y el suelto (debajo), con la vuelta a este depto. */
  compras?: ComprasDelDepto | null;
  /** CON SALDO Y EL TICKET VIVO (22-oct-2026, decisión de Fabrizio): se usa el saldo como siempre y debajo una sola línea,
   *  «Hoy, 3 más por $14.990 · vence mañana 11:17», como enlace, sin frenar. */
  ticketConSaldo?: { texto: string; href: string } | null;
  /** SIN SALDO Y CON EL TICKET VIVO (24-oct-2026, mockup A de 4-ticket-y-popups.html): hasta cuándo («mañana 11:17»), para
   *  la tarjeta roja de la oferta dentro del pop-up. Sin él, el pack de tres de siempre. */
  ticketVence?: string | null;
  /** EL PLAN DONDE SE USA (28-oct-2026, Explorar como portal): desde el tercer análisis hecho desde Explorar en 30 días, una
   *  línea más, sin frenar, con el enlace a la compra del plan: «Llevas 3 este mes. Con el Plan Franco, 20 al mes por
   *  $39.990.» (lib/explorar/portal.ts › lineaPlan). Sin ella, nada cambia. */
  planLinea?: { texto: string; href: string } | null;
}) {
  const router = useRouter();
  const sin = uso.tipo === "sin";
  // El cambio de pie y plazo: la combinación elegida, si está editando y qué da con ella.
  const [combo, setCombo] = useState({ ...combinacion, tasaPct: combinacion.tasaPct ?? null });
  const [editando, setEditando] = useState(false);
  const [recal, setRecal] = useState<Recalculo | null>(null);
  const [recalculando, setRecalculando] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [guardar, setGuardar] = useState(true);
  const pedido = useRef(0);
  const cambiada = combo.piePct !== combinacion.piePct || combo.plazoAnios !== combinacion.plazoAnios || combo.tasaPct !== (combinacion.tasaPct ?? null);
  // La tasa que se ve y con que se calcula el dividendo: la elegida o la de hoy (30-oct-2026).
  const tasaVista = combo.tasaPct ?? finanzas.tasa;
  useEffect(() => {
    if (!cambio || !cambiada) { setRecal(null); setRecalculando(false); setFallo(false); return; }
    const n = ++pedido.current;
    setRecalculando(true);
    setFallo(false);
    setRecal(null);
    // La respuesta tardía de una combinación vieja no pisa a la nueva.
    void cambio.recalcular(combo).then((r) => { if (pedido.current === n) { setRecal(r); setFallo(!r); setRecalculando(false); } }).catch(() => { if (pedido.current === n) { setRecal(null); setFallo(true); setRecalculando(false); } });
    // `cambio` no cambia entre renders del mismo pop-up; lo que importa es la combinación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combo.piePct, combo.plazoAnios, combo.tasaPct, cambiada]);
  const comprar = (href: string) => { iniciarCarga(claveActual()); router.push(href); };
  const da = cambio && cambiada && recal ? textoCambio({ antes: { pie: combinacion.piePct, plazo: combinacion.plazoAnios, tasa: combinacion.tasaPct ?? null, ...cambio.base }, despues: { pie: combo.piePct, plazo: combo.plazoAnios, tasa: combo.tasaPct, veredicto: recal.veredicto, score: recal.score, flujo: recal.flujo } }, (v) => etiquetaVeredicto(v, "frase")) : null;
  const c = EXPLORAR_COPY.conPieYPlazo(combo.piePct, combo.plazoAnios, tasaVista);
  const resumen = {
    direccion: nombreDelDepto(depto),
    modalidad: modalidad === "str" ? AVISO_ANALIZAR.modalidadCorta : AVISO_ANALIZAR.modalidad,
    // Los derivados siguen a la combinación elegida; el pop-up muestra el dividendo y el retorno bruto (el mockup).
    derivados: derivadosAviso(negociado ? { ...depto, precioUF: negociado.precioUF } : depto, combo, { ...finanzas, tasa: tasaVista }),
  };
  const derivados = resumen.derivados.filter((x) => x.label === "Dividendo" || x.label === "Retorno bruto");
  // Qué incluye el informe: en renta corta, los dos casos (27-oct-2026): si no da, no gasta y ve la publicación igual.
  const incluye = modalidad === "str" ? AVISO_ANALIZAR.incluyeCorta : AVISO_ANALIZAR.incluye;
  // Lo que daba al abrir (la tarjeta gris): con la combinación de apertura, o lo recalculado si ya cambió. EL VEREDICTO VA CON EL CHIP
  // DE LA CASA (04-nov-2026, la pasada de Fabrizio), no en texto: «[✓ Comprar · 84] al precio publicado · flujo +$261.383 te queda».
  // La frase entera (lineaVeredicto) queda como su nombre accesible.
  const enTarjeta = editando || !cambio ? null : cambiada && recal ? recal : cambio.base;
  const linea = lineaVeredicto(enTarjeta);
  // NUNCA SE COBRA SIN EL VEREDICTO RECALCULADO: con otra combinación, hasta que llegue (aviso-analizar.ts).
  const bloqueado = bloqueaAnalizar({ sin, esBase: !cambiada, recalculando, evaluacion: recal });
  const analizar = negociado ? NEGOCIADO_COPY.analizarA(negociado.precioUF) : da?.empeora ? EXPLORAR_COPY.analizarIgual : AVISO_ANALIZAR.analizar;
  const siConsigues = negociado ? NEGOCIADO_COPY.siConsigues(negociado.precioUF, negociado.descuentoPct) : null;

  const conTicket = sin && !!compras?.pack.ticket;
  const tipos = useCalle(avisoId ? [avisoId] : []);
  const cuerpo = (
    <div className="av" data-aviso={sin ? "sin" : editando ? "cambiar" : "ver"}>
      {/* El chip de veredicto se dibuja igual en Explorar, la selección, el dashboard y la guía: su CSS viaja con el pop-up. */}
      <ChipVeredictoTokens />
      {/* SIN SALDO (mockup A): «No te quedan análisis.» grande y en rojo, la tarjeta gris del depto y, con el ticket vivo,
          la tarjeta roja de la oferta: «Solo para cuentas nuevas · vence mañana 11:17» y «3 análisis por $14.990 · $4.997
          cada uno». Sin ticket, la línea del pack de tres de siempre (el consumo). */}
      {sin && <h2 id="modal-plausibilidad-titulo" className="av-sin-titulo" data-aviso="sin-titulo">{AVISO_ANALIZAR.tituloSin}</h2>}
      <div className="av-tarjeta-fila">
      {avisoId && <ImagenDepto avisoId={avisoId} tipo={tipos[avisoId]} clase="av-img" ajustar={!!negociado} />}
      <div className="av-tarjeta">
        {sin ? <p className="av-nombre" data-aviso="depto">{resumen.direccion}</p> : <h2 id="modal-plausibilidad-titulo" className="av-nombre" data-aviso="depto">{resumen.direccion}</h2>}
        {negociado && siConsigues ? (
          <>
            <span className="av-linea" data-aviso="veredicto-publicado">{NEGOCIADO_COPY.alPublicado} <ChipVeredicto v="AJUSTA SUPUESTOS" /></span>
            <span className="av-linea" data-aviso="veredicto-negociado">{siConsigues.antes} <b>{siConsigues.precio}</b> {siConsigues.despues} <ChipVeredicto v="COMPRAR" puntaje={negociado.score} /></span>
          </>
        ) : enTarjeta?.veredicto && linea && (
          <span className="av-linea" data-aviso="veredicto" aria-label={linea}>
            <ChipVeredicto v={enTarjeta.veredicto as Veredicto} puntaje={enTarjeta.score ?? null} /> {AL_PRECIO_PUBLICADO}{enTarjeta.flujo != null && <> · flujo {textoFlujo(enTarjeta.flujo)}</>}
          </span>
        )}
        <span className={modalidad === "str" ? "av-incluye av-incluye-corta" : "av-incluye"} data-aviso="incluye">{incluye.antes}<b>{incluye.fuerte}</b>{incluye.despues}</span>
      </div>
      </div>
      {movido && <p className="av-movido" data-aviso="precio-movido" role="status">{movido}</p>}
      {conTicket && ticketVence && (
        <div className="av-ticket" data-aviso="ticket" data-vence={ticketVence}>
          <div className="av-ticket-fila">
            <span className="av-ticket-k">{AVISO_ANALIZAR.soloNuevas}</span>
            <span className="av-ticket-vence">{AVISO_ANALIZAR.vence(ticketVence)}</span>
          </div>
          <div className="av-ticket-t">{AVISO_ANALIZAR.packTicket}<span className="av-ticket-s">{AVISO_ANALIZAR.unitario}</span></div>
        </div>
      )}
      {!sin && (editando && cambio ? (
        <>
          <div className="av-selects">
            <label className="av-campo">
              <span className="av-etq">{EXPLORAR_COPY.pie}</span>
              <select className="av-select" data-aviso="pie" aria-label={EXPLORAR_COPY.pie} value={combo.piePct} onChange={(e) => setCombo((x) => ({ ...x, piePct: Number(e.target.value) }))} disabled={analizando}>
                {PIES_POPUP.map((p) => <option key={p} value={p}>{p} %</option>)}
              </select>
            </label>
            <label className="av-campo">
              <span className="av-etq">{EXPLORAR_COPY.plazo}</span>
              <select className="av-select" data-aviso="plazo" aria-label={EXPLORAR_COPY.plazo} value={combo.plazoAnios} onChange={(e) => setCombo((x) => ({ ...x, plazoAnios: Number(e.target.value) }))} disabled={analizando}>
                {PLAZOS_POPUP.map((p) => <option key={p} value={p}>{p} años</option>)}
              </select>
            </label>
            {/* La tasa (30-oct-2026): «La de hoy (X %)», que sigue al motor, o una de la lista. Una fila entera: a 390 px no cabe al lado. */}
            <label className="av-campo av-campo-tasa">
              <span className="av-etq">{EXPLORAR_COPY.tasa}</span>
              <select className="av-select" data-aviso="tasa" aria-label={EXPLORAR_COPY.tasa} value={combo.tasaPct ?? ""} onChange={(e) => setCombo((x) => ({ ...x, tasaPct: e.target.value === "" ? null : Number(e.target.value) }))} disabled={analizando}>
                <option value="">{EXPLORAR_COPY.tasaHoy(finanzas.tasa)}</option>
                {TASAS_ELEGIBLES.map((t) => <option key={t} value={t}>{t.toLocaleString("es-CL", { maximumFractionDigits: 2 })} %</option>)}
              </select>
            </label>
          </div>
          {cambiada && recalculando && <p className="av-estado" role="status" aria-live="polite" data-aviso="recalculando">{EXPLORAR_COPY.recalculando}</p>}
          {cambiada && fallo && <p className="av-estado av-fallo" role="alert" data-aviso="fallo">{AVISO_ANALIZAR.sinRecalculo}</p>}
          {da && (
            <div className="av-cambio" data-aviso="cambio" data-empeora={da.empeora ? "1" : undefined} role="status" aria-live="polite">
              <b>{da.titulo}</b>
              <span>{da.detalle}</span>
            </div>
          )}
        </>
      ) : (
        <div className="av-combo" data-aviso="combo">
          <span>{c.antes}<b>{c.pie}</b>{c.medio}<b>{c.plazo}</b>{c.tasa && <>{c.fin}<b data-aviso="tasa-vista">{c.tasa}</b></>}</span>
          {cambio && !analizando && <button type="button" className="av-cambiar" data-modal-cambiar onClick={() => setEditando(true)}>{EXPLORAR_COPY.cambiar}</button>}
        </div>
      ))}
      {!sin && (
        <div className="wz-modal-der av-der" data-aviso="derivados">
          {derivados.map((d) => (
            <div key={d.label}>
              <div className="ol">{d.label}</div>
              <div className="ov">{d.valor}</div>
            </div>
          ))}
        </div>
      )}
      {!sin && editando && cambiada && (
        <label className="av-guardar" data-aviso="guardar" data-modal-guardar>
          <input type="checkbox" checked={guardar} onChange={(e) => setGuardar(e.target.checked)} disabled={analizando} />
          {EXPLORAR_COPY.guardarPerfil(combo.piePct, combo.plazoAnios, combo.tasaPct)}
        </label>
      )}
    </div>
  );

  // Después de «Analizar»: el mismo pop-up, con lo que pasa con el informe. No se cierra mientras genera.
  if (informe) return <InformeEnCamino paso={informe} alCerrar={alCerrarInforme ?? alCancelar} alReintentar={alReintentarInforme} />;

  // Lo que vio al tocar «Analizar»: lo recalculado si cambió el pie o el plazo, si no la tarjeta.
  const vista: VeredictoVisto | null = cambio ? (cambiada && recal ? { veredicto: recal.veredicto, score: recal.score } : { veredicto: cambio.base.veredicto, score: cambio.base.score }) : null;
  return (
    <ModalPlausibilidad
      open
      anomalias={[]}
      marca={sin ? "aviso-analizar-sin" : "aviso-analizar"}
      compacto
      titulo={sin ? "" : AVISO_ANALIZAR.titulo}
      cuerpo={cuerpo}
      consumo={sin ? (conTicket && ticketVence ? null : compras ? compras.sin : AVISO_ANALIZAR.sin) : textoUso(uso)}
      nota={(!sin && ticketConSaldo) || planLinea ? (
        <>
          {!sin && ticketConSaldo && <EnlaceCarga href={ticketConSaldo.href} className="wz-modal-nota-enlace" data-modal-ticket>{ticketConSaldo.texto}</EnlaceCarga>}
          {!sin && ticketConSaldo && planLinea && <br />}
          {planLinea && <EnlaceCarga href={planLinea.href} className="wz-modal-nota-enlace" data-modal-plan>{planLinea.texto}</EnlaceCarga>}
        </>
      ) : undefined}
      labelConfirmar={sin ? (conTicket && ticketVence ? AVISO_ANALIZAR.aprovechar : compras ? compras.pack.label : AVISO_ANALIZAR.comprar) : analizar}
      labelRevisar={AVISO_ANALIZAR.cancelar}
      labelGenerando={COMPRA_DEPTO.analizando}
      submitting={analizando}
      bloqueado={bloqueado}
      secundario={sin && compras ? { label: compras.suelto.label, onClick: () => comprar(compras.suelto.href), boton: true } : undefined}
      onConfirmar={sin ? () => comprar(compras ? compras.pack.href : rutaCompra) : () => alAnalizar(cambio ? { combinacion: combo, guardarPerfil: cambiada && guardar, vista } : undefined)}
      onCerrar={alCancelar}
    />
  );
}
