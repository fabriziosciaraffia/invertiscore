// /dev/invierte-v2/base (19-nov-2026, entrega 2): la base completa y «Perfil actualizado» con datos de muestra, para revisar en
// pantalla lo que la cuenta de prueba no tiene (la línea de lo que cambió en la publicación, seis deptos activos con «¿Cuál
// dejas?», nombres y montos largos, «Escribirle» con número), sin cuentas ni escrituras.
//   ?vista=base (por defecto) | seis | actualizado
// Gate en el servidor: dev y previews de Vercel sí; producción, 404.
import { notFound } from "next/navigation";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { VistaBase } from "@/components/invierte-v2/VistaBase";
import { VistaActualizado } from "@/components/invierte-v2/VistaActualizado";
import { ACTUALIZADO_COPY, BASE_COPY } from "@/lib/invierte-v2/base";
import { lineaCambio } from "@/lib/invierte-v2/cambios";
import { ordenBase } from "@/lib/invierte-v2/depto-flujo";
import type { Base, DatosDepto, PerfilActualizado } from "@/lib/invierte-v2/base-servidor";
import type { OrdenInv } from "@/lib/invierte-v2/servidor";
import type { PerfilInv } from "@/lib/invierte-v2/perfil-servidor";
import type { FichaDepto } from "@/lib/invierte-v2/ficha-depto-servidor";
import type { LecturaFranco } from "@/lib/invierte-v2/lectura-franco";
import { tituloDepto } from "@/lib/invierte-v2/titulo-depto";

export const dynamic = "force-dynamic";

const dep = (comuna: string, o: Partial<DatosDepto> = {}): DatosDepto => ({ comuna, dormitorios: 2, banos: 2, m2: 58, precioUF: 3250, veredicto: "COMPRAR", score: 78, flujoCLP: 52000, ...o });
const HOY = "2026-11-20";
// La ficha de cada tarjeta (etapa 3, parte A): calles y metros de muestra, una sin calle (queda el metro), una sin calle ni metro
// cerca (queda la comuna) y una con calle larga; sin fotos (la ruta de fotos no sirve datos de muestra).
const lec = (sintesis: string, alerta: string | null = null): LecturaFranco => ({ alerta: alerta ? { nivel: "revisar", motivo: alerta } : { nivel: "ninguna", motivo: null }, larga: [], corta: [sintesis, "Segunda línea.", "Tercera línea."] });
const fic = (calle: string | null, estacion: string | null, metros: number, comuna: string, cap: number | null, l: LecturaFranco | null, fotos = 0): FichaDepto => {
  const metro = estacion ? { estacion, metros } : null;
  return { titulo: tituloDepto({ calle, metro, comuna }), metro, comuna, fotos, capRatePct: cap, lectura: l && calle ? { ...l, calle } : l,
    cifras: { publicadoUF: null, arriendoCLP: null, capRatePct: cap, flujoCLP: null, pocosComparables: false } };
};
const L = (tipo: Parameters<typeof lineaCambio>[0]["tipo"], antes: Record<string, unknown>, despues: Record<string, unknown>) => lineaCambio({ tipo, antes, despues }, HOY)!;

