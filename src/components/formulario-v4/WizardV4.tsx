"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Wizard v4 — Shell + router de pantallas
//
// Cabecera del paso: disco de atrás + rótulo del acto + chip de modalidad + barra
// de progreso en tinta (monotónica). Reacción de Franco (datos reales) sobre la
// pregunta. Transición slide+fade. Draft con banner de retomar.
//
// EL INTERIOR TIENE EL FORMATO DEL INFORME (entrega 2, 27-sep-2026): va dentro de
// `.wz4.doc-dictamen` —los tokens del informe, Inter en todo— y el header queda
// afuera, sobre el lienzo (`.wz4-lienzo`). Mockup aprobado:
// docs/wireframes/rediseno-informe/wizard-v4-actualizado.html.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft } from "lucide-react";
import { usePostHog } from "@/lib/posthog-react";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { trackWizard } from "./track";
import { useWizardV4 } from "./useWizardV4";
import { useStepTelemetry } from "./stepTelemetry";
import { useWizardV4Data } from "./useWizardV4Data";
import { useWizardV4Tier, esNuevoConAnalisisGratis } from "./useWizardV4Tier";
import { useWizardV4Owner } from "./useWizardV4Owner";
import { metaTrackCustom } from "@/lib/meta/pixel";
import { ResumenScreen } from "./screenResumen";
import {
  ACTO_BY_NODE,
  ACTO_LABEL,
  DEC,
  NODE_TITLE,
  reactionText,
  type NodeId,
  type ReactionLive,
  type WizardV4Answers,
} from "./wizardV4Nodes";
import { fmtCLP, leerNum } from "./derive";
import { avisoSubsidioAplica } from "./wizardV4Subsidio";
import { FrancoReaction, LinkBtn } from "./ui";
import "./wizard-v4.css";
import {
  AntiguedadScreen,
  EntregaScreen,
  TamanoScreen,
  TipoScreen,
  type ScreenProps,
} from "./screensActo1";
import { PieScreen, PlazoScreen, PrecioScreen, TasaFixScreen, TasaScreen } from "./screensActo2";
import { AdrFixScreen, AdrScreen, ArrFixScreen, ArrScreen } from "./screensActo3";
import { InformeScreen } from "./screenInforme";
import { EntradaScreen, MapaScreen } from "./screenEntrada";
import type { CaminoSinDireccion } from "@/components/entrada/HeroEntrada";
import {
  borradorEsDeOtraDireccion,
  destinoDeLlegada,
  direccionCorta,
  type DireccionLlegada,
  type ModoLlegada,
} from "@/components/entrada/llegada";
import { ModalPlausibilidad } from "./ModalPlausibilidad";
import { decidirBorrador } from "./wizardV4Draft";
import { buildPlausibilidadParcial } from "./wizardV4Submit";
import { evaluarPlausibilidad, type Anomalia, type Regla } from "@/lib/plausibilidad";

/** Los tokens y el CSS del informe para el ⓘ y su hoja: se cargan aparte (ver TokensWizard). */
const TokensWizard = dynamic(() => import("./TokensWizard"), { ssr: false });

/** Guard de sesión del StartFreeAnalysis (1 disparo por pestaña/sesión). */
const SFA_SESSION_KEY = "meta_sfa_fired";

/** Rótulo corto de modalidad para el chip de la cabecera del paso. */
const MOD_CHIP: Record<string, string> = {
  ltr: "Renta larga",
  str: "Renta corta",
  both: "Comparativo",
};

