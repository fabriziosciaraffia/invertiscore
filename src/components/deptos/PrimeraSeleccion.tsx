"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LA PRIMERA SELECCIÓN (20-oct-2026, regla de producto de Fabrizio): quien se registra ve sus deptos ahí mismo y es
// llevado a analizar uno. No espera. Al terminar «Estás dentro», por cualquier puerta —/deptos, la página del invitado y
// sobre el informe (el banner)—, esta pantalla trae sus primeros deptos de la evaluación de anoche con el perfil que
// tenga (GET /api/deptos/primeros), cada uno con «Analizar este» —el mismo aviso antes de gastar y la misma ruta que la
// página semanal—, y arriba «Tienes un análisis de regalo: elige uno». Mientras el correo del día revisa las fichas, la
// pantalla vuelve a preguntar. Si el perfil no alcanza para armar una selección, pide los chips que falten en un toque
// (PUT /api/perfil-busqueda) y se arma. Las tarjetas son las de la guía (guia.css); los chips, los de /deptos.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { hojaSinDeptos, marcaVisto, PRIMERA_SELECCION, tituloHoja, type FaltaDelPerfil } from "@/lib/guia/del-dia";
import { GUIA } from "@/lib/guia/copy";
import { SEMANAL_PAGINA } from "@/lib/guia/semanal";
import { rutaTres } from "@/lib/tres-analisis";
import { leerPuertaCandidata } from "@/lib/atribucion-puerta";
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { COMUNAS_DESTACADAS, RANGOS_UF, TIPOLOGIAS_DEPTOS } from "@/lib/deptos/respuesta";
import { AvisoAntesDeAnalizar } from "@/components/guia/AvisoAntesDeAnalizar";
import type { PrimerosDeLaCuenta } from "@/lib/deptos/primeros-servidor";
import type { PrimerDepto } from "@/lib/deptos/servidor";
import "@/components/guia/guia.css";
import "@/app/deptos/deptos.css";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const ESPERA_MS = 4000;
const PREGUNTAS_MAX = 25;
const ESPERA_EN_CURSO_MS = 4000;
const DESTACADAS = COMUNAS_DESTACADAS as readonly string[];

