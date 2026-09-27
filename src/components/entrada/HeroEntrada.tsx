"use client";

// ─────────────────────────────────────────────────────────────────────────────
// HeroEntrada — la puerta de Franco. UNA PUERTA, DOS ACCESOS (26-sep-2026).
//
// El título, el campo de dirección y los dos caminos sin dirección («Estoy en el depto» y
// «Marcarlo en el mapa»), con el material del hero de la landing v14. Es la primera pantalla del
// wizard (nodo `dir`) y será el hero de la landing cuando ésta mergee: el MISMO componente, no una
// copia. Lo único que cambia entre los dos accesos es qué hace quien lo monta con la respuesta —el
// wizard la guarda y avanza; la landing navega al wizard con ella— y lo que va en la cabecera y el
// pie.
//
// Elegir del desplegable ES enviar, igual en los dos: no hay un segundo botón que confirmar. Con el
// botón o Enter sin haber elegido, se intenta el respaldo por texto; si tampoco resuelve, lo dice y
// ofrece el mapa. Nunca un callejón sin salida.
//
// EN EL TELÉFONO, UNA HOJA (27-sep-2026, pruebas de Fabrizio): el desplegable de Places colgaba bajo
// el campo, a media pantalla, cortado y tapado por el teclado. Bajo 768 px, tocar el campo abre la
// hoja de los capítulos y los pop-ups —el mismo `Modal`, con su asa, su velo y su cierre; ver
// `HojaDireccion.tsx`—, que sube desde abajo y deja el hero a la vista arriba. El campo va arriba de
// la hoja y las sugerencias pegadas debajo, así el teclado queda bajo ellas. La hoja se abre y se
// enfoca en el mismo toque (`flushSync` + `focus`), que es lo que deja a iOS abrir el teclado; por
// eso su código se precarga apenas se sabe que es un teléfono. En escritorio, el desplegable.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, type ChangeEvent, type ComponentType, type FormEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useDireccionPlaces, type SeleccionDireccion } from "./useDireccionPlaces";
import "./hero-entrada.css";

/** Direcciones reales del catálogo (07-sep-2026, landing v14), las que caben a 19 px en el campo a
 *  390 px sin cortarse: ≤26 caracteres con comuna. */
export const DIRECCIONES_EJEMPLO = [
  "Linares 1415, Providencia",
  "Zañartu 980, Ñuñoa",
  "Lazo 1365, San Miguel",
  "Juan Mitjans 105, Macul",
  "Lia Aguirre 95, La Florida",
] as const;

export type CaminoSinDireccion = "ubicacion" | "mapa";

/** Bajo este ancho el campo abre la hoja a pantalla completa. */
export const MQ_HOJA = "(max-width: 767px)";

function useUsaHoja(): boolean {
  const [usa, setUsa] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(MQ_HOJA);
    const leer = () => setUsa(mq.matches);
    leer();
    mq.addEventListener("change", leer);
    return () => mq.removeEventListener("change", leer);
  }, []);
  return usa;
}

/** Lo que el campo le cuenta a quien lo monta, para su telemetría. */
export type EventoCampo =
  | { tipo: "foco" }
  | { tipo: "texto"; largo: number }
  | { tipo: "respaldo"; resuelto: boolean };

