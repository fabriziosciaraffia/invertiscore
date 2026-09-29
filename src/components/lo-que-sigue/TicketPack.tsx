"use client";

// ─────────────────────────────────────────────────────────────────────────────
// B · El ticket del pack (28-sep-2026, ajustes de Fabrizio tras probarlo en el teléfono):
//   · Zona del cierre: desde el sentinel hasta el final de la página. Al entrar, el ticket sube
//     UNA vez (solo, nunca más); cerrado, queda una pestaña chica —«3 análisis por $5.000 · hasta
//     las 21:04»— para volver a él mientras la oferta viva. Al subir de la zona, vuelve la barra.
//     Regla: NO VUELVE SOLO, pero se puede volver desde la pestaña.
//   · Cerrar o «Seguir leyendo» cambian a la despedida en el mismo lugar; «Sí, seguir leyendo»
//     cierra (y deja la pestaña). Nunca un segundo modal.
//   · El correo va adentro del ticket y el botón rojo va directo a Flow: POST /api/lo-que-sigue/pack
//     crea la cuenta si no existe, adopta este informe y abre la orden; sin salir del informe.
//   · El velo se ancla al área visible real (iOS esconde su barra al hacer scroll).
//   Vencido: no sube, no hay pestaña, y queda medido `pack_vencido`. Solo en el primer informe anónimo.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePostHog } from "@/lib/posthog-react";
import { fmtCLP } from "@/lib/pricing";
import { FRASE_PACK, TICKET_PACK, veredictoLqs } from "@/lib/lo-que-sigue/copy";
import { capturarLqs, EVENTOS_LQS, type ContextoLqs } from "@/lib/lo-que-sigue/eventos";
import { abrirTicket, cerrarTicket, entrarZonaCierre, salirZonaCierre, useEstadoBorde } from "@/lib/lo-que-sigue/estado-ui";
import { debeSubirTicket, leerEstadoTicket, marcarTicket } from "@/lib/lo-que-sigue/estado-ticket";
import { diaVencimiento, horaVencimiento, ofertaPackVigente, PACK_PRECIO_CLP, PACK_UNITARIO_CLP, PACK_UNITARIO_REFERENCIA_CLP } from "@/lib/lo-que-sigue/oferta-pack";
import { useAnclaAbajo, useAnclaAreaVisible } from "@/lib/lo-que-sigue/area-visible";
import "./lo-que-sigue.css";

