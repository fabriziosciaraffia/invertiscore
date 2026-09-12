"use client";

import { useRef, useState, type ReactNode } from "react";
import { usePostHog } from "posthog-js/react";
import type { ZonaStr } from "@/lib/zona-str";
import { fechaCortaCL } from "@/lib/fecha-cl";
import { Modal, VProsa, VViz, VSub, VCierre, VFuente } from "@/components/analysis/hallazgos/vocabulario";
import { FilaDato, FilasDato, Planilla, type FilaPlanilla } from "@/components/analysis/shared";

/**
 * LA ZONA · STR (T2 · 05-sep-2026, contrato mockup-str-CONGELADO sección LA ZONA).
 * Síntesis de una línea + tres celdas (tarifa típica · ocupación estimada · contra quién
 * te comparan) + la tipología declarada, y el botón Explorar que abre el modal con los 25
 * avisos en detalle, el perfil de huésped cualitativo (sin porcentajes) y los lugares
 * cerca. Todo viene de `ZonaStr` (server, con procedencia); acá no se calcula nada.
 * Telemetría: `informe_capitulo_abierto` con tipo 'str' y capítulo 'zona', una vez por
 * montaje, al abrir el modal.
 *
 * CON EL REDISEÑO (contrato §8 · bloque A, 11-sep-2026) el cuerpo son las tres tarjetas
 * de `ZonaCeldasStrR2` —ocupación primero, tarifa, comparables—, el pie común con la
 * fecha de las estimaciones y el enlace «Ver los comparables →», que abre el MISMO modal.
 * La tipo-line del reglamento no va: la regulación se retiró (§11). El camino viejo
 * queda exactamente como estaba.
 */
