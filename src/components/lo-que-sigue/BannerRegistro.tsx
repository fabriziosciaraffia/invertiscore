"use client";

// ─────────────────────────────────────────────────────────────────────────────
// A · El banner del registro (28-sep-2026; copy del 08-oct-2026), después de la card de Franco: una
// cinta del material del hero de borde a borde, en la página. «Gratis · solo con tu correo», lo que
// recibe quien se registra (la selección semanal), «Para ti:» con los chips del perfil inferido y
// «Quiero recibirlos». Al tocarlo se convierte en el registro en un paso, y con el código, EN EL MISMO
// LUGAR, en «Estás dentro» (chips editables y la pregunta del horizonte).
// La barra fija que lo repetía al quedar atrás SALIÓ el 08-oct-2026: el banner queda donde está.
// Solo para el dueño sin sesión o recién dentro (`bannerRegistroVisible`).
// LA PRIMERA SELECCIÓN SOBRE EL INFORME (20-oct-2026): al quedar en «Estás dentro» —por código, o al volver por Google o
// por el enlace con la marca de recién dentro—, sus primeros deptos se abren en una hoja sobre el informe
// (HojaPrimeraSeleccion), una vez por informe y pestaña; «Ver mis primeros deptos» la vuelve a abrir.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePostHog } from "@/lib/posthog-react";
import { almacenSesion, marcarRecienDentro } from "@/lib/lo-que-sigue/recien-dentro";
import { ESTAS_DENTRO, OFERTA_REGISTRO } from "@/lib/lo-que-sigue/copy";
import { capturarLqs, EVENTOS_LQS, type ContextoLqs } from "@/lib/lo-que-sigue/eventos";
import type { PerfilChips } from "@/lib/lo-que-sigue/perfil-chips";
import { usoBanner } from "@/lib/lo-que-sigue/uso-banner";
import { RegistroUnPaso } from "./RegistroUnPaso";
import { EstasDentro } from "./EstasDentro";
import { HojaPrimeraSeleccion, hojaYaVista, marcarHojaVista } from "./HojaPrimeraSeleccion";
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
  // La hoja con la primera selección (20-oct-2026): se abre sola al quedar en «Estás dentro», una vez por informe y
  // pestaña; cerrada, «Ver mis primeros deptos» la reabre. La demo no la abre.
  const [hoja, setHoja] = useState(false);
  useEffect(() => {
    if (paso !== "dentro" || demo) return;
    if (hojaYaVista(almacenSesion(), ctx.analysisId)) return;
    marcarHojaVista(almacenSesion(), ctx.analysisId);
    setHoja(true);
  }, [paso, demo, ctx.analysisId]);
  // Todos los pasos con el alto del primero (08-oct-2026, tercera pasada): se mide la oferta y los pasos
  // siguientes lo toman como alto mínimo; el CSS compacto hace que ninguno lo pase. Al cambiar el ancho
  // de la ventana la medida deja de valer y se suelta.
  const [altoOferta, setAltoOferta] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || paso !== "oferta") return;
    // El observer puede avisar después de que el DOM ya pasó al paso siguiente: solo mide la oferta.
    const medir = () => {
      if (el.dataset.paso === "oferta") setAltoOferta(el.offsetHeight);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [paso]);
  useEffect(() => {
    let ancho = window.innerWidth;
    const alCambiar = () => {
      if (window.innerWidth === ancho) return;
      ancho = window.innerWidth;
      setAltoOferta(null);
    };
    window.addEventListener("resize", alCambiar);
    return () => window.removeEventListener("resize", alCambiar);
  }, []);

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
  // EL REGISTRO COMPLETADO ANULA LA ESPERA (20-oct-2026): el ticket ya no aguarda el minuto desde «Entrar».
  const entrar = (correo: string) => {
    if (!demo) marcarRecienDentro(almacenSesion(), ctx.analysisId, correo);
    usoBanner.entro();
    setPaso("dentro");
    if (!demo) router.refresh();
  };

  const chips = [perfil.tipologia, perfil.comuna, ESTAS_DENTRO.modalidad[perfil.modalidad]].filter((c): c is string => !!c);

  // EN USO (12-oct-2026): solo el foco o la escritura en un campo, abrir el paso del código (`RegistroUnPaso`) y
  // tocar un botón o un chip del banner. El scroll y el toque de paso por encima, no: hasta hoy cualquier dedo que
  // bajaba la página por encima del banner lo marcaba en uso, y el ticket esperaba 60 s más.
  // En «Estás dentro», nada (20-oct-2026): ni los chips, ni el «cuándo», ni «Ver mis primeros deptos» vuelven a armar el minuto.
  const marcarUso = () => { if (paso !== "dentro") usoBanner.actividad(); };
  const esCampo = (t: EventTarget | null) => t instanceof HTMLElement && t.matches("input, textarea, select");
  const esBotonOChip = (t: EventTarget | null) => t instanceof HTMLElement && !!t.closest('button, a, [data-lqs="chip"]');

  return (
    <>
    <div
      ref={ref}
      className="lqs-mat lqs-banner"
      data-lqs="banner"
      data-paso={paso}
      style={paso !== "oferta" && altoOferta ? { minHeight: altoOferta } : undefined}
      onInputCapture={marcarUso}
      onKeyDownCapture={(e) => { if (esCampo(e.target)) marcarUso(); }}
      onFocusCapture={(e) => { if (esCampo(e.target)) marcarUso(); }}
      onClickCapture={(e) => { if (esBotonOChip(e.target)) marcarUso(); }}
    >
      <div className="lqs-fondo" aria-hidden="true" />
      <div className="lqs-col">
        {paso === "dentro" ? (
          <EstasDentro ctx={ctx} perfil={perfil} demo={demo} onVerDeptos={demo ? undefined : () => setHoja(true)} />
        ) : paso === "registro" ? (
          <RegistroUnPaso next={next} ctx={ctx} alEntrar={entrar} demo={demo} />
        ) : (
          <>
            <p className="lqs-ojo"><b>{OFERTA_REGISTRO.ojoFuerte}</b>{OFERTA_REGISTRO.ojoResto}</p>
            <h3 className="lqs-h3 lqs-h3-lead">{OFERTA_REGISTRO.titular}</h3>
            <p className="lqs-banner-registro"><b>{OFERTA_REGISTRO.registro}</b></p>
            <p className="lqs-cuerpo lqs-gris">{OFERTA_REGISTRO.bajada}</p>
            {/* En PC, los chips y el botón en una misma fila (segunda pasada). */}
            <div className="lqs-fila-accion">
              <div className="lqs-parati">
                {chips.length > 0 && <span className="lqs-parati-t">{OFERTA_REGISTRO.paraTi}</span>}
                {chips.map((c) => <span key={c} className="lqs-chip" data-lqs="chip">{c}</span>)}
              </div>
              <button type="button" className="lqs-btn" onClick={abrirRegistro}>{OFERTA_REGISTRO.boton}</button>
            </div>
          </>
        )}
      </div>
    </div>
    {/* Fuera de la cinta: `.lqs-mat > *` fija position: relative a sus hijos y el velo tiene que ser fixed. */}
    {paso === "dentro" && !demo && <HojaPrimeraSeleccion abierta={hoja} analysisId={ctx.analysisId} alCerrar={() => setHoja(false)} />}
    </>
  );
}
