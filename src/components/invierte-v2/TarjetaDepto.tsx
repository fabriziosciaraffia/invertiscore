"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LA TARJETA DE UN DEPTO EN LA BASE (etapa 3; rediseño del 23-nov-2026, lámina 3.3). Una por fila: la foto, la dirección (con número
// solo con la ubicación confirmada; mayúsculas bien puestas), metro, comuna y programa, el veredicto, la síntesis de «Lo que ve Franco»
// en el recuadro azul (solo en PC: en celular queda en la página del depto), precio, cap rate y lo que deja al mes, y su estado: el chip
// y, cuando le toca a la persona, qué le toca y el rango si existe (la tarjeta se levanta; VistaBase). Sale la etiqueta «El que
// elegiste / Te lo recomendamos». Las otras opciones van con lo mismo en chico (TarjetaOtra). Si la lectura llega después, la calle se
// completa sola.
// Todo en `span`: la tarjeta de «Tus deptos» va dentro de un botón (solo admite contenido en línea).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChipVeredicto } from "@/components/analysis/shared/ChipVeredicto";
import type { Veredicto } from "@/lib/types";
import { pctUno } from "@/lib/explorar/explorar";
import { ALTERNATIVAS_COPY as A } from "@/lib/invierte-v2/alternativas";
import { urlFoto } from "@/lib/invierte-v2/fotos";
import { LECTURA_COPY as L, alertaPrimero, lineaAlternativa, type LecturaFranco } from "@/lib/invierte-v2/lectura-franco";
import { fmtUF } from "@/lib/invierte-v2/opciones";
import { BASE_COPY as B, lineaDepto } from "@/lib/invierte-v2/base";
import { etiquetaVeredicto, signoVeredicto } from "@/lib/veredicto-etiqueta";
import { direccionDepto, tituloDepto } from "@/lib/invierte-v2/titulo-depto";
import type { DatosDepto } from "@/lib/invierte-v2/base-servidor";
import type { EstadoBase, PasoCamino } from "@/lib/invierte-v2/depto-flujo";
import type { FichaDepto } from "@/lib/invierte-v2/ficha-depto-servidor";
import { useLectura } from "./LoQueVeFranco";
import { LupaFotos } from "./VisorFotos";
import { CuatroCifras } from "./CuatroCifras";
import type { CifrasDepto } from "@/lib/invierte-v2/cifras";

/** La portada: la primera foto que cargue, sin flechas (la tarjeta entera es un botón). Sin fotos, nada. Con `lupa` (segunda vuelta,
 *  23-nov; solo donde la portada NO está dentro de un enlace), la lupa en la esquina abre el visor con todas las fotos del depto. En la
 *  base, que es un enlace, la lupa va al lado de la tarjeta (VistaBase). */
export function FotoPortada({ avisoId, n, clase, lupa = false, titulo = null }: { avisoId: string; n: number; clase: string; lupa?: boolean; titulo?: string | null }) {
  const [i, setI] = useState(0);
  const img = useRef<HTMLImageElement>(null);
  // Una foto que terminó de cargar antes de que la página despertara (sin `onLoad`) también se revisa: si es el pixel de una foto
  // borrada, se pasa a la siguiente.
  useEffect(() => { const x = img.current; if (x?.complete && (x.naturalWidth <= 1)) setI((k) => k + 1); }, [i]);
  if (!n || i >= n) return null;
  return (
    <span className={`iv2-portada ${clase}`} data-inv2="portada">
      {/* eslint-disable-next-line @next/next/no-img-element -- la sirve la ruta propia, con su caché; no pasa por el optimizador */}
      <img ref={img} src={urlFoto(avisoId, i)} alt={A.foto(i + 1, n)} decoding="async" onError={() => setI((x) => x + 1)} onLoad={(e) => { if (e.currentTarget.naturalWidth <= 1) setI((x) => x + 1); }} />
      {lupa && <LupaFotos avisoId={avisoId} n={n} inicio={i} titulo={titulo} clase="iv2-lupa-foto" />}
    </span>
  );
}

/** El título calle·metro: con la calle de la lectura, cuando llega. */
function tituloDe(f: FichaDepto | null, l: LecturaFranco | null, datos: DatosDepto): string {
  if (!f) return datos.comuna ?? "Depto";
  if (f.calleConfirmada) return f.titulo;
  return l?.calle ? tituloDepto({ calle: l.calle, metro: f.metro, comuna: f.comuna }) : f.titulo;
}

