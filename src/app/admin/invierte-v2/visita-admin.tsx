"use client";

// LA VISITA EN EL ADMIN (24-nov-2026; decisiones 4 y 6 de Fabrizio). Tres cosas, en el orden en que pasan: lo que respondió quien vende a
// «mantener la contraoferta» (si acepta, la fecha nueva), el día de la visita, y el reporte: los puntos que se revisaron (tema y lo que se
// vio; si es un arreglo concreto y si ya se veía en las fotos), remodelación si corresponde, la línea que ve la persona y la fecha. Los
// arreglos que la lectura vio en las fotos vienen precargados para marcarlos. Al publicar, el rango y lo que sugiere Franco se recalculan.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motivoAdminOferta } from "@/lib/invierte-v2/b4";
import type { OfertaVista } from "@/lib/invierte-v2/rango-servidor";
import type { PuntoVisita, VisitaResumen } from "@/lib/invierte-v2/visita";

const CLASE_BTN = "rounded-full border border-[var(--franco-border)] px-3 py-1 font-body text-[12px] text-[var(--franco-text)] disabled:opacity-50";
const CAMPO = "rounded-md border border-[var(--franco-border)] bg-[var(--franco-card)] px-2 py-1 font-body text-[13px] text-[var(--franco-text)]";
const TEMAS = ["Baños", "Cocina", "Piso y ascensor", "Ruido"];
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());

