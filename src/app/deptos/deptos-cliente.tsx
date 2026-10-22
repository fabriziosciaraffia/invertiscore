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
// SUPABASE POR import() (20-oct-2026, LCP en el teléfono): el cliente (48 kB) solo hace falta al pedir el código, al
// entrar con él o con Google; con el import estático bajaba antes de pintar la banda. La atribución (useAttributionSync,
// en todas las páginas) ya lo pide con la página quieta, así que al tocar el botón el módulo suele estar en memoria.
// EL RECORRIDO REAL DE FABRIZIO (21-oct-2026, lib/deptos/respuesta.ts › puedePedirCorreo):
//   · la comuna ya no viene elegida: la página la pide y recién con ella muestra el número y la banda del correo (la
//     tipología y el rango siguen puestos, a la vista, como sugerencia);
//   · «Estás dentro» ya no se va sola al dashboard: al volver por el enlace del correo o por Google, `router.refresh()`
//     traía una sesión nueva, el efecto del `?entro` corría de nuevo, el alta respondía «sin-pendiente» (lo pendiente ya
//     se había borrado) y la pantalla caía en `router.push("/dashboard")`. Ahora el alta se pide una vez (`altaPedida`),
//     el `?entro` se saca de la URL y la pantalla se queda hasta que la persona toque un depto o «Ir a mi panel»;
//   · antes de los deptos, «Buscas: Santiago · 2D · UF 3.000 a 4.000 · Cambiar», con los chips a un toque; lo cambiado se
//     guarda cuando sigue («Listo» o «Ir a mi panel») y la selección del día se rearma (/api/deptos/rearmar).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
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
  ALTA_COPY, BUSCAS_COPY, cambiosDeBusqueda, claveDeDestino, COMUNAS_DESTACADAS, ELECCIONES_POR_DEFECTO, CORREO_OK, DEPTOS_COPY, destinoGoogle, lineaBuscas, MAX_COMUNAS_DEPTOS,
  MODALIDADES_DEPTOS, MODALIDAD_POR_DEFECTO, puedePedirCorreo, RANGOS_UF, TIPOLOGIA_POR_DEFECTO, TIPOLOGIAS_DEPTOS, type BusquedaDeptos, type ModalidadDeptos, type RespuestaDeptos,
} from "@/lib/deptos/respuesta";
import type { PortadaDeptos } from "@/lib/deptos/portada";
import { PrimeraSeleccion } from "@/components/deptos/PrimeraSeleccion";
import "./deptos.css";

type Paso = "elegir" | "codigo" | "dentro" | "agregar";

