// ─────────────────────────────────────────────────────────────────────────────
// Datos vivos de la landing (v14, 07-sep-2026; sobre master el 27-sep-2026).
//
// La página vende una respuesta, no un producto, y la respuesta tiene que ser
// real: el último análisis emitido y los tres análisis de ejemplo salen de la base en cada revalidación (ISR 10 min en `src/app/page.tsx`),
// no de constantes. La landing no importa nada de acá desde el cliente: todo se
// lee en el servidor y baja por props.
//
// Reglas:
//  · Nada de acá puede tirar la landing. Cada lectura tiene su fallback; si la
//    base no responde, la página sale con la última foto conocida
//    (`landing-respaldo.json`).
//  · Service role sin cookies (`createServiceClient`): `test_accounts` no es
//    legible con anon, y hay que excluir las cuentas internas del "último
//    análisis".
//  · LO QUE SE ESCRIBE EN PANTALLA ES LO QUE ESCRIBE EL INFORME, con las mismas
//    funciones: el titular es el del motor (`titularMotor`, el de la portada), la
//    cifra la de `derivarCifraClaveLtr`, la línea de hallazgo la primera de «Esto es
//    lo que pesa» (`filasPrincipales`) y la card la de `construirCardLtr`. Ninguna
//    frase de la landing habla por el informe.
//  · LOS EJEMPLOS SE LEEN COMO LOS LEE EL INFORME: el informe no muestra `results`
//    persistido, lo recomputa en cada visita con el motor vivo
//    (`recomputeResultsForLegacy`), con la UF congelada de la fila, la mediana
//    comunal y la referencia de cap rate del snapshot (o resueltas vivas sin él) y
//    la fecha de creación — lo mismo que `src/app/analisis/[id]/informe-ltr.tsx`, y
//    el tier CAPREF-COMUNA lo exige en los dos. En memoria y sin escribir nada.
//
// La cifra de comparables NO vive acá: la landing la lee de `COMPARABLES_TEXTO`
// (src/lib/stats.ts), la fuente única del sitio (tier CIFRA-COMPARABLES).
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { filtroNoTest, getTestAccountIds } from "@/lib/admin-rpc";
import { readVeredicto } from "@/lib/results-helpers";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { derivarCifraClaveLtr, type CifraClave } from "@/lib/cifra-clave";
import { getUFValue, resolveUfForAnalysis } from "@/lib/uf";
import { captureApiWarning } from "@/lib/observabilidad";
import { recomputeResultsForLegacy } from "@/lib/analysis/recompute-results-for-legacy";
import { prefetchMedianaComunaVenta, prefetchCapRefComuna, type MedianaComunaSnapshot } from "@/lib/api-helpers/analisis-pipeline";
import type { CapRefComunaSnapshot } from "@/lib/capref-comuna";
import { filasPrincipales, ordenarHallazgosPiramide } from "@/lib/orden-hallazgos";
import { construirCardLtr, type CardRecomendacion } from "@/lib/card-recomendacion";
import { hayAjustesQueMostrar } from "@/lib/matriz-popup";
import { capRateNetoLtrPct } from "@/lib/cap-rate-hallazgo";
import { resolverArriendoReferencia, type ArriendoReferencia } from "@/lib/arriendo-referencia";
import { titularMotor } from "@/lib/titular-motor";
import { estadoRecomendacion, type EstadoRecomendacion } from "@/lib/lo-que-haria-yo";
import { metricaValorONull, type AIAnalysisV2, type AnalisisInput, type FullAnalysisResult, type Hallazgo, type HallazgoDistanciaVeredicto, type MixPalancas, type Veredicto } from "@/lib/types";
import RESPALDO from "./landing-respaldo.json";

/** Los tres análisis reales que rotan en "La respuesta, en fácil" y en "Lo que
 *  haría Franco". Orden fijo BUSCAR OTRO → AJUSTAR → COMPRAR: es el orden de la
 *  lectura, no el de la base. Si uno de los tres deja de existir, la sección
 *  muestra los que queden (nunca inventa uno). */
