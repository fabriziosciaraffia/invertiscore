"use client";

// ─────────────────────────────────────────────────────────────────────────────
// /deptos en el navegador (16-oct-2026, la puerta B). La única meta de la pantalla es que dejen el correo (segunda
// pasada, mismo día): MENOS PARA ELEGIR y el correo PEGADO A LA RESPUESTA.
//   1 · tres preguntas con chips compactos: comuna (las ocho más buscadas y «Otra comuna…», un buscador con el resto;
//       hasta tres), tipología (una sola, 2D por defecto) y rango (cuatro). Apenas están, la respuesta de la noche
//       (GET /api/deptos/respuesta) es UN NÚMERO —«29 de 1.008 convienen»— con la búsqueda arriba y el pie y el plazo chicos debajo;
//   2 · inmediatamente debajo, el correo: «Regístrate y te los mando hoy», el campo, «Quiero recibirlos» y «Te mandamos
//       un código. Sin contraseña.». Después del correo, el MISMO mensaje exista o no la cuenta; al entrar, a la que ya
//       existía se le pregunta si agrega esas comunas a su perfil;
//   3 · «Estás dentro»: el regalo, la modalidad (arriendo tradicional por defecto) y «¿Cuándo piensas comprar?»;
//   4 · sus primeros deptos (20-oct-2026: EN LA MISMA PANTALLA de «Estás dentro», sin esperar a que conteste el «cuándo»;
//       PrimeraSeleccion), cada uno con «Analizar este»; mientras el correo del día los revisa, la pantalla vuelve a preguntar.
// Lead al dejar el correo (servidor + pixel, mismo id) y CompleteRegistration al contestar el «cuándo», con la puerta B.
// CON GOOGLE (16-oct-2026): «o con Google» debajo del campo. Antes de salir, lo elegido queda guardado con una clave
// (/api/deptos/google); vuelve a /deptos?entro=google&p=<clave> con sesión, el callback ya lo pasó a nombre del correo, y
// desde ahí todo es igual que por código: el Lead (al volver, cuando se sabe el correo), el alta y «Estás dentro».
// LA PÁGINA DEL INVITADO (16-oct-2026, la puerta C) usa esta misma pantalla con su cabecera, su puerta (C) y su página de
// vuelta (`/i/CÓDIGO`): las mismas preguntas, el mismo alta, la misma entrada con Google.
// SE EXPLICA SOLA Y PIDE EL CORREO DESDE EL PRINCIPIO (17-oct-2026, decisión de Fabrizio): arriba, qué es, con las cifras de
// la noche, en UNA frase («Cada noche Franco revisa los +21.000 deptos en venta publicados en Santiago. Anoche, 4.886
// convenían como inversión.»); después, como etiqueta, la búsqueda ya elegida («Si buscas Santiago · 2D · UF 3.000 a
// 4.000», 17-oct-2026) y debajo el número grande («4 de 607 convienen») con la nota chica del pie y el plazo —etiqueta y
// número llegan en la MISMA respuesta, así que al tocar un chip cambian juntos—; justo debajo, la banda del correo —lo
// único con color, como el banner del informe—; y abajo, «Cambia la búsqueda», los chips planos.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usePostHog } from "@/lib/posthog-react";
import { emitirAuthCompletada, marcarOAuthPendiente } from "@/lib/auth-analytics";
import { IconoGoogle } from "@/components/entrar/IconoGoogle";
import { REGISTRO_UN_PASO, ESTAS_DENTRO, type HorizonteCompra } from "@/lib/lo-que-sigue/copy";
import { CODIGO_MAX, codigoValido, limpiarCodigo } from "@/lib/lo-que-sigue/codigo";
import { marcarPuertaCandidata, type Puerta } from "@/lib/atribucion-puerta";
import { avisarLead, type OrigenLead } from "@/lib/meta/lead-cliente";
import { consumirCookieEspejo, espejarMeta } from "@/lib/meta/espejo";
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { textoVence } from "@/lib/guia/semanal";
import { REGALO_COPY } from "@/lib/regalo-alta";
import {
  ALTA_COPY, claveDeDestino, COMUNAS_DESTACADAS, ELECCIONES_POR_DEFECTO, CORREO_OK, DEPTOS_COPY, destinoGoogle, MAX_COMUNAS_DEPTOS, MODALIDADES_DEPTOS, MODALIDAD_POR_DEFECTO, RANGOS_UF,
  TIPOLOGIA_POR_DEFECTO, TIPOLOGIAS_DEPTOS, type ModalidadDeptos, type RespuestaDeptos,
} from "@/lib/deptos/respuesta";
import type { PortadaDeptos } from "@/lib/deptos/portada";
import { PrimeraSeleccion } from "@/components/deptos/PrimeraSeleccion";
import "./deptos.css";

