"use client";

// ─────────────────────────────────────────────────────────────────────────────
// B · El ticket del pack (28-sep-2026; reglas del 08-oct-2026):
//   · La oferta es del INFORME: el caller lo monta mientras el informe que nació anónimo no tenga un
//     pack pagado y quien mira sea su dueño (`oferta-informe.ts`); la vigencia (24 h) la mira acá.
//   · Sube UNA vez por informe en cada navegador, con lo primero que pase (`disparo-ticket.ts`): 8 s
//     después de pasar «Tu resultado a 10 años», 4 minutos de lectura activa, o en PC el cursor que
//     sale de la página por arriba. Desde la marca del final hacia abajo, cerrado, queda la pestaña
//     para volver a él mientras la oferta viva.
//   · Cerrar o «Seguir leyendo» cambian a la despedida en el mismo lugar; «Sí, seguir leyendo»
//     cierra (y deja la pestaña). Nunca un segundo modal.
//   · El correo va adentro del ticket y el botón rojo va directo a Flow: POST /api/lo-que-sigue/pack
//     crea la cuenta si no existe, adopta este informe y abre la orden; sin salir del informe. Con el
//     correo conocido (recién dentro, la sesión o la cuenta de su navegador) no lo pide.
//   · El velo se ancla al área visible real (iOS esconde su barra al hacer scroll).
//   Vencido: no sube, no hay pestaña, y queda medido `pack_vencido`. Solo en el primer informe anónimo.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePostHog } from "@/lib/posthog-react";
import { fmtCLP } from "@/lib/pricing";
import { TICKET_PACK } from "@/lib/lo-que-sigue/copy";
import { capturarLqs, EVENTOS_LQS, type ContextoLqs } from "@/lib/lo-que-sigue/eventos";
import { debeSubirTicket, leerEstadoTicket, marcarTicket } from "@/lib/lo-que-sigue/estado-ticket";
import { crearDisparador, EVENTOS_ACTIVIDAD, SELECTOR_FIN_CAPITULOS, SELECTOR_FIN_RECOMENDACION } from "@/lib/lo-que-sigue/disparo-ticket";
import { usoBanner } from "@/lib/lo-que-sigue/uso-banner";
import { cuandoVence, horaVencimiento, ofertaPackVigente, PACK_AHORRO_CLP, PACK_PRECIO_CLP, PACK_UNITARIO_CLP, PACK_UNITARIO_REFERENCIA_CLP } from "@/lib/lo-que-sigue/oferta-pack";
import { useAnclaAbajo, useAnclaAreaVisible } from "@/lib/lo-que-sigue/area-visible";
import "./lo-que-sigue.css";

type Cara = "ticket" | "despedida";
const CORREO_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** PC con mouse: lo único donde se detecta la salida por arriba. */
function esPc(): boolean {
  try {
    return window.matchMedia("(pointer: fine)").matches && window.innerWidth >= 768;
  } catch {
    return false;
  }
}

