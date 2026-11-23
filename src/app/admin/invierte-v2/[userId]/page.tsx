import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-auth";
import { fmtDateShort, fmtNumber } from "@/lib/admin-format";
import { INVIERTE_COPY, esPie, esUrgencia } from "@/lib/invierte/invierte";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { leerPersona, ultimaOrdenDe } from "@/lib/invierte-v2/servidor";
import { leerPerfilInv } from "@/lib/invierte-v2/perfil-servidor";
import { porQueTopeAdmin } from "@/lib/invierte-v2/perfil";
import { lineaDepto } from "@/lib/invierte-v2/base";
import type { DatosDepto } from "@/lib/invierte-v2/base-servidor";
import { lineaCambio, type TipoCambio } from "@/lib/invierte-v2/cambios";
import { ETIQUETAS, fmtUF, textoAlMes, type Etiqueta } from "@/lib/invierte-v2/opciones";
import { GestionDepto, RevisarPreaprobacion, TareaHecha } from "../controles";
import { COLS_OFERTA, ofertaDeFila, type OfertaVista } from "@/lib/invierte-v2/rango-servidor";
import { asegurarPreguntasDeLectura, leerPreguntas, leerUbicaciones } from "@/lib/invierte-v2/depto-servidor";
import { leerLecturas } from "@/lib/invierte-v2/lectura-franco-servidor";
import { asegurarRango } from "@/lib/invierte-v2/rango-servidor";
import { etapaDe } from "@/lib/invierte-v2/depto-flujo";
import { leerPreaprobacion } from "@/lib/invierte-v2/preaprobacion-servidor";
import { lineaAprobada } from "@/lib/invierte-v2/preaprobacion";

export const dynamic = "force-dynamic";

/**
 * LA FICHA DE UNA PERSONA DE «Invierte con Franco» (etapa 2, entrega 2, 19-nov-2026). Lo que la persona de Franco necesita para
 * llevarla: sus respuestas y su orden, su perfil y hasta cuánto puede comprar, sus deptos (elegidos y opciones, con lo que deja
 * al mes, si le alcanzan, la publicación y sus detalles), las TAREAS internas con «Marcar hecha», lo que cambió en la publicación
 * de sus deptos y la bitácora. Solo administradores de ADMIN_EMAIL; quién publica cada depto no sale de esta página.
 */
const TIPO_TAREA: Record<string, string> = {
  gestionar_corredor: "Gestionar al corredor",
  avisar_alcance: "Avisarle cuando algo le alcance",
  cambio_publicacion: "Cambió la publicación",
  cambio_publicador: "Cambió quién publica",
  revisar_preaprobacion: "Revisar la preaprobación",
  contactar_listo: "Contactarla: está lista",
  explicar_preaprobacion: "Explicarle la preaprobación",
  confirmar_depto_atrasado: "Confirmar el depto: lleva 3 días",
  presentar_oferta: "Presentar la oferta",
  hablar_oferta: "Hablar la oferta con la persona",
  // B4 (23-nov-2026).
  insistir_oferta: "Insistir con quien vende (día 3)",
  avisar_retiro: "Avisarle a quien vende que la retiró",
  precio_bajo_oferta: "Bajó el precio bajo su oferta",
  comunicar_aceptacion: "Comunicar que acepta su precio",
  enviar_whatsapp: "Escribirle por WhatsApp",
};
const ESTADO_DEPTO: Record<string, string> = { elegido: "Elegido", opcion: "Opción", descartado: "Descartado" };

const caja = "mb-6 rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4 shadow-sm";
const th = "px-3 py-2 font-medium";
const td = "px-3 py-2 align-top";

