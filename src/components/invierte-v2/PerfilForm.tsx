"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EL PERFIL DE INVERSIÓN EN DOS PASOS (Invierte con Franco, etapa 2, 18-nov-2026; láminas 3.1-perfil-paso1, -paso2-sin- y
// -con-preaprobacion, 3.1-perfil-pc). Paso 1 confirma lo que Franco ya sabe (las comunas vienen marcadas); paso 2 parte por si
// tiene un crédito preaprobado. Nada se guarda hasta «Ver mis opciones»: ahí la ruta valida todo, calcula hasta cuánto y lo
// escribe. Después, la espera mientras se calculan las opciones (/invierte/opciones).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { botonOcupado } from "@/lib/carga-global";
import {
  DONDES, OBJETIVOS, PERFIL_COPY, PIES_TIENE, PREAPROBADOS, PREOCUPACIONES, REGLA_TOPE, validarPerfil,
  type Donde, type Objetivo, type PieTiene, type Preaprobado, type Preocupacion,
} from "@/lib/invierte-v2/perfil";
import { fmtUF } from "@/lib/invierte-v2/opciones";
import { IndicadorPasosPerfil } from "./IndicadorPasos";
import { URL_PERFIL_ACTUALIZADO } from "@/lib/invierte-v2/base";
import { SubirPreaprobacion } from "./Preaprobacion";

const P1 = PERFIL_COPY.p1;
const P2 = PERFIL_COPY.p2;
export const URL_OPCIONES = "/invierte/opciones";

export interface InicialPerfil {
  comunas: string[];
  /** «¿Dónde buscamos?» guardado (por defecto «cerca»). */
  donde: Donde;
  deEntrada: string | null;
  dePerfil: string[];
  pieSugeridoUF: number | null;
  objetivo: Objetivo | null;
  preocupaciones: Preocupacion[];
  preaprobado: Preaprobado | null;
  montoPreaprobadoUF: number | null;
  pieTiene: PieTiene | null;
  rentaCLP: number | null;
  otrasCuotasCLP: number | null;
  noDiceRenta: boolean;
  /** La primera vez (recién firmó, sin perfil guardado): el saludo de la lámina 3.1 del 19-nov-2026. `undefined` = está editando. */
  primeraVez?: { nombre: string | null };
  /** Si todavía no hay una preaprobación vigente subida (entrega 3): con «Tengo», el bloque para subirla aquí. */
  puedeSubirPreaprobacion?: boolean;
}

const soloDigitos = (s: string) => s.replace(/[^\d]/g, "");
const conPuntos = (s: string) => (soloDigitos(s) ? Number(soloDigitos(s)).toLocaleString("es-CL") : "");
const aNum = (s: string) => (soloDigitos(s) ? Number(soloDigitos(s)) : null);

function Chips<T extends string>({ opciones, etiquetas, activo, alTocar, nombre }: { opciones: readonly T[]; etiquetas: Record<T, string>; activo: (o: T) => boolean; alTocar: (o: T) => void; nombre: string }) {
  return (
    <div className="iv2-chips" role="group" aria-label={nombre}>
      {opciones.map((o) => (
        <button key={o} type="button" className="iv2-chip-op" aria-pressed={activo(o)} onClick={() => alTocar(o)} data-inv2={`${nombre}-${o}`}>{etiquetas[o]}</button>
      ))}
    </div>
  );
}

