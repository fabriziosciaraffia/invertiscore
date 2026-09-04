"use client";

/**
 * Results client (Renta Corta).
 *
 * Render del módulo STR (E.2 · orden LTR: la pirámide ES el detalle):
 *   • UnifiedNav variant="app"
 *   • HeroVerdictBlockSTR (veredicto + score + KPIs + conviene IA)
 *   • EjesAplicadosSTR — panel "¿Cómo llegamos?" (colapsable)
 *   • PiramideHallazgosSTR — el detalle; sus cards abren DrawerContentSTR
 *   • AdvancedSectionSTR (07-10 · escenarios · patrimonio · venta)
 *   • ZonaCardSTR — destino zona, abre el drawer tipoHuesped
 *   • DrawerSTR + DrawerContentSTR — overlay de detalle (estado acá)
 *
 * Gating: el render completo se muestra siempre. Los CTAs (WalletStatusCTA +
 * ProCTABanner) gestionan el upgrade.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePostHog } from "posthog-js/react";
import { registrarInformeVisto, leerEsperaMs } from "@/lib/informe-visto";
import { ArrowRight } from "lucide-react";
import { UnifiedNav } from "@/components/chrome/UnifiedNav";
import { PublicShareHeader } from "@/components/chrome/PublicShareHeader";
import { ShareButton } from "@/components/chrome/ShareButton";
import { ConversionHook, ConversionCloser } from "@/components/chrome/SharedConversionCTA";
import { AppFooter } from "@/components/chrome/AppFooter";
import { ProCTABanner } from "@/components/chrome/ProCTABanner";
import { WalletStatusCTA } from "@/components/chrome/WalletStatusCTA";
import { NextAnalysisCTA, nextCtaState } from "@/components/analysis/NextAnalysisCTA";
import { MarcaSeccion } from "@/components/analysis/informeTelemetry";
import { CtaWelcome } from "@/components/analysis/CtaWelcome";
import type { ShortTermResult, STRVerdict } from "@/lib/engines/short-term-engine";
import type { FrancoScoreSTR } from "@/lib/engines/short-term-score";
import { HeroStrDictamen } from "@/components/analysis/str/HeroStrDictamen";
import { StateBox } from "@/components/ui/StateBox";
import { fechaCortaCL } from "@/lib/fecha-cl";
import { ordenarHallazgosPiramideSTR } from "@/components/analysis/str/PiramideHallazgosSTR";
import { PrincipalesHallazgos } from "@/components/analysis/PrincipalesHallazgos";
import { SeccionInforme } from "@/components/analysis/SeccionInforme";
import { TokensShared } from "@/components/analysis/shared";
import { SeisCifrasStr } from "@/components/analysis/str/SeisCifrasStr";
import { ModalCalculoStr } from "@/components/analysis/str/ModalCalculoStr";
import { CapitulosInversionStr, CAPITULO_DE_HALLAZGO_STR, type CapituloStrId } from "@/components/analysis/str/CapitulosInversionStr";
import { ZonaStrSection } from "@/components/analysis/str/ZonaStrSection";
import { SubordinatedBanner } from "@/components/analysis/SubordinatedBanner";
import type { AIAnalysisSTRv2, HallazgoDistanciaVeredicto } from "@/lib/types";
import type { NivelPie } from "@/lib/analysis";
import type { SimulacionStr } from "@/lib/analysis/simular-str";
import type { ZonaStr } from "@/lib/zona-str";
import { derivarCifraClaveStr } from "@/lib/cifra-clave";
import { buildFichaStr } from "@/lib/ficha-depto";
import { formatDireccionDisplay } from "@/lib/format-direccion";
import { DocumentoFrame, PortadaInforme } from "@/components/analysis/portada/PortadaInforme";
import { useComparablesCercanos } from "@/components/analysis/portada/useComparablesCercanos";

// Replica el formato de fecha de la vista AMBAS (shared-client → formatFechaCorta):
// "7 de junio 2026". Usado en el header público de la vista guest.
function formatFechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${d.getDate()} de ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

interface STRResultsProps {
  analysisId: string;
  results: ShortTermResult & { francoScore?: FrancoScoreSTR };
  inputData: Record<string, unknown> | null;
  accessLevel: "guest" | "free" | "premium" | "subscriber";
  ufValue: number;
  nombre: string;
  comuna: string;
  ciudad: string;
  superficie: number;
  createdAt: string;
  fechaProsa?: string;
  userId: string | null;
  isSharedView: boolean;
  userCredits: number;
  welcomeAvailable?: boolean;
  aiAnalysisInitial?: unknown;
  /** Goal F (espejo LTR): la prosa persistida quedó con promptVersion vieja —
   *  el server no la pasó como inicial; el cliente NO pollea (el status la
   *  devolvería como ready) y regenera directo vía POST (stale-regen, gratis). */
  aiStaleInitial?: boolean;
  /** Solo el dueño con sesión (o admin) puede regenerar: el POST responde 401 sin
   *  sesión y 403 sobre una fila ajena. Sin este guard, un link compartido dispara
   *  un request que muere en 401 y deja el informe sin prosa Y con un error. */
  puedeRegenerarProsa?: boolean;
  /** La prosa mostrada viene de un contrato anterior: se rotula con su fecha. */
  prosaDesactualizada?: boolean;
  /** Hijo subordinado de un AMBAS: link al comparativo. Si viene, se oculta el
   * Compartir propio y se muestra el banner de subordinación (migración 20260715). */
  subordinatedHref?: string | null;
  /** Gate server-side (input_data.chargeMode === "welcome" + dueño): monta el
   * CTA post-análisis welcome (banda inline + popup). */
  showCtaWelcome?: boolean;
  /** Anónimo-DUEÑO (cap F2-2): informe completo sin sesión — se suprimen los
   * POST de regen IA (exigen login) y el header pasa a la variante de guardado. */
  isAnonOwner?: boolean;
  /** Escalera del pie precalculada en el server (`simularPieStr`): el reconstructor
   *  del input arrastra `next/headers` y no puede importarse desde el cliente. */
  nivelesPie?: NivelPie[];
  /** Simulaciones del CONGELADO (T0): fronteras de los diales y las matrices, calculadas en
   *  el server. T1 las dibuja; hasta entonces viajan y no se leen. */
  simulacionStr?: SimulacionStr | null;
  /** LA ZONA (T2): tarifa, ocupación y comparables con procedencia, calculada en el server. */
  zonaStr?: ZonaStr | null;
}

