// /dev/invierte-v2/admin-visita (24-nov-2026): la tarjeta «Visita» del admin con datos de muestra, sin cuentas, sin red y sin escrituras.
//   ?caso=abierta (por defecto: el reporte por llenar, con la carga de fotos) | pedida (agendar) | mantener (lo que respondió quien vende)
//   | publicada (el reporte ya publicado)
// Las fotos se validan y se achican en el navegador igual que en el admin, pero no se suben; «Publicar reporte» dice qué se enviaría.
// Gate en el servidor: dev y previews de Vercel sí; producción, 404.
import Link from "next/link";
import { notFound } from "next/navigation";
import { VisitaAdmin } from "@/app/admin/invierte-v2/visita-admin";
import type { OfertaVista } from "@/lib/invierte-v2/rango-servidor";
import { visitaMuestra } from "@/lib/invierte-v2/muestra-visita";

export const dynamic = "force-dynamic";

const CASOS = ["abierta", "pedida", "mantener", "publicada"] as const;

const OFERTA: OfertaVista = {
  id: "muestra", estado: "contraoferta", postura: "negociar" as OfertaVista["postura"], descuentoPct: 6, pisoUF: 2874, recomendadoUF: 2905, altoUF: 2966,
  techoUF: 3090, comprarUF: null, publicadoUF: 3090, razones: [], corregida: null, montoUF: 2900, firmadaAt: new Date(Date.now() - 3 * 864e5).toISOString(),
  texto: null, textoVersion: null, contraofertaUF: 3010, mantenerPedidoAt: new Date(Date.now() - 864e5).toISOString(), mantenerRespuesta: null,
};

export default function AdminVisitaDemo({ searchParams }: { searchParams: { caso?: string } }) {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") notFound();
  const caso = (CASOS as readonly string[]).includes(searchParams.caso ?? "") ? (searchParams.caso as (typeof CASOS)[number]) : "abierta";
  const estadoVisita = caso === "pedida" ? "pedida" : caso === "publicada" ? "reporte_publicado" : "agendada";
  const v = caso === "mantener" ? null : { ...visitaMuestra(caso === "publicada" ? "arreglo" : "coincide", estadoVisita), visitadaAt: caso === "publicada" ? new Date(Date.now() - 864e5).toISOString() : null };
  const o: OfertaVista = caso === "mantener" ? OFERTA : { ...OFERTA, mantenerRespuesta: "acepta" };
  return (
    <main className="mx-auto flex max-w-[960px] flex-col gap-3 bg-[var(--franco-bg)] p-4 font-body text-[13px] text-[var(--franco-text)]">
      <p className="m-0 text-[12px] text-[var(--franco-text-muted)]">Muestra del admin · sin red ni escrituras ·{" "}
        {CASOS.map((c) => (
          <Link key={c} href={`?caso=${c}`} className={`mr-2 underline ${c === caso ? "font-semibold" : ""}`}>{c}</Link>
        ))}
      </p>
      <VisitaAdmin key={caso} o={o} v={v} arreglosFotos={caso === "abierta" ? ["Mancha de humedad en el muro del dormitorio"] : []} demo />
    </main>
  );
}
