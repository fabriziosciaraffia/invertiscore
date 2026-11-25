import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { urlDepto } from "@/lib/invierte-v2/depto-flujo";
import { leerPaginaDepto } from "@/lib/invierte-v2/depto-pagina-servidor";
import { rondaDesde } from "@/lib/invierte-v2/b4-servidor";
import { cifrasAPrecio, esMotorFijo } from "@/lib/invierte-v2/cifras-motor";
import { METADATA_FLUJO, sesionYAcceso } from "@/lib/invierte-v2/paginas";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { ResponderContraoferta, type DatosContraoferta } from "@/components/invierte-v2/ResponderContraoferta";

// RESPONDER LA CONTRAOFERTA (B4, 23-nov-2026; lámina 5.2). Solo con una contraoferta abierta y vigente, o una que llegó fuera de plazo y la
// persona todavía no respondió; si no, vuelve al depto. Las cifras de la tabla salen del motor con los datos fijos del depto.
export const dynamic = "force-dynamic";
export const metadata = METADATA_FLUJO;

export default async function ContraofertaPage({ params, searchParams }: { params: { avisoId: string }; searchParams: { sinVisitar?: string } }) {
  const { user, acceso } = await sesionYAcceso();
  if (!user || !acceso) notFound();
  const avisoId = decodeURIComponent(params.avisoId);
  const p = await leerPaginaDepto(createServiceClient(), user.id, avisoId);
  if (!p) redirect("/invierte");
  const o = p.oferta?.estado === "contraoferta" ? p.oferta : p.cierre ?? null;
  const r = o ? rondaDesde(o) : null;
  if (!o || !r || (r.tipo !== "contra" && r.tipo !== "tardia_contra") || !o.montoUF || !o.contraofertaUF) redirect(urlDepto(avisoId));
  const motor = esMotorFijo(p.ubicacion?.analisis?.motor) ? p.ubicacion.analisis.motor : null;
  const sugerida = o.sugeridaUF ?? o.contraofertaUF;
  const d: DatosContraoferta = {
    avisoId, ofertaId: o.id, tuUF: o.montoUF, ellosUF: o.contraofertaUF, sugeridaUF: sugerida, accion: sugerida >= o.contraofertaUF ? "aceptar" : "proponer",
    topeEsComprar: o.comprarUF != null, pisoUF: o.pisoUF, altoUF: o.altoUF, publicadoUF: o.publicadoUF, venceAt: o.contraofertaVence ?? null,
    fueraDePlazo: r.tipo === "tardia_contra", otraViva: r.tipo === "tardia_contra" ? p.otraViva ?? null : null, pausaAcuerdo: p.pausaAcuerdo === true,
    cifras: { tu: motor ? cifrasAPrecio(motor, o.montoUF) : null, sugerida: motor ? cifrasAPrecio(motor, sugerida) : null, ellos: motor ? cifrasAPrecio(motor, o.contraofertaUF) : null },
    // La visita antes del precio (24-nov-2026): la visita del depto, «Responder sin visitar» y si quien vende aceptó esperar.
    visita: o.estado === "contraoferta" ? p.visita ?? null : null, sinVisitar: searchParams.sinVisitar === "1", mantiene: o.mantenerRespuesta === "acepta",
  };
  return (
    <MarcoInvierte volver={null} pantalla="contraoferta" layout="formulario" cabecera="Contraoferta" pc={{ sesionEmail: user.email ?? null, invierte: "inversion" }}>
      <div className="iv2-mi-inversion"><Link href={urlDepto(avisoId)} className="iv2-mi-inversion-a" data-inv2="volver-depto">← {p.direccion ?? p.tituloConNumero}</Link></div>
      <ResponderContraoferta d={d} volverA={urlDepto(avisoId)} />
    </MarcoInvierte>
  );
}
