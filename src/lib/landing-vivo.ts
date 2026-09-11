// ─────────────────────────────────────────────────────────────────────────────
// Datos vivos de la landing (v14, 07-sep-2026).
//
// La página vende una respuesta, no un producto, y la respuesta tiene que ser
// real: el conteo de avisos, el último scrape, el último análisis emitido y los
// tres análisis de ejemplo salen de la base en cada revalidación (ISR 10 min en
// `src/app/page.tsx`), no de constantes. La landing no importa nada de acá desde
// el cliente: todo se lee en el servidor y baja por props.
//
// Reglas:
//  · Nada de acá puede tirar la landing. Cada lectura tiene su fallback; si la
//    base no responde, la página sale con el último dato conocido (`RESPALDO`).
//  · Service role sin cookies (`createServiceClient`): `test_accounts` no es
//    legible con anon, y hay que excluir las cuentas internas del "último
//    análisis".
//  · Lo que se escribe en pantalla lo decide el motor: la etiqueta del veredicto
//    sale de `etiquetaVeredicto`, el titular corto de `ai_analysis.titular`
//    (pasando por el guard de voz, igual que el informe), la cifra con su
//    caption de `derivarCifraClaveLtr` (catálogo cerrado) y la recomendación de
//    `construirLoQueHariaYo` (el mismo modelo puro de la card §5 del informe).
//    Los textos del mockup eran placeholders y no viven en el código.
//  · LOS EJEMPLOS SE LEEN COMO LOS LEE EL INFORME (FASE 1.9, 11-sep-2026): el
//    informe NO muestra `results` persistido, lo recomputa en cada visita con el
//    motor vivo (`recomputeResultsForLegacy`, misma UF congelada, misma mediana
//    comunal y misma fecha que `src/app/analisis/[id]/page.tsx`). La landing hace
//    lo mismo, en memoria y sin escribir nada: así lo que promete la sección 2 es
//    exactamente lo que el visitante recibe al abrir un informe. Leer lo persistido
//    daba dos informes distintos para el mismo id — y para el caso canónico de
//    Providencia (methodology_version v1) ni siquiera había hallazgo de distancia
//    persistido, o sea que la recomendación no existía. El titular sí es el
//    persistido: es prosa de la IA y el informe tampoco la regenera al leer.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { filtroNoTest, getTestAccountIds } from "@/lib/admin-rpc";
import { readVeredicto } from "@/lib/results-helpers";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { derivarCifraClaveLtr, type CifraClave } from "@/lib/cifra-clave";
import { sanitizeVozChilenaTexto } from "@/lib/voz-chilena";
import { evaluarTitular, normalizarMarcasTitular } from "@/lib/prosa-marcas";
import { getUFValue, resolveUfForAnalysis } from "@/lib/uf";
import { captureApiWarning } from "@/lib/observabilidad";
import { recomputeResultsForLegacy } from "@/lib/analysis/recompute-results-for-legacy";
import { prefetchMedianaComunaVenta, type MedianaComunaSnapshot } from "@/lib/api-helpers/analisis-pipeline";
import { ordenarHallazgosPiramide } from "@/lib/orden-hallazgos";
import { bajadaRecomendacion, construirLoQueHariaYo, type BloqueLoQueHariaYo } from "@/lib/lo-que-haria-yo";
import { construirAlternativaComunas, lineaAlternativaComunas } from "@/lib/alternativa-comunas";
import type {
  AIAnalysisV2,
  AnalisisInput,
  FullAnalysisResult,
  Hallazgo,
  HallazgoDistanciaVeredicto,
  HallazgoSensibilidad,
  Veredicto,
} from "@/lib/types";

