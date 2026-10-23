"use client";

// ─────────────────────────────────────────────────────────────────────────────
// /deptos en el navegador (16-oct-2026, la puerta B). La única meta de la pantalla es que dejen el correo.
// SEGÚN LOS MOCKUPS DE LA PUERTA B (23-oct-2026, decisión de Fabrizio; `docs/puerta-b-mockups/1b-deptos.html` y
// `2-estas-dentro.html`): el diseño plano de la casa —Inter, serif solo en el título de la página, botones píldora, la
// tarjeta roja solo para el regalo—.
//   1 · ELEGIR: el título y la bajada; la tarjeta «¿Qué buscas?» con los tres campos con nombre (CamposBusqueda: la comuna
//       vacía, «Elige una comuna»; la tipología y el rango puestos como sugerencia); al elegir la comuna, la tarjeta del
//       número («12 de 310 publicados convienen · Publicados anoche. Cambia la búsqueda y el número cambia.», de la
//       evaluación de la noche, GET /api/deptos/respuesta) y la tarjeta del correo con el material de la tríada: primero
//       «Entrar con Google», «o con tu correo», el campo y «Quiero verlos», «Sin contraseña: te mandamos un código». Debajo,
//       la prueba con las cifras de la noche y «Ver un análisis real». Sin pie ni plazo.
//   2 · EL CÓDIGO: en la misma tarjeta, «Te mandamos un código a …», el campo y «Entrar». El MISMO mensaje exista o no la
//       cuenta; al entrar, a la que ya existía se le pregunta si agrega la comuna a su perfil.
//   3 · «BIENVENIDO, ESTÁS DENTRO.»: la tarjeta roja del regalo; «Tu selección» con sus primeros deptos (PrimeraSeleccion,
//       sin esperar a nada); «Tu perfil de búsqueda» en una línea con «Editar» (al dashboard) y la nota de los lunes; «Ir a
//       mi dashboard». La modalidad y el «cuándo» ya no se preguntan acá: van al perfil del dashboard (parte 2).
// Lead al dejar el correo (servidor + pixel, mismo id); CompleteRegistration al crear la cuenta (el alta), con la puerta B.
// CON GOOGLE (16-oct-2026): antes de salir, lo elegido queda guardado con una clave (/api/deptos/google); vuelve a
// /deptos?entro=google&p=<clave> con sesión, el callback ya lo pasó a nombre del correo, y desde ahí todo es igual que por
// código: el Lead (al volver, cuando se sabe el correo), el alta y «Estás dentro».
// LA PÁGINA DEL INVITADO (16-oct-2026, la puerta C) usa esta misma pantalla con su cabecera, su puerta (C) y su página de
// vuelta (`/i/CÓDIGO`): los mismos campos, el mismo alta, la misma entrada con Google.
// SUPABASE POR import() (20-oct-2026, LCP en el teléfono): el cliente (48 kB) solo hace falta al pedir el código, al
// entrar con él o con Google; con el import estático bajaba antes de pintar la banda.
// EL RECORRIDO REAL DE FABRIZIO (21-oct-2026, lib/deptos/respuesta.ts › puedePedirCorreo): la comuna no viene elegida;
// recién con ella hay número y correo. «Estás dentro» no se va sola al dashboard: el alta se pide una vez (`altaPedida`),
// el `?entro` se saca de la URL y la pantalla se queda hasta que la persona toque un depto o «Ir a mi dashboard».
// «ENTRAR» NO QUEDA GIRANDO (22-oct-2026, lib/deptos/entrada.ts): el código lo verifica el servidor junto con el alta
// (POST /api/deptos/entrar). Todo pedido de este paso tiene tope y un reintento solo; si tampoco responde, el botón dice
// «No pudimos entrar, intenta de nuevo» y vuelve a estar activo con el mismo código.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { usePostHog } from "@/lib/posthog-react";
import { emitirAuthCompletada, marcarOAuthPendiente } from "@/lib/auth-analytics";
import { IconoGoogle } from "@/components/entrar/IconoGoogle";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { REGISTRO_UN_PASO } from "@/lib/lo-que-sigue/copy";
import { CODIGO_MAX, codigoValido, limpiarCodigo } from "@/lib/lo-que-sigue/codigo";
import { conTopeYReintento, ENTRAR_COPY } from "@/lib/deptos/entrada";
import { botonOcupado, claveActual, iniciarCarga } from "@/lib/carga-global";
import { marcarPuertaCandidata, type Puerta } from "@/lib/atribucion-puerta";
import { avisarLead, type OrigenLead } from "@/lib/meta/lead-cliente";
import { textoVence } from "@/lib/guia/semanal";
import {
  ALTA_COPY, claveDeDestino, ELECCIONES_POR_DEFECTO, CORREO_OK, DEPTOS_COPY, destinoGoogle, ESTAS_DENTRO_DEPTOS, lineaPerfil,
  MODALIDAD_POR_DEFECTO, puedePedirCorreo, TIPOLOGIA_POR_DEFECTO, type BusquedaDeptos, type RespuestaDeptos,
} from "@/lib/deptos/respuesta";
import type { PortadaDeptos } from "@/lib/deptos/portada";
import { CamposBusqueda, type ValorBusqueda } from "@/components/deptos/CamposBusqueda";
import { PrimeraSeleccion } from "@/components/deptos/PrimeraSeleccion";
import "./deptos.css";

