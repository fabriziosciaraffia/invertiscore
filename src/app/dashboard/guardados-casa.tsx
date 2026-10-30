"use client";

// ─────────────────────────────────────────────────────────────────────────────
// «GUARDADOS» EN EL DASHBOARD (28-oct-2026, goal «Explorar como portal»): una fila plegada con los deptos que la persona
// guardó con el corazón en Explorar. Cada uno con su línea, su veredicto y su flujo (el financiamiento por defecto: pie 20 % y 30 años), «Ver en el mapa»
// —o su informe, si ya lo analizó— y «Quitar». «Comparar» para los que marque (de 2 a 4): la tabla lado a lado, ahí mismo.
// Las reglas y el copy en lib/explorar/guardados.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { lineaDepto } from "@/lib/guia/linea-depto";
import { COMPARAR_MAX_GUARDADOS, COMPARAR_MIN_GUARDADOS, GUARDADOS_COPY, hrefEnMapa, lineaGuardado, tablaComparacion, type DeptoGuardado } from "@/lib/explorar/guardados";
import { FilaPlegada } from "./casa";

const C = GUARDADOS_COPY;
const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

export function GuardadosCasa({ inicial, uf }: { inicial: DeptoGuardado[]; uf: number | null }) {
  const [items, setItems] = useState(inicial);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [comparando, setComparando] = useState(false);
  if (items.length === 0) return null;
  const marcar = (id: string) => setMarcados((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : xs.length >= COMPARAR_MAX_GUARDADOS ? xs : [...xs, id]));
  async function quitar(id: string) {
    const antes = items;
    setItems((xs) => xs.filter((x) => x.avisoId !== id));
    setMarcados((xs) => xs.filter((x) => x !== id));
    const ok = await fetch("/api/explorar/guardados", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avisoId: id, guardar: false, desde: "dashboard" }) }).then((r) => r.ok).catch(() => false);
    if (!ok) setItems(antes);
  }
  const elegidos = items.filter((d) => marcados.includes(d.avisoId));
  const tabla = comparando && elegidos.length >= COMPARAR_MIN_GUARDADOS ? tablaComparacion(elegidos, uf) : null;
  return (
    <FilaPlegada id="guardados" titulo={C.titulo} n={items.length} sub={C.sub} marca="guardados">
      <div className="ca-guardados" data-casa="guardados-cuerpo">
        <ul className="ca-guardados-lista">
          {items.map((d) => (
            <li key={d.avisoId} className="ca-guardado" data-casa="guardado" data-aviso={d.avisoId} data-activo={d.activo ? "1" : undefined}>
              <label className="ca-guardado-marca">
                <input type="checkbox" checked={marcados.includes(d.avisoId)} disabled={!d.activo || (!marcados.includes(d.avisoId) && marcados.length >= COMPARAR_MAX_GUARDADOS)} onChange={() => marcar(d.avisoId)} aria-label={`Comparar ${lineaDepto(d)}`} />
              </label>
              <div className="ca-guardado-datos">
                <span className="ca-guardado-ojo">{lineaDepto(d)}</span>
                {d.precioUF != null && <b className="ca-guardado-precio">UF {miles(d.precioUF)}</b>}
                <span className="ca-guardado-linea">{lineaGuardado(d)}</span>
                <span className="ca-guardado-acciones">
                  {d.informeId
                    ? <EnlaceCarga href={`/analisis/${d.informeId}`}>{C.verInforme}</EnlaceCarga>
                    : d.activo ? <EnlaceCarga href={hrefEnMapa(d.avisoId)} data-casa="guardado-mapa">{C.verEnMapa}</EnlaceCarga> : null}
                  <button type="button" className="ca-guardado-quitar" onClick={() => void quitar(d.avisoId)}>{C.quitar}</button>
                </span>
              </div>
            </li>
          ))}
        </ul>
        <div className="ca-guardados-pie">
          <span className="ca-guardados-ayuda">{C.marca}</span>
          <button type="button" className="ca-guardados-comparar" disabled={elegidos.length < COMPARAR_MIN_GUARDADOS} onClick={() => setComparando(true)} data-casa="guardados-comparar">{C.comparar(elegidos.length)}</button>
        </div>
        {tabla && (
          <div className="ca-comparar" data-casa="guardados-tabla">
            <div className="ca-comparar-scroll">
              <table>
                <tbody>
                  {tabla.map((f) => (
                    <tr key={f.dato}><th scope="row">{f.dato}</th>{f.valores.map((v, i) => <td key={i}>{v}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="ca-guardado-quitar" onClick={() => setComparando(false)}>{C.cerrarComparacion}</button>
          </div>
        )}
      </div>
    </FilaPlegada>
  );
}
