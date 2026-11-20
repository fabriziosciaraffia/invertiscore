import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { RESULTADO_COPY } from "@/lib/invierte-v2/opciones";
import type { Tope } from "@/lib/invierte-v2/perfil";
import { URL_INVIERTE } from "@/lib/invierte-v2/destino";
import { calcularOpciones } from "@/lib/invierte-v2/perfil-servidor";
import { fotosDe } from "@/lib/invierte-v2/fotos-servidor";
import { METADATA_FLUJO, sesionYAcceso } from "@/lib/invierte-v2/paginas";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { ResultadoOpciones } from "@/components/invierte-v2/ResultadoOpciones";

// El resultado y la elección (etapa 2, 18-nov-2026; láminas 3.2). Mientras se calcula, la espera (loading.tsx, lámina
// 3.1-espera); si falla, error.tsx con «Intentar de nuevo» (el perfil ya quedó guardado). Sin acceso: 404. Sin perfil u orden:
// /invierte decide. Las opciones se recalculan en cada visita (con el perfil vigente) y quedan en inv_deptos.
export const dynamic = "force-dynamic";
export const metadata = METADATA_FLUJO;

export default async function OpcionesPage() {
  const { user, acceso } = await sesionYAcceso();
  if (!user || !acceso) notFound();
  const r = await calcularOpciones(createServiceClient(), { id: user.id, email: user.email ?? null });
  if (!r) redirect(URL_INVIERTE);
  // Las fotos (entrega 3): solo cuántas tiene cada depto; las sirve la ruta propia, solo a quien firmó.
  const fotos = await fotosDe(createServiceClient(), r.opciones.map((o) => o.avisoId));
  const s = (r.perfil.topeSupuestos ?? {}) as Record<string, unknown>;
  const tope: Pick<Tope, "topeUF" | "fuente" | "limita" | "creditoUF" | "porPieUF" | "menosPreciso"> & { pieUF: number | null; pieNoSabe: boolean } = {
    pieUF: r.perfil.pieUF, pieNoSabe: s.pieNoSabe === true,
    topeUF: r.perfil.topeUF ?? 0, fuente: r.perfil.topeFuente ?? "solo_pie", limita: (s.limita as Tope["limita"]) ?? null,
    creditoUF: (s.creditoUF as number | null) ?? null, porPieUF: (s.porPieUF as number) ?? 0, menosPreciso: r.perfil.topeFuente === "solo_pie",
  };
  return (
    <MarcoInvierte volver={null} pantalla="opciones" layout="contenido" cabecera={RESULTADO_COPY.rotulo} pc={{ sesionEmail: user.email ?? null, invierte: true }}>
      <ResultadoOpciones caso={r.caso} opciones={r.opciones} etiquetas={r.etiquetas} elegidos={r.elegidos} tope={tope}
        pieUF={r.perfil.pieUF} masBaratoUF={r.masBaratoUF} objetivo={r.perfil.objetivo} preocupaciones={r.perfil.preocupaciones} comunas={r.perfil.comunas}
        nivel={r.nivel} donde={r.perfil.donde} distancias={r.distancias} niveles={r.niveles} fotos={fotos} lecturas={r.lecturas} />
    </MarcoInvierte>
  );
}
