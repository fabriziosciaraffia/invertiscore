"use client";

// ─────────────────────────────────────────────────────────────────────────────
// B · El ticket del pack (28-sep-2026; reglas del 08-oct-2026):
//   · La oferta es del INFORME: el caller lo monta mientras el informe que nació anónimo no tenga un
//     pack pagado y quien mira sea su dueño (`oferta-informe.ts`); la vigencia (24 h) la mira acá.
//   · Sube UNA vez por informe en cada navegador, con lo primero que pase (`disparo-ticket.ts`): 8 s
//     después de pasar «Tu resultado a 10 años», 4 minutos de lectura activa, o en PC el cursor que
//     sale de la página por arriba. Cerrado, queda la pestaña para volver a él mientras la oferta viva —desde
//     el 12-oct-2026 en toda la página y desde que se abre el informe, para quien vuelve (`esRegreso`)—.
//   · Cerrar o «Seguir leyendo» cambian a la despedida en el mismo lugar; «Sí, seguir leyendo»
//     cierra (y deja la pestaña). Nunca un segundo modal.
//   · El correo va adentro del ticket y el botón rojo va directo a Flow: POST /api/lo-que-sigue/pack
//     crea la cuenta si no existe, adopta este informe y abre la orden; sin salir del informe. Con el
//     correo conocido (recién dentro, la sesión o la cuenta de su navegador) no lo pide.
//   · El velo y la pestaña van FIJOS a la pantalla con los márgenes seguros, sin medir el área visible (12-oct-2026:
//     con `visualViewport`, en iOS 26, la hoja podía quedar fuera de la pantalla).
//   Vencido: no sube, no hay pestaña, y queda medido `pack_vencido`. Solo en el primer informe anónimo.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePostHog } from "@/lib/posthog-react";
import { fmtCLP } from "@/lib/pricing";
import { TICKET_PACK } from "@/lib/lo-que-sigue/copy";
import { capturarLqs, EVENTOS_LQS, type ContextoLqs } from "@/lib/lo-que-sigue/eventos";
import { debeSubirTicket, esRegreso, leerEstadoTicket, marcarTicket, pestanaVisible, veloCierra, VISTO_TRAS_MS } from "@/lib/lo-que-sigue/estado-ticket";
import { anotarEvento, hojaDentro, type EventoTicket, type PorDondeTicket } from "@/lib/lo-que-sigue/bitacora-ticket";
import { diagnosticoTicket } from "@/lib/lo-que-sigue/diagnostico-ticket";
import { crearDisparador, crearVigiaZona, EVENTOS_ACTIVIDAD, revisarMarcas, SELECTOR_FIN_CAPITULOS, SELECTOR_FIN_RECOMENDACION } from "@/lib/lo-que-sigue/disparo-ticket";
import { usoBanner } from "@/lib/lo-que-sigue/uso-banner";
import { marcarPuertaCandidata } from "@/lib/atribucion-puerta";
import { botonOcupado, claveActual, iniciarCarga } from "@/lib/carga-global";
import { cuandoVence, horaVencimiento, ofertaPackVigente, venceEl, PACK_AHORRO_CLP, PACK_PRECIO_CLP, PACK_UNITARIO_CLP, PACK_UNITARIO_REFERENCIA_CLP } from "@/lib/lo-que-sigue/oferta-pack";
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