type Paso = "elegir" | "codigo" | "dentro" | "agregar";

const DEPTOS_FIN = {
  cuenta: "Ir a mi cuenta",
  correo: "Dentro de la hora te llegan por correo, revisados uno por uno. Desde ahora, cada lunes, los nuevos.",
} as const;
const MODALIDAD_PREGUNTA = "¿Cómo lo arriendas?";

const DESTACADAS = COMUNAS_DESTACADAS as readonly string[];
/** Para buscar sin tildes: «nunoa» encuentra Ñuñoa. */
const plano = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export interface OpcionesDeptos {
  /** La página donde vive la pantalla: adonde vuelven el enlace del correo y Google. */
  pagina?: string;
  /** La puerta candidata que marca (B en /deptos; C en la página del invitado). */
  puerta?: { puerta: Puerta; detalle: string };
  /** De dónde sale el Lead al dejar el correo. */
  origenLead?: OrigenLead;
  /** Una línea arriba de todo (la página del invitado: «Te invitaron a Franco»). */
  cabecera?: ReactNode;
  /** Lo que va al final de la pantalla de elegir (la página del invitado: la dirección). */
  pie?: ReactNode;
  /** El resumen de la noche y la respuesta de la búsqueda por defecto, desde el servidor (portada.ts). */
  portada?: PortadaDeptos;
}

/** La búsqueda por defecto, como clave: si la pantalla arranca con su respuesta del servidor, no la vuelve a pedir. */
const CLAVE_DEFECTO = `${ELECCIONES_POR_DEFECTO.comunas.join(",")}|${ELECCIONES_POR_DEFECTO.tipologias[0]}|${ELECCIONES_POR_DEFECTO.rango}`;

