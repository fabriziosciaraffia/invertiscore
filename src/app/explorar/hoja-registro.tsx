"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LA HOJA DE REGISTRO SOBRE EL MAPA (29-oct-2026, estado D de docs/puerta-b-mockups/6-puerta-e.html, la puerta E). Sube sobre
// el mapa, en el material de la tríada: «Te regalamos el análisis de este depto.», el depto en una línea, «Crea tu cuenta
// gratis y recibe el informe completo, con el enlace a la publicación.», primero «Entrar con Google» y después el correo con
// «Ver este depto» y «Sin contraseña: te mandamos un código.». Sin depto (Avísame, las cifras, pie y plazo) habla del regalo
// sin línea de depto (abierto.ts › textosHoja).
// LA MISMA ALTA RÁPIDA DE /deptos (deptos-cliente.tsx): lo elegido se guarda antes del código o de Google (/api/deptos/correo
// o /google, con la puerta E y la llegada), el código se verifica en el servidor junto con el alta (/api/deptos/entrar, con
// tope y un reintento) y Google vuelve con su clave. AL TERMINAR NO HAY «Estás dentro»: se espera el regalo (si quedó
// pendiente) y se vuelve a Explorar, al mismo pin, con lo que había tocado (abierto.ts › destinoDeVuelta).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePostHog } from "@/lib/posthog-react";
import { emitirAuthCompletada, marcarOAuthPendiente } from "@/lib/auth-analytics";
import { IconoGoogle } from "@/components/entrar/IconoGoogle";
import { REGISTRO_UN_PASO } from "@/lib/lo-que-sigue/copy";
import { CODIGO_MAX, codigoValido, limpiarCodigo } from "@/lib/lo-que-sigue/codigo";
import { conTopeYReintento, ENTRAR_COPY } from "@/lib/deptos/entrada";
import { PASO_REGALO_MS, TOPE_ESPERA_REGALO_MS } from "@/lib/deptos/alta-orden";
import { CORREO_OK } from "@/lib/deptos/respuesta";
import { botonOcupado, claveActual, iniciarCarga } from "@/lib/carga-global";
import { marcarPuertaCandidata } from "@/lib/atribucion-puerta";
import { avisarLead } from "@/lib/meta/lead-cliente";
import {
  destinoDeVuelta, destinoEnlaceExplorar, destinoGoogleExplorar, detalleDeOrigen, eleccionesDePin, REGISTRO_COPY, textosHoja,
  type OrigenExplorar, type PedidoRegistro,
} from "@/lib/explorar/abierto";
import type { FiltrosPortal, OrdenPortal } from "@/lib/explorar/portal";

type RespuestaAlta = { estado?: string; regalo?: string; regaloVence?: string | null; error?: string };

/** El regalo que el alta dejó pendiente: se pregunta hasta que esté decidido (o hasta el tope), como en «Estás dentro». */
async function esperarRegalo(): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < TOPE_ESPERA_REGALO_MS) {
    try {
      const r = await fetch("/api/deptos/regalo", { cache: "no-store" });
      const d = (await r.json().catch(() => ({}))) as { vence?: string | null; decidido?: boolean };
      if (d.vence || d.decidido) return;
    } catch {
      /* se vuelve a preguntar */
    }
    await new Promise((ok) => setTimeout(ok, PASO_REGALO_MS));
  }
}