type Paso = "elegir" | "codigo" | "dentro" | "agregar";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

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

/** Lo que responde el alta (POST /api/deptos/alta y POST /api/deptos/entrar). */
type RespuestaAlta = { estado?: string; regaloVence?: string | null; comunasNuevas?: string[]; comunas?: string[]; busqueda?: BusquedaDeptos | null; error?: string };

/** La búsqueda inicial, como clave: si la pantalla arranca con su respuesta del servidor, no la vuelve a pedir. Las
 *  comunas y el rango son los por defecto, o los de `?comuna=` (20-oct-2026, «Ver los deptos de [comuna]»). */
const claveInicial = (comunas: readonly string[], rango: string) => `${comunas.join(",")}|${ELECCIONES_POR_DEFECTO.tipologias[0]}|${rango}`;

export function DeptosCliente({ sesion, pagina = "/deptos", puerta = { puerta: "B", detalle: "deptos" }, origenLead = "seleccion", cabecera, pie, portada }: { sesion: { email: string } | null } & OpcionesDeptos) {
  const router = useRouter();
  const posthog = usePostHog();
  // Sin comuna de entrada (21-oct-2026): la elige la persona; solo `?comuna=` la trae puesta. Una comuna (el select).
  const [busqueda, setBusqueda] = useState<ValorBusqueda>({ comunas: [...(portada?.comunas ?? [])], tipologia: TIPOLOGIA_POR_DEFECTO, rango: portada?.rango ?? ELECCIONES_POR_DEFECTO.rango });
  const { comunas, tipologia, rango } = busqueda;
  const [respuesta, setRespuesta] = useState<RespuestaDeptos | null>(portada?.inicial ?? null);
  const [cargando, setCargando] = useState(false);
  const [paso, setPaso] = useState<Paso>("elegir");
  const [correo, setCorreo] = useState(sesion?.email ?? "");
  const [enviado, setEnviado] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState<false | "correo" | "google" | "entrar">(false);
  const [error, setError] = useState<string | null>(null);
  const [regaloVence, setRegaloVence] = useState<string | null>(null);
  const [agregar, setAgregar] = useState<{ nuevas: string[]; actuales: string[] } | null>(null);
  // «Tu perfil de búsqueda» (23-oct-2026): la búsqueda con que nació la cuenta, en una línea; se edita en el dashboard.
  const [busca, setBusca] = useState<BusquedaDeptos | null>(null);
  // LO QUE ESPERA SE VE ESPERANDO (22-oct-2026, lib/carga-global.ts): con qué botón se está yendo al dashboard, y si el
  // alta de la vuelta por el enlace o por Google está corriendo.
  const [yendo, setYendo] = useState<"si" | "no" | null>(null);
  const [altaEnCurso, setAltaEnCurso] = useState(false);
  /** El alta se pide UNA vez: sin esto, el refresh que trae la sesión la pedía de nuevo y la pantalla se iba al dashboard. */
  const altaPedida = useRef(false);
  // «ENTRAR» NO QUEDA GIRANDO (22-oct-2026, lib/deptos/entrada.ts): sin respuesta ni en el reintento, el botón lo dice y
  // vuelve a estar activo con el mismo código; al volver por el enlace o por Google, con qué reintentar el alta.
  const [falloEntrar, setFalloEntrar] = useState(false);
  const [altaPorReintentar, setAltaPorReintentar] = useState<{ clave: string | null; metodo: "email" | "google" } | null>(null);
  const pasoActual = useRef<Paso>("elegir");
  pasoActual.current = paso;
  const campoCodigo = useRef<HTMLInputElement>(null);
  /** La búsqueda de la respuesta que está a la vista (la por defecto, si vino del servidor): esa no se vuelve a pedir. Se
   *  anota al llegar la respuesta, no al pedirla: un pedido cortado (el doble efecto de React en desarrollo) se repite. */
  const servida = useRef<string | null>(portada?.inicial ? claveInicial(portada.comunas, portada.rango) : null);

  // La puerta B: el navegador la lleva hasta que la cuenta nace (useAttributionSync, el reclamo y el alta). La vista
  // (`deptos_vista`, `invitacion_vista`) ya no sale de acá: la emite el servidor (20-oct-2026, lib/vista-entrada.ts).
  useEffect(() => {
    marcarPuertaCandidata(puerta.puerta, puerta.detalle);
  }, [puerta.puerta, puerta.detalle]);

  const completo = comunas.length > 0 && !!tipologia && !!rango;

  // La respuesta al instante: cada campo la cambia; mientras llega, queda la anterior.
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

  const conComuna = puedePedirCorreo(comunas);

  async function pedirCodigo(e: FormEvent) {
    e.preventDefault();
    // Sin comuna elegida no hay correo (la tarjeta ni se dibuja): nadie entra con la búsqueda del ejemplo.
    if (!puedePedirCorreo(comunas)) return;
    const c = correo.trim().toLowerCase();
    if (!CORREO_OK.test(c)) { setError(REGISTRO_UN_PASO.errorCorreo); return; }
    setError(null);
    setOcupado("correo");
    try {
      const res = await fetch("/api/deptos/correo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: c, elecciones: { comunas, tipologias: [tipologia], rango, modalidad: MODALIDAD_POR_DEFECTO }, puerta: puerta.puerta }),
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
      const { createClient } = await import("@/lib/supabase/client");
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

  // «Entrar con Google»: lo elegido queda guardado con una clave, y la clave vuelve en el destino.
  async function conGoogle() {
    if (!puedePedirCorreo(comunas)) return;
    setError(null);
    setOcupado("google");
    try {
      const res = await fetch("/api/deptos/google", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elecciones: { comunas, tipologias: [tipologia], rango, modalidad: MODALIDAD_POR_DEFECTO }, puerta: puerta.puerta }),
      });
      const d = (await res.json().catch(() => ({}))) as { p?: string };
      if (!res.ok || !d.p) { setError(ALTA_COPY.error); return; }
      posthog?.capture("deptos_google", {});
      marcarOAuthPendiente("signup");
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destinoGoogle(d.p, pagina))}` },
      });
    } finally {
      setOcupado(false);
    }
  }

  // Lo que hace la pantalla con la respuesta del alta (venga de POST /api/deptos/alta o de POST /api/deptos/entrar).
  const aplicarAlta = useCallback((d: RespuestaAlta, metodo: "email" | "google") => {
    // El header y lo que lea la sesión se refrescan: ya está adentro.
    router.refresh();
    if (d.estado === "nueva") {
      setRegaloVence(d.regaloVence ?? null);
      setBusca(d.busqueda ?? null);
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
    // «Estás dentro» se queda hasta que la persona siga: una respuesta tardía o repetida nunca la saca de ahí.
    if (pasoActual.current === "dentro") return;
    iniciarCarga(claveActual());
    router.push("/dashboard");
  }, [posthog, router]);

  // Al volver por el enlace del correo o por Google: el alta, con tope y un reintento solo (entrada.ts). Si tampoco
  // responde, la pantalla ofrece reintentarla (ya hay sesión: no hace falta otro código).
  const terminarAlta = useCallback(async (clave: string | null = null, metodo: "email" | "google" = "email") => {
    setAltaPorReintentar(null);
    // Mientras corre (hasta 8 s y un reintento) se ve: la barra del header y, si se tocó «reintentar», ese botón ocupado.
    setAltaEnCurso(true);
    const soltar = iniciarCarga(claveActual());
    try {
      const r = await conTopeYReintento(async (senal) => {
        const res = await fetch("/api/deptos/alta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clave ? { p: clave } : {}), signal: senal });
        return (await res.json().catch(() => ({}))) as RespuestaAlta;
      });
      if (!r.ok) { setAltaPorReintentar({ clave, metodo }); return; }
      aplicarAlta(r.valor, metodo);
    } finally {
      soltar();
      setAltaEnCurso(false);
    }
  }, [aplicarAlta]);

  // Volvió por el enlace del correo o de Google, con sesión: termina el alta acá. Con Google, el Lead sale ahora (recién se
  // sabe el correo), igual que cuando se deja el correo; la clave va por si el callback no alcanzó a pasar lo elegido.
  // UNA VEZ (21-oct-2026): el `router.refresh()` del alta trae un objeto de sesión nuevo y este efecto vuelve a correr; con
  // el `?entro` todavía en la URL pedía el alta de nuevo, le respondían «sin-pendiente» y la pantalla se iba al dashboard.
  useEffect(() => {
    if (typeof window === "undefined" || !sesion || altaPedida.current) return;
    const entro = new URLSearchParams(window.location.search).get("entro");
    // La clave de Google se lee antes de limpiar la URL.
    const clave = entro === "google" ? claveDeDestino(`${window.location.pathname}${window.location.search}`) : null;
    if (entro === "google" || entro === "1") {
      altaPedida.current = true;
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
    if (entro === "google") {
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
    setFalloEntrar(false);
    setOcupado("entrar");
    try {
      // El código se verifica EN EL SERVIDOR y el alta corre en el mismo pedido (POST /api/deptos/entrar), con tope y un
      // reintento solo: si una respuesta se pierde, el mismo código repone la sesión y trae el alta ya hecha (22-oct-2026).
      const r = await conTopeYReintento(async (senal) => {
        const res = await fetch("/api/deptos/entrar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correo: enviado, codigo: t }), signal: senal });
        return { status: res.status, d: (await res.json().catch(() => ({}))) as RespuestaAlta };
      });
      if (!r.ok || r.valor.status >= 500 || r.valor.status === 401) { setFalloEntrar(true); return; }
      if (r.valor.d.error === "codigo") { setError(REGISTRO_UN_PASO.errorCodigoMal); return; }
      altaPedida.current = true;
      aplicarAlta(r.valor.d, "email");
    } finally {
      setOcupado(false);
    }
  }

  async function sumarComunas(si: boolean) {
    setYendo(si ? "si" : "no");
    if (si && agregar) {
      const todas = [...agregar.actuales, ...agregar.nuevas];
      const res = await fetch("/api/perfil-busqueda", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ comunas: todas }) });
      if (!res.ok) { setError(ALTA_COPY.error); setYendo(null); return; }
    }
    iniciarCarga(claveActual());
    router.push("/dashboard");
  }

  // ── Las pantallas ──
  if (paso === "dentro") {
    return (
      <div className="dp" data-deptos={paso}>
        <h1 className="dp-titulo">{ESTAS_DENTRO_DEPTOS.titulo}</h1>
        {/* LA TARJETA ROJA DEL REGALO (23-oct-2026): la única con color en la pantalla. */}
        {regaloVence && (
          <section className="dp-regalo" data-deptos="regalo" aria-label={ESTAS_DENTRO_DEPTOS.regalo.kicker}>
            <p className="dp-kicker">{ESTAS_DENTRO_DEPTOS.regalo.kicker}</p>
            <p className="dp-regalo-t">{ESTAS_DENTRO_DEPTOS.regalo.titulo}</p>
            <p className="dp-regalo-s">{ESTAS_DENTRO_DEPTOS.regalo.bajada} {textoVence(regaloVence)}</p>
          </section>
        )}
        {/* «Tu selección», ahí mismo (20-oct-2026): sin esperar a nada. */}
        <div data-deptos="primeros">
          <PrimeraSeleccion encabezado="dentro" />
        </div>
        {/* «Tu perfil de búsqueda» (23-oct-2026): la búsqueda con que nació la cuenta; se edita en el dashboard. */}
        {busca && (
          <section className="dp-perfil" data-deptos="perfil">
            <p className="dp-kicker">{ESTAS_DENTRO_DEPTOS.perfil.kicker}</p>
            <div className="dp-perfil-fila">
              <p className="dp-perfil-linea" data-deptos="perfil-linea">{lineaPerfil(busca)}</p>
              <EnlaceCarga href={ESTAS_DENTRO_DEPTOS.perfil.hrefEditar} className="dp-enlace" data-deptos="editar">{ESTAS_DENTRO_DEPTOS.perfil.editar}</EnlaceCarga>
            </div>
            <p className="dp-ayuda">{ESTAS_DENTRO_DEPTOS.perfil.nota}</p>
          </section>
        )}
        <div className="dp-fin">
          <EnlaceCarga href={ESTAS_DENTRO_DEPTOS.hrefDashboard} className="dp-boton-contorno" data-deptos="ir-panel">{ESTAS_DENTRO_DEPTOS.dashboard}</EnlaceCarga>
        </div>
        {error && <p className="dp-error" role="alert">{error}</p>}
      </div>
    );
  }

  if (paso === "agregar" && agregar) {
    return (
      <div className="dp" data-deptos="agregar">
        <h1 className="dp-titulo">{ALTA_COPY.agregar(agregar.nuevas)}</h1>
        <div className="dp-fin dp-fin-izq">
          <button type="button" className="dp-boton dp-boton-tinta" onClick={() => void sumarComunas(true)} disabled={!!yendo} {...botonOcupado(yendo === "si")}>{ALTA_COPY.agregarSi}</button>
          <button type="button" className="dp-enlace" onClick={() => void sumarComunas(false)} disabled={!!yendo} {...botonOcupado(yendo === "no")}>{ALTA_COPY.agregarNo}</button>
        </div>
        {error && <p className="dp-error" role="alert">{error}</p>}
      </div>
    );
  }

  const prueba = DEPTOS_COPY.prueba(portada?.noche?.revisados ?? null, portada?.noche?.convienen ?? null);
  const bajadaCorreo = DEPTOS_COPY.correo.bajada(respuesta?.convienen ?? 0);
  return (
    <div className="dp" data-deptos="elegir">
      {cabecera}
      <h1 className="dp-titulo" data-deptos="titulo">{DEPTOS_COPY.titulo}</h1>
      <p className="dp-bajada" data-deptos="bajada"><b>{DEPTOS_COPY.bajadaFuerte}</b> {DEPTOS_COPY.bajada}</p>

      {/* De vuelta por el enlace o por Google, el alta no respondió (22-oct-2026): ya hay sesión, se reintenta sin código. */}
      {altaPorReintentar && (
        <div className="dp-fin dp-fin-izq" data-deptos="alta-fallida">
          <button type="button" className="dp-boton dp-boton-tinta" onClick={() => void terminarAlta(altaPorReintentar.clave, altaPorReintentar.metodo)} disabled={altaEnCurso} {...botonOcupado(altaEnCurso)}>{ENTRAR_COPY.noPudimos}</button>
        </div>
      )}

      {/* ¿QUÉ BUSCAS?: los tres campos (los mismos del perfil del dashboard). */}
      <section className="dp-tarjeta" data-deptos="campos" aria-label={DEPTOS_COPY.queBuscas}>
        <h2 className="dp-tarjeta-t">{DEPTOS_COPY.queBuscas}</h2>
        <CamposBusqueda valor={busqueda} onChange={(_campo, v) => setBusqueda(v)} ids="deptos" />
        {!conComuna && <p className="dp-ayuda" data-deptos="elige-bajada">{DEPTOS_COPY.eligeYTeDecimos}</p>}
      </section>

      {/* SIN COMUNA, SIN NÚMERO NI CORREO (21-oct-2026): primero la elige la persona. */}
      {conComuna && (<>
      <section className="dp-tarjeta dp-tarjeta-numero" aria-live="polite" data-deptos="respuesta" data-cargando={cargando ? "1" : undefined}>
        {respuesta ? (
          <>
            <p className="dp-numero" data-convienen={respuesta.convienen}>
              {respuesta.resto ? <><span className="dp-cifra" data-deptos="cifra">{miles(respuesta.convienen)}</span><span className="dp-resto">{respuesta.resto}</span></> : <span className="dp-resto dp-resto-solo">{respuesta.titular}</span>}
            </p>
            <p className="dp-ayuda" data-deptos="nota">{respuesta.nota}</p>
            {respuesta.alternativa && <p className="dp-alternativa" data-deptos="alternativa">{respuesta.alternativa}</p>}
          </>
        ) : (
          <p className="dp-numero dp-esperando" aria-hidden="true"><span className="dp-cifra">…</span></p>
        )}
      </section>
      <div className="dp-banda" data-deptos="banda">
        {paso === "codigo" && enviado ? (
          <form className="dp-form" onSubmit={entrar} data-deptos="codigo">
            <p className="dp-banda-t">{DEPTOS_COPY.enviado(enviado)}</p>
            <input ref={campoCodigo} className="dp-campo" inputMode="numeric" autoComplete="one-time-code" maxLength={CODIGO_MAX} placeholder={REGISTRO_UN_PASO.placeholderCodigo}
              aria-label={REGISTRO_UN_PASO.placeholderCodigo} value={codigo} onChange={(e) => setCodigo(limpiarCodigo(e.target.value))} />
            <button type="submit" className="dp-boton" disabled={!!ocupado} {...botonOcupado(ocupado === "entrar")} data-deptos="entrar" data-fallo={falloEntrar ? "1" : undefined}>{falloEntrar ? ENTRAR_COPY.noPudimos : REGISTRO_UN_PASO.entrar}</button>
          </form>
        ) : (
          <form className="dp-form" onSubmit={pedirCodigo} data-deptos="correo">
            <p className="dp-banda-t">{respuesta?.registro ?? DEPTOS_COPY.correo.titulo}</p>
            {respuesta && <p className="dp-banda-s" data-deptos="correo-bajada">{bajadaCorreo.antes}<b>{bajadaCorreo.fuerte}</b>{bajadaCorreo.despues}</p>}
            {/* Primero Google, con el botón oficial (23-oct-2026): blanco, la G y «Entrar con Google». */}
            <button type="button" className="dp-google" onClick={() => void conGoogle()} disabled={!!ocupado} {...botonOcupado(ocupado === "google")} data-deptos="google"><IconoGoogle /> {ALTA_COPY.google}</button>
            <p className="dp-o" aria-hidden="true"><span /> {DEPTOS_COPY.correo.oTuCorreo} <span /></p>
            <input className="dp-campo" type="email" inputMode="email" autoComplete="email" placeholder={DEPTOS_COPY.correo.placeholder}
              aria-label={ALTA_COPY.correo} value={correo} onChange={(e) => setCorreo(e.target.value)} />
            <button type="submit" className="dp-boton" disabled={!!ocupado} {...botonOcupado(ocupado === "correo")} data-deptos="quiero-verlos">{ALTA_COPY.pedir}</button>
            <p className="dp-nota">{DEPTOS_COPY.correo.nota}</p>
          </form>
        )}
        {error && <p className="dp-error" role="alert">{error}</p>}
      </div>
      </>)}

      {/* LA PRUEBA: las cifras de la noche y un análisis real. */}
      <section className="dp-prueba" data-deptos="prueba">
        <p className="dp-prueba-t">{prueba.antes}<b>{prueba.fuerte}</b>{prueba.despues}</p>
        <EnlaceCarga href={DEPTOS_COPY.hrefAnalisis} className="dp-prueba-enlace" data-deptos="ver-analisis">{DEPTOS_COPY.verAnalisis} →</EnlaceCarga>
      </section>
      {pie}
    </div>
  );
}
