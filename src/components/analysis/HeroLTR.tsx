"use client";

import { useMemo } from "react";
import { fechaCortaCL } from "@/lib/fecha-cl";
import { PosicionFranco } from "./shared/PosicionFranco";
import type { AnalisisInput, FullAnalysisResult, Hallazgo, HallazgoDistanciaVeredicto, Veredicto } from "@/lib/types";
import type { DrawerKey } from "@/components/ui/AnalysisDrawer";
import { PopupAjustes, hayAjustesQueMostrar } from "./shared/PopupAjustes";
import { PopupAjustesTokens } from "./shared/PopupAjustesTokens";
import { lineaFooterVias } from "@/lib/palancas-en-palabras";
import { salidaPorMix } from "@/lib/salida-por-mix";
import { LoQueHariaYoBloque, CardBuscarOtra } from "./shared/LoQueHariaYoBloque";
import { estadoRecomendacion } from "@/lib/lo-que-haria-yo";
import { construirCardLtr } from "@/lib/card-recomendacion";
import { construirAlternativaComunas, lineaAlternativaComunas } from "@/lib/alternativa-comunas";
import { resolverArriendoReferencia } from "@/lib/arriendo-referencia";
import { DetalleAlternativaComunas } from "./shared/DetalleAlternativaComunas";
import { SeccionInforme } from "./SeccionInforme";
import { MarcaSeccion } from "./informeTelemetry";
import type { ReactNode } from "react";
import { metricaValorONull } from "@/lib/types";
import { capRateNetoLtrPct } from "@/lib/cap-rate-hallazgo";

/**
 * Hero de resultados LTR — rediseño dark (Fase 1a). Referencia visual aprobada:
 * mockup-hero-dark.html. Reemplaza al HeroVerdictBlock legacy dentro del
 * SubjectCardGrid; las MiniCards 2×2, Zona y drawers quedan intactas.
 *
 * UNA superficie continua dividida por hairlines HORIZONTALES (no cajas
 * tintadas por sección; sin borde vertical entre columnas — A1). Estructura:
 *  F1 identidad · F2 chips · F3 score|mapa · F4 veredicto|findings · pie firma.
 *
 * Construcción por etapas: E1 = F1 + F2.
 */