export const EJEMPLOS_LANDING: ReadonlyArray<{ id: string; veredictoEsperado: Veredicto }> = [
  { id: "43a1108b-7094-46b1-b4d9-d2ba92df2c2b", veredictoEsperado: "BUSCAR OTRA" }, // Santiago · 2D1B 60 m²
  { id: "7710a017-8066-47a6-8b3e-8fc64143e256", veredictoEsperado: "AJUSTA SUPUESTOS" }, // Providencia · 2D2B 60 m² (caso canónico)
  // San Miguel · 2D1B 43 m², UF 2.250 a precio de mercado, pie 20% (29-sep-2026). Reemplaza al Ñuñoa
  // 80 m² a UF 4.000, que estaba a la mitad de la mediana comunal, y al San Miguel de 41 m², cuyo
  // aviso declaraba un arriendo vigente de $380.000 bajo los $450.000 de la zona. Este no declara
  // arriendo: el informe usa el de la zona, como cualquier análisis.
  { id: "91736841-0dfe-45d5-ad10-6c710be7fb8f", veredictoEsperado: "COMPRAR" },
];

export interface EjemploLanding {
  id: string;
  /** Valor persistido (`data-verdict`). */
  veredicto: Veredicto;
  /** Etiqueta de banda: BUSCAR OTRO · AJUSTAR · COMPRAR. */
  etiqueta: string;
  /** El titular de la portada, escrito por el motor (`titularMotor`), con su plumón `**…**`. */
  titular: string | null;
  /** Cifra de portada (mismo derivador que el informe) y su caption del catálogo. */
  cifra: CifraClave | null;
  /** Eyebrow de la miniatura. El hero del informe lleva «dirección · comuna»; la
   *  landing no publica direcciones, así que va la comuna (en negrita, en el lugar
   *  de la calle) y la tipología con los metros, que sin calle ni ficha es lo único
   *  que dice qué depto es. Desvío del contrato §3, decidido el 11-sep-2026. */
  comuna: string;
  /** "2D2B 60 m²" · "Estudio 38 m²". Null si el input no lo trae. */
  detalle: string | null;
  /** Franco Score del análisis (1-100), el que muestra el informe. */
  score: number | null;
  /** Lo que va a la derecha del eyebrow en la miniatura: "Renta larga" / "Renta corta". */
  modalidad: string;
  /** La PRIMERA fila de «Esto es lo que pesa» del informe (`filasPrincipales`). Va CRUDA:
   *  la cifra y la referencia las arma el cliente con `findingDisplay` + `referenciaHallazgo`,
   *  las mismas funciones del informe — `findingDisplay` vive en un módulo "use client" y
   *  desde acá no se puede llamar. */
  hallazgo: Hallazgo | null;
  /** UF con la que el informe formatea este análisis (congelada en la fila). */
  valorUF: number;
  /** «La recomendación de Franco», la del informe: `construirCardLtr`, en pesos. */
  card: CardRecomendacion;
  /** La bajada de la card, como la calcula `HeroLTR`: Buscar otro es siempre «sin salida». */
  estado: EstadoRecomendacion;
  /** El pop-up de combinaciones, con los MISMOS datos que le pasa `HeroLTR`. Null en Buscar
   *  otro, que no tiene pop-up (`hayAjustesQueMostrar`). */
  popup: PopupLanding | null;
}

/** Lo que `PopupAjustes` recibe en el informe (HeroLTR, `cuerpoAjustes`). */
export interface PopupLanding {
  distancia: HallazgoDistanciaVeredicto | null;
  mixComprar: MixPalancas | null;
  precioUF: number;
  referenciaArriendo: ArriendoReferencia | null;
  antes: {
    cuotaMensual: number | null;
    flujoMensual: number | null;
    cocPct: number | null;
    capRateNetoPct: number | null;
    tirPct: number | null;
    score: number | null;
  } | null;
}

