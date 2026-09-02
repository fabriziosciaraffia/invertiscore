"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import type { AIAnalysisV2, AnalisisInput, FullAnalysisResult } from "@/lib/types";
import { AnalysisDrawer, type DrawerKey } from "@/components/ui/AnalysisDrawer";
import { MarcaSeccion, useDrawerAbierto } from "./informeTelemetry";
import { useZoneInsight } from "@/hooks/useZoneInsight";
import { ZoneInsightMiniCard } from "@/components/zone-insight/ZoneInsightMiniCard";
import { HeroLTR } from "./HeroLTR";
import { ordenarHallazgosPiramide } from "./PiramideHallazgos";
import { HALLAZGO_DRAWER, findingDisplay } from "./GenericFindingCard";
import { HallazgosAcordeon, TokensHallazgos, type FilaHallazgo } from "./hallazgos/HallazgosAcordeon";
import { SeccionInforme } from "./SeccionInforme";
import { PrincipalesHallazgos } from "./PrincipalesHallazgos";
import { LosNumeros } from "./LosNumeros";
import { ModalCalculo } from "./ModalCalculo";
import { getCapRefComuna } from "@/lib/cap-rate-hallazgo";
import { anchorHallazgo, numeroHallazgo } from "@/lib/orden-hallazgos";
import { hasAiV2 } from "./AIInsightSection";
import { derivarCifraClaveLtr } from "@/lib/cifra-clave";
import { buildFichaLtr } from "@/lib/ficha-depto";
import { formatDireccionDisplay } from "@/lib/format-direccion";
import { DocumentoFrame, PortadaInforme } from "./portada/PortadaInforme";
import { useComparablesCercanos } from "./portada/useComparablesCercanos";
import type { Hallazgo, HallazgoDistanciaVeredicto, HallazgoSobreprecio } from "@/lib/types";
import { BloqueEsperaInforme } from "@/components/analysis/ProsaSkeleton";

/**
 * Orquestador del análisis IA: Hero Verdict + Subject Card Grid 2×2 + card
 * Zona Wide Context + ReestructuracionMiniCard (opcional, financingHealth
 * Nivel 3) + drawers de detalle.
 *
 * Goal C — veredicto inmediato: el grid renderiza SIEMPRE (todo lo del motor
 * existe desde el INSERT); la prosa IA es el único slot que espera, dentro del
 * hero (ProsaGenerando / error inline con retry). El overlay LoadingEditorial
 * full-page murió de esta superficie.
 *
 * Move verbatim desde results-client.tsx LTR (Ronda 4a.3, ex-DashboardAnalysisSection).
 */