export function DeptosCliente({ sesion, pagina = "/deptos", puerta = { puerta: "B", detalle: "deptos" }, origenLead = "seleccion", cabecera, pie, portada }: { sesion: { email: string } | null } & OpcionesDeptos) {
  const router = useRouter();
  const posthog = usePostHog();
  const [comunas, setComunas] = useState<string[]>([...ELECCIONES_POR_DEFECTO.comunas]);
  const [buscando, setBuscando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [tipologia, setTipologia] = useState<string>(TIPOLOGIA_POR_DEFECTO);
  const [rango, setRango] = useState<string>(ELECCIONES_POR_DEFECTO.rango);
  const [modalidad, setModalidad] = useState<ModalidadDeptos>(MODALIDAD_POR_DEFECTO);
  const [respuesta, setRespuesta] = useState<RespuestaDeptos | null>(portada?.inicial ?? null);
  const [cargando, setCargando] = useState(false);
  const [paso, setPaso] = useState<Paso>("elegir");
  const [correo, setCorreo] = useState(sesion?.email ?? "");
  const [enviado, setEnviado] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regaloVence, setRegaloVence] = useState<string | null>(null);
  const [horizonte, setHorizonte] = useState<HorizonteCompra | null>(null);
  const [agregar, setAgregar] = useState<{ nuevas: string[]; actuales: string[] } | null>(null);
  const campoCodigo = useRef<HTMLInputElement>(null);
  const campoBuscar = useRef<HTMLInputElement>(null);
  /** La búsqueda de la respuesta que está a la vista (la por defecto, si vino del servidor): esa no se vuelve a pedir. Se
   *  anota al llegar la respuesta, no al pedirla: un pedido cortado (el doble efecto de React en desarrollo) se repite. */
  const servida = useRef<string | null>(portada?.inicial ? CLAVE_DEFECTO : null);

  // La puerta B: el navegador la lleva hasta que la cuenta nace (useAttributionSync, el reclamo y el alta).
  useEffect(() => {
    marcarPuertaCandidata(puerta.puerta, puerta.detalle);
    posthog?.capture("deptos_vista", { pagina: pagina === "/deptos" ? "deptos" : "invitacion" });
  }, [posthog, puerta.puerta, puerta.detalle, pagina]);

  const completo = comunas.length > 0 && !!tipologia && !!rango;

  // La respuesta al instante: la búsqueda arranca elegida y cada chip la cambia; mientras llega, queda la anterior.
  useEffect(() => {
    if (!completo) { setRespuesta(null); return; }
    const clave = `${comunas.join(",")}|${tipologia}|${rango}`;
    if (clave === servida.current) return;
    const control = new AbortController();
    const q = new URLSearchParams({ c: comunas.join(","), t: tipologia, r: rango });
    setCargando(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/deptos/respuesta?${q.toString()}`, { signal: control.signal });
        const d = (await res.json()) as RespuestaDeptos;
        if (res.ok) {
          servida.current = clave;
          setRespuesta(d);
          posthog?.capture("deptos_respuesta", { convienen: d.convienen, total: d.total, cero: d.convienen === 0, comunas: comunas.length });
        } else setRespuesta(null);
      } catch {
        /* abortada o sin red: queda la anterior */
      } finally {
        setCargando(false);
      }
    }, 150);
    return () => { control.abort(); window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comunas.join(","), tipologia, rango, completo]);

  // Siempre queda una comuna: sin ella no hay número (la última no se suelta).
  const tocarComuna = (c: string) => {
    setComunas((xs) => (xs.includes(c) ? (xs.length === 1 ? xs : xs.filter((x) => x !== c)) : xs.length >= MAX_COMUNAS_DEPTOS ? xs : [...xs, c]));
  };
  const elegirDelBuscador = (c: string) => {
    tocarComuna(c);
    setBusqueda("");
    setBuscando(false);
  };
  const abrirBuscador = () => {
    setBuscando((x) => !x);
    window.setTimeout(() => campoBuscar.current?.focus(), 30);
  };
  // El buscador: sin escribir, el resto del Gran Santiago (sin las ocho a la vista ni las ya elegidas); al escribir, busca
  // en TODAS las que no eligió, sin tildes («nunoa» encuentra Ñuñoa: si no, diría que está fuera del Gran Santiago).
  const sinElegir = (COMUNAS_DISPONIBLES as readonly string[]).filter((c) => !comunas.includes(c));
  const restantes = sinElegir.filter((c) => !DESTACADAS.includes(c));
  const encontradas = busqueda.trim() ? sinElegir.filter((c) => plano(c).includes(plano(busqueda))) : restantes;
  const extras = comunas.filter((c) => !DESTACADAS.includes(c));
  const lleno = comunas.length >= MAX_COMUNAS_DEPTOS;

  async function pedirCodigo(e: FormEvent) {
    e.preventDefault();
    const c = correo.trim().toLowerCase();
    if (!CORREO_OK.test(c)) { setError(REGISTRO_UN_PASO.errorCorreo); return; }
    setError(null);
    setOcupado(true);
    try {
      const res = await fetch("/api/deptos/correo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: c, elecciones: { comunas, tipologias: [tipologia], rango, modalidad: MODALIDAD_POR_DEFECTO } }),
      });
      if (!res.ok) { setError(ALTA_COPY.error); return; }
      // Dejó su correo en la página de selección (o en la del invitado): el Lead y su puerta.
      void avisarLead(c, origenLead, puerta.puerta);
      posthog?.capture("deptos_correo", {});
      if (sesion && sesion.email.toLowerCase() === c) {
        // Ya está adentro: sin código.
        await terminarAlta();
        return;
      }
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithOtp({
        email: c,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`${pagina}?entro=1`)}`, shouldCreateUser: true },
      });
      if (err) { setError(REGISTRO_UN_PASO.errorEnvio); return; }
      // El mismo mensaje exista o no la cuenta (16-oct-2026, decisión de Fabrizio).
      setEnviado(c);
      setPaso("codigo");
      window.setTimeout(() => campoCodigo.current?.focus(), 50);
    } finally {
      setOcupado(false);
    }
  }

  // «o con Google»: lo elegido queda guardado con una clave, y la clave vuelve en el destino.
  async function conGoogle() {
    setError(null);
    setOcupado(true);
    try {
      const res = await fetch("/api/deptos/google", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elecciones: { comunas, tipologias: [tipologia], rango, modalidad: MODALIDAD_POR_DEFECTO } }),
      });
      const d = (await res.json().catch(() => ({}))) as { p?: string };
      if (!res.ok || !d.p) { setError(ALTA_COPY.error); return; }
      posthog?.capture("deptos_google", {});
      marcarOAuthPendiente("signup");
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destinoGoogle(d.p, pagina))}` },
      });
    } finally {
      setOcupado(false);
    }
  }

  const terminarAlta = useCallback(async (clave: string | null = null, metodo: "email" | "google" = "email") => {
    const res = await fetch("/api/deptos/alta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clave ? { p: clave } : {}) });
    const d = (await res.json().catch(() => ({}))) as { estado?: string; regaloVence?: string | null; comunasNuevas?: string[]; comunas?: string[] };
    // El header y lo que lea la sesión se refrescan: ya está adentro.
    router.refresh();
    if (d.estado === "nueva") {
      setRegaloVence(d.regaloVence ?? null);
      // Con Google, el completado lo emite useAttributionSync con la marca de OAuth: acá no se repite.
      if (metodo === "email") emitirAuthCompletada(posthog, "signup", "email");
      setPaso("dentro");
      return;
    }
    if (d.estado === "existente" && (d.comunasNuevas?.length ?? 0) > 0) {
      if (metodo === "email") emitirAuthCompletada(posthog, "login", "email");
      setAgregar({ nuevas: d.comunasNuevas!, actuales: d.comunas ?? [] });
      setPaso("agregar");
      return;
    }
    router.push("/dashboard");
  }, [posthog, router]);

  // Volvió por el enlace del correo o de Google, con sesión: termina el alta acá. Con Google, el Lead sale ahora (recién se
  // sabe el correo), igual que cuando se deja el correo; la clave va por si el callback no alcanzó a pasar lo elegido.
  useEffect(() => {
    if (typeof window === "undefined" || !sesion) return;
    const entro = new URLSearchParams(window.location.search).get("entro");
    if (entro === "google") {
      const clave = claveDeDestino(`${window.location.pathname}${window.location.search}`);
      void avisarLead(sesion.email.toLowerCase(), origenLead, puerta.puerta);
      posthog?.capture("deptos_correo", { via: "google" });
      void terminarAlta(clave, "google");
    } else if (entro === "1") void terminarAlta();
  }, [sesion, terminarAlta, posthog, origenLead, puerta.puerta]);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    const t = limpiarCodigo(codigo);
    if (!codigoValido(t) || !enviado) { setError(REGISTRO_UN_PASO.errorCodigo); return; }
    setError(null);
    setOcupado(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.verifyOtp({ email: enviado, token: t, type: "email" });
      if (err) { setError(REGISTRO_UN_PASO.errorCodigoMal); return; }
      await terminarAlta();
    } finally {
      setOcupado(false);
    }
  }

  // La modalidad, en «Estás dentro» (16-oct-2026): arriendo tradicional por defecto; se guarda al cambiarla.
  async function elegirModalidad(m: ModalidadDeptos) {
    setModalidad(m);
    const res = await fetch("/api/perfil-busqueda", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modalidad: m }) }).catch(() => null);
    if (!res?.ok) setError(ESTAS_DENTRO.errorGuardar);
  }

  async function elegirCuando(h: HorizonteCompra) {
    setHorizonte(h);
    setError(null);
    try {
      const res = await fetch("/api/perfil-busqueda", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ horizonte: h, modalidad }) });
      if (!res.ok) { setError(ESTAS_DENTRO.errorGuardar); return; }
      // CompleteRegistration: el espejo para el pixel viene en la cookie de la respuesta.
      espejarMeta(consumirCookieEspejo());
      posthog?.capture("horizonte_elegido", { horizonte: h, donde: "deptos", modalidad });
    } catch {
      setError(ESTAS_DENTRO.errorGuardar);
    }
  }

  async function sumarComunas(si: boolean) {
    if (si && agregar) {
      const todas = [...agregar.actuales, ...agregar.nuevas];
      const res = await fetch("/api/perfil-busqueda", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ comunas: todas }) });
      if (!res.ok) { setError(ALTA_COPY.error); return; }
    }
    router.push("/dashboard");
  }

  // ── Las pantallas ──
  if (paso === "dentro") {
    return (
      <div className="dp" data-deptos={paso}>
        <h1 className="dp-titulo">{ESTAS_DENTRO.titular}</h1>
        {regaloVence && (
          <p className="dp-regalo" data-deptos="regalo"><b>{REGALO_COPY.cargado}</b> {textoVence(regaloVence)}</p>
        )}
        <div className="dp-bloque" data-deptos="modalidad">
          <p className="dp-pregunta">{MODALIDAD_PREGUNTA}</p>
          <div className="dp-chips" role="radiogroup" aria-label={MODALIDAD_PREGUNTA}>
            {MODALIDADES_DEPTOS.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={modalidad === m.id} className="dp-chip" data-activo={modalidad === m.id ? "1" : undefined} onClick={() => void elegirModalidad(m.id)}>
                {m.chip}
              </button>
            ))}
          </div>
        </div>
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
        {/* La primera selección, ahí mismo (20-oct-2026): sin esperar a que conteste el «cuándo». */}
        <div className="dp-bloque" data-deptos="primeros">
          <PrimeraSeleccion volver={pagina} />
        </div>
        <div className="dp-fin">
          <button type="button" className="dp-boton" onClick={() => router.push("/dashboard")}>{DEPTOS_FIN.cuenta}</button>
          <p className="dp-nota">{DEPTOS_FIN.correo}</p>
        </div>
        {error && <p className="dp-error" role="alert">{error}</p>}
      </div>
    );
  }

  if (paso === "agregar" && agregar) {
    return (
      <div className="dp" data-deptos="agregar">
        <h1 className="dp-titulo dp-titulo-largo">{ALTA_COPY.agregar(agregar.nuevas)}</h1>
        <div className="dp-fin">
          <button type="button" className="dp-boton" onClick={() => void sumarComunas(true)}>{ALTA_COPY.agregarSi}</button>
          <button type="button" className="dp-enlace" onClick={() => void sumarComunas(false)}>{ALTA_COPY.agregarNo}</button>
        </div>
        {error && <p className="dp-error" role="alert">{error}</p>}
      </div>
    );
  }

  const chipComuna = (c: string) => (
    <button key={c} type="button" className="dp-chip" aria-pressed={comunas.includes(c)} data-activo={comunas.includes(c) ? "1" : undefined}
      disabled={!comunas.includes(c) && lleno} onClick={() => tocarComuna(c)}>
      {c}
    </button>
  );

  return (
    <div className="dp" data-deptos="elegir">
      {cabecera}
      <h1 className="dp-que" data-deptos="que">{DEPTOS_COPY.que(portada?.noche?.revisados ?? null, portada?.noche?.convienen ?? null)}</h1>

      <section className="dp-respuesta" aria-live="polite" data-deptos="respuesta" data-cargando={cargando ? "1" : undefined}>
        {respuesta ? (
          <>
            <p className="dp-si" data-deptos="si">{respuesta.etiqueta}</p>
            <p className="dp-numero" data-convienen={respuesta.convienen}>
              {respuesta.cifra ? <><span className="dp-cifra">{respuesta.cifra}</span>{respuesta.titular.slice(respuesta.cifra.length)}</> : respuesta.titular}
            </p>
            <p className="dp-nota-num" data-deptos="nota">{respuesta.nota}</p>
            {respuesta.alternativa && <p className="dp-alternativa" data-deptos="alternativa">{respuesta.alternativa}</p>}
          </>
        ) : (
          <p className="dp-numero dp-esperando" aria-hidden="true">…</p>
        )}
      </section>
      <div className="dp-banda" data-deptos="banda">
        {paso === "codigo" && enviado ? (
          <form className="dp-form" onSubmit={entrar} data-deptos="codigo">
            <p className="dp-registro">{DEPTOS_COPY.enviado(enviado)}</p>
            <div className="dp-fila">
              <input ref={campoCodigo} className="dp-campo" inputMode="numeric" autoComplete="one-time-code" maxLength={CODIGO_MAX} placeholder={REGISTRO_UN_PASO.placeholderCodigo}
                aria-label={REGISTRO_UN_PASO.placeholderCodigo} value={codigo} onChange={(e) => setCodigo(limpiarCodigo(e.target.value))} />
              <button type="submit" className="dp-boton" disabled={ocupado}>{REGISTRO_UN_PASO.entrar}</button>
            </div>
          </form>
        ) : (
          <form className="dp-form" onSubmit={pedirCodigo} data-deptos="correo">
            <p className="dp-registro">{respuesta?.registro ?? DEPTOS_COPY.conRegistro}</p>
            <div className="dp-fila">
              <input className="dp-campo" type="email" inputMode="email" autoComplete="email" placeholder={REGISTRO_UN_PASO.placeholder}
                aria-label={ALTA_COPY.correo} value={correo} onChange={(e) => setCorreo(e.target.value)} />
              <button type="submit" className="dp-boton" disabled={ocupado}>{ALTA_COPY.pedir}</button>
            </div>
            <button type="button" className="dp-google" onClick={() => void conGoogle()} disabled={ocupado}><IconoGoogle /> {ALTA_COPY.google}</button>
            <p className="dp-nota">{DEPTOS_COPY.sinContrasena}</p>
          </form>
        )}
        {error && <p className="dp-error" role="alert">{error}</p>}
      </div>

      <section className="dp-afina" data-deptos="afina" aria-label={DEPTOS_COPY.afina}>
        <h2 className="dp-afina-t">{DEPTOS_COPY.afina}</h2>
        <fieldset className="dp-bloque">
          <legend className="dp-pregunta">{DEPTOS_COPY.comuna} <span className="dp-ayuda">{DEPTOS_COPY.comunaAyuda}</span></legend>
          <div className="dp-chips" data-pregunta="comuna">
            {DESTACADAS.map(chipComuna)}
            {extras.map(chipComuna)}
            <button type="button" className="dp-chip dp-chip-otra" aria-expanded={buscando} onClick={abrirBuscador} disabled={lleno && !buscando}>{DEPTOS_COPY.otraComuna}</button>
          </div>
          {buscando && (
            <div className="dp-buscador" data-deptos="buscador">
              <input ref={campoBuscar} className="dp-campo dp-campo-chico" type="search" placeholder={DEPTOS_COPY.buscar} aria-label={DEPTOS_COPY.buscar}
                value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
              {encontradas.length > 0 ? (
                <div className="dp-chips dp-encontradas">
                  {encontradas.map((c) => (
                    <button key={c} type="button" className="dp-chip" disabled={lleno} onClick={() => elegirDelBuscador(c)}>{c}</button>
                  ))}
                </div>
              ) : (
                <p className="dp-fuera" role="status" data-deptos="fuera">{DEPTOS_COPY.fuera}</p>
              )}
            </div>
          )}
        </fieldset>

        <fieldset className="dp-bloque">
          <legend className="dp-pregunta">{DEPTOS_COPY.tipologia}</legend>
          <div className="dp-chips" data-pregunta="tipologia" role="radiogroup" aria-label={DEPTOS_COPY.tipologia}>
            {TIPOLOGIAS_DEPTOS.map((t) => (
              <button key={t.id} type="button" role="radio" className="dp-chip" aria-checked={tipologia === t.id} data-activo={tipologia === t.id ? "1" : undefined} onClick={() => setTipologia(t.id)}>
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
      </section>
      {pie}
    </div>
  );
}
