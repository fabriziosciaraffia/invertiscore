"use client";

// ─────────────────────────────────────────────────────────────────────────────
// A · El banner del registro (28-sep-2026; copy nuevo del 30-sep-2026), después de la card de
// Franco: el material del hero de borde a borde. La primera línea va por veredicto; después el
// portafolio, «Para ti:» con los chips del perfil inferido (tipología, comuna, modalidad), «Quiero
// acceso» y «Gratis. Solo tu correo.». Al tocarlo se convierte en el registro en un paso, y con el
// código, EN EL MISMO LUGAR, en «Estás dentro» (chips editables y la pregunta del horizonte).
// En teléfono, cuando el banner queda atrás, la barra fija lo repite y se recoge mientras el ticket
// del pack está arriba. Solo en el primer informe anónimo: el caller lo monta únicamente con
// `isAnonOwner && !isLoggedIn`.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePostHog } from "@/lib/posthog-react";
import { almacenSesion, marcarRecienDentro } from "@/lib/lo-que-sigue/recien-dentro";
import { ESTAS_DENTRO, FRASE_REGISTRO, OFERTA_REGISTRO, veredictoLqs } from "@/lib/lo-que-sigue/copy";
import { capturarLqs, EVENTOS_LQS, type ContextoLqs } from "@/lib/lo-que-sigue/eventos";
import { queVaAbajo, useEstadoBorde } from "@/lib/lo-que-sigue/estado-ui";
import { useAnclaAbajo } from "@/lib/lo-que-sigue/area-visible";
import type { PerfilChips } from "@/lib/lo-que-sigue/perfil-chips";
import { RegistroUnPaso } from "./RegistroUnPaso";
import { EstasDentro } from "./EstasDentro";
import "./lo-que-sigue.css";

export type Paso = "oferta" | "registro" | "dentro";

export function BannerRegistro({ ctx, next, perfil, demo = false, pasoInicial = "oferta" }: {
  ctx: ContextoLqs;
  next: string;
  perfil: PerfilChips;
  /** La demo de «Lo que sigue»: «Estás dentro» no escribe. */
  demo?: boolean;
  pasoInicial?: Paso;
}) {
  const posthog = usePostHog();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const barraRef = useRef<HTMLDivElement>(null);
  const [paso, setPaso] = useState<Paso>(pasoInicial);
  const [atras, setAtras] = useState(false);
  const { ticketAbierto, zonaCierre } = useEstadoBorde();
  const v = veredictoLqs(ctx.veredicto);
  // Una sola cosa abajo según la zona: la barra solo fuera del cierre y sin el ticket arriba
  // (en la zona del cierre van el ticket o su pestaña, que viven en TicketPack). Ya dentro, no hay barra.
  const barra = paso !== "dentro" && queVaAbajo({ bannerAtras: atras, zonaCierre, ticketAbierto, ticketYaSubio: false, ofertaVigente: false }) === "barra";
  // Anclada al área visible real: en iOS la barra del navegador se esconde al hacer scroll.
  useAnclaAbajo(barraRef);

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

  const abrirRegistro = (desde: "banner" | "barra") => {
    capturarLqs(posthog, EVENTOS_LQS.accesoClick, ctx, { desde });
    setPaso("registro");
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Con el código (01-oct-2026): «Estás dentro» en el mismo lugar Y la página se refresca, para que el
  // header y el ticket dejen de tratar a la persona como anónima. La marca «recién dentro» (por
  // análisis, en sessionStorage) se escribe ANTES del refresco: el informe la lee y mantiene este
  // banner montado en «Estás dentro» aunque ya no sea un dueño anónimo.
  const entrar = (correo: string) => {
    if (!demo) marcarRecienDentro(almacenSesion(), ctx.analysisId, correo);
    setPaso("dentro");
    if (!demo) router.refresh();
  };

  const chips = [perfil.tipologia, perfil.comuna, ESTAS_DENTRO.modalidad[perfil.modalidad]].filter((c): c is string => !!c);

  return (
    <>
      <div ref={ref} className="lqs-mat lqs-banner" data-lqs="banner" data-paso={paso}>
        <div className="lqs-fondo" aria-hidden="true" />
        <div className="lqs-col">
          {paso === "dentro" ? (
            <EstasDentro ctx={ctx} perfil={perfil} demo={demo} />
          ) : paso === "registro" ? (
            <RegistroUnPaso next={next} ctx={ctx} alEntrar={entrar} />
          ) : (
            <>
              <p className="lqs-ojo">{OFERTA_REGISTRO.ojo}</p>
              <h3 className="lqs-h3 lqs-h3-lead">{FRASE_REGISTRO[v]}</h3>
              <p className="lqs-cuerpo">{OFERTA_REGISTRO.cuerpo}</p>
              {chips.length > 0 && (
                <div className="lqs-parati">
                  <span className="lqs-parati-t">{OFERTA_REGISTRO.paraTi}</span>
                  {chips.map((c) => <span key={c} className="lqs-chip" data-lqs="chip">{c}</span>)}
                </div>
              )}
              <button type="button" className="lqs-btn" onClick={() => abrirRegistro("banner")}>{OFERTA_REGISTRO.boton}</button>
              <p className="lqs-legal">{OFERTA_REGISTRO.bajoBoton}</p>
            </>
          )}
        </div>
      </div>
      <div ref={barraRef} className="lqs-mat lqs-barra" data-lqs="barra" data-visible={barra ? "1" : "0"} aria-hidden={!barra}>
        <div className="lqs-fondo" aria-hidden="true" />
        <div className="lqs-barra-t">{OFERTA_REGISTRO.barraTitulo}<small>{OFERTA_REGISTRO.barraSub}</small></div>
        <button type="button" className="lqs-btn" onClick={() => abrirRegistro("barra")} tabIndex={barra ? 0 : -1}>{OFERTA_REGISTRO.barraBoton}</button>
      </div>
    </>
  );
}