/** Los tres análisis reales que rotan en "La respuesta, en fácil" y en "Lo que
 *  haría Franco" (contrato v14). Orden fijo BUSCAR OTRO → AJUSTAR → COMPRAR: es
 *  el orden de la lectura, no el de la base. Si uno de los tres deja de existir,
 *  la sección muestra los que queden (nunca inventa uno).
 *
 *  El BUSCAR OTRO cambió el 11-sep-2026 (decisión de Fabrizio, FASE 1.9): el
 *  anterior (af7241e3, Santiago · estudio 38 m²) estaba persistido con un motor
 *  que no medía la vía a Comprar. El nuevo está persistido con el motor vigente
 *  (methodology_version v3, campos `palancasHastaComprar` y `mixPalancas`) y
 *  muestra el estado «no hay forma» con números reales. */
export const EJEMPLOS_LANDING: ReadonlyArray<{ id: string; veredictoEsperado: Veredicto }> = [
  { id: "43a1108b-7094-46b1-b4d9-d2ba92df2c2b", veredictoEsperado: "BUSCAR OTRA" }, // Santiago · 2D1B 60 m²
  { id: "7710a017-8066-47a6-8b3e-8fc64143e256", veredictoEsperado: "AJUSTA SUPUESTOS" }, // Providencia · 2D2B 60 m² (caso canónico)
  { id: "17b4e10d-2afd-4554-b914-fe731ee2c9a0", veredictoEsperado: "COMPRAR" }, // Ñuñoa · 2D2B 80 m²
];

export interface EjemploLanding {
  id: string;
  /** Valor persistido (`data-verdict`). */
  veredicto: Veredicto;
  /** Etiqueta de banda: BUSCAR OTRO · AJUSTAR · COMPRAR. */
  etiqueta: string;
  /** Titular corto de la IA con sus marcas `**…**` normalizadas (el render las
   *  pinta como plumón). Null si la fila no trae uno renderizable. */
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
  /** La línea de hallazgo que acompaña a la miniatura: la PRIMERA que muestra el
   *  informe en «Principales hallazgos» (orden de la pirámide, cuatro primeros, en
   *  contra antes que a favor). Va CRUDA: la cifra y la referencia las arma el
   *  cliente con `findingDisplay` + `referenciaHallazgo`, las mismas funciones del
   *  informe — `findingDisplay` vive en un módulo "use client" y desde acá no se
   *  puede llamar. Una sola línea, como en el contrato. */
  hallazgo: Hallazgo | null;
  /** UF con la que el informe formatea este análisis (congelada en la fila). */
  valorUF: number;
  /** «La recomendación de Franco» (card §5 del informe) para este ejemplo. Null
   *  cuando el motor no la arma (no debería pasar con el read path del informe). */
  recomendacion: RecomendacionLanding | null;
}

/** La card §5, ya resuelta por el motor: la bajada (uno por estado), el bloque
 *  determinista que el render dibuja sin decidir nada, y la alternativa de
 *  comunas cuando el estado es «sin salida» y el motor encontró alguna. */
export interface RecomendacionLanding {
  bajada: string;
  bloque: BloqueLoQueHariaYo | null;
  /** «En X o Y un departamento como este sí convendría.» Solo sin salida y solo
   *  si alguna comuna cruza: null es un caso real y ahí no se inventa nada. */
  alternativa: string | null;
  /** Sin mix ni palancas que crucen, o un mix que solo llega al escalón
   *  intermedio (§5: eso no es una recomendación). Mismo criterio que HeroLTR. */
  sinSalida: boolean;
}

export interface DatosLanding {
  /** Avisos activos en `scraped_properties`. */
  avisosActivos: number;
  /** ISO del último scrape (max `scraped_at`). */
  ultimoScrape: string;
  /** Último análisis emitido por una cuenta no interna. */
  ultimoAnalisis: { etiqueta: string; veredicto: Veredicto; comuna: string; createdAt: string } | null;
  ejemplos: EjemploLanding[];
  /** true cuando alguna lectura falló y se usó el respaldo. */
  degradado: boolean;
}

/** Último dato conocido, para que la landing nunca salga vacía si la base no
 *  responde en una revalidación. Es una FOTO de lo que `leerDatosLanding` devolvió
 *  el 11-sep-2026 con el read path del informe; actualizar cuando se toque este
 *  archivo o cambie un ejemplo. */