export interface DatosLanding {
  /** Último análisis emitido por una cuenta no interna. */
  ultimoAnalisis: { etiqueta: string; veredicto: Veredicto; comuna: string; createdAt: string } | null;
  ejemplos: EjemploLanding[];
  /** true cuando alguna lectura falló y se usó el respaldo. */
  degradado: boolean;
}

interface FilaEjemplo {
  id: string;
  comuna: string | null;
  created_at: string;
  input_data: (AnalisisInput & Record<string, unknown>) | null;
  results: FullAnalysisResult | null;
  ai_analysis: AIAnalysisV2 | null;
  mediana_comuna_snapshot: MedianaComunaSnapshot | null;
  capref_comuna_snapshot: CapRefComunaSnapshot | null;
}

/** "Estudio" / "2D2B" desde dormitorios y baños del input. */
function tipologia(input: Record<string, unknown> | null): string | null {
  const d = Number(input?.dormitorios);
  const b = Number(input?.banos);
  if (!Number.isFinite(d)) return null;
  if (d === 0) return "Estudio";
  return Number.isFinite(b) && b > 0 ? `${d}D${b}B` : `${d}D`;
}

/** "2D2B 60 m²": tipología y superficie, sin precio. */
function detalleDe(input: Record<string, unknown> | null): string | null {
  const tipo = tipologia(input);
  const m2 = Number(input?.superficie);
  const desc = [tipo, Number.isFinite(m2) && m2 > 0 ? `${Math.round(m2)} m²` : null].filter(Boolean).join(" ");
  return desc || null;
}

/** La primera fila de «Esto es lo que pesa», con su frase. */
function lineaDe(results: FullAnalysisResult, ai: AIAnalysisV2 | null): Hallazgo | null {
  const h = filasPrincipales(ordenarHallazgosPiramide(results, ai))[0];
  return h && typeof h.titular === "string" && h.titular.trim() ? h : null;
}

/** Un ejemplo, leído COMO LO LEE EL INFORME (informe-ltr.tsx): `results` se recomputa en
 *  memoria con el motor vivo, la UF congelada de la fila, la mediana comunal y la referencia de
 *  cap rate (snapshot presente gana; sin él, resueltas vivas) y la fecha de creación. Si el
 *  recompute falla, se cae a lo persistido y se avisa: la landing no se rompe, pero el reporte
 *  de Sentry dice que ese ejemplo no es lo que el informe muestra. */