/** La síntesis en su recuadro: la alerta si existe (con su chip), si no la primera línea de la corta. */
function Sintesis({ l }: { l: LecturaFranco | null }) {
  const t = l ? lineaAlternativa(l) : null;
  if (!l || !t) return null;
  const alerta = alertaPrimero(l) ? (l.alerta.nivel === "grave" ? "grave" : "revisar") : null;
  return (
    <span className="iv2-lectura-caja iv2-td-sintesis" data-alerta={alerta ?? undefined} data-inv2="lectura-linea">
      <span className="iv2-lectura-cab">
        <span className="iv2-lectura-rotulo">{L.rotulo}</span>
        {alerta && <span className="iv2-lectura-chip" data-inv2="lectura-chip">{L.alertaNivel[alerta]}</span>}
      </span>
      <span className="iv2-td-sintesis-t">{t}</span>
    </span>
  );
}

/** Sin ficha (no debería pasar: la base siempre la arma), las cifras que trae el depto, sin arriendo. */
const sinFicha = (d: DatosDepto): CifrasDepto => ({ publicadoUF: d.precioUF ?? null, arriendoCLP: null, capRatePct: null, flujoCLP: d.flujoCLP ?? null, pocosComparables: false });

/** La dirección de la tarjeta: la calle (la confirmada por Franco, o la que leyó la lectura) con el número solo si está confirmada; sin
 *  calle confiable, el título calle·metro de siempre. */
function direccionDe(f: FichaDepto | null, l: LecturaFranco | null, datos: DatosDepto, numero: string | null): { t: string; conMetro: boolean } {
  const d = f ? direccionDepto({ calle: f.calleConfirmada ?? l?.calle ?? null, numero: f.calleConfirmada ? numero : null, comuna: f.comuna }) : null;
  return d ? { t: d, conMetro: false } : { t: tituloDe(f, l, datos), conMetro: true };
}

/** EL CAMINO EN CHICO (segunda vuelta del rediseño, 23-nov-2026, lámina 3.3): los seis puntos del camino de la página del depto
 *  (`caminoDepto`, la misma fuente). Hechos en azul; el actual más grande, ciruela si le toca a la persona, negro si lo lleva Franco;
 *  los que faltan en gris; la visita que no hubo, gris hueco. Al lado, «Paso n de 6 · Nombre» (en celular, «n de 6»). */
// Sin redundancia (24-nov-2026): si el título de la tarjeta ya es el nombre del paso («Oferta en firme», «Promesa»), solo «Paso n de 6».
export function CaminoChico({ camino, titulo = null }: { camino: { actual: number; pasos: PasoCamino[] }; titulo?: string | null }) {
  const actual = camino.pasos[camino.actual - 1];
  const nombre = actual?.t && titulo && actual.t.toLowerCase() === titulo.toLowerCase().replace(/^confirmando el depto$/, "confirmar el depto") ? null : actual?.t;
  return (
    <span className="iv2-cc" data-inv2="camino-chico" data-actual={camino.actual}>
      <span className="iv2-cc-puntos" aria-hidden="true">
        {camino.pasos.map((x) => <span key={x.n} className={`iv2-cc-p iv2-cc-${x.estado}`} data-estado={x.estado} />)}
      </span>
      <span className="iv2-cc-txt"><span className="iv2-cc-pc">Paso {camino.actual} de {camino.pasos.length}{nombre ? ` · ${nombre}` : ""}</span><span className="iv2-cc-movil">{camino.actual} de {camino.pasos.length}</span></span>
    </span>
  );
}