export function ZonaStrSection({
  zona,
  comuna,
  direccion,
  currency,
  valorUF,
  veredicto,
  accessLevel,
}: {
  zona: ZonaStr;
  comuna: string;
  direccion: string;
  currency: "CLP" | "UF";
  valorUF: number;
  veredicto: string;
  accessLevel: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const posthog = usePostHog();
  const medido = useRef(false);
  const abrir = () => {
    if (!medido.current) {
      medido.current = true;
      const props = { capitulo: "zona", id_capitulo: "zona", n: 7, tipo: "str", veredicto, access_level: accessLevel };
      try {
        posthog?.capture("informe_capitulo_abierto", props);
      } catch {
        /* la telemetría jamás rompe la lectura */
      }
      if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
        (window.__informeEvents ??= []).push({ name: "informe_capitulo_abierto", props });
      }
    }
    setAbierto(true);
  };

  const money = (n: number) => (currency === "UF" ? `UF ${(n / (valorUF || 1)).toFixed(1).replace(".", ",")}` : `$${Math.round(n).toLocaleString("es-CL")}`);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const fecha = (iso: string) => fechaCortaCL(iso);
  const t = zona.tarifaZona;
  const o = zona.ocupacion;
  const c = zona.comparables;
  const relTxt = o.relacion === "mas" ? "más que" : o.relacion === "menos" ? "menos que" : o.relacion === "similar" ? "parecido a" : null;

  // ── síntesis (una línea, determinista) ──
  const cobras = t ? (t.posicion === "igual" ? "Cobras lo que cobra la zona" : t.posicion === "arriba" ? "Cobras sobre lo que cobra la zona" : "Cobras bajo lo que cobra la zona") : "Sin tarifa de referencia para tu zona";
  const ocupa = relTxt ? ` y tu zona ocupa ${relTxt} lo típico de ${comuna}` : "";
  const sintesis = `${cobras}${ocupa}.`;

  // ── detalle para el modal ──
  const avisos = [...zona.avisos].sort((a, b) => (a.distanciaM ?? 1e9) - (b.distanciaM ?? 1e9));
  const med = (xs: number[]) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const tarifaMed = med(avisos.map((a) => a.tarifa).filter((x): x is number => x != null && x > 0));
  const resenasMed = med(avisos.map((a) => a.resenas).filter((x): x is number => x != null));
  const notaMed = med(avisos.map((a) => a.nota).filter((x): x is number => x != null && x > 0));
  const filasAvisos: FilaPlanilla[] = avisos.map((a, i) => ({
    th: String(i + 1),
    celdas: [
      { v: a.distanciaM != null ? `${a.distanciaM} m` : "—" },
      { v: a.tarifa != null ? money(a.tarifa) : "—" },
      { v: a.ocupacion != null ? pct(a.ocupacion) : "—" },
      { v: a.estadiaNoches != null ? `${a.estadiaNoches.toFixed(1).replace(".", ",")} noches` : "—" },
      { v: a.superhost ? "sí" : "—" },
    ],
  }));
  const establecidos = c && c.n > 0 && c.nSuperhost / c.n >= 0.5;
  const dorms = zona.tipologia.split(" · ")[0];

  const cierre: ReactNode = (() => {
    if (!t && !c) return <>Sin tarifa de referencia ni avisos parecidos: la zona no se puede leer con datos. Trata la ocupación y la tarifa como supuestos tuyos.</>;
    const partes: ReactNode[] = [];
    if (t) partes.push(t.posicion === "igual" ? <mark key="t">Cobras la mediana de tu zona: no hay grasa en la tarifa, la diferencia la hacen las noches.</mark> : t.posicion === "arriba" ? <mark key="t">Cobras sobre la mediana de tu zona: cada noche vendida vale más, pero la tarifa es una apuesta a diferenciarte.</mark> : <mark key="t">Cobras bajo la mediana de tu zona: hay espacio en la tarifa antes de pedirle más a la ocupación.</mark>);
    if (c) partes.push(<span key="c"> {establecidos ? `Te comparan con ${c.nSuperhost} anfitriones destacados de ${c.n}: compites con avisos establecidos, no con recién publicados.` : `De los ${c.n} avisos parecidos, ${c.nSuperhost} son de anfitriones destacados: la competencia es mezclada.`}</span>);
    if (relTxt) partes.push(<span key="o"> Tu zona ocupa {relTxt} lo típico de {comuna}{o.comuna ? ` (${pct(o.comuna.valor)})` : ""}.</span>);
    return <>{partes}</>;
  })();

  // EL PIE COMÚN DE §8: la fecha de las estimaciones, una vez, y no dentro de cada
  // tarjeta. Dice de dónde salen tarifa y ocupación —tuyas o estimadas— y cuándo.
  const pieR2 =
    `${t?.esTuya || o.esTuya ? "Tarifa y ocupación definidas por ti" : "Tarifa y ocupación estimadas para este depto"}` +
    `${c ? ` · ${c.n} avisos parecidos · ${fecha(c.fecha)}` : ""}` +
    `${o.comuna ? ` · típico de ${comuna} al ${fecha(o.comuna.fecha)}` : ""}.`;

  const cuerpo = (
    <>
      <ZonaCeldasStrR2 zona={zona} comuna={comuna} currency={currency} valorUF={valorUF} />
      <p className="zona-caveat">{pieR2}</p>
      <div className="zona-foot">
        {/* La procedencia ya está en el pie común: acá solo queda el enlace, que el
            contrato §8 nombra «Ver los comparables». Abre el mismo modal de siempre. */}
        <span />
        <button type="button" className="doc-lnk" onClick={abrir}>
          Ver los comparables →
        </button>
      </div>
    </>
  );

  return (
    <div>
      {cuerpo}

      <Modal abierto={abierto} onClose={() => setAbierto(false)} titulo={`La zona · ${comuna}`} sub={direccion || undefined}>
        <div className="doc-tokens">
          <VProsa>
            {sintesis}
            {c ? ` Los ${c.n} avisos con los que te comparan están${c.radioM != null ? ` hasta ${c.radioM} m` : " cerca"}, ${c.nSuperhost} son de anfitriones destacados${c.estadiaNoches != null ? ` y la estadía típica es de ${c.estadiaNoches.toFixed(1).replace(".", ",")} noches` : ""}: ${establecidos ? "compites con anfitriones establecidos, no con avisos recién publicados." : "la competencia es mezclada, con avisos establecidos y otros más nuevos."}` : ""}
          </VProsa>
          {c ? (
            <VViz t={`Competencia en detalle · ${c.n} avisos parecidos${dorms ? `, ${dorms.replace("D", " dormitorio")}${dorms !== "1D" ? "s" : ""}` : ""}`}>
              <VSub>Contra quién te comparan</VSub>
              <FilasDato>
                <FilaDato k="Dónde están" tip="Distancia al aviso más lejano, desde tu dirección" v={c.radioM != null ? `hasta ${c.radioM} m` : "—"} />
                <FilaDato k="Tarifa promedio cobrada · 12 meses" tip="Mediana de los avisos" v={tarifaMed != null ? money(tarifaMed) : "—"} />
                <FilaDato k="Estadía típica" tip="Mediana de la estadía promedio de los avisos" v={c.estadiaNoches != null ? `${c.estadiaNoches.toFixed(1).replace(".", ",")} noches` : "—"} />
                <FilaDato k={<>Anfitriones destacados · reseñas · nota</>} tip="superhost, reseñas (mediana) y nota (mediana)" v={`${c.nSuperhost} de ${c.n}${resenasMed != null ? ` · ${Math.round(resenasMed)}` : ""}${notaMed != null ? ` · ${notaMed.toFixed(1).replace(".", ",")}` : ""}`} />
                <FilaDato k={`Ocupación ${o.esTuya ? "definida por ti" : "estimada para tu depto"}`} tip={o.esTuya ? "El supuesto que definiste" : "Estimación de mercado para un depto como el tuyo, estabilizado"} v={`${pct(o.tuya)} · ${Math.round(o.tuya * 365)} noches`} tono="in" />
                <FilaDato k={`Típico de ${comuna}`} tip={o.comuna ? `${o.comuna.n} estimaciones al ${fecha(o.comuna.fecha)}` : "Sin datos suficientes"} v={o.comuna ? `${pct(o.comuna.valor)}${relTxt ? ` · ${o.relacion === "similar" ? "parecido" : o.relacion === "mas" ? "tú más" : "tú menos"}` : ""}` : "sin datos suficientes"} />
              </FilasDato>
              <p className="v-copy" style={{ marginTop: 10 }}>
                La ocupación {o.esTuya ? "de tu depto es el supuesto que definiste" : "es la que los datos de mercado estiman para un depto como el tuyo, estabilizado"}; lo típico de la comuna es la mediana de esas mismas estimaciones para otras direcciones de {comuna}. Lo que cada aviso ocupó de verdad el último año se muestra, pero no entra en el cálculo.
              </p>
              <Planilla columnas={["#", "Distancia", "Tarifa 12 m", "Ocupación 12 m", "Estadía", "Destacado"]} filas={filasAvisos} />
            </VViz>
          ) : (
            <VViz t="Competencia en detalle">
              <p className="v-copy">Sin datos suficientes: este análisis no guardó los avisos con los que se comparó.</p>
            </VViz>
          )}
          {zona.perfiles.length > 0 && (
            <VViz t="Quién se va a alojar acá">
              <VSub>Perfil de huésped</VSub>
              {zona.perfiles.map((p, i) => (
                <div key={p.perfil} className={`perfil-row${i === 0 ? " dom" : ""}`}>
                  <p className="pn">{p.label}</p>
                  <p className="pd">{p.descripcion}</p>
                </div>
              ))}
            </VViz>
          )}
          {zona.lugares.length > 0 && (
            <VViz t="Lugares cerca">
              {zona.lugares.map((l, i) => (
                <div key={i} className="poi">
                  <span className="n">{l.nombre}</span>
                  <span className="d">{l.distanciaM} m</span>
                  <span className="t">{l.tipo}</span>
                </div>
              ))}
            </VViz>
          )}
          <VCierre titulo="Qué significa">{cierre}</VCierre>
          <VFuente>
            Datos de mercado{c ? ` · ${c.n} avisos parecidos y estimación para este depto · ${fecha(c.fecha)}` : ""} · perfil de huésped y lugares: dataset Franco, sin porcentajes
          </VFuente>
        </div>
      </Modal>
    </div>
  );
}

