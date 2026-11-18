"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 2.1 FIRMA, PASO 2 DE 2 (etapa 1 de Invierte con Franco, 18-nov-2026; lámina docs/invierte-v2-mockups/etapa-1/2.1). Nombre,
// RUT (módulo 11), la orden completa en un cuadro con scroll —llena en vivo con lo que la persona escribe—, la casilla «Leí la
// orden y la acepto» y «Firmar y partir», que se habilita al llegar al final del texto. El servidor vuelve a exigir todo.
//   · `sinContacto`: la persona llegó con cuenta pero sin contacto guardado (contestó sin cuenta, modo «todos»): se manda lo
//     que quedó en el navegador y se recarga; si no hay nada, vuelve al contacto. Se borra recién cuando la ruta respondió bien.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { botonOcupado } from "@/lib/carga-global";
import type { OrigenInvierte } from "@/lib/invierte/invierte";
import { CLAVE_PENDIENTE_V2, FLUJO_COPY, VIDA_PENDIENTE_V2_MS, textoErrorFirma, validarContacto, validarFirma } from "@/lib/invierte-v2/flujo";
import { ordenVigente, VERSION_ORDEN } from "@/lib/invierte-v2/orden";
import { formatearRut, normalizarRut } from "@/lib/invierte-v2/rut";
import { URL_PARTIMOS, urlContacto } from "@/lib/invierte-v2/destino";
import { LineaDeptoFlujo, type DeptoFlujo } from "./ContactoForm";

const F = FLUJO_COPY.firma;

export function FirmaForm({ depto, deptoCorto, origen, analysisId, sinContacto }: {
  depto: DeptoFlujo;
  /** «Ñuñoa · 2D2B · 58 m²», el depto de la cláusula 1. */
  deptoCorto: string;
  origen: OrigenInvierte;
  analysisId: string | null;
  sinContacto: boolean;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [rut, setRut] = useState("");
  const [acepto, setAcepto] = useState(false);
  const [leyo, setLeyo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const caja = useRef<HTMLDivElement>(null);

  // Lo contestado sin cuenta: se manda una vez.
  const retomado = useRef(false);
  useEffect(() => {
    if (!sinContacto || retomado.current) return;
    retomado.current = true;
    let pedido: unknown = null;
    try {
      const raw = window.localStorage.getItem(CLAVE_PENDIENTE_V2);
      const p = raw ? (JSON.parse(raw) as { pedido?: unknown; t?: number }) : null;
      if (p && typeof p.t === "number" && Date.now() - p.t <= VIDA_PENDIENTE_V2_MS) pedido = p.pedido;
    } catch { /* sin almacenamiento */ }
    const v = validarContacto(pedido as Record<string, unknown> | null);
    if (!v.ok || v.pedido.avisoId !== depto.avisoId) { router.replace(urlContacto(depto.avisoId, origen, analysisId)); return; }
    void fetch("/api/invierte-v2/contacto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v.pedido) })
      .then((r) => {
        if (!r.ok) { router.replace(urlContacto(depto.avisoId, origen, analysisId)); return; }
        try { window.localStorage.removeItem(CLAVE_PENDIENTE_V2); } catch { /* sin almacenamiento */ }
        router.refresh();
      })
      .catch(() => router.replace(urlContacto(depto.avisoId, origen, analysisId)));
  }, [sinContacto, depto.avisoId, origen, analysisId, router]);

  const revisarFinal = useCallback(() => {
    const el = caja.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) setLeyo(true);
  }, []);
  // Si el texto cabe entero (pantallas altas), ya está «al final».
  useEffect(() => { revisarFinal(); }, [revisarFinal]);

  const rutValido = normalizarRut(rut);
  const orden = ordenVigente({ nombre, rut: rutValido ? formatearRut(rutValido) : rut, depto: deptoCorto });

  async function firmar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    const v = validarFirma({ avisoId: depto.avisoId, nombre, rut, acepto, leyoHastaElFinal: leyo, version: VERSION_ORDEN });
    if (!v.ok) { setError(textoErrorFirma(v.error)); return; }
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/invierte-v2/firma", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v.pedido) });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error === "rut" || d.error === "nombre" || d.error === "final" || d.error === "casilla" ? textoErrorFirma(d.error) : textoErrorFirma("red"));
        setEnviando(false);
        return;
      }
      router.push(URL_PARTIMOS);
    } catch {
      setError(textoErrorFirma("red"));
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={firmar} noValidate style={{ display: "contents" }} data-inv2="firma-form" aria-busy={sinContacto || undefined}>
      <div className="inv-encabezado">
        <h1 className="inv-titulo" id="iv2-t">{F.titulo}</h1>
        <p className="inv-parrafo">{F.parrafo}</p>
        <p className="iv2-info"><b>{F.cajaFuerte}</b> {F.cajaResto}</p>
        <LineaDeptoFlujo depto={depto} conChip="solo-pc" />
      </div>
      <div className="inv-pregunta">
        <label htmlFor="iv2-nombre" className="inv-legend">{F.nombre}</label>
        <input id="iv2-nombre" type="text" autoComplete="name" className="inv-campo" value={nombre} onChange={(e) => { setNombre(e.target.value); setError(null); }} data-inv2="nombre" />
      </div>
      <div className="inv-pregunta">
        <label htmlFor="iv2-rut" className="inv-legend">{F.rut}</label>
        <input id="iv2-rut" type="text" inputMode="text" autoComplete="off" className="inv-campo" placeholder={F.rutPlaceholder} value={rut}
          onChange={(e) => { setRut(e.target.value); setError(null); }}
          onBlur={() => { const n = normalizarRut(rut); if (n) setRut(formatearRut(n)); }}
          aria-invalid={rut.trim() !== "" && !rutValido ? true : undefined} data-inv2="rut" />
      </div>
      <div className="inv-pregunta iv2-bloque-orden">
        <div className="iv2-orden-cab"><span>{F.tuOrden}</span><span className="iv2-version">{F.version(VERSION_ORDEN)}</span></div>
        <div ref={caja} className="iv2-orden" tabIndex={0} role="document" aria-label={orden.titulo} onScroll={revisarFinal} data-inv2="orden">
          <p className="iv2-orden-t">{orden.titulo}</p>
          <p>{orden.encabezado}</p>
          {orden.clausulas.map((c) => <p key={c.n}><b>{c.n}. {c.titulo}.</b> {c.texto}</p>)}
          <p className="iv2-orden-pie">{orden.pie}</p>
        </div>
        <span className="iv2-desliza" data-listo={leyo ? "1" : undefined}><span className="iv2-solo-movil">{F.desliza}</span><span className="iv2-solo-pc">{F.deslizaPc}</span></span>
      </div>
      <label className="iv2-casilla">
        <input type="checkbox" checked={acepto} onChange={(e) => { setAcepto(e.target.checked); setError(null); }} data-inv2="acepto" />
        <span>{F.acepto}</span>
      </label>
      {error && <p className="inv-error" role="alert">{error}</p>}
      <div className="iv2-acciones">
        <button type="submit" className="inv-principal iv2-principal" disabled={!leyo || enviando || sinContacto} {...botonOcupado(enviando)} data-inv2="firmar">{enviando ? F.firmando : F.firmar}</button>
        <a href="/faq" className="iv2-enlace">{F.preguntas}</a>
      </div>
    </form>
  );
}
