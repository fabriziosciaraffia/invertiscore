"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LA PREAPROBACIÓN EN EL NAVEGADOR (entrega 3, 19-nov-2026; láminas 3.4-preaprobacion y 3.4-preaprobacion-estados).
//   · SubirPreaprobacion: la caja punteada elige el archivo (PDF o foto, hasta 15 MB); «Subir mi preaprobación» pide la URL
//     firmada, sube el archivo directo al bucket privado y confirma. Mientras sube, el botón queda ocupado (no se aprieta dos
//     veces). `variante="perfil"` es el bloque compacto del paso 2 del perfil (se puede subir ahora o después).
//   · OtrasOpciones: «Todavía no la tengo» y «Compro sin crédito».
//   · VerPreaprobacion: «Ver lo que subí» / «Ver mi preaprobación» en la misma ventana de «Ver mi orden»; una foto se ve adentro,
//     un PDF se abre en una pestaña nueva («Abrir PDF»).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ACCEPT_PREAPROBACION, PREAPROB_COPY, URL_API_PREAPROBACION, URL_PREAPROBACION, validarArchivo } from "@/lib/invierte-v2/preaprobacion";
import { VentanaDocumento } from "./VentanaDocumento";

const P = PREAPROB_COPY;
const BUCKET = "invierte";

async function subirArchivo(file: File): Promise<"ok" | "tipo" | "tamano" | "red"> {
  const v = validarArchivo({ mime: file.type, bytes: file.size });
  if (!v.ok) return v.error;
  const r1 = await fetch(URL_API_PREAPROBACION, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "subir", mime: v.mime, bytes: v.bytes }) });
  if (!r1.ok) { const d = (await r1.json().catch(() => null)) as { error?: string } | null; return d?.error === "tipo" || d?.error === "tamano" ? d.error : "red"; }
  const { id, path, token } = (await r1.json()) as { id: string; path: string; token: string };
  const up = await createClient().storage.from(BUCKET).uploadToSignedUrl(path, token, file, { contentType: v.mime });
  if (up.error) return "red";
  const r2 = await fetch(URL_API_PREAPROBACION, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "listo", id }) });
  return r2.ok ? "ok" : "red";
}