export function HojaRegistro({ pedido, filtros, orden, origen, alCerrar }: {
  pedido: PedidoRegistro;
  filtros: FiltrosPortal;
  orden: OrdenPortal;
  /** De dónde llegó a /explorar: el detalle de la puerta E. */
  origen: OrigenExplorar;
  alCerrar: () => void;
}) {
  const posthog = usePostHog();
  const [paso, setPaso] = useState<"correo" | "codigo">("correo");
  const [correo, setCorreo] = useState("");
  const [enviado, setEnviado] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState<false | "google" | "correo" | "entrar">(false);
  const [error, setError] = useState<string | null>(null);
  const [falloEntrar, setFalloEntrar] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const campoCodigo = useRef<HTMLInputElement>(null);
  const t = textosHoja(pedido);
  const vuelta = destinoDeVuelta({ filtros, orden, pedido });
  const detalle = detalleDeOrigen(origen);
  // Lo elegido: el pin (su comuna, su tipología, su chip de precio y la modalidad del filtro) o, en «Avísame», los filtros.
  const loElegido = pedido.pin ? { elecciones: eleccionesDePin(pedido.pin, filtros.modalidad) } : { filtros };

  // La puerta candidata de este navegador (la sincroniza useAttributionSync si la cuenta nace por otro camino).
  useEffect(() => { marcarPuertaCandidata("E", detalle); }, [detalle]);
  // ESCAPE CIERRA LA HOJA, Y SOLO LA HOJA (QA del 29-oct-2026: el primero cerraba la tarjeta de abajo y no la hoja). El
  // listener va UNA vez y en captura: re-registrado a cada render, el render que dispara el Escape de la tarjeta lo quitaba en
  // medio del mismo evento y el DOM lo saltaba. En captura corre antes que el de la tarjeta y corta el evento ahí.
  const cerrarRef = useRef(alCerrar);
  cerrarRef.current = alCerrar;
  const ocupadoRef = useRef<typeof ocupado>(false);
  ocupadoRef.current = ocupado;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      if (!ocupadoRef.current) cerrarRef.current();
    };
    window.addEventListener("keydown", esc, true);
    return () => window.removeEventListener("keydown", esc, true);
  }, []);

  async function conGoogle() {
    setError(null);
    setOcupado("google");
    try {
      const res = await fetch("/api/deptos/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...loElegido, puerta: "E", detalle }) });
      const d = (await res.json().catch(() => ({}))) as { p?: string };
      if (!res.ok || !d.p) { setError(REGISTRO_COPY.error); return; }
      marcarOAuthPendiente("signup");
      const { createClient } = await import("@/lib/supabase/client");
      await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destinoGoogleExplorar(vuelta, d.p))}` },
      });
    } finally {
      setOcupado(false);
    }
  }

  async function pedirCodigo(e: FormEvent) {
    e.preventDefault();
    const c = correo.trim().toLowerCase();
    if (!CORREO_OK.test(c)) { setError(REGISTRO_UN_PASO.errorCorreo); return; }
    setError(null);
    setOcupado("correo");
    try {
      const res = await fetch("/api/deptos/correo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correo: c, ...loElegido, puerta: "E", detalle }) });
      if (!res.ok) { setError(REGISTRO_COPY.error); return; }
      void avisarLead(c, "explorar", "E");
      const { createClient } = await import("@/lib/supabase/client");
      const { error: err } = await createClient().auth.signInWithOtp({
        email: c,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destinoEnlaceExplorar(vuelta))}`, shouldCreateUser: true },
      });
      if (err) { setError(REGISTRO_UN_PASO.errorEnvio); return; }
      setEnviado(c);
      setPaso("codigo");
      window.setTimeout(() => campoCodigo.current?.focus({ preventScroll: true }), 50);
    } finally {
      setOcupado(false);
    }
  }

  async function entrar(e: FormEvent) {
    e.preventDefault();
    const k = limpiarCodigo(codigo);
    if (!codigoValido(k) || !enviado) { setError(REGISTRO_UN_PASO.errorCodigo); return; }
    setError(null);
    setFalloEntrar(false);
    setOcupado("entrar");
    const soltar = iniciarCarga(claveActual());
    try {
      // El código se verifica EN EL SERVIDOR y el alta corre en el mismo pedido, con tope y un reintento (entrada.ts).
      const r = await conTopeYReintento(async (senal) => {
        const res = await fetch("/api/deptos/entrar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correo: enviado, codigo: k }), signal: senal });
        return { status: res.status, d: (await res.json().catch(() => ({}))) as RespuestaAlta };
      });
      if (!r.ok || r.valor.status >= 500 || r.valor.status === 401) { setFalloEntrar(true); soltar(); return; }
      if (r.valor.d.error === "codigo") { setError(REGISTRO_UN_PASO.errorCodigoMal); soltar(); return; }
      emitirAuthCompletada(posthog, r.valor.d.estado === "nueva" ? "signup" : "login", "email");
      // «Analizar este · usa tu análisis de regalo»: la vuelta espera el regalo para que el pop-up lo cuente (sin él, el
      // pop-up hablaría de comprar). Después, al mismo pin, sin «Estás dentro».
      if (r.valor.d.estado === "nueva" && !r.valor.d.regaloVence && r.valor.d.regalo === "pendiente") await esperarRegalo();
      window.location.assign(vuelta);
    } catch {
      setFalloEntrar(true);
      soltar();
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="ex-registro-velo" data-explorar="registro" onClick={(e) => { if (e.target === e.currentTarget && !ocupado) alCerrar(); }}>
      <section className="ex-registro ex-triada" role="dialog" aria-modal="true" aria-labelledby="ex-registro-t" data-motivo={pedido.motivo}>
        <span className="ex-asa ex-asa-clara" aria-hidden="true" />
        {paso === "correo" ? (
          <>
            <div className="ex-registro-cab">
              <h2 id="ex-registro-t" className="ex-registro-t">{t.titulo}</h2>
              <button type="button" className="ex-registro-x" onClick={alCerrar} aria-label={REGISTRO_COPY.cerrar} disabled={!!ocupado}>×</button>
            </div>
            {t.linea && <p className="ex-registro-depto" data-explorar="registro-depto">{t.linea}</p>}
            <p className="ex-registro-cuerpo">
              {typeof t.cuerpo === "string" ? t.cuerpo : <>{t.cuerpo.antes}<strong>{t.cuerpo.fuerte}</strong>{t.cuerpo.despues}</>}
            </p>
            <button type="button" className="ex-registro-google" onClick={() => void conGoogle()} disabled={!!ocupado} {...botonOcupado(ocupado === "google")} data-explorar="registro-google">
              <IconoGoogle /> {REGISTRO_COPY.google}
            </button>
            <div className="ex-registro-o" aria-hidden="true"><span />{REGISTRO_COPY.oTuCorreo}<span /></div>
            <form className="ex-registro-form" onSubmit={(e) => void pedirCodigo(e)} noValidate>
              <input
                ref={campo} type="email" inputMode="email" autoComplete="email" className="ex-registro-campo" placeholder={REGISTRO_COPY.placeholder}
                aria-label={REGISTRO_COPY.correo} value={correo} onChange={(e) => setCorreo(e.target.value)} data-explorar="registro-correo"
              />
              <button type="submit" className="ex-registro-ver" disabled={!!ocupado} {...botonOcupado(ocupado === "correo")} data-explorar="registro-ver">{t.boton}</button>
            </form>
            {error && <p className="ex-registro-error" role="alert">{error}</p>}
            <p className="ex-registro-nota">{REGISTRO_COPY.sinContrasena}</p>
          </>
        ) : (
          <>
            <div className="ex-registro-cab">
              <h2 id="ex-registro-t" className="ex-registro-t">{REGISTRO_COPY.codigo.titulo}</h2>
              <button type="button" className="ex-registro-x" onClick={alCerrar} aria-label={REGISTRO_COPY.cerrar} disabled={!!ocupado}>×</button>
            </div>
            <p className="ex-registro-cuerpo ex-registro-correo">{REGISTRO_COPY.codigo.bajada(enviado ?? "")}</p>
            <form className="ex-registro-form" onSubmit={(e) => void entrar(e)} noValidate>
              <input
                ref={campoCodigo} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={CODIGO_MAX} className="ex-registro-campo ex-registro-codigo"
                aria-label={REGISTRO_COPY.codigo.campo} value={codigo} onChange={(e) => setCodigo(limpiarCodigo(e.target.value))} data-explorar="registro-codigo"
              />
              <button type="submit" className="ex-registro-ver" disabled={!!ocupado} {...botonOcupado(ocupado === "entrar")} data-explorar="registro-entrar">
                {falloEntrar ? ENTRAR_COPY.noPudimos : ocupado === "entrar" ? REGISTRO_COPY.entrando : REGISTRO_COPY.codigo.entrar}
              </button>
            </form>
            {error && <p className="ex-registro-error" role="alert">{error}</p>}
            <button type="button" className="ex-registro-otro" onClick={() => { setPaso("correo"); setCodigo(""); setError(null); setFalloEntrar(false); window.setTimeout(() => campo.current?.focus({ preventScroll: true }), 50); }} disabled={!!ocupado}>{REGISTRO_COPY.codigo.otroCorreo}</button>
          </>
        )}
      </section>
    </div>
  );
}