export function STRResultsClient({
  analysisId,
  results,
  inputData,
  accessLevel,
  ufValue,
  nombre,
  comuna,
  createdAt,
  fechaProsa,
  isSharedView,
  userCredits,
  welcomeAvailable = true,
  aiAnalysisInitial,
  aiStaleInitial = false,
  puedeRegenerarProsa = true,
  prosaDesactualizada = false,
  subordinatedHref = null,
  showCtaWelcome = false,
  isAnonOwner = false,
  simulacionStr = null,
  zonaStr = null,
}: STRResultsProps) {
  const [currency, setCurrency] = useState<"CLP" | "UF">("CLP");
  // E.2 — estado del drawer de detalle, levantado al orquestador (patrón LTR
  // SubjectCardGrid): lo abre la pirámide (hallazgos) y la card zona (tipoHuesped).
  // T1 — modal "Cómo se calcula" y apertura de un capítulo desde Principales hallazgos
  // (espejo de SubjectCardGrid LTR).
  const [calculoAbierto, setCalculoAbierto] = useState(false);
  const [capituloAbrir, setCapituloAbrir] = useState<{ id: string; nonce: number } | null>(null);
  const abrirCapitulo = (id: CapituloStrId) => setCapituloAbrir({ id, nonce: Date.now() });

  // Orden único de la pirámide STR — una sola pasada para la secuencia de drawers
  // y el resolver de telemetría (mismo array que renderiza).
  const hallazgosOrdenadosSTR = ordenarHallazgosPiramideSTR(results?.hallazgos);

  // ─── AI state ─────────────────────────────────────
  const initialAi =
    aiAnalysisInitial && typeof aiAnalysisInitial === "object"
      ? (aiAnalysisInitial as Record<string, unknown>)
      : null;
  const [aiAnalysis, setAiAnalysis] = useState<Record<string, unknown> | null>(initialAi);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Goal F — generación bajo demanda SOLO para rescate/stale/manual (la normal
  // corre en el waitUntil del submit STR, patrón LTR). El trigger es telemetría
  // de pipeline_timing, nunca lógica.
  const generarProsa = useCallback(async (trigger: "rescate" | "stale-regen" | "manual") => {
    if (!analysisId) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/analisis/short-term/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId, trigger }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Error generando análisis IA");
      }
      const data = await res.json();
      setAiAnalysis(data as Record<string, unknown>);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setAiLoading(false);
    }
  }, [analysisId]);

  // Goal F — polling PERSISTENTE de /short-term/[id]/ai-status (espejo LTR,
  // Goal C): la prosa se genera en background desde el submit; acá solo se
  // espera. 5s el primer minuto, 10s después; errores de red transitorios no
  // matan el loop (10 consecutivos sí). El RESCATE corre UNA vez y SOLO con
  // dictamen del server (`puedeRescate`: error registrado en pipeline_timing,
  // o >6 min sin prosa — imposible viva con maxDuration 300s del submit).
  // Filas stale (versión vieja): sin polling, regen directa gratis.
  useEffect(() => {
    if (!analysisId) return;
    // T2.1: con prosa VIEJA en pantalla igual se intenta la regen (solo el dueño); si el POST
    // falla, la vieja se queda y se marca con su fecha. Sin prosa y con 500, el hero muestra
    // "No pudimos completar la redacción" con Reintentar; nunca un "redactando" infinito.
    if (aiAnalysis && !aiStaleInitial) return;
    const isPaid = accessLevel === "premium" || accessLevel === "subscriber";
    if (!isPaid) return;

    if (aiStaleInitial) {
      // Anónimo-dueño: el POST exige login → sin regen (espejo LTR).
      // Y quien NO puede regenerar (link compartido, invitado) tampoco lo intenta: el
      // server ya le mandó la prosa vieja con su fecha, así que no hay nada que pedir
      // y el request moriría en 401 dejando el informe mudo. Port literal de LTR.
      if (!aiError && puedeRegenerarProsa && !isAnonOwner) generarProsa("stale-regen");
      return;
    }

    let cancelled = false;
    setAiLoading(true);
    setAiError(null);

    const startTime = Date.now();
    const POLL_INTERVAL_MS = 5000;
    const POLL_INTERVAL_LARGO_MS = 10000;
    const BACKOFF_DESDE_MS = 60000;
    const MAX_ERRORES_CONSECUTIVOS = 10;
    let erroresConsecutivos = 0;
    let rescateDisparado = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const reagendar = () => {
      if (cancelled) return;
      const interval = Date.now() - startTime > BACKOFF_DESDE_MS ? POLL_INTERVAL_LARGO_MS : POLL_INTERVAL_MS;
      timer = setTimeout(poll, interval);
    };

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/analisis/short-term/${analysisId}/ai-status`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        erroresConsecutivos = 0;
        if (data?.ready && data.ai_analysis && typeof data.ai_analysis === "object") {
          setAiAnalysis(data.ai_analysis as Record<string, unknown>);
          setAiLoading(false);
          return;
        }
        if (data?.puedeRescate && !rescateDisparado && !isAnonOwner) {
          rescateDisparado = true;
          await generarProsa("rescate");
          return;
        }
        reagendar();
      } catch {
        if (cancelled) return;
        erroresConsecutivos += 1;
        if (erroresConsecutivos >= MAX_ERRORES_CONSECUTIVOS) {
          setAiError("Error cargando análisis");
          setAiLoading(false);
          return;
        }
        reagendar();
      }
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisId]);

  // Goal B — `informe_visto` STR: el veredicto es visible desde el primer
  // render (HeroSTR lo pinta con la prosa en skeleton inline), así que el
  // momento es el mount. ai_estado registra si la prosa venía persistida o
  // sigue en vuelo. Fail-soft entero (capture + RPC NULL-only vía helper).
  const posthog = usePostHog();
  const informeVistoRef = useRef(false);
  useEffect(() => {
    if (informeVistoRef.current) return;
    informeVistoRef.current = true;
    registrarInformeVisto({
      posthog,
      ids: [analysisId],
      modalidad: "str",
      aiEstado: aiStaleInitial ? "stale-regen" : initialAi ? "cacheada" : "generando",
      esperaMs: leerEsperaMs(),
      esOwner: !isSharedView,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FASE 4: la prosa llega CRUDA (con `**…**`) — el plumón se pinta en los
  // puntos de render. El strip sobrevive SOLO en /documento (el PDF no cambia).
  const aiParaRender = aiAnalysis;
  // Prosa vieja en pantalla: la del server marcada como tal (no dueño) o la del dueño cuya
  // regen falló o sigue en vuelo (la inicial era stale y no fue reemplazada).
  const mostrandoProsaVieja = prosaDesactualizada || (aiStaleInitial && aiAnalysis != null && aiAnalysis === initialAi);

  // ─── Datos derivados ──────────────────────────────
  // Commit E.0 (2026-05-13): eliminado fallback `score ?? 50`. Análisis legacy
  // sin FrancoScoreSTR persistido pasan score=null al Hero (renderiza "—") y
  // dispara banner "Análisis incompleto · regenera" arriba del Hero. Antes
  // mostrábamos un 50 inventado que contradecía slider visual y badge motor
  // (bug Lastarria). El veredicto sigue cayendo a results.veredicto (motor)
  // mientras no se elimina la divergencia en E.2.
  const francoScore = results.francoScore;
  const score: number | null = francoScore?.score ?? null;
  const isIncompleteScore = score === null;
  const veredicto: STRVerdict =
    (francoScore?.veredicto as STRVerdict) ?? results.veredicto;

  // E.5 — el HeroSTR lee los chips (dorm/baño/m²/precio/pie/gestión) directamente
  // de input_data; ya no se arma metadataItems/subtitle acá. propiedadTitle queda
  // porque lo usa el ShareButton.
  const propiedadTitle = nombre || `Depto en ${comuna}`;

  // ═══ PORTADA (FASE 3 rediseño Dictamen — espejo LTR) ═══
  const direccionPortada = formatDireccionDisplay((inputData?.direccion as string) ?? "");
  const titularCrudo = (aiAnalysis as { titular?: string | null } | null)?.titular ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rAny = results as any;
  const distanciaPortada =
    ((results?.hallazgos as { id: string }[] | undefined)?.find((h) => h.id === "distancia_veredicto") as
      | HallazgoDistanciaVeredicto
      | undefined) ?? null;
  const precioCompraCLP = Number(inputData?.precioCompra) || 0;
  const precioCompraUFIn = Number(inputData?.precioCompraUF) || 0;
  const ufStr = precioCompraUFIn > 0 ? precioCompraCLP / precioCompraUFIn : ufValue;
  // Los escenarios por modo viven en comparativa.str_auto/str_admin (verificado
  // contra el results persistido de bcc7af00 — los paths escenarios.strAuto no
  // existen y dejaban el ahorro de autogestión en null).
  const strAuto = rAny?.comparativa?.str_auto ?? rAny?.escenarios?.strAuto ?? rAny?.strAuto;
  const strAdmin = rAny?.comparativa?.str_admin ?? rAny?.escenarios?.strAdmin ?? rAny?.strAdmin;
  const difAutoAdmin =
    strAuto && strAdmin ? (Number(strAuto.flujoCajaMensual) || 0) - (Number(strAdmin.flujoCajaMensual) || 0) : null;
  const cifraPortada = derivarCifraClaveStr({
    veredicto,
    flujoBaseMensual: Number(rAny?.escenarios?.base?.flujoCajaMensual ?? NaN),
    ahorroAutogestionClpMes:
      inputData?.modoGestion === "administrador" && difAutoAdmin != null && difAutoAdmin > 0 ? difAutoAdmin : null,
    distancia: distanciaPortada,
    ufValue: ufStr,
  });
  const fichaPortada = buildFichaStr({
    input: inputData,
    // adrReferencia del escenario BASE = la tarifa efectiva (override incluido);
    // `adrAjustado` vive en ejesAplicados y no siempre es la tarifa del caso.
    adrNoche: Number(rAny?.escenarios?.base?.adrReferencia) || null,
    ocupacionZona: Number(rAny?.escenarios?.base?.ocupacionReferencia) || null,
    direccion: direccionPortada,
    comuna,
    moneda: currency,
  });
  const latPortada = typeof inputData?.lat === "number" ? (inputData.lat as number) : null;
  const lngPortada = typeof inputData?.lng === "number" ? (inputData.lng as number) : null;
  const compCercanos = useComparablesCercanos({
    comuna,
    superficie: Number(inputData?.superficieUtil) || 0,
    dormitorios: (inputData?.dormitorios as number) ?? null,
    lat: latPortada,
    lng: lngPortada,
  });
  const fechaCorta = fechaCortaCL(fechaProsa ?? createdAt);
  // T1 — «↓ Ver detalle» de Principales hallazgos abre el capítulo que desarrolla ese
  // hallazgo (mapa hallazgo → capítulo, espejo LTR). "Ajustar supuestos" de la portada
  // abre el IV, donde viven precio, pie y plazo.
  const scrollAHallazgo = (h: { id: string }) => {
    const cap = CAPITULO_DE_HALLAZGO_STR[h.id];
    if (cap) abrirCapitulo(cap);
  };
  const scrollASimulacion = () => abrirCapitulo("pagas");

  const isSubscriber = accessLevel === "subscriber";

  // F2-2 — CTA contextual: una sola fuente de props para el mount y la regla
  // de exclusión del pie (WalletStatusCTA no repite el estado rojo de compra).
  const nextCtaProps = {
    isLoggedIn: accessLevel !== "guest" && !isAnonOwner,
    isAnonOwner,
    isSubscriber,
    credits: userCredits,
    welcomeAvailable,
    isSharedView,
    source: "str" as const,
    registerNext: `/analisis/renta-corta/${analysisId}`,
  };
  const nextCtaEsCompra = nextCtaState(nextCtaProps) === "no_credits";
  const isAdmin = false; // El page.tsx ya resuelve admin a "subscriber"

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      {/* Chrome de nav/header — el PDF usa la vista documento aparte, no esta página. */}
      {accessLevel === "guest" || isAnonOwner ? (
        <PublicShareHeader
          date={formatFechaCorta(createdAt)}
          anonOwner={isAnonOwner}
          registerNext={`/analisis/renta-corta/${analysisId}`}
        />
      ) : (
        <UnifiedNav
          variant="app"
          // Hijo subordinado de un AMBAS: sin Compartir propio (el share vive en
          // el comparativo). Nav general se conserva.
          actionsSlot={
            subordinatedHref ? undefined : (
              <ShareButton
                path={`/analisis/renta-corta/${analysisId}`}
                pdfUrl={`/api/analisis/renta-corta/${analysisId}/pdf`}
                analysisId={analysisId}
                modalidad="STR"
                title={`Análisis Franco: ${propiedadTitle}`}
                text={`Mira el análisis de este depto. Score: ${score ?? "—"}/100`}
                score={score ?? undefined}
                nombre={propiedadTitle}
                comuna={comuna}
              />
            )
          }
        />
      )}

      <main className="mx-auto max-w-[1100px] px-4 sm:px-6 py-6 md:py-8">
        {/* Banner de subordinación AMBAS — hijo STR de un comparativo. */}
        {subordinatedHref && (
          <SubordinatedBanner href={subordinatedHref} modalidad="STR" />
        )}

        {/* CTA conversión — anzuelo (superficie Ink) · solo guest */}
        {accessLevel === "guest" && (
          <div className="mb-5">
            <ConversionHook />
          </div>
        )}

        {/* Banner análisis incompleto — Commit E.0 (2026-05-13).
            Análisis STR generados antes del FrancoScoreSTR (Commit 2) no tienen
            score persistido. Antes mostrábamos "50" hardcoded; ahora "—" en el
            Hero + este banner que invita a regenerar. */}
        {isIncompleteScore && (
          <div className="mb-4">
            <StateBox variant="left-border" state="attention" label="Análisis incompleto">
              Este análisis fue generado con una versión anterior del motor y no tiene Franco Score persistido. Regenera el análisis para ver el score completo y las recomendaciones actualizadas.
            </StateBox>
          </div>
        )}

        {/* 01 · VEREDICTO — HeroSTR (E.5 · port del patrón HeroLTR). Superficie
            continua: identidad + score/gauge/chips + mapa · veredicto (prosa IA
            conviene.{respuestaDirecta, reencuadre, cajaAccionable}) · TOP-3 hallazgos
            con puente a la pirámide. veredictoFrase ya no se renderiza; título por
            conviene.pregunta ?? hardcode (v3 podó el campo). */}
        {/* ═══ DOCUMENTO (FASE 3 rediseño Dictamen): papel + portada; el interior
            se transforma en FASE 4 ═══ */}
        <DocumentoFrame secciones>
        <TokensShared />
        <SeccionInforme id="portada" tono="paper">
        <PortadaInforme
          veredicto={veredicto}
          score={score}
          direccion={direccionPortada}
          comuna={comuna}
          modalidadLabel="Renta corta"
          fecha={fechaCorta}
          titular={titularCrudo}
          cifra={cifraPortada}
          ficha={fichaPortada}
          currency={currency}
          onCurrencyChange={setCurrency}
          mapa={
            latPortada != null && lngPortada != null
              ? {
                  lat: latPortada,
                  lng: lngPortada,
                  comparables: compCercanos.comparables,
                  count: compCercanos.count,
                  label: direccionPortada || comuna,
                }
              : null
          }
          onAjustarSupuestos={scrollASimulacion}
        />
        </SeccionInforme>
        {/* ═══ T1 (04-sep-2026) · el interior STR sobre piezas compartidas: hero con el
            contrato LTR → principales hallazgos → seis cifras → la inversión (seis
            capítulos I–VI) → la zona (placeholder hasta T2). Lo viejo (AdvancedSectionSTR,
            EjesAplicadosSTR, la pirámide y los drawers como cuerpo) queda desmontado de la
            página y vivo en el repo hasta T3. */}
        <SeccionInforme id="hero" tono="paper2">
          <MarcaSeccion seccion="hero" tipo="str" accessLevel={accessLevel} />
          <HeroStrDictamen
            ai={aiParaRender as unknown as AIAnalysisSTRv2 | null}
            results={results}
            veredicto={veredicto}
            simulacion={simulacionStr}
            currency={currency}
            valorUF={ufValue}
            createdAt={createdAt}
            fechaProsa={fechaProsa}
            aiLoading={aiLoading && !aiAnalysis}
            prosaError={aiError && !aiAnalysis ? aiError : null}
            onRetryProsa={() => generarProsa("manual")}
          />
        </SeccionInforme>
        {hallazgosOrdenadosSTR.length > 0 && (
          <SeccionInforme
            id="principales-hallazgos"
            tono="paper"
            eyebrow="Principales hallazgos"
            titulo="Qué determina el veredicto en este departamento"
            intent="Franco analizó los factores que pesan en la decisión. Estos son los cuatro que la mueven."
          >
            <MarcaSeccion seccion="hallazgos" tipo="str" accessLevel={accessLevel} />
            <PrincipalesHallazgos hallazgos={hallazgosOrdenadosSTR} currency={currency} valorUF={ufValue} onVerDetalle={scrollAHallazgo} />
          </SeccionInforme>
        )}
        <SeccionInforme
          id="los-numeros"
          tono="paper2"
          eyebrow="Los números"
          titulo="Las seis cifras que un inversionista mira primero"
          intent="Las cifras con las que se evalúa una renta corta — para comparar este departamento con otro, o con arrendarlo largo."
        >
          <MarcaSeccion seccion="numeros" tipo="str" accessLevel={accessLevel} />
          <SeisCifrasStr results={results} currency={currency} valorUF={ufValue} onCalculo={() => setCalculoAbierto(true)} />
          <ModalCalculoStr abierto={calculoAbierto} onClose={() => setCalculoAbierto(false)} results={results} valorUF={ufValue} fechaUF={fechaCortaCL(createdAt)} />
        </SeccionInforme>
        <SeccionInforme
          id="la-inversion"
          tono="paper"
          eyebrow="La inversión"
          titulo="Cómo funciona este departamento como renta corta"
          intent="Paso a paso: lo que factura, lo que queda cada mes, de qué depende, cómo lo pagas, contra qué lo comparas y con qué te quedas."
        >
          <MarcaSeccion seccion="piramide" tipo="str" accessLevel={accessLevel} />
          {francoScore ? (
            <CapitulosInversionStr
              results={results}
              francoScore={francoScore}
              hallazgos={results.hallazgos ?? []}
              simulacion={simulacionStr}
              inputData={inputData}
              currency={currency}
              valorUF={ufValue}
              comuna={comuna}
              createdAt={createdAt}
              veredicto={veredicto}
              accessLevel={accessLevel}
              abrir={capituloAbrir}
            />
          ) : (
            <p className="font-mono m-0" style={{ fontSize: 11.5, color: "var(--franco-text-muted)" }}>
              Este análisis no tiene Franco Score persistido: regenera el análisis para ver los capítulos.
            </p>
          )}
          {/* Procedencia de la prosa vieja — texto y ubicación idénticos a LTR. */}
          {mostrandoProsaVieja && fechaCorta && (
            <p className="font-mono m-0 mt-2" style={{ fontSize: 10.5, lineHeight: 1.5, color: "var(--franco-text-muted)" }}>
              Análisis redactado el {fechaCorta}. Los números de arriba se recalculan en cada visita; el texto es el de esa fecha.
            </p>
          )}
        </SeccionInforme>
        <SeccionInforme id="la-zona" tono="paper2" eyebrow={`La zona · ${comuna}`} titulo="La zona" intent="Contra qué compites y quién se va a alojar acá.">
          <MarcaSeccion seccion="zona" tipo="str" accessLevel={accessLevel} />
          {/* T2 (05-sep-2026): La zona sobre piezas compartidas, desde `zonaStr` (server, con
              procedencia). ZonaCardSTR y el drawer de tipo de huésped con porcentajes quedan
              desmontados (T3 borra). */}
          {zonaStr ? (
            <ZonaStrSection zona={zonaStr} comuna={comuna} direccion={direccionPortada} currency={currency} valorUF={ufValue} veredicto={veredicto} accessLevel={accessLevel} />
          ) : (
            <p className="v-copy">Sin datos suficientes de la zona para este análisis.</p>
          )}
        </SeccionInforme>
        </DocumentoFrame>

        {/* CTA post-análisis welcome — banda inline al cierre del informe +
            popup (trigger IntersectionObserver + dwell). Solo cobro welcome.
            Gate aiAnalysis: no montar (banda NI observer) mientras la prosa
            genera — el skeleton deja la banda en viewport y el popup dispara
            sobre el informe vacío, quemando el guard. Render, no CSS. */}
        {showCtaWelcome && aiAnalysis != null && (
          <>
            <div style={{ height: 24 }} />
            <CtaWelcome analysisId={analysisId} />
          </>
        )}

        {/* CTAs de dueño/wallet */}
        {(
          <>
            {/* CTA banner (free) */}
            <div style={{ height: 24 }} />
            <ProCTABanner
              analysesCount={1}
              isLoggedIn={accessLevel !== "guest"}
              accessLevel={accessLevel}
              welcomeAvailable={welcomeAvailable}
              isSharedView={isSharedView}
              source="str_v2"
            />

            {/* CTA contextual — FUERA del documento (FASE 4). */}
            <div style={{ height: 16 }} />
            <MarcaSeccion seccion="next_cta" tipo="str" accessLevel={accessLevel} />
            <NextAnalysisCTA {...nextCtaProps} />

            {/* Wallet status */}
            <div style={{ height: 16 }} />
            <MarcaSeccion seccion="wallet_cta" tipo="str" accessLevel={accessLevel} />
            <WalletStatusCTA
              welcomeAvailable={welcomeAvailable}
              credits={userCredits}
              isSubscriber={isSubscriber}
              isAdmin={isAdmin}
              isSharedView={isSharedView}
              source="str"
              suppressNoCredits={nextCtaEsCompra}
            />
          </>
        )}

        {/* Link analizar otra propiedad — oculto cuando la banda CTA welcome
            está visible (mismo texto, destino distinto: evita el duplicado). */}
        {!showCtaWelcome && (
          <div className="mt-6 mb-4 flex items-center justify-center">
            <Link
              // El wizard legacy de renta corta se retiró. El formulario vivo es
              // el v4 (RUTA_WIZARD en cta-analizar.ts): este link decía v2, que
              // quedó atrás en el cutover ca3106f y mandaba a la gente al wizard
              // anterior. Apunta directo y no al redirect, para no gastar un salto.
              href="/analisis/nuevo-v4"
              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors"
            >
              Analizar otra propiedad
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* CTA conversión — cierre (campo Signal Red) · solo guest */}
        {accessLevel === "guest" && (
          <div className="mt-8 mb-4">
            <ConversionCloser />
          </div>
        )}

        {/* Disclaimer */}
        <p
          className="font-body text-center mt-6 mb-2 mx-auto"
          style={{
            fontSize: 11,
            color: "color-mix(in srgb, var(--franco-text) 40%, transparent)",
            maxWidth: 520,
          }}
        >
          Análisis generado por IA. Verifica los datos antes de tomar decisiones financieras.
        </p>

      </main>

      {/* Footer del sitio */}
      <AppFooter variant="minimal" />
    </div>
  );
}