export function HeroEntrada({
  cabecera,
  pie,
  antes,
  despues,
  valorInicial = "",
  confirmada = null,
  onContinuarConfirmada,
  avisoExterno = null,
  ocupado = null,
  onDireccion,
  onCamino,
  onEvento,
}: {
  /** La cabecera: el header único (HeaderFranco) «sobre material», que pone quien monta el hero
   *  (27-sep-2026; antes el hero dibujaba la suya, con su wordmark y su «Entrar»). */
  cabecera?: ReactNode;
  /** Enlace del pie («Ver un análisis de ejemplo»). */
  pie?: ReactNode;
  /** Sobre el título: el aviso de un análisis a medias. */
  antes?: ReactNode;
  /** Bajo el campo: el rechazo de cobertura y su lista de espera. */
  despues?: ReactNode;
  valorInicial?: string;
  /** La dirección que ya quedó confirmada (volver a la portada desde la pregunta siguiente). Si el
   *  texto no cambió, la flecha sigue sin volver a buscarla. */
  confirmada?: string | null;
  onContinuarConfirmada?: () => void;
  /** Un aviso que decide quien monta (p. ej. la ubicación del teléfono no se pudo usar). */
  avisoExterno?: string | null;
  /** Un camino en curso: deshabilita los botones mientras tanto. */
  ocupado?: CaminoSinDireccion | "escribir" | null;
  /** Una dirección que ES una calle (con o sin número). La cobertura la decide quien monta. */
  onDireccion: (sel: SeleccionDireccion) => void;
  onCamino: (camino: CaminoSinDireccion) => void;
  onEvento?: (e: EventoCampo) => void;
}) {
  const [texto, setTexto] = useState(valorInicial);
  const [enfocado, setEnfocado] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const seleccionRef = useRef<SeleccionDireccion | null>(null);
  const onEventoRef = useRef(onEvento);
  onEventoRef.current = onEvento;
  const focoMedido = useRef(false);
  const usaHoja = useUsaHoja();
  const [hoja, setHoja] = useState(false);
  // El componente de la hoja, cargado aparte: se pide apenas se sabe que es un teléfono, para que al
  // tocar el campo ya esté y la hoja se abra (y enfoque) en el mismo toque.
  const [Hoja, setHojaComp] = useState<ComponentType<{ abierto: boolean; onClose: () => void; children: ReactNode }> | null>(null);
  useEffect(() => {
    if (!usaHoja || Hoja) return;
    let vivo = true;
    import("./HojaDireccion").then((m) => { if (vivo) setHojaComp(() => m.default); });
    return () => { vivo = false; };
  }, [usaHoja, Hoja]);

  const entregar = (sel: SeleccionDireccion) => {
    // Una opción que no es una calle (un barrio, una comuna) no se confirma: se dice acá.
    if (!sel.precision) {
      setAviso("Esa opción no es una calle. Escribe la calle del depto y elígela de la lista.");
      return;
    }
    setAviso(null);
    setHoja(false);
    onDireccion(sel);
  };

  // El <input> vivo es uno solo: el del hero (escritorio) o el de la hoja (teléfono, abierta). Con la
  // hoja cerrada en el teléfono no hay input: el hero muestra un botón que la abre.
  const { inputRef, geocodificarEscrita } = useDireccionPlaces({
    activo: true,
    comuna: null,
    clave: !usaHoja ? "hero" : hoja && Hoja ? "hoja" : "cerrada",
    onSeleccion: (sel) => {
      seleccionRef.current = sel;
      setTexto(sel.direccion);
      entregar(sel);
    },
  });

  // ── Placeholder: escribe y borra direcciones reales; quieto con reduced-motion ──
  const [ph, setPh] = useState<string>(DIRECCIONES_EJEMPLO[0]);
  const animar = !enfocado && !hoja && texto === "";
  useEffect(() => {
    if (!animar) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPh(DIRECCIONES_EJEMPLO[0]);
      return;
    }
    let k = 0, i = 0, borrando = false;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const s = DIRECCIONES_EJEMPLO[k];
      if (!borrando) {
        i++;
        setPh(s.slice(0, i));
        if (i === s.length) { borrando = true; t = setTimeout(tick, 1600); return; }
        t = setTimeout(tick, 60);
        return;
      }
      i--;
      setPh(s.slice(0, i));
      if (i === 0) { borrando = false; k = (k + 1) % DIRECCIONES_EJEMPLO.length; t = setTimeout(tick, 500); return; }
      t = setTimeout(tick, 26);
    };
    t = setTimeout(tick, 900);
    return () => clearTimeout(t);
  }, [animar]);

  const medirFoco = () => {
    if (!focoMedido.current) { focoMedido.current = true; onEventoRef.current?.({ tipo: "foco" }); }
  };

  // Abrir y enfocar en el MISMO toque: si el foco llega después de un render asíncrono, iOS no abre
  // el teclado.
  const abrirHoja = () => {
    flushSync(() => setHoja(true));
    inputRef.current?.focus();
    medirFoco();
  };

  useEffect(() => {
    if (!usaHoja) setHoja(false);
  }, [usaHoja]);

  // Si la hoja se tocó antes de que su código llegara, se abre cuando llega y el campo se enfoca
  // igual (en iOS, sin teclado hasta que se toque el campo: el foco ya no viene del toque).
  useEffect(() => {
    if (hoja && Hoja && document.activeElement !== inputRef.current) inputRef.current?.focus();
  }, [hoja, Hoja, inputRef]);

  // Con la hoja abierta, las sugerencias de Places se fijan justo bajo el campo de la hoja. El bloqueo
  // del scroll, Escape y atrás los pone el Modal. La posición se mide sin la animación de entrada:
  // la distancia del campo al borde de la hoja (las dos se transforman igual) más el borde final.
  useEffect(() => {
    if (!hoja) return;
    const html = document.documentElement;
    html.classList.add("he-hoja-abierta");
    const colocar = () => {
      const inp = inputRef.current;
      const modal = inp?.closest(".v-modal") as HTMLElement | null;
      if (!inp || !modal) return;
      const dentro = inp.getBoundingClientRect().bottom - modal.getBoundingClientRect().top;
      html.style.setProperty("--he-pac-top", `${Math.round(window.innerHeight - modal.offsetHeight + dentro + 6)}px`);
    };
    colocar();
    const t = setTimeout(colocar, 260);
    window.addEventListener("resize", colocar);
    window.visualViewport?.addEventListener("resize", colocar);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", colocar);
      window.visualViewport?.removeEventListener("resize", colocar);
      html.classList.remove("he-hoja-abierta");
      html.style.removeProperty("--he-pac-top");
    };
  }, [hoja, Hoja, inputRef]);

  const onCambio = (e: ChangeEvent<HTMLInputElement>) => {
    setTexto(e.target.value);
    seleccionRef.current = null;
    setAviso(null);
    onEventoRef.current?.({ tipo: "texto", largo: e.target.value.trim().length });
  };

  const enviar = async (e?: FormEvent) => {
    e?.preventDefault();
    if (buscando) return;
    const sel = seleccionRef.current;
    if (sel && sel.direccion === texto.trim()) { entregar(sel); return; }
    if (confirmada && texto.trim() === confirmada && onContinuarConfirmada) { onContinuarConfirmada(); return; }
    const q = texto.trim();
    if (!q) {
      if (usaHoja && !hoja) abrirHoja(); else inputRef.current?.focus();
      return;
    }
    setBuscando(true);
    const r = await geocodificarEscrita(q);
    setBuscando(false);
    onEventoRef.current?.({ tipo: "respaldo", resuelto: !!r });
    if (!r) {
      setAviso("No encuentro esa dirección. Elígela de la lista, o márcala en el mapa.");
      return;
    }
    seleccionRef.current = r;
    setTexto(r.direccion);
    entregar(r);
  };

  const mostrado = aviso ?? avisoExterno;
  const deshabilitado = buscando || !!ocupado;

  return (
    <section className="he-root" aria-label="Analiza un departamento">
      {/* Fondo: la escala de la tríada, generada a la resolución de cada variante (landing v14). */}
      <picture className="he-fondo">
        <source media="(min-width: 768px)" srcSet="/landing/hero-d1x.webp 1x, /landing/hero-d2x.webp 2x" />
        <source srcSet="/landing/hero-m1x.webp 1x, /landing/hero-m2x.webp 2x, /landing/hero-m3x.webp 3x" />
        {/* eslint-disable-next-line @next/next/no-img-element -- textura de marca ya en WebP; es el LCP */}
        <img src="/landing/hero-m2x.webp" alt="" fetchPriority="high" decoding="async" />
      </picture>
      {cabecera}
      <div className="he-col he-mid">
        {antes}
        <h1 className="he-h1">¿Ese depto es<br /><mark>buena inversión</mark>?</h1>
        <div className="he-campo">
          <form className="he-box" onSubmit={enviar} role="search" aria-label="Dirección del departamento">
            <span className="he-tx">
              {usaHoja ? (
                <button
                  type="button"
                  className="he-input he-input-boton"
                  aria-haspopup="dialog"
                  aria-label="Escribe la dirección del departamento"
                  onClick={abrirHoja}
                  disabled={deshabilitado}
                >
                  {texto}
                </button>
              ) : (
                <input
                  ref={inputRef}
                  className="he-input"
                  type="text"
                  autoComplete="off"
                  inputMode="text"
                  aria-label="Escribe la dirección del departamento"
                  placeholder={DIRECCIONES_EJEMPLO[0]}
                  value={texto}
                  onChange={onCambio}
                  onFocus={() => { setEnfocado(true); medirFoco(); }}
                  onBlur={() => setEnfocado(false)}
                />
              )}
              {animar && (
                <span className="he-ph" aria-hidden="true">{ph}<span className="he-caret" /></span>
              )}
            </span>
            <button type="submit" className="he-btn" aria-label="Analizar esta dirección" disabled={deshabilitado}>→</button>
          </form>
          {mostrado && <p className="he-aviso" role="status">{mostrado}</p>}
          <div className="he-alt">
            <span className="he-alt-q">¿No tienes la dirección?</span>
            <span className="he-alt-acciones">
              <button type="button" onClick={() => onCamino("ubicacion")} disabled={deshabilitado}>
                {ocupado === "ubicacion" ? "Buscando tu ubicación…" : "Estoy en el depto"}<span aria-hidden="true">→</span>
              </button>
              <button type="button" onClick={() => onCamino("mapa")} disabled={deshabilitado}>
                Marcarlo en el mapa<span aria-hidden="true">→</span>
              </button>
            </span>
          </div>
        </div>
        {despues}
      </div>
      {pie && <div className="he-col he-foot">{pie}</div>}
      {Hoja && hoja && (
        <Hoja abierto onClose={() => setHoja(false)}>
          <form className="he-hoja-campo" onSubmit={enviar} role="search" aria-label="Dirección del departamento">
            <input
              ref={inputRef}
              className="he-hoja-input"
              type="text"
              autoComplete="off"
              inputMode="text"
              enterKeyHint="search"
              aria-label="Escribe la dirección del departamento"
              placeholder="Calle y número"
              value={texto}
              onChange={onCambio}
            />
            <button type="submit" className="he-hoja-ir" aria-label="Analizar esta dirección" disabled={deshabilitado}>→</button>
          </form>
          {buscando ? (
            <p className="he-hoja-ayuda">Buscando la dirección…</p>
          ) : aviso ? (
            <p className="he-hoja-aviso" role="status">{aviso}</p>
          ) : (
            <p className="he-hoja-ayuda">Escribe la calle y el número, y elige la dirección de la lista.</p>
          )}
          <div className="he-hoja-alt">
            <span>¿No tienes la dirección?</span>
            <button type="button" onClick={() => { setHoja(false); onCamino("ubicacion"); }}>Estoy en el depto<span aria-hidden="true">→</span></button>
            <button type="button" onClick={() => { setHoja(false); onCamino("mapa"); }}>Marcarlo en el mapa<span aria-hidden="true">→</span></button>
          </div>
        </Hoja>
      )}
    </section>
  );
}
