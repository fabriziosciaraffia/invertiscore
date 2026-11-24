// /dev/invierte-v2/oferta (etapa 3, B3, 22-nov-2026; rediseño del 23-nov): las pantallas de la oferta, sin cuentas ni escrituras.
//   ?pantalla=oferta (por defecto; lámina 5.1) | firmar (lámina 5.1b) · ?monto=UF (en oferta, el monto con que parte; en firmar, el que firma)
//   ?caso=ajusta | ajusta-normal: un Ajusta supuestos de muestra.
//   ?firme=1 (en firmar): la firma en firme, después de la visita (lámina 5.1b); ?firme=baja: además baja de la oferta anterior (Respaldo).
//   «A este precio» (23-nov-2026) sale del motor con los datos fijos de un depto real de muestra (muestra-motor.ts).
//   ?aviso=<uuid>: con los números REALES de ese depto (su rango guardado, su dirección y su preaprobación), solo lectura: para revisar la
//   pantalla de un depto cuya oferta ya está firmada (y que por eso ya no abre la página de verdad). SOLO EN LOCAL (development).
// Gate en el servidor: dev y previews de Vercel sí; producción, 404.
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { OfertaForm } from "@/components/invierte-v2/OfertaForm";
import { FirmaOfertaForm } from "@/components/invierte-v2/FirmaOfertaForm";
import { CONFIG_RANGO_V1, FIRMA_COPY as F, OFERTA_COPY, calcularRango, type Postura } from "@/lib/invierte-v2/rango";
import { textoOferta } from "@/lib/invierte-v2/oferta-documento";
import { createServiceClient } from "@/lib/supabase/service";
import { lineaDepto } from "@/lib/invierte-v2/base";
import { direccionDepto } from "@/lib/invierte-v2/titulo-depto";
import { leerPreaprobacion } from "@/lib/invierte-v2/preaprobacion-servidor";
import { MOTOR_MUESTRA } from "@/lib/invierte-v2/muestra-motor";

export const dynamic = "force-dynamic";

interface Muestra { direccion: string; linea: string; publicadoUF: number; postura: Postura; pisoUF: number; recomendadoUF: number; altoUF: number; razones: string[]; comprarUF: number | null; banco: string | null; preUF: number | null }

const BASE: Muestra = {
  direccion: "Avenida Libertador Bernardo O'Higgins 1302", linea: "Providencia · 2D2B · 58 m²", publicadoUF: 3090, postura: "negocia_poco", pisoUF: 2905, recomendadoUF: 2936, altoUF: 2967, comprarUF: null, banco: "Santander", preUF: 5000,
  razones: ["Ya bajó UF 80 hace tres semanas: quien vende está dispuesto a moverse.", "En su mismo edificio se venden dos deptos parecidos más baratos: es un argumento para pedir rebaja.", "La cocina tiene muebles dañados y piso manchado: es un argumento concreto para pedir rebaja."],
};

