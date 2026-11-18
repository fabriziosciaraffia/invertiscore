import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { FLUJO_COPY, primerNombre } from "@/lib/invierte-v2/flujo";
import { URL_PERFIL } from "@/lib/invierte-v2/destino";
import { fechaFirmaLarga, partesDeTexto } from "@/lib/invierte-v2/orden";
import { formatearRut } from "@/lib/invierte-v2/rut";
import { ultimaOrdenDe } from "@/lib/invierte-v2/servidor";
import { METADATA_FLUJO, sesionYAcceso } from "@/lib/invierte-v2/paginas";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { VerOrden } from "@/components/invierte-v2/VerOrden";

// 2.2 Partimos (etapa 1 de Invierte con Franco; cuarta entrega, 18-nov-2026, láminas 2.2-partimos y 2.2-partimos-pc). La
// lámina manda en el orden y en las piezas: el chip «Orden firmada», el título, una línea, el botón rojo «Hacer mi perfil de
// inversión» (la etapa 2; mientras tanto, una pantalla que dice que viene pronto), el secundario «Ver mi orden firmada» —abre
// la orden guardada en una ventana sobre la página—, la línea de la copia por correo, la tarjeta «Lo que sigue» y la tarjeta
// con fondo «Por qué te vamos a mostrar más opciones». En el PC, las dos tarjetas a la derecha. Pide sesión y una orden
// firmada; la orden se ve siempre, con o sin interruptor.
export const dynamic = "force-dynamic";
export const metadata = METADATA_FLUJO;

export default async function PartimosPage() {
  const { user } = await sesionYAcceso();
  if (!user) notFound();
  const orden = await ultimaOrdenDe(createServiceClient(), user.id);
  if (!orden) notFound();
  const P = FLUJO_COPY.partimos;
  const texto = partesDeTexto(orden.texto);
  return (
    <MarcoInvierte volver={null} pantalla="partimos" layout="partimos" pc={{ sesionEmail: user.email ?? null }}>
      <div className="iv2-partimos-izq">
      <div className="inv-encabezado iv2-partimos-cab">
        <span className="iv2-estado" data-inv2="estado">✓ {P.estado}</span>
        <h1 className="iv2-titulo-grande" id="iv2-t">{P.titulo(primerNombre(orden.nombre))}</h1>
        <p className="inv-parrafo iv2-linea">{P.linea}</p>
      </div>
      <div className="iv2-acciones">
        <Link href={URL_PERFIL} className="inv-principal" data-inv2="perfil">{P.perfil}</Link>
        <VerOrden etiqueta={P.verOrden} estado={P.estado} firmada={fechaFirmaLarga(orden.firmadoAt)}
          quien={`${orden.nombre} · RUT ${formatearRut(orden.rut)} · Versión ${orden.textoVersion}`} titulo={texto.titulo} parrafos={texto.parrafos} />
        {orden.copiaEnviadaAt ? (
          <p className="iv2-guardada" data-inv2="copia-enviada">{P.guardada}</p>
        ) : (
          <p className="iv2-guardada" data-inv2="copia-pendiente">{P.copiaPendiente}</p>
        )}
      </div>
      </div>
      <div className="iv2-partimos-der">
        <section className="iv2-tarjeta" aria-labelledby="iv2-sigue-t" data-inv2="lo-que-sigue">
          <h2 className="iv2-tarjeta-et" id="iv2-sigue-t">{P.loQueSigue}</h2>
          <ol className="iv2-pasos" data-inv2="pasos">
            {P.pasos.map((p, i) => (
              <li key={p.titulo}>
                <span className="iv2-num" aria-hidden="true">{i + 1}</span>
                <div><p className="iv2-paso-t">{p.titulo}</p><p className="iv2-paso-s">{p.texto}</p></div>
              </li>
            ))}
          </ol>
        </section>
        <section className="iv2-porque" aria-labelledby="iv2-porque-t" data-inv2="por-que">
          <h2 id="iv2-porque-t">{P.porQueTitulo}</h2>
          <p>{P.porQueTexto}</p>
        </section>
      </div>
    </MarcoInvierte>
  );
}
