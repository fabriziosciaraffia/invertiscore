"use client";

// ─────────────────────────────────────────────────────────────────────────────
// El aviso antes de gastar un análisis (13-oct-2026; reglas y copy en lib/guia/aviso-analizar.ts). Lo abren
// «Analizar este» de la página semanal y de la guía. Es EL MISMO modal de confirmación del wizard (ModalPlausibilidad,
// estado limpio; pedido de Fabrizio): el depto, la modalidad, destacado que va con el pie y el plazo de la persona, los
// datos que muestra el wizard —precio por m², pie, dividendo, retorno bruto— más el precio y la superficie, lo que usa
// («Usa 1 de tus N análisis.») y Analizar / Cancelar. Sin análisis, el mismo modal ofrece el pack de tres y lleva a
// pagarlo; después de pagar se vuelve a la página.
// DESDE LA SELECCIÓN (21-oct-2026, recorrido real de Fabrizio por la puerta B): al tocar «Analizar», el aviso queda abierto
// con «Franco está analizando este depto…» y la barra de carga del header —el mismo efecto que el wizard— hasta que abre el
// informe (`analizando`). Sin saldo, el pack de tres es el principal —al precio del ticket si la cuenta tiene menos de 24
// horas— y debajo «Comprar solo 1 · $9.990» (`compras`, lib/guia/compra-desde-depto.ts).
// CON «CAMBIAR» (23-oct-2026, desde Explorar; 4-ticket-y-popups.html D1/D2): con `cambio`, la línea del pie y el plazo
// trae «Cambiar»; al tocarlo, dos selectores (pie y plazo), el veredicto recalculado por el servidor con el cambio
// («Con pie 10 % este depto da Ajustar. Flujo mensual −$45.120 de tu bolsillo. Con 20 % daba Comprar 88 y +$88.363.»), la
// casilla «Guardar 10 % y 25 años como mi perfil de búsqueda» y, si empeora, el botón dice «Analizar igual». Lo elegido
// viaja en `alAnalizar`; sin tocar «Cambiar», el pop-up es el de siempre.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { claveActual, iniciarCarga } from "@/lib/carga-global";
import { chipOcupado } from "@/lib/carga-global";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { EXPLORAR_COPY, PIES_POPUP, PLAZOS_POPUP, textoCambio, type Recalculo } from "@/lib/explorar/explorar";
import { COMPRA_DEPTO, type ComprasDelDepto } from "@/lib/guia/compra-desde-depto";
import { ModalPlausibilidad } from "@/components/formulario-v4/ModalPlausibilidad";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { AVISO_ANALIZAR, derivadosAviso, destacadoCombinacion, textoUso, type FinanzasAviso, type UsoAnalisis } from "@/lib/guia/aviso-analizar";
import "@/components/formulario-v4/wizard-v4.css";

export interface EleccionAnalizar {
  combinacion: { piePct: number; plazoAnios: number };
  /** Marcó la casilla: el pie y el plazo nuevos quedan en su perfil de búsqueda. */
  guardarPerfil: boolean;
}