async function ejemploDe(sb: SupabaseClient, fila: FilaEjemplo, ufLive: number, aviso: (que: string, e: unknown) => void): Promise<EjemploLanding | null> {
  const input = fila.input_data;
  const uf = resolveUfForAnalysis(fila.results, input, ufLive, fila.id);
  let results: FullAnalysisResult | null = fila.results;
  if (input) {
    try {
      const snap = fila.mediana_comuna_snapshot;
      const capRefSnapshot = fila.capref_comuna_snapshot;
      const medianaComuna =
        snap != null
          ? {
              mediana: snap.mediana,
              n: snap.n ?? 0,
              p25: snap.p25,
              p75: snap.p75,
              ...(snap.estimada ? { estimada: true } : {}),
              capRefComuna: capRefSnapshot ?? (await prefetchCapRefComuna(sb, input, uf)),
            }
          : await prefetchMedianaComunaVenta(sb, input, uf);
      results = recomputeResultsForLegacy(input, uf, medianaComuna, new Date(fila.created_at));
    } catch (e) {
      aviso("recompute_" + fila.id.slice(0, 8), e);
      results = fila.results;
    }
  }
  const veredicto = readVeredicto(results as Parameters<typeof readVeredicto>[0]);
  if (!veredicto || !results) return null;
  const metrics = (results.metrics ?? null) as { flujoNetoMensual?: number } | null;
  const distancia = (results.hallazgos?.find((h) => h.id === "distancia_veredicto") as HallazgoDistanciaVeredicto | undefined) ?? null;
  const cifra = metrics
    ? derivarCifraClaveLtr({ veredicto, flujoNetoMensual: metrics.flujoNetoMensual ?? NaN, distancia, ufValue: uf })
    : null;
  // La card y el titular, con las MISMAS funciones que la portada y `HeroLTR` (en pesos: la
  // landing no tiene toggle de moneda).
  const card = construirCardLtr({ veredicto, results, inputData: input, currency: "CLP", valorUF: uf });
  // El pop-up, armado como en HeroLTR (`cuerpoAjustes`): la grilla del hallazgo de distancia (o la
  // de Comprar), el precio, lo que piden los avisos parecidos y la columna «Hoy».
  const mixComprar = (results as { mixComprar?: MixPalancas | null }).mixComprar ?? null;
  const popup: PopupLanding | null = hayAjustesQueMostrar({ veredicto, distancia, mixComprar })
    ? {
        distancia,
        mixComprar,
        precioUF: Number(input?.precio ?? 0),
        referenciaArriendo: resolverArriendoReferencia(input),
        antes: results.metrics
          ? {
              cuotaMensual: results.metrics.dividendo ?? null,
              flujoMensual: results.metrics.flujoNetoMensual ?? null,
              cocPct: metricaValorONull(results.metrics.cashOnCash),
              capRateNetoPct: capRateNetoLtrPct(results.metrics),
              tirPct: metricaValorONull(results.exitScenario?.tir),
              score: results.score ?? null,
            }
          : null,
      }
    : null;
  return {
    id: fila.id,
    veredicto,
    etiqueta: etiquetaVeredicto(veredicto, "banda"),
    titular: titularMotor({ veredicto, modalidad: "ltr", card }).titular,
    cifra,
    comuna: fila.comuna || (input?.comuna as string) || "",
    detalle: detalleDe(input),
    score: Number.isFinite(Number(results.score)) ? Number(results.score) : null,
    // Los tres ejemplos son LTR (EJEMPLOS_LANDING); si algún día entra un STR, el
    // rótulo sale de su modalidad y no de una constante.
    modalidad: "Renta larga",
    hallazgo: lineaDe(results, fila.ai_analysis),
    valorUF: uf,
    card,
    estado: veredicto === "BUSCAR OTRA" ? "sin_salida" : estadoRecomendacion(veredicto, card.bloque),
    popup,
  };
}

function ejemplosRespaldo(): EjemploLanding[] {
  return (RESPALDO.ejemplos as unknown as EjemploLanding[]).map((e) => ({ ...e, etiqueta: etiquetaVeredicto(e.veredicto, "banda") }));
}

// ─── LOS EJEMPLOS GUARDADOS (29-sep-2026) ────────────────────────────────────
// Los tres ejemplos los calcula el motor UNA vez y se sirven guardados: la clave lleva la versión
// del deploy, así cada deploy los recalcula, y vencen al día, para seguir la UF y los comparables.
// La página sigue con su ISR de 10 minutos para el último análisis emitido; lo que ya no hace es
// correr el motor tres veces en cada regeneración. Nada escrito a mano: es el mismo cálculo.
//
// Un resultado DEGRADADO no se guarda: se lanza adentro (unstable_cache no guarda errores) y afuera
// se sirve igual, así el respaldo nunca queda fijado un día entero. Fuera del runtime de Next (los
// scripts con tsx) unstable_cache no está disponible y se calcula directo.
const VERSION_DEPLOY = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? "local";
export const EJEMPLOS_REVALIDATE_S = 86400;

class EjemplosDegradados extends Error {
  constructor(readonly ejemplos: EjemploLanding[]) {
    super("ejemplos degradados: no se guardan");
  }
}