export function SubirPreaprobacion({ variante = "pagina", alListo }: { variante?: "pagina" | "perfil"; alListo?: () => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  function elegir(f: File | null) {
    setError(null);
    if (!f) return;
    const v = validarArchivo({ mime: f.type, bytes: f.size });
    if (!v.ok) { setArchivo(null); setError(P.errores[v.error]); return; }
    setArchivo(f);
  }

  async function subir() {
    if (enviando) return;
    if (!archivo) { setError(P.errores.falta); input.current?.click(); return; }
    setEnviando(true);
    setError(null);
    const r = await subirArchivo(archivo).catch(() => "red" as const);
    setEnviando(false);
    if (r !== "ok") { setError(P.errores[r]); return; }
    if (variante === "perfil") { setListo(true); alListo?.(); return; }
    router.replace(URL_PREAPROBACION);
    router.refresh();
  }

  const caja = (
    <label className={`iv2-caja-archivo${archivo ? " iv2-caja-lista" : ""}`} data-inv2="caja-archivo">
      <input ref={input} type="file" accept={ACCEPT_PREAPROBACION} className="iv2-sr" onChange={(e) => elegir(e.target.files?.[0] ?? null)} disabled={enviando || listo} data-inv2="archivo" />
      <span className="iv2-caja-t">{archivo ? P.elegido(archivo.name) : variante === "perfil" ? P.perfilT : P.cajaT}</span>
      {!archivo && <span className="iv2-depto-s">{variante === "perfil" ? P.perfilS : P.cajaS}</span>}
    </label>
  );

  if (variante === "perfil") {
    return (
      <div className="iv2-subir-perfil" data-inv2="subir-perfil">
        {listo ? <p className="iv2-info" role="status" data-inv2="subida-perfil-lista">{P.perfilListo}</p> : (
          <>
            {caja}
            {archivo && (
              <button type="button" className="iv2-secundario" onClick={() => void subir()} disabled={enviando} aria-busy={enviando || undefined} data-inv2="subir-perfil-boton">
                {enviando ? P.subiendo : P.subir}
              </button>
            )}
          </>
        )}
        {error && <p className="inv-error" role="alert" data-inv2="subir-error">{error}</p>}
      </div>
    );
  }
  return (
    <>
      {caja}
      <div className="iv2-acciones" data-inv2="acciones-preaprobacion">
        {error && <p className="inv-error" role="alert" data-inv2="subir-error">{error}</p>}
        <button type="button" className="inv-principal iv2-principal" onClick={() => void subir()} disabled={enviando} aria-busy={enviando || undefined} data-inv2="subir">
          {enviando ? P.subiendo : P.subir}
        </button>
        <OtrasOpciones deshabilitado={enviando} />
      </div>
    </>
  );
}

/** «Todavía no la tengo» (deja la tarea de explicarle) y «Compro sin crédito» (pasa directo). */
export function OtrasOpciones({ deshabilitado = false }: { deshabilitado?: boolean }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState<"todavia-no" | "sin-credito" | null>(null);
  const [error, setError] = useState(false);
  async function pedir(accion: "todavia-no" | "sin-credito") {
    if (enviando) return;
    setEnviando(accion); setError(false);
    const ok = await fetch(URL_API_PREAPROBACION, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion }) }).then((r) => r.ok).catch(() => false);
    setEnviando(null);
    if (!ok) { setError(true); return; }
    router.refresh();
  }
  return (
    <>
      <button type="button" className="iv2-secundario" onClick={() => void pedir("todavia-no")} disabled={deshabilitado || !!enviando} aria-busy={enviando === "todavia-no" || undefined} data-inv2="todavia-no">{P.todaviaNo}</button>
      <button type="button" className="iv2-enlace" onClick={() => void pedir("sin-credito")} disabled={deshabilitado || !!enviando} aria-busy={enviando === "sin-credito" || undefined} data-inv2="sin-credito">{P.sinCredito}</button>
      {error && <p className="inv-error" role="alert">{P.errores.red}</p>}
    </>
  );
}

export function VerPreaprobacion({ etiqueta, estado, titulo, meta, mime }: { etiqueta: string; estado: string | null; titulo: string; meta: string; mime: string | null }) {
  const [abierta, setAbierta] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const esFoto = !!mime && mime.startsWith("image/") && !/hei[cf]/.test(mime);
  // La foto se muestra con la URL firmada directa (WebKit no sigue la redirección dentro de un <img>); vence en 60 s.
  useEffect(() => {
    if (!abierta || !esFoto) return;
    let vivo = true;
    fetch(`${URL_API_PREAPROBACION}?formato=json`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d: { url?: string } | null) => { if (vivo) setSrc(d?.url ?? null); }).catch(() => undefined);
    return () => { vivo = false; };
  }, [abierta, esFoto]);
  return (
    <>
      <button type="button" className="iv2-enlace-azul iv2-doc-accion" onClick={() => setAbierta(true)} aria-haspopup="dialog" data-inv2="ver-preaprobacion">{etiqueta}</button>
      {abierta && (
        <VentanaDocumento nombre="preaprobacion" estado={estado} titulo={titulo} meta={<span>{meta}</span>} variante="documento"
          pdf={esFoto ? null : { href: URL_API_PREAPROBACION, etiqueta: mime === "application/pdf" ? undefined : "Abrir archivo" }} alCerrar={() => setAbierta(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- la URL firmada vence en 60 s: no pasa por el optimizador de imágenes */}
          {esFoto ? (src ? <img src={src} alt={titulo} className="iv2-doc-img" /> : <p className="iv2-linea-chica">Cargando…</p>) : <p>{mime === "application/pdf" ? "Es un PDF: se abre en una pestaña nueva." : "Este archivo se abre en una pestaña nueva."}</p>}
        </VentanaDocumento>
      )}
    </>
  );
}
