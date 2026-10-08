"use client";

// ─────────────────────────────────────────────────────────────────────────────
// A · El banner del registro (28-sep-2026; copy del 08-oct-2026), después de la card de Franco: una
// cinta del material del hero de borde a borde, en la página. «Gratis · solo con tu correo», lo que
// recibe quien se registra (la selección semanal), «Para ti:» con los chips del perfil inferido y
// «Quiero recibirlos». Al tocarlo se convierte en el registro en un paso, y con el código, EN EL MISMO
// LUGAR, en «Estás dentro» (chips editables y la pregunta del horizonte).
// La barra fija que lo repetía al quedar atrás SALIÓ el 08-oct-2026: el banner queda donde está.
// Solo para el dueño sin sesión o recién dentro (`bannerRegistroVisible`).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePostHog } from "@/lib/posthog-react";
import { almacenSesion, marcarRecienDentro } from "@/lib/lo-que-sigue/recien-dentro";
import { ESTAS_DENTRO, OFERTA_REGISTRO } from "@/lib/lo-que-sigue/copy";
import { capturarLqs, EVENTOS_LQS, type ContextoLqs } from "@/lib/lo-que-sigue/eventos";
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
  const [paso, setPaso] = useState<Paso>(pasoInicial);

  // banner_visto una vez.
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
        }
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.analysisId]);

  const abrirRegistro = () => {
    capturarLqs(posthog, EVENTOS_LQS.accesoClick, ctx, { desde: "banner" });
    setPaso("registro");
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
            <h3 className="lqs-h3 lqs-h3-lead">{OFERTA_REGISTRO.titular}</h3>
            <p className="lqs-cuerpo">{OFERTA_REGISTRO.bajada}</p>
            {chips.length > 0 && (
              <div className="lqs-parati">
                <span className="lqs-parati-t">{OFERTA_REGISTRO.paraTi}</span>
                {chips.map((c) => <span key={c} className="lqs-chip" data-lqs="chip">{c}</span>)}
              </div>
            )}
            <button type="button" className="lqs-btn" onClick={abrirRegistro}>{OFERTA_REGISTRO.boton}</button>
          </>
        )}
      </div>
    </div>
  );
}
