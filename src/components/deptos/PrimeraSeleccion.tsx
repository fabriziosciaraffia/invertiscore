"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LA PRIMERA SELECCIÓN (20-oct-2026, regla de producto de Fabrizio): quien se registra ve sus deptos ahí mismo y es
// llevado a analizar uno. No espera. Al terminar «Estás dentro», por cualquier puerta —/deptos, la página del invitado y
// sobre el informe (el banner)—, esta pantalla trae sus primeros deptos de la evaluación de anoche con el perfil que
// tenga (GET /api/deptos/primeros), cada uno con «Analizar este». Mientras el correo del día revisa las fichas, la
// pantalla vuelve a preguntar. Si el perfil no alcanza para armar una selección, pide los campos que falten (los mismos
// tres de /deptos, CamposBusqueda) y se arma (PUT /api/perfil-busqueda).
// SEGÚN EL MOCKUP `2-estas-dentro.html` (23-oct-2026, decisión de Fabrizio): «Tu selección», «Franco eligió estos 5 deptos
// para tu búsqueda.», «Publicaciones vigentes y analizadas con tu perfil de búsqueda. Usa tu regalo en el que más te
// interese.»; tarjetas numeradas con el pin rojo —el nombre, el precio, el veredicto con su color y el flujo— y «Analizar
// este · usa tu regalo» (el primero en tinta, los demás en contorno); tres a la vista y «Ver los 2 que faltan». El ORDEN es
// el de la selección (lib/guia/semanal.ts › ordenFijo): el mismo del dashboard y del correo. Sin la marca del chequeo por
// tarjeta ni lo del correo: lo dice la bajada.
// 21-oct-2026 (recorrido real de Fabrizio por la puerta B), igual que la selección del dashboard (semanal-lista.tsx): el
// aviso queda abierto con «Franco está analizando este depto…» hasta que abre el informe; sin saldo, el pack —al precio
// del ticket si la cuenta tiene menos de 24 horas— y «Comprar solo 1», de vuelta al dashboard con el depto; y el ya
// analizado dice «Ya lo analizaste · Ver informe», también al volver atrás desde el informe (la pantalla se relee).
// EL POP-UP RECALCULA (23-oct-2026, mockups D1 y D2): «Cambiar» abre el pie y el plazo, el veredicto se recalcula al tiro
// (POST /api/deptos/recalcular) y «Analizar» va con la combinación elegida; nunca se cobra sin mostrar el veredicto recalculado.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { hojaSinDeptos, PRIMERA_SELECCION, TARJETAS_A_LA_VISTA, textoAnalizar, tituloSeleccion } from "@/lib/guia/del-dia";
import { GUIA } from "@/lib/guia/copy";
import { YA_ANALIZADO } from "@/lib/guia/semanal-str";
import { botonOcupado, claveActual, iniciarCarga } from "@/lib/carga-global";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { comprasDelDepto, ticketConSaldoDelDepto } from "@/lib/guia/compra-desde-depto";
import { recalcularDepto } from "@/lib/guia/recalcular-cliente";
import { leerPuertaCandidata } from "@/lib/atribucion-puerta";
import { ELECCIONES_POR_DEFECTO, RANGOS_UF, TIPOLOGIA_POR_DEFECTO, TIPOLOGIAS_DEPTOS } from "@/lib/deptos/respuesta";
import { AvisoAntesDeAnalizar } from "@/components/guia/AvisoAntesDeAnalizar";
import { CamposBusqueda, type ValorBusqueda } from "@/components/deptos/CamposBusqueda";
import type { Combinacion } from "@/lib/guia/seleccion";
import type { PrimerosDeLaCuenta } from "@/lib/deptos/primeros-servidor";
import type { PrimerDepto } from "@/lib/deptos/servidor";
import "@/app/deptos/deptos.css";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const ESPERA_MS = 4000;
const PREGUNTAS_MAX = 25;
const ESPERA_EN_CURSO_MS = 4000;