type Cara = "ticket" | "despedida";
const CORREO_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function TicketPack({ ctx, createdAt }: { ctx: ContextoLqs; createdAt: string }) {
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
  const { zonaCierre } = useEstadoBorde();
  const v = veredictoLqs(ctx.veredicto);
  const hora = horaVencimiento(createdAt);
  const dia = diaVencimiento(createdAt);
  const pestana = zonaCierre && !abierto && yaSubio && vigente;

  // Anclados desde el montaje, no al abrir: en iOS fijarlos al abrir movía el borde a mitad de la transición.
  useAnclaAreaVisible(velo);
  useAnclaAbajo(pestanaRef);

  // La zona del cierre: el sentinel está a la vista o quedó arriba (la página sigue por debajo).
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const almacen = typeof window !== "undefined" ? window.localStorage : null;
    const estado0 = leerEstadoTicket(almacen, ctx.analysisId);
    if (estado0 !== "nunca") setYaSubio(true);
    let subioEnEstaCarga = false;
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          const enZona = e.isIntersecting || e.boundingClientRect.top < 0;
          if (enZona) entrarZonaCierre();
          else salirZonaCierre();
          if (!enZona || subioEnEstaCarga) continue;
          // Sube UNA vez, solo. Después, solo desde la pestaña.
          if (!debeSubirTicket(leerEstadoTicket(almacen, ctx.analysisId))) continue;
          subioEnEstaCarga = true;
          if (!ofertaPackVigente(createdAt)) {
            setVigente(false);
            capturarLqs(posthog, EVENTOS_LQS.packVencido, ctx, { donde: "cliente", vence: hora });
            marcarTicket(almacen, ctx.analysisId, "despedida");
            continue;
          }
          marcarTicket(almacen, ctx.analysisId, "visto");
          setYaSubio(true);
          abrir("solo");
        }
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      salirZonaCierre();
      cerrarTicket();
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

  function abrir(desde: "solo" | "pestaña") {
    if (!ofertaPackVigente(createdAt)) {
      setVigente(false);
      return;
    }
    setCara("ticket");
    setError(null);
    setAbierto(true);
    abrirTicket();
    capturarLqs(posthog, EVENTOS_LQS.ticketVisto, ctx, { vence: hora, desde });
  }

  function despedirse() {
    if (cara === "despedida") return;
    setCara("despedida");
    capturarLqs(posthog, EVENTOS_LQS.despedidaVista, ctx, { vence: hora });
  }

  function cerrarDelTodo() {
    marcarTicket(typeof window !== "undefined" ? window.localStorage : null, ctx.analysisId, "despedida");
    setAbierto(false);
    cerrarTicket();
  }

  async function pagar(e: FormEvent) {
    e.preventDefault();
    const c = correo.trim().toLowerCase();
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
        <span className="lqs-franja lqs-pestana-franja" aria-hidden="true" />
        <span>{TICKET_PACK.pestana(fmtCLP(PACK_PRECIO_CLP), hora)}</span>
      </button>
      <div
        ref={velo}
        className="lqs-velo doc-tokens"
        data-lqs="ticket"
        data-abierto={abierto ? "1" : "0"}
        data-cara={cara}
        role={abierto ? "dialog" : undefined}
        aria-modal={abierto || undefined}
        aria-label="3 análisis por $5.000"
        onClick={(e) => { if (e.target !== e.currentTarget) return; if (cara === "ticket") despedirse(); else cerrarDelTodo(); }}
      >
        <div className="lqs-hoja">
          <div className="lqs-franja" aria-hidden="true" />
          <div className="lqs-asa" aria-hidden="true" />
          <div className="lqs-tk">
            <form className="lqs-cara" data-activa={cara === "ticket" ? "1" : "0"} onSubmit={pagar} noValidate>
              <div className="lqs-cab">
                <span className="lqs-tk-ojo">{TICKET_PACK.ojo}</span>
                <button type="button" className="lqs-x" onClick={despedirse} aria-label={TICKET_PACK.cerrar}>✕</button>
              </div>
              <p className="lqs-tk-lead">{FRASE_PACK[v]}</p>
              <div className="lqs-precio"><b>{fmtCLP(PACK_PRECIO_CLP)}</b><span>{TICKET_PACK.precioNota}</span></div>
              <p className="lqs-ahorro"><b>{fmtCLP(PACK_UNITARIO_CLP)}</b> por análisis en vez de <b>{fmtCLP(PACK_UNITARIO_REFERENCIA_CLP)}</b>.</p>
              <div className="lqs-reloj">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                <span>{TICKET_PACK.vence(dia, "")}<b>{hora}</b></span>
              </div>
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
              {error && <p className="lqs-tk-error" role="alert">{error}</p>}
              <button type="submit" className="lqs-rojo" disabled={pagando} data-presionado={pagando ? "1" : undefined}>{TICKET_PACK.pagar(fmtCLP(PACK_PRECIO_CLP))}</button>
              <p className="lqs-tk-pie">{TICKET_PACK.piePago}</p>
              <button type="button" className="lqs-seguir" onClick={despedirse}>{TICKET_PACK.seguir}</button>
            </form>
            <div className="lqs-cara" data-activa={cara === "despedida" ? "1" : "0"}>
              <div className="lqs-cab"><span className="lqs-tk-ojo">{TICKET_PACK.ojo}</span><span /></div>
              <p className="lqs-despedida-t">{TICKET_PACK.despedida(hora)}</p>
              <div className="lqs-resumen"><span>{TICKET_PACK.despedidaResumen}</span><b>{fmtCLP(PACK_PRECIO_CLP)}</b></div>
              <button type="button" className="lqs-rojo" onClick={() => { setCara("ticket"); setError(null); }}>{TICKET_PACK.comprar}</button>
              <button type="button" className="lqs-tinta" onClick={cerrarDelTodo}>{TICKET_PACK.siSeguir}</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
