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
//    (pasando por el guard de voz, igual que el informe) y la cifra con su
//    caption de `derivarCifraClaveLtr` (catálogo cerrado). Los textos del mockup
//    eran placeholders y no viven en el código.
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase/service";
import { filtroNoTest, getTestAccountIds } from "@/lib/admin-rpc";
import { readVeredicto } from "@/lib/results-helpers";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { derivarCifraClaveLtr, type CifraClave } from "@/lib/cifra-clave";
import { sanitizeVozChilenaTexto } from "@/lib/voz-chilena";
import { evaluarTitular, normalizarMarcasTitular } from "@/lib/prosa-marcas";
import { getUFValue, resolveUfForAnalysis } from "@/lib/uf";
import { captureApiWarning } from "@/lib/observabilidad";
import type { HallazgoDistanciaVeredicto, Veredicto } from "@/lib/types";

/** Los tres análisis reales que rotan en "La respuesta, en fácil" (contrato v14).
 *  Orden fijo BUSCAR OTRO → AJUSTAR → COMPRAR: es el orden de la lectura, no
 *  el de la base. Si uno de los tres deja de existir, la sección muestra los
 *  que queden (nunca inventa uno). */
export const EJEMPLOS_LANDING: ReadonlyArray<{ id: string; veredictoEsperado: Veredicto }> = [
  { id: "af7241e3-c148-4a04-b5b0-d5a42b128812", veredictoEsperado: "BUSCAR OTRA" }, // Santiago · estudio 38 m²
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
  /** "Santiago · Estudio 38 m² · UF 3.529 · análisis real" */
  eyebrow: string;
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
 *  responde en una revalidación. Actualizar cuando se toque este archivo. */
const RESPALDO = {
  avisosActivos: 44256,
  ultimoScrape: "2026-09-07T06:30:52Z",
  ejemplos: [
    {
      id: EJEMPLOS_LANDING[0].id,
      veredicto: "BUSCAR OTRA" as Veredicto,
      titular: "Este depto no conviene: **el arriendo no cubre la cuota ni a tasa cero**.",
      cifra: { tipo: "monto", caso: "flujo_negativo_ltr", valorClp: 256149, valorUf: 6.8, signo: -1 } as CifraClave,
      eyebrow: "Santiago · Estudio 38 m² · UF 3.529 · análisis real",
    },
    {
      id: EJEMPLOS_LANDING[1].id,
      veredicto: "AJUSTA SUPUESTOS" as Veredicto,
      titular: "Buen depto, pero **el arriendo no cubre la cuota**: ajusta los supuestos.",
      cifra: { tipo: "monto", caso: "flujo_negativo_ltr", valorClp: 283194, valorUf: 7.1, signo: -1 } as CifraClave,
      eyebrow: "Providencia · 2D2B 60 m² · UF 5.500 · análisis real",
    },
    {
      id: EJEMPLOS_LANDING[2].id,
      veredicto: "COMPRAR" as Veredicto,
      titular: "Compras **muy bajo la mediana** y el arriendo cubre el dividendo desde el inicio.",
      cifra: { tipo: "monto", caso: "comprar_excedente", valorClp: 43810, valorUf: 1.1, signo: 1 } as CifraClave,
      eyebrow: "Ñuñoa · 2D2B 80 m² · UF 4.000 · análisis real",
    },
  ],
};

interface FilaEjemplo {
  id: string;
  comuna: string | null;
  input_data: Record<string, unknown> | null;
  results: Record<string, unknown> | null;
  ai_analysis: { titular?: string | null } | null;
}

/** `scraped_at` es `timestamp` SIN zona y lo escribe `now()` de Postgres, que
 *  corre en UTC: el string llega sin designador ("2026-09-07T06:30:52.099") y
 *  `new Date` lo leería en la zona del proceso (Chile en local, UTC en Vercel).
 *  Se le fija la Z para que "hoy 03:30" sea 03:30 en todas partes. */
function comoUtc(iso: string | null): string | null {
  if (!iso) return null;
  return /[zZ]$|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`;
}

function fmtUF(n: number): string {
  return `UF ${Math.round(n).toLocaleString("es-CL")}`;
}

/** "Estudio" / "2D2B" desde dormitorios y baños del input. */
function tipologia(input: Record<string, unknown> | null): string | null {
  const d = Number(input?.dormitorios);
  const b = Number(input?.banos);
  if (!Number.isFinite(d)) return null;
  if (d === 0) return "Estudio";
  return Number.isFinite(b) && b > 0 ? `${d}D${b}B` : `${d}D`;
}

function eyebrowDe(fila: FilaEjemplo): string {
  const input = fila.input_data;
  const partes = [fila.comuna || (input?.comuna as string) || ""];
  const tipo = tipologia(input);
  const m2 = Number(input?.superficie);
  const desc = [tipo, Number.isFinite(m2) && m2 > 0 ? `${Math.round(m2)} m²` : null].filter(Boolean).join(" ");
  if (desc) partes.push(desc);
  const precio = Number(input?.precio);
  if (Number.isFinite(precio) && precio > 0) partes.push(fmtUF(precio));
  partes.push("análisis real");
  return partes.filter(Boolean).join(" · ");
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

function ejemploDe(fila: FilaEjemplo, ufLive: number): EjemploLanding | null {
  const veredicto = readVeredicto(fila.results as Parameters<typeof readVeredicto>[0]);
  if (!veredicto) return null;
  const metrics = (fila.results?.metrics ?? null) as { flujoNetoMensual?: number; precioCLP?: number } | null;
  const hallazgos = (fila.results?.hallazgos ?? []) as { id: string }[];
  const distancia =
    (hallazgos.find((h) => h.id === "distancia_veredicto") as HallazgoDistanciaVeredicto | undefined) ?? null;
  const uf = resolveUfForAnalysis(
    { metrics: { precioCLP: metrics?.precioCLP ?? null } },
    { precio: Number(fila.input_data?.precio) || null },
    ufLive,
    fila.id,
  );
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
    eyebrow: eyebrowDe(fila),
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
    sb.from("analisis").select("id, comuna, input_data, results, ai_analysis").in("id", EJEMPLOS_LANDING.map((e) => e.id))
      .then((r) => (r.error ? (aviso("ejemplos", r.error), null) : (r.data as FilaEjemplo[]))),
    getUFValue(),
  ]);

  let ejemplos: EjemploLanding[];
  if (filas) {
    const porId = new Map(filas.map((f) => [f.id, f]));
    ejemplos = EJEMPLOS_LANDING.map((e) => {
      const fila = porId.get(e.id);
      const ej = fila ? ejemploDe(fila, ufLive) : null;
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
    }).filter((e): e is EjemploLanding => e !== null);
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
