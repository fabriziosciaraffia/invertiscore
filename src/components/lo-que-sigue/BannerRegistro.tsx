"use client";

// ─────────────────────────────────────────────────────────────────────────────
// A · El banner del registro (28-sep-2026), después de la card de Franco: el material del hero de
// borde a borde con la frase por veredicto; al tocarlo se convierte en el registro en un paso. En
// teléfono, cuando el banner queda atrás, la barra fija lo repite (solo el registro) y se recoge
// mientras el ticket del pack está arriba. Solo en el primer informe anónimo: el caller lo monta
// únicamente con `isAnonOwner && !isLoggedIn`.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { usePostHog } from "@/lib/posthog-react";
import { FRASE_REGISTRO, OFERTA_REGISTRO, veredictoLqs } from "@/lib/lo-que-sigue/copy";
import { capturarLqs, EVENTOS_LQS, type ContextoLqs } from "@/lib/lo-que-sigue/eventos";
import { useTicketAbierto } from "@/lib/lo-que-sigue/estado-ui";
import { RegistroUnPaso } from "./RegistroUnPaso";
import "./lo-que-sigue.css";

export function BannerRegistro({ ctx, next }: { ctx: ContextoLqs; next: string }) {
  const posthog = usePostHog();
  const ref = useRef<HTMLDivElement>(null);
  const [registro, setRegistro] = useState(false);
  const [atras, setAtras] = useState(false);
  const ticketAbierto = useTicketAbierto();
  const v = veredictoLqs(ctx.veredicto);

  // banner_visto una vez; la barra aparece cuando el banner quedó por encima del viewport.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let visto = false;
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting && !visto) {
            visto = true;
            capturarLqs(posthog, EVENTOS_LQS.bannerVisto, ctx);
          }
          setAtras(!e.isIntersecting && e.boundingClientRect.bottom < 0);
        }
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.analysisId]);

  const abrirRegistro = () => {
    setRegistro(true);
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <>
      <div ref={ref} className="lqs-mat lqs-banner" data-lqs="banner" data-registro={registro ? "1" : "0"}>
        <div className="lqs-fondo" aria-hidden="true" />
        <div className="lqs-col">
          {registro ? (
            <RegistroUnPaso next={next} ctx={ctx} />
          ) : (
            <>
              <p className="lqs-ojo">{OFERTA_REGISTRO.ojo}</p>
              <p className="lqs-lead">{FRASE_REGISTRO[v]}</p>
              <h3 className="lqs-h3">{OFERTA_REGISTRO.titular} <mark>{OFERTA_REGISTRO.plumon}</mark> {OFERTA_REGISTRO.cierre}</h3>
              <button type="button" className="lqs-btn" onClick={abrirRegistro}>{OFERTA_REGISTRO.boton}</button>
            </>
          )}
        </div>
      </div>
      <div className="lqs-mat lqs-barra" data-lqs="barra" data-visible={atras && !ticketAbierto ? "1" : "0"} aria-hidden={!(atras && !ticketAbierto)}>
        <div className="lqs-fondo" aria-hidden="true" />
        <div className="lqs-barra-t">{OFERTA_REGISTRO.barraTitulo}<small>{OFERTA_REGISTRO.barraSub}</small></div>
        <button type="button" className="lqs-btn" onClick={abrirRegistro} tabIndex={atras && !ticketAbierto ? 0 : -1}>{OFERTA_REGISTRO.barraBoton}</button>
      </div>
    </>
  );
}