const ELEGIDOS: Omit<Base["elegidos"][number], "alMesEnCambio" | "etapa" | "noAvanzaMotivo" | "oferta" | "numeroConfirmado">[] = [
  // m1 y o1 con fotos de deptos reales (solo se ven con la sesión de quien firmó la orden, como la cuenta de QA).
  { avisoId: "50abb999-65ed-4148-b907-ec7601db8083", alcanza: true, preparado: true, datos: dep("Pedro Aguirre Cerda", { m2: 61, precioUF: 2850, flujoCLP: 52000 }),
    lineas: [L("precio_baja", { precioUF: 3000 }, { precioUF: 2850 }), L("veredicto", { veredicto: "AJUSTA SUPUESTOS" }, { veredicto: "COMPRAR" }), L("al_mes", {}, { flujoCLP: 52000 })],
    origen: "entrada", ficha: fic("Dublé Almeyda", "Lo Valledor", 640, "Pedro Aguirre Cerda", 4.7, lec("Te sobran $52.000 al mes, y cocina y baños están renovados: se arrienda tal como está."), 3) },
  { avisoId: "m2", alcanza: true, preparado: true, datos: dep("Estación Central", { precioUF: 3310, flujoCLP: -120500, score: 81 }),
    lineas: [L("precio_sube", { precioUF: 3180 }, { precioUF: 3310 }), L("al_mes", {}, { flujoCLP: -120500 })],
    origen: "franco", ficha: fic("Avenida Libertador Bernardo O'Higgins", "Universidad de Santiago", 300, "Estación Central", 5.0, lec("Cap rate de 5,0 %, pero la cocina es original: parte de esa ventaja se va en dejarlo arrendable.", "La publicación dice 58 m² y el plano muestra 49.")) },
  { avisoId: "m3", alcanza: false, preparado: true, datos: dep("Independencia", { precioUF: 3720, flujoCLP: -9000 }), lineas: [L("despublicado", {}, {})], origen: "mapa", ficha: fic(null, "Cal y Canto", 820, "Independencia", null, null) },
  { avisoId: "m4", alcanza: true, preparado: true, datos: dep("San Miguel", { dormitorios: 3, m2: 72, precioUF: 3090, score: 88 }), lineas: [L("republicado", {}, {})], origen: "franco", ficha: fic(null, null, 0, "San Miguel", 5.4, lec("Tres dormitorios para arrendar por pieza: en las fotos se ve todo en orden.")) },
  { avisoId: "m5", alcanza: true, preparado: true, datos: dep("La Cisterna", { dormitorios: 1, banos: 1, m2: 40, precioUF: 2640 }), lineas: [], origen: "franco", ficha: fic("Gran Avenida", "Lo Ovalle", 450, "La Cisterna", 5.2, lec("Uno más uno chico, fácil de arrendar.")) },
  { avisoId: "m6", alcanza: true, preparado: true, datos: dep("Quinta Normal", { precioUF: 3190, flujoCLP: 4000 }), lineas: [], origen: "franco", ficha: fic("Carrascal", "Quinta Normal", 900, "Quinta Normal", 5.6, null) },
];
const OTRAS: Base["otras"] = [
  { avisoId: "43b61f12-f529-4aea-9fd5-56e841f492c7", datos: dep("Ñuñoa", { m2: 55, precioUF: 3090, score: 81 }), ficha: fic("Av. Grecia", "Estadio Nacional", 500, "Ñuñoa", 5.1, lec("Cap rate de 5,1 % y viene amoblado y en buen estado: listo para arrendar."), 3) },
  { avisoId: "o2", datos: dep("San Miguel", { banos: 1, m2: 52, precioUF: 2640, score: 76 }), ficha: fic("Simón Bolívar", "El Llano", 700, "San Miguel", 4.8, lec("Pide fotos del baño antes de ofertar.", "La publicación dice 56 m² y el plano muestra 49.")) },
];

// Etapa 3, B1: una etapa distinta por tarjeta, para ver cada línea de estado.
// Segunda vuelta (23-nov, lámina 3.3): los tres niveles a la vez — «Te toca a ti» (listo, por ofertar), «En curso» (oferta presentada,
// día 2 de 5) y «Recién partiendo» (confirmando); con ?vista=seis, además en firme sin visita, sin preaprobación y no avanza.
// Las cuatro cifras de muestra (23-nov-2026): el publicado y el flujo del depto, y el arriendo que da ese cap rate a la UF de muestra.
// La tercera tarjeta lleva la marca de pocos arriendos comparables.
const UF_MUESTRA = 40000;
[...ELEGIDOS, ...OTRAS].forEach((e, i) => {
  if (!e.ficha) return;
  const cap = e.ficha.capRatePct;
  const precio = e.datos.precioUF ?? null;
  e.ficha.cifras = { publicadoUF: precio, arriendoCLP: cap != null && precio ? Math.round((cap / 100) * precio * UF_MUESTRA / 12 / 1000) * 1000 : null, capRatePct: cap, flujoCLP: e.datos.flujoCLP ?? null, pocosComparables: i === 2 };
});
const ETAPAS_MUESTRA: Base["elegidos"][number]["etapa"][] = ["confirmando", "listo", "listo", "en_firme", "sin_preaprobacion", "no_avanza"];
const AYER = new Date(Date.now() - 864e5 * 1.2).toISOString();
const OFERTAS_MUESTRA: (Base["elegidos"][number]["oferta"])[] = [null, { estado: "borrador", pisoUF: 3145, altoUF: 3212 }, { estado: "presentada", pisoUF: 3600, altoUF: 3680, montoUF: 3620, presentadaAt: AYER }, { estado: "en_firme", pisoUF: 2950, altoUF: 3010, montoUF: 2990, enFirmeComo: "sin_visitar" }, null, null];
// El de la etapa «listo» con su rango (rediseño del 23-nov, lámina 3.3): la tarjeta se levanta, dice «Haz tu oferta» y va primera.
const conAlMes = (e: Omit<Base["elegidos"][number], "alMesEnCambio" | "etapa" | "noAvanzaMotivo" | "oferta" | "numeroConfirmado">, i: number): Base["elegidos"][number] => ({ ...e, alMesEnCambio: e.lineas.some((l) => /al mes$/.test(l)), etapa: ETAPAS_MUESTRA[i] ?? "confirmando", noAvanzaMotivo: null, oferta: OFERTAS_MUESTRA[i] ?? null, numeroConfirmado: OFERTAS_MUESTRA[i] ? "1250" : null });

