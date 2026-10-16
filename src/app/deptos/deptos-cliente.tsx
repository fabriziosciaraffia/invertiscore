"use client";

// ─────────────────────────────────────────────────────────────────────────────
// /deptos en el navegador (16-oct-2026, la puerta B). Una pantalla que avanza en el mismo lugar:
//   1 · las cuatro preguntas con chips —comuna (hasta tres, del Gran Santiago), tipología, rango en UF, arriendo
//       tradicional o renta corta— y, apenas están, la respuesta de la noche (GET /api/deptos/respuesta);
//   2 · el correo y el código, sin contraseña. Si el correo ya tiene cuenta: «ya tienes cuenta, te mandamos el código
//       para entrar», y al entrar, si agrega esas comunas a su perfil;
//   3 · «Estás dentro»: el regalo y «¿Cuándo piensas comprar?»;
//   4 · sus primeros deptos, de la evaluación de anoche, con la hora en que Franco los vio publicados; mientras el
//       correo del día los revisa, la pantalla vuelve a preguntar.
// Lead al dejar el correo (servidor + pixel, mismo id) y CompleteRegistration al contestar el «cuándo», con la puerta B.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usePostHog } from "@/lib/posthog-react";
import { emitirAuthCompletada } from "@/lib/auth-analytics";
import { REGISTRO_UN_PASO, ESTAS_DENTRO, type HorizonteCompra } from "@/lib/lo-que-sigue/copy";
import { CODIGO_MAX, codigoValido, limpiarCodigo } from "@/lib/lo-que-sigue/codigo";
import { marcarPuertaCandidata } from "@/lib/atribucion-puerta";
import { avisarLead } from "@/lib/meta/lead-cliente";
import { consumirCookieEspejo, espejarMeta } from "@/lib/meta/espejo";
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { textoVence } from "@/lib/guia/semanal";
import { REGALO_COPY } from "@/lib/regalo-alta";
import {
  ALTA_COPY, CORREO_OK, DEPTOS_COPY, MAX_COMUNAS_DEPTOS, MODALIDADES_DEPTOS, MODALIDAD_POR_DEFECTO, RANGOS_UF, TIPOLOGIAS_DEPTOS,
  type ModalidadDeptos, type RespuestaDeptos,
} from "@/lib/deptos/respuesta";
import type { PrimerosDeLaCuenta } from "@/lib/deptos/primeros-servidor";
import { PrimerosDeptos } from "@/components/deptos/PrimerosDeptos";
import "./deptos.css";

type Paso = "elegir" | "codigo" | "dentro" | "primeros" | "agregar";

const DEPTOS_FIN = {
  cuenta: "Ir a mi cuenta",
  correo: "Dentro de la hora te llegan por correo, revisados uno por uno. Desde ahora, cada lunes, los nuevos.",
} as const;

const ESPERA_MS = 4000;
const PREGUNTAS_MAX = 25;

