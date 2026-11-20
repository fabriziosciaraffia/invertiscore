// /dev/invierte-v2/resultado (18-nov-2026; láminas del 19-nov-2026): el resultado y la elección con datos de muestra, para medir
// el elegido y las alternativas (como mucho tres) con nombres y montos largos, sin cuentas ni escrituras. ?n=1..4 deptos;
// ?nivel=cerca|tres_km|comuna|perfil y ?donde=cerca|comuna|convenga; ?caso=2&z=UF el caso 2 con el más barato en z. Sin fotos
// (la ruta de fotos pide una orden firmada): la tarjeta sin foto, sin hueco.
// ?ids=uuid,uuid,… (20-nov-2026): los deptos de muestra toman esos avisos reales —en orden: el elegido y las alternativas— para ver
// sus fotos guardadas y sus lecturas de «Lo que ve Franco» (las fotos pasan por la ruta propia, que pide una orden firmada).
// Gate en el servidor: dev y previews de Vercel sí; producción, 404.
import { notFound } from "next/navigation";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { ResultadoOpciones } from "@/components/invierte-v2/ResultadoOpciones";
import { RESULTADO_COPY, type Etiqueta, type OpcionDepto } from "@/lib/invierte-v2/opciones";
import { esNivel, MAX_RECOMENDADOS } from "@/lib/invierte-v2/alternativas";
import { DONDES, type Donde } from "@/lib/invierte-v2/perfil";
import type { LecturaFranco } from "@/lib/invierte-v2/lectura-franco";
import { createServiceClient } from "@/lib/supabase/service";
import { fotosDe } from "@/lib/invierte-v2/fotos-servidor";
import { leerLecturas } from "@/lib/invierte-v2/lectura-franco-servidor";

// ?lectura=1 (entrega 4): lecturas de EJEMPLO para medir el dibujo —el elegido con «revisar» arriba, una alternativa normal y una
// grave, que no se recomienda y desaparece—. Los textos son de muestra, no de un depto real.
const LECTURAS: Record<string, LecturaFranco> = {
  e: { alerta: { nivel: "revisar", motivo: "Las fotos no muestran los baños: pídelas antes de ofertar." }, larga: [], corta: ["Las fotos no muestran los baños: pídelas antes de ofertar.", "Cocina y piso renovados: se arrienda tal como está.", "Metro a pie: demanda de arriendo estable."] },
  a: { alerta: { nivel: "ninguna", motivo: null }, larga: [], corta: ["Cocina original: calcula una remodelación, y es argumento para negociar."] },
  b: { alerta: { nivel: "grave", motivo: "Según la publicación, es para remodelar." }, larga: [], corta: ["Según la publicación, es para remodelar."] },
};

export const dynamic = "force-dynamic";

const op = (id: string, o: Partial<OpcionDepto>): OpcionDepto => ({
  avisoId: id, comuna: "Ñuñoa", dormitorios: 2, banos: 2, m2: 58, precioUF: 3000, veredicto: "COMPRAR", score: 80, flujoCLP: 50000,
  arriendoCLP: 520000, vsParecidosPct: null, metro: { estacion: "Ñuñoa", metros: 450 }, esEntrada: false, alcanza: true, capRatePct: 5.8, ...o,
});

const MUESTRA: OpcionDepto[] = [
  op("e", { esEntrada: true, comuna: "Pedro Aguirre Cerda", precioUF: 3250, score: 78, flujoCLP: -62000, m2: 61 }),
  op("a", { comuna: "Estación Central", precioUF: 2980, score: 77, flujoCLP: 138830, metro: { estacion: "Universidad de Santiago", metros: 1240 } }),
  op("b", { comuna: "San Miguel", precioUF: 3090, score: 88, flujoCLP: 21000, vsParecidosPct: -43 }),
  op("c", { comuna: "La Cisterna", precioUF: 2640, score: 76, flujoCLP: 9000, dormitorios: 3, m2: 72 }),
  op("d", { comuna: "Independencia", precioUF: 3310, score: 81, flujoCLP: -120500, vsParecidosPct: -21 }),
  op("x", { comuna: "Quinta Normal", precioUF: 3190, score: 74, flujoCLP: 4000 }),
  op("y", { comuna: "Lo Prado", precioUF: 4100, score: 79, flujoCLP: -9000, alcanza: false }),
];
const ETIQUETAS: Record<string, Etiqueta> = { e: "el_que_elegiste", a: "menos_al_mes", b: "mejor_puntaje", c: "pie_mas_bajo", d: "mejor_precio" };

export default async function ResultadoDemo({ searchParams }: { searchParams: { n?: string; caso?: string; z?: string; nivel?: string; donde?: string; lectura?: string; mezcla?: string; ids?: string } }) {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") notFound();
  const n = Math.min(1 + MAX_RECOMENDADOS, Math.max(1, Number(searchParams.n) || 1 + MAX_RECOMENDADOS));
  const nivel = esNivel(searchParams.nivel) ? searchParams.nivel : "cerca";
  const donde: Donde = (DONDES as readonly string[]).includes(searchParams.donde ?? "") ? (searchParams.donde as Donde) : "cerca";
  const distancias: Record<string, number> = donde === "convenga" ? { a: 12300, b: 8600, c: 4100 } : { a: 420, b: 690, c: 1800 };
  const reales = (searchParams.ids ?? "").split(",").map((x) => x.trim()).filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, n);
  const ids = MUESTRA.slice(0, n).map((o, k) => reales[k] ?? o.avisoId);
  const muestraId = (x: string) => reales[MUESTRA.findIndex((o) => o.avisoId === x)] ?? x;
  const opciones = MUESTRA.slice(0, n).map((o, k) => ({ ...o, avisoId: ids[k] }));
  const admin = reales.length ? createServiceClient() : null;
  const [fotosReales, lecturasReales] = admin ? await Promise.all([fotosDe(admin, reales), leerLecturas(admin, reales)]) : [{}, {}];
  const porId = <T,>(r: Record<string, T>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [muestraId(k), v]));
  return (
    <MarcoInvierte volver={null} pantalla="opciones" layout="contenido" cabecera={RESULTADO_COPY.rotulo} pc={{ sesionEmail: "muestra@ejemplo.cl" }}>
      <ResultadoOpciones
        caso={searchParams.caso === "2" ? "caso2" : "alcanza"} opciones={searchParams.caso === "2" ? [{ ...opciones[0], alcanza: false }] : opciones} etiquetas={porId(ETIQUETAS)} elegidos={opciones.filter((o) => !o.esEntrada).map((o) => o.avisoId).slice(0, 1)}
        tope={{ topeUF: 3500, fuente: "renta", limita: "pie", creditoUF: 2900, porPieUF: 3500, menosPreciso: false }}
        pieUF={700} masBaratoUF={searchParams.z ? Number(searchParams.z) : null} objetivo="arriendo" preocupaciones={["poner_plata"]} comunas={["Pedro Aguirre Cerda", "Estación Central"]}
        nivel={n > 1 ? nivel : "solo_elegido"} donde={donde} distancias={porId(distancias)} niveles={porId(nivel === "cerca" && searchParams.mezcla === "1" ? { a: "cerca", b: "cerca", c: "tres_km" } : { a: nivel, b: nivel, c: nivel })} fotos={fotosReales} lecturas={reales.length ? lecturasReales : searchParams.lectura === "1" ? LECTURAS : {}}
      />
    </MarcoInvierte>
  );
}