/** Los números reales de un depto (solo lectura). */
async function deptoReal(avisoId: string): Promise<Muestra | null> {
  const admin = createServiceClient();
  const [{ data: of }, { data: ub }, { data: d }] = await Promise.all([
    admin.from("inv_ofertas").select("postura_recomendada, piso_uf, recomendado_uf, techo_uf, publicado_uf, razones, senales").eq("aviso_id", avisoId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("inv_ubicaciones").select("direccion, numero").eq("aviso_id", avisoId).maybeSingle(),
    admin.from("inv_deptos").select("user_id, datos").eq("aviso_id", avisoId).limit(1).maybeSingle(),
  ]);
  if (!of || !d) return null;
  const s = (of.senales ?? {}) as { alto?: number; comprarUF?: number | null };
  const datos = (d.datos ?? {}) as { comuna?: string; dormitorios?: number | null; banos?: number | null; m2?: number | null };
  const pre = await leerPreaprobacion(admin, d.user_id as string);
  return {
    direccion: direccionDepto({ calle: (ub?.direccion as string | null) ?? null, numero: (ub?.numero as string | null) ?? null, comuna: datos.comuna ?? null }) ?? datos.comuna ?? "Depto",
    linea: lineaDepto(datos), publicadoUF: Number(of.publicado_uf), postura: (of.postura_recomendada as Postura) ?? "negocia_poco",
    pisoUF: Number(of.piso_uf), recomendadoUF: Number(of.recomendado_uf), altoUF: Number(s.alto ?? of.techo_uf), razones: Array.isArray(of.razones) ? (of.razones as string[]) : [],
    comprarUF: s.comprarUF ?? null, banco: pre.doc?.banco ?? null, preUF: pre.doc?.montoAprobadoUF ?? null,
  };
}

export default async function OfertaDemo({ searchParams }: { searchParams: { pantalla?: string; monto?: string; caso?: string; aviso?: string; firme?: string } }) {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") notFound();
  const monto = Number(searchParams.monto);
  const sinSenales = { bajada: null, vecinos: null, pinSospechoso: false, estadoArriendo: "listo", arreglos: [] as string[] };
  let m: Muestra = BASE;
  // Los datos reales solo en local: el preview no muestra la dirección ni la preaprobación de una cuenta.
  if (process.env.NODE_ENV === "development" && searchParams.aviso && /^[0-9a-f-]{36}$/i.test(searchParams.aviso)) m = (await deptoReal(searchParams.aviso)) ?? BASE;
  else if (searchParams.caso === "ajusta" || searchParams.caso === "ajusta-normal") {
    const r = calcularRango(3090, sinSenales, new Date(), CONFIG_RANGO_V1, searchParams.caso === "ajusta" ? 2840 : 2960);
    m = { ...BASE, postura: r.postura, pisoUF: r.pisoUF, recomendadoUF: r.recomendadoUF, altoUF: r.altoUF, razones: r.razones, comprarUF: r.comprarUF };
  }
  const q = (extra: string) => `/dev/invierte-v2/oferta?${[searchParams.aviso ? `aviso=${searchParams.aviso}` : null, searchParams.caso ? `caso=${searchParams.caso}` : null, extra].filter(Boolean).join("&")}`;
  const pub = `UF ${Math.round(m.publicadoUF).toLocaleString("es-CL")}`;
  if (searchParams.pantalla === "firmar") {
    const mm = monto > 0 ? monto : m.recomendadoUF;
    const conPre = F.conPreaprobacion(m.banco, m.preUF, null);
    const firme = searchParams.firme === "1" || searchParams.firme === "baja" ? { antesUF: searchParams.firme === "baja" ? 2966 : null, respaldo: searchParams.firme === "baja" ? { fecha: "25 nov", linea: "Baño con filtración en el cielo", href: "/dev/invierte-v2/visita?caso=arreglo" } : null } : null;
    const documento = textoOferta({ nombre: "María José Fernández Valdivieso", rut: "12.345.678-5", depto: `${m.direccion} · ${m.linea}`, montoUF: mm, publicadoUF: m.publicadoUF, pagas: `${F.pieYCredito(Math.round(mm * 0.2))}, ${conPre.replace(/^Con/, "con")}`, sujetaAVisita: !firme, vigenciaDias: 5, enFirme: firme ? { visitaFecha: "25 de noviembre", respaldo: firme.respaldo?.linea ?? null } : null });
    return (
      <MarcoInvierte volver={null} pantalla="firmar-oferta" layout="formulario" cabecera="Tu oferta" pc={{ sesionEmail: "muestra@ejemplo.cl", invierte: "inversion" }}>
        <div className="iv2-mi-inversion"><Link href={q(`monto=${mm}`)} className="iv2-mi-inversion-a">← {F.volver}</Link></div>
        <div className="inv-encabezado iv2-sumar-cab"><h1 className="iv2-titulo-res" id="iv2-t">{F.titulo}</h1><p className="iv2-depto-s">{m.direccion} · {m.linea}<span className="iv2-fo-pub"> · publicado en {pub}</span></p></div>
        <FirmaOfertaForm avisoId="muestra" montoUF={mm} publicadoUF={m.publicadoUF} documento={documento} urlVolver="/dev/invierte-v2/depto?etapa=listo&oferta=firmada"
          pagas={F.pieYCredito(Math.round(mm * 0.2))} pagasLinea={<>{F.preaprobacion(m.banco, m.preUF)} · <span className="iv2-enlace-azul">{F.ver}</span></>} enFirme={firme} />
      </MarcoInvierte>
    );
  }
  return (
    <MarcoInvierte volver={null} pantalla="oferta" layout="formulario" cabecera={OFERTA_COPY.cabecera} pc={{ sesionEmail: "muestra@ejemplo.cl", invierte: "inversion" }}>
      <div className="iv2-mi-inversion"><Link href="/dev/invierte-v2/depto?etapa=listo&confirmada=1" className="iv2-mi-inversion-a">← {m.direccion}</Link></div>
      <div className="inv-encabezado iv2-sumar-cab"><h1 className="iv2-titulo-res" id="iv2-t">{OFERTA_COPY.titulo}</h1><p className="iv2-depto-s">{m.linea} · publicado en {pub}</p></div>
      <OfertaForm avisoId="muestra" urlFirmar={q("pantalla=firmar")} postura={m.postura} pisoUF={m.pisoUF} recomendadoUF={m.recomendadoUF} altoUF={m.altoUF} publicadoUF={m.publicadoUF}
        razones={m.razones} avisoFuertePct={5} comprarUF={m.comprarUF} montoInicial={monto > 0 ? monto : null} motor={MOTOR_MUESTRA} />
    </MarcoInvierte>
  );
}
