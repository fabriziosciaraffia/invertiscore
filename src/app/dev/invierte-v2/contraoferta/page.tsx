// /dev/invierte-v2/contraoferta (B4, 23-nov-2026; lámina 5.2): responder la contraoferta con datos de muestra, sin cuentas ni escrituras.
//   ?caso=proponer (por defecto: piden UF 3.010, sobre lo recomendado) | aceptar (piden UF 2.960, dentro) | tardia (llegó fuera de plazo)
//   ?otra=1: con otra oferta viva (aceptar la retira). Las cifras de la tabla, del motor con los datos fijos de un depto real de muestra.
// Gate en el servidor: dev y previews de Vercel sí; producción, 404.
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { ResponderContraoferta } from "@/components/invierte-v2/ResponderContraoferta";
import { sugerenciaFranco, venceAlTerminar } from "@/lib/invierte-v2/b4";
import { cifrasAPrecio } from "@/lib/invierte-v2/cifras-motor";
import { MOTOR_MUESTRA } from "@/lib/invierte-v2/muestra-motor";

export const dynamic = "force-dynamic";

export default function ContraofertaDemo({ searchParams }: { searchParams: { caso?: string; otra?: string } }) {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") notFound();
  const caso = searchParams.caso === "aceptar" || searchParams.caso === "tardia" ? searchParams.caso : "proponer";
  const tu = 2936, piso = 2905, alto = 2966, pub = 3090;
  const ellos = caso === "aceptar" ? 2960 : 3010;
  const s = sugerenciaFranco({ ofertaUF: tu, contraofertaUF: ellos, altoUF: alto });
  const vence = venceAlTerminar(new Date(Date.now() - 2 * 864e5)).toISOString();
  return (
    <MarcoInvierte volver={null} pantalla="contraoferta" layout="formulario" cabecera="Contraoferta" pc={{ sesionEmail: "muestra@ejemplo.cl", invierte: "inversion" }}>
      <div className="iv2-mi-inversion"><Link href="/dev/invierte-v2/depto?etapa=listo&confirmada=1&oferta=contraoferta" className="iv2-mi-inversion-a">← Av. Grecia 1250</Link></div>
      <ResponderContraoferta volverA="/dev/invierte-v2/depto?etapa=listo&confirmada=1" d={{
        avisoId: "muestra", ofertaId: "of", tuUF: tu, ellosUF: ellos, sugeridaUF: s.montoUF, accion: s.accion, topeEsComprar: false, pisoUF: piso, altoUF: alto, publicadoUF: pub, venceAt: vence,
        fueraDePlazo: caso === "tardia", otraViva: searchParams.otra === "1" ? { titulo: "Av. Irarrázaval 2315" } : null,
        cifras: { tu: cifrasAPrecio(MOTOR_MUESTRA, tu), sugerida: cifrasAPrecio(MOTOR_MUESTRA, s.montoUF), ellos: cifrasAPrecio(MOTOR_MUESTRA, ellos) },
      }} />
    </MarcoInvierte>
  );
}
