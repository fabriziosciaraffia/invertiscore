"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Wizard v4 — PANTALLA DE ENTRADA (nodo `dir`)
//
// ESTA PANTALLA NO ES LA PRIMERA PREGUNTA DE UN FORMULARIO. Es la página de
// venta del producto, y lo es por un dato: 824 sesiones caen directo acá contra
// 219 en la landing. El 79% del tráfico nunca ve la home, así que si esta
// pantalla no explica qué hace Franco, nadie se lo explica.
//
// Reemplaza a la vieja `mod` como primer paso (la modalidad se pregunta al
// final) y absorbe el campo de dirección, que antes era un paso aparte. La
// fusión es deliberada: quien acaba de tocar su comuna está comprometido, y
// mandarlo a otra pantalla a escribir la dirección corta ese impulso.
//
// LA REGLA DURA: TODO EL ESTADO 1 CABE SOBRE EL PLIEGUE A 390×640
// ───────────────────────────────────────────────────────────────
// Cero de 214 sesiones hicieron scroll en la pantalla de entrada. No es que
// scrollearan poco: es que NADIE scrolleó. Lo que queda abajo del pliegue no
// existe. Por eso el estado 1 no lleva mapa, ni tooltips, ni el enlace de "no
// tengo uno elegido" — cada cosa que se agrega empuja al CTA fuera de la
// pantalla y hace desaparecer la única acción que importa.
//
// El wizard corre 459 a 12 en mobile contra desktop. Se diseña para 390px y
// desktop hereda.
//
// TRES ESTADOS, UNA SOLA PANTALLA
// ───────────────────────────────
//   1 · entrada        — título + bajada + chips de comuna. Nada más.
//   2 · comuna elegida — el chip queda marcado y aparece la dirección INLINE.
//   3 · sin depto      — referencia de mercado de la comuna, sin análisis.
//
// El enlace "Todavía no tengo uno elegido" vive SOLO en el estado 2. En el
// estado 1 sembraría la duda de si el usuario califica, justo cuando todavía no
// se comprometió con nada.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
import { COMUNAS } from "@/lib/comunas";
import { isComunaDisponible } from "@/lib/comunas-disponibles";
import { slugify } from "@/lib/utils";
import { MapaThumbnail } from "@/components/formulario-v3/MapaThumbnail";
import type { ScreenProps } from "./screensActo1";
import { FieldLabel, PrimaryBtn } from "./ui";
import { trackWizard } from "./track";
import { rangoChars, registrarSondaSalida, reportarValidacionRechazo } from "./stepTelemetry";
import { WaitlistZonaInline } from "./WaitlistZonaInline";
import { decidirEnganche, derivarComuna, plano } from "./entradaPlaces";
import { cajaParaComuna, type Caja } from "@/lib/comuna-bounds";
import { PLUSVALIA_DEFAULT_RANGO } from "@/lib/plusvalia-estimado.gen";

// ─────────────────────────────────────────────────────────────────────────────
// CHIPS DE COMUNA — las cinco más analizadas, medidas
//
// No son las cinco "que suenan lógicas": salen de contar `analisis` reales
// (excluyendo el demo y las filas pending_payment, que nunca se pagaron).
//
//   SELECT comuna, count(*) FROM analisis
//   WHERE id <> '6db7a9ac-…' AND pending_payment IS NOT TRUE AND comuna IS NOT NULL
//   GROUP BY comuna ORDER BY count(*) DESC;
//
// Sobre 964 análisis vivos (25 comunas distintas), al 19-ago-2026:
//   Providencia 258 (26,8%) · Santiago 161 (16,7%) · Ñuñoa 110 (11,4%) ·
//   Las Condes 106 (11,0%) · La Florida 54 (5,6%). Juntas: 71,5%.
//
// El orden de acá es el de los ÚLTIMOS 60 DÍAS (n=730), que es la señal viva:
// Providencia 133 · Ñuñoa 107 · Santiago 106 · Las Condes 82 · La Florida 50.
// Las dos ventanas coinciden en las mismas cinco comunas y en los extremos; solo
// se turnan Ñuñoa y Santiago en el medio.
//
// Cuándo re-medir: si el sexto (Macul, 41) se acerca al quinto, o si se abre
// cobertura nueva. La comuna NO viaja en los eventos de PostHog, así que esta
// query sobre la base es la única fuente.
// ─────────────────────────────────────────────────────────────────────────────
const COMUNAS_CHIP = ["Providencia", "Ñuñoa", "Santiago", "Las Condes", "La Florida"] as const;