/** Los tres hallazgos de la foto (uno por ejemplo), tal como los emite el motor. */
const HALLAZGO_RESPALDO: Array<Hallazgo | null> = [
  {
    id: "sobreprecio",
    tipo: "precio_vs_comuna",
    valor: {
      sujetoUfM2: 80,
      medianaComunaUfM2: 48.2,
      desviacionPct: 66,
      sobreprecioUfM2: 31.8,
      banda: 30,
      n: 1403,
      comuna: "Santiago"
    },
    direccion: "adverso",
    decisividad: 0.92,
    magnitudContinua: 0.92,
    procedencia: {
      base: "mediana de precios de PUBLICACIÓN de venta de la comuna (scraped), no transacción",
      confianza: "media"
    },
    titular: "Estás pagando caro el metro para esta comuna.",
    fraseCanonica: "Tu precio por m² (UF 80,0) está 66% sobre la mediana de la comuna (UF 48,2). Estás pagando caro el metro para esta comuna."
  } as Hallazgo,
  {
    id: "flujo_mensual",
    tipo: "aporte_mensual",
    valor: {
      flujoNetoMensualCLP: -283194,
      dividendoMensualCLP: 978290,
      ratioSobreDividendo: 0.29,
      modalidad: "ltr",
      consuelo: "estable"
    },
    direccion: "adverso",
    decisividad: 0.85,
    magnitudContinua: 0.28,
    procedencia: {
      base: "aporte mensual neto sobre tus datos declarados, tras dividendo y todos los gastos operativos",
      confianza: "alta"
    },
    titular: "Pones algo de tu bolsillo cada mes.",
    fraseCanonica: "Tienes que poner $283.194 al mes de tu bolsillo — acotado frente al dividendo, pero recurrente: sale mes a mes, no una sola vez. Sostenible solo si tu flujo lo aguanta sin apuro; eso sí, la plusvalía histórica de la comuna no está para compensarlo."
  } as Hallazgo,
  {
    id: "sobreprecio",
    tipo: "precio_vs_comuna",
    valor: {
      sujetoUfM2: 50,
      medianaComunaUfM2: 101.1,
      desviacionPct: -51,
      sobreprecioUfM2: -51.1,
      banda: 30,
      n: 141,
      comuna: "Ñuñoa"
    },
    direccion: "favorable",
    decisividad: 1,
    magnitudContinua: 1,
    procedencia: {
      base: "mediana de precios de PUBLICACIÓN de venta de la comuna (scraped), no transacción",
      confianza: "media"
    },
    titular: "Entras barato: el metro está bajo la mediana comunal.",
    fraseCanonica: "Tu precio por m² (UF 50,0) está 51% bajo la mediana de la comuna (UF 101,1). Entras barato para esta comuna."
  } as Hallazgo,
];

