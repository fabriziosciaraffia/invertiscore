import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { asegurarRegaloDeAlta, huellaDeCabeceras } from "@/lib/regalo-alta-servidor";
import { COOKIE_DISPOSITIVO } from "@/lib/dispositivo";
import { COOKIE_INVITACION } from "@/lib/referido";
import { vincularInvitacion } from "@/lib/referido-servidor";
import { InvitaAlguien } from "@/components/invitacion/InvitaAlguien";
import { cargarSeleccionPagina, hayDeptos } from "@/lib/guia/seleccion-pagina-servidor";
import { hrefEntrar } from "@/lib/entrar/entrada";
import { ticketDeCuentaDisponible } from "@/lib/lo-que-sigue/ticket-cuenta-servidor";
import { esPuerta } from "@/lib/atribucion-puerta";
import { lineaRenueva, ofertaEnCasa, pildoraSaldo, preguntasPendientes } from "@/lib/casa/reglas";
import { datosMapaCasa } from "@/lib/casa/mapa-casa-servidor";
import { SeleccionEnCasa } from "./seleccion-en-casa";
import { OfertaCasa } from "./oferta-casa";
import { MapaCasa } from "./mapa-casa";
import { FrescoAlVolver } from "./fresco-al-volver";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { estadoSaldo, leerSaldo } from "@/lib/casa-saldo";
import { leerPerfilBusqueda } from "@/lib/perfil-busqueda-servidor";
import { CASA, lineaBusqueda, lineaSaldo } from "./casa-copy";
import { AbrirPorAncla, FilaPlegada, PerfilBusquedaCasa } from "./casa";
import { AppFooter } from "@/components/chrome/AppFooter";
import { origenDeInformes } from "@/lib/guia/semanal-servidor";
import { ensureWelcomeEmail, nombreReal, resolveDisplayName } from "@/lib/welcome";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { COMPARAR } from "@/lib/lo-que-sigue/copy";
import {
  queryDashboardRows,
  fetchAllUnits,
  fetchAmbasSiblings,
  fetchDashboardStats,
} from "@/lib/dashboard-query";
import { agruparPorPropiedad, contarUnidades } from "./agrupar";
import { Bienvenida, type PerfilBienvenida } from "./bienvenida";
import { primerAnalisisGratis } from "./bienvenida-copy";
import { Archive } from "./archive";
import { parseParams, PAGE_SIZE } from "./dashboard-helpers";
// El CSS del chip de veredicto del informe: el dashboard lo usa desde el 25-sep-2026.
import { ChipVeredictoTokens } from "@/components/analysis/shared/ChipVeredicto";
import "./casa.css";

/**
 * EL DASHBOARD (24-oct-2026, mockup docs/puerta-b-mockups/3b-dashboard.html, decisión de Fabrizio): UNA casa para quien
 * tiene su perfil o su selección, con o sin informes. El orden manda:
 *   1 · «Hola, [nombre]» con la píldora del saldo («Sin análisis · Ver planes» / «Te quedan N»);
 *   2 · la oferta roja de una fila, mientras el ticket de la cuenta nueva viva, con o sin saldo (lib/casa/reglas.ts);
 *   3 · la franja «Invita a alguien · Si entra con tu enlace, los dos reciben un análisis · Compartir»;
 *   4 · «Tu selección de esta semana» con la línea del perfil y cuándo se renueva; el mapa de la selección (los 5 en rojo,
 *       los demás que convienen en gris, «Explorar los N en el mapa» a /explorar); las tarjetas numeradas, el ya analizado
 *       como fila compacta en su posición, «Ver los N que faltan»;
 *   5 · plegados: «Tu perfil de búsqueda» (con «2 preguntas pendientes» mientras falten) e «Informes realizados».
 * Quien no tiene informes ni perfil ni selección sigue viendo la bienvenida. En el teléfono mide menos de la mitad de lo
 * que medía: lo de abajo va plegado.
 * La selección del correo entra con su token (`?t=&a=`, por /api/semanal/clic) y aterriza con el depto clicado arriba;
 * /semanal redirige acá. Al volver del informe la página se pide de nuevo sola (fresco-al-volver.tsx).
 */

