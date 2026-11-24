// /dev/invierte-v2/contraoferta (B4, 23-nov-2026; lámina 5.2): responder la contraoferta con datos de muestra, sin cuentas ni escrituras.
//   ?caso=proponer (por defecto: piden UF 3.010, sobre lo recomendado) | aceptar (piden UF 2.960, dentro) | tardia (llegó fuera de plazo)
//   ?otra=1: con otra oferta viva (aceptar la retira); ?otra=firme: la otra es a firme vigente (no se oferta por este, sin botones); ?otra=firme-sin: firmada, todavía sin presentar (sin fecha). Las cifras de la tabla, del motor con los datos fijos de un depto real de muestra.
// Gate en el servidor: dev y previews de Vercel sí; producción, 404.
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { ResponderContraoferta } from "@/components/invierte-v2/ResponderContraoferta";
import { sugerenciaFranco, venceAlTerminar } from "@/lib/invierte-v2/b4";
import { cifrasAPrecio } from "@/lib/invierte-v2/cifras-motor";
import { MOTOR_MUESTRA } from "@/lib/invierte-v2/muestra-motor";
import { visitaMuestra } from "@/lib/invierte-v2/muestra-visita";

export const dynamic = "force-dynamic";

export default function ContraofertaDemo({ searchParams }: { searchParams: { caso?: string; otra?: string; visita?: string; sinVisitar?: string } }) {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") notFound();
  const caso = searchParams.caso === "aceptar" || searchParams.caso === "tardia" ? searchParams.caso : "proponer";
  const tu = 2936, piso = 2905, alto = 2966, pub = 3090;
  const ellos = caso === "aceptar" ? 2960 : 3010;
  // Con una visita con arreglo, lo que sugiere Franco se recalcula con el rango de después de la visita (visitaMuestra: piso 2.874, alto 2.936).
  const s = searchParams.visita === "arreglo" ? sugerenciaFranco({ ofertaUF: tu, contraofertaUF: ellos, altoUF: 2936, bajarHasta: 2874 }) : sugerenciaFranco({ ofertaUF: tu, contraofertaUF: ellos, altoUF: alto });
  const vence = venceAlTerminar(new Date(Date.now() - 2 * 864e5)).toISOString();
  return (
    <MarcoInvierte volver={null} pantalla="contraoferta" layout="formulario" cabecera="Contraoferta" pc={{ sesionEmail: "muestra@ejemplo.cl", invierte: "inversion" }}>
      <div className="iv2-mi-inversion"><Link href="/dev/invierte-v2/depto?etapa=listo&confirmada=1&oferta=contraoferta" className="iv2-mi-inversion-a">← Av. Grecia 1250</Link></div>
      <ResponderContraoferta volverA="/dev/invierte-v2/depto?etapa=listo&confirmada=1" d={{
        avisoId: "muestra", ofertaId: "of", tuUF: tu, ellosUF: ellos, sugeridaUF: s.montoUF, accion: s.accion, topeEsComprar: false, pisoUF: piso, altoUF: alto, publicadoUF: pub, venceAt: vence,
        fueraDePlazo: caso === "tardia", otraViva: searchParams.otra === "1" ? { titulo: "Av. Irarrázaval 2315" } : searchParams.otra === "firme" ? { titulo: "Av. Irarrázaval 2315", firme: { venceAt: venceAlTerminar(new Date(Date.now() - 864e5)).toISOString() } } : searchParams.otra === "firme-sin" ? { titulo: "Av. Irarrázaval 2315", firme: { venceAt: null } } : null,
        cifras: { tu: cifrasAPrecio(MOTOR_MUESTRA, tu), sugerida: cifrasAPrecio(MOTOR_MUESTRA, s.montoUF), ellos: cifrasAPrecio(MOTOR_MUESTRA, ellos) },
        // ?visita=hecha | arreglo: ya visitó; sin ?visita, todavía no (la visita es el botón rojo); ?sinVisitar=1: «Responder sin visitar».
        visita: searchParams.visita === "hecha" || searchParams.visita === "arreglo" ? visitaMuestra(searchParams.visita === "arreglo" ? "arreglo" : "coincide") : null, sinVisitar: searchParams.sinVisitar === "1",
      }} />
    </MarcoInvierte>
  );
}