export function WizardV4({
  resume,
  comunaInicial = null,
  direccionInicial = null,
  modoInicial = null,
  entrada = "wizard",
}: {
  resume: boolean;
  /** Comuna precargada desde ?comuna= (páginas SEO). Solo contexto: la pantalla
   *  de dirección igual exige una dirección confirmada. */
  comunaInicial?: { comuna: string; ciudad: string } | null;
  /** La dirección que manda el hero de la landing (`?direccion&lat&lng&comuna[&precision]`). */
  direccionInicial?: DireccionLlegada | null;
  /** Un camino sin dirección elegido en la landing (`?modo=ubicacion|mapa`). */
  modoInicial?: ModoLlegada | null;
  /** Por qué puerta entró la sesión. Viaja en los eventos de paso: quien llega desde la landing
   *  arranca en `tipo` sin ver `dir`, y el embudo tiene que poder separarlo. */
  entrada?: "landing" | "wizard";
}) {
  const posthog = usePostHog();
  const emitEvent = useCallback(
    (name: string, props?: Record<string, unknown>) => { trackWizard(posthog, name, props); },
    [posthog],
  );

  const owner = useWizardV4Owner();
  const w = useWizardV4({ resume, owner, onEvent: emitEvent });
  const { nav } = w;
  const data = useWizardV4Data(nav.answers);
  const { tier, isLoggedIn } = useWizardV4Tier();

  const acto = ACTO_BY_NODE[nav.current];
  const actoLabel = ACTO_LABEL[acto];
  // Chip de modalidad: aparece recién en el tramo final (la modalidad se elige
  // después de `plazo`), y ahí sirve de confirmación de lo recién elegido en las
  // pantallas de renta. Píldora neutra (no Signal Red — no es atención). El
  // resumen lleva el suyo, editable, así que acá no se repite.
  const modLabel = nav.answers.modalidad && nav.current !== "resumen" ? MOD_CHIP[nav.answers.modalidad] : null;
  const progress = w.progress;

  // Precarga de comuna (?comuna=). Una sola vez y solo si el usuario todavía no
  // tiene una: nunca debe pisar lo que ya eligió, ni al retomar un draft.
  const comunaPrecargada = useRef(false);
  useEffect(() => {
    if (comunaPrecargada.current || !comunaInicial) return;
    comunaPrecargada.current = true;
    if (nav.answers.comuna) return;
    w.patchAnswers({ comuna: comunaInicial.comuna, ciudad: comunaInicial.ciudad });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comunaInicial]);

  // ── LA LLEGADA DESDE LA LANDING (una puerta, dos accesos, 26-sep-2026) ──────────
  // Con la dirección ya elegida en el hero: con cobertura, arranca en el mapa (siempre la segunda
  // pantalla, 27-sep-2026), con el pin en la dirección o en la calle; fuera de cobertura, en la
  // portada con el aviso. Con `?modo=mapa`, en el mapa; con `?modo=ubicacion`, la portada pide la
  // ubicación al llegar.
  //
  // Espera a que el hook haya mirado el borrador: si hay uno a medias, la portada pregunta antes
  // (seguir con lo nuevo o retomar) y NO se escribe nada hasta que la persona elija —mientras hay
  // un borrador pendiente el wizard no persiste—. «Retomar» descarta la llegada; «seguir» o
  // «empezar de cero» descartan el borrador y aplican la llegada.
  const hayLlegada = !!direccionInicial || !!modoInicial;
  const llegadaAplicada = useRef(false);
  // EL `dir` FANTASMA (auditoría 28-sep-2026): con una llegada pendiente el wizard monta en `dir` y
  // un instante después la llegada lo desvía al mapa. Hasta que la llegada se aplica, ni
  // `wizard4_step_viewed` ni la telemetría de paso miran el nodo: el primer paso medido es el que
  // el usuario ve. Sin llegada, listo desde el montaje.
  const [llegadaLista, setLlegadaLista] = useState(!hayLlegada);
  const [autoCamino, setAutoCamino] = useState<CaminoSinDireccion | null>(null);
  useEffect(() => {
    if (!hayLlegada || llegadaAplicada.current || !w.inicializado || w.draftPendiente) return;
    llegadaAplicada.current = true;
    setLlegadaLista(true);
    if (direccionInicial) {
      const d = direccionInicial;
      const destino = destinoDeLlegada(d);
      trackWizard(posthog, "wizard4_llegada_landing", { destino, precision: d.precision, cubierta: d.cubierta });
      const base = { direccion: d.direccion, comuna: d.comuna, ciudad: d.ciudad, mapaAviso: undefined };
      if (destino === "mapa") {
        const numero = d.precision === "numero";
        w.goDetour("dirMapa", { ...base, direccionConfirmada: undefined, lat: d.lat, lng: d.lng, ubicacionPrecision: numero ? "numero" : "calle", mapaOrigen: numero ? "numero" : "sin_numero" });
      } else {
        w.patchAnswers({ ...base, direccionConfirmada: undefined, lat: undefined, lng: undefined, ubicacionPrecision: undefined });
      }
      return;
    }
    trackWizard(posthog, "wizard4_llegada_landing", { destino: modoInicial === "mapa" ? "mapa" : "portada", modo: modoInicial });
    if (modoInicial === "mapa") {
      w.goDetour("dirMapa", { direccionConfirmada: undefined, lat: undefined, lng: undefined, ubicacionPrecision: undefined, mapaOrigen: "mapa", mapaAviso: undefined });
    } else if (modoInicial === "ubicacion") {
      setAutoCamino("ubicacion");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayLlegada, w.inicializado, w.draftPendiente]);

  const retomarBorrador = () => { llegadaAplicada.current = true; setLlegadaLista(true); w.resumeDraft(); };

  // ── EL BORRADOR SOLO CUANDO VALE LA PENA (QA en el iPhone, 28-sep-2026) ──────────
  // Antes, cualquier borrador pendiente abría «Análisis a medias» apenas llegaba otra dirección.
  // Ahora se decide (`decidirBorrador`): sin avance más allá del mapa se reemplaza en silencio;
  // con avance y la misma dirección se retoma en silencio; solo con avance y otra dirección se
  // pregunta. Corre apenas el hook miró el borrador, antes de que la llegada escriba nada.
  const decisionBorrador = useRef(false);
  useEffect(() => {
    if (!w.inicializado || !w.draftPendiente || decisionBorrador.current) return;
    const decision = decidirBorrador(w.draftPendiente, direccionInicial?.direccion ?? null);
    if (decision === "ofrecer") { decisionBorrador.current = true; return; }
    decisionBorrador.current = true;
    trackWizard(posthog, "wizard4_borrador_decision", { decision, llegada: !!direccionInicial });
    if (decision === "reemplazar") w.reemplazarBorrador();
    else if (decision === "retomar") retomarBorrador();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.inicializado, w.draftPendiente]);
  const conflictoBorrador =
    !!direccionInicial && !llegadaAplicada.current &&
    borradorEsDeOtraDireccion(w.draftPendiente?.answers?.direccion, direccionInicial.direccion);
  const calle = (x: string | null | undefined) => direccionCorta(x).split(",")[0];
  const bannerPortada = w.bannerDraftVisible ? (
    <div className="he-nota" role="region" aria-label="Análisis a medias">
      <p className="he-nota-t">Análisis a medias</p>
      {conflictoBorrador ? (
        <p>
          Tienes a medias el de <b>{direccionCorta(w.draftPendiente?.answers?.direccion)}</b>. ¿Sigues con{" "}
          <b>{calle(direccionInicial?.direccion)}</b> o retomas el otro?
        </p>
      ) : (
        <p>Tienes un análisis a medias. ¿Lo retomas donde lo dejaste?</p>
      )}
      <div className="he-nota-acc">
        {conflictoBorrador ? (
          <>
            <button type="button" className="pri" onClick={w.discardDraft}>Seguir con {calle(direccionInicial?.direccion)}</button>
            <button type="button" onClick={retomarBorrador}>Retomar {calle(w.draftPendiente?.answers?.direccion)}</button>
          </>
        ) : (
          <>
            <button type="button" className="pri" onClick={retomarBorrador}>Retomar</button>
            <button type="button" onClick={w.discardDraft}>Empezar de cero</button>
          </>
        )}
      </div>
    </div>
  ) : null;

  // La puerta de entrada viaja en TODOS los eventos de la sesión (informe, registro, pago), no solo
  // en los del wizard: súper propiedad de sesión (28-sep-2026).
  useEffect(() => {
    try { posthog?.register_for_session({ entrada }); } catch { /* sin PostHog no pasa nada */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posthog]);

  // step_viewed: una vez por cambio de nodo (guard anti-doble en StrictMode), y solo cuando la
  // llegada ya se aplicó: el `dir` que nadie ve no cuenta.
  const lastStep = useRef<NodeId | null>(null);
  useEffect(() => {
    if (!llegadaLista) return;
    if (lastStep.current === nav.current) return;
    lastStep.current = nav.current;
    trackWizard(posthog, "wizard4_step_viewed", { node: nav.current, entrada });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.current, posthog, llegadaLista]);

  // CADA PASO ARRANCA ARRIBA (QA en el iPhone, 28-sep-2026): al cambiar de paso, en los dos sentidos,
  // la página vuelve al inicio del contenido, justo bajo el header pegado. Sin esto el paso nuevo
  // aparecía con el scroll del anterior y la reacción de arriba cortada bajo el header. `instant`
  // y no el scroll suave de html: el cambio de pantalla ya trae su transición.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.current]);

  // Terminal (generar / pagar / crear cuenta): lo marca la CTA final. Lo leen
  // el `wizard4_abandoned` de más abajo y la telemetría de paso (un submit no
  // es un abandono). Declarado acá arriba porque ambos lo necesitan.
  const terminatedRef = useRef(false);
  const markTerminal = useCallback(() => { terminatedRef.current = true; }, []);

  // Ciclo de vida por paso (I-1): `wizard4_step_left` con dwell, interacciones,
  // rechazos de validación y la VÍA de salida. Vive acá porque este componente
  // es el dueño del nav y del contenedor de pantalla — cero cambios en las
  // pantallas. Ver stepTelemetry.ts para las seis causas que separa.
  const screenRef = useRef<HTMLDivElement>(null);
  useStepTelemetry({
    posthog,
    node: nav.current,
    dir: nav.dir,
    answers: nav.answers,
    completed: nav.completed,
    contenedorRef: screenRef,
    terminadoRef: terminatedRef,
    extra: { entrada },
    activo: llegadaLista,
  });

  // Meta Pixel · StartFreeAnalysis (custom, browser-only): "usuario elegible
  // entró al wizard". Se evalúa al montar y de nuevo cuando llega /api/me/tier
  // (el gate necesita el tier; mientras sea null no se decide nada). NO depende
  // del nodo actual ni excluye ?resume=1: el recién registrado vuelve por
  // /register?next=/analisis/nuevo-v4?resume=1 y ese es justamente el segmento
  // que la campaña mide — como guest no disparó (tier="guest"), dispara al
  // volver logueado.
  //
  // Una sola vez por sesión de navegador: sessionStorage para sobrevivir
  // remounts/navegación same-tab, más un ref en memoria que cubre el doble
  // render de StrictMode y el caso en que sessionStorage tire (modo privado) —
  // ahí se dispara igual, degradado, antes que perder el evento.
  //
  // Sin event_id: no hay contraparte CAPI que deduplicar. Gate de infra
  // heredado: sin NEXT_PUBLIC_META_PIXEL_ID no existe fbq y metaTrackCustom es
  // no-op (mismo trato que PageView e InitiateCheckout).
  //
  // Post-F2 (cap anónimo): el ANÓNIMO con cap disponible también cumple el
  // espíritu del evento — es un usuario nuevo entrando al wizard con su gratis
  // por delante, solo que ya no necesita registrarse primero. Mismo evento
  // (Meta ya lo conoce y las campañas lo referencian), mismo guard de sesión:
  // si después se registra y vuelve, sessionStorage ya lo marcó y no re-dispara.
  const sfaFired = useRef(false);
  useEffect(() => {
    if (sfaFired.current) return;
    const anonConCap = tier?.tier === "guest" && tier.anonCapAvailable === true;
    if (!esNuevoConAnalisisGratis(tier) && !anonConCap) return;
    try {
      if (sessionStorage.getItem(SFA_SESSION_KEY)) {
        sfaFired.current = true;
        return;
      }
      sessionStorage.setItem(SFA_SESSION_KEY, "1");
    } catch {
      // sessionStorage no disponible → seguimos con el guard en memoria.
    }
    sfaFired.current = true;
    metaTrackCustom("StartFreeAnalysis");
  }, [tier]);

  // abandoned (best-effort): pagehide sin haber llegado a terminal (generar /
  // pagar / crear cuenta), y solo si el usuario ya arrancó. Se CONSERVA tal cual
  // por continuidad histórica de los funnels — `wizard4_step_left` convive con
  // él y lo supera en detalle, pero no lo reemplaza.
  // navSnap da el nodo/modalidad al momento de salir.
  const navSnap = useRef(nav);
  useEffect(() => { navSnap.current = nav; }, [nav]);
  useEffect(() => {
    const onHide = () => {
      if (terminatedRef.current) return;
      const s = navSnap.current;
      const started = s.answers.modalidad != null || s.history.length > 0;
      if (!started) return;
      trackWizard(posthog, "wizard4_abandoned", { node: s.current, modalidad: s.answers.modalidad });
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [posthog]);

  // Reacción de Franco con datos reales (comparables, UF del día, aviso subsidio).
  const live: ReactionLive = {};
  if (data.comparables.length > 0) { live.comparables = data.comparables.length; live.radioM = data.radiusUsed; }
  const puf = leerNum(nav.answers.precio, DEC.precioUF);
  if (puf > 0 && data.ufCLP > 0) live.precioCLP = fmtCLP(puf * data.ufCLP);
  live.subsidioAviso = avisoSubsidioAplica(nav.answers, data.precioM2UF);
  const reaction = nav.reactionSource ? reactionText(nav.reactionSource, nav.answers, live) : null;

  // Evento del funnel: aviso de subsidio efectivamente mostrado.
  const avisoVisible = nav.reactionSource === "tam" && live.subsidioAviso === true;
  useEffect(() => {
    if (avisoVisible) trackWizard(posthog, "wizard4_subsidio_hint_shown", { comuna: nav.answers.comuna });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avisoVisible]);

  // ── ALERTA TEMPRANA (PIEZA B2) ─────────────────────────────────────────────
  //
  // Cada regla dispara cuando sus insumos existen: UF/m² se puede calcular
  // apenas hay precio y superficie, cinco pantallas antes del resumen. No hay
  // chequeo nuevo — es `evaluarPlausibilidad` con el input PARCIAL que haya, y
  // el fail-open por regla se encarga de que lo que no tiene insumos no corra.
  //
  // Se evalúa en CADA respuesta, no en una lista de pantallas: así una
  // corrección hacia atrás (editar la superficie después del precio) también
  // dispara. En el avance normal el efecto es el de la tabla del contrato,
  // porque una regla sin insumos no devuelve nada.
  const [alerta, setAlerta] = useState<{ anomalias: Anomalia[]; seguir: () => void } | null>(null);
  // Una vez por VALOR y por REGLA: se recuerda con qué valor se mostró cada una.
  // Si el usuario cierra y no toca el dato, no vuelve; si lo edita y sigue fuera
  // de rango, el valor cambia y vuelve a avisar.
  const vistas = useRef<Partial<Record<Regla, number>>>({});

  const answerConAlerta = useCallback(
    (node: NodeId, patch?: Partial<WizardV4Answers>) => {
      const avanzar = () => w.answer(node, patch);
      if (data.ufCLP <= 0) { avanzar(); return; }
      const answersConPatch = { ...nav.answers, ...patch };
      let nuevas: Anomalia[] = [];
      try {
        nuevas = evaluarPlausibilidad(buildPlausibilidadParcial(answersConPatch, data.ufCLP))
          .filter((an) => vistas.current[an.regla] !== an.valor);
      } catch {
        nuevas = []; // fail-open: el resumen y el server siguen siendo las redes duras.
      }
      if (nuevas.length === 0) { avanzar(); return; }
      for (const an of nuevas) vistas.current[an.regla] = an.valor;
      // Blur ANTES de abrir: acá el usuario viene de tipear y en mobile el
      // teclado está abierto — sin esto el modal nace aplastado arriba.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      trackWizard(posthog, "wizard4_alerta_temprana", {
        node, reglas: nuevas.map((x) => x.regla), modalidad: nav.answers.modalidad,
      });
      setAlerta({ anomalias: nuevas, seguir: avanzar });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [w.answer, nav.answers, data.ufCLP, posthog],
  );

  const screenProps: ScreenProps = {
    answers: nav.answers,
    data,
    patchAnswers: w.patchAnswers,
    answer: answerConAlerta,
    goDetour: w.goDetour,
  };

  // La PORTADA (nodo `dir`) se dibuja su propio encabezado: título grande con el
  // fragmento en Signal Red, bajada de dos líneas y chips. El headcard genérico
  // —rótulo de acto + barra en 0% + chevron sin historial— no aporta nada ahí y
  // sí cuesta lo único escaso: los píxeles sobre el pliegue. Cero de 214
  // sesiones scrollearon en esta pantalla, así que cada bloque que se cuela
  // arriba desaparece la acción de la vista.
  const esPortada = nav.current === "dir";

  // LA PORTADA ES EL HERO DE LA LANDING (26-sep-2026): a pantalla completa, con su propia cabecera y
  // sin el contenedor del interior. El banner del borrador va adentro, en papel sobre el hero.
  if (esPortada) {
    return (
      <div ref={screenRef}>
        <EntradaScreen {...screenProps} banner={bannerPortada} autoCamino={autoCamino} />
      </div>
    );
  }

  return (
    <div className="wz4-lienzo min-h-screen">
      <HeaderFranco contexto="wizard" />
      <TokensWizard />

      {/* El resumen usa el mismo ancho que las preguntas: sus tres tarjetas son filas
          navegables una bajo otra, como en el informe, no columnas. */}
      <main className="wz4 doc-dictamen wizard4-main mx-auto max-w-[600px] px-4 pt-4 pb-10 md:pt-8">
        {/* Cabecera del paso: disco de atrás · acto · chip, y la barra en tinta.
            En la portada no se dibuja (ver `esPortada`). */}
        <div className="wz-cab">
          <div className="wz-cab-fila">
            {w.canGoBack && (
              <button type="button" onClick={w.goBack} aria-label="Volver a la pregunta anterior" className="wz-disco">
                <ChevronLeft size={16} aria-hidden />
              </button>
            )}
            <span className="wz-acto">{actoLabel}</span>
            {modLabel && <span className="wz-chip">{modLabel}</span>}
          </div>
          <div className="wz-barra" aria-hidden>
            <i style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>

        {/* Banner de retomar draft. Vive en el layout del <main>, fuera del
            router de pantallas → sin el gate se renderiza en las 12 pantallas. */}
        {w.bannerDraftVisible && (
          <div className="wz-bloque wz-retomar" role="region" aria-label="Análisis sin terminar">
            <div className="wz-bt">Análisis sin terminar</div>
            <p>Tienes un análisis a medias. ¿Lo retomas donde lo dejaste?</p>
            <button type="button" onClick={w.resumeDraft} className="wz-btn2 tinta">
              Retomar
            </button>
            <LinkBtn onClick={w.discardDraft}>Empezar de cero</LinkBtn>
          </div>
        )}

        {/* Contenido de pantalla con transición slide+fade. `clip` y no `hidden`: `hidden` crea un
            contenedor de scroll y la barra fija del botón (sticky) dejaba de pegarse abajo. */}
        <div className="overflow-x-clip">
          <div key={nav.current} ref={screenRef} className="wizard4-screen" data-dir={nav.dir}>
            {reaction && <FrancoReaction>{reaction}</FrancoReaction>}

            <h1 className="wz-titulo">{NODE_TITLE[nav.current]}</h1>

            <Screen node={nav.current} w={w} screenProps={screenProps} data={data} tier={tier} isLoggedIn={isLoggedIn} onTerminal={markTerminal} />
          </div>
        </div>
      </main>

      {/* Alerta temprana: mismo componente que el resumen, en modo "aviso".
          Avisa y deja seguir — el resumen y el server siguen bloqueando. */}
      <ModalPlausibilidad
        open={alerta !== null}
        anomalias={alerta?.anomalias ?? []}
        modo="aviso"
        onSeguir={() => {
          const seguir = alerta?.seguir;
          setAlerta(null);
          seguir?.();
        }}
        onCerrar={() => {
          setAlerta(null);
          // "Corregir": el foco vuelve al campo de ESTA pantalla.
          window.setTimeout(() => {
            const input = document.querySelector<HTMLInputElement>(".wizard4-screen input");
            input?.focus();
            input?.select?.();
          }, 0);
        }}
      />
    </div>
  );
}

// ── Router de pantallas ──────────────────────────────────────────────────────

function Screen({
  node,
  w,
  screenProps,
  data,
  tier,
  isLoggedIn,
  onTerminal,
}: {
  node: NodeId;
  w: ReturnType<typeof useWizardV4>;
  screenProps: ScreenProps;
  data: ReturnType<typeof useWizardV4Data>;
  tier: ReturnType<typeof useWizardV4Tier>["tier"];
  isLoggedIn: boolean;
  onTerminal: () => void;
}) {
  switch (node) {
    // ── Acto 1 ──
    // `dir` (la portada) se dibuja fuera de este router, a pantalla completa (ver `esPortada`).
    case "dir":
      return null;
    case "dirMapa":
      return <MapaScreen {...screenProps} onVolver={w.goBack} />;
    case "tipo":
      return <TipoScreen {...screenProps} />;
    case "ent":
      return <EntregaScreen {...screenProps} />;
    case "ant":
      return <AntiguedadScreen {...screenProps} />;
    case "tam":
      return <TamanoScreen {...screenProps} />;

    // ── Acto 2 ──
    case "precio":
      return <PrecioScreen {...screenProps} />;
    case "pie":
      return <PieScreen {...screenProps} />;
    case "tasa":
      return <TasaScreen {...screenProps} />;
    case "tasaFix":
      return <TasaFixScreen {...screenProps} />;
    case "plazo":
      return <PlazoScreen {...screenProps} />;

    // ── EL INFORME (primera pantalla) ──
    case "mod":
      return <InformeScreen {...screenProps} />;

    // ── Acto 3 ──
    case "arr":
      return <ArrScreen {...screenProps} />;
    case "arrFix":
      return <ArrFixScreen {...screenProps} />;
    case "adr":
      return <AdrScreen {...screenProps} />;
    case "adrFix":
      return <AdrFixScreen {...screenProps} />;

    case "resumen":
      return <ResumenScreen w={w} data={data} tier={tier} isLoggedIn={isLoggedIn} onTerminal={onTerminal} />;

    default:
      return null;
  }
}