export function DeptosCliente({ sesion }: { sesion: { email: string } | null }) {
  const router = useRouter();
  const posthog = usePostHog();
  const [comunas, setComunas] = useState<string[]>([]);
  const [otra, setOtra] = useState(false);
  const [tipologias, setTipologias] = useState<string[]>([]);
  const [rango, setRango] = useState<string>("");
  const [modalidad, setModalidad] = useState<ModalidadDeptos>(MODALIDAD_POR_DEFECTO);
  const [respuesta, setRespuesta] = useState<RespuestaDeptos | null>(null);
  const [cargando, setCargando] = useState(false);
  const [paso, setPaso] = useState<Paso>("elegir");
  const [correo, setCorreo] = useState(sesion?.email ?? "");
  const [enviado, setEnviado] = useState<{ correo: string; existe: boolean } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regaloVence, setRegaloVence] = useState<string | null>(null);
  const [horizonte, setHorizonte] = useState<HorizonteCompra | null>(null);
  const [primeros, setPrimeros] = useState<PrimerosDeLaCuenta | null>(null);
  const [agregar, setAgregar] = useState<{ nuevas: string[]; actuales: string[] } | null>(null);
  const campoCodigo = useRef<HTMLInputElement>(null);

  // La puerta B: el navegador la lleva hasta que la cuenta nace (useAttributionSync, el reclamo y el alta).
  useEffect(() => {
    marcarPuertaCandidata("B", "deptos");
    posthog?.capture("deptos_vista", {});
  }, [posthog]);

  const elecciones = { comunas, tipologias, rango, modalidad };
  const completo = comunas.length > 0 && tipologias.length > 0 && !!rango;

  // La respuesta al instante, apenas están las tres preguntas que la deciden (la modalidad no cambia el conteo).
  useEffect(() => {
    if (!completo) { setRespuesta(null); return; }
    const control = new AbortController();
    const q = new URLSearchParams({ c: comunas.join(","), t: tipologias.join(","), r: rango, m: modalidad });
    setCargando(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/deptos/respuesta?${q.toString()}`, { signal: control.signal });
        const d = (await res.json()) as RespuestaDeptos;
        if (res.ok) {
          setRespuesta(d);
          posthog?.capture("deptos_respuesta", { convienen: d.convienen, total: d.total, cero: d.convienen === 0, comunas: comunas.length, modalidad });
        } else setRespuesta(null);
      } catch {
        /* abortada o sin red: queda la anterior */
      } finally {
        setCargando(false);
      }
    }, 200);
    return () => { control.abort(); window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comunas.join(","), tipologias.join(","), rango, modalidad, completo]);

  const tocarComuna = (c: string) => {
    setOtra(false);
    setComunas((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : xs.length >= MAX_COMUNAS_DEPTOS ? xs : [...xs, c]));
  };
  const tocarTipologia = (id: string) => setTipologias((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));

  async function pedirCodigo(e: FormEvent) {
    e.preventDefault();
    const c = correo.trim().toLowerCase();
    if (!CORREO_OK.test(c)) { setError(REGISTRO_UN_PASO.errorCorreo); return; }
    setError(null);
    setOcupado(true);
    try {
      const res = await fetch("/api/deptos/correo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correo: c, elecciones }) });
      const d = (await res.json().catch(() => ({}))) as { existe?: boolean };
      if (!res.ok || typeof d.existe !== "boolean") { setError(ALTA_COPY.error); return; }
      // Dejó su correo en la página de selección: el Lead y la puerta B.
      void avisarLead(c, "seleccion", "B");
      posthog?.capture("deptos_correo", { existe: d.existe });
      if (sesion && sesion.email.toLowerCase() === c) {
        // Ya está adentro: sin código.
        await terminarAlta();
        return;
      }
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithOtp({
        email: c,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/deptos?entro=1")}`, shouldCreateUser: true },
      });
      if (err) { setError(REGISTRO_UN_PASO.errorEnvio); return; }
      setEnviado({ correo: c, existe: d.existe });
      setPaso("codigo");
      window.setTimeout(() => campoCodigo.current?.focus(), 50);
    } finally {
      setOcupado(false);
    }
  }

  const terminarAlta = useCallback(async () => {
    const res = await fetch("/api/deptos/alta", { method: "POST" });
    const d = (await res.json().catch(() => ({}))) as { estado?: string; regaloVence?: string | null; comunasNuevas?: string[]; comunas?: string[] };
    // El header y lo que lea la sesión se refrescan: ya está adentro.
    router.refresh();
    if (d.estado === "nueva") {
      setRegaloVence(d.regaloVence ?? null);
      emitirAuthCompletada(posthog, "signup", "email");
      setPaso("dentro");
      return;
    }
    if (d.estado === "existente" && (d.comunasNuevas?.length ?? 0) > 0) {
      emitirAuthCompletada(posthog, "login", "email");
      setAgregar({ nuevas: d.comunasNuevas!, actuales: d.comunas ?? [] });
      setPaso("agregar");
      return;
    }
    router.push("/dashboard");
  }, [posthog, router]);

  // Volvió por el enlace del correo (el código abierto en este mismo navegador): termina el alta acá.
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("entro") === "1" && sesion) void terminarAlta();
  }, [sesion, terminarAlta]);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    const t = limpiarCodigo(codigo);
    if (!codigoValido(t) || !enviado) { setError(REGISTRO_UN_PASO.errorCodigo); return; }
    setError(null);
    setOcupado(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.verifyOtp({ email: enviado.correo, token: t, type: "email" });
      if (err) { setError(REGISTRO_UN_PASO.errorCodigoMal); return; }
      await terminarAlta();
    } finally {
      setOcupado(false);
    }
  }

  async function elegirCuando(h: HorizonteCompra) {
    setHorizonte(h);
    setError(null);
    try {
      const res = await fetch("/api/perfil-busqueda", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ horizonte: h }) });
      if (!res.ok) { setError(ESTAS_DENTRO.errorGuardar); return; }
      // CompleteRegistration: el espejo para el pixel viene en la cookie de la respuesta.
      espejarMeta(consumirCookieEspejo());
      posthog?.capture("horizonte_elegido", { horizonte: h, donde: "deptos" });
      setPaso("primeros");
    } catch {
      setError(ESTAS_DENTRO.errorGuardar);
    }
  }

  // Los primeros deptos: se vuelve a preguntar mientras el correo del día revisa las fichas.
  useEffect(() => {
    if (paso !== "primeros") return;
    let vivo = true, vueltas = 0;
    const leer = async () => {
      try {
        const res = await fetch("/api/deptos/primeros", { cache: "no-store" });
        if (!res.ok || !vivo) return;
        const d = (await res.json()) as PrimerosDeLaCuenta;
        setPrimeros(d);
        if (d.revisando && ++vueltas < PREGUNTAS_MAX) window.setTimeout(() => vivo && void leer(), ESPERA_MS);
      } catch {
        /* queda lo último */
      }
    };
    void leer();
    return () => { vivo = false; };
  }, [paso]);

  async function sumarComunas(si: boolean) {
    if (si && agregar) {
      const todas = [...agregar.actuales, ...agregar.nuevas];
      const res = await fetch("/api/perfil-busqueda", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ comunas: todas }) });
      if (!res.ok) { setError(ALTA_COPY.error); return; }
    }
    router.push("/dashboard");
  }

  // ── Las pantallas ──
  if (paso === "dentro" || paso === "primeros") {
    return (
      <div className="dp" data-deptos={paso}>
        <h1 className="dp-titulo">{ESTAS_DENTRO.titular}</h1>
        {regaloVence && (
          <p className="dp-regalo" data-deptos="regalo"><b>{REGALO_COPY.cargado}</b> {textoVence(regaloVence)}</p>
        )}
        {paso === "dentro" ? (
          <div className="dp-bloque" data-deptos="cuando">
            <p className="dp-pregunta">{ESTAS_DENTRO.cuando}</p>
            <div className="dp-chips" role="radiogroup" aria-label={ESTAS_DENTRO.cuando}>
              {ESTAS_DENTRO.horizontes.map((h) => (
                <button key={h.id} type="button" role="radio" aria-checked={horizonte === h.id} className="dp-chip" data-activo={horizonte === h.id ? "1" : undefined} onClick={() => void elegirCuando(h.id)}>
                  {h.texto}
                </button>
              ))}
            </div>
            <p className="dp-nota">{ESTAS_DENTRO.comoEntrar}</p>
          </div>
        ) : (
          <>
            <PrimerosDeptos items={primeros?.items ?? []} token={primeros?.token ?? null} revisando={primeros == null || primeros.revisando} vecinas={primeros?.vecinas} />
            <div className="dp-fin">
              <button type="button" className="dp-boton" onClick={() => router.push("/dashboard")}>{DEPTOS_FIN.cuenta}</button>
              <p className="dp-nota">{DEPTOS_FIN.correo}</p>
            </div>
          </>
        )}
        {error && <p className="dp-error" role="alert">{error}</p>}
      </div>
    );
  }

  if (paso === "agregar" && agregar) {
    return (
      <div className="dp" data-deptos="agregar">
        <h1 className="dp-titulo">{ALTA_COPY.agregar(agregar.nuevas)}</h1>
        <div className="dp-fin">
          <button type="button" className="dp-boton" onClick={() => void sumarComunas(true)}>{ALTA_COPY.agregarSi}</button>
          <button type="button" className="dp-enlace" onClick={() => void sumarComunas(false)}>{ALTA_COPY.agregarNo}</button>
        </div>
        {error && <p className="dp-error" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="dp" data-deptos="elegir">
      <h1 className="dp-titulo">{DEPTOS_COPY.titular}</h1>
      <p className="dp-bajada">{DEPTOS_COPY.bajada}</p>

      <fieldset className="dp-bloque">
        <legend className="dp-pregunta">{DEPTOS_COPY.comuna} <span className="dp-ayuda">{DEPTOS_COPY.comunaAyuda}</span></legend>
        <div className="dp-chips" data-pregunta="comuna">
          {(COMUNAS_DISPONIBLES as readonly string[]).map((c) => (
            <button key={c} type="button" className="dp-chip" aria-pressed={comunas.includes(c)} data-activo={comunas.includes(c) ? "1" : undefined}
              disabled={!comunas.includes(c) && comunas.length >= MAX_COMUNAS_DEPTOS} onClick={() => tocarComuna(c)}>
              {c}
            </button>
          ))}
          <button type="button" className="dp-chip dp-chip-otra" aria-pressed={otra} data-activo={otra ? "1" : undefined} onClick={() => setOtra((x) => !x)}>{DEPTOS_COPY.otraComuna}</button>
        </div>
        {otra && <p className="dp-fuera" role="status" data-deptos="fuera">{DEPTOS_COPY.fuera} {(COMUNAS_DISPONIBLES as readonly string[]).join(", ")}.</p>}
      </fieldset>

      <fieldset className="dp-bloque">
        <legend className="dp-pregunta">{DEPTOS_COPY.tipologia}</legend>
        <div className="dp-chips" data-pregunta="tipologia">
          {TIPOLOGIAS_DEPTOS.map((t) => (
            <button key={t.id} type="button" className="dp-chip" aria-pressed={tipologias.includes(t.id)} data-activo={tipologias.includes(t.id) ? "1" : undefined} onClick={() => tocarTipologia(t.id)}>
              {t.chip}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="dp-bloque">
        <legend className="dp-pregunta">{DEPTOS_COPY.rango}</legend>
        <div className="dp-chips" data-pregunta="rango" role="radiogroup" aria-label={DEPTOS_COPY.rango}>
          {RANGOS_UF.map((r) => (
            <button key={r.id} type="button" role="radio" className="dp-chip" aria-checked={rango === r.id} data-activo={rango === r.id ? "1" : undefined} onClick={() => setRango(r.id)}>
              {r.chip}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="dp-bloque">
        <legend className="dp-pregunta">{DEPTOS_COPY.modalidad}</legend>
        <div className="dp-chips" data-pregunta="modalidad" role="radiogroup" aria-label={DEPTOS_COPY.modalidad}>
          {MODALIDADES_DEPTOS.map((m) => (
            <button key={m.id} type="button" role="radio" className="dp-chip" aria-checked={modalidad === m.id} data-activo={modalidad === m.id ? "1" : undefined} onClick={() => setModalidad(m.id)}>
              {m.chip}
            </button>
          ))}
        </div>
      </fieldset>

      {completo && (
        <section className="dp-respuesta" aria-live="polite" data-deptos="respuesta" data-cargando={cargando && !respuesta ? "1" : undefined}>
          {respuesta ? (
            <>
              <p className="dp-frase" data-convienen={respuesta.convienen}>{respuesta.frase}</p>
              {respuesta.alternativa && <p className="dp-alternativa" data-deptos="alternativa">{respuesta.alternativa}</p>}
              {respuesta.notaModalidad && <p className="dp-nota">{respuesta.notaModalidad}</p>}
              <p className="dp-nota">{DEPTOS_COPY.estandar}</p>

              {paso === "codigo" && enviado ? (
                <form className="dp-form" onSubmit={entrar} data-deptos="codigo">
                  <p className="dp-registro">{enviado.existe ? ALTA_COPY.yaTienes : ALTA_COPY.nueva}</p>
                  <p className="dp-nota">{ALTA_COPY.enviado(enviado.correo)}</p>
                  <div className="dp-fila">
                    <input ref={campoCodigo} className="dp-campo" inputMode="numeric" autoComplete="one-time-code" maxLength={CODIGO_MAX} placeholder={REGISTRO_UN_PASO.placeholderCodigo}
                      aria-label={REGISTRO_UN_PASO.placeholderCodigo} value={codigo} onChange={(e) => setCodigo(limpiarCodigo(e.target.value))} />
                    <button type="submit" className="dp-boton" disabled={ocupado}>{REGISTRO_UN_PASO.entrar}</button>
                  </div>
                </form>
              ) : (
                <form className="dp-form" onSubmit={pedirCodigo} data-deptos="correo">
                  <p className="dp-registro">{respuesta.registro}</p>
                  <div className="dp-fila">
                    <input className="dp-campo" type="email" inputMode="email" autoComplete="email" placeholder={REGISTRO_UN_PASO.placeholder}
                      aria-label={ALTA_COPY.correo} value={correo} onChange={(e) => setCorreo(e.target.value)} />
                    <button type="submit" className="dp-boton" disabled={ocupado}>{ALTA_COPY.pedir}</button>
                  </div>
                  <p className="dp-nota">{ALTA_COPY.nueva}</p>
                </form>
              )}
            </>
          ) : (
            <p className="dp-nota">…</p>
          )}
          {error && <p className="dp-error" role="alert">{error}</p>}
        </section>
      )}
    </div>
  );
}