const DEPTOS_FIN = {
  cuenta: "Ir a mi panel",
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

/** La búsqueda inicial, como clave: si la pantalla arranca con su respuesta del servidor, no la vuelve a pedir. Las
 *  comunas y el rango son los por defecto, o los de `?comuna=` (20-oct-2026, «Ver los deptos de [comuna]»). */
const claveInicial = (comunas: readonly string[], rango: string) => `${comunas.join(",")}|${ELECCIONES_POR_DEFECTO.tipologias[0]}|${rango}`;

export function DeptosCliente({ sesion, pagina = "/deptos", puerta = { puerta: "B", detalle: "deptos" }, origenLead = "seleccion", cabecera, pie, portada }: { sesion: { email: string } | null } & OpcionesDeptos) {
  const router = useRouter();
  const posthog = usePostHog();
  // Sin comuna de entrada (21-oct-2026): la elige la persona; solo `?comuna=` la trae puesta.
  const [comunas, setComunas] = useState<string[]>([...(portada?.comunas ?? [])]);
  const [buscando, setBuscando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [tipologia, setTipologia] = useState<string>(TIPOLOGIA_POR_DEFECTO);
  const [rango, setRango] = useState<string>(portada?.rango ?? ELECCIONES_POR_DEFECTO.rango);
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
  // «Buscas: … · Cambiar» (21-oct-2026): la búsqueda con que nació la cuenta; lo cambiado se guarda al seguir.
  const [busca, setBusca] = useState<BusquedaDeptos | null>(null);
  const [cambiando, setCambiando] = useState(false);
  const [sinGuardar, setSinGuardar] = useState(false);
  const [guardandoBusca, setGuardandoBusca] = useState(false);
  /** Sube al guardar la búsqueda: la selección de abajo se vuelve a pedir. */
  const [version, setVersion] = useState(0);
  /** El alta se pide UNA vez: sin esto, el refresh que trae la sesión la pedía de nuevo y la pantalla se iba al dashboard. */
  const altaPedida = useRef(false);
  const pasoActual = useRef<Paso>("elegir");
  pasoActual.current = paso;
  const campoCodigo = useRef<HTMLInputElement>(null);
  const campoBuscar = useRef<HTMLInputElement>(null);
  /** La búsqueda de la respuesta que está a la vista (la por defecto, si vino del servidor): esa no se vuelve a pedir. Se
   *  anota al llegar la respuesta, no al pedirla: un pedido cortado (el doble efecto de React en desarrollo) se repite. */
  const servida = useRef<string | null>(portada?.inicial ? claveInicial(portada.comunas, portada.rango) : null);

  // La puerta B: el navegador la lleva hasta que la cuenta nace (useAttributionSync, el reclamo y el alta). La vista
  // (`deptos_vista`, `invitacion_vista`) ya no sale de acá: la emite el servidor (20-oct-2026, lib/vista-entrada.ts).
  useEffect(() => {
    marcarPuertaCandidata(puerta.puerta, puerta.detalle);
  }, [puerta.puerta, puerta.detalle]);

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
  const conComuna = puedePedirCorreo(comunas);

  async function pedirCodigo(e: FormEvent) {
    e.preventDefault();
    // Sin comuna elegida no hay correo (la banda ni se dibuja): nadie entra con la búsqueda del ejemplo.
    if (!puedePedirCorreo(comunas)) return;
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

  // «o con Google»: lo elegido queda guardado con una clave, y la clave vuelve en el destino.
  async function conGoogle() {
    if (!puedePedirCorreo(comunas)) return;
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

  const terminarAlta = useCallback(async (clave: string | null = null, metodo: "email" | "google" = "email") => {
    const res = await fetch("/api/deptos/alta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clave ? { p: clave } : {}) });
    const d = (await res.json().catch(() => ({}))) as { estado?: string; regaloVence?: string | null; comunasNuevas?: string[]; comunas?: string[]; busqueda?: BusquedaDeptos | null };
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
    router.push("/dashboard");
  }, [posthog, router]);

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
    setOcupado(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error: err } = await supabase.auth.verifyOtp({ email: enviado, token: t, type: "email" });
      if (err) { setError(REGISTRO_UN_PASO.errorCodigoMal); return; }
      altaPedida.current = true;
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

  // «Buscas: … · Cambiar» (21-oct-2026): los chips cambian la línea; «Listo» (o seguir) guarda y rearma la selección.
  const tocarBusca = (cambio: Partial<BusquedaDeptos>) => {
    setBusca((b) => (b ? { ...b, ...cambio } : b));
    setSinGuardar(true);
  };
  const tocarComunaBusca = (c: string) => {
    if (!busca) return;
    const xs = busca.comunas;
    tocarBusca({ comunas: xs.includes(c) ? (xs.length === 1 ? xs : xs.filter((x) => x !== c)) : xs.length >= MAX_COMUNAS_DEPTOS ? xs : [...xs, c] });
  };
  async function guardarBusca(): Promise<boolean> {
    const cambios = busca ? cambiosDeBusqueda(busca) : null;
    if (!cambios) return false;
    setGuardandoBusca(true);
    setError(null);
    try {
      const res = await fetch("/api/perfil-busqueda", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cambios) });
      if (!res.ok) { setError(BUSCAS_COPY.error); return false; }
      await fetch("/api/deptos/rearmar", { method: "POST" }).catch(() => null);
      posthog?.capture("deptos_busqueda_cambiada", { comunas: cambios.comunas.length });
      setSinGuardar(false);
      setCambiando(false);
      setVersion((v) => v + 1);
      return true;
    } finally {
      setGuardandoBusca(false);
    }
  }
  async function irAlPanel() {
    if (sinGuardar && !(await guardarBusca())) return;
    router.push("/dashboard");
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
        {/* LO QUE BUSCA, ANTES DE LOS DEPTOS (21-oct-2026): la búsqueda con que nació la cuenta, a un toque de cambiarla. */}
        {busca && (
          <div className="dp-bloque" data-deptos="buscas">
            <p className="dp-buscas">
              <span className="dp-buscas-k">{BUSCAS_COPY.buscas}</span> <b data-deptos="buscas-linea">{lineaBuscas(busca)}</b>{" · "}
              <button type="button" className="dp-enlace" aria-expanded={cambiando} onClick={() => setCambiando((x) => !x)} data-deptos="cambiar">{BUSCAS_COPY.cambiar}</button>
            </p>
            {cambiando && (
              <div className="dp-buscas-chips" data-deptos="buscas-chips">
                <div className="dp-chips" data-pregunta="comuna">
                  {[...DESTACADAS, ...busca.comunas.filter((c) => !DESTACADAS.includes(c))].map((c) => (
                    <button key={c} type="button" className="dp-chip" aria-pressed={busca.comunas.includes(c)} data-activo={busca.comunas.includes(c) ? "1" : undefined}
                      disabled={!busca.comunas.includes(c) && busca.comunas.length >= MAX_COMUNAS_DEPTOS} onClick={() => tocarComunaBusca(c)}>{c}</button>
                  ))}
                  <label className="dp-chip dp-chip-otra" style={{ position: "relative" }}>
                    {DEPTOS_COPY.otraComuna}
                    <select aria-label={DEPTOS_COPY.otraComuna} value="" onChange={(e) => { if (e.target.value) tocarComunaBusca(e.target.value); }}
                      style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer" }}>
                      <option value="">{DEPTOS_COPY.otraComuna}</option>
                      {(COMUNAS_DISPONIBLES as readonly string[]).filter((c) => !DESTACADAS.includes(c) && !busca.comunas.includes(c)).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                </div>
                <div className="dp-chips" data-pregunta="tipologia" role="radiogroup" aria-label={DEPTOS_COPY.tipologia}>
                  {TIPOLOGIAS_DEPTOS.map((t) => (
                    <button key={t.id} type="button" role="radio" className="dp-chip" aria-checked={busca.tipologia === t.id} data-activo={busca.tipologia === t.id ? "1" : undefined} onClick={() => tocarBusca({ tipologia: t.id })}>{t.chip}</button>
                  ))}
                </div>
                <div className="dp-chips" data-pregunta="rango" role="radiogroup" aria-label={DEPTOS_COPY.rango}>
                  {RANGOS_UF.map((r) => (
                    <button key={r.id} type="button" role="radio" className="dp-chip" aria-checked={busca.rango === r.id} data-activo={busca.rango === r.id ? "1" : undefined} onClick={() => tocarBusca({ rango: r.id })}>{r.chip}</button>
                  ))}
                </div>
                <div className="dp-fin">
                  <button type="button" className="dp-boton" onClick={() => void guardarBusca()} disabled={guardandoBusca} data-deptos="buscas-listo">{guardandoBusca ? BUSCAS_COPY.guardando : BUSCAS_COPY.listo}</button>
                </div>
              </div>
            )}
          </div>
        )}
        {/* La primera selección, ahí mismo (20-oct-2026): sin esperar a que conteste el «cuándo». Con la búsqueda nueva
            guardada, se vuelve a pedir (`version`). */}
        <div className="dp-bloque" data-deptos="primeros" data-cambiando={cambiando ? "1" : undefined}>
          <PrimeraSeleccion key={version} volver={pagina} />
        </div>
        <div className="dp-fin">
          <button type="button" className="dp-boton" onClick={() => void irAlPanel()} disabled={guardandoBusca} data-deptos="ir-panel">{DEPTOS_FIN.cuenta}</button>
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

      {/* SIN COMUNA, SIN NÚMERO NI CORREO (21-oct-2026): primero la elige la persona. */}
      {conComuna && (<>
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
      </>)}

      <section className="dp-afina" data-deptos="afina" data-sin-comuna={conComuna ? undefined : "1"} aria-label={conComuna ? DEPTOS_COPY.afina : BUSCAS_COPY.eligeComuna}>
        <h2 className="dp-afina-t">{conComuna ? DEPTOS_COPY.afina : BUSCAS_COPY.eligeComuna}</h2>
        {!conComuna && <p className="dp-nota" data-deptos="elige-bajada">{DEPTOS_COPY.bajada}</p>}
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
