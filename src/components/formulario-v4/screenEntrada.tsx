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
  rentabilidadBruta: number;
  plusvaliaAnualizada: number | null;
}

const fmtCLP = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const fmtPct = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;

export function EntradaScreen({ answers, data, patchAnswers, answer }: ScreenProps) {
  const posthog = usePostHog();
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const acRef = useRef<any>(null);

  /** Estado 3, local: no es una respuesta del wizard, es un desvío de lectura. */
  const [sinDepto, setSinDepto] = useState(false);
  const [buscador, setBuscador] = useState(false);
  const [query, setQuery] = useState("");

  const { direccion, direccionConfirmada, comuna, ciudad, lat, lng } = answers;
  const confirmada = !!direccionConfirmada && direccion === direccionConfirmada;
  const fueraDeZona = !!comuna && !isComunaDisponible(comuna);
  const puedeSeguir = confirmada && !!comuna && !fueraDeZona;
  const estado: 1 | 2 | 3 = !comuna ? 1 : sinDepto ? 3 : 2;

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
  // El efecto depende de `estado` porque el input no existe en el DOM hasta que
  // hay comuna elegida: montar el Autocomplete antes no engancharía nada.
  useEffect(() => {
    if (estado !== 2) return;
    loadGoogleMaps()
      .then(() => {
        if (!inputRef.current || acRef.current) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const google = (window as any).google;
        if (!google?.maps?.places) return;
        const ac = new google.maps.places.Autocomplete(inputRef.current, {
          types: ["address"],
          componentRestrictions: { country: "cl" },
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
      })
      .catch(() => { /* ignore */ });
    // `posthog` es estable y solo se usa dentro del listener: re-suscribir por
    // él re-crearía el widget de Places.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patchAnswers, estado]);

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
    patchAnswers({ comuna: nombre, ciudad: match?.ciudad || "Santiago" });
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
          <div className="flex flex-wrap gap-2">
            <ChipComuna elegido onClick={() => patchAnswers({ comuna: undefined })}>
              {comuna}
            </ChipComuna>
            <ChipComuna punteado onClick={() => patchAnswers({ comuna: undefined })}>
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
              <p className="font-body text-[11px] mt-1.5 text-signal-red">
                Selecciona la dirección de la lista de sugerencias.
              </p>
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
  elegido,
  punteado,
}: {
  children: React.ReactNode;
  onClick: () => void;
  elegido?: boolean;
  punteado?: boolean;
}) {
  const base =
    "font-body text-[14px] px-4 py-2.5 rounded-xl transition-colors min-h-[44px] flex items-center";
  const cls = elegido
    ? "bg-[var(--franco-text)] text-[var(--franco-bg)] border-[0.5px] border-[var(--franco-text)]"
    : punteado
      ? "franco-tile-target border border-dashed border-[var(--franco-border-strong)] text-[var(--franco-text-secondary)] bg-[var(--franco-card)]"
      : "franco-tile-target border-[0.5px] border-[var(--franco-border)] text-[var(--franco-text)] bg-[var(--franco-card)]";
  return (
    <button type="button" onClick={onClick} aria-pressed={elegido} className={`${base} ${cls}`}>
      {children}
    </button>
  );
}

// ── Buscador de "Otra comuna…" ───────────────────────────────────────────────

/** Minúsculas sin acentos, para comparar lo tipeado con el nombre canónico. El
 *  rango ̀-ͯ va escapado a propósito: son combining marks invisibles
 *  y la versión literal es imposible de revisar (misma regla que
 *  `comunas-disponibles.ts`). */
const plano = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

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
            Todavía no tengo suficientes propiedades en {comuna} para dar una referencia
            honesta. Prefiero no inventarte un número.
          </p>
        )}
        {estado === "listo" && stats && (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              <Dato label="Precio por m²" valor={fmtCLP(stats.precioM2CLP)} />
              <Dato label="Arriendo mediano" valor={`${fmtCLP(stats.arriendoCLP)}/mes`} />
              <Dato label="Rentabilidad bruta" valor={fmtPct(stats.rentabilidadBruta)} />
              <Dato
                label="Plusvalía anual"
                valor={stats.plusvaliaAnualizada != null ? fmtPct(stats.plusvaliaAnualizada) : "sin dato"}
                sub={stats.plusvaliaAnualizada != null ? "observado 2014-2024" : undefined}
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