export default async function FichaInvierteV2Page({ params }: { params: { userId: string } }) {
  const { sb } = await requireAdminPage();
  const userId = params.userId;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) notFound();
  const pre = await leerPreaprobacion(sb, userId);
  const [persona, orden, perfil, { data: deptos }, { data: tareas }, { data: cambios }, { data: bitacora }, { data: detalles }] = await Promise.all([
    leerPersona(sb, userId), ultimaOrdenDe(sb, userId), leerPerfilInv(sb, userId),
    sb.from("inv_deptos").select("aviso_id, estado, origen, etiqueta, alcanza, datos, elegido_at, vigente, publicacion_leida_at, updated_at, etapa, acuerdo, alternativa_aviso_id, es_prueba").eq("user_id", userId).order("estado").order("updated_at", { ascending: false }),
    sb.from("inv_tareas").select("id, tipo, aviso_id, estado, detalle, hecha_por, hecha_at, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
    sb.from("inv_cambios").select("aviso_id, tipo, antes, despues, fecha, en_base, relevante, correo_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(40),
    sb.from("inv_bitacora").select("id, actor, actor_email, accion, detalle, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    sb.from("guia_analisis").select("aviso_id, analysis_id").eq("user_id", userId).not("analysis_id", "is", null),
  ]);
  if (!persona && !orden) notFound();
  const informe = new Map((detalles ?? []).map((d) => [d.aviso_id as string, d.analysis_id as string]));
  const linea = new Map((deptos ?? []).map((d) => [d.aviso_id as string, lineaDepto((d.datos ?? {}) as DatosDepto)]));
  // Etapa 3, B1: el flujo de cada depto elegido (acuerdo, ubicación confirmada y análisis rehecho).
  const elegidos = (deptos ?? []).filter((d) => d.estado === "elegido");
  const idsEl = elegidos.map((d) => d.aviso_id as string);
  const [ubic, { data: pines }] = await Promise.all([
    leerUbicaciones(sb, idsEl),
    idsEl.length ? sb.from("scraped_properties").select("id, lat, lng, comuna").in("id", idsEl).order("id").limit(50) : Promise.resolve({ data: [] as { id: string; lat: number | null; lng: number | null; comuna: string | null }[] }),
  ]);
  // B2: las preguntas de cada depto (las de la lectura se copian aquí también, por si la persona todavía no abrió su página).
  const lecturas = await leerLecturas(sb, idsEl);
  for (const d of elegidos) await asegurarPreguntasDeLectura(sb, d.aviso_id as string, lecturas[d.aviso_id as string]?.preguntas ?? [], d.es_prueba === true);
  const preguntasDe = Object.fromEntries(await Promise.all(idsEl.map(async (id) => [id, await leerPreguntas(sb, id)] as const)));
  // B3: el rango de cada depto listo (la oferta borrador; firmada, congelada).
  const rangoDe = Object.fromEntries(await Promise.all(idsEl.map(async (id) => [id, await asegurarRango(sb, userId, id)] as const)));
  // B4: la última ronda de cada depto (sea cual sea su estado), para presentar y registrar la respuesta.
  const { data: ofs } = idsEl.length ? await sb.from("inv_ofertas").select(COLS_OFERTA + ", aviso_id").eq("user_id", userId).in("aviso_id", idsEl).neq("estado", "borrador").order("ronda", { ascending: false }) : { data: [] };
  const ofertaDe = new Map<string, OfertaVista>();
  for (const f of (ofs ?? []) as unknown as Record<string, unknown>[]) if (!ofertaDe.has(f.aviso_id as string)) ofertaDe.set(f.aviso_id as string, ofertaDeFila(f));
  const pinDe = new Map(((pines ?? []) as { id: string; lat: number | null; lng: number | null; comuna: string | null }[]).map((x) => [x.id, x]));
  const pendientes = (tareas ?? []).filter((t) => t.estado === "pendiente");
  const hechas = (tareas ?? []).filter((t) => t.estado !== "pendiente");
  const H = INVIERTE_COPY.hoja;

  return (
    <div data-admin="inv2-ficha">
      <p className="m-0 mb-2 font-body text-[13px]"><Link href="/admin/invierte-v2" className="underline underline-offset-2">← Invierte con Franco · comprador</Link></p>
      <div className="mb-6">
        <h1 className="m-0 font-heading text-2xl font-bold">{orden?.nombre ?? persona?.email ?? userId}</h1>
        <p className="m-0 mt-1 font-body text-[13px] text-[var(--franco-text-secondary)]">
          {orden?.email ?? persona?.email ?? "—"} · {orden ? `firmó el ${fmtDateShort(orden.firmadoAt)} (v${orden.textoVersion})` : "sin orden firmada"}
          {(orden?.esPrueba || perfil?.esPrueba) && " · cuenta de prueba"} · <Link href={`/admin/usuarios/${userId}`} className="underline underline-offset-2">ficha de la cuenta</Link>
        </p>
      </div>

      <section className={caja} data-admin="inv2-ficha-tareas">
        <h2 className="m-0 mb-3 font-heading text-lg font-bold">Tareas · {fmtNumber(pendientes.length)} pendientes</h2>
        {pendientes.length === 0 && <p className="m-0 font-body text-[13px] text-[var(--franco-text-muted)]">Nada pendiente.</p>}
        <ul className="m-0 flex list-none flex-col gap-2 p-0 font-body text-[13px]">
          {pendientes.map((t) => (
            <li key={t.id as string} className="flex flex-wrap items-center gap-3" data-tarea={t.tipo as string}>
              <span className="font-semibold">{TIPO_TAREA[t.tipo as string] ?? (t.tipo as string)}</span>
              {t.aviso_id && <span>{linea.get(t.aviso_id as string) || (t.aviso_id as string)}</span>}
              {t.detalle && (t.tipo === "cambio_publicacion") && <span className="text-[12px] text-[var(--franco-text-secondary)]">{resumenDetalle(t.detalle as Record<string, unknown>)}</span>}
              {t.detalle && t.tipo === "enviar_whatsapp" && <span className="text-[12px] text-[var(--franco-text-secondary)]">{String((t.detalle as Record<string, unknown>).texto ?? "")}{(t.detalle as Record<string, unknown>).url ? <> · <a className="underline" href={String((t.detalle as Record<string, unknown>).url)} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a></> : " · sin número o sin permiso de WhatsApp"}</span>}
              <span className="text-[12px] text-[var(--franco-text-muted)]">{fmtDateShort(t.created_at as string)}</span>
              <TareaHecha id={t.id as string} />
            </li>
          ))}
        </ul>
        {hechas.length > 0 && (
          <details className="mt-3 font-body text-[12px] text-[var(--franco-text-secondary)]">
            <summary className="cursor-pointer">{fmtNumber(hechas.length)} hechas</summary>
            <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
              {hechas.map((t) => <li key={t.id as string}>{TIPO_TAREA[t.tipo as string] ?? (t.tipo as string)}{t.aviso_id ? ` · ${linea.get(t.aviso_id as string) || (t.aviso_id as string)}` : ""} · {t.hecha_por ?? "—"} · {fmtDateShort(t.hecha_at as string | null)}</li>)}
            </ul>
          </details>
        )}
      </section>

      <section className={caja} data-admin="inv2-ficha-preaprobacion">
        <h2 className="m-0 mb-3 font-heading text-lg font-bold">Preaprobación · {ESTADO_PRE[pre.estado]}</h2>
        {pre.doc && pre.doc.tipo === "preaprobacion" ? (
          <div className="font-body text-[13px]">
            <p className="m-0">
              Subida el {fmtDateShort(pre.doc.createdAt)} · {pre.doc.mime ?? "—"}{pre.doc.bytes ? ` · ${Math.round(pre.doc.bytes / 1024)} KB` : ""}
              {pre.doc.path && <> · <a href={`/api/admin/invierte-v2?documento=${pre.doc.id}`} target="_blank" rel="noopener" className="underline underline-offset-2" data-admin="inv2-ver-preaprobacion">Ver</a></>}
            </p>
            {pre.estado === "aprobada" && <p className="m-0 mt-1">{lineaAprobada({ banco: pre.doc.banco, montoUF: pre.doc.montoAprobadoUF, vigenteHasta: pre.doc.vigenteHasta })} Aprobó {pre.doc.revisadoPor ?? "—"}.</p>}
            {pre.estado === "por_corregir" && <p className="m-0 mt-1">Motivo: {pre.doc.motivo}</p>}
            <LecturaIA ia={pre.doc.ia} modelo={pre.doc.iaModelo} costo={pre.doc.iaCostoUsd} />
            {pre.estado === "en_revision" && (
              <RevisarPreaprobacion id={pre.doc.id} banco={(pre.doc.ia?.banco as string | null) ?? null} montoUF={(pre.doc.ia?.montoUF as number | null) ?? null} vigenteHasta={(pre.doc.ia?.vigenteHasta as string | null) ?? null} />
            )}
          </div>
        ) : <p className="m-0 font-body text-[13px] text-[var(--franco-text-muted)]">{pre.estado === "sin_credito" ? "Compra sin crédito." : pre.estado === "explicando" ? "Dijo que todavía no la tiene: explícale cómo pedirla." : "Todavía no la sube."}</p>}
      </section>

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <section className={`${caja} mb-0`} data-admin="inv2-ficha-contacto">
          <h2 className="m-0 mb-3 font-heading text-lg font-bold">Contacto</h2>
          {persona ? (
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-body text-[13px]">
              <dt className="text-[var(--franco-text-muted)]">¿Cuándo?</dt><dd className="m-0">{esUrgencia(persona.urgencia) ? H.urgencias[persona.urgencia] : persona.urgencia}</dd>
              <dt className="text-[var(--franco-text-muted)]">¿Pie?</dt><dd className="m-0">{esPie(persona.pie) ? H.pies[persona.pie] : persona.pie}{persona.pieUF != null ? ` (UF ${fmtUF(persona.pieUF)})` : ""}</dd>
              <dt className="text-[var(--franco-text-muted)]">WhatsApp</dt><dd className="m-0 font-mono text-[12px]"><a href={`https://wa.me/${persona.whatsapp.replace(/^\+/, "")}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{persona.whatsapp}</a></dd>
              <dt className="text-[var(--franco-text-muted)]">Entró desde</dt><dd className="m-0">{persona.origen} · {persona.avisoOrigen}</dd>
              <dt className="text-[var(--franco-text-muted)]">Orden</dt><dd className="m-0">{orden ? <a href={`/api/admin/invierte-v2?orden=${orden.id}`} target="_blank" rel="noopener" className="underline underline-offset-2">Ver la orden firmada</a> : "—"}</dd>
            </dl>
          ) : <p className="m-0 font-body text-[13px] text-[var(--franco-text-muted)]">Sin contacto.</p>}
        </section>
        <section className={`${caja} mb-0`} data-admin="inv2-ficha-perfil">
          <h2 className="m-0 mb-3 font-heading text-lg font-bold">Perfil de inversión</h2>
          {perfil ? (
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-body text-[13px]">
              <dt className="text-[var(--franco-text-muted)]">Hasta</dt><dd className="m-0 font-semibold">{perfil.topeUF ? `UF ${fmtUF(perfil.topeUF)}` : "—"} <span className="font-normal text-[var(--franco-text-secondary)]">{porQueTopeAdmin(perfil, fmtUF)}</span></dd>
              <dt className="text-[var(--franco-text-muted)]">Comunas</dt><dd className="m-0">{perfil.comunas.join(", ") || "—"}</dd>
              <dt className="text-[var(--franco-text-muted)]">Pie</dt><dd className="m-0">{perfil.pieUF != null ? `UF ${fmtUF(perfil.pieUF)}` : "—"}</dd>
              <dt className="text-[var(--franco-text-muted)]">Renta líquida</dt><dd className="m-0">{perfil.noDiceRenta ? "No la dijo" : perfil.rentaCLP != null ? `$${perfil.rentaCLP.toLocaleString("es-CL")}` : "—"}{perfil.otrasCuotasCLP ? ` · otras cuotas $${perfil.otrasCuotasCLP.toLocaleString("es-CL")}` : ""}</dd>
              <dt className="text-[var(--franco-text-muted)]">Preaprobación</dt><dd className="m-0">{perfil.preaprobado === "tengo" ? `Tiene${perfil.montoPreaprobadoUF ? ` (UF ${fmtUF(perfil.montoPreaprobadoUF)})` : ""}` : perfil.preaprobado === "tramite" ? "En trámite" : "No tiene"}</dd>
              <dt className="text-[var(--franco-text-muted)]">Busca</dt><dd className="m-0">{perfil.objetivo}{perfil.preocupaciones.length ? ` · le preocupa: ${perfil.preocupaciones.join(", ")}` : ""}</dd>
              <dt className="text-[var(--franco-text-muted)]">Actualizado</dt><dd className="m-0">{fmtDateShort(perfil.updatedAt)}{perfil.avisarCuandoAlcance ? " · pidió aviso cuando algo le alcance" : ""}</dd>
            </dl>
          ) : <p className="m-0 font-body text-[13px] text-[var(--franco-text-muted)]">Todavía no hace su perfil.</p>}
        </section>
      </div>

      <section className={`${caja} overflow-x-auto`} data-admin="inv2-ficha-deptos">
        <h2 className="m-0 mb-3 font-heading text-lg font-bold">Deptos</h2>
        <table className="w-full min-w-[960px] border-collapse font-body text-[13px]">
          <thead>
            <tr className="border-b border-[var(--franco-border)] text-left font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-muted)]">
              <th className={th}>Estado</th><th className={th}>Depto</th><th className={th}>Precio</th><th className={th}>Veredicto</th><th className={th}>Al mes</th><th className={th}>¿Le alcanza?</th><th className={th}>Publicación</th><th className={th}>Detalles</th>
            </tr>
          </thead>
          <tbody>
            {(deptos ?? []).length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-[var(--franco-text-muted)]">Sin deptos todavía.</td></tr>}
            {(deptos ?? []).map((d) => {
              const datos = (d.datos ?? {}) as DatosDepto;
              const al = datos.flujoCLP != null ? textoAlMes({ flujoCLP: datos.flujoCLP }) : null;
              const vig = (d.vigente ?? null) as { publicado?: boolean | null } | null;
              return (
                <tr key={d.aviso_id as string} className="border-b border-[var(--franco-border)] last:border-0" data-estado={d.estado as string}>
                  <td className={`${td} whitespace-nowrap font-semibold`}>{ESTADO_DEPTO[d.estado as string] ?? (d.estado as string)}<div className="text-[11px] font-normal text-[var(--franco-text-muted)]">{d.origen as string}{d.etiqueta ? ` · ${ETIQUETAS[d.etiqueta as Etiqueta] ?? d.etiqueta}` : ""}</div></td>
                  <td className={td}>{lineaDepto(datos) || (d.aviso_id as string)}<div className="font-mono text-[11px] text-[var(--franco-text-muted)]">{d.aviso_id as string}</div></td>
                  <td className={`${td} whitespace-nowrap`}>{datos.precioUF ? `UF ${fmtUF(datos.precioUF)}` : "—"}</td>
                  <td className={`${td} whitespace-nowrap`}>{datos.veredicto ? etiquetaVeredicto(datos.veredicto, "frase") : "—"}{datos.score != null ? ` · ${datos.score}` : ""}</td>
                  <td className={`${td} whitespace-nowrap`}>{al ? <span className={al.pones ? "text-[var(--signal-red)]" : undefined}>{al.t}</span> : "—"}</td>
                  <td className={`${td} whitespace-nowrap`}>{d.alcanza ? "Sí" : "No"}</td>
                  <td className={`${td} whitespace-nowrap`}>{vig?.publicado === false ? "Despublicado" : vig?.publicado ? "Publicado" : "—"}{d.publicacion_leida_at ? <div className="text-[11px] text-[var(--franco-text-muted)]">leída {fmtDateShort(d.publicacion_leida_at as string)}</div> : null}</td>
                  <td className={`${td} whitespace-nowrap`}>{informe.get(d.aviso_id as string) ? <Link href={`/analisis/${informe.get(d.aviso_id as string)}`} className="underline underline-offset-2">informe</Link> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className={caja} data-admin="inv2-ficha-flujo">
        <h2 className="m-0 mb-3 font-heading text-lg font-bold">Flujo de sus deptos</h2>
        {elegidos.length === 0 && <p className="m-0 font-body text-[13px] text-[var(--franco-text-muted)]">Sin deptos elegidos.</p>}
        <div className="flex flex-col gap-5">
          {elegidos.map((d) => {
            const id = d.aviso_id as string;
            const u = ubic[id];
            const pin = pinDe.get(id);
            return (
              <div key={id} className="border-b border-[var(--franco-border)] pb-4 last:border-0">
                <p className="m-0 mb-2 font-body text-[13px] font-semibold">{lineaDepto((d.datos ?? {}) as DatosDepto) || id} <span className="font-mono text-[11px] font-normal text-[var(--franco-text-muted)]">{id}</span></p>
                <GestionDepto userId={userId} avisoId={id} etapa={etapaDe({ estado: "elegido", etapa: (d.etapa as string | null) ?? null }) ?? "confirmando"} acuerdo={(d.acuerdo as string | null) ?? null} alternativa={(d.alternativa_aviso_id as string | null) ?? null}
                  comuna={pin?.comuna ?? null} pin={pin?.lat != null && pin?.lng != null ? { lat: Number(pin.lat), lng: Number(pin.lng) } : null}
                  preguntas={preguntasDe[id] ?? []}
                  rango={rangoDe[id] ?? null}
                  oferta={ofertaDe.get(id) ?? null}
                  ubicacion={u ? { direccion: u.direccion, numero: u.numero, lat: u.lat, lng: u.lng, distanciaM: u.distanciaM, veredicto: u.analisis?.veredicto ?? null, precioComprarUF: u.precioComprarUF, flujoCLP: u.analisis?.flujoCLP ?? null } : null} />
              </div>
            );
          })}
        </div>
      </section>

      <section className={caja} data-admin="inv2-ficha-cambios">
        <h2 className="m-0 mb-3 font-heading text-lg font-bold">Cambios en la publicación</h2>
        {(cambios ?? []).length === 0 && <p className="m-0 font-body text-[13px] text-[var(--franco-text-muted)]">Ninguno todavía.</p>}
        <ul className="m-0 flex list-none flex-col gap-1 p-0 font-body text-[13px]">
          {(cambios ?? []).map((c, i) => (
            <li key={i}>
              <span className="font-semibold">{linea.get(c.aviso_id as string) || (c.aviso_id as string)}</span> · {lineaCambio({ tipo: c.tipo as TipoCambio, antes: (c.antes ?? {}) as Record<string, unknown>, despues: (c.despues ?? {}) as Record<string, unknown> }, c.fecha as string) ?? (c.tipo === "publicador" ? "Cambió quién publica" : (c.tipo as string))}
              <span className="text-[12px] text-[var(--franco-text-muted)]"> · {c.en_base ? "en la base" : "solo interno"}{c.correo_at ? ` · correo ${fmtDateShort(c.correo_at as string)}` : c.relevante ? " · correo pendiente" : ""}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={caja} data-admin="inv2-ficha-bitacora">
        <h2 className="m-0 mb-3 font-heading text-lg font-bold">Bitácora</h2>
        <ul className="m-0 flex list-none flex-col gap-1 p-0 font-body text-[12px]">
          {(bitacora ?? []).map((r) => (
            <li key={r.id as number}><span className="font-mono text-[var(--franco-text-muted)]">{fmtDateShort(r.created_at as string)}</span> · {r.actor as string}{r.actor_email ? ` (${r.actor_email})` : ""} · <span className="font-semibold">{r.accion as string}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const ESTADO_PRE: Record<string, string> = { subir: "sin subir", en_revision: "en revisión", aprobada: "aprobada", por_corregir: "por corregir", sin_credito: "sin crédito", explicando: "todavía no la tiene" };

/** Lo que propuso la IA (o por qué no leyó): la persona de Franco lo confirma antes de aprobar. */
function LecturaIA({ ia, modelo, costo }: { ia: Record<string, unknown> | null; modelo: string | null; costo: number | null }) {
  if (!ia) return <p className="m-0 mt-2 text-[12px] text-[var(--franco-text-muted)]">Sin lectura de la IA.</p>;
  if (ia.sinLectura) return <p className="m-0 mt-2 text-[12px] text-[var(--franco-text-muted)]">La IA no la leyó ({ia.sinLectura === "formato" ? "formato HEIC" : ia.sinLectura === "rechazo" ? "se negó" : "falló"}): revísala a mano.</p>;
  const c = (ia.certeza ?? {}) as Record<string, string>;
  const nc = ia.nombreCoincide;
  return (
    <div className="mt-2 rounded-xl border border-[var(--franco-border)] p-3 text-[12px]" data-admin="inv2-lectura-ia">
      <p className="m-0 font-semibold">Lo que leyó la IA{ia.esPreaprobacion === false ? " · ⚠ no parece una preaprobación" : ""}</p>
      <p className="m-0">Banco: {String(ia.banco ?? "—")} ({c.banco ?? "—"}) · Monto: {ia.monto != null ? `${String(ia.monto)} ${String(ia.moneda ?? "")}` : "—"}{ia.montoUF != null && ia.moneda === "CLP" ? ` ≈ UF ${String(ia.montoUF)}` : ""} ({c.monto ?? "—"}) · Vigente hasta: {String(ia.vigenteHasta ?? "—")} ({c.vigencia ?? "—"})</p>
      <p className="m-0">Titular: {String(ia.nombreTitular ?? "—")}{ia.rutTitular ? ` · ${String(ia.rutTitular)}` : ""} · {nc === true ? "coincide con la orden" : nc === false ? "⚠ NO coincide con la orden" : "sin nombre para comparar"}</p>
      {typeof ia.observaciones === "string" && <p className="m-0">Observación: {ia.observaciones}</p>}
      <p className="m-0 text-[var(--franco-text-muted)]">{modelo ?? ""}{costo != null ? ` · US$${costo.toFixed(4)}` : ""}</p>
    </div>
  );
}

/** Lo que cambió, con las mismas líneas de la base (la tarea guarda los cambios de ese día). */
function resumenDetalle(d: Record<string, unknown>): string {
  const fecha = typeof d.fecha === "string" ? d.fecha : "";
  const cs = Array.isArray(d.cambios) ? (d.cambios as { tipo: TipoCambio; antes: Record<string, unknown>; despues: Record<string, unknown> }[]) : [];
  return cs.map((c) => lineaCambio({ tipo: c.tipo, antes: c.antes ?? {}, despues: c.despues ?? {} }, fecha)).filter(Boolean).join(" · ");
}