export function AvisoAntesDeAnalizar({ depto, combinacion, finanzas, uso, rutaCompra, alAnalizar, alCancelar, modalidad = "ltr", analizando = false, compras = null, ticketConSaldo = null, cambio = null }: {
  depto: { comuna: string; tipologia: string | null; m2: number; precioUF: number };
  /** Renta corta (14-oct-2026): el ingreso estimado por zona va en `finanzas.arriendo`. La última línea es la de siempre,
   *  «Usa 1 de tus N análisis», sin condición (15-oct-2026). */
  modalidad?: "ltr" | "str";
  /** El pie y el plazo con que se analiza. */
  combinacion: { piePct: number; plazoAnios: number };
  finanzas: FinanzasAviso;
  uso: UsoAnalisis;
  /** El checkout del pack, con su origen y la vuelta a esta página. */
  rutaCompra: string;
  alAnalizar: (eleccion?: EleccionAnalizar) => void;
  alCancelar: () => void;
  /** «Cambiar» el pie y el plazo (Explorar): cómo recalcular y qué daba con la combinación de apertura. */
  cambio?: { recalcular: (combo: { piePct: number; plazoAnios: number }) => Promise<Recalculo | null>; base: { veredicto: string; score: number | null; flujo: number | null } } | null;
  /** Se está generando el informe: el aviso queda abierto, cargando, hasta que se abre. */
  analizando?: boolean;
  /** Sin saldo, desde la selección: el pack (principal) y el suelto (debajo), con la vuelta a este depto. */
  compras?: ComprasDelDepto | null;
  /** CON SALDO Y EL TICKET VIVO (22-oct-2026, decisión de Fabrizio): se usa el saldo como siempre y debajo una sola línea,
   *  «Hoy, 3 más por $14.990 · vence mañana 11:17», como enlace, sin frenar. */
  ticketConSaldo?: { texto: string; href: string } | null;
}) {
  const router = useRouter();
  const sin = uso.tipo === "sin";
  // El cambio de pie y plazo (Explorar): la combinación elegida, si está editando y qué da con ella.
  const [combo, setCombo] = useState(combinacion);
  const [editando, setEditando] = useState(false);
  const [recal, setRecal] = useState<Recalculo | null>(null);
  const [recalculando, setRecalculando] = useState(false);
  const [guardar, setGuardar] = useState(true);
  const pedido = useRef(0);
  const cambiada = combo.piePct !== combinacion.piePct || combo.plazoAnios !== combinacion.plazoAnios;
  useEffect(() => {
    if (!cambio || !cambiada) { setRecal(null); setRecalculando(false); return; }
    const n = ++pedido.current;
    setRecalculando(true);
    void cambio.recalcular(combo).then((r) => { if (pedido.current === n) { setRecal(r); setRecalculando(false); } }).catch(() => { if (pedido.current === n) { setRecal(null); setRecalculando(false); } });
    // `cambio` no cambia entre renders del mismo pop-up; lo que importa es la combinación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combo.piePct, combo.plazoAnios, cambiada]);
  const d = destacadoCombinacion(combo);
  const comprar = (href: string) => { iniciarCarga(claveActual()); router.push(href); };
  const da = cambio && cambiada && recal ? textoCambio({ antes: { pie: combinacion.piePct, ...cambio.base }, despues: { pie: combo.piePct, plazo: combo.plazoAnios, veredicto: recal.veredicto, score: recal.score, flujo: recal.flujo } }, (v) => etiquetaVeredicto(v, "frase")) : null;
  const c = EXPLORAR_COPY.conPieYPlazo(combo.piePct, combo.plazoAnios);
  const destacado = cambio ? (
    <>
      {c.antes}<b>{c.pie}</b>{c.medio}<b>{c.plazo}</b>
      {!editando && <>{" · "}<button type="button" className="wz-modal-cambiar" data-modal-cambiar onClick={() => setEditando(true)}>{EXPLORAR_COPY.cambiar}</button></>}
    </>
  ) : (
    <>Con el pie de <b>{d.pie}</b> y el plazo de <b>{d.plazo}</b> de tu perfil</>
  );
  const extra = cambio && editando ? (
    <>
      <div className="wz-modal-cambio" data-modal-cambio>
        <label {...chipOcupado(recalculando)}>
          {EXPLORAR_COPY.pie}
          <select aria-label={EXPLORAR_COPY.pie} value={combo.piePct} onChange={(e) => setCombo((x) => ({ ...x, piePct: Number(e.target.value) }))} disabled={analizando}>
            {PIES_POPUP.map((p) => <option key={p} value={p}>{p} %</option>)}
          </select>
        </label>
        <label>
          {EXPLORAR_COPY.plazo}
          <select aria-label={EXPLORAR_COPY.plazo} value={combo.plazoAnios} onChange={(e) => setCombo((x) => ({ ...x, plazoAnios: Number(e.target.value) }))} disabled={analizando}>
            {PLAZOS_POPUP.map((p) => <option key={p} value={p}>{p} años</option>)}
          </select>
        </label>
      </div>
      {cambiada && (recalculando ? (
        <p className="wz-modal-da-s" role="status" aria-live="polite" data-modal-recalculando>{EXPLORAR_COPY.recalculando}</p>
      ) : da ? (
        <div className="wz-modal-da" data-modal-da={da.empeora ? "empeora" : "da"} data-empeora={da.empeora ? "1" : undefined} role="status" aria-live="polite">
          <p className="wz-modal-da-t">{da.titulo}</p>
          <p className="wz-modal-da-s">{da.detalle}</p>
        </div>
      ) : null)}
      {cambiada && (
        <label className="wz-modal-guardar" data-modal-guardar>
          <input type="checkbox" checked={guardar} onChange={(e) => setGuardar(e.target.checked)} disabled={analizando} />
          {EXPLORAR_COPY.guardarPerfil(combo.piePct, combo.plazoAnios)}
        </label>
      )}
    </>
  ) : undefined;
  const analizar = da?.empeora ? EXPLORAR_COPY.analizarIgual : AVISO_ANALIZAR.analizar;
  return (
    <ModalPlausibilidad
      open
      anomalias={[]}
      marca={sin ? "aviso-analizar-sin" : "aviso-analizar"}
      titulo={sin ? AVISO_ANALIZAR.tituloSin : AVISO_ANALIZAR.titulo}
      resumen={{
        direccion: [depto.comuna, depto.tipologia].filter(Boolean).join(" · "),
        modalidad: modalidad === "str" ? AVISO_ANALIZAR.modalidadCorta : AVISO_ANALIZAR.modalidad,
        derivados: derivadosAviso(depto, combo, finanzas),
      }}
      destacado={destacado}
      extra={extra}
      consumo={sin && compras ? compras.sin : textoUso(uso)}
      nota={!sin && ticketConSaldo ? (
        <EnlaceCarga href={ticketConSaldo.href} className="wz-modal-nota-enlace" data-modal-ticket>{ticketConSaldo.texto}</EnlaceCarga>
      ) : undefined}
      labelConfirmar={sin ? (compras ? compras.pack.label : AVISO_ANALIZAR.comprar) : analizar}
      labelRevisar={AVISO_ANALIZAR.cancelar}
      labelGenerando={COMPRA_DEPTO.analizando}
      submitting={analizando || (cambiada && recalculando)}
      secundario={sin && compras ? { label: compras.suelto.label, onClick: () => comprar(compras.suelto.href) } : undefined}
      onConfirmar={sin ? () => comprar(compras ? compras.pack.href : rutaCompra) : () => alAnalizar(cambio ? { combinacion: combo, guardarPerfil: cambiada && guardar } : undefined)}
      onCerrar={alCancelar}
    />
  );
}