/** «Tus deptos»: la tarjeta de un depto elegido (va dentro de TarjetaDetalles, que la vuelve tocable). */
export function TarjetaBase({ avisoId, datos, ficha, numeroConfirmado = null, alcanza, estado, camino = null }: { avisoId: string; datos: DatosDepto; ficha: FichaDepto | null; numeroConfirmado?: string | null; alcanza: boolean; estado: EstadoBase; camino?: { actual: number; pasos: PasoCamino[] } | null }) {
  const l = useLectura(avisoId, ficha?.lectura ?? null);
  const dir = direccionDe(ficha, l, datos, numeroConfirmado);
  const metro = !dir.conMetro && ficha?.metro && ficha.metro.metros <= 1000 ? `Metro ${ficha.metro.estacion.replace(/^(Estación|Metro)\s+/i, "")}` : null;
  const tuyo = estado.tono === "ciruela";
  return (
    <span className="iv2-td" data-inv2="tarjeta-depto">
      <span className="iv2-td-principal">
        <span className="iv2-td-cab">
          <FotoPortada avisoId={avisoId} n={ficha?.fotos ?? 0} clase="iv2-td-foto" />
          <span className="iv2-td-id">
            <span className="iv2-td-t" data-inv2="titulo-depto">{dir.t}</span>
            <span className="iv2-depto-s">{[metro, lineaDepto(datos)].filter(Boolean).join(" · ")}{alcanza ? "" : ` · ${B.fueraDeAlcance}`}</span>
            {datos.veredicto && <span className="iv2-td-chip"><ChipVeredicto v={datos.veredicto as Veredicto} puntaje={datos.veredicto === "COMPRAR" ? datos.score ?? null : null} /></span>}
          </span>
        </span>
        <Sintesis l={l} />
        {/* Las cuatro cifras (23-nov-2026), las mismas de la ficha y en el mismo orden; en PC, en una franja. */}
        <CuatroCifras c={ficha?.cifras ?? sinFicha(datos)} variante="base" />
      </span>
      <span className="iv2-td-estado" data-inv2="estado">
        <span className="iv2-td-estado-txt">
          <span className={tuyo ? "iv2-chip-tuyo" : "iv2-chip-franco"} data-inv2="estado-depto">{tuyo && <i aria-hidden="true" />}{estado.chip}</span>
          {estado.titulo && <span className="iv2-td-estado-t" data-inv2="estado-titulo">{estado.titulo}</span>}
          <span className="iv2-td-estado-linea">{estado.linea}</span>
          {camino && <CaminoChico camino={camino} titulo={estado.titulo ?? null} />}
          <span className="iv2-td-abrir" aria-hidden="true">{B.abrirEsteDepto} ›</span>
        </span>
        <span className="iv2-td-flecha" aria-hidden="true">›</span>
      </span>
    </span>
  );
}

/** «Otras opciones que convienen»: lo mismo en chico. `acciones`: «Ver detalles» y «Seguir con este». */
export function TarjetaOtra({ avisoId, datos, ficha, acciones }: { avisoId: string; datos: DatosDepto; ficha: FichaDepto | null; acciones: ReactNode }) {
  const l = useLectura(avisoId, ficha?.lectura ?? null);
  const titulo = tituloDe(ficha, l, datos);
  const linea = l ? lineaAlternativa(l) : null;
  const resumen = [datos.precioUF ? `UF ${fmtUF(datos.precioUF)}` : null, ficha?.capRatePct != null ? `${A.capRate} ${pctUno(ficha.capRatePct)}` : null, `${signoVeredicto("COMPRAR")} ${etiquetaVeredicto("COMPRAR", "frase")}${datos.score != null ? ` · ${datos.score}` : ""}`].filter(Boolean).join(" · ");
  return (
    <div className="iv2-otra-mini" data-inv2="otra">
      <div className="iv2-otra-mini-cab">
        <FotoPortada avisoId={avisoId} n={ficha?.fotos ?? 0} clase="iv2-otra-mini-foto" lupa titulo={titulo} />
        <div className="iv2-otra-mini-id">
          <p className="iv2-otra-mini-t" data-inv2="titulo-depto">{titulo}</p>
          <p className="iv2-depto-s">{lineaDepto(datos)}</p>
          <p className="iv2-otra-mini-resumen" data-inv2="otra-resumen">{resumen}</p>
        </div>
      </div>
      {linea && <p className="iv2-otra-mini-linea" data-inv2="otra-linea">{linea}</p>}
      <div className="iv2-otra-mini-acciones">{acciones}</div>
    </div>
  );
}

/** El título calle·metro del resultado (A2, lámina 3.2-resultado): con la calle de la lectura, que puede llegar después. */
export function TituloCalle({ avisoId, metro, comuna, inicial }: { avisoId: string; metro: { estacion: string; metros: number } | null; comuna: string | null; inicial: LecturaFranco | null }) {
  const l = useLectura(avisoId, inicial);
  return <>{tituloDepto({ calle: l?.calle ?? null, metro, comuna })}</>;
}