// La lista depende de searchParams y de datos por usuario: nada que cachear.
export const dynamic = "force-dynamic";

const UI = "var(--font-ui), Inter, 'Helvetica Neue', Arial, sans-serif";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  // La selección del correo (21-oct-2026): `t` su token, `a` el depto clicado, `analizar=1` la vuelta pagada de un depto.
  const uno = (k: string) => { const v = searchParams[k]; return typeof v === "string" ? v : null; };
  const tSel = uno("t"), aSel = uno("a");
  // Sin sesión, el enlace del correo entra por el código y vuelve a esta misma selección.
  if (!user && tSel) redirect(hrefEntrar(`/dashboard?${new URLSearchParams({ t: tSel, ...(aSel ? { a: aSel } : {}) }).toString()}`, "semanal"));
  if (!user) redirect("/login");
  const autoAnalizar = uno("analizar") === "1" ? aSel : null;
  const dibujadoAt = Date.now();

  const fullName = resolveDisplayName(user.user_metadata, user.email);
  // Para saludar, solo el nombre real: nunca la parte del correo antes de la @ (01-oct-2026).
  const firstName = nombreReal(user.user_metadata) ?? "";
  const admin = createServiceClient();

  // El regalo al registrarse (16-oct-2026, regalo-alta.ts), como red: la cuenta que llegó hasta acá sin pasar por el
  // código ni por el enlace (contraseña). Antes de la bienvenida: el correo lo dice.
  await asegurarRegaloDeAlta(admin, {
    userId: user.id, creadaAt: user.created_at, huella: huellaDeCabeceras(headers(), cookies().get(COOKIE_DISPOSITIVO)?.value ?? null),
  });
  // La invitación (16-oct-2026, la puerta C), también como red: la cuenta que llegó hasta acá con la cookie de un «/i/CÓDIGO»
  // sin que ningún registro la cobrara (contraseña). Si ya se cobró, no hace nada.
  const cookieInv = cookies().get(COOKIE_INVITACION)?.value ?? null;
  if (cookieInv) {
    await vincularInvitacion(admin, {
      userId: user.id, creadaAt: user.created_at, cookie: cookieInv, huella: huellaDeCabeceras(headers(), cookies().get(COOKIE_DISPOSITIVO)?.value ?? null),
    });
  }
  // Welcome email server-side e idempotente, antes del branch de onboarding.
  await ensureWelcomeEmail(user.id, user.email, fullName);

  const [{ data: creditsRow }, { count: analisisCount }, { data: perfilRow }, { data: atr }, datosSaldo, sel, perfilPersona] = await Promise.all([
    supabase.from("user_credits").select("onboarding_completed, welcome_credit_used").eq("user_id", user.id).single(),
    supabase
      .from("analisis")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("pending_payment", false),
    // El perfil más reciente, para «Franco busca para ti:» de la bienvenida (lo editado manda).
    supabase
      .from("perfiles_inversion")
      .select("analysis_id, tipologia, comuna, modalidad, pref_tipologia, pref_comuna, pref_modalidad")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // La puerta por la que entró (atribucion-puerta.ts): decide si el perfil le hace las dos preguntas.
    admin.from("user_attribution").select("puerta").eq("user_id", user.id).maybeSingle(),
    leerSaldo(admin, user.id),
    cargarSeleccionPagina(admin, user, { t: tSel, a: aSel }),
    leerPerfilBusqueda(admin, user.id),
  ]);
  const gratis = primerAnalisisGratis(creditsRow);
  const saldo = estadoSaldo(datosSaldo);
  const informes = analisisCount ?? 0;
  const pb = perfilPersona.perfilLtr ?? perfilPersona.perfilStr ?? perfilPersona.perfil;
  const tienePerfil = informes > 0 || (perfilPersona.soloManual && pb.completo);
  const perfil: PerfilBienvenida | null = perfilRow?.analysis_id
    ? {
        analysisId: perfilRow.analysis_id as string,
        chips: {
          tipologia: (perfilRow.pref_tipologia ?? perfilRow.tipologia ?? null) as string | null,
          comuna: (perfilRow.pref_comuna ?? perfilRow.comuna ?? null) as string | null,
          modalidad: (perfilRow.pref_modalidad ?? perfilRow.modalidad) === "str" ? "str" : "ltr",
        },
      }
    : null;

  // SIN INFORMES, SIN PERFIL Y SIN SELECCIÓN: la bienvenida de quien todavía no dijo qué busca.
  if (informes === 0 && !tienePerfil && !hayDeptos(sel)) {
    return (
      <div className="min-h-screen bg-[var(--franco-bg)]">
        <ChipVeredictoTokens />
        {creditsRow?.onboarding_completed && <HeaderFranco activo="mis" sesion={{ email: user.email ?? "" }} />}
        <Bienvenida nombre={firstName || null} gratis={gratis} perfil={perfil} onboarding={!creditsRow?.onboarding_completed} saldo={lineaSaldo(saldo)} />
      </div>
    );
  }

  // EL TICKET DE LA CUENTA NUEVA (21-oct-2026, compra-desde-depto.ts): menos de 24 horas y sin el pack pagado. CON O SIN
  // SALDO (22-oct-2026, decisión de Fabrizio: una compra suelta no lo apaga): la oferta roja va mientras viva.
  const ticket = sel?.ticket ?? await ticketDeCuentaDisponible(admin, user);
  const puerta = esPuerta(atr?.puerta) ? atr.puerta : null;
  const pendientes = preguntasPendientes({ puerta, modalidad: perfilPersona.manual.modalidad, horizonte: pb.horizonte });
  const pildora = pildoraSaldo(saldo);
  // El mapa: los deptos de la selección (el reemplazo del caído, si lo hay) y los demás que convienen con su búsqueda.
  const itemsSel = hayDeptos(sel) ? (sel.largo?.filas ?? []).map((f) => f.reemplazo ?? f.item).filter((i) => !!i) : [];
  const mapa = itemsSel.length > 0 ? await datosMapaCasa(admin, user.id, itemsSel.map((i) => ({ avisoId: i.avisoId, comuna: i.comuna }))) : null;
  const lineaSel = [lineaBusqueda({ comunas: pb.comunas, dormitorios: pb.dormitorios, precioMinUf: pb.editado.includes("precioMin") ? pb.precioMinUf : null, precioMaxUf: pb.precioMaxUf }), lineaRenueva(pb.horizonte)].filter(Boolean).join(" · ");

  // «INFORMES REALIZADOS», plegados al final: la misma lista de siempre (archive.tsx), por fecha, con búsqueda y filtros en
  // la URL (`?q=&mod=&v=&o=&page=&group=&open=`); con un filtro puesto, la fila llega abierta.
  const params = parseParams(searchParams);
  const filtros = { userId: user.id, q: params.q || undefined, modalidad: params.mod, veredicto: params.v, origen: params.origen };
  const tope = (params.page + 1) * PAGE_SIZE;
  const [stats, plano, todas] = informes > 0
    ? await Promise.all([
        fetchDashboardStats(supabase, user.id),
        params.group ? Promise.resolve(null) : queryDashboardRows(supabase, { ...filtros, sort: "fecha", dir: "desc", page: 0, pageSize: tope }),
        params.group ? fetchAllUnits(supabase, filtros) : Promise.resolve(null),
      ])
    : [null, null, null];
  const agrupacion = todas ? agruparPorPropiedad(todas, params.sort, params.dir) : null;
  const itemsVisibles = agrupacion ? agrupacion.slice(0, tope) : undefined;
  const filasPagina = plano?.rows ?? [];
  const totalArchivo = todas ? todas.length : (plano?.total ?? 0);
  const hayMas = agrupacion ? (itemsVisibles?.length ?? 0) < agrupacion.length : (plano?.hasMore ?? false);
  const unidadesVisibles = itemsVisibles ? contarUnidades(itemsVisibles) : filasPagina.length;
  const groupIds = (todas ?? filasPagina).map((r) => r.ambas_group_id).filter((g): g is string => Boolean(g));
  const francoIds = (todas ?? filasPagina).filter((r) => r.de_franco).map((r) => r.id);
  const [siblings, origenes] = stats
    ? await Promise.all([fetchAmbasSiblings(supabase, user.id, groupIds), origenDeInformes(admin, user.id, francoIds)])
    : [new Map(), {}];
  const abrirInformes = ["q", "mod", "v", "o", "page", "group", "open"].some((k) => typeof searchParams[k] === "string");

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      <ChipVeredictoTokens />
      <FrescoAlVolver dibujadoAt={dibujadoAt} />
      <AbrirPorAncla />
      <HeaderFranco activo="mis" sesion={{ email: user.email ?? "" }} />

      <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-5 sm:px-6" data-casa="pagina" data-puerta={puerta ?? undefined} style={{ fontFamily: UI }}>
        {/* 1 · el saludo y la píldora del saldo */}
        <div className="ca-cabecera">
          <p className="ca-hola">{CASA.saludo(firstName || null)}</p>
          <span className="ca-pildora" data-casa="saldo" data-saldo={saldo.tipo}>
            {pildora.texto}
            {pildora.planes && <> · <EnlaceCarga href="/pricing" data-casa="planes">{CASA.verPlanes}</EnlaceCarga></>}
          </span>
        </div>

        {/* 2 · la oferta roja, mientras el ticket viva (con o sin saldo) */}
        {ofertaEnCasa({ ticket, saldo }) && user.created_at && <OfertaCasa cuentaCreadaAt={user.created_at} />}

        {/* 3 · «Invita a alguien», una fila */}
        <div className="ca-invita">
          <InvitaAlguien variante="fila" />
        </div>

        {/* 4 · la selección: el título, la línea del perfil, el mapa y las tarjetas */}
        <section className="ca-seccion" data-casa="seleccion">
          <h2 className="ca-t2">{CASA.seleccion.titulo}</h2>
          {lineaSel && <p className="ca-linea" data-casa="seleccion-linea">{lineaSel}</p>}
          {mapa && <MapaCasa datos={mapa} />}
          <SeleccionEnCasa sel={sel} autoAnalizar={autoAnalizar} primera={!hayDeptos(sel)} />
        </section>

        {/* 5 · plegados: el perfil y los informes */}
        <div className="ca-plegadas">
          <PerfilBusquedaCasa
            inicial={{ dormitorios: pb.dormitorios, comunas: pb.comunas, precioMaxUf: pb.precioMaxUf, precioMinUf: pb.editado.includes("precioMin") ? pb.precioMinUf : null, modalidad: pb.modalidad, piePct: pb.piePct, plazoAnios: pb.plazoAnios, horizonte: pb.horizonte }}
            pendientes={pendientes}
            modalidadRespondida={perfilPersona.manual.modalidad != null}
          />
          {stats && stats.total > 0 && (
            <FilaPlegada id="informes" titulo={CASA.informes} n={stats.total} marca="informes" abierta={abrirInformes}>
              <div className="ca-informes-cuerpo">
                {/* Comparar (30-sep-2026): con dos o más informes, lado a lado. */}
                {stats.total >= 2 && (
                  <p className="mt-2 text-right">
                    <EnlaceCarga href="/comparar" className="text-[14px] font-semibold text-[var(--franco-text)] underline underline-offset-4" data-lqs="comparar-entrada">
                      {COMPARAR.boton}
                    </EnlaceCarga>
                  </p>
                )}
                <Archive
                  rows={filasPagina}
                  items={itemsVisibles}
                  siblings={siblings}
                  total={totalArchivo}
                  hasMore={hayMas}
                  params={params}
                  stats={stats}
                  unidadesVisibles={unidadesVisibles}
                  origenes={origenes}
                />
              </div>
            </FilaPlegada>
          )}
        </div>
      </div>
      <AppFooter variant="informe" />
    </div>
  );
}