export function PrimeraSeleccion({ volver, titulo = true }: {
  /** Adónde vuelve el checkout del pack si no le quedan análisis (esta misma pantalla). */
  volver: string;
  /** Sin el título de arriba (la casa lo pone ella). */
  titulo?: boolean;
}) {
  const router = useRouter();
  const [datos, setDatos] = useState<PrimerosDeLaCuenta | null>(null);
  const [fallo, setFallo] = useState(false);
  const [generando, setGenerando] = useState<string | null>(null);
  const [error, setError] = useState<{ avisoId: string; texto: string } | null>(null);
  const [confirmar, setConfirmar] = useState<{ it: PrimerDepto; sin: boolean } | null>(null);
  const [eleccion, setEleccion] = useState<{ comuna: string | null; tipologia: string | null; rango: string | null }>({ comuna: null, tipologia: null, rango: null });
  const [armando, setArmando] = useState(false);
  const vueltas = useRef(0);
  const vivo = useRef(true);

  const leer = useCallback(async () => {
    try {
      const candidata = leerPuertaCandidata();
      const res = await fetch(`/api/deptos/primeros${candidata ? `?puerta=${candidata.puerta}` : ""}`, { cache: "no-store" });
      if (!vivo.current) return;
      if (!res.ok) { setFallo(true); return; }
      const d = (await res.json()) as PrimerosDeLaCuenta;
      setFallo(false);
      setDatos(d);
      // Mientras el correo del día revisa fichas, se vuelve a preguntar (cambian las marcas y la lista).
      if (d.revisando && ++vueltas.current < PREGUNTAS_MAX) window.setTimeout(() => { if (vivo.current) void leer(); }, ESPERA_MS);
    } catch {
      if (vivo.current) setFallo(true);
    }
  }, []);

  useEffect(() => {
    vivo.current = true;
    void leer();
    return () => { vivo.current = false; };
  }, [leer]);

  async function armar() {
    if (!datos || armando) return;
    const cambios: Record<string, unknown> = {};
    if (datos.faltan.includes("comuna")) { if (!eleccion.comuna) return; cambios.comunas = [eleccion.comuna]; }
    if (datos.faltan.includes("tipologia")) { const t = TIPOLOGIAS_DEPTOS.find((x) => x.id === eleccion.tipologia); if (!t) return; cambios.dormitorios = t.dorms; }
    if (datos.faltan.includes("rango")) { const r = RANGOS_UF.find((x) => x.id === eleccion.rango); if (!r) return; cambios.precioMaxUf = r.max; if (r.min) cambios.precioMinUf = r.min; }
    setArmando(true);
    setFallo(false);
    try {
      const res = await fetch("/api/perfil-busqueda", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cambios) });
      if (!res.ok) { setFallo(true); return; }
      setDatos(null);
      await leer();
    } finally {
      setArmando(false);
    }
  }

  async function analizar(it: PrimerDepto) {
    if (!datos?.combinacion || !datos.token || generando) return;
    setError(null);
    setGenerando(it.avisoId);
    try {
      for (let intento = 0; intento < 8; intento++) {
        const res = await fetch("/api/lo-que-sigue/guia/analizar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origenId: datos.origenId, avisoId: it.avisoId, piePct: datos.combinacion.piePct, plazoAnios: datos.combinacion.plazoAnios, semanal: datos.token }),
        });
        if (res.status === 409) { await new Promise((ok) => setTimeout(ok, ESPERA_EN_CURSO_MS)); continue; }
        const d = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
        if (res.ok && d.id) { router.push(`/analisis/${d.id}`); return; }
        // Se dio de baja recién, o la cola ya rearmó la selección sin este: se vuelve a pedir la lista.
        if ((res.status === 410 && d.error === "despublicado") || d.error === "combinacion") { setDatos(null); await leer(); break; }
        if (d.error === "sin-creditos") { setConfirmar({ it, sin: true }); break; }
        setError({ avisoId: it.avisoId, texto: GUIA.error });
        break;
      }
    } catch {
      setError({ avisoId: it.avisoId, texto: GUIA.error });
    }
    setGenerando(null);
  }

  const saldo = datos?.saldo;
  const usa = saldo?.tipo === "con" ? (saldo.proximoRegalo ? SEMANAL_PAGINA.usaRegalo : SEMANAL_PAGINA.usaUno(saldo.n)) : saldo?.tipo === "regalo" ? SEMANAL_PAGINA.usaRegalo : null;
  const rutaCompra = (avisoId: string) => rutaTres("semanal", { volver: datos?.token ? `/semanal?t=${datos.token}&a=${avisoId}` : volver });
  const chip = (activo: boolean, texto: string, al: () => void, clave: string) => (
    <button key={clave} type="button" role="radio" className="dp-chip" aria-checked={activo} data-activo={activo ? "1" : undefined} onClick={al}>{texto}</button>
  );
  const pregunta = (f: FaltaDelPerfil) => {
    if (f === "comuna") {
      return (
        <fieldset key={f} className="dp-bloque" data-primera="falta-comuna">
          <legend className="dp-pregunta">{PRIMERA_SELECCION.faltaComuna}</legend>
          <div className="dp-chips" role="radiogroup" aria-label={PRIMERA_SELECCION.faltaComuna}>
            {DESTACADAS.map((c) => chip(eleccion.comuna === c, c, () => setEleccion((e) => ({ ...e, comuna: c })), c))}
            <label className="dp-chip dp-chip-otra" style={{ position: "relative" }}>
              {eleccion.comuna && !DESTACADAS.includes(eleccion.comuna) ? eleccion.comuna : "Otra comuna…"}
              <select aria-label="Otra comuna" value={eleccion.comuna && !DESTACADAS.includes(eleccion.comuna) ? eleccion.comuna : ""} onChange={(e) => setEleccion((x) => ({ ...x, comuna: e.target.value || null }))}
                style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer" }}>
                <option value="">Otra comuna…</option>
                {COMUNAS_DISPONIBLES.filter((c) => !DESTACADAS.includes(c)).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
        </fieldset>
      );
    }
    if (f === "tipologia") {
      return (
        <fieldset key={f} className="dp-bloque" data-primera="falta-tipologia">
          <legend className="dp-pregunta">{PRIMERA_SELECCION.faltaTipologia}</legend>
          <div className="dp-chips" role="radiogroup" aria-label={PRIMERA_SELECCION.faltaTipologia}>
            {TIPOLOGIAS_DEPTOS.map((t) => chip(eleccion.tipologia === t.id, t.chip, () => setEleccion((e) => ({ ...e, tipologia: t.id })), t.id))}
          </div>
        </fieldset>
      );
    }
    return (
      <fieldset key={f} className="dp-bloque" data-primera="falta-rango">
        <legend className="dp-pregunta">{PRIMERA_SELECCION.faltaRango}</legend>
        <div className="dp-chips" role="radiogroup" aria-label={PRIMERA_SELECCION.faltaRango}>
          {RANGOS_UF.map((r) => chip(eleccion.rango === r.id, r.chip, () => setEleccion((e) => ({ ...e, rango: r.id })), r.id))}
        </div>
      </fieldset>
    );
  };
  const listo = !!datos && datos.faltan.every((f) => (f === "comuna" ? !!eleccion.comuna : f === "tipologia" ? !!eleccion.tipologia : !!eleccion.rango));
  // Sin deptos, la bajada no va encima de «no hay uno»: queda solo «ninguno», y con regalo el título dice que queda guardado
  // (20-oct-2026).
  const sinDeptos = hojaSinDeptos(datos);

  return (
    <section className="guia dp" data-primera="seleccion" data-fuente={datos?.fuente} data-estado={datos ? (datos.revisando ? "revisando" : "lista") : fallo ? "error" : "cargando"}>
      {titulo && <h2 className="guia-bloque" data-primera="titulo">{tituloHoja({ regalo: !!datos?.regaloVence, sinDeptos })}</h2>}
      {titulo && !sinDeptos && <p className="guia-txt" data-primera="bajada">{PRIMERA_SELECCION.bajada}</p>}

      {!datos && !fallo && <p className="guia-txt mt-3" role="status" aria-live="polite" data-primera="cargando">{PRIMERA_SELECCION.cargando}</p>}
      {fallo && (
        <div className="mt-3" data-primera="error">
          <p className="guia-error" role="alert">{PRIMERA_SELECCION.error}</p>
          <div className="guia-acc"><button type="button" className="guia-an" onClick={() => { setFallo(false); void leer(); }}>{PRIMERA_SELECCION.reintentar}</button></div>
        </div>
      )}

      {datos && datos.faltan.length > 0 && (
        <div className="mt-3" data-primera="faltan">
          <p className="guia-txt">{PRIMERA_SELECCION.faltan}</p>
          <div className="mt-2 flex flex-col gap-3">{datos.faltan.map(pregunta)}</div>
          <div className="guia-acc">
            <button type="button" className="guia-an" onClick={() => void armar()} disabled={!listo || armando} data-presionado={armando ? "1" : undefined}>{PRIMERA_SELECCION.armar}</button>
          </div>
        </div>
      )}

      {datos && datos.faltan.length === 0 && (
        <>
          {datos.revisando && <p className="guia-txt mt-3" role="status" aria-live="polite" data-primera="revisando">{PRIMERA_SELECCION.revisando}</p>}
          {sinDeptos && <p className="guia-txt mt-3" data-primera="ninguno">{PRIMERA_SELECCION.ninguno}</p>}
          {datos.vecinas && datos.items.length > 0 && <p className="guia-txt mt-3" data-primera="vecinas">{PRIMERA_SELECCION.vecinas}</p>}
          {datos.items.length > 0 && (
            <div className="guia-lista mt-3">
              {datos.items.map((it) => {
                const neg = (it.flujo ?? 0) < 0;
                const puede = !!datos.token && !!it.enSeleccion && !!datos.combinacion;
                return (
                  <article key={it.avisoId} className="guia-av" data-visto={it.vistoAt ? "1" : "0"} data-primera="depto">
                    <div className="guia-top">
                      <span className="guia-ojo">{[it.comuna, it.tipologia, `${miles(it.m2)} m²`].filter(Boolean).join(" · ")}</span>
                    </div>
                    <div className="guia-precio">UF {miles(it.precioUF)}</div>
                    <div className="guia-dos">
                      <div>
                        <div className="guia-k">{GUIA.veredicto}</div>
                        <span className="guia-ver" data-veredicto={it.veredicto}>{etiquetaVeredicto(it.veredicto, "frase")} <span className="guia-pt">{it.score ?? ""}</span></span>
                      </div>
                      <div>
                        <div className="guia-k">{GUIA.flujo}</div>
                        {it.flujo != null && (
                          <div className={`guia-flujo${neg ? " guia-neg" : ""}`}>
                            {neg ? "−" : "+"}${miles(Math.abs(it.flujo))}
                            <small>{neg ? GUIA.saleDeTuBolsillo : GUIA.teQueda}</small>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="guia-cr mt-2.5" data-primera="marca">{it.vistoAt ? marcaVisto(it.vistoAt) : PRIMERA_SELECCION.porConfirmar}</p>
                    {error?.avisoId === it.avisoId && <p className="guia-error" role="alert">{error.texto}</p>}
                    {puede && (
                      <div className="guia-acc">
                        <button type="button" className="guia-an" onClick={() => { setError(null); setConfirmar({ it, sin: false }); }} disabled={!!generando} data-presionado={generando === it.avisoId ? "1" : undefined} data-primera="analizar">
                          {generando === it.avisoId ? GUIA.analizando : GUIA.analizar}
                        </button>
                        {usa && <span className="guia-cr">· {usa}</span>}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {confirmar && datos?.combinacion && (
        <AvisoAntesDeAnalizar
          depto={{ comuna: confirmar.it.comuna, tipologia: confirmar.it.tipologia, m2: confirmar.it.m2, precioUF: confirmar.it.precioUF }}
          combinacion={datos.combinacion}
          finanzas={{ tasa: datos.finanzas.tasa, uf: datos.finanzas.uf, arriendo: datos.finanzas.arriendos[confirmar.it.avisoId] ?? null }}
          uso={confirmar.sin ? { tipo: "sin" } : datos.saldo}
          rutaCompra={rutaCompra(confirmar.it.avisoId)}
          alAnalizar={() => { const it = confirmar.it; setConfirmar(null); void analizar(it); }}
          alCancelar={() => setConfirmar(null)}
        />
      )}
    </section>
  );
}