type TonoPildora = "bien" | "mal" | "neu";

/** La píldora del par direccional (contrato §8). Mismas clases que la de LTR: `bien` en
 *  --up, `mal` en --signal, `neu` en gris, todas con fondo al 12%. */
function Pildora({ tono, children }: { tono: TonoPildora; children: ReactNode }) {
  return <span className={`zp zp-${tono}`}>{children}</span>;
}

/** «hasta 800 m» · «hasta 3,1 km». */
function fmtRadio(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

/**
 * Las tres tarjetas del contrato §8 para STR: OCUPACIÓN primero —tu porcentaje contra lo
 * típico de la comuna; es el único dato tuyo que puede quedar peor que la referencia y
 * el número del que cuelga todo—, después la TARIFA POR NOCHE contra la mediana (sin
 * ajuste propio la píldora es neutra: cobras la mediana), y la tercera son LOS
 * COMPARABLES —cuántos avisos, cuántos superhost, hasta qué radio—, no valorización.
 * Mismo estilo que las tarjetas de cifra y, como ellas, no reaccionan: no abren nada.
 *
 * LA DIRECCIÓN LA DECIDE EL SENTIDO, no el signo: ocupar MÁS que la comuna mejora tu
 * caso («bien»); cobrar MÁS que la mediana es una apuesta a diferenciarte, o sea empeora
 * lo que se puede sostener («mal»). Igual que el arriendo en LTR.
 */
export function ZonaCeldasStrR2({
  zona,
  comuna,
  currency,
  valorUF,
}: {
  zona: ZonaStr;
  comuna: string;
  currency: "CLP" | "UF";
  valorUF: number;
}) {
  const money = (n: number) => (currency === "UF" ? `UF ${(n / (valorUF || 1)).toFixed(1).replace(".", ",")}` : `$${Math.round(n).toLocaleString("es-CL")}`);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const fecha = (iso: string) => fechaCortaCL(iso);
  const t = zona.tarifaZona;
  const o = zona.ocupacion;
  const c = zona.comparables;

  // ocupación: puntos contra la comuna, ya redondeados los dos lados. LA PÍLDORA COMPARA
  // LO QUE LA TARJETA MUESTRA —tu porcentaje contra el típico— y no `o.relacion`, que mide
  // la estimación de la ZONA contra la comuna: con un supuesto tuyo (80% contra 46%) decía
  // «parecido» al lado de dos números que no se parecen en nada. Misma tolerancia que la
  // relación del motor: hasta 3 puntos es parecido.
  const ptsOcc = o.comuna ? Math.round(o.tuya * 100) - Math.round(o.comuna.valor * 100) : null;
  const pildoraOcc =
    ptsOcc == null ? null
    : Math.abs(ptsOcc) <= 3 ? <Pildora tono="neu">parecido</Pildora>
    : ptsOcc > 0 ? <Pildora tono="bien">{ptsOcc} pts sobre</Pildora>
    : <Pildora tono="mal">{Math.abs(ptsOcc)} pts bajo</Pildora>;
  const glosaOcc = o.comuna
    ? `${o.esTuya ? "El supuesto que definiste tú · " : ""}${o.comuna.n} ${o.comuna.n === 1 ? "estimación" : "estimaciones"} al ${fecha(o.comuna.fecha)}.`
    : o.esTuya
      ? "El supuesto que definiste tú; sin datos suficientes de la comuna para contrastarlo."
      : "Sin datos suficientes de la comuna para contrastarla.";

  // tarifa: % contra la mediana, solo si hay ajuste propio; si no, neutra
  const pctTarifa = t && t.mediana > 0 ? Math.round((Math.abs(t.tuya - t.mediana) / t.mediana) * 100) : 0;
  const pildoraTarifa = !t
    ? null
    : !t.esTuya || t.posicion === "igual" || pctTarifa === 0
      ? <Pildora tono="neu">cobras la mediana</Pildora>
      : t.posicion === "arriba"
        ? <Pildora tono="mal">{pctTarifa}% sobre</Pildora>
        : <Pildora tono="bien">{pctTarifa}% bajo</Pildora>;
  const glosaTarifa = !t ? "Sin tarifa de referencia para tu zona." : t.esTuya ? "Tarifa definida por ti." : "Sin ajuste propio.";

  return (
    <div className="zona-cards">
      {/* 1 · TU OCUPACIÓN — primero, por el contrato */}
      <div className="zc">
        <p className="zc-k">Tu ocupación</p>
        <p className="zc-v">{pct(o.tuya)}</p>
        <p className="zc-r">{o.comuna ? `típico de ${comuna} ${pct(o.comuna.valor)}` : <>&nbsp;</>}</p>
        {pildoraOcc}
        <p className="zc-s">{glosaOcc}</p>
      </div>

      {/* 2 · TU TARIFA POR NOCHE */}
      <div className="zc">
        <p className="zc-k">Tu tarifa por noche</p>
        <p className="zc-v">{t ? money(t.tuya) : "—"}</p>
        <p className="zc-r">{t ? `mediana ${money(t.mediana)}` : <>&nbsp;</>}</p>
        {pildoraTarifa}
        <p className="zc-s">{glosaTarifa}</p>
      </div>

      {/* 3 · CONTRA QUIÉN TE COMPARAN — los comparables, no valorización */}
      <div className="zc">
        <p className="zc-k">Contra quién te comparan</p>
        <p className="zc-v">{c ? `${c.n} avisos` : "—"}</p>
        <p className="zc-r">{c ? `${c.nSuperhost} ${c.nSuperhost === 1 ? "es" : "son"} superhost` : <>&nbsp;</>}</p>
        {c && c.radioM != null ? <Pildora tono="neu">hasta {fmtRadio(c.radioM)}</Pildora> : null}
        <p className="zc-s">
          {c
            ? c.estadiaNoches != null
              ? `Estadía típica ${c.estadiaNoches.toFixed(1).replace(".", ",")} noches.`
              : "Avisos parecidos por tipología y radio."
            : "Sin datos suficientes: este análisis no guardó los avisos con los que se comparó."}
        </p>
      </div>
    </div>
  );
}
