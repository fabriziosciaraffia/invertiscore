"use client";

// Capa de datos del wizard v4: UF del día, tasa hipotecaria de mercado y
// comparables de la zona (para el conteo real de la reacción de `dir` y el mapa).
// Reusa los endpoints existentes de v3. NO consume crédito ni persiste nada.

import { useEffect, useRef, useState } from "react";
import type { Comparable } from "@/components/formulario-v3/MapaThumbnail";
import { useAirRoiSuggestion, type AirRoiSuggestion } from "@/hooks/useAirRoiSuggestion";
import type { WizardV4Answers } from "./wizardV4Nodes";
import { dormitoriosNum, huespedesNum, type FuenteArriendo } from "./derive";
import type { MuestraArriendo } from "@/lib/arriendo-referencia";
import { arriendoSugeridoObraNueva } from "@/lib/obra-nueva";
import { pedirJsonConTiempo } from "./pedirSugerencias";

const UF_FALLBACK = 38800;
const TASA_FALLBACK = 4.72;

export interface WizardV4Data {
  ufCLP: number;
  tasaMercado: number;
  /** Los comparables detrás de `arriendoSugerido` (las filas de la muestra), con coordenadas. El
   *  mapa los dibuja y la leyenda cuenta `comparables.length`: un solo conjunto, el mismo que va al
   *  motor como `zonaRadio.sampleSizeArriendo` / `muestraArriendo`. Vacío si la referencia no es de radio. */
  comparables: Comparable[];
  /** El resto de los arriendos del radio, sin filtro de tipología ni superficie: contexto en gris tenue. */
  restoRadio: Comparable[];
  suggestionsLoading: boolean;
  /** El pedido de comparables falló o pasó de 10 s (09-oct-2026): el chip lo dice con «Reintentar». */
  suggestionsError: boolean;
  /** Vuelve a pedir los comparables. */
  reintentarSugerencias: () => void;
  /** Arriendo mediana estimado (CLP/mes) de la zona, o null si no hay comparables. */
  arriendoSugerido: number | null;
  /** N de arriendos comparables usados en la mediana. */
  arriendoN: number;
  /**
   * De dónde salió `arriendoSugerido`, tal como lo declara el endpoint. El copy
   * de procedencia se arma con esto, NO con arriendoN: un n grande no garantiza
   * que la muestra sea de la zona. Ver `Sugerencias.source`.
   */
  arriendoFuente: FuenteArriendo;
  /** Solo con arriendoFuente comuna-m2: rango del estimado (∓ error residual). */
  arriendoRango: { min: number; max: number } | null;
  /** Solo radio: los avisos detrás de la mediana, para guardarlos con el análisis. */
  muestraArriendo: MuestraArriendo | null;
  /** GGCC típico estimado (CLP/mes) de la zona, o null. */
  ggccSugerido: number | null;
  /** UF/m² de venta de la zona (para valorMercadoFranco y aviso de subsidio). */
  precioM2UF: number | null;
  /** Radio (m) usado por el RPC de sugerencias. */
  radiusUsed: number | null;
  /** Procedencia de la sugerencia de VENTA (Tramo A): n, nivel, universo y radio, tal
   *  como los declara el endpoint. Sin esto el valor de mercado no tiene fuente. */
  ventaN: number;
  ventaFuente: "radio" | "comuna" | "sin-dato";
  ventaUniverso: "nuevo" | "usado" | "mixto" | null;
  ventaRadio: number | null;
  /** Baseline AirROI (tarifa/ocupación) — solo activo en str/both. */
  airRoi: AirRoiSuggestion;
}