export function HeroLTR({
  currency,
  veredicto,
  valorUF,
  inputData,
  results,
  createdAt,
  fechaProsa,
  hallazgos,
  accessLevel = "free",
}: {
  /** EL ORDEN (contrato §2): la sección de hallazgos, la que va ENTRE el hero y la
   *  recomendación. La arma el grid —es quien tiene la lista ordenada y sus gates— y
   *  la monta este componente, porque la recomendación que va después se calcula acá
   *  y no puede salir del subárbol sin mover nueve derivadas con ella. */
  hallazgos?: ReactNode;
  /** Para la marca de telemetría de la sección nueva. */
  accessLevel?: string;
  currency: "CLP" | "UF";
  onCurrencyChange: (c: "CLP" | "UF") => void;
  veredicto: string;
  score: number;
  propiedadTitle: string;
  inputData: AnalisisInput | null | undefined;
  results: FullAnalysisResult | null | undefined;
  comuna?: string;
  /** Abre un drawer desde "La posición de Franco". Sin este callback el bloque queda
   *  informativo (sin affordance), que es el comportamiento previo. */
  onOpenDrawer?: (key: DrawerKey) => void;
  ciudad?: string;
  valorUF: number;
  createdAt?: string;
  /** Fecha de la PROSA vigente (`fin_at` de la última generación exitosa).
   *  El pie del informe la prefiere sobre `createdAt`: con lazy-regen por bump
   *  de PROMPT_VERSION, la fila puede ser de abril y la prosa de agosto.
   *  Ausente en filas anteriores a la instrumentación → cae a `createdAt`. */
  fechaProsa?: string;
}) {
  // FASE 3: F1/F2/F3 murieron — identidad, chips, score y mapa viven en la
  // PORTADA (PortadaInforme + useComparablesCercanos). Acá queda solo F4.

  // LA IA SALIÓ DEL INFORME (25-sep-2026, decisión de Fabrizio). Este componente ya no lee la
  // prosa: sin el h2 «¿Conviene o no conviene?», sin la apertura, sin el skeleton de
  // generación ni el error con Reintentar, y sin la negociación ni el chip de objetivo que
  // colgaban de la card. Todo lo que dibuja sale del motor y está al primer render. La
  // maquinaria de la IA (prompts, generación, crons, guards) sigue viva: se retira por partes.

  // CTA contextual de la posición de Franco — por VEREDICTO (contrato FASE 2 §4),
  // no por qué hallazgo exista: BUSCAR OTRA → "Por qué no cierra" · AJUSTA → "Ver
  // las vías" · COMPRAR → "Qué verificar antes de firmar". El destino sigue siendo
  // el drawer de distancia (o sensibilidad en COMPRAR), que es donde vive la
  // respuesta; lo que se fija es el LABEL, que antes prometía cosas distintas
  // según el inventario de hallazgos.
  const hallazgosRow = (results?.hallazgos ?? []) as Hallazgo[];
  const distanciaRow = hallazgosRow.find((h): h is HallazgoDistanciaVeredicto => h.id === "distancia_veredicto");
  // FOOTER DE LA POSICIÓN — contrato CONGELADO 02-sep-2026 (T2). Por veredicto:
  // AJUSTA y BUSCAR OTRA abren "Lo que te separa" (la matriz de vías, en modal);
  // COMPRAR abre "Cuánto aguanta este veredicto" (la sensibilidad del arriendo).
  // Sin distancia cae a sensibilidad si existe; sin ninguna, no hay footer. Es
  // información de otra índole que no compite con el flujo de lectura: modal,
  // no drawer, y el único botón real del informe hasta que exista el CTA.
  // POR QUÉ NO CIERRA (LTR) — puerto del patrón STR (§1.12.8): la glosa de los
  // motivos que decidieron el veredicto, SOLO cuando lo decidió un gate y no la
  // banda del score. Los brazos del Gate 1 viajan en el hallazgo de distancia
  // (recomputado — misma fuente que su drawer); la capa del Gate 2 no tiene
  // brazo persistido y se deriva: score en banda COMPRAR (≥70) con veredicto
  // AJUSTA ⇒ el gate capó. Veredicto de banda pura → null y no se muestra nada:
  // inventar una causa sería peor que no darla (§1.9.3).
  // ── EL CUERPO DETERMINISTA (v22.1) ────────────────────────────────────────
  // El motor calcula las cuatro vías, el salto de dos bandas y el mix desde fcfcbd98,
  // y hasta acá el bloque no leía nada: mostraba un párrafo. Ahora dibuja los datos.
  //
  // SOLO en el camino nuevo (`dosBloques`): las filas anónimas con prosa de cuatro
  // campos siguen igual, y su `results` recomputado igual trae los campos —pero su
  // maqueta es otra y mezclar las dos formas es peor que dejar la vieja quieta.
  // EL GATE DE PROSA SE LEVANTA (11-sep-2026). `dosBloques` protegía dos MAQUETAS DE
  // TEXTO: la prosa vieja de cuatro campos y la nueva de dos bloques, que no se podían
  // mezclar. La card del contrato §5 no lleva prosa —título, bajada, ecuación, costo y
  // CTA—, así que esa condición se quedó sin sujeto, y lo único que seguía haciendo era
  // dejar sin bloque a 1.194 de las 1.202 filas del parque.
  //
  // El dato existe para todas: `results` se recomputa en cada visita con el motor vivo,
  // así que el mix y las palancas están ahí aunque la prosa sea de v3. Lo que faltaba
  // era dejar de esconderlo.
  // UNA SOLA CONSTRUCCIÓN (25-sep-2026): la misma card la lee la portada para escribir el
  // titular del motor. Ver `card-recomendacion.ts`.
  const card = construirCardLtr({ veredicto: veredicto as Veredicto, results, inputData, currency, valorUF });
  const bloqueDeterminista = card.bloque;

  // ¿HAY ALGO QUE MOSTRAR? (13-sep-2026) Si el motor no encontró grilla NI palancas que
  // crucen, la card ya lo dice todo —«no hay forma», el número de lo que haría falta y la
  // alternativa de comunas— y un pop-up que repita eso es ruido. Ahí NO se dibuja el botón.
  // Medido: 267 filas LTR caen en ese caso. OJO con no confundirlo con el estado
  // `sin_salida` de la card (600 filas): 333 de esas SÍ tienen grilla y sí abren el pop-up.
  // BUSCAR OTRA NO TIENE POP-UP (24-sep-2026): `hayAjustesQueMostrar` lo dice por construcción.
  const hayQueMostrar = hayAjustesQueMostrar({
    veredicto: veredicto as Veredicto,
    distancia: distanciaRow ?? null,
    mixComprar: results?.mixComprar ?? null,
  });
  const cuerpoAjustes = (
    <>
      <PopupAjustesTokens />
      <PopupAjustes
        veredicto={veredicto as Veredicto}
        modalidad="LTR"
        distancia={distanciaRow ?? null}
        // La grilla de COMPRAR viene por su propio campo: el hallazgo de distancia es null
        // ahí, así que no puede viajar dentro. Ver el jsdoc de `FullAnalysisResult`.
        mixComprar={results?.mixComprar ?? null}
        currency={currency}
        valorUF={valorUF}
        precioUF={Number(inputData?.precio ?? 0)}
        // EL CAMINO DE MERCADO (25-sep-2026): lo que piden los avisos parecidos, de la misma
        // fuente que la referencia de la zona (`resolverArriendoReferencia`).
        referenciaArriendo={resolverArriendoReferencia(inputData)}
        // LA COLUMNA «HOY» DE LA TABLA (25-sep-2026): las mismas cifras que el informe muestra
        // arriba, para que «Hoy» no diga otra cosa que el hero.
        antes={
          results?.metrics
            ? {
                cuotaMensual: results.metrics.dividendo ?? null,
                flujoMensual: results.metrics.flujoNetoMensual ?? null,
                cocPct: metricaValorONull(results.metrics.cashOnCash),
                // La misma cifra que el hero (`capRateNetoLtrPct`): una sola «cap rate neto».
                capRateNetoPct: capRateNetoLtrPct(results.metrics),
                tirPct: metricaValorONull(results.exitScenario?.tir),
                score: results.score ?? null,
              }
            : null
        }
      />
    </>
  );
  const footer =
    !hayQueMostrar
      ? null
      : distanciaRow && veredicto !== "COMPRAR"
      ? {
          key: "distanciaVeredicto" as const,
          k: "Ajustar supuestos",
          // Cuántas de las vías cruzan, leído de `vias` (goal "cuatro palancas
          // siempre"). Sin `vias` (filas viejas) queda la línea genérica. El total es el
          // de las vías reales (LTR: 4); la frase vive en palancas-en-palabras (T1).
          l: (() => {
            const vias = distanciaRow.valor.vias;
            if (!vias || vias.length === 0) return lineaFooterVias(null, 4);
            return lineaFooterVias(
              vias.filter((v) => v.estado === "cruza").length,
              vias.length,
              salidaPorMix(distanciaRow.valor) !== null,
            );
          })(),
          btn: "Ver todas las combinaciones",
          // Sin bajada: la intro del modal es UN solo párrafo y vive en el cuerpo.
          // (Hasta el 17-sep-2026 ese cuerpo era `DrawerDistanciaLtr`, que se borró con el
          //  resto de lo que colgaba de `drawerSequence = ["zona"]`; hoy el cuerpo es
          //  `cuerpoAjustes`, más abajo.)
          sub: undefined,
          // LAS DOS PROFUNDIDADES, UN SOLO POP-UP. Primero qué te separa del veredicto
          // (las cuatro palancas con su intro y su cierre) y después qué pasa si mueves
          // pie y plazo. Son la misma pregunta a dos niveles y no justifican dos botones.
          cuerpo: cuerpoAjustes,
        }
      : veredicto === "COMPRAR"
        ? {
            // COMPRAR: no hay a dónde subir, así que no hay matriz ni óptimo. Van los
            // márgenes de la card —Margen, Precio, Verifica— con su oración completa.
            key: "sensibilidad" as const,
            // EN COMPRAR NO HAY AJUSTE QUE RECOMENDAR: el veredicto ya es el de arriba. Lo
            // que el pop-up muestra es hasta dónde aguanta, así que el rótulo lo dice.
            k: "Cómo queda con otro pie o plazo",
            l: "Franco probó cada combinación de pie y plazo al precio pedido.",
            btn: "Ver cómo queda con otro pie o plazo",
            sub: undefined,
            cuerpo: cuerpoAjustes,
          }
        : null;
  const fechaFirma = formatFecha(fechaProsa ?? createdAt);

  // FASE 3 rediseño Dictamen: F1 (identidad+toggle), F2/F3 (chips, score 48px,
  // gauge, badge, mapa) MURIERON — la portada nueva (PortadaInforme) los absorbe:
  // eyebrow, banda semántica (M2: único color de estado), barra fina de score,
  // link de ficha y mapa. El hero conserva F4 (veredicto narrado + prosa +
  // índice), la posición de Franco y el pie de firma. Sin data-verdict: el wash
  // por veredicto del hero-block contradecía M2.
  // SIN CARD. El bloque era una card gris flotante (`franco-hero-block`: gradiente,
  // borde y sombra) sobre el papel del informe. Ahora es texto directo sobre el fondo,
  // como ya lo era "La posicion de Franco" -- que queda como la UNICA caja del bloque,
  // y por eso vuelve a significar algo.
  //
  // SIN GRID 52/48: la columna derecha estaba VACIA (un solo hijo en una grilla de
  // dos), asi que el hero desperdiciaba el 48% de su ancho y la prosa se leia en una
  // columna angosta sin razon. Pasa a ancho completo con su ``, que es lo
  // que gobierna la medida de lectura.
  //
  // FUERA el rotulo "Veredicto": la banda de la portada ya lo dice a ancho completo y
  // repetirlo era etiquetar lo obvio. En su lugar, la pregunta la firma Franco.
  /* LA BAJADA DE §5, uno por estado. La arma acá y no en `PosicionFranco` porque el
     estado vive en el dato y esa pieza es presentacional — la misma razón por la que
     recibe la caja IA ya renderizada.

     Los tres salen de la forma del bloque, no de un campo nuevo: COMPRAR tiene su rama
     propia en el motor (sin mix y sin descarte), «sin salida» es el mix que no pide
     descuento porque no lo hay, y el resto es la ecuación completa. */
  /** ¿La card cae al estado SIN SALIDA? Sin mix y sin filas, o con un mix que solo
   *  llega al escalón intermedio — que por §5 no es una recomendación. */
  const sinSalidaRecomendacion =
    veredicto !== "COMPRAR" &&
    (() => {
      const mix = bloqueDeterminista?.mix ?? null;
      if (mix) return mix.destino !== "COMPRAR";
      return (bloqueDeterminista?.filas?.length ?? 0) === 0;
    })();
  // §5 revisado: PosicionFranco dibuja la bajada según el estado (y la píldora solo con
  // salida). Acá se calcula el estado; el texto no viaja.
  const estadoRec = estadoRecomendacion(veredicto, bloqueDeterminista);

  // ── LA ALTERNATIVA DE COMUNAS (§5) ────────────────────────────────────────
  // «Prueba con otro departamento» dejaba al lector sin el dato que más le sirve:
  // a dónde ir. Hasta hoy eso vivía en el prompt —el modelo elegía una comuna de
  // una lista fija— y la card de §5 no lleva prosa, así que no tenía dónde
  // aparecer. Ahora lo calcula el motor: el MISMO depto corrido en las otras
  // comunas del roster, con el presupuesto del comprador como techo.
  //
  // SOLO EN EL ESTADO SIN SALIDA, y es deliberado: son 23 corridas del motor,
  // baratas pero no gratis, y en cualquier otro estado la card ya tiene qué decir.
  // `useMemo` para que no se repitan en cada render de la moneda.
  const alternativa = useMemo(
    () =>
      sinSalidaRecomendacion && inputData
        ? construirAlternativaComunas({ input: inputData, ufClp: valorUF, asOf: new Date(fechaProsa ?? createdAt ?? Date.now()) })
        : null,
    [sinSalidaRecomendacion, inputData, valorUF, fechaProsa, createdAt],
  );
  const lineaAlternativa = lineaAlternativaComunas(alternativa);

  /* LA RECOMENDACIÓN. Se calcula acá —nueve derivadas de este componente— y se
     monta en su PROPIA sección, después de los hallazgos (contrato §2). */
  /* Pieza compartida desde T1 (PosicionFranco): la caja IA + la firma en el cuerpo
     con la línea roja, y el footer con el botón que abre el modal. Sin caja ni
     footer no hay bloque. */
  // ── BUSCAR OTRA: LA CAUSA Y LA DISTANCIA (24-sep-2026) ─────────────────────
  // Sin combinación que ofrecer, la card dice por qué no conviene y a qué distancia queda
  // Comprar. Sin botón y sin pop-up. El texto sale de `buscar-otra-copy.ts`.
  const esBuscar = veredicto === "BUSCAR OTRA";
  const cardBuscar = card.buscar ? <CardBuscarOtra causa={card.buscar.causa} distancia={card.buscar.distancia} /> : null;

  const recomendacion = (
    <PosicionFranco
      bloque={
          cardBuscar ?? (bloqueDeterminista ? (
            <LoQueHariaYoBloque bloque={bloqueDeterminista} veredicto={veredicto} alternativa={lineaAlternativa} />
          ) : undefined)
        }
      puertaExtra={
        /* LA TABLA DE COMUNAS, POR SU PROPIA PUERTA (17-sep-2026). Hasta hoy viajaba como
           `extraPopup` dentro del modal del pop-up de ajustes, así que cuando ese botón dejó
           de dibujarse —237 filas, la decisión correcta— la tabla se fue con él: 35 filas
           quedaron con la línea «En Puente Alto un departamento como este sí convendría» y
           sin las cifras que la respaldan. Ver el acta de `PuertaExtra`.
           EL CALLER DECIDE SI HAY CONTENIDO. `DetalleAlternativaComunas` se autoanula sin
           comunas y el padre no se enteraba: habría dibujado un botón hacia un modal vacío.
           EL RÓTULO es el eco de la línea que la cita, el mismo patrón de «Ver qué se probó»
           contra «Las combinaciones que Franco probó». */
        !esBuscar && alternativa && alternativa.todas.length > 0
          ? {
              key: "alternativaComunas",
              k: "Dónde sí convendría",
              btn: "Ver dónde sí convendría",
              cuerpo: <DetalleAlternativaComunas alternativa={alternativa} currency={currency} valorUF={valorUF} />,
            }
          : null
      }
      titulo="La recomendación de Franco"
      estado={esBuscar ? "sin_salida" : estadoRec}
      fechaFirma={fechaFirma}
      footer={
        /* EL CTA DEL ESTADO SIN SALIDA nombra lo que hay del otro lado: no quedan
           ajustes que hacer, queda ver QUÉ SE PROBÓ. El pop-up es el mismo — ahí
           sigue el mix que llega al escalón intermedio, que es donde el contrato
           §5 lo manda. Solo cambia el rótulo del botón. */
        esBuscar ? null : footer && sinSalidaRecomendacion ? { ...footer, btn: "Ver qué se probó" } : footer
      }
      tipo="ltr"
      veredicto={veredicto}
    />
  );

  /* SIN SECCIÓN «HERO» PROPIA (25-sep-2026). La poblaban el h2 «¿Conviene o no conviene?», la
     apertura de la prosa y el skeleton o el error mientras la redacción venía en camino. Con la
     IA fuera del informe no queda nada que pintar acá, y una sección sin contenido no se monta:
     después de la portada van los hallazgos y la recomendación. */
  /* EL ORDEN DEL CONTRATO §2: hero → hallazgos → recomendación. Hasta hoy la
     recomendación vivía DENTRO del hero, así que el lector leía la conclusión antes
     que lo que la sostiene.

     POR QUÉ LAS TRES SECCIONES LAS EMITE ESTE COMPONENTE Y NO EL GRID. La
     recomendación se arma con nueve derivadas que se calculan acá —`cajaAccionable`,
     `footer`, `negociacion`, `bloqueDeterminista`, `prosaSobrevive`, `objetivoChip`,
     `fechaFirma`, `sinSalidaRecomendacion` y `bajada`—, así que sacarla del subárbol
     sin moverlas a todas era imposible. El grid sigue decidiendo QUÉ va en el medio:
     le pasa la sección de hallazgos ya armada, igual que hoy le pasa `razones`.

     Sacar ese cálculo a una pieza propia —y que el grid monte las tres— es el refactor
     que el contrato pide de verdad, y queda en cola: no es trabajo de este goal. */
  return (
    <>
      {hallazgos}
      {/* LA SEGUNDA CAJA de §2. La primera es «portada»; ésta es la otra, y hasta hoy
          no existía como sección: nace con este orden. */}
      <SeccionInforme id="recomendacion" tono="paper2" caja>
        <MarcaSeccion seccion="recomendacion" tipo="ltr" accessLevel={accessLevel} />
        {recomendacion}
      </SeccionInforme>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// F4 helpers — findings, prosa con números en mono, firma
// ═══════════════════════════════════════════════════════════════════════════

// Fecha de la firma: "3 jul 2026" (es-CL). Vacío si no hay createdAt válido.
function formatFecha(iso?: string): string {
  return fechaCortaCL(iso);
}