export default function BaseDemo({ searchParams }: { searchParams: { vista?: string; pre?: string } }) {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") notFound();
  if (searchParams.vista === "actualizado") {
    const r: PerfilActualizado = {
      cambio: { antes: { pieUF: 700, rentaCLP: 2000000, otrasCuotasCLP: 0, comunas: ["Ñuñoa", "Macul"], topeUF: 3500, montoPreaprobadoUF: null }, despues: { pieUF: 900, rentaCLP: 2000000, otrasCuotasCLP: 0, comunas: ["Ñuñoa", "Macul"], topeUF: 3900, montoPreaprobadoUF: null }, at: HOY, deptos: [] },
      topeUF: 3900, siguen: 4,
      entran: [{ avisoId: "n1", datos: dep("Ñuñoa", { dormitorios: 3, m2: 68, precioUF: 3790, score: 82 }) }, { avisoId: "n2", datos: dep("Providencia", { dormitorios: 1, banos: 1, m2: 40, precioUF: 3640, score: 79 }) }],
      fuera: [],
    };
    return (
      <MarcoInvierte volver={null} pantalla="perfil-actualizado" layout="formulario" cabecera={ACTUALIZADO_COPY.cabecera} pc={{ sesionEmail: "muestra@ejemplo.cl" }}>
        <VistaActualizado r={r} />
      </MarcoInvierte>
    );
  }
  const seis = searchParams.vista === "seis";
  const pre: Base["preaprobacion"] = searchParams.pre === "corregir" ? "por_corregir" : searchParams.pre === "aprobada" || searchParams.pre === "aprobada-revision" ? "aprobada" : searchParams.pre === "revision" ? "en_revision" : "subir";
  const base: Base = {
    orden: { id: "o", nombre: "María José Fernández Valdivieso", firmadoAt: "2026-11-15T15:00:00Z" } as OrdenInv,
    perfil: { topeUF: 3500, comunas: ["Pedro Aguirre Cerda", "Estación Central", "Independencia"] } as PerfilInv,
    elegidos: ordenBase((seis ? ELEGIDOS : ELEGIDOS.slice(0, 4)).map(conAlMes), pre), otras: OTRAS, whatsapp: "+56912345678",
    preaprobacion: pre,
    // ?pre=subir|revision|corregir|aprobada|aprobada-revision (20-nov-2026): las formas de «Lo que te toca hoy» y la línea de capacidad.
    preDetalle: {
      motivo: searchParams.pre === "corregir" ? "La imagen está cortada y no se ve el monto aprobado. Súbela completa, por favor." : null,
      banco: searchParams.pre?.startsWith("aprobada") ? "Santander" : null, vigenteHasta: searchParams.pre?.startsWith("aprobada") ? "2027-01-15" : null,
      mime: "application/pdf", otra: searchParams.pre === "aprobada-revision" ? { estado: "en_revision", mime: "image/jpeg" } : null,
    },
  };
  return (
    <MarcoInvierte volver={null} pantalla="base" layout="contenido" cabecera={BASE_COPY.hola("María José")} pc={{ sesionEmail: "muestra@ejemplo.cl" }}>
      <VistaBase base={base} />
    </MarcoInvierte>
  );
}
