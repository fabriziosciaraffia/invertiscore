"use client";

/**
 * Results client (Renta Corta).
 *
 * Render del módulo STR (Dictamen, T1–T3 sep-2026):
 *   • UnifiedNav variant="app"
 *   • Portada + HeroStrDictamen (veredicto + score + posición de Franco)
 *   • PrincipalesHallazgos + SeisCifrasStr (+ ModalCalculoStr)
 *   • CapitulosInversionStr — seis capítulos sobre piezas compartidas
 *   • ZonaStrSection — La zona con procedencia y su modal Explorar
 *   (T3 borró los drawers, el hero, la pirámide y la advanced section viejos)
 *
 * Gating: el render completo se muestra siempre. Los CTAs (WalletStatusCTA +
 * ProCTABanner) gestionan el upgrade.
 */

import { useState, useEffect, useRef } from "react";
import type { Veredicto } from "@/lib/types";
import { construirCardStr } from "@/lib/card-recomendacion";
import { titularMotor } from "@/lib/titular-motor";
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
import { ordenarHallazgosPiramideSTR } from "@/lib/piramide-orden-str";
import { PrincipalesHallazgos } from "@/components/analysis/PrincipalesHallazgos";
import { lineaQueDeclara } from "@/lib/veredicto-etiqueta";
import { SeccionInforme } from "@/components/analysis/SeccionInforme";
import { TokensShared } from "@/components/analysis/shared";
import { SeisCifrasStr } from "@/components/analysis/str/SeisCifrasStr";
import { ModalCalculoStr } from "@/components/analysis/str/ModalCalculoStr";
import { CapitulosInversionStr, type CapituloStrId } from "@/components/analysis/str/CapitulosInversionStr";
import { ZonaStrSection } from "@/components/analysis/str/ZonaStrSection";
import { SubordinatedBanner } from "@/components/analysis/SubordinatedBanner";
import type { HallazgoDistanciaVeredicto } from "@/lib/types";
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
  /** Niveles de plazo precalculados en el server (`simularPlazoStr`): el reconstructor
   *  del input arrastra `next/headers` y no puede importarse desde el cliente, y de paso
   *  los 4 recomputes no corren en el teléfono del lector. Los consume `LineaPlazo`. */
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
  // LA IA SALIÓ DEL INFORME (25-sep-2026, decisión de Fabrizio): la página no espera a la
  // prosa ni la pide —sin sondeo de /ai-status, sin regeneración al abrir, sin rescate— y no
  // dibuja ningún texto de la IA. La generación en segundo plano del submit sigue viva: la
  // maquinaria se retira por partes, en el goal siguiente.

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

  // Los fondos quedan en la alternancia del camino sin sección «hero» propia (portada →
  // hallazgos → recomendación → números → inversión → zona), la que ya tenían las filas podadas.
  const tonoNumerosStr = "paper";
  const tonoInversionStr = "paper2";
  const tonoZonaStr = "paper";

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
  // EL TITULAR LO ESCRIBE EL MOTOR (25-sep-2026): reproduce la card «La recomendación de Franco»,
  // construida con la MISMA función que usa `HeroStrDictamen`. Vale para todas las filas.
  const titularPortada = titularMotor({
    veredicto: veredicto as Veredicto,
    modalidad: "str",
    card: construirCardStr({ veredicto: veredicto as Veredicto, results, simulacion: simulacionStr, currency, valorUF: ufValue }),
  }).titular;
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
    /* EL LIENZO DE §2 (fix del bloque A · 11-sep-2026, el mismo bug de 0b825fca en LTR): con
       el marco del documento retirado, lo que quedaba detrás del informe STR era el gris de
       la app —medido en el DOM: wrapper y body #F6F6F7 contra tarjetas #F4F4F6, o sea nada
       que distinguir—. `doc-lienzo` pinta «--page» en el wrapper y en el body, y nada más:
       NO lleva `doc-dictamen` (esa trae `--card`, que también es token de shadcn y rompe el chrome). */
    <div className="min-h-screen bg-[var(--franco-bg)] doc-lienzo">
      {/* Chrome de nav/header — el PDF usa la vista documento aparte, no esta página. */}
      {accessLevel === "guest" || isAnonOwner ? (
        <PublicShareHeader
          date={formatFechaCorta(fechaProsa ?? createdAt)}
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
        <DocumentoFrame secciones veredicto={veredicto}>
        <TokensShared />
        {/* Contrato §2: la portada ES el hero de §3 y una de las dos cajas. */}
        <SeccionInforme id="portada" tono="paper" caja>
        <PortadaInforme
          veredicto={veredicto}
          score={score}
          direccion={direccionPortada}
          comuna={comuna}
          modalidadLabel="Renta corta"
          fecha={fechaCorta}
          titular={titularPortada}
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
        />
        </SeccionInforme>
        {/* ═══ T1 (04-sep-2026) · el interior STR sobre piezas compartidas: hero con el
            contrato LTR → principales hallazgos → seis cifras → la inversión (seis
            capítulos I–VI) → la zona (placeholder hasta T2). Lo viejo (AdvancedSectionSTR,
            EjesAplicadosSTR, la pirámide y los drawers como cuerpo) queda desmontado de la
            página y vivo en el repo hasta T3. */}
        {/* ═══ 2 · HERO · HALLAZGOS · RECOMENDACIÓN ═══ EL ORDEN DEL CONTRATO §2 lo emite
            `HeroStrDictamen`, como `HeroLTR`: devuelve las tres secciones —hero, la de
            hallazgos que le pasa esta página, y la recomendación con caja—. Por eso la
            página no lo envuelve: con el envoltorio el orden era inalcanzable. */}
          <HeroStrDictamen
            accessLevel={accessLevel}
            hallazgos={
              /* Va SIEMPRE. Su título es la línea que declara el veredicto (§10). */
              hallazgosOrdenadosSTR.length > 0 ? (
                <SeccionInforme
                  id="principales-hallazgos"
                  tono="paper"
                  titulo={lineaQueDeclara(veredicto)}
                >
                  <MarcaSeccion seccion="hallazgos" tipo="str" accessLevel={accessLevel} />
                  <PrincipalesHallazgos hallazgos={hallazgosOrdenadosSTR} currency={currency} valorUF={ufValue} />
                </SeccionInforme>
              ) : undefined
            }
            results={results}
            veredicto={veredicto}
            simulacion={simulacionStr}
            currency={currency}
            valorUF={ufValue}
            createdAt={createdAt}
            fechaProsa={fechaProsa}
          />
        <SeccionInforme
          id="los-numeros"
          tono={tonoNumerosStr}
          /* Contrato §10: los tres títulos fijados. */
          titulo="Las cifras que tienes que ver"
        >
          <MarcaSeccion seccion="numeros" tipo="str" accessLevel={accessLevel} />
          <SeisCifrasStr results={results} currency={currency} valorUF={ufValue} onCalculo={() => setCalculoAbierto(true)} />
          <ModalCalculoStr
            abierto={calculoAbierto}
            onClose={() => setCalculoAbierto(false)}
            results={results}
            inputData={inputData}
            valorUF={ufValue}
            fechaUF={fechaCortaCL(createdAt)}
            currency={currency}
            onVerResultado={() => {
              setCalculoAbierto(false);
              abrirCapitulo("resultado");
            }}
          />
        </SeccionInforme>
        <SeccionInforme
          id="la-inversion"
          tono={tonoInversionStr}
          titulo="Detalle de la inversión"
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
        </SeccionInforme>
        {/* La comuna vivía en el ksub; al morir el ksub sube al título. */}
        <SeccionInforme id="la-zona" tono={tonoZonaStr} titulo={`Ubicación · ${comuna}`}>
          <MarcaSeccion seccion="zona" tipo="str" accessLevel={accessLevel} />
          {/* T2 (05-sep-2026): La zona sobre piezas compartidas, desde `zonaStr` (server, con
              procedencia). T3 borró ZonaCardSTR y el drawer de tipo de huésped. */}
          {zonaStr ? (
            <ZonaStrSection zona={zonaStr} comuna={comuna} direccion={direccionPortada} currency={currency} valorUF={ufValue} veredicto={veredicto} accessLevel={accessLevel} />
          ) : (
            <p className="v-copy">Sin datos suficientes de la zona para este análisis.</p>
          )}
        </SeccionInforme>
        </DocumentoFrame>

        {/* CTA post-análisis welcome — banda inline al cierre del informe + popup. Hasta el
            25-sep esperaba a la prosa; sin skeleton, el informe está completo al primer render. */}
        {showCtaWelcome && (
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

      </main>

      {/* Footer del sitio */}
      <AppFooter variant="minimal" />
    </div>
  );
}