const RESPALDO = {
  avisosActivos: 44256,
  ultimoScrape: "2026-09-07T06:30:52Z",
  ejemplos: [
    {
      id: EJEMPLOS_LANDING[0].id,
      veredicto: "BUSCAR OTRA" as Veredicto,
      titular: "Pagas **66% sobre la mediana**: el arriendo no alcanza. Busca otra.",
      cifra: { tipo: "monto", caso: "flujo_negativo_ltr", valorClp: 573361, valorUf: 14, signo: -1 } as CifraClave,
      comuna: "Santiago",
      detalle: "2D1B 60 m²",
      score: 30,
      modalidad: "Renta larga",
      valorUF: 40894,
      hallazgo: HALLAZGO_RESPALDO[0],
      recomendacion: {
        bajada: "No hay forma de que este departamento convenga",
        bloque: {
          rotulo: "Franco probó cada cambio por separado · ninguno llega a Comprar",
          contexto: "Llegar a Comprar pediría un 62,3% menos de precio, fuera de todo rango.",
          filas: [],
          mix: null,
          descarte: "Precio, arriendo, plazo y pie, por separado, no alcanzan.",
        },
        alternativa: "En Puente Alto o Quilicura un departamento como este sí convendría.",
        sinSalida: true,
      },
    },
    {
      id: EJEMPLOS_LANDING[1].id,
      veredicto: "AJUSTA SUPUESTOS" as Veredicto,
      titular: "Providencia, pero **el arriendo no cubre la cuota**: hay que negociar fuerte.",
      cifra: { tipo: "monto", caso: "flujo_negativo_ltr", valorClp: 283194, valorUf: 7.1, signo: -1 } as CifraClave,
      comuna: "Providencia",
      detalle: "2D2B 60 m²",
      score: 66,
      modalidad: "Renta larga",
      valorUF: 40001,
      hallazgo: HALLAZGO_RESPALDO[1],
      recomendacion: {
        bajada: "Para que el veredicto pase a Comprar",
        bloque: {
          rotulo: "Franco probó cada cambio por separado · dos llevan a Comprar",
          contexto: null,
          filas: [
            { titulo: "Bajar el precio", rotuloCorto: "Solo el precio", quien: "vendedor", cifra: "−24,1%", objetivo: "$167.004.175" },
            { titulo: "Subir el arriendo", rotuloCorto: "Solo el arriendo", quien: "mercado", cifra: "+25,6%", objetivo: "$1.205.813" },
          ],
          mix: {
            titulo: "Si además mueves lo tuyo, llegas a Comprar",
            movimiento: { pie: { de: 20, a: 30 }, plazo: { de: 25, a: 30 } },
            contraste: { de: "−24,1%", a: "−4,8%" },
            costo: "$18.840.471 más el día uno",
            descuento: "−4,8%",
            sinDescuento: null,
            destino: "COMPRAR" as Veredicto,
          },
          descarte: "Plazo y pie, por separado, no alcanzan.",
        },
        alternativa: null,
        sinSalida: false,
      },
    },
    {
      id: EJEMPLOS_LANDING[2].id,
      veredicto: "COMPRAR" as Veredicto,
      titular: "Compras **muy bajo la mediana** y el arriendo cubre el dividendo desde el inicio.",
      cifra: { tipo: "monto", caso: "comprar_excedente", valorClp: 43810, valorUf: 1.1, signo: 1 } as CifraClave,
      comuna: "Ñuñoa",
      detalle: "2D2B 80 m²",
      score: 70,
      modalidad: "Renta larga",
      valorUF: 40878,
      hallazgo: HALLAZGO_RESPALDO[2],
      recomendacion: {
        bajada: "Cierra al precio pedido",
        bloque: {
          rotulo: "Antes de firmar",
          contexto: null,
          filas: [
            { titulo: "Cuánto aguanta el veredicto", rotuloCorto: "Aguanta", quien: "mercado", cifra: "−6,5%", objetivo: null },
            { titulo: "Verifica el arriendo", rotuloCorto: "Verifica", quien: "tuyo", cifra: "$750.000", objetivo: "lo declaraste tú" },
          ],
          mix: null,
          descarte: null,
        },
        alternativa: null,
        sinSalida: false,
      },
    },
  ] satisfies Array<Omit<EjemploLanding, "etiqueta">>,
};

interface FilaEjemplo {
  id: string;
  comuna: string | null;
  created_at: string;
  input_data: (AnalisisInput & Record<string, unknown>) | null;
  results: FullAnalysisResult | null;
  ai_analysis: (AIAnalysisV2 & { titular?: string | null }) | null;
  mediana_comuna_snapshot: MedianaComunaSnapshot | null;
}

/** `scraped_at` es `timestamp` SIN zona y lo escribe `now()` de Postgres, que
 *  corre en UTC: el string llega sin designador ("2026-09-07T06:30:52.099") y
 *  `new Date` lo leería en la zona del proceso (Chile en local, UTC en Vercel).
 *  Se le fija la Z para que "hoy 03:30" sea 03:30 en todas partes. */