async function calcularEjemplos(): Promise<{ ejemplos: EjemploLanding[]; degradado: boolean }> {
  let degradado = false;
  const aviso = (que: string, error: unknown) => {
    degradado = true;
    captureApiWarning(error, { ruta: "GET / (landing-vivo)", operacion: que });
  };
  const sb = createServiceClient();
  const [filas, ufLive] = await Promise.all([
    sb.from("analisis")
      .select("id, comuna, created_at, input_data, results, ai_analysis, mediana_comuna_snapshot, capref_comuna_snapshot")
      .in("id", EJEMPLOS_LANDING.map((e) => e.id))
      .then((r) => (r.error ? (aviso("ejemplos", r.error), null) : (r.data as unknown as FilaEjemplo[]))),
    getUFValue(),
  ]);

  let ejemplos: EjemploLanding[];
  if (filas) {
    const porId = new Map(filas.map((f) => [f.id, f]));
    const leidos = await Promise.all(
      EJEMPLOS_LANDING.map(async (e) => {
        const fila = porId.get(e.id);
        const ej = fila ? await ejemploDe(sb, fila, ufLive, aviso) : null;
        if (!ej) aviso("ejemplo_" + e.id.slice(0, 8), new Error("fila ausente o sin veredicto"));
        else if (ej.veredicto !== e.veredictoEsperado) {
          // Un recompute puede mover el veredicto del ejemplo: se muestra lo que dice
          // el motor, pero queda registrado para reemplazar el id por otro del trío.
          captureApiWarning(new Error(`veredicto ${ej.veredicto} ≠ esperado ${e.veredictoEsperado}`), {
            ruta: "GET / (landing-vivo)",
            operacion: "ejemplo_veredicto_cambio",
            analysisId: e.id,
          });
        }
        return ej;
      }),
    );
    ejemplos = leidos.filter((e): e is EjemploLanding => e !== null);
    if (ejemplos.length === 0) {
      degradado = true;
      ejemplos = ejemplosRespaldo();
    }
  } else {
    degradado = true;
    ejemplos = ejemplosRespaldo();
  }
  return { ejemplos, degradado };
}

const ejemplosGuardados = unstable_cache(
  async (): Promise<EjemploLanding[]> => {
    const r = await calcularEjemplos();
    if (r.degradado) throw new EjemplosDegradados(r.ejemplos);
    return r.ejemplos;
  },
  ["landing-ejemplos", VERSION_DEPLOY, ...EJEMPLOS_LANDING.map((e) => e.id)],
  { revalidate: EJEMPLOS_REVALIDATE_S, tags: ["landing-ejemplos"] },
);

async function leerEjemplos(): Promise<{ ejemplos: EjemploLanding[]; degradado: boolean }> {
  try {
    return { ejemplos: await ejemplosGuardados(), degradado: false };
  } catch (e) {
    if (e instanceof EjemplosDegradados) return { ejemplos: e.ejemplos, degradado: true };
    return calcularEjemplos();
  }
}

export async function leerDatosLanding(): Promise<DatosLanding> {
  let degradado = false;
  const aviso = (que: string, error: unknown) => {
    degradado = true;
    captureApiWarning(error, { ruta: "GET / (landing-vivo)", operacion: que });
  };

  const sb = createServiceClient();

  const [ultimo, guardados] = await Promise.all([
    (async () => {
      try {
        const noTest = filtroNoTest(await getTestAccountIds(sb));
        let q = sb
          .from("analisis")
          .select("comuna, results, created_at")
          .not("results", "is", null)
          .order("created_at", { ascending: false })
          .limit(5);
        if (noTest) q = q.or(noTest);
        const { data, error } = await q;
        if (error) throw error;
        for (const row of data ?? []) {
          const v = readVeredicto(row.results as Parameters<typeof readVeredicto>[0]);
          if (v && row.comuna) {
            return { etiqueta: etiquetaVeredicto(v, "banda"), veredicto: v, comuna: row.comuna as string, createdAt: row.created_at as string };
          }
        }
        return null;
      } catch (e) {
        aviso("ultimo_analisis", e);
        return null;
      }
    })(),
    leerEjemplos(),
  ]);

  return {
    ultimoAnalisis: ultimo,
    ejemplos: guardados.ejemplos,
    degradado: degradado || guardados.degradado,
  };
}
