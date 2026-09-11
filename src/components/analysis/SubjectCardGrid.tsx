"use client";

import { TokensShared } from "./shared/TokensShared";
import { fechaCortaCL } from "@/lib/fecha-cl";
import { useState, useEffect, useRef } from "react";
import type { AIAnalysisV2, AnalisisInput, FullAnalysisResult } from "@/lib/types";
import { AnalysisDrawer, type DrawerKey } from "@/components/ui/AnalysisDrawer";
import { MarcaSeccion, useDrawerAbierto } from "./informeTelemetry";
import { useZoneInsight } from "@/hooks/useZoneInsight";
import { ZonaLtrSection, buildZonaLtr, buildZonaLtrR2 } from "./zona/ZonaLtr";
import { HeroLTR } from "./HeroLTR";
import { ordenarHallazgosPiramide } from "@/lib/orden-hallazgos";
import { TokensHallazgos } from "./hallazgos/HallazgosAcordeon";
import { CapitulosInversion, type CapituloId } from "./CapitulosInversion";
import { SeccionInforme } from "./SeccionInforme";
import { PrincipalesHallazgos } from "./PrincipalesHallazgos";
import { RedisenoProvider, useRediseno } from "./RedisenoContexto";
import { REDISENO_INFORME } from "@/lib/rediseno-flag";
import { lineaQueDeclara } from "@/lib/veredicto-etiqueta";
import { LosNumeros } from "./LosNumeros";
import { ModalCalculo } from "./ModalCalculo";
import { getCapRefComuna } from "@/lib/cap-rate-hallazgo";
import { esProsaDosBloques, hasAiV2 } from "./AIInsightSection";
import { derivarCifraClaveLtr } from "@/lib/cifra-clave";
import { buildFichaLtr } from "@/lib/ficha-depto";
import { formatDireccionDisplay } from "@/lib/format-direccion";
import { DocumentoFrame, PortadaInforme } from "./portada/PortadaInforme";
import { useComparablesCercanos } from "./portada/useComparablesCercanos";
import type { HallazgoDistanciaVeredicto, HallazgoSobreprecio } from "@/lib/types";
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
  onInformeVisible,
  accessLevel = "free",
  medianaResolvedAt,
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
  /** Goal B (anclaje Goal C) — dispara UNA vez al montar el grid: el veredicto
   *  es visible desde el primer render. El caller captura `informe_visto` y
   *  persiste `informe_visible_at`. */
  onInformeVisible?: () => void;
  /** I-3 (fix FASE 1 rediseño-dictamen): viaja en `informe_seccion_vista` de las
   *  marcas `piramide`/`zona`, que hasta ahora no existían en LTR. Desde FASE 5
   *  también en `informe_hallazgo_abierto` (como `access_level`). */
  accessLevel?: string;
  /** Fecha (ISO) de la mediana comunal que muestra la zona: el `resolvedAt` del snapshot
   *  o ahora, si se resolvió viva. Viene de page.tsx. */
  medianaResolvedAt?: string;
}) {
  const [activeDrawer, setActiveDrawer] = useState<DrawerKey | null>(null);
  const [calculoAbierto, setCalculoAbierto] = useState(false);
  // T3: apertura de un capítulo pedida desde «↓ Ver detalle» o desde la portada.
  const [capituloAbrir, setCapituloAbrir] = useState<{ id: CapituloId; nonce: number } | null>(null);

  // Orden único de la pirámide — se calcula UNA vez acá y alimenta la secuencia
  // de drawers y el resolver de telemetría (mismo array que renderiza).
  const hallazgosOrdenados = ordenarHallazgosPiramide(results, aiAnalysis);

  // I-3: apertura de drawer (todas las cards entran por acá). El resolver emite
  // en paralelo `informe_hallazgo_abierto {n, id_hallazgo}` cuando el drawer
  // corresponde a un hallazgo de la pirámide (línea base pre-rediseño).
  // T5: el único drawer que abre la página LTR es "La zona"; los hallazgos viven en
  // los capítulos (T3), así que el drawer ya no corresponde a una card de la pirámide.
  useDrawerAbierto(activeDrawer, "ltr", () => null, { veredicto, accessLevel });

  // T5: la secuencia prev/next de los drawers murió con la pirámide. Antes se armaba
  // desde HALLAZGO_DRAWER y dejaba llegar, con las flechas, a diez drawers que ninguna
  // card abría ya. Queda solo la zona.
  const drawerSequence: DrawerKey[] = ["zona"];

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
  // ── DOS CAMINOS DE RENDER (v21 · 08-sep-2026) ─────────────────────────────
  // Con prosa de dos bloques las razones se leen DENTRO del bloque de arriba y la
  // sección «Qué determina el veredicto» deja de existir. Con prosa vieja —o sin
  // prosa— la página es exactamente la de siempre. Ver `esProsaDosBloques`: el
  // camino viejo es permanente para las filas anónimas.
  const dosBloques = esProsaDosBloques(prosa);
  // La alternancia de fondos es la forma de la página (contrato T2: seis cosas
  // distintas al hacer scroll). Al fusionarse una sección, las tres siguientes
  // invierten su tono para que dos consecutivas nunca compartan papel.
  const tonoNumeros = dosBloques ? "paper" : "paper2";
  const tonoInversion = dosBloques ? "paper2" : "paper";
  const tonoZona = dosBloques ? "paper" : "paper2";

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

  // ═══ T3 (contrato CONGELADO): La inversión son cinco capítulos ═══
  // Murió acá el acordeón de hallazgos con sus cuerpos de drawer inline, la
  // simulación con sus sliders y el análisis a 10 años de la IA. Los hallazgos
  // siguen siendo datos deterministas del motor; los capítulos los leen directo.
  // Lo que diga un provider de más afuera (la ruta dev con `?rediseno=1`). Se lee ACÁ,
  // antes de proveer, porque un componente no ve su propio provider.
  const redisenoHeredado = useRediseno();
  /** Lo que decide si esta pantalla se dibuja con el rediseño. Mismo valor que el
   *  que se provee más abajo; se calcula acá porque las secciones lo necesitan. */
  const rediseno = REDISENO_INFORME || redisenoHeredado;
  const ctxDrawer = results && inputData ? { results, inputData, prosa } : null;

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
  // Una sola construcción: la sección de siempre y la del contrato §8 leen la MISMA
  // base, así no pueden divergir mientras las dos existan.
  const zonaLtr = buildZonaLtr({
    stats: zoneInsight?.stats,
    sobre: sobreprecioPortada,
    medianaResolvedAt,
    arriendoUsuarioCLP: Number(inputData?.arriendo) || 0,
    comuna: comunaPortada || "",
  });
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
    return fechaCortaCL(fechaProsa ?? createdAt);
  })();
  // Referencia del cap rate neto: la del hallazgo (motor) o la del catálogo por comuna.
  const capRefInfo = (() => {
    const h = (results?.metrics as { hallazgoCapRate?: { valor?: { capRefPct?: number; fuente?: string } } | null } | undefined)?.hallazgoCapRate;
    if (h?.valor && typeof h.valor.capRefPct === "number") return { pct: h.valor.capRefPct, fuente: h.valor.fuente ?? "" };
    const ref = getCapRefComuna(comunaPortada);
    return { pct: ref.pct, fuente: ref.fuente };
  })();
  // «↓ Ver detalle» abre el capítulo donde vive el desarrollo del hallazgo (el
  // acordeón lo ancla arriba). Sin capítulo mapeado, cae a la sección entera.
  const abrirCapitulo = (id: CapituloId) => setCapituloAbrir({ id, nonce: Date.now() });
  // La portada: «Ajustar supuestos» lleva a "Cómo lo pagas" (precio, crédito y la
  // matriz pie×plazo son los supuestos que se pueden mover).
  const scrollASimulacion = () => abrirCapitulo("pagas");

  return (
    <div id="informe-pro-section" className="mb-8">
      {/* El MISMO gate por modalidad que `DocumentoFrame`, para lo que es estructura y
          una clase CSS no puede apagar (contrato §8: qué número manda en cada tarjeta
          de zona). STR no monta este provider — ver `RedisenoContexto.tsx`.
          El `|| heredado` NO es redundante: sin él este provider PISA al de la ruta dev
          —que envuelve desde afuera— con la constante en `false`, y `?rediseno=1` dejaba
          de encender la zona. Medido: las tarjetas nuevas no montaban. */}
      <RedisenoProvider valor={rediseno}>
      <DocumentoFrame secciones veredicto={veredicto} rediseno>
      {/* CSS del acordeón + vocabulario + modal, montado siempre: el modal de la
          posición y el de cálculo lo necesitan también mientras la prosa carga. */}
      <TokensHallazgos />
      <TokensShared />
      {/* ═══ 1 · PORTADA (paper) ═══ */}
      {/* Contrato §2: la caja va ACÁ. El «hero» de §3 —eyebrow, botón, score,
          titular, cifra— es esta sección, no la que el código llama «hero», que es
          la prosa y la recomendación. En 4a se la puse a la otra leyendo el nombre. */}
      <SeccionInforme id="portada" tono="paper" caja>
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
      {/* Contrato §2: el hero es una de las dos cajas. La recomendación es la otra, y
          hoy vive DENTRO del hero (`HeroLTR` monta `PosicionFranco`): sale a su propia
          sección en 4c, cuando se rediseñe su contenido. */}
      <SeccionInforme id="hero" tono="paper2">
      <HeroLTR
        onOpenDrawer={setActiveDrawer}
        data={prosa}
        razones={
          /* Contrato §2 y §4: los hallazgos son SU PROPIA SECCIÓN, suelta, después del
             hero. Se van CON la línea que declara, que pasa a ser el título de esa
             sección (§10): el título y las cuatro filas son una unidad —«Ajusta los
             números. Esto es lo que pesa:» y lo que pesa— y separarlos dejaba al hero
             prometiendo algo que no mostraba. */
          !rediseno && dosBloques && hallazgosOrdenados.length > 0 ? (
            <>
              <MarcaSeccion seccion="hallazgos" tipo="ltr" accessLevel={accessLevel} />
              <PrincipalesHallazgos hallazgos={hallazgosOrdenados} currency={currency} valorUF={valorUF} />
            </>
          ) : undefined
        }
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
          {/* ═══ 3 · PRINCIPALES HALLAZGOS (paper) — CAMINO VIEJO ═══
              Los cuatro que mueven el veredicto, del mismo orden único que el
              acordeón. Con prosa de dos bloques esta sección no existe: las mismas
              cuatro líneas se leen arriba, bajo la línea que declara. Acá siguen
              porque el informe viejo tiene que verse coherente consigo mismo —su
              título pregunta lo que su prosa contesta— y porque las 453 filas
              anónimas del parque nunca van a regenerar. */}
          {(!dosBloques || rediseno) && hallazgosOrdenados.length > 0 && (
            <SeccionInforme
              id="principales-hallazgos"
              tono="paper"
              /* EL TÍTULO LO DA LA LÍNEA QUE DECLARA cuando hay prosa nueva (§10). El
                 camino viejo conserva el suyo: su prosa no trae esa línea, así que
                 ponérsela sería inventarle un encabezado que nada sostiene. */
              titulo={rediseno && dosBloques ? lineaQueDeclara(veredicto) : "Qué determina el veredicto"}
            >
              <MarcaSeccion seccion="hallazgos" tipo="ltr" accessLevel={accessLevel} />
              <PrincipalesHallazgos hallazgos={hallazgosOrdenados} currency={currency} valorUF={valorUF} />
            </SeccionInforme>
          )}
          {/* ═══ 4 · LOS NÚMEROS (paper2) — seis cifras + modal de cálculo ═══ */}
          {results?.metrics && inputData && (
            <SeccionInforme
              id="los-numeros"
              tono={tonoNumeros}
              titulo="Las seis cifras"
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
          {/* ═══ 5 · LA INVERSIÓN (paper) — T3: los cinco capítulos del CONGELADO ═══ */}
          <SeccionInforme
            id="la-inversion"
            tono={tonoInversion}
            titulo="Cómo funciona como inversión"
          >
          <MarcaSeccion seccion="piramide" tipo="ltr" accessLevel={accessLevel} />
          {ctxDrawer && (
            <CapitulosInversion
              results={ctxDrawer.results}
              inputData={ctxDrawer.inputData}
              prosa={ctxDrawer.prosa}
              currency={currency}
              valorUF={valorUF}
              comuna={comunaPortada || "la comuna"}
              createdAt={createdAt}
              veredicto={veredicto}
              accessLevel={accessLevel}
              abrir={capituloAbrir}
            />
          )}
          {prosaDesactualizada && fechaCorta && (
            <p
              className="font-mono m-0 mt-2"
              style={{ fontSize: 10.5, lineHeight: 1.5, color: "var(--franco-text-muted)" }}
            >
              Análisis redactado el {fechaCorta}. Los números de arriba se recalculan en cada
              visita; el texto es el de esa fecha.
            </p>
          )}
          </SeccionInforme>
          {/* ═══ 6 · LA ZONA (paper2) ═══ */}
          {analysisId && (
            <SeccionInforme
              id="la-zona"
              tono={tonoZona}
              // La comuna vivía en el ksub; al morir el ksub sube al título, que es el
              // único lugar donde el nombre de la comuna aparece en esta sección.
              titulo={`La zona${comunaPortada ? ` · ${comunaPortada}` : ""}`}
            >
              <MarcaSeccion seccion="zona" tipo="ltr" accessLevel={accessLevel} />
              <ZonaLtrSection
                data={zoneInsight}
                loading={zoneLoading}
                error={zoneError}
                onClick={() => setActiveDrawer("zona")}
                currency={currency}
                valorUF={valorUF}
                zona={zonaLtr}
                zonaR2={buildZonaLtrR2({
                  base: zonaLtr,
                  inputData,
                  arriendoUsuarioCLP: Number(inputData?.arriendo) || 0,
                  precioUF: Number(inputData?.precio) || 0,
                  superficie: Number(inputData?.superficie) || 0,
                })}
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
      </RedisenoProvider>

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
          sobreprecio={sobreprecioPortada}
          medianaResolvedAt={medianaResolvedAt}
        />
      )}
    </div>
  );
}
