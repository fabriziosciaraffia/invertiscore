// /dev/invierte-v2/resultado (18-nov-2026): el resultado y la elección con datos de muestra, para medir la tabla del PC con el
// máximo de columnas (el de entrada + 6 activos = 7) y nombres y montos largos, sin cuentas ni escrituras. ?n=5|6|7 columnas.
// Gate en el servidor: dev y previews de Vercel sí; producción, 404.
import { notFound } from "next/navigation";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { ResultadoOpciones } from "@/components/invierte-v2/ResultadoOpciones";
import { RESULTADO_COPY, type Etiqueta, type OpcionDepto } from "@/lib/invierte-v2/opciones";

export const dynamic = "force-dynamic";

const op = (id: string, o: Partial<OpcionDepto>): OpcionDepto => ({
  avisoId: id, comuna: "Ñuñoa", dormitorios: 2, banos: 2, m2: 58, precioUF: 3000, veredicto: "COMPRAR", score: 80, flujoCLP: 50000,
  arriendoCLP: 520000, vsParecidosPct: null, metro: { estacion: "Ñuñoa", metros: 450 }, esEntrada: false, alcanza: true, ...o,
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

export default function ResultadoDemo({ searchParams }: { searchParams: { n?: string } }) {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") notFound();
  const n = Math.min(7, Math.max(2, Number(searchParams.n) || 7));
  const opciones = MUESTRA.slice(0, n);
  return (
    <MarcoInvierte volver={null} pantalla="opciones" layout="contenido" cabecera={RESULTADO_COPY.rotulo} pc={{ sesionEmail: "muestra@ejemplo.cl" }}>
      <ResultadoOpciones
        caso="alcanza" opciones={opciones} etiquetas={ETIQUETAS} elegidos={opciones.filter((o) => o.avisoId !== "e").map((o) => o.avisoId).slice(0, 6)}
        tope={{ topeUF: 3500, fuente: "renta", limita: "pie", creditoUF: 2900, porPieUF: 3500, menosPreciso: false }}
        pieUF={700} masBaratoUF={null} objetivo="arriendo" preocupaciones={["poner_plata"]} comunas={["Pedro Aguirre Cerda", "Estación Central"]}
      />
    </MarcoInvierte>
  );
}