export function TicketPack({ ctx, createdAt, correoSesion = null }: {
  ctx: ContextoLqs;
  createdAt: string;
  /** El correo con que paga, si ya se sabe (`correoDelTicket`): recién dentro, la sesión o la cuenta de
   *  su navegador de origen. Con él, el ticket no lo pide. */
  correoSesion?: string | null;
}) {
  const posthog = usePostHog();
  const sentinel = useRef<HTMLDivElement>(null);
  const velo = useRef<HTMLDivElement>(null);
  const pestanaRef = useRef<HTMLButtonElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [cara, setCara] = useState<Cara>("ticket");
  const [yaSubio, setYaSubio] = useState(false);
  const [vigente, setVigente] = useState(() => ofertaPackVigente(createdAt));
  const [correo, setCorreo] = useState("");
  const [pagando, setPagando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Desde la marca del final hacia abajo: ahí vive la pestaña (sin la barra fija, ya no hay nada más
  // abajo con qué turnarse; hasta el 08-oct-2026 era un estado compartido con la barra).
  const [zonaCierre, setZonaCierre] = useState(false);
  const hora = horaVencimiento(createdAt);
  const precio = fmtCLP(PACK_PRECIO_CLP);
  const pestana = zonaCierre && !abierto && yaSubio && vigente;

  // Anclados desde el montaje, no al abrir: en iOS fijarlos al abrir movía el borde a mitad de la transición.
  useAnclaAreaVisible(velo);
  useAnclaAbajo(pestanaRef);

  // Cuándo sube (`disparo-ticket.ts`) y la zona de la pestaña: desde la marca del final de los capítulos
  // hacia abajo (sin la marca, el sentinel de acá, al final de la página).
  useEffect(() => {
    const marca = document.querySelector(SELECTOR_FIN_CAPITULOS) ?? sentinel.current;
    if (!marca) return;
    const almacen = typeof window !== "undefined" ? window.localStorage : null;
    if (leerEstadoTicket(almacen, ctx.analysisId) !== "nunca") setYaSubio(true);
    const d = crearDisparador({
      reloj: { ahora: () => Date.now(), programar: (fn, ms) => window.setTimeout(fn, ms), cancelar: (h) => window.clearTimeout(h as number) },
      // Una vez por informe en este navegador, y solo con la oferta viva.
      puedeSubir: () => debeSubirTicket(leerEstadoTicket(almacen, ctx.analysisId)) && ofertaPackVigente(createdAt),
      // Mientras la persona usa el banner del registro, el ticket no le sube encima (08-oct-2026).
      enEspera: () => usoBanner.enUso(),
      subir: (motivo) => {
        marcarTicket(almacen, ctx.analysisId, "visto");
        setYaSubio(true);
        abrir("solo", motivo);
      },
    });
    let vencidoMedido = false;
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          const enZona = e.isIntersecting || e.boundingClientRect.top < 0;
          setZonaCierre(enZona);
          if (enZona) {
            d.llegoAlFinal();
          }
          // Vencido al llegar al final: no sube, no hay pestaña, y se mide una vez.
          if (enZona && !vencidoMedido && !ofertaPackVigente(createdAt) && debeSubirTicket(leerEstadoTicket(almacen, ctx.analysisId))) {
            vencidoMedido = true;
            setVigente(false);
            capturarLqs(posthog, EVENTOS_LQS.packVencido, ctx, { donde: "cliente", vence: hora });
            marcarTicket(almacen, ctx.analysisId, "despedida");
          }
        }
      },
      { threshold: 0 },
    );
    io.observe(marca);
    // Pasó la recomendación de Franco: desde ahí cuenta la salida por arriba (08-oct-2026).
    const finReco = document.querySelector(SELECTOR_FIN_RECOMENDACION);
    const ioReco = finReco
      ? new IntersectionObserver((entradas) => {
          for (const e of entradas) if (e.isIntersecting || e.boundingClientRect.top < 0) d.pasoLaRecomendacion();
        }, { threshold: 0 })
      : null;
    if (finReco && ioReco) ioReco.observe(finReco);
    const actividad = () => d.actividad();
    for (const ev of EVENTOS_ACTIVIDAD) window.addEventListener(ev, actividad, { passive: true });
    const lectura = window.setInterval(() => d.tick(document.visibilityState === "visible"), 1000);
    const alSalir = (e: MouseEvent) => d.salida({ clientY: e.clientY, haciaFuera: !e.relatedTarget, pc: esPc() });
    document.addEventListener("mouseout", alSalir);
    return () => {
      d.detener();
      io.disconnect();
      ioReco?.disconnect();
      for (const ev of EVENTOS_ACTIVIDAD) window.removeEventListener(ev, actividad);
      window.clearInterval(lectura);
      document.removeEventListener("mouseout", alSalir);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.analysisId, createdAt]);

  // Atrás y Esc: la misma coreografía que la X (nunca cierran de golpe).
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (cara === "ticket") despedirse();
      else cerrarDelTodo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, cara]);

  function abrir(desde: "solo" | "pestaña", motivo?: string) {
    if (!ofertaPackVigente(createdAt)) {
      setVigente(false);
      return;
    }
    setCara("ticket");
    setError(null);
    setAbierto(true);
    capturarLqs(posthog, EVENTOS_LQS.ticketVisto, ctx, { vence: hora, desde, ...(motivo ? { motivo } : {}) });
  }

  function despedirse() {
    if (cara === "despedida") return;
    setCara("despedida");
    capturarLqs(posthog, EVENTOS_LQS.despedidaVista, ctx, { vence: hora });
  }

  function cerrarDelTodo() {
    marcarTicket(typeof window !== "undefined" ? window.localStorage : null, ctx.analysisId, "despedida");
    setAbierto(false);
  }

  async function pagar(e: FormEvent) {
    e.preventDefault();
    const c = (correoSesion ?? correo).trim().toLowerCase();
    if (!CORREO_OK.test(c)) {
      setError(TICKET_PACK.errorCorreo);
      return;
    }
    setError(null);
    setPagando(true);
    capturarLqs(posthog, EVENTOS_LQS.packIniciado, ctx, { desde: cara, vence: hora });
    try {
      const res = await fetch("/api/lo-que-sigue/pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: c, analysisId: ctx.analysisId }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        // La página se descarga hacia Flow con el botón presionado.
        window.location.href = data.url;
        return;
      }
      setPagando(false);
      if (res.status === 410) {
        setVigente(false);
        setError(TICKET_PACK.vencido);
        return;
      }
      setError(data.error && res.status < 500 ? data.error : TICKET_PACK.errorPago);
    } catch {
      setPagando(false);
      setError(TICKET_PACK.errorPago);
    }
  }

  return (
    <>
      <div ref={sentinel} data-lqs="cierre-sentinel" aria-hidden="true" style={{ height: 1 }} />
      <button
        ref={pestanaRef}
        type="button"
        className="lqs-pestana doc-tokens"
        data-lqs="pestana"
        data-visible={pestana ? "1" : "0"}
        aria-hidden={!pestana}
        tabIndex={pestana ? 0 : -1}
        onClick={() => abrir("pestaña")}
      >
        {TICKET_PACK.pestana(precio, hora)}
      </button>
      <div
        ref={velo}
        className="lqs-velo doc-tokens"
        data-lqs="ticket"
        data-abierto={abierto ? "1" : "0"}
        data-cara={cara}
        role={abierto ? "dialog" : undefined}
        aria-modal={abierto || undefined}
        aria-label={TICKET_PACK.linea(precio)}
        onClick={(e) => { if (e.target !== e.currentTarget) return; if (cara === "ticket") despedirse(); else cerrarDelTodo(); }}
      >
        <div className="lqs-hoja">
          <div className="lqs-franja" aria-hidden="true" />
          <div className="lqs-asa" aria-hidden="true" />
          <div className="lqs-tk">
            <form className="lqs-cara" data-activa={cara === "ticket" ? "1" : "0"} onSubmit={pagar} noValidate>
              {/* Tercera pasada (08-oct-2026): el titular en una línea; debajo, más chico, el precio por
                  análisis; el cuerpo en un solo tamaño, tres líneas. */}
              <div className="lqs-cab">
                <div>
                  <p className="lqs-tk-titular" data-lqs="ticket-linea">{TICKET_PACK.linea(precio)}</p>
                  <p className="lqs-tk-precio"><s>{fmtCLP(PACK_UNITARIO_REFERENCIA_CLP)}</s>{TICKET_PACK.cadaUno(fmtCLP(PACK_UNITARIO_CLP))}</p>
                </div>
                <button type="button" className="lqs-x" onClick={despedirse} aria-label={TICKET_PACK.cerrar}>✕</button>
              </div>
              <p className="lqs-tk-cuerpo">
                {TICKET_PACK.cuerpo}
                <br />
                <b>{TICKET_PACK.cuerpoFuerte}</b>
                <br />
                <b>{TICKET_PACK.negrita}</b>
              </p>
              {!correoSesion && (
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  className="lqs-tk-correo"
                  placeholder={TICKET_PACK.placeholderCorreo}
                  aria-label="Tu correo"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                />
              )}
              {error && <p className="lqs-tk-error" role="alert">{error}</p>}
              <button type="submit" className="lqs-rojo" disabled={pagando} data-presionado={pagando ? "1" : undefined}>{TICKET_PACK.boton(precio)}</button>
              <p className="lqs-tk-vence" data-lqs="ticket-vence">{TICKET_PACK.vencimiento(cuandoVence(createdAt))}</p>
              <button type="button" className="lqs-seguir" onClick={despedirse}>{TICKET_PACK.seguir}</button>
            </form>
            <div className="lqs-cara" data-activa={cara === "despedida" ? "1" : "0"}>
              <div className="lqs-cab"><p className="lqs-tk-ojo">{TICKET_PACK.linea(precio)}</p><span /></div>
              <p className="lqs-despedida-t">{TICKET_PACK.despedida(hora)}</p>
              <p className="lqs-despedida-s">{TICKET_PACK.despedidaAhorro(fmtCLP(PACK_AHORRO_CLP))}</p>
              <button type="button" className="lqs-rojo" onClick={() => { setCara("ticket"); setError(null); }}>{TICKET_PACK.comprar}</button>
              <button type="button" className="lqs-tinta" onClick={cerrarDelTodo}>{TICKET_PACK.siSeguir}</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
