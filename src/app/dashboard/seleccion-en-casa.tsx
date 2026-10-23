// ─────────────────────────────────────────────────────────────────────────────
// LA SELECCIÓN EN EL DASHBOARD, COMO TARJETAS (21-oct-2026, recorrido real de Fabrizio por la puerta B). Una sola página
// para la selección: la de esta semana —o la del correo, si se entra con su token— se dibuja acá con el mismo componente
// que tenía /semanal (SemanalLista), con «Analizar este», el aviso antes de gastar y «Ya lo analizaste · Ver informe» en
// vivo. El banner de arriba baja hasta acá (#seleccion); /semanal y el clic del correo redirigen acá, con el depto clicado
// arriba. Sin selección con deptos todavía, la cuenta sin informes ve la primera selección, que pregunta sola mientras el
// correo del día revisa las fichas (PrimeraSeleccion). «¿Cuándo piensas comprar?» no va acá: el perfil de la casa ya la hace
// a quien nunca la contestó, y dos veces en la misma página sobraba (visto en el QA del 22-oct-2026).
// ─────────────────────────────────────────────────────────────────────────────
import { SemanalLista } from "@/app/semanal/semanal-lista";
import { PrimeraSeleccion } from "@/components/deptos/PrimeraSeleccion";
import { SEMANAL_PAGINA } from "@/lib/guia/semanal";
import { SEMANAL_STR } from "@/lib/guia/semanal-str";
import { SELECCION_CASA } from "@/lib/guia/seleccion-casa";
import { hayDeptos, type SeleccionPagina } from "@/lib/guia/seleccion-pagina-servidor";

export function SeleccionEnCasa({ sel, autoAnalizar, primera }: {
  sel: SeleccionPagina | null;
  /** Volvió pagado desde un depto (`analizar=1`): ese se analiza solo. */
  autoAnalizar: string | null;
  /** Sin selección con deptos, mostrar la primera selección (la cuenta sin informes). */
  primera: boolean;
}) {
  const ancla = { id: SELECCION_CASA.ancla, className: "ca-plano-sec", style: { scrollMarginTop: 72 } };
  if (sel?.otraCuenta) {
    return (
      <div {...ancla} data-casa="tarjetas">
        <p className="text-[15px]" role="alert" data-semanal="otra-cuenta">{SEMANAL_PAGINA.otraCuenta}</p>
      </div>
    );
  }
  if (!hayDeptos(sel)) {
    return primera ? <div {...ancla} data-casa="tarjetas" data-fuente="primera"><PrimeraSeleccion /></div> : null;
  }
  const dosBloques = !!sel.largo && !!sel.corto;
  const comun = { token: sel.token, destacado: sel.destacado, saldo: sel.saldo, variante: sel.variante, ticket: sel.ticket, cuentaCreadaAt: sel.cuentaCreadaAt, autoAnalizar, enCasa: true };
  const listaLarga = sel.largo && (
    <SemanalLista
      {...comun}
      origenId={sel.largo.origenId}
      combinacion={sel.largo.combinacion}
      filas={sel.largo.filas}
      inmediato={sel.fuente === "inmediato"}
      finanzas={sel.largo.finanzas}
      bloque={dosBloques ? SEMANAL_STR.bloqueLargo : null}
      conTitulo={!sel.cortoPrimero}
      cierre={!sel.corto || sel.cortoPrimero}
      informes={sel.largo.informes}
    />
  );
  const listaCorta = sel.corto && (
    <SemanalLista
      {...comun}
      origenId={sel.corto.origenId}
      combinacion={sel.corto.combinacion}
      filas={sel.corto.filas}
      modalidad="str"
      finanzas={sel.corto.finanzas}
      bloque={dosBloques ? SEMANAL_STR.bloqueCorto : null}
      conTitulo={!sel.largo || sel.cortoPrimero}
      cierre={!sel.cortoPrimero}
      noDan={sel.corto.noDan}
      informes={sel.corto.informes}
    />
  );
  return (
    <div {...ancla} data-casa="tarjetas" data-fuente={sel.fuente}>
      {sel.cortoPrimero ? <>{listaCorta}{listaLarga}</> : <>{listaLarga}{listaCorta}</>}
    </div>
  );
}
