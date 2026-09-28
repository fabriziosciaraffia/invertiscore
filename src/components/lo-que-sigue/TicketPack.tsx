"use client";

// ─────────────────────────────────────────────────────────────────────────────
// B · El ticket del pack (28-sep-2026, mockup v3, variante con franja): sube UNA vez cuando el
// lector llega al cierre del informe, por el mismo borde por el que se recoge la barra del
// registro. Cerrar o «Seguir leyendo» no cierran: cambian el ticket a la despedida, en el mismo
// lugar. Recién ahí baja, la barra vuelve, y no vuelve a aparecer. Nunca un segundo modal.
// La hora de vencimiento la fija el servidor (created_at + 24 h); si ya venció, no sube y se
// registra `pack_vencido`. Solo en el primer informe anónimo (el caller lo garantiza).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePostHog } from "@/lib/posthog-react";
import { fmtCLP } from "@/lib/pricing";
import { FRASE_PACK, TICKET_PACK, veredictoLqs } from "@/lib/lo-que-sigue/copy";
import { capturarLqs, EVENTOS_LQS, type ContextoLqs } from "@/lib/lo-que-sigue/eventos";
import { abrirTicket, cerrarTicket } from "@/lib/lo-que-sigue/estado-ui";
import { debeSubirTicket, leerEstadoTicket, marcarTicket } from "@/lib/lo-que-sigue/estado-ticket";
import { diaVencimiento, horaVencimiento, ofertaPackVigente, PACK_PRECIO_CLP, PACK_UNITARIO_CLP, PACK_UNITARIO_REFERENCIA_CLP, PRODUCTO_PACK } from "@/lib/lo-que-sigue/oferta-pack";
import "./lo-que-sigue.css";

type Cara = "ticket" | "despedida";

export function TicketPack({ ctx, createdAt }: { ctx: ContextoLqs; createdAt: string }) {
  const posthog = usePostHog();
  const router = useRouter();
  const sentinel = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [cara, setCara] = useState<Cara>("ticket");
  const [presionado, setPresionado] = useState(false);
  const v = veredictoLqs(ctx.veredicto);
  const hora = horaVencimiento(createdAt);
  const dia = diaVencimiento(createdAt);
  const checkout = `/checkout?product=${PRODUCTO_PACK}&analysisId=${encodeURIComponent(ctx.analysisId)}`;
  const registro = `/registro?next=${encodeURIComponent(checkout)}`;

  // Al llegar al cierre: sube una vez; si venció, no sube y queda medido.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const almacen = typeof window !== "undefined" ? window.localStorage : null;
    if (!debeSubirTicket(leerEstadoTicket(almacen, ctx.analysisId))) return;
    const io = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((e) => e.isIntersecting)) return;
        io.disconnect();
        if (!ofertaPackVigente(createdAt)) {
          capturarLqs(posthog, EVENTOS_LQS.packVencido, ctx, { donde: "cliente", vence: hora });
          marcarTicket(almacen, ctx.analysisId, "despedida");
          return;
        }
        marcarTicket(almacen, ctx.analysisId, "visto");
        setAbierto(true);
        abrirTicket();
        capturarLqs(posthog, EVENTOS_LQS.ticketVisto, ctx, { vence: hora });
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.analysisId, createdAt]);

  // Atrás y Esc: la misma coreografía que la X (nunca cierran de golpe).
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (cara === "ticket") despedirse();
        else cerrarDelTodo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, cara]);

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

  function comprar() {
    setPresionado(true);
    capturarLqs(posthog, EVENTOS_LQS.packIniciado, ctx, { desde: cara, vence: hora });
    router.push(registro);
  }

  return (
    <>
      <div ref={sentinel} data-lqs="cierre-sentinel" aria-hidden="true" style={{ height: 1 }} />
      <div className="lqs-velo doc-tokens" data-lqs="ticket" data-abierto={abierto ? "1" : "0"} data-cara={cara} role={abierto ? "dialog" : undefined} aria-modal={abierto || undefined} aria-label="3 análisis por $5.000" onClick={(e) => { if (e.target !== e.currentTarget) return; if (cara === "ticket") despedirse(); else cerrarDelTodo(); }}>
        <div className="lqs-hoja">
          <div className="lqs-franja" aria-hidden="true" />
          <div className="lqs-asa" aria-hidden="true" />
          <div className="lqs-tk">
            <div className="lqs-cara" data-activa={cara === "ticket" ? "1" : "0"}>
              <div className="lqs-cab">
                <span className="lqs-tk-ojo">{TICKET_PACK.ojo}</span>
                <button type="button" className="lqs-x" onClick={despedirse} aria-label={TICKET_PACK.cerrar}>✕</button>
              </div>
              <p className="lqs-tk-lead">{FRASE_PACK[v]}</p>
              <div className="lqs-precio"><b>{fmtCLP(PACK_PRECIO_CLP)}</b><span>{TICKET_PACK.precioNota}</span></div>
              <p className="lqs-ahorro" dangerouslySetInnerHTML={{ __html: TICKET_PACK.ahorro(`<b>${fmtCLP(PACK_UNITARIO_CLP)}</b>`, `<b>${fmtCLP(PACK_UNITARIO_REFERENCIA_CLP)}</b>`) }} />
              <div className="lqs-reloj">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                <span>{TICKET_PACK.vence(dia, "")}<b>{hora}</b></span>
              </div>
              <button type="button" className="lqs-rojo" onClick={comprar} data-presionado={presionado ? "1" : undefined}>{TICKET_PACK.boton(fmtCLP(PACK_PRECIO_CLP))}</button>
              <button type="button" className="lqs-seguir" onClick={despedirse}>{TICKET_PACK.seguir}</button>
            </div>
            <div className="lqs-cara" data-activa={cara === "despedida" ? "1" : "0"}>
              <div className="lqs-cab"><span className="lqs-tk-ojo">{TICKET_PACK.ojo}</span><span /></div>
              <p className="lqs-despedida-t">{TICKET_PACK.despedida(hora)}</p>
              <div className="lqs-resumen"><span>{TICKET_PACK.despedidaResumen}</span><b>{fmtCLP(PACK_PRECIO_CLP)}</b></div>
              <button type="button" className="lqs-rojo" onClick={comprar} data-presionado={presionado ? "1" : undefined}>{TICKET_PACK.comprar}</button>
              <button type="button" className="lqs-tinta" onClick={cerrarDelTodo}>{TICKET_PACK.siSeguir}</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