export function useWizardV4Data(answers: WizardV4Answers): WizardV4Data {
  const [ufCLP, setUfCLP] = useState(UF_FALLBACK);
  const [tasaMercado, setTasaMercado] = useState(TASA_FALLBACK);
  const [comparables, setComparables] = useState<Comparable[]>([]);
  const [restoRadio, setRestoRadio] = useState<Comparable[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(false);
  const [intento, setIntento] = useState(0);
  const [arriendoSugerido, setArriendoSugerido] = useState<number | null>(null);
  const [arriendoN, setArriendoN] = useState(0);
  const [arriendoFuente, setArriendoFuente] = useState<WizardV4Data["arriendoFuente"]>("sin-dato");
  const [arriendoRango, setArriendoRango] = useState<WizardV4Data["arriendoRango"]>(null);
  const [muestraArriendo, setMuestraArriendo] = useState<MuestraArriendo | null>(null);
  const [ggccSugerido, setGgccSugerido] = useState<number | null>(null);
  const [precioM2Clp, setPrecioM2Clp] = useState<number | null>(null); // CLP/m² crudo del RPC
  const [radiusUsed, setRadiusUsed] = useState<number | null>(null);
  const [ventaN, setVentaN] = useState(0);
  const [ventaFuente, setVentaFuente] = useState<WizardV4Data["ventaFuente"]>("sin-dato");
  const [ventaUniverso, setVentaUniverso] = useState<WizardV4Data["ventaUniverso"]>(null);
  const [ventaRadio, setVentaRadio] = useState<number | null>(null);

  // UF del día + tasa de mercado (una vez).
  useEffect(() => {
    // Fix respecto a v3: /api/uf devuelve { uf } (v3 leía d.value → no-op).
    fetch("/api/uf")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const uf = Number(d?.uf);
        if (Number.isFinite(uf) && uf > 0) setUfCLP(uf);
      })
      .catch(() => { /* fallback */ });
    fetch("/api/config?key=tasa_hipotecaria")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const t = Number(d?.value);
        if (Number.isFinite(t) && t > 0) setTasaMercado(t);
      })
      .catch(() => { /* fallback */ });
  }, []);

  // Comparables de la zona: se disparan al confirmar dirección (lat/lng + comuna).
  // Debounced para no pegarle al endpoint en cada tecla de superficie.
  const lat = answers.lat ?? null;
  const lng = answers.lng ?? null;
  const comuna = answers.comuna ?? "";
  const superficie = answers.superficieUtil ?? "";
  const dormitorios = answers.dormitorios ?? "";
  const tipoPropiedad = answers.tipoPropiedad;
  const amoblado = answers.amoblado === "si";
  const reqSeq = useRef(0);

  useEffect(() => {
    if (!lat || !lng || !comuna) {
      setSuggestionsError(false);
      setComparables([]);
      setRestoRadio([]);
      setMuestraArriendo(null);
      return;
    }
    const seq = ++reqSeq.current;
    setSuggestionsLoading(true);
    setSuggestionsError(false);
    const t = setTimeout(() => {
      const base = {
        comuna,
        superficie: String(parseFloat(superficie.replace(",", ".")) || 50),
        dormitorios: String(parseInt(dormitorios, 10) || 2),
        lat: String(lat),
        lng: String(lng),
      };
      // El arriendo compara contra lo mismo que ofrece la persona: amoblado o no (30-sep-2026).
      const qArriendo = new URLSearchParams({ ...base, type: "arriendo", ...(amoblado ? { amoblado: "1" } : {}) });
      // Tramo A: la venta se consulta en el universo del depto. Sin `condicion` el
      // radio mezclaba nuevos y usados y el nivel comunal caía a usados, y a un
      // nuevo le llegaba un valor de mercado de otro mercado (d3a6149a).
      const condicion = tipoPropiedad === "nuevo" ? "nuevo" : tipoPropiedad === "usado" ? "usado" : null;
      const qVenta = new URLSearchParams({ ...base, type: "venta", ...(condicion ? { condicion } : {}) });
      // Dos fetches (como v3): arriendo (comparables/arriendo/ggcc) + venta
      // (precioM2 → valorMercadoFranco y aviso de subsidio). El endpoint solo
      // devuelve precioM2 en la rama venta.
      // Con tiempo máximo de 10 s (09-oct-2026): un pedido colgado, un 500 o un corte de red pasan al
      // estado de error del chip, en vez de dejarlo «buscando» para siempre.
      Promise.all([
        pedirJsonConTiempo(`/api/data/suggestions?${qArriendo}`),
        pedirJsonConTiempo(`/api/data/suggestions?${qVenta}`),
      ])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then(([arr, venta]: any[]) => {
          if (seq !== reqSeq.current) return; // respuesta obsoleta
          // La lista que el mapa dibuja es la de la muestra (28-sep-2026): antes se dibujaba
          // `nearbyProperties` (todo el radio) y se contaba `sampleSize` (la muestra).
          setComparables(arr?.source === "radio" && Array.isArray(arr?.comparables) ? arr.comparables : []);
          setRestoRadio(arr?.source === "radio" && Array.isArray(arr?.restoRadio) ? arr.restoRadio : []);
          // Obra nueva (02-oct-2026): el SUGERIDO sube 3% sobre los comparables de la zona (obra-nueva.ts). El que
          // escribe la persona no se toca.
          setArriendoSugerido(typeof arr?.arriendo === "number" ? arriendoSugeridoObraNueva(arr.arriendo, tipoPropiedad) : null);
          setArriendoN(Number(arr?.sampleSize) || 0);
          // El endpoint declara su propio nivel; si no lo dice, asumimos que no hay dato
          // (nunca al revés: inventar procedencia es peor que admitir el hueco).
          setArriendoFuente(
            arr?.source === "radio" || arr?.source === "comuna" || arr?.source === "comuna-m2" ? arr.source : "sin-dato",
          );
          setArriendoRango(
            arr?.source === "comuna-m2" && arr?.rangoArriendo && arr.rangoArriendo.min > 0
              ? { min: arriendoSugeridoObraNueva(Number(arr.rangoArriendo.min), tipoPropiedad) ?? 0, max: arriendoSugeridoObraNueva(Number(arr.rangoArriendo.max), tipoPropiedad) ?? 0 }
              : null,
          );
          setGgccSugerido(typeof arr?.ggcc === "number" ? arr.ggcc : null);
          setMuestraArriendo(
            arr?.source === "radio" && arr?.muestraArriendo && Array.isArray(arr.muestraArriendo.avisos) ? (arr.muestraArriendo as MuestraArriendo) : null,
          );
          setRadiusUsed(typeof arr?.radiusUsed === "number" ? arr.radiusUsed : null);
          // precioM2 viene en CLP/m² → se convierte a UF en el return (÷ ufCLP), igual que v3.
          setPrecioM2Clp(typeof venta?.precioM2 === "number" ? venta.precioM2 : null);
          setVentaN(Number(venta?.sampleSize) || 0);
          setVentaFuente(venta?.source === "radio" || venta?.source === "comuna" ? venta.source : "sin-dato");
          setVentaUniverso(venta?.universoVenta === "nuevo" || venta?.universoVenta === "usado" || venta?.universoVenta === "mixto" ? venta.universoVenta : null);
          setVentaRadio(typeof venta?.radiusUsed === "number" ? venta.radiusUsed : null);
        })
        .catch(() => {
          if (seq !== reqSeq.current) return;
          setSuggestionsError(true);
          setComparables([]);
          setRestoRadio([]);
          setMuestraArriendo(null);
          setArriendoSugerido(null);
          setArriendoN(0);
          setArriendoFuente("sin-dato");
          setGgccSugerido(null);
          setVentaN(0);
          setVentaFuente("sin-dato");
          setVentaUniverso(null);
          setVentaRadio(null);
          setPrecioM2Clp(null);
          setRadiusUsed(null);
        })
        .finally(() => {
          if (seq === reqSeq.current) setSuggestionsLoading(false);
        });
    }, 400);
    return () => clearTimeout(t);
  }, [lat, lng, comuna, superficie, dormitorios, tipoPropiedad, amoblado, intento]);

  // Baseline AirROI — no-op salvo modalidad str/both (evita el costo del fetch
  // en LTR puro). capacidadHuespedes se aproxima desde dormitorios cuando no se
  // pide explícito (2 por dorm, mínimo 2). El studio es 0, como en el submit: con
  // `Number(dormitorios) || 2` se le pedía a AirROI un 2D con 4 huéspedes.
  const dorm = dormitoriosNum(answers);
  const airRoi = useAirRoiSuggestion({
    enabled: answers.modalidad === "str" || answers.modalidad === "both",
    direccion: answers.direccion ?? "",
    comuna: answers.comuna ?? "",
    dormitorios: dorm,
    banos: Number(answers.banos) || 1,
    // Los huéspedes que se declararon en la tarifa (o la regla por dormitorios): cambiarlos
    // vuelve a pedir la estimación, y el informe la pide igual con el mismo número.
    capacidadHuespedes: huespedesNum(answers),
    ufClp: ufCLP,
  });

  return {
    ufCLP,
    tasaMercado,
    comparables,
    restoRadio,
    suggestionsLoading,
    suggestionsError,
    reintentarSugerencias: () => setIntento((n) => n + 1),
    arriendoSugerido,
    arriendoN,
    arriendoFuente,
    arriendoRango,
    muestraArriendo,
    ggccSugerido,
    // precioM2 del RPC viene en CLP/m² → UF/m² (÷ ufCLP), como v3.
    precioM2UF: precioM2Clp != null && ufCLP > 0 ? precioM2Clp / ufCLP : null,
    radiusUsed,
    ventaN,
    ventaFuente,
    ventaUniverso,
    ventaRadio,
    airRoi,
  };
}
