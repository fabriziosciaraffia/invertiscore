import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { estadoSaldo, leerSaldo } from "@/lib/casa-saldo";
import { finanzasDeSeleccion, noDanEnRentaCorta, seleccionDeEstaSemana, seleccionPorToken, seleccionViva } from "@/lib/guia/semanal-servidor";
import { leerConfigGuia } from "@/lib/guia/guia-servidor";
import { SEMANAL_PAGINA } from "@/lib/guia/semanal";
import { SEMANAL_STR } from "@/lib/guia/semanal-str";
import { hrefEntrar } from "@/lib/entrar/entrada";
import { SemanalLista } from "./semanal-lista";
import { PreguntaCuando } from "./pregunta-cuando";
import { leerPerfilBusqueda } from "@/lib/perfil-busqueda-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// /semanal (02-oct-2026): adonde lleva el correo semanal. Con sesión; la selección es la del token del
// correo y tiene que ser de quien entró. Muestra los deptos del correo (el clicado primero) y, con saldo,
// «Analizar este» genera el informe con sus números; sin saldo, el botón compra el suelto. Viva
// (05-oct-2026): el que ya no está publicado lo dice y trae en su lugar el siguiente mejor, chequeado.
// Arriba, a quien nunca contestó «¿Cuándo piensas comprar?», la pregunta una vez (13-oct-2026; pregunta-cuando.tsx).
// SIN TOKEN, CON SESIÓN (14-oct-2026): abre la selección de esta semana de quien entró (seleccionDeEstaSemana); así la
// enlaza el dashboard. Con token, la de ese correo, como siempre.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";
const TOKEN = /^[0-9a-f]{20,80}$/i;

export default async function SemanalPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const t = searchParams.t ?? "";
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const aqui = `/semanal?${new URLSearchParams(Object.entries(searchParams).filter((e): e is [string, string] => typeof e[1] === "string")).toString()}`;
  if (!user) redirect(hrefEntrar(aqui, "semanal"));
  if (t && !TOKEN.test(t)) redirect("/dashboard");

  const admin = createServiceClient();
  // El semanal o un aviso inmediato (05-oct-2026): la misma página, viva. Sin token, la de esta semana de quien entró.
  const sel = t ? await seleccionPorToken(admin, t) : await seleccionDeEstaSemana(admin, user.id);
  if (!sel) redirect("/dashboard");

  const otraCuenta = sel.user_id !== user.id;
  const cfg = await leerConfigGuia(admin);
  // LOS DOS BLOQUES (14-oct-2026): el de renta larga y el de renta corta (estimado por zona), cada uno vivo por su lado.
  const tabla = sel.fuente === "inmediato" ? "avisos_inmediatos" : "semanal_selecciones";
  const [filas, filasCortas] = otraCuenta ? [[], []] : await Promise.all([
    sel.conLargo ? seleccionViva(admin, { tabla, id: sel.id, userId: user.id, items: sel.items }, cfg) : Promise.resolve([]),
    sel.corto ? seleccionViva(admin, { tabla, id: sel.id, userId: user.id, items: sel.corto.items, modalidad: "str" }, cfg) : Promise.resolve([]),
  ]);
  const a = searchParams.a ?? null;
  const primero = <F extends { item: { avisoId: string } }>(fs: F[]) => (a ? [...fs.filter((f) => f.item.avisoId === a), ...fs.filter((f) => f.item.avisoId !== a)] : fs);
  const ordenados = primero(filas);
  const ordenadosCortos = primero(filasCortas);
  // Lo que el aviso antes de gastar muestra como el pop-up del wizard (13-oct-2026): la tasa de la persona, la UF del día
  // y el arriendo con que se evaluó cada depto (en renta corta, el ingreso estimado por zona).
  const ids = filas.flatMap((f) => [f.item.avisoId, ...(f.reemplazo ? [f.reemplazo.avisoId] : [])]);
  const idsCortos = filasCortas.flatMap((f) => [f.item.avisoId, ...(f.reemplazo ? [f.reemplazo.avisoId] : [])]);
  const [datosSaldo, perfilPersona, finanzas, finanzasCorto, noDan] = await Promise.all([
    leerSaldo(admin, user.id),
    otraCuenta ? null : leerPerfilBusqueda(admin, user.id),
    finanzasDeSeleccion(admin, sel.origen_analysis_id, ids, cfg.uf),
    sel.corto ? finanzasDeSeleccion(admin, sel.corto.origenId, [], cfg.uf) : Promise.resolve(null),
    // Los que ya se midieron fino y no dieron: su tarjeta queda marcada, sin botón (14-oct-2026).
    otraCuenta || !sel.corto ? Promise.resolve([] as string[]) : noDanEnRentaCorta(admin, user.id, idsCortos),
  ]);
  const ingresosCortos: Record<string, number> = {};
  for (const f of filasCortas) for (const it of [f.item, ...(f.reemplazo ? [f.reemplazo] : [])]) if (it.ingresoMensual != null && it.ingresoMensual > 0) ingresosCortos[it.avisoId] = it.ingresoMensual;
  const saldo = estadoSaldo(datosSaldo);
  const preguntarCuando = perfilPersona != null && perfilPersona.perfil.horizonte == null;
  const combo = sel.combinacion;
  const dosBloques = sel.conLargo && sel.corto != null;

  return (
    <div className="min-h-screen bg-[var(--franco-bg)] text-[var(--franco-text)]">
      <HeaderFranco activo="mis" sesion={{ email: user.email ?? "" }} />
      <main className="mx-auto max-w-[1000px] px-4 pb-16 pt-6 sm:px-6">
        {otraCuenta ? (
          <p className="text-[15px]" role="alert" data-semanal="otra-cuenta">{SEMANAL_PAGINA.otraCuenta}</p>
        ) : (
          <>
          {preguntarCuando && <PreguntaCuando />}
          {sel.conLargo && (
            <SemanalLista
              token={sel.token}
              origenId={sel.origen_analysis_id}
              combinacion={combo}
              filas={ordenados}
              destacado={a}
              saldo={saldo}
              variante={sel.variante}
              inmediato={sel.fuente === "inmediato"}
              finanzas={finanzas}
              bloque={dosBloques ? SEMANAL_STR.bloqueLargo : null}
              cierre={!sel.corto}
            />
          )}
          {sel.corto && (
            <SemanalLista
              token={sel.token}
              origenId={sel.corto.origenId}
              combinacion={sel.corto.combinacion}
              filas={ordenadosCortos}
              destacado={a}
              saldo={saldo}
              variante={sel.variante}
              modalidad="str"
              finanzas={{ tasa: finanzasCorto?.tasa ?? null, uf: cfg.uf, arriendos: ingresosCortos }}
              bloque={dosBloques ? SEMANAL_STR.bloqueCorto : null}
              conTitulo={!sel.conLargo}
              noDan={noDan}
            />
          )}
          </>
        )}
      </main>
    </div>
  );
}
