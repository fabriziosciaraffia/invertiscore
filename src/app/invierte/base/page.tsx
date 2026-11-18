import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { ChipVeredicto } from "@/components/analysis/shared/ChipVeredicto";
import type { Veredicto } from "@/lib/types";
import { URL_INVIERTE } from "@/lib/invierte-v2/destino";
import { RESULTADO_COPY, fmtUF, textoAlMes } from "@/lib/invierte-v2/opciones";
import { primerNombre } from "@/lib/invierte-v2/flujo";
import { ultimaOrdenDe } from "@/lib/invierte-v2/servidor";
import { METADATA_FLUJO, sesionYAcceso } from "@/lib/invierte-v2/paginas";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { BotonDetalles, PrepararDetalles } from "@/components/invierte-v2/BotonDetalles";
import { lineaCambio, type TipoCambio } from "@/lib/invierte-v2/cambios";

// La base, PRIMERA VERSIÓN (etapa 2, entrega 1, 18-nov-2026): sus deptos elegidos, cada uno con «Abrir» (los detalles, sin
// gastar créditos), «Comparar todas» y «Buscar otro en el mapa». La base completa de la lámina 3.3 (lo que te toca hoy, otras
// opciones con «Seguir con este», el menú, los documentos) es la entrega 2. Sin acceso: 404; sin elegidos: /invierte decide.
export const dynamic = "force-dynamic";
export const metadata = METADATA_FLUJO;

interface DatosDepto { precioUF?: number; veredicto?: string | null; score?: number | null; comuna?: string; m2?: number | null; flujoCLP?: number | null }
interface FilaCambio { aviso_id: string; tipo: TipoCambio; antes: Record<string, unknown>; despues: Record<string, unknown>; fecha: string }
const PRINCIPALES: TipoCambio[] = ["precio_baja", "precio_sube", "despublicado", "republicado"];

/** Por depto: la línea del último cambio de la publicación y, debajo, lo que cambió por él ese mismo día (veredicto, al mes). */
function lineasDeCambios(cs: FilaCambio[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const c of cs) {
    if (out.has(c.aviso_id) || !PRINCIPALES.includes(c.tipo)) continue;
    const mismoDia = cs.filter((x) => x.aviso_id === c.aviso_id && x.fecha === c.fecha);
    const orden = [...mismoDia.filter((x) => PRINCIPALES.includes(x.tipo)), ...mismoDia.filter((x) => x.tipo === "veredicto"), ...mismoDia.filter((x) => x.tipo === "al_mes")];
    out.set(c.aviso_id, orden.map((x) => lineaCambio(x, x.fecha)).filter((x): x is string => !!x));
  }
  return out;
}

export default async function BasePage() {
  const { user, acceso } = await sesionYAcceso();
  if (!user || !acceso) notFound();
  const admin = createServiceClient();
  const [{ data }, orden] = await Promise.all([
    admin.from("inv_deptos").select("aviso_id, alcanza, datos").eq("user_id", user.id).eq("estado", "elegido").order("elegido_at", { ascending: true }),
    ultimaOrdenDe(admin, user.id),
  ]);
  if (!orden || !(data ?? []).length) redirect(URL_INVIERTE);
  const ids = (data ?? []).map((f) => f.aviso_id as string);
  // Lo que cambió en cada depto (entrega 2): el último cambio que va en la base, con su fecha, y lo que cambió por él ese día.
  // Y los que todavía no tienen sus detalles preparados: se preparan en segundo plano al entrar.
  const [{ data: cambios }, { data: preparados }] = await Promise.all([
    admin.from("inv_cambios").select("aviso_id, tipo, antes, despues, fecha, created_at").eq("user_id", user.id).eq("en_base", true).in("aviso_id", ids).order("created_at", { ascending: false }).limit(60),
    admin.from("guia_analisis").select("aviso_id").eq("user_id", user.id).in("aviso_id", ids).not("analysis_id", "is", null),
  ]);
  const lineas = lineasDeCambios((cambios ?? []) as FilaCambio[]);
  const sinPreparar = ids.filter((id) => !(preparados ?? []).some((p) => p.aviso_id === id));
  const nombre = primerNombre(orden.nombre);
  return (
    <MarcoInvierte volver={null} pantalla="base" layout="formulario" cabecera="Tu inversión con Franco" pc={{ sesionEmail: user.email ?? null }}>
      <div className="inv-encabezado">
        {nombre && <span className="iv2-tarjeta-et">Hola, {nombre}</span>}
        <h1 className="iv2-titulo-res" id="iv2-t">Tu inversión con Franco</h1>
      </div>
      <PrepararDetalles avisoIds={sinPreparar} />
      <section className="iv2-tarjeta" aria-labelledby="iv2-tus-t" data-inv2="tus-deptos">
        <h2 className="iv2-tarjeta-et" id="iv2-tus-t">Tus deptos</h2>
        <p className="iv2-linea-chica">{(data ?? []).length === 1 ? "El que elegiste para seguir." : `Los ${(data ?? []).length} con que elegiste seguir.`}</p>
        <ul className="iv2-mini-lista">
          {(data ?? []).map((f) => {
            const d = (f.datos ?? {}) as DatosDepto;
            const alMes = textoAlMes({ flujoCLP: d.flujoCLP ?? null });
            return (
              <li key={f.aviso_id as string}>
                <div>
                  <p className="iv2-paso-t">{[d.comuna, d.m2 ? `${Math.round(d.m2)} m²` : null].filter(Boolean).join(" · ")}</p>
                  <p className="iv2-paso-s">{d.precioUF ? `UF ${fmtUF(d.precioUF)}` : ""}{f.alcanza ? "" : " · fuera de tu alcance hoy"}</p>
                  {(lineas.get(f.aviso_id as string) ?? []).map((l, i) => <p key={i} className={i === 0 ? "iv2-cambio" : "iv2-cambio-sub"} data-inv2="cambio">{l}</p>)}
                  {d.flujoCLP != null && <p className="iv2-paso-s" data-inv2="base-al-mes">{RESULTADO_COPY.filas.pones}: <span className={alMes.pones ? "iv2-nowrap iv2-pones" : "iv2-nowrap"}>{alMes.t}</span></p>}
                  <span className="iv2-estado-ciruela">Te toca a ti</span>
                </div>
                <div className="iv2-mini-der">
                  {d.veredicto && <ChipVeredicto v={d.veredicto as Veredicto} puntaje={d.veredicto === "COMPRAR" ? d.score ?? null : null} />}
                  <BotonDetalles avisoId={f.aviso_id as string} etiqueta="Abrir" />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <div className="iv2-acciones">
        <Link href="/invierte/opciones" className="iv2-secundario" data-inv2="comparar-todas">Comparar todas</Link>
        <Link href="/explorar" className="iv2-enlace" data-inv2="buscar-mapa">Buscar otro en el mapa</Link>
        <Link href="/invierte/perfil" className="iv2-enlace" data-inv2="mi-perfil">Mi perfil de inversión</Link>
      </div>
    </MarcoInvierte>
  );
}