async function llamar(cuerpo: Record<string, unknown>): Promise<{ ok: boolean; error?: string; delta?: number; sugeridaUF?: number | null }> {
  const r = await fetch("/api/admin/invierte-v2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) }).catch(() => null);
  if (!r) return { ok: false, error: "red" };
  const d = (await r.json().catch(() => ({}))) as { error?: string; delta?: number; sugeridaUF?: number | null };
  return { ok: r.ok, ...d };
}

export function VisitaAdmin({ o, v, arreglosFotos }: { o: OfertaVista; v: VisitaResumen | null; arreglosFotos: string[] }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [estado, setEstado] = useState<string | null>(null);
  const [fechaMantener, setFechaMantener] = useState("");
  const [agenda, setAgenda] = useState("");
  const [puntos, setPuntos] = useState<PuntoVisita[]>(() => [
    ...arreglosFotos.slice(0, 4).map((t) => ({ tema: "Arreglo de las fotos", texto: t, arreglo: true, enFotos: true })),
    ...TEMAS.map((t) => ({ tema: t, texto: "", arreglo: false, enFotos: false })),
  ]);
  const [remodelacion, setRemodelacion] = useState(false);
  const [linea, setLinea] = useState("");
  const [fecha, setFecha] = useState(hoy());
  async function enviar(cuerpo: Record<string, unknown>) {
    setOcupado(true); setEstado(null);
    const x = await llamar(cuerpo);
    setOcupado(false);
    if (!x.ok) { setEstado(motivoAdminOferta(x.error)); return; }
    router.refresh();
  }
  const cambiar = (i: number, c: Partial<PuntoVisita>) => setPuntos((ps) => ps.map((p, j) => (j === i ? { ...p, ...c, enFotos: (c.arreglo ?? p.arreglo) ? (c.enFotos ?? p.enFotos) : false } : p)));
  const pideMantener = o.estado === "contraoferta" && !!o.mantenerPedidoAt && !o.mantenerRespuesta;
  const abierta = !!v && ["pedida", "agendada", "visitada"].includes(v.estado);
  if (!v && !pideMantener) return null;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--franco-border)] p-3" data-admin="inv2-visita">
      <p className="m-0"><b>Visita</b>{v ? ` · ${v.estado}${v.pedidaDesde ? ` · pedida desde ${v.pedidaDesde}` : ""}${v.visitadaAt ? ` · visitada ${v.visitadaAt.slice(0, 10)}` : ""}` : " · sin pedir"}
        {o.mantenerRespuesta ? ` · mantener la contraoferta: ${o.mantenerRespuesta === "acepta" ? "acepta" : "no acepta"}` : ""}
        {v?.estado === "reporte_publicado" ? ` · ${v.reporteEstado}${v.delta ? ` (+${v.delta} punto de rebaja)` : ""} · sugiere ${v.sugeridaAntesUF ?? "—"} → ${v.sugeridaDespuesUF ?? "—"}` : ""}</p>
      {pideMantener && (
        <span className="flex flex-wrap items-center gap-2" data-admin="inv2-mantener">
          <span className="text-[12px]">¿Quien vende mantiene la contraoferta mientras se visita?</span>
          <input type="date" value={fechaMantener} onChange={(e) => setFechaMantener(e.target.value)} aria-label="Se mantiene hasta" className={CAMPO} />
          <button type="button" className={CLASE_BTN} disabled={ocupado || !fechaMantener} onClick={() => void enviar({ accion: "visita_mantener", ofertaId: o.id, acepta: true, fecha: fechaMantener })} data-admin="inv2-mantener-si">Acepta hasta esa fecha</button>
          <button type="button" className={CLASE_BTN} disabled={ocupado} onClick={() => void enviar({ accion: "visita_mantener", ofertaId: o.id, acepta: false })} data-admin="inv2-mantener-no">No acepta esperar</button>
        </span>
      )}
      {v?.estado === "pedida" && (
        <span className="flex flex-wrap items-center gap-2" data-admin="inv2-agendar">
          <input type="datetime-local" value={agenda} onChange={(e) => setAgenda(e.target.value)} aria-label="Día y hora de la visita" className={CAMPO} />
          <button type="button" className={CLASE_BTN} disabled={ocupado || !agenda} onClick={() => void enviar({ accion: "visita_agendar", visitaId: v.id, fecha: agenda })} data-admin="inv2-agendar-btn">Agendada</button>
        </span>
      )}
      {abierta && (
        <div className="flex flex-col gap-2" data-admin="inv2-reporte">
          <p className="m-0 text-[12px]">El reporte: lo que se revisó. Un arreglo concreto que no se veía en las fotos suma un punto de rebaja; uno que ya se veía, no.</p>
          {puntos.map((p, i) => (
            <span key={i} className="flex flex-wrap items-center gap-2">
              <input value={p.tema} onChange={(e) => cambiar(i, { tema: e.target.value })} aria-label="Tema" placeholder="Tema" className={`${CAMPO} w-36`} />
              <input value={p.texto} onChange={(e) => cambiar(i, { texto: e.target.value })} aria-label="Lo que se vio" placeholder="Lo que se vio" className={`${CAMPO} min-w-[280px] flex-1`} />
              <label className="text-[12px]"><input type="checkbox" checked={p.arreglo} onChange={(e) => cambiar(i, { arreglo: e.target.checked })} /> Arreglo</label>
              {p.arreglo && <label className="text-[12px]"><input type="checkbox" checked={p.enFotos} onChange={(e) => cambiar(i, { enFotos: e.target.checked })} /> Se veía en las fotos</label>}
            </span>
          ))}
          <span className="flex flex-wrap items-center gap-2">
            <button type="button" className={CLASE_BTN} onClick={() => setPuntos((ps) => [...ps, { tema: "", texto: "", arreglo: false, enFotos: false }])} disabled={puntos.length >= 12}>Otro punto</button>
            <label className="text-[12px]"><input type="checkbox" checked={remodelacion} onChange={(e) => setRemodelacion(e.target.checked)} /> Necesita remodelación</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha de la visita" className={CAMPO} />
          </span>
          <input value={linea} onChange={(e) => setLinea(e.target.value)} aria-label="La línea que ve la persona" placeholder="La línea que ve la persona (vacía: el primer arreglo, o «El estado coincide con las fotos»)" className={`${CAMPO} min-w-[320px]`} />
          <span><button type="button" className={CLASE_BTN} disabled={ocupado || !puntos.some((p) => p.tema.trim() && p.texto.trim())} onClick={() => void enviar({ accion: "visita_reporte", visitaId: v!.id, puntos: puntos.filter((p) => p.tema.trim() && p.texto.trim()), remodelacion, linea, fecha })} data-admin="inv2-publicar-reporte">{ocupado ? "Publicando…" : "Publicar reporte"}</button></span>
        </div>
      )}
      {estado && <span className="text-[12px] text-[var(--signal-red)]" role="alert">{estado}</span>}
    </div>
  );
}
