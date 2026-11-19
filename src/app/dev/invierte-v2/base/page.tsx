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
import type { Base, DatosDepto, PerfilActualizado } from "@/lib/invierte-v2/base-servidor";
import type { OrdenInv } from "@/lib/invierte-v2/servidor";
import type { PerfilInv } from "@/lib/invierte-v2/perfil-servidor";

export const dynamic = "force-dynamic";

const dep = (comuna: string, o: Partial<DatosDepto> = {}): DatosDepto => ({ comuna, dormitorios: 2, banos: 2, m2: 58, precioUF: 3250, veredicto: "COMPRAR", score: 78, flujoCLP: 52000, ...o });
const HOY = "2026-11-20";
const L = (tipo: Parameters<typeof lineaCambio>[0]["tipo"], antes: Record<string, unknown>, despues: Record<string, unknown>) => lineaCambio({ tipo, antes, despues }, HOY)!;

const ELEGIDOS: Omit<Base["elegidos"][number], "alMesEnCambio">[] = [
  { avisoId: "m1", alcanza: true, preparado: true, datos: dep("Pedro Aguirre Cerda", { m2: 61, precioUF: 2850, flujoCLP: 52000 }),
    lineas: [L("precio_baja", { precioUF: 3000 }, { precioUF: 2850 }), L("veredicto", { veredicto: "AJUSTA SUPUESTOS" }, { veredicto: "COMPRAR" }), L("al_mes", {}, { flujoCLP: 52000 })] },
  { avisoId: "m2", alcanza: true, preparado: true, datos: dep("Estación Central", { precioUF: 3310, flujoCLP: -120500, score: 81 }),
    lineas: [L("precio_sube", { precioUF: 3180 }, { precioUF: 3310 }), L("al_mes", {}, { flujoCLP: -120500 })] },
  { avisoId: "m3", alcanza: false, preparado: true, datos: dep("Independencia", { precioUF: 3720, flujoCLP: -9000 }), lineas: [L("despublicado", {}, {})] },
  { avisoId: "m4", alcanza: true, preparado: true, datos: dep("San Miguel", { dormitorios: 3, m2: 72, precioUF: 3090, score: 88 }), lineas: [L("republicado", {}, {})] },
  { avisoId: "m5", alcanza: true, preparado: true, datos: dep("La Cisterna", { dormitorios: 1, banos: 1, m2: 40, precioUF: 2640 }), lineas: [] },
  { avisoId: "m6", alcanza: true, preparado: true, datos: dep("Quinta Normal", { precioUF: 3190, flujoCLP: 4000 }), lineas: [] },
];
const OTRAS: Base["otras"] = [
  { avisoId: "o1", datos: dep("Ñuñoa", { m2: 55, precioUF: 3090, score: 81 }) },
  { avisoId: "o2", datos: dep("San Miguel", { banos: 1, m2: 52, precioUF: 2640, score: 76 }) },
];

const conAlMes = (e: Omit<Base["elegidos"][number], "alMesEnCambio">): Base["elegidos"][number] => ({ ...e, alMesEnCambio: e.lineas.some((l) => /al mes$/.test(l)) });

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
  const base: Base = {
    orden: { id: "o", nombre: "María José Fernández Valdivieso", firmadoAt: "2026-11-15T15:00:00Z" } as OrdenInv,
    perfil: { topeUF: 3500, comunas: ["Pedro Aguirre Cerda", "Estación Central", "Independencia"] } as PerfilInv,
    elegidos: (seis ? ELEGIDOS : ELEGIDOS.slice(0, 4)).map(conAlMes), otras: OTRAS, whatsapp: "+56912345678",
    preaprobacion: searchParams.pre === "corregir" ? "por_corregir" : searchParams.pre === "aprobada" ? "aprobada" : "subir",
  };
  return (
    <MarcoInvierte volver={null} pantalla="base" layout="contenido" cabecera={BASE_COPY.hola("María José")} pc={{ sesionEmail: "muestra@ejemplo.cl" }}>
      <VistaBase base={base} />
    </MarcoInvierte>
  );
}
