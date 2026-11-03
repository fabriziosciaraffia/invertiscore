// ─────────────────────────────────────────────────────────────────────────────
// EL DESGLOSE (03-nov-2026, la pasada real de Fabrizio): la barra de abajo del mapa —en el teléfono y en el PC, donde reemplaza a
// la píldora negra— y la cabecera de la lista dicen lo mismo, en tres líneas, con los chips de la casa:
//   «10.040 deptos»
//   «6.802 [✓ Comprar] al precio publicado»
//   «3.238 [− Ajustar] requieren negociar el precio»
// y, a la derecha de la primera, «Ver lista» subrayado (en la barra). Las líneas salen de portal.ts › desgloseBarra: cada clase va
// solo si tiene alguno y las dos suman el total (lo fija el tier EXPLORAR-PASADA). Mientras se calcula, una sola línea con el
// avance. Sin hooks: se dibuja igual en el servidor (el tier lo renderiza).
// ─────────────────────────────────────────────────────────────────────────────
import { ChipVeredicto } from "@/components/analysis/shared/ChipVeredicto";
import { PORTAL_COPY, type DesgloseBarra } from "@/lib/explorar/portal";

/** Las líneas: el total y cada clase. `calculando`: el texto del avance, en lugar de todo. */
export function LineasDesglose({ desglose, calculando = null, tituloComo = "span", idTitulo }: {
  desglose: DesgloseBarra | null;
  calculando?: string | null;
  /** En la lista, el título es el encabezado del diálogo. */
  tituloComo?: "span" | "h2";
  idTitulo?: string;
}) {
  const Titulo = tituloComo;
  if (calculando != null || !desglose) return <Titulo className="ex-hoja-t" id={idTitulo} data-explorar="titulo-hoja">{calculando ?? PORTAL_COPY.calculando}</Titulo>;
  const { comprar, ajustar } = desglose;
  return (
    <>
      <Titulo className="ex-hoja-t" id={idTitulo} data-explorar="titulo-hoja" data-n={desglose.total}>{desglose.titulo}</Titulo>
      {comprar && (
        <span className="ex-hoja-linea" data-explorar="linea-comprar" data-n={comprar.n}>
          <b>{comprar.cifra}</b> <ChipVeredicto v="COMPRAR" />{comprar.despues}
        </span>
      )}
      {ajustar && (
        <span className="ex-hoja-linea" data-explorar="linea-ajustar" data-n={ajustar.n}>
          <b>{ajustar.cifra}</b> <span className="ex-pegado"><ChipVeredicto v="AJUSTA SUPUESTOS" />{ajustar.coma}</span>{ajustar.despues}
        </span>
      )}
    </>
  );
}

/** La barra de abajo del mapa: el desglose y, a la derecha de la primera línea, «Ver lista». Toda la barra abre la lista. */
export function BarraAbajo({ desglose, calculando = null, alVerLista }: { desglose: DesgloseBarra | null; calculando?: string | null; alVerLista: () => void }) {
  return (
    <button type="button" className="ex-hoja" data-explorar="hoja" onClick={alVerLista}>
      <span className="ex-asa" aria-hidden="true" />
      <span className="ex-hoja-cuentas" data-explorar="desglose">
        <LineasDesglose desglose={desglose} calculando={calculando} />
      </span>
      <span className="ex-hoja-ver" data-explorar="ver-lista">{PORTAL_COPY.verLista}</span>
    </button>
  );
}