function comoUtc(iso: string | null): string | null {
  if (!iso) return null;
  return /[zZ]$|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`;
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

/** El titular de la IA tal como lo muestra la portada: guard de voz (el
 *  persistido de 17b4e10d trae "Comprás") y marcas normalizadas. Un titular
 *  inválido (montos, >20 palabras, ausente) no se muestra: mejor la banda sola
 *  que una frase que rompe el contrato. */
function titularDe(fila: FilaEjemplo): string | null {
  const crudo = fila.ai_analysis?.titular;
  if (typeof crudo !== "string" || !crudo.trim()) return null;
  const limpio = sanitizeVozChilenaTexto(crudo.trim());
  if (evaluarTitular(limpio).nivel === "invalido") return null;
  return normalizarMarcasTitular(limpio);
}

/** 0 = frena (va arriba), 1 = ayuda o no mueve la aguja. Copia de la regla de
 *  PRESENTACIÓN de `PrincipalesHallazgos` (en contra primero), aplicada sobre los
 *  cuatro primeros del orden único: la primera línea del informe es esta. */
const grupo = (h: Hallazgo): number => (h.direccion === "adverso" ? 0 : 1);

/** La PRIMERA línea de «Principales hallazgos» del informe: el orden de la
 *  pirámide (`ordenarHallazgosPiramide`, fuente única que lee también el prompt
 *  y el PDF), los cuatro primeros, y dentro de ellos en contra antes que a favor.
 *  Cruda: el cliente la formatea con las funciones del informe. */
function lineaDe(results: FullAnalysisResult | null, ai: AIAnalysisV2 | null): Hallazgo | null {
  const top = ordenarHallazgosPiramide(results, ai).slice(0, 4);
  const enOrden = [...top].sort((a, b) => grupo(a) - grupo(b));
  const h = enOrden[0];
  return h && typeof h.titular === "string" && h.titular.trim() ? h : null;
}

/** La card §5 del informe para este ejemplo: el MISMO modelo puro que usa HeroLTR
 *  (`construirLoQueHariaYo` + `bajadaRecomendacion`), en pesos, y la alternativa de
 *  comunas solo en el estado sin salida — son 23 corridas del motor, baratas pero no
 *  gratis, y en cualquier otro estado la card ya tiene qué decir. */
function recomendacionDe(p: {
  veredicto: Veredicto;
  hallazgos: Hallazgo[] | undefined;
  input: AnalisisInput | null;
  uf: number;
  asOf: Date;
}): RecomendacionLanding | null {
  const distancia = (p.hallazgos?.find((h) => h.id === "distancia_veredicto") as HallazgoDistanciaVeredicto | undefined) ?? null;
  const sensibilidad = (p.hallazgos?.find((h) => h.id === "sensibilidad") as HallazgoSensibilidad | undefined) ?? null;
  const bloque = construirLoQueHariaYo({
    veredicto: p.veredicto,
    distancia,
    sensibilidad,
    arriendoDeclaradoCLP: Number(p.input?.arriendo ?? 0),
    currency: "CLP",
    valorUF: p.uf,
  });
  if (!bloque && p.veredicto === "COMPRAR") return null;
  const mix = bloque?.mix ?? null;
  const sinSalida = p.veredicto !== "COMPRAR" && (mix ? mix.destino !== "COMPRAR" : (bloque?.filas.length ?? 0) === 0);
  const alternativa =
    sinSalida && p.input
      ? lineaAlternativaComunas(construirAlternativaComunas({ input: p.input, ufClp: p.uf, asOf: p.asOf }))
      : null;
  return { bajada: bajadaRecomendacion(p.veredicto, bloque), bloque, alternativa, sinSalida };
}

/** Un ejemplo, leído COMO LO LEE EL INFORME: `results` se recomputa en memoria con
 *  el motor vivo, la UF congelada de la fila, la mediana comunal (snapshot o
 *  prefetch) y la fecha de creación. Si el recompute falla, se cae a lo persistido
 *  y se avisa: la landing no se rompe, pero el reporte de Sentry dice que ese
 *  ejemplo no es lo que el informe muestra. */
async function ejemploDe(sb: SupabaseClient, fila: FilaEjemplo, ufLive: number, aviso: (que: string, e: unknown) => void): Promise<EjemploLanding | null> {
  const input = fila.input_data;
  const uf = resolveUfForAnalysis(fila.results, input, ufLive, fila.id);
  const asOf = new Date(fila.created_at);
  let results: FullAnalysisResult | null = fila.results;
  if (input) {
    try {
      const snap = fila.mediana_comuna_snapshot;
      const medianaComuna = snap != null ? { mediana: snap.mediana, n: snap.n ?? 0 } : await prefetchMedianaComunaVenta(sb, input, uf);
      results = recomputeResultsForLegacy(input, uf, medianaComuna, asOf);
    } catch (e) {
      aviso("recompute_" + fila.id.slice(0, 8), e);
      results = fila.results;
    }
  }
  const veredicto = readVeredicto(results as Parameters<typeof readVeredicto>[0]);
  if (!veredicto || !results) return null;
  const metrics = (results.metrics ?? null) as { flujoNetoMensual?: number } | null;
  const hallazgos = results.hallazgos;
  const distancia = (hallazgos?.find((h) => h.id === "distancia_veredicto") as HallazgoDistanciaVeredicto | undefined) ?? null;
  const cifra = metrics
    ? derivarCifraClaveLtr({
        veredicto,
        flujoNetoMensual: metrics.flujoNetoMensual ?? NaN,
        distancia,
        ufValue: uf,
      })
    : null;
  return {
    id: fila.id,
    veredicto,
    etiqueta: etiquetaVeredicto(veredicto, "banda"),
    titular: titularDe(fila),
    cifra,
    comuna: fila.comuna || (input?.comuna as string) || "",
    detalle: detalleDe(input),
    score: Number.isFinite(Number(results.score)) ? Number(results.score) : null,
    // Los tres ejemplos son LTR (EJEMPLOS_LANDING); si algún día entra un STR, el
    // rótulo sale de su modalidad y no de una constante.
    modalidad: "Renta larga",
    hallazgo: lineaDe(results, fila.ai_analysis),
    valorUF: uf,
    recomendacion: recomendacionDe({ veredicto, hallazgos, input, uf, asOf }),
  };
}

function ejemplosRespaldo(): EjemploLanding[] {
  return RESPALDO.ejemplos.map((e) => ({ ...e, etiqueta: etiquetaVeredicto(e.veredicto, "banda") }));
}

export async function leerDatosLanding(): Promise<DatosLanding> {
  let degradado = false;
  const aviso = (que: string, error: unknown) => {
    degradado = true;
    captureApiWarning(error, { ruta: "GET / (landing-vivo)", operacion: que });
  };

  const sb = createServiceClient();

  const [conteo, scrape, ultimo, filas, ufLive] = await Promise.all([
    sb.from("scraped_properties").select("*", { count: "exact", head: true }).eq("is_active", true)
      .then((r) => (r.error ? (aviso("conteo", r.error), null) : r.count)),
    sb.from("scraped_properties").select("scraped_at").order("scraped_at", { ascending: false }).limit(1).maybeSingle()
      .then((r) => (r.error ? (aviso("ultimo_scrape", r.error), null) : comoUtc(r.data?.scraped_at as string | null))),
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
    sb.from("analisis").select("id, comuna, created_at, input_data, results, ai_analysis, mediana_comuna_snapshot").in("id", EJEMPLOS_LANDING.map((e) => e.id))
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
    if (ejemplos.length === 0) ejemplos = ejemplosRespaldo();
  } else {
    ejemplos = ejemplosRespaldo();
  }

  return {
    avisosActivos: conteo ?? RESPALDO.avisosActivos,
    ultimoScrape: scrape ?? RESPALDO.ultimoScrape,
    ultimoAnalisis: ultimo,
    ejemplos,
    degradado,
  };
}