export function PrimeraSeleccion({ encabezado = "dentro" }: {
  /** Dónde se monta: en «Estás dentro» (el kicker y el título) o en la casa (el título de sección de la casa). */
  encabezado?: "dentro" | "casa";
}) {
  const router = useRouter();
  const [datos, setDatos] = useState<PrimerosDeLaCuenta | null>(null);
  const [fallo, setFallo] = useState(false);
  const [generando, setGenerando] = useState<string | null>(null);
  const [error, setError] = useState<{ avisoId: string; texto: string } | null>(null);
  const [confirmar, setConfirmar] = useState<{ it: PrimerDepto; sin: boolean; analizando?: boolean } | null>(null);
  const [eleccion, setEleccion] = useState<ValorBusqueda>({ comunas: [], tipologia: TIPOLOGIA_POR_DEFECTO, rango: ELECCIONES_POR_DEFECTO.rango });
  const [armando, setArmando] = useState(false);
  const [verTodos, setVerTodos] = useState(false);
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
    // De vuelta atrás desde el informe, restaurada del caché del navegador: se relee (el analizado, el saldo).
    const alVolver = (e: PageTransitionEvent) => { if (e.persisted) { vueltas.current = 0; void leer(); } };
    window.addEventListener("pageshow", alVolver);
    return () => { vivo.current = false; window.removeEventListener("pageshow", alVolver); };
  }, [leer]);

  // Los campos que faltan: solo esos se mandan (los demás ya están en el perfil).
  const listo = !!datos && datos.faltan.every((f) => (f === "comuna" ? eleccion.comunas.length > 0 : f === "tipologia" ? !!eleccion.tipologia : !!eleccion.rango));
  async function armar() {
    if (!datos || armando || !listo) return;
    const t = TIPOLOGIAS_DEPTOS.find((x) => x.id === eleccion.tipologia), r = RANGOS_UF.find((x) => x.id === eleccion.rango);
    const cambios: Record<string, unknown> = {};
    if (datos.faltan.includes("comuna")) cambios.comunas = eleccion.comunas;
    if (datos.faltan.includes("tipologia")) { if (!t) return; cambios.dormitorios = [...t.dorms]; }
    if (datos.faltan.includes("rango")) { if (!r) return; cambios.precioMaxUf = r.max; if (r.min) cambios.precioMinUf = r.min; }
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

  async function analizar(it: PrimerDepto, combo: Combinacion) {
    if (!datos?.combinacion || !datos.token || generando) return;
    setError(null);
    setGenerando(it.avisoId);
    // El aviso queda abierto, cargando, con la barra del header, hasta que abre el informe (21-oct-2026).
    const soltar = iniciarCarga(claveActual());
    setConfirmar({ it, sin: false, analizando: true });
    try {
      for (let intento = 0; intento < 8; intento++) {
        const res = await fetch("/api/lo-que-sigue/guia/analizar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origenId: datos.origenId, avisoId: it.avisoId, piePct: combo.piePct, plazoAnios: combo.plazoAnios, semanal: datos.token }),
        });
        if (res.status === 409) { await new Promise((ok) => setTimeout(ok, ESPERA_EN_CURSO_MS)); continue; }
        const d = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
        if (res.ok && d.id) { router.push(`/analisis/${d.id}`); return; }
        // Se dio de baja recién, o la cola ya rearmó la selección sin este: se vuelve a pedir la lista.
        if ((res.status === 410 && d.error === "despublicado") || d.error === "combinacion") { setConfirmar(null); setDatos(null); await leer(); break; }
        if (d.error === "sin-creditos") { setConfirmar({ it, sin: true }); break; }
        setConfirmar(null);
        setError({ avisoId: it.avisoId, texto: GUIA.error });
        break;
      }
    } catch {
      setConfirmar(null);
      setError({ avisoId: it.avisoId, texto: GUIA.error });
    }
    soltar();
    setGenerando(null);
  }

  const saldo = datos?.saldo;
  const usaRegalo = saldo?.tipo === "regalo" || (saldo?.tipo === "con" && !!saldo.proximoRegalo);
  // Sin deptos, la bajada no va encima de «no hay uno»: queda solo «ninguno» (20-oct-2026).
  const sinDeptos = hojaSinDeptos(datos);
  const items = datos?.faltan.length === 0 ? datos.items : [];
  const visibles = verTodos ? items : items.slice(0, TARJETAS_A_LA_VISTA);
  const faltanPorVer = items.length - visibles.length;
  const titulo = tituloSeleccion(items.length);
  const bajada = usaRegalo ? PRIMERA_SELECCION.bajadaRegalo : PRIMERA_SELECCION.bajada;

  return (
    <section className="dp dp-seccion" data-primera="seleccion" data-fuente={datos?.fuente} data-estado={datos ? (datos.revisando ? "revisando" : "lista") : fallo ? "error" : "cargando"}>
      {encabezado === "dentro" && <p className="dp-kicker">{PRIMERA_SELECCION.kicker}</p>}
      <h2 className={encabezado === "casa" ? "ca-plano-t" : "dp-h2"} data-primera="titulo">{titulo}</h2>
      {!sinDeptos && <p className="dp-txt" data-primera="bajada">{bajada}</p>}

      {!datos && !fallo && <p className="sel-estado" role="status" aria-live="polite" data-primera="cargando">{PRIMERA_SELECCION.cargando}</p>}
      {fallo && (
        <div data-primera="error">
          <p className="sel-error" role="alert">{PRIMERA_SELECCION.error}</p>
          <button type="button" className="sel-btn sel-btn-chico" onClick={() => { setFallo(false); void leer(); }}>{PRIMERA_SELECCION.reintentar}</button>
        </div>
      )}

      {datos && datos.faltan.length > 0 && (
        <div className="sel-faltan" data-primera="faltan">
          <p className="dp-txt">{PRIMERA_SELECCION.faltan}</p>
          <CamposBusqueda valor={eleccion} campos={datos.faltan} onChange={(_c, v) => setEleccion(v)} ids="primera" />
          <button type="button" className="sel-btn" data-primario="1" onClick={() => void armar()} disabled={!listo || armando} {...botonOcupado(armando)}>{PRIMERA_SELECCION.armar}</button>
        </div>
      )}

      {datos && datos.faltan.length === 0 && (
        <>
          {datos.revisando && <p className="sel-estado" role="status" aria-live="polite" data-primera="revisando">{PRIMERA_SELECCION.revisando}</p>}
          {sinDeptos && <p className="sel-estado" data-primera="ninguno">{PRIMERA_SELECCION.ninguno}</p>}
          {datos.vecinas && items.length > 0 && <p className="sel-estado" data-primera="vecinas">{PRIMERA_SELECCION.vecinas}</p>}
          {items.length > 0 && (
            <div className="sel-lista" data-primera="lista">
              {visibles.map((it, i) => {
                const neg = (it.flujo ?? 0) < 0;
                const puede = !!datos.token && !!it.enSeleccion && !!datos.combinacion;
                return (
                  <article key={it.avisoId} className="sel-av" data-primera="depto" data-n={i + 1}>
                    <div className="sel-ojo"><span className="sel-pin" aria-hidden="true">{i + 1}</span>{[it.comuna, it.tipologia, `${miles(it.m2)} m²`].filter(Boolean).join(" · ")}</div>
                    <div className="sel-precio">UF {miles(it.precioUF)}</div>
                    <div className="sel-dos">
                      <div>
                        <span className="sel-k">{GUIA.veredicto}</span>
                        <span className="sel-v" data-veredicto={it.veredicto}>{etiquetaVeredicto(it.veredicto, "frase")}{it.score != null ? ` · ${it.score}` : ""}</span>
                      </div>
                      <div>
                        <span className="sel-k">{GUIA.flujo}</span>
                        {it.flujo != null && (
                          <span className={`sel-flujo${neg ? " sel-neg" : ""}`}>
                            {neg ? "−" : "+"}${miles(Math.abs(it.flujo))} <small>{neg ? GUIA.saleDeTuBolsillo : GUIA.teQueda}</small>
                          </span>
                        )}
                      </div>
                    </div>
                    {error?.avisoId === it.avisoId && <p className="sel-error" role="alert">{error.texto}</p>}
                    {it.informeId ? (
                      <p className="sel-ya" data-primera="ya-analizado">
                        <span>{YA_ANALIZADO.texto} ·</span>
                        <EnlaceCarga href={`/analisis/${it.informeId}`}>{YA_ANALIZADO.enlace}</EnlaceCarga>
                      </p>
                    ) : puede && (
                      <button type="button" className="sel-btn" data-primario={i === 0 ? "1" : undefined} onClick={() => { setError(null); setConfirmar({ it, sin: false }); }} disabled={!!generando} {...botonOcupado(generando === it.avisoId)} data-primera="analizar">
                        {generando === it.avisoId ? GUIA.analizando : textoAnalizar(usaRegalo)}
                      </button>
                    )}
                  </article>
                );
              })}
              {faltanPorVer > 0 && <button type="button" className="sel-mas" onClick={() => setVerTodos(true)} data-primera="ver-mas">{PRIMERA_SELECCION.verMas(faltanPorVer)}</button>}
            </div>
          )}
        </>
      )}

      {confirmar && datos?.combinacion && (
        <AvisoAntesDeAnalizar
          depto={{ comuna: confirmar.it.comuna, tipologia: confirmar.it.tipologia, m2: confirmar.it.m2, precioUF: confirmar.it.precioUF, veredicto: confirmar.it.veredicto, score: confirmar.it.score, flujo: confirmar.it.flujo }}
          combinacion={datos.combinacion}
          finanzas={{ tasa: datos.finanzas.tasa, uf: datos.finanzas.uf, arriendo: datos.finanzas.arriendos[confirmar.it.avisoId] ?? null }}
          uso={confirmar.sin ? { tipo: "sin" } : datos.saldo}
          compras={datos.token ? comprasDelDepto({ token: datos.token, avisoId: confirmar.it.avisoId, origen: "semanal", ticket: !!datos.ticket }) : null}
          ticketConSaldo={datos.token && datos.ticket ? ticketConSaldoDelDepto({ token: datos.token, avisoId: confirmar.it.avisoId, origen: "semanal", cuentaCreadaAt: datos.cuentaCreadaAt }) : null}
          rutaCompra="/dashboard"
          analizando={!!confirmar.analizando}
          recalcular={datos.token ? (combo) => recalcularDepto({ token: datos.token!, avisoId: confirmar.it.avisoId, origenId: datos.origenId, combo }) : undefined}
          alAnalizar={(combo) => void analizar(confirmar.it, combo)}
          alCancelar={() => { if (!confirmar.analizando) setConfirmar(null); }}
        />
      )}
    </section>
  );
}