export function TicketPack({ ctx, createdAt, correoSesion = null, conSesion = false, recienDentro = false, conCuenta = false }: {
  ctx: ContextoLqs;
  createdAt: string;
  /** Entra con su sesión (12-oct-2026): a un informe que nació anónimo, eso dice que ya estuvo acá (`esRegreso`). */
  conSesion?: boolean;
  /** La misma visita en que se registró: no cuenta como volver. */
  recienDentro?: boolean;
  /** El correo con que paga, si ya se sabe (`correoDelTicket`): recién dentro, la sesión o la cuenta de
   *  su navegador de origen. Con él, el ticket no lo pide. */
  correoSesion?: string | null;
  /** YA TIENE CUENTA (22-oct-2026, decisión de Fabrizio): el ticket no dice «al comprar quedas registrado»; dice para qué
   *  le sirven, y el vencimiento sin «en este informe». Con sesión, o con el ticket de la cuenta nueva. */
  conCuenta?: boolean;
}) {
  const posthog = usePostHog();
  const sentinel = useRef<HTMLDivElement>(null);
  const velo = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [cara, setCara] = useState<Cara>("ticket");
  const [yaSubio, setYaSubio] = useState(false);
  const [vigente, setVigente] = useState(() => ofertaPackVigente(createdAt));
  const [correo, setCorreo] = useState("");
  const [pagando, setPagando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hora = horaVencimiento(createdAt);
  const precio = fmtCLP(PACK_PRECIO_CLP);
  // La pestaña, en toda la página y desde que se abre el informe si el ticket ya subió (12-oct-2026): hasta hoy
  // vivía de la marca del final hacia abajo, y quien volvía no la encontraba.
  const pestana = pestanaVisible({ abierto, yaSubio, vigente });
  // Para el diagnóstico de `?lqs=1`: lo que se ve ahora, sin volver a montar el efecto del disparo.
  const vista = useRef({ abierto, pestana });
  vista.current = { abierto, pestana };

  // Vence en el segundo exacto, con la página abierta: la pestaña se va sola.
  useEffect(() => {
    if (!vigente) return;
    const ms = venceEl(createdAt).getTime() - Date.now();
    if (ms <= 0) {
      setVigente(false);
      return;
    }
    const t = window.setTimeout(() => setVigente(false), Math.min(ms, 2_147_483_647));
    return () => window.clearTimeout(t);
  }, [createdAt, vigente]);

  // FIJOS A LA PANTALLA (12-oct-2026): el velo y la pestaña van con `position: fixed` y los márgenes seguros
  // (lo-que-sigue.css), sin medir el área visible. Hasta hoy se anclaban al `visualViewport` —el mismo mecanismo que
  // fallaba en la lista de direcciones— y en iOS 26 la hoja podía abrirse fuera de la pantalla.
  // Para el velo: cuándo se abrió y cuándo empezó el último toque en la página (`veloCierra`).
  const abiertoEn = useRef(0);
  const ultimoToque = useRef(0);
  useEffect(() => {
    const toque = () => {
      ultimoToque.current = performance.now();
    };
    window.addEventListener("pointerdown", toque, { capture: true, passive: true });
    window.addEventListener("touchstart", toque, { capture: true, passive: true });
    return () => {
      window.removeEventListener("pointerdown", toque, { capture: true });
      window.removeEventListener("touchstart", toque, { capture: true });
    };
  }, []);
  const almacenLocal = () => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  };
  // La bitácora del recuadro de `?lqs=1`: en el navegador, nunca en PostHog.
  const anotar = (ev: Omit<EventoTicket, "t">) => anotarEvento(almacenLocal(), ctx.analysisId, { t: Date.now(), ...ev });

  // «YA SE MOSTRÓ» SOLO SI SE VIO (12-oct-2026): al segundo de abrirse se mide la hoja; si está dentro de la pantalla,
  // recién ahí se guarda. Si se cerró antes, o quedó fuera, no: la próxima vez vuelve a subir.
  useEffect(() => {
    if (!abierto) return;
    const t = window.setTimeout(() => {
      const hoja = velo.current?.querySelector(".lqs-hoja");
      if (!hoja) return;
      const r = hoja.getBoundingClientRect();
      // Dentro de la pantalla y con la pestaña del navegador a la vista: una hoja abierta en segundo plano no se vio.
      const dentro = hojaDentro(r, window.innerHeight) && document.visibilityState === "visible";
      anotar({ tipo: "medido", dentro, top: Math.round(r.top), alto: Math.round(r.height), pantalla: window.innerHeight });
      if (dentro && leerEstadoTicket(almacenLocal(), ctx.analysisId) === "nunca") marcarTicket(almacenLocal(), ctx.analysisId, "visto");
    }, VISTO_TRAS_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  // Cuándo sube (`disparo-ticket.ts`) y la zona de la pestaña: desde la marca del final de los capítulos
  // hacia abajo (sin la marca, el sentinel de acá, al final de la página).
  useEffect(() => {
    const marca = document.querySelector(SELECTOR_FIN_CAPITULOS) ?? sentinel.current;
    if (!marca) return;
    const almacen = typeof window !== "undefined" ? window.localStorage : null;
    // El que vuelve (12-oct-2026): ya se mostró en este navegador, o entra con su sesión y no es la visita en que
    // se registró. No se abre solo; la pestaña lo espera desde ya.
    const vuelve = () => esRegreso({ estadoLocal: leerEstadoTicket(almacen, ctx.analysisId), conSesion, recienDentro });
    if (vuelve()) setYaSubio(true);
    const d = crearDisparador({
      reloj: { ahora: () => Date.now(), programar: (fn, ms) => window.setTimeout(fn, ms), cancelar: (h) => window.clearTimeout(h as number) },
      // Una vez por informe en este navegador, y solo con la oferta viva.
      puedeSubir: () => !vuelve() && ofertaPackVigente(createdAt),
      // Mientras la persona usa el banner del registro, el ticket no le sube encima (08-oct-2026); tampoco a la hoja con
      // la primera selección, que lo retiene mientras está abierta (20-oct-2026).
      enEspera: () => usoBanner.enUso(),
      subir: (motivo) => {
        // «Ya se mostró» NO se guarda acá (12-oct-2026): se guarda si la hoja estuvo un segundo dentro de la pantalla.
        setYaSubio(true);
        abrir("solo", motivo);
      },
    });
    let vencidoMedido = false;
    const vigia = crearVigiaZona((enZona) => {
      if (!enZona) return;
      d.llegoAlFinal();
      // Vencido al llegar al final: no sube, no hay pestaña, y se mide una vez.
      if (!vencidoMedido && !ofertaPackVigente(createdAt) && debeSubirTicket(leerEstadoTicket(almacen, ctx.analysisId))) {
        vencidoMedido = true;
        setVigente(false);
        capturarLqs(posthog, EVENTOS_LQS.packVencido, ctx, { donde: "cliente", vence: hora });
        marcarTicket(almacen, ctx.analysisId, "despedida");
      }
    });
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) vigia.revisar(e.isIntersecting || e.boundingClientRect.top < 0);
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
    // Un salto de golpe (la tecla Fin, un ancla) deja una marca por encima de la pantalla sin cruzarla, y su
    // observer no avisa: al desplazarse se mira dónde quedaron las dos (08-oct-2026).
    // SIN MEDIR EN CADA SCROLL Y UNA VEZ POR CUADRO (09-oct-2026): dónde están las marcas EN LA PÁGINA se mide al
    // montar y cuando cambia el alto del documento; al desplazarse solo se lee `scrollY`, en el cuadro siguiente.
    // Medirlas en cada evento forzaba un layout del informe entero por evento mientras se baja.
    let finEnPagina = 0;
    let recoEnPagina: number | null = null;
    const medirMarcas = () => {
      finEnPagina = marca.getBoundingClientRect().top + window.scrollY;
      recoEnPagina = finReco ? finReco.getBoundingClientRect().top + window.scrollY : null;
    };
    medirMarcas();
    const roPagina = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medirMarcas) : null;
    roPagina?.observe(document.body);
    let cuadro = 0;
    const revisarEnCuadro = () => {
      cuadro = 0;
      const y = window.scrollY;
      revisarMarcas({ finTop: finEnPagina - y, recoTop: recoEnPagina === null ? null : recoEnPagina - y, alto: window.innerHeight }, vigia, d);
    };
    const alDesplazar = () => {
      if (!cuadro) cuadro = window.requestAnimationFrame(revisarEnCuadro);
    };
    window.addEventListener("scroll", alDesplazar, { passive: true });
    const soltarDiagnostico = diagnosticoTicket.registrar(() => ({ ...vista.current, disparo: d.estado() }));
    const actividad = () => d.actividad();
    for (const ev of EVENTOS_ACTIVIDAD) window.addEventListener(ev, actividad, { passive: true });
    const lectura = window.setInterval(() => d.tick(document.visibilityState === "visible"), 1000);
    const alSalir = (e: MouseEvent) => d.salida({ clientY: e.clientY, haciaFuera: !e.relatedTarget, pc: esPc() });
    document.addEventListener("mouseout", alSalir);
    return () => {
      d.detener();
      soltarDiagnostico();
      io.disconnect();
      window.removeEventListener("scroll", alDesplazar);
      if (cuadro) window.cancelAnimationFrame(cuadro);
      roPagina?.disconnect();
      ioReco?.disconnect();
      for (const ev of EVENTOS_ACTIVIDAD) window.removeEventListener(ev, actividad);
      window.clearInterval(lectura);
      document.removeEventListener("mouseout", alSalir);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.analysisId, createdAt, conSesion, recienDentro]);

  // Atrás y Esc: la misma coreografía que la X (nunca cierran de golpe).
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (cara === "ticket") despedirse("escape");
      else cerrarDelTodo("escape");
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
    abiertoEn.current = performance.now();
    anotar({ tipo: "abierto", motivo: desde === "pestaña" ? "pestaña" : motivo ?? "?" });
    capturarLqs(posthog, EVENTOS_LQS.ticketVisto, ctx, { vence: hora, desde, ...(motivo ? { motivo } : {}) });
  }

  function despedirse(por: PorDondeTicket) {
    if (cara === "despedida") return;
    setCara("despedida");
    anotar({ tipo: "despedida", por });
    capturarLqs(posthog, EVENTOS_LQS.despedidaVista, ctx, { vence: hora });
  }

  function cerrarDelTodo(por: PorDondeTicket) {
    marcarTicket(typeof window !== "undefined" ? window.localStorage : null, ctx.analysisId, "despedida");
    setAbierto(false);
    anotar({ tipo: "cerrado", por });
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
    // La puerta A (15-oct-2026): dejó su correo en el ticket de su informe. El Lead lo manda la ruta del pack y el pixel
    // lo repite desde la cookie del espejo (MetaPixel).
    marcarPuertaCandidata("A", "ticket");
    try {
      const res = await fetch("/api/lo-que-sigue/pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: c, analysisId: ctx.analysisId }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        // La página se descarga hacia Flow con el botón presionado y la barra del header encendida.
        iniciarCarga(claveActual());
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
        onClick={(e) => {
          if (e.target !== e.currentTarget) return;
          // Un toque en el velo en el primer segundo, o el final de un gesto que empezó antes de abrirse, no cierra.
          if (!veloCierra({ ahora: performance.now(), abiertoEn: abiertoEn.current, ultimoToque: ultimoToque.current })) {
            anotar({ tipo: "ignorado", por: "velo" });
            return;
          }
          if (cara === "ticket") despedirse("velo");
          else cerrarDelTodo("velo");
        }}
      >
        <div className="lqs-hoja">
          <div className="lqs-franja" aria-hidden="true" />
          <div className="lqs-asa" aria-hidden="true" />
          <div className="lqs-tk">
            <form className="lqs-cara" data-activa={cara === "ticket" ? "1" : "0"} onSubmit={pagar} noValidate>
              {/* Tercera pasada (08-oct-2026): el titular en una línea; debajo, más chico, el precio por
                  análisis; el cuerpo en un solo tamaño, tres líneas: la 1 normal, la 2 y la 3 en negrita. */}
              <div className="lqs-cab">
                <div>
                  <p className="lqs-tk-titular" data-lqs="ticket-linea">{TICKET_PACK.linea(precio)}</p>
                  <p className="lqs-tk-precio"><s>{fmtCLP(PACK_UNITARIO_REFERENCIA_CLP)}</s>{TICKET_PACK.cadaUno(fmtCLP(PACK_UNITARIO_CLP))}</p>
                </div>
                <button type="button" className="lqs-x" onClick={() => despedirse("x")} aria-label={TICKET_PACK.cerrar}>✕</button>
              </div>
              <p className="lqs-tk-cuerpo">
                {TICKET_PACK.cuerpo}
                <br />
                <b>{TICKET_PACK.cuerpoFuerte}</b>
                <br />
                <b>{conCuenta ? TICKET_PACK.negritaConCuenta : TICKET_PACK.negrita}</b>
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
              <button type="submit" className="lqs-rojo" disabled={pagando} {...botonOcupado(pagando)}>{TICKET_PACK.boton(precio)}</button>
              <p className="lqs-tk-vence" data-lqs="ticket-vence">{conCuenta ? TICKET_PACK.vencimientoCuenta(cuandoVence(createdAt)) : TICKET_PACK.vencimiento(cuandoVence(createdAt))}</p>
              <button type="button" className="lqs-seguir" onClick={() => despedirse("seguir")}>{TICKET_PACK.seguir}</button>
            </form>
            <div className="lqs-cara" data-activa={cara === "despedida" ? "1" : "0"}>
              <div className="lqs-cab"><p className="lqs-tk-ojo">{TICKET_PACK.linea(precio)}</p><span /></div>
              <p className="lqs-despedida-t">{TICKET_PACK.despedida}</p>
              <p className="lqs-despedida-s">{TICKET_PACK.despedidaAhorro(fmtCLP(PACK_AHORRO_CLP))}</p>
              <button type="button" className="lqs-rojo" onClick={() => { setCara("ticket"); setError(null); }}>{TICKET_PACK.comprar}</button>
              <button type="button" className="lqs-tinta" onClick={() => cerrarDelTodo("si-seguir")}>{TICKET_PACK.siSeguir}</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