export function SubjectCardGrid({
  aiAnalysis,
  loading,
  error,
  currency,
  onCurrencyChange,
  veredicto,
  score,
  propiedadTitle,
  onRetry,
  results,
  inputData,
  valorUF,
  analysisId,
  comuna,
  createdAt,
  fechaProsa,
  prosaDesactualizada = false,
  simulationSlot,
  onInformeVisible,
  accessLevel = "free",
}: {
  aiAnalysis: AIAnalysisV2 | null;
  loading: boolean;
  error: string | null;
  currency: "CLP" | "UF";
  onCurrencyChange: (c: "CLP" | "UF") => void;
  veredicto: string;
  score: number;
  propiedadTitle: string;
  propiedadSubtitle: string;
  metadataItems: { label: string; value: string; tooltip?: string }[];
  onRetry: () => void;
  results: FullAnalysisResult | null | undefined;
  inputData: AnalisisInput | null | undefined;
  valorUF: number;
  analysisId?: string;
  comuna?: string;
  createdAt?: string;
  /** Fecha de la PROSA vigente; el pie la prefiere sobre `createdAt`. Ver
   *  fechaProsaVigente() en pipeline-timing.ts. */
  fechaProsa?: string;
  /** La prosa que se muestra viene de una versión anterior del análisis y este
   *  lector no puede regenerarla (sin sesión, o no es el dueño). Se declara al
   *  pie del acordeón con su fecha: es preferible texto fechado a nada. */
  prosaDesactualizada?: boolean;
  /** A1 — sección Simulación (AdvancedSection). Se renderiza ENTRE la pirámide y la
   *  card Zona para lograr el orden "drawers → simulación → zona". El estado del
   *  drawer y el hook de zona viven acá, así que la card zona no se puede sacar afuera
   *  sin levantar ese estado; en cambio la simulación entra como slot. */
  simulationSlot?: ReactNode;
  /** Goal B (anclaje Goal C) — dispara UNA vez al montar el grid: el veredicto
   *  es visible desde el primer render. El caller captura `informe_visto` y
   *  persiste `informe_visible_at`. */
  onInformeVisible?: () => void;
  /** I-3 (fix FASE 1 rediseño-dictamen): viaja en `informe_seccion_vista` de las
   *  marcas `piramide`/`zona`, que hasta ahora no existían en LTR. Desde FASE 5
   *  también en `informe_hallazgo_abierto` (como `access_level`). */
  accessLevel?: string;
}) {
  const [activeDrawer, setActiveDrawer] = useState<DrawerKey | null>(null);
  const [calculoAbierto, setCalculoAbierto] = useState(false);

  // Orden único de la pirámide — se calcula UNA vez acá y alimenta la secuencia
  // de drawers y el resolver de telemetría (mismo array que renderiza).
  const hallazgosOrdenados = ordenarHallazgosPiramide(results, aiAnalysis);

  // I-3: apertura de drawer (todas las cards entran por acá). El resolver emite
  // en paralelo `informe_hallazgo_abierto {n, id_hallazgo}` cuando el drawer
  // corresponde a un hallazgo de la pirámide (línea base pre-rediseño).
  useDrawerAbierto(
    activeDrawer,
    "ltr",
    (key) => {
      const idx = hallazgosOrdenados.findIndex((h) => HALLAZGO_DRAWER[h.id] === key);
      return idx >= 0 ? { n: idx + 1, id: hallazgosOrdenados[idx].id } : null;
    },
    { veredicto, accessLevel },
  );

  // Secuencia de drawers = orden VISUAL de la pirámide (mismo array que renderiza),
  // filtrando las cards que tienen drawer y dedup por si dos cayeran al mismo. La
  // navegación prev/next del drawer se deriva de acá: "siguiente" = card siguiente
  // de la pirámide. Un solo orden de verdad. `zona` NO entra (se abre solo desde su
  // MiniCard) → queda fuera de las flechas.
  const drawerSequence: DrawerKey[] = [];
  for (const h of hallazgosOrdenados) {
    const key = HALLAZGO_DRAWER[h.id];
    if (key && !drawerSequence.includes(key)) drawerSequence.push(key);
  }

  // Preload zone-insight at dashboard mount (non-blocking).
  // Only fires if we have an analysisId and the analysis has coords (checked server-side).
  const {
    data: zoneInsight,
    loading: zoneLoading,
    error: zoneError,
  } = useZoneInsight(analysisId, !!analysisId);

  // Coords for the map — derived from input_data (same source the endpoint uses).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputAny = inputData as any;
  const zoneCenter =
    typeof inputAny?.lat === "number" && typeof inputAny?.lng === "number"
      ? { lat: inputAny.lat as number, lng: inputAny.lng as number }
      : typeof inputAny?.zonaRadio?.lat === "number" && typeof inputAny?.zonaRadio?.lng === "number"
        ? { lat: inputAny.zonaRadio.lat as number, lng: inputAny.zonaRadio.lng as number }
        : null;

  // Goal C/E — veredicto inmediato en DOS ZONAS (contrato:
  // mockup-resultados-dos-zonas.html). Zona 1 = el hero, 100% motor, sin
  // indicadores de carga (la apertura del 01 hace de prosa estática). Zona 2 =
  // mientras no hay prosa, UN solo bloque de espera (BloqueEsperaInforme:
  // mensajes progresivos + siluetas puras) — nada a medias, nada clickeable;
  // cuando llega, se materializa el contenido real. Prosa válida solo si pasa
  // hasAiV2 — un shape a medias no se renderiza como prosa.
  const prosaLista = !!aiAnalysis && hasAiV2(aiAnalysis);
  // FASE 4: la prosa llega CRUDA (con `**…**`) — el plumón se pinta de verdad
  // en los puntos de render (renderPlumon). El strip sigue vivo SOLO donde el
  // rediseño no llega: las dos vistas /documento (PDF).
  const prosa = prosaLista ? aiAnalysis : null;

  // Materialización (Goal E): la transición siluetas→cards corre SOLO cuando la
  // prosa llegó DESPUÉS del mount (generación en vivo). Prosa cacheada
  // (revisitas): el contenido real monta directo, sin flash ni animación.
  const prosaAusenteAlMontar = useRef(!prosaLista);
  const materializa = prosaLista && prosaAusenteAlMontar.current;

  // Goal B (anclaje movido por Goal C) — "veredicto visible" = mount del grid:
  // con el overlay muerto, el veredicto se ve desde el primer render. Ref y no
  // estado: notificar no re-renderiza; una sola notificación por mount.
  const informeVisibleNotificado = useRef(false);
  useEffect(() => {
    if (!informeVisibleNotificado.current) {
      informeVisibleNotificado.current = true;
      onInformeVisible?.();
    }
  }, [onInformeVisible]);

  // ═══ FILAS DEL ACORDEÓN (FASE 4) ═══
  // Una fila por hallazgo del orden único; el cuerpo es el drawer en modo
  // INLINE (sin chrome). `distancia_veredicto` no está acá por diseño: ya lo
  // excluye ordenarHallazgosPiramide — es el destino del CTA de la posición.
  // MITIGACIÓN 27-ago-2026 — los hallazgos NO dependen de la prosa.
  //
  // Hasta acá el contexto exigía `prosa`, así que un informe sin redacción IA se
  // renderizaba con portada y CERO filas: cuerpo vacío. Se vio en producción cuando
  // PROMPT_VERSION_LTR saltó a 12 y dejó al parque entero en stale: el visitante
  // anónimo no puede regenerar (POST /api/analisis/ai → 401) y el informe quedaba
  // mudo, el demo de la landing incluido.
  //
  // Los hallazgos son datos DETERMINÍSTICOS del motor (`results.metrics.hallazgo*` +
  // `results.hallazgos`); `gatherHallazgos` ya los arma sin mirar la IA. Que su
  // RENDER dependiera de que el modelo escribiera era un acoplamiento sin razón, y
  // frágil ante cualquier caída futura de la IA, no solo ante este bump de versión.
  //
  // Con prosa ausente: portada + hallazgos completos + el aviso de redacción que el
  // hero ya muestra. Cada cuerpo que sí necesita prosa trae su propio guard
  // (`SinDatos`, o el placeholder "Franco está preparando este detalle…").
  const ctxDrawer = results && inputData ? { results, inputData, prosa } : null;
  const filasHallazgos: FilaHallazgo[] = ctxDrawer
    ? hallazgosOrdenados.map((h, i) => {
        const d = findingDisplay(h, currency, valorUF);
        const key = HALLAZGO_DRAWER[h.id];
        return {
          id: h.id,
          numero: numeroHallazgo(i),
          pregunta: d.title || h.titular,
          valor: d.kpi,
          valorRojo: d.kpiRed,
          ksub: d.ksub,
          anchorId: anchorHallazgo(h),
          cuerpo: key ? (
            <AnalysisDrawer
              inline
              activeKey={key}
              aiAnalysis={ctxDrawer.prosa}
              currency={currency}
              results={ctxDrawer.results}
              inputData={ctxDrawer.inputData}
              valorUF={valorUF}
              onClose={() => {}}
              onNavigate={() => {}}
              sequence={[]}
              zoneInsight={zoneInsight}
              zoneLoading={zoneLoading}
              zoneError={zoneError}
              zoneCenter={zoneCenter}
              comuna={comuna ?? ctxDrawer.inputData.comuna}
              arriendoUsuarioCLP={Number(ctxDrawer.inputData.arriendo) || 0}
              createdAt={createdAt}
            />
          ) : null,
        };
      })
    : [];

  // El análisis a 10 años cierra el capítulo de simulación (ya no es un botón
  // que abre un drawer: es el juicio del horizonte, en su lugar).
  const cuerpoLargoPlazo =
    ctxDrawer && ctxDrawer.prosa?.largoPlazo?.contenido_clp?.trim() ? (
      <div className="mt-5">
        <div className="doc-cap-sub">El análisis a 10 años</div>
        <AnalysisDrawer
          inline
          activeKey="largoPlazo"
          aiAnalysis={ctxDrawer.prosa}
          currency={currency}
          results={ctxDrawer.results}
          inputData={ctxDrawer.inputData}
          valorUF={valorUF}
          onClose={() => {}}
          onNavigate={() => {}}
          sequence={[]}
          createdAt={createdAt}
        />
      </div>
    ) : null;

  // ═══ PORTADA (FASE 3 rediseño Dictamen — mockups v8/v9) ═══
  // Los datos se arman acá (motor + input); la IA solo aporta el titular, que
  // llega CRUDO (con `**…**`) desde aiAnalysis — el plumón se pinta en la
  // portada, mientras el resto de la prosa sigue strippeada (stripMarcasDeep).
  const direccionPortada = formatDireccionDisplay(inputData?.direccion);
  const comunaPortada = comuna || inputData?.comuna || "";
  const titularCrudo = (aiAnalysis as { titular?: string | null } | null)?.titular ?? null;
  const distanciaPortada =
    ((results?.hallazgos as { id: string }[] | undefined)?.find((h) => h.id === "distancia_veredicto") as
      | HallazgoDistanciaVeredicto
      | undefined) ?? null;
  const cifraPortada =
    results?.metrics && inputData
      ? derivarCifraClaveLtr({
          veredicto,
          flujoNetoMensual: (results.metrics as { flujoNetoMensual?: number }).flujoNetoMensual ?? NaN,
          distancia: distanciaPortada,
          ufValue: valorUF,
        })
      : null;
  const sobreprecioPortada =
    ((results?.metrics as { hallazgoSobreprecio?: HallazgoSobreprecio | null } | undefined)?.hallazgoSobreprecio ??
      aiAnalysis?.hallazgoSobreprecio) || null;
  const fichaPortada = inputData
    ? buildFichaLtr({
        input: inputData,
        results,
        medianaUfM2: sobreprecioPortada?.valor.medianaComunaUfM2 ?? null,
        universoMediana: sobreprecioPortada?.valor.universo ?? null,
        direccion: direccionPortada,
        comuna: comunaPortada,
        ufValue: valorUF,
        moneda: currency,
      })
    : null;
  // Coords para el mapa de portada (misma fuente que zoneCenter, ya derivada arriba).
  const compCercanos = useComparablesCercanos({
    comuna: comunaPortada,
    superficie: Number(inputData?.superficie) || 0,
    dormitorios: inputData?.dormitorios,
    lat: zoneCenter?.lat ?? null,
    lng: zoneCenter?.lng ?? null,
  });
  const fechaCorta = (() => {
    const d = new Date(fechaProsa ?? createdAt ?? "");
    return Number.isNaN(d.getTime())
      ? ""
      : d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
  })();
  // Referencia del cap rate neto: la del hallazgo (motor) o la del catálogo por comuna.
  const capRefInfo = (() => {
    const h = (results?.metrics as { hallazgoCapRate?: { valor?: { capRefPct?: number; fuente?: string } } | null } | undefined)?.hallazgoCapRate;
    if (h?.valor && typeof h.valor.capRefPct === "number") return { pct: h.valor.capRefPct, fuente: h.valor.fuente ?? "" };
    const ref = getCapRefComuna(comunaPortada);
    return { pct: ref.pct, fuente: ref.fuente };
  })();
  const scrollAHallazgo = (h: Pick<Hallazgo, "id">) => {
    document.getElementById(anchorHallazgo(h))?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const scrollASimulacion = () => {
    document.getElementById("simulacion-interactiva")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div id="informe-pro-section" className="mb-8">
      <DocumentoFrame secciones>
      {/* CSS del acordeón + vocabulario + modal, montado siempre: el modal de la
          posición y el de cálculo lo necesitan también mientras la prosa carga. */}
      <TokensHallazgos />
      {/* ═══ 1 · PORTADA (paper) ═══ */}
      <SeccionInforme id="portada" tono="paper">
      {fichaPortada && (
        <PortadaInforme
          veredicto={veredicto}
          score={score}
          direccion={direccionPortada}
          comuna={comunaPortada}
          modalidadLabel="Renta larga"
          fecha={fechaCorta}
          titular={titularCrudo}
          cifra={cifraPortada}
          ficha={fichaPortada}
          currency={currency}
          onCurrencyChange={onCurrencyChange}
          mapa={
            zoneCenter
              ? {
                  lat: zoneCenter.lat,
                  lng: zoneCenter.lng,
                  comparables: compCercanos.comparables,
                  count: compCercanos.count,
                  label: direccionPortada || comunaPortada,
                }
              : null
          }
          onAjustarSupuestos={scrollASimulacion}
        />
      )}
      </SeccionInforme>
      {/* ═══ 2 · HERO (paper2) ═══ */}
      <SeccionInforme id="hero" tono="paper2">
      <HeroLTR
        onOpenDrawer={setActiveDrawer}
        data={prosa}
        prosaError={!prosa && !loading ? (error ?? null) : null}
        onRetryProsa={onRetry}
        currency={currency}
        onCurrencyChange={onCurrencyChange}
        veredicto={veredicto}
        score={score}
        propiedadTitle={propiedadTitle}
        inputData={inputData}
        results={results}
        comuna={comuna}
        valorUF={valorUF}
        createdAt={createdAt}
        fechaProsa={fechaProsa}
      />
      </SeccionInforme>
      {/* ═══ ZONA 2 (Goal E) ═══ Sin prosa: UN solo bloque de espera — mensajes
          progresivos + siluetas puras (cero texto a medias, cero afordancia).
          Con error de prosa el bloque queda estático (el error vive inline en el
          hero, Goal C). Absorbe el strip "Franco está redactando el detalle…". */}
      {/* MITIGACIÓN 27-ago-2026 — el bloque de espera solo se muestra MIENTRAS la
          prosa viene en camino. Antes cubría todo el caso `!prosa`, así que un
          informe cuya redacción NUNCA va a llegar —el anónimo no puede regenerar:
          POST /api/analisis/ai → 401— quedaba con siluetas para siempre y el
          lector no veía un solo hallazgo. Es lo que pasó en producción cuando
          PROMPT_VERSION_LTR saltó a 12 y dejó al parque en stale, el demo de la
          landing incluido.
          Sin esperanza de prosa se muestran los hallazgos del motor, que son
          deterministas y no dependen de que el modelo haya escrito. El aviso de
          redacción sigue donde estaba (inline en el hero, Goal C). */}
      {!prosa && loading ? (
        <SeccionInforme id="espera" tono="paper">
          <BloqueEsperaInforme estatico={false} />
        </SeccionInforme>
      ) : (
        <div style={materializa ? { animation: "zona2Aparece 450ms ease-out" } : undefined}>
          {/* ═══ 3 · PRINCIPALES HALLAZGOS (paper) — contrato CONGELADO, T2 ═══
              Los cuatro que mueven el veredicto, del mismo orden único que el
              acordeón. Fila + cierre con plumón + «↓ Ver detalle» al desarrollo. */}
          {hallazgosOrdenados.length > 0 && (
            <SeccionInforme
              id="principales-hallazgos"
              tono="paper"
              eyebrow="Principales hallazgos"
              titulo="Qué determina el veredicto en este departamento"
              intent="Franco analizó los factores que pesan en la decisión. Estos son los cuatro que la mueven."
            >
              <MarcaSeccion seccion="hallazgos" tipo="ltr" accessLevel={accessLevel} />
              <PrincipalesHallazgos hallazgos={hallazgosOrdenados} currency={currency} valorUF={valorUF} onVerDetalle={scrollAHallazgo} />
            </SeccionInforme>
          )}
          {/* ═══ 4 · LOS NÚMEROS (paper2) — seis cifras + modal de cálculo ═══ */}
          {results?.metrics && inputData && (
            <SeccionInforme
              id="los-numeros"
              tono="paper2"
              eyebrow="Los números"
              titulo="Las seis cifras que un inversionista mira primero"
              intent="Las cifras con las que se evalúa cualquier inversión inmobiliaria — para comparar este departamento con otro, o con lo que rinde tu plata en otra parte."
            >
              <MarcaSeccion seccion="numeros" tipo="ltr" accessLevel={accessLevel} />
              <LosNumeros
                metrics={results.metrics}
                results={results}
                capRefPct={capRefInfo.pct}
                currency={currency}
                valorUF={valorUF}
                onCalculo={() => setCalculoAbierto(true)}
              />
              <ModalCalculo
                abierto={calculoAbierto}
                onClose={() => setCalculoAbierto(false)}
                metrics={results.metrics}
                results={results}
                inputData={inputData}
                valorUF={valorUF}
                capRef={capRefInfo}
              />
            </SeccionInforme>
          )}
          {/* ═══ 5 · LA INVERSIÓN (paper) — TRANSICIÓN T2: el acordeón actual y la
              simulación se quedan acá tal cual hasta que T3 los reemplace por los
              cinco capítulos. La sección ya tiene su forma; solo cambia el cuerpo. */}
          <SeccionInforme
            id="la-inversion"
            tono="paper"
            eyebrow="La inversión"
            titulo="Cómo funciona este departamento como inversión"
            intent="Cómo funciona este departamento como inversión, paso a paso: lo que entra, lo que sale, lo que queda y lo que crece."
          >
          <MarcaSeccion seccion="piramide" tipo="ltr" accessLevel={accessLevel} />
          <HallazgosAcordeon
            tipo="ltr"
            total={filasHallazgos.length}
            filas={filasHallazgos}
            veredicto={veredicto}
            accessLevel={accessLevel}
          />
          {prosaDesactualizada && fechaCorta && (
            <p
              className="font-mono m-0 mt-2"
              style={{ fontSize: 10.5, lineHeight: 1.5, color: "var(--franco-text-muted)" }}
            >
              Análisis redactado el {fechaCorta}. Los números de arriba se recalculan en cada
              visita; el texto es el de esa fecha.
            </p>
          )}
          {/* ═══ CAPÍTULO · La simulación ═══ */}
          {simulationSlot && (
            <section className="doc-capitulo" id="simulacion-interactiva">
              <div className="doc-cap-eyebrow">La simulación</div>
              {simulationSlot}
              {/* El análisis a 10 años (prosa IA largoPlazo) cierra el capítulo:
                  es el juicio del horizonte que la simulación deja abierto. */}
              {cuerpoLargoPlazo}
            </section>
          )}
          </SeccionInforme>
          {/* ═══ 6 · LA ZONA (paper2) ═══ */}
          {analysisId && (
            <SeccionInforme
              id="la-zona"
              tono="paper2"
              eyebrow={`La zona${comunaPortada ? ` · ${comunaPortada}` : ""}`}
              titulo="La zona"
              intent="Cómo se compara este departamento con lo que se vende y arrienda alrededor."
            >
              <MarcaSeccion seccion="zona" tipo="ltr" accessLevel={accessLevel} />
              <ZoneInsightMiniCard
                data={zoneInsight}
                loading={zoneLoading}
                error={zoneError}
                onClick={() => setActiveDrawer("zona")}
                currency={currency}
              />
            </SeccionInforme>
          )}
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes zona2Aparece {
              from { opacity: 0; transform: translateY(6px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @media (prefers-reduced-motion: reduce) {
              [style*="zona2Aparece"] { animation: none !important; }
            }
          ` }} />
        </div>
      )}
      </DocumentoFrame>

      <p className="text-center text-[10px] text-[var(--franco-text-muted)] mt-4">
        Análisis generado por IA. Verifica los datos antes de tomar decisiones financieras.
      </p>

      {/* Limitación deliberada (Goal C): AnalysisDrawer exige prosa no-null (lee
          glosas IA por sección). Mientras la prosa está en vuelo, las cards se
          ven pero el drawer no se monta — se habilita solo cuando llega. */}
      {activeDrawer && results && inputData && prosa && (
        <AnalysisDrawer
          activeKey={activeDrawer}
          aiAnalysis={prosa}
          currency={currency}
          results={results}
          inputData={inputData}
          valorUF={valorUF}
          onClose={() => setActiveDrawer(null)}
          onNavigate={(key) => setActiveDrawer(key)}
          sequence={drawerSequence}
          zoneInsight={zoneInsight}
          zoneLoading={zoneLoading}
          zoneError={zoneError}
          zoneCenter={zoneCenter}
          comuna={comuna ?? inputData.comuna}
          arriendoUsuarioCLP={Number(inputData.arriendo) || 0}
          createdAt={createdAt}
        />
      )}
    </div>
  );
}