/** Comunas de la Región Metropolitana, para el buscador de "Otra comuna…". */
const COMUNAS_RM = COMUNAS.filter((c) => c.region === "Metropolitana");

interface ComunaStats {
  nombre: string;
  totalPropiedades: number;
  precioM2UF: number;
  precioM2CLP: number;
  arriendoCLP: number;
  /** Cómo se armó ese arriendo; un estimado desde el m² comunal se rotula como tal. */
  arriendoFuente?: "propia" | "estimada" | "mixta";
  rentabilidadBruta: number;
  plusvaliaAnualizada: number | null;
  /** Período de esa cifra; viaja con ella para no rotularla con un rango ajeno. */
  plusvaliaRango: string | null;
}

/** `Caja` → el `LatLngBounds` que espera Places. Un solo lugar arma el objeto. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aLatLngBounds(google: any, caja: Caja) {
  const [sur, oeste, norte, este] = caja;
  return new google.maps.LatLngBounds(
    new google.maps.LatLng(sur, oeste),
    new google.maps.LatLng(norte, este),
  );
}

const fmtCLP = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const fmtPct = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;

export function EntradaScreen({ answers, data, patchAnswers, answer }: ScreenProps) {
  const posthog = usePostHog();
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const acRef = useRef<any>(null);
  /** Nodo al que está atado `acRef`. Si cambia, hay que re-atar (ver el efecto). */
  const nodoAtado = useRef<HTMLInputElement | null>(null);
  /** Comuna vigente, para leerla al crear el widget sin meterla en las deps del
   *  efecto (meterla ahí re-crearía el widget de Places en cada corrección). */
  const comunaRef = useRef<string | undefined>(undefined);

  /** Estado 3, local: no es una respuesta del wizard, es un desvío de lectura. */
  const [sinDepto, setSinDepto] = useState(false);
  const [buscador, setBuscador] = useState(false);
  const [query, setQuery] = useState("");
  /** Salida de emergencia del campo (ver `usarDireccionEscrita`). */
  const [fallback, setFallback] = useState<null | "buscando" | "fallo">(null);

  const { direccion, direccionConfirmada, comuna, ciudad, lat, lng } = answers;
  const confirmada = !!direccionConfirmada && direccion === direccionConfirmada;
  const fueraDeZona = !!comuna && !isComunaDisponible(comuna);
  const puedeSeguir = confirmada && !!comuna && !fueraDeZona;
  const estado: 1 | 2 | 3 = !comuna ? 1 : sinDepto ? 3 : 2;
  comunaRef.current = comuna;

  // ── Sonda de salida (I-2) ──
  // Se conserva el nombre `wizard4_dir_tipeo` para no cortar la serie del campo
  // de dirección, que sigue siendo el mismo campo. Lo que se agrega es en qué
  // ESTADO se fue la persona: con la pantalla vieja "salió sin tipear" era una
  // sola historia, y ahora son tres bien distintas.
  const charsMax = useRef(0);
  const sugerenciaSeleccionada = useRef(false);
  const regionRef = useRef<string | null>(null);
  const estadoSalida = useRef({ conTexto: false, confirmada: false, estado: 1 as 1 | 2 | 3 });
  estadoSalida.current = { conTexto: !!direccion?.trim(), confirmada, estado };
  charsMax.current = Math.max(charsMax.current, direccion?.trim().length ?? 0);

  registrarSondaSalida("dir", () => ({
    name: "wizard4_dir_tipeo",
    props: {
      chars_rango: rangoChars(charsMax.current),
      sugerencia_seleccionada: sugerenciaSeleccionada.current,
      salio_con_texto_sin_seleccion:
        estadoSalida.current.conTexto && !estadoSalida.current.confirmada,
      // Nuevo (19-ago-2026): 1 = no llegó a elegir comuna · 2 = eligió y estaba
      // en la dirección · 3 = se fue por la rama "no tengo uno elegido".
      estado_salida: estadoSalida.current.estado,
    },
  }));

  // ── Places sobre el campo de dirección (estado 2) ──
  //
  // EL ENGANCHE SIGUE AL NODO VIVO, NO A UN REF GLOBAL (fix 20-ago-2026)
  // ────────────────────────────────────────────────────────────────────
  // El input SOLO existe en el estado 2, así que volver al 1 (cambiar de comuna)
  // o al 3 ("todavía no tengo uno elegido") lo desmonta, y al volver React crea
  // un nodo NUEVO. El guard original era `if (acRef.current) return`, que
  // sobrevive al desmontaje: en el segundo montaje el efecto se iba por el
  // return y el Autocomplete quedaba escuchando a un `<input>` que ya no estaba
  // en el DOM. El campo que el usuario veía no estaba conectado a nada.
  //
  // Consecuencia medida en producción: no aparece el desplegable → nunca se
  // setea `direccionConfirmada` → sale "Selecciona la dirección de la lista" y
  // Continuar queda bloqueado. Camino principal roto para el ~19% de quienes
  // tipearon (8 de 43 sesiones el 20-ago).
  //
  // La pantalla anterior no podía tener este bug porque su input era
  // incondicional: vivía montado toda la visita. Es regresión de la portada.
  //
  // Ahora se recuerda a QUÉ NODO se ató. Si el nodo cambió, se desatan los
  // listeners del instance viejo y se vuelve a atar al vivo.
  useEffect(() => {
    if (estado !== 2) return;
    let cancelado = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelado) return;
        const input = inputRef.current;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const google = (window as any).google;
        if (!google?.maps?.places) return;
        // La decisión vive en `entradaPlaces.ts` y está testeada: acá solo se
        // ejecuta. "ya-atado" evita re-crear el widget en cada render, que era
        // lo único que el guard viejo protegía bien.
        const accion = decidirEnganche({
          tieneInstancia: !!acRef.current,
          nodoAtado: nodoAtado.current,
          nodoVivo: input,
        });
        if (accion === "sin-nodo" || accion === "ya-atado") return;
        if (accion === "reatar") {
          // Atado a un nodo muerto. `Autocomplete` no tiene destroy(), así que
          // lo más cerca es soltarle los listeners y abandonar el instance.
          google.maps.event.clearInstanceListeners(acRef.current);
          acRef.current = null;
          nodoAtado.current = null;
          // El instance viejo dejó su `.pac-container` colgado del <body> —
          // Google los crea ahí y nunca los recoge. Sin esto queda un
          // desplegable huérfano, con sugerencias rancias, que puede aparecer
          // sobre el campo nuevo. Se pueden borrar TODOS sin riesgo: esta
          // pantalla es la única con un Autocomplete montado (la del resumen
          // vive en otra pantalla y nunca coexisten).
          document.querySelectorAll(".pac-container").forEach((n) => n.remove());
        }
        // ── FILTRO DURO: la comuna elegida (y con ella, la RM) ──
        // `componentRestrictions` solo admite país — no hay restricción por
        // región ni por comuna en esta API. `bounds` a secas es solo un SESGO
        // (medido: con la caja de la RM sin `strictBounds` seguían saliendo
        // Ovalle, Valdivia y hasta Linares). `strictBounds` es el único filtro
        // que EXCLUYE de verdad, y es el que se usa acá.
        //
        // Toda caja comunal viene recortada contra la de la RM, así que el piso
        // regional no depende de que haya comuna elegida: `cajaParaComuna(null)`
        // devuelve la RM. Nunca se vuelve a "todo Chile".
        const ac = new google.maps.places.Autocomplete(input, {
          types: ["address"],
          componentRestrictions: { country: "cl" },
          bounds: aLatLngBounds(google, cajaParaComuna(comunaRef.current)),
          strictBounds: true,
          fields: ["geometry", "formatted_address", "address_components"],
        });
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (!place?.geometry?.location) return;
          const plat = place.geometry.location.lat();
          const plng = place.geometry.location.lng();
          const addr = place.formatted_address || inputRef.current?.value || "";
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const comps = (place.address_components || []) as any[];
          // En la RM, Google mapea la comuna a `locality` (fallback admin_level_3).
          const comunaRaw =
            comps.find((c) => c.types.includes("locality"))?.long_name ||
            comps.find((c) => c.types.includes("administrative_area_level_3"))?.long_name ||
            "";
          const match = COMUNAS.find((c) => c.comuna.toLowerCase() === comunaRaw.toLowerCase());
          const comunaFinal = match?.comuna || comunaRaw;
          const cubierta = isComunaDisponible(comunaFinal);
          const regionRaw =
            comps.find((c) => c.types.includes("administrative_area_level_1"))?.long_name || "";
          sugerenciaSeleccionada.current = true;
          regionRef.current = regionRaw || null;
          if (!cubierta) {
            trackWizard(posthog, "wizard4_dir_rechazo_cobertura", {
              comuna: comunaFinal || "sin_dato",
              region: regionRaw || "sin_dato",
            });
            reportarValidacionRechazo(posthog, "cobertura", "dir");
          }
          // REGRESIÓN-7: Google rellena el input con un texto distinto al
          // formatted_address, y su `input` event puede correr DESPUÉS de este
          // handler → direccion ≠ direccionConfirmada. Sincronizamos el input a
          // la dirección canónica y usamos ESA misma cadena para ambos.
          if (inputRef.current) inputRef.current.value = addr;
          // La dirección MANDA sobre el chip: si el usuario tocó "Ñuñoa" y después
          // escribió una dirección de Macul, la comuna real es Macul. El chip era
          // una forma de arrancar, no una declaración.
          patchAnswers({
            direccion: addr,
            comuna: comunaFinal,
            ciudad: match?.ciudad || "Santiago",
            ...(cubierta
              ? { direccionConfirmada: addr, lat: plat, lng: plng }
              : { direccionConfirmada: undefined, lat: undefined, lng: undefined }),
          });
        });
        acRef.current = ac;
        nodoAtado.current = input;
      })
      .catch(() => { /* ignore */ });
    return () => { cancelado = true; };
    // `posthog` es estable y solo se usa dentro del listener: re-suscribir por
    // él re-crearía el widget de Places.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patchAnswers, estado]);

  // La comuna puede cambiar SIN que el input se remonte: pasa cuando Places
  // corrige el chip (se tocó Providencia y la dirección resultó de Ñuñoa). Ahí
  // el widget ya existe, así que se le mueve la caja en vez de re-crearlo — con
  // `setBounds`, que es la API que el propio widget expone para esto.
  useEffect(() => {
    const ac = acRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const google = (window as any).google;
    if (!ac || !google?.maps) return;
    ac.setBounds(aLatLngBounds(google, cajaParaComuna(comuna)));
  }, [comuna]);

  function elegirComuna(nombre: string, origen: "chip" | "buscador") {
    const match = COMUNAS.find((c) => c.comuna === nombre);
    trackWizard(posthog, "wizard4_entrada_comuna", {
      comuna: nombre,
      origen,
      cubierta: isComunaDisponible(nombre),
    });
    setBuscador(false);
    setQuery("");
    setSinDepto(false);
    // Cambiar de comuna INVALIDA la dirección anterior. Sin esto, "Cambiar"
    // dejaba `direccion` y `direccionConfirmada` de la comuna vieja: el input
    // (no controlado, con `defaultValue`) reaparecía con el texto anterior, el
    // usuario escribía encima y quedaba concatenado —"Irarrazaval 2100Av.
    // Providencia 1234"—, y `confirmada` seguía apuntando a una dirección que
    // ya no correspondía. Medido en producción el 20-ago.
    patchAnswers({
      comuna: nombre,
      ciudad: match?.ciudad || "Santiago",
      direccion: undefined,
      direccionConfirmada: undefined,
      lat: undefined,
      lng: undefined,
    });
    setFallback(null);
  }

  /** Vuelve al estado 1 sin arrastrar la dirección de la comuna anterior. */
  function cambiarComuna() {
    patchAnswers({
      comuna: undefined,
      direccion: undefined,
      direccionConfirmada: undefined,
      lat: undefined,
      lng: undefined,
    });
    setFallback(null);
  }

  // ── SALIDA SIN BLOQUEO ────────────────────────────────────────────────────
  // El campo exige elegir de la lista de Places, y si Places no responde —API
  // caída, cuota, red mala, o el bug que este commit arregla— el usuario queda
  // encerrado: se le pide seleccionar de una lista que no ve. Un camino
  // principal no puede tener un callejón sin salida.
  //
  // Acá se geocodifica lo que ESCRIBIÓ contra `/api/geocode` (endpoint que ya
  // existía, público, con Google del lado servidor y Nominatim de respaldo).
  // No reemplaza a Places: es lo que se ofrece recién cuando Places ya falló.
  //
  // La comuna se deriva del `formattedAddress` que devuelve el geocodificador,
  // no del chip: alguien que tocó "Providencia" y escribió Irarrázaval 2100
  // está en Ñuñoa, y así lo resuelve (verificado contra el endpoint en prod).
  // Si la comuna derivada no está cubierta, se guarda igual y la pantalla cae
  // en el mismo rechazo de cobertura que el camino de Places — con su captura
  // de correo. Nunca se inventa una cobertura que no existe.
  async function usarDireccionEscrita() {
    const q = direccion?.trim();
    if (!q || !comuna) return;
    setFallback("buscando");
    trackWizard(posthog, "wizard4_entrada_fallback_geocode", { comuna });
    try {
      const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}&comuna=${encodeURIComponent(comuna)}`);
      const j = (await r.json()) as { lat: number | null; lng: number | null; formattedAddress?: string };
      if (!r.ok || j.lat == null || j.lng == null) {
        setFallback("fallo");
        return;
      }
      const fmt = j.formattedAddress ?? q;
      const d = derivarComuna(fmt, comuna);
      trackWizard(posthog, "wizard4_entrada_fallback_resuelto", {
        comuna: d.comuna,
        cubierta: d.cubierta,
        corrigio_al_chip: d.corrigioAlChip,
      });
      setFallback(null);
      if (inputRef.current) inputRef.current.value = fmt;
      patchAnswers({
        direccion: fmt,
        comuna: d.comuna,
        ciudad: d.ciudad,
        ...(d.cubierta
          ? { direccionConfirmada: fmt, lat: j.lat, lng: j.lng }
          : { direccionConfirmada: undefined, lat: undefined, lng: undefined }),
      });
    } catch {
      setFallback("fallo");
    }
  }

  function verEjemplo() {
    trackWizard(posthog, "wizard4_entrada_ejemplo", { estado });
  }

  if (estado === 3) {
    return (
      <SinDeptoScreen
        comuna={comuna!}
        onVolver={() => setSinDepto(false)}
        onEjemplo={verEjemplo}
      />
    );
  }

  return (
    <div className="flex flex-col">
      {/* ── Título. El fragmento en Signal Red es la pregunta real: no "¿cuánto
          rinde?" sino "¿se paga solo?", que es como lo piensa quien todavía no
          sabe si puede sostener el dividendo. Uso #3 del rojo por extensión —
          es el veredicto que la pantalla promete, no decoración. ── */}
      <h1 className="wizard4-entrada-title font-heading text-[31px] md:text-[40px] font-bold text-[var(--franco-text)] m-0 leading-[1.12] tracking-[-0.01em]">
        ¿El depto que quieres para invertir{" "}
        <span className="text-signal-red">se paga solo?</span>
      </h1>

      {/* Bajada en dos líneas: la primera describe, la segunda remata. El peso
          sube en la segunda porque es la promesa que diferencia a Franco de una
          calculadora de dividendo. */}
      <p className="font-body text-[15px] md:text-[16px] text-[var(--franco-text-secondary)] mt-3 mb-0 leading-relaxed">
        Veamos si te deja o te quita plata todos los meses.
      </p>
      <p className="font-body text-[15px] md:text-[16px] font-medium text-[var(--franco-text)] mt-0.5 mb-0 leading-relaxed">
        Y si al final es buena inversión.
      </p>

      {estado === 1 ? (
        <>
          {/* Transición hacia la única acción de la pantalla. Decorativa de
              punta a punta: `aria-hidden` para que ningún lector de pantalla la
              anuncie —no dice nada que el texto no diga— y el gesto vive en CSS
              (ver `.wizard4-entrada-*` en globals.css), no en estado de React.
              Signal Red porque conduce al CTA, que es el uso permitido. */}
          <div aria-hidden="true" className="flex flex-col items-center mt-[18px] mb-[15px]">
            <span className="block w-[1.5px] h-7 rounded-[2px] bg-signal-red origin-top wizard4-entrada-trazo" />
            <svg
              width="14" height="9" viewBox="0 0 14 9" fill="none"
              className="mt-1 wizard4-entrada-chevron"
            >
              <path
                d="M1 1L7 7L13 1"
                stroke="var(--signal-red)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="mt-6">
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--franco-text-tertiary)] block mb-2.5">
              Partamos por la comuna
            </span>
            <div className="flex flex-wrap gap-2">
              {COMUNAS_CHIP.map((c) => (
                <ChipComuna key={c} onClick={() => elegirComuna(c, "chip")}>
                  {c}
                </ChipComuna>
              ))}
              <ChipComuna punteado onClick={() => setBuscador(true)}>
                Otra comuna…
              </ChipComuna>
            </div>
          </div>

          {buscador && (
            <BuscadorComuna
              query={query}
              setQuery={setQuery}
              onElegir={(c) => elegirComuna(c, "buscador")}
            />
          )}

          {/* Pie: gratis y rápido. NO dice "sin crear cuenta" — nombrar la
              fricción es recordarla, y acá no hay ninguna que salvar. */}
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--franco-text-muted)] mt-5 mb-0">
            Gratis · 2 minutos
          </p>

          <a
            href="/demo"
            onClick={verEjemplo}
            className="inline-flex items-center gap-1.5 mt-4 font-body text-[13px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] underline underline-offset-4 decoration-[var(--franco-border-strong)] transition-colors w-fit"
          >
            <FileText size={14} className="shrink-0" />
            Ver un análisis de ejemplo
          </a>
        </>
      ) : (
        // ── Estado 2 ──
        <div className="mt-6 flex flex-col gap-4">
          {/* El chip elegido NO es un botón: es la confirmación de lo que
              elegiste. Antes borraba la comuna al tocarlo —se ve como etiqueta,
              está justo sobre el campo de dirección y en mobile se toca sin
              querer—, y eso mandaba al estado 1 y de vuelta, que es el camino
              que dejaba el Autocomplete muerto. Deshacer se hace en un solo
              lugar, y ese lugar dice "Cambiar". */}
          <div className="flex flex-wrap gap-2">
            <span
              className="font-body text-[14px] px-4 py-2.5 rounded-xl min-h-[44px] flex items-center bg-[var(--franco-text)] text-[var(--franco-bg)] border-[0.5px] border-[var(--franco-text)]"
            >
              {comuna}
            </span>
            <ChipComuna punteado onClick={cambiarComuna}>
              Cambiar
            </ChipComuna>
          </div>

          <div>
            <FieldLabel tooltip="La ubicación define los comparables, cercanía a metro y servicios. Escribe y elige una opción del dropdown.">
              Dirección
            </FieldLabel>
            <input
              ref={inputRef}
              type="text"
              autoComplete="off"
              placeholder={`Ej: Av. Providencia 1234, ${comuna}`}
              defaultValue={direccion}
              onChange={(e) => patchAnswers({ direccion: e.target.value })}
              className="w-full h-11 rounded-lg border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] px-3 text-[15px] font-body text-[var(--franco-text)] focus:border-signal-red focus:outline-none focus:ring-1 focus:ring-signal-red/20 transition-colors"
            />
            {/* Prioridad del mensaje: la cobertura manda (BUG-1). */}
            {fueraDeZona ? (
              <>
                <p className="font-body text-[12px] mt-1.5 text-signal-red leading-snug">
                  {comuna} está fuera del Gran Santiago — por ahora Franco no tiene datos
                  suficientes acá. Prueba con otra comuna de la Región Metropolitana.
                </p>
                <WaitlistZonaInline comuna={comuna!} region={regionRef.current} />
              </>
            ) : direccion && !confirmada ? (
              <div className="mt-1.5">
                <p className="font-body text-[11px] text-signal-red m-0">
                  No encuentro esa dirección en {comuna}.
                </p>
                {/* ── LA CONDICIÓN PARA PODER FILTRAR DURO ──
                    Ahora las sugerencias están acotadas a la comuna, así que la
                    causa más probable de "no aparece nada" ya no es un error de
                    tipeo: es que la dirección está en OTRA comuna. El mensaje lo
                    dice y ofrece las dos salidas reales, en ese orden.

                    Sin esto, filtrar duro reintroduce exactamente el callejón
                    que se cerró el 20-ago: exigirle al usuario elegir de una
                    lista que no ve. Un ~1% de las direcciones legítimas cae
                    fuera de la caja de su comuna (medido) — para ese 1%, esta
                    es la puerta. */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      trackWizard(posthog, "wizard4_entrada_cambiar_desde_error", { comuna });
                      cambiarComuna();
                    }}
                    className="font-body text-[12px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] underline underline-offset-4 decoration-[var(--franco-border-strong)] transition-colors"
                  >
                    ¿Está en otra comuna?
                  </button>
                  <button
                    type="button"
                    onClick={usarDireccionEscrita}
                    disabled={fallback === "buscando"}
                    className="font-body text-[12px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] underline underline-offset-4 decoration-[var(--franco-border-strong)] transition-colors disabled:opacity-50"
                  >
                    {fallback === "buscando" ? "Buscando…" : "Usar la dirección que escribí"}
                  </button>
                </div>
                {fallback === "fallo" && (
                  <p className="font-body text-[11px] text-[var(--franco-text-muted)] mt-1 mb-0 leading-snug">
                    No pude ubicar esa dirección. Revisa que tenga calle y número.
                  </p>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  trackWizard(posthog, "wizard4_entrada_sin_depto", { comuna });
                  setSinDepto(true);
                }}
                className="font-body text-[12px] text-[var(--franco-text-muted)] hover:text-[var(--franco-text-secondary)] underline underline-offset-4 decoration-[var(--franco-border)] mt-2 transition-colors"
              >
                Todavía no tengo uno elegido
              </button>
            )}
          </div>

          {lat && lng && !fueraDeZona && (
            <div>
              <FieldLabel>Ubicación en el mapa</FieldLabel>
              <MapaThumbnail
                lat={lat}
                lng={lng}
                comparables={data.comparables}
                comparablesCount={data.comparablesCount}
                locationLabel={[comuna, ciudad].filter(Boolean).join(" · ")}
                countLabel="propiedades en el sector"
              />
            </div>
          )}

          <PrimaryBtn onClick={() => answer("dir")} disabled={!puedeSeguir}>
            Continuar →
          </PrimaryBtn>
        </div>
      )}
    </div>
  );
}

// ── Chip de comuna ───────────────────────────────────────────────────────────
// Tile seleccionable en versión compacta: hover-lift solo cuando NO está
// elegido (Capa 5.2 — el elegido ya está "pulsado" y no flota).

function ChipComuna({
  children,
  onClick,
  punteado,
}: {
  children: React.ReactNode;
  onClick: () => void;
  punteado?: boolean;
}) {
  const base =
    "font-body text-[14px] px-4 py-2.5 rounded-xl transition-colors min-h-[44px] flex items-center";
  const cls = punteado
    ? "franco-tile-target border border-dashed border-[var(--franco-border-strong)] text-[var(--franco-text-secondary)] bg-[var(--franco-card)]"
    : "franco-tile-target border-[0.5px] border-[var(--franco-border)] text-[var(--franco-text)] bg-[var(--franco-card)]";
  return (
    <button type="button" onClick={onClick} className={`${base} ${cls}`}>
      {children}
    </button>
  );
}

// ── Buscador de "Otra comuna…" ───────────────────────────────────────────────

function BuscadorComuna({
  query,
  setQuery,
  onElegir,
}: {
  query: string;
  setQuery: (v: string) => void;
  onElegir: (comuna: string) => void;
}) {
  const q = plano(query);
  const resultados = q ? COMUNAS_RM.filter((c) => plano(c.comuna).includes(q)).slice(0, 6) : [];

  return (
    <div className="mt-3">
      <input
        type="text"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Escribe tu comuna"
        aria-label="Buscar comuna"
        className="w-full h-11 rounded-lg border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] px-3 text-[15px] font-body text-[var(--franco-text)] focus:border-signal-red focus:outline-none focus:ring-1 focus:ring-signal-red/20 transition-colors"
      />
      {resultados.length > 0 && (
        <div className="mt-2 flex flex-col">
          {resultados.map((c) => (
            <button
              key={c.comuna}
              type="button"
              onClick={() => onElegir(c.comuna)}
              className="text-left font-body text-[14px] text-[var(--franco-text)] px-3 py-2.5 rounded-lg hover:bg-[var(--franco-border)] transition-colors min-h-[44px]"
            >
              {c.comuna}
              {/* Se dice ANTES de elegir, no después: prometer y después
                  rechazar es peor que avisar. La captura de correo vive en el
                  estado 2, donde el rechazo ya tiene su componente. */}
              {!isComunaDisponible(c.comuna) && (
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--franco-text-muted)] ml-2">
                  sin cobertura
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {q.length >= 3 && resultados.length === 0 && (
        <p className="font-body text-[12px] text-[var(--franco-text-muted)] mt-2 mb-0">
          No encuentro esa comuna en la Región Metropolitana.
        </p>
      )}
    </div>
  );
}

// ── Estado 3 · sin depto elegido ─────────────────────────────────────────────
// Referencia de mercado, NO un análisis. La diferencia importa y el copy la
// dice: Franco no puede opinar sobre un depto que no existe todavía.
//
// SIN CAPTURA DE CORREO. Si no hay nada concreto que prometer, no se pide nada.

function SinDeptoScreen({
  comuna,
  onVolver,
  onEjemplo,
}: {
  comuna: string;
  onVolver: () => void;
  onEjemplo: () => void;
}) {
  const [stats, setStats] = useState<ComunaStats | null>(null);
  const [estado, setEstado] = useState<"cargando" | "listo" | "sin-dato">("cargando");

  useEffect(() => {
    let vivo = true;
    fetch(`/api/comunas/${slugify(comuna)}/stats`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("sin datos"))))
      .then((j: ComunaStats) => {
        if (!vivo) return;
        setStats(j);
        setEstado("listo");
      })
      .catch(() => { if (vivo) setEstado("sin-dato"); });
    return () => { vivo = false; };
  }, [comuna]);

  return (
    <div className="flex flex-col">
      <h1 className="wizard4-entrada-title font-heading text-[28px] md:text-[36px] font-bold text-[var(--franco-text)] m-0 leading-[1.12] tracking-[-0.01em]">
        Así se está invirtiendo hoy en{" "}
        <span className="text-signal-red">{comuna}</span>
      </h1>
      <p className="font-body text-[15px] text-[var(--franco-text-secondary)] mt-3 mb-0 leading-relaxed">
        Para que partas con una referencia. Cuando tengas uno concreto, te digo si ese en
        particular conviene.
      </p>

      <div className="mt-6 rounded-2xl border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] shadow-sm p-5">
        {estado === "cargando" && (
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--franco-text-muted)] m-0">
            Buscando los números de {comuna}…
          </p>
        )}
        {estado === "sin-dato" && (
          <p className="font-body text-[13px] text-[var(--franco-text-secondary)] m-0">
            Todavía no tengo avisos suficientes en {comuna} ni para estimar una referencia
            honesta. Prefiero no inventarte un número.
          </p>
        )}
        {estado === "listo" && stats && (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              <Dato label="Precio por m²" valor={fmtCLP(stats.precioM2CLP)} />
              <Dato
                label={stats.arriendoFuente === "estimada" ? "Arriendo estimado" : "Arriendo mediano"}
                valor={`${fmtCLP(stats.arriendoCLP)}/mes`}
                sub={
                  stats.arriendoFuente === "estimada"
                    ? "desde el m² comunal, no mediana propia"
                    : stats.arriendoFuente === "mixta"
                      ? "incluye tipologías estimadas desde el m² comunal"
                      : undefined
                }
              />
              <Dato label="Rentabilidad bruta" valor={fmtPct(stats.rentabilidadBruta)} />
              <Dato
                label="Plusvalía anual"
                valor={stats.plusvaliaAnualizada != null ? fmtPct(stats.plusvaliaAnualizada) : "sin dato"}
                sub={stats.plusvaliaAnualizada != null ? `observado ${stats.plusvaliaRango ?? PLUSVALIA_DEFAULT_RANGO}` : undefined}
              />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--franco-text-muted)] mt-5 mb-0">
              {stats.totalPropiedades.toLocaleString("es-CL")} propiedades reales
            </p>
          </>
        )}
      </div>

      <a
        href="/demo"
        onClick={onEjemplo}
        className="mt-5 inline-flex items-center justify-center gap-2 font-mono uppercase font-medium text-[12px] tracking-[0.06em] text-white bg-signal-red px-5 py-3 rounded-lg hover:opacity-90 transition-opacity min-h-[44px] w-full"
      >
        Ver un análisis completo
      </a>
      <button
        type="button"
        onClick={onVolver}
        className="mt-3 font-body text-[13px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] underline underline-offset-4 decoration-[var(--franco-border-strong)] transition-colors w-fit mx-auto"
      >
        Ya tengo uno, volvamos
      </button>
    </div>
  );
}

function Dato({ label, valor, sub }: { label: string; valor: string; sub?: string }) {
  return (
    <div>
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--franco-text-tertiary)] block mb-1">
        {label}
      </span>
      <span className="font-mono text-[17px] font-medium text-[var(--franco-text)] block leading-tight">
        {valor}
      </span>
      {sub && (
        <span className="font-body text-[11px] text-[var(--franco-text-muted)] block mt-0.5">
          {sub}
        </span>
      )}
    </div>
  );
}