export function PerfilForm({ inicial }: { inicial: InicialPerfil }) {
  const router = useRouter();
  const [paso, setPaso] = useState<1 | 2>(1);
  const [donde, setDonde] = useState<Donde>(inicial.donde);
  const [objetivo, setObjetivo] = useState<Objetivo | null>(inicial.objetivo);
  const [preocupaciones, setPreocupaciones] = useState<Set<Preocupacion>>(new Set(inicial.preocupaciones));
  const [preaprobado, setPreaprobado] = useState<Preaprobado | null>(inicial.preaprobado);
  const [monto, setMonto] = useState(inicial.montoPreaprobadoUF ? conPuntos(String(Math.round(inicial.montoPreaprobadoUF))) : "");
  const [pieTiene, setPieTiene] = useState<PieTiene | null>(inicial.pieTiene);
  const [pie, setPie] = useState(inicial.pieSugeridoUF != null ? conPuntos(String(Math.round(inicial.pieSugeridoUF))) : "");
  const [renta, setRenta] = useState(inicial.rentaCLP ? conPuntos(String(inicial.rentaCLP)) : "");
  const [cuotas, setCuotas] = useState(inicial.otrasCuotasCLP ? conPuntos(String(inicial.otrasCuotasCLP)) : "");
  const [noDice, setNoDice] = useState(inicial.noDiceRenta);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const toggle = <T,>(s: Set<T>, v: T) => { const n = new Set(s); if (n.has(v)) n.delete(v); else n.add(v); return n; };
  // Las comunas ya no se preguntan (láminas del 19-nov-2026): van derivadas —la del depto con que entró, o las que ya tenía— para
  // el perfil de la selección semanal. Dónde se busca lo dice «¿Dónde buscamos?».
  const comunas = inicial.deEntrada ? [inicial.deEntrada] : inicial.comunas;

  const montoNum = aNum(monto);
  const conCredito = preaprobado === "tengo" && montoNum ? { tope: montoNum / (1 - REGLA_TOPE.piePct / 100), pie: montoNum / (1 - REGLA_TOPE.piePct / 100) * REGLA_TOPE.piePct / 100 } : null;

  function continuar(e: FormEvent) {
    e.preventDefault();
    if (!comunas.length) return setError(PERFIL_COPY.errores.comunas);
    if (!objetivo) return setError(PERFIL_COPY.errores.objetivo);
    setError(null);
    setPaso(2);
    window.scrollTo({ top: 0 });
  }

  async function verOpciones(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    const cuerpo = {
      comunas, donde, objetivo, preocupaciones: Array.from(preocupaciones), preaprobado,
      montoPreaprobadoUF: montoNum, pieTiene, pieUF: aNum(pie), rentaCLP: noDice ? null : aNum(renta), otrasCuotasCLP: noDice ? null : aNum(cuotas) ?? 0, noDiceRenta: noDice,
    };
    const v = validarPerfil(cuerpo);
    if (!v.ok) { setError(PERFIL_COPY.errores[v.error]); return; }
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/invierte-v2/perfil", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v.pedido) });
      if (!res.ok) { setError(PERFIL_COPY.errores.red); setEnviando(false); return; }
      // Quien ya había elegido deptos y cambia su perfil ve «Perfil actualizado» (lámina 3.3-perfil-editado); la primera vez, el resultado.
      const d = (await res.json().catch(() => null)) as { editado?: boolean } | null;
      router.push(d?.editado ? URL_PERFIL_ACTUALIZADO : URL_OPCIONES);
    } catch {
      setError(PERFIL_COPY.errores.red);
      setEnviando(false);
    }
  }

  if (paso === 1) {
    return (
      <form onSubmit={continuar} noValidate className="iv2-perfil" data-inv2="perfil-paso1">
        <IndicadorPasosPerfil paso={1} />
        <div className="inv-encabezado">
          <h1 className="inv-titulo" id="iv2-t">{inicial.primeraVez ? P1.tituloPrimera(inicial.primeraVez.nombre) : P1.titulo}</h1>
          <p className="iv2-linea-chica">{inicial.primeraVez ? P1.lineaPrimera : P1.linea}</p>
        </div>
        <div className="inv-pregunta">
          <span className="inv-legend">{P1.donde}</span>
          <Chips opciones={DONDES} etiquetas={P1.dondes} activo={(o) => donde === o} alTocar={(o) => { setDonde(o); setError(null); }} nombre="donde" />
          <p className="iv2-linea-chica" data-inv2="donde-linea">{P1.dondeLinea(donde, inicial.deEntrada)}</p>
        </div>
        <div className="inv-pregunta">
          <span className="inv-legend">{P1.objetivo}</span>
          <Chips opciones={OBJETIVOS} etiquetas={P1.objetivos} activo={(o) => objetivo === o} alTocar={(o) => { setObjetivo(o); setError(null); }} nombre="objetivo" />
        </div>
        <div className="inv-pregunta">
          <span className="inv-legend">{P1.preocupa}</span>
          <Chips opciones={PREOCUPACIONES} etiquetas={P1.preocupaciones} activo={(o) => preocupaciones.has(o)} alTocar={(o) => setPreocupaciones(toggle(preocupaciones, o))} nombre="preocupa" />
        </div>
        <div className="iv2-acciones">
          {error && <p className="inv-error" role="alert">{error}</p>}
          <button type="submit" className="inv-principal" data-inv2="continuar">{P1.continuar}</button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={verOpciones} noValidate className="iv2-perfil" data-inv2="perfil-paso2">
      <IndicadorPasosPerfil paso={2} />
      <div className="inv-encabezado">
        <h1 className="inv-titulo" id="iv2-t">{P2.titulo}</h1>
      </div>
      <div className="inv-pregunta">
        <span className="inv-legend">{P2.preaprobado}</span>
        <Chips opciones={PREAPROBADOS} etiquetas={P2.preaprobados} activo={(o) => preaprobado === o} alTocar={(o) => { setPreaprobado(o); setError(null); }} nombre="preaprobado" />
      </div>
      {preaprobado === "tengo" ? (
        <>
          <div className="inv-pregunta">
            <label htmlFor="iv2-monto" className="inv-legend">{P2.monto} <span className="inv-aclara">{P2.montoAclara}</span></label>
            <div className="iv2-campo-uf"><span aria-hidden="true">UF</span><input id="iv2-monto" className="inv-campo" inputMode="numeric" value={monto} onChange={(e) => setMonto(conPuntos(e.target.value))} data-inv2="monto" /></div>
            {conCredito && <p className="iv2-linea-chica" data-inv2="con-credito">{P2.conCredito(fmtUF(conCredito.tope), fmtUF(conCredito.pie))}</p>}
          </div>
          <div className="inv-pregunta">
            <span className="inv-legend">{P2.tienePie}</span>
            <Chips opciones={PIES_TIENE} etiquetas={P2.piesTiene} activo={(o) => pieTiene === o} alTocar={(o) => { setPieTiene(o); setError(null); }} nombre="pie-tiene" />
          </div>
          {pieTiene === "parte" && (
            <div className="inv-pregunta">
              <label htmlFor="iv2-pie" className="inv-legend">{P2.pieParte}</label>
              <div className="iv2-campo-uf"><span aria-hidden="true">UF</span><input id="iv2-pie" className="inv-campo" inputMode="numeric" value={pie} onChange={(e) => setPie(conPuntos(e.target.value))} data-inv2="pie" /></div>
            </div>
          )}
          {/* Lámina 3.1-perfil-paso2-con-preaprobacion: se puede subir aquí («ahora o después»); si la sube, se salta la 3.4. */}
          {inicial.puedeSubirPreaprobacion && <SubirPreaprobacion variante="perfil" />}
          <p className="iv2-info iv2-porque-azul"><b>Por qué te la pedimos.</b> Los vendedores la exigen para recibir una oferta o agendar una visita. Con ella llegas con respaldo.</p>
        </>
      ) : preaprobado ? (
        <>
          <div className="inv-pregunta">
            <label htmlFor="iv2-pie" className="inv-legend">{P2.pie}</label>
            <div className="iv2-campo-uf"><span aria-hidden="true">UF</span><input id="iv2-pie" className="inv-campo" inputMode="numeric" value={pie} onChange={(e) => setPie(conPuntos(e.target.value))} data-inv2="pie" /></div>
          </div>
          {!noDice && (
            <>
              <div className="inv-pregunta">
                <label htmlFor="iv2-renta" className="inv-legend">{P2.renta}</label>
                <div className="iv2-campo-uf"><span aria-hidden="true">$</span><input id="iv2-renta" className="inv-campo" inputMode="numeric" value={renta} onChange={(e) => setRenta(conPuntos(e.target.value))} data-inv2="renta" /></div>
                <p className="iv2-linea-chica">{P2.rentaAclara}</p>
              </div>
              <div className="inv-pregunta">
                <label htmlFor="iv2-cuotas" className="inv-legend">{P2.cuotas} <span className="inv-aclara">{P2.cuotasAclara}</span></label>
                <div className="iv2-campo-uf"><span aria-hidden="true">$</span><input id="iv2-cuotas" className="inv-campo" inputMode="numeric" value={cuotas} onChange={(e) => setCuotas(conPuntos(e.target.value))} data-inv2="cuotas" /></div>
              </div>
            </>
          )}
          <label className="iv2-casilla">
            <input type="checkbox" checked={noDice} onChange={(e) => { setNoDice(e.target.checked); setError(null); }} data-inv2="no-dice" />
            <span>{P2.noDecir}</span>
          </label>
          {noDice && <p className="iv2-linea-chica" data-inv2="no-dice-nota">{P2.noDecirNota}</p>}
        </>
      ) : null}
      <div className="iv2-acciones">
        {error && <p className="inv-error" role="alert">{error}</p>}
        <div className="iv2-acciones-fila">
          <button type="button" className="iv2-enlace iv2-volver-perfil" onClick={() => { setPaso(1); setError(null); }} data-inv2="volver-paso1">{P2.volver}</button>
          <button type="submit" className="inv-principal" disabled={enviando} {...botonOcupado(enviando)} data-inv2="ver-opciones">{enviando ? P2.enviando : P2.verOpciones}</button>
        </div>
      </div>
    </form>
  );
}
