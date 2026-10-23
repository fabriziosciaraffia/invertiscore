import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { asegurarRegaloDeAlta, huellaDeCabeceras } from "@/lib/regalo-alta-servidor";
import { COOKIE_DISPOSITIVO } from "@/lib/dispositivo";
import { COOKIE_INVITACION } from "@/lib/referido";
import { vincularInvitacion } from "@/lib/referido-servidor";
import { InvitaAlguien } from "@/components/invitacion/InvitaAlguien";
import { cargarSeleccionPagina, hayDeptos, resumenDePagina } from "@/lib/guia/seleccion-pagina-servidor";
import { hrefEntrar } from "@/lib/entrar/entrada";
import { ticketDeCuentaDisponible } from "@/lib/lo-que-sigue/ticket-cuenta-servidor";
import { SeleccionEnCasa } from "./seleccion-en-casa";
import { FrescoAlVolver } from "./fresco-al-volver";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { estadoSaldo, leerSaldo } from "@/lib/casa-saldo";
import { leerPerfilBusqueda } from "@/lib/perfil-busqueda-servidor";
import { hayGuia } from "@/lib/guia/activa";
import { GuiaBusqueda } from "@/components/guia/GuiaBusqueda";
import { CASA, lineaSaldo } from "./casa-copy";
import { BloqueArribaCasa, PerfilBusquedaCasa, SaldoPlano } from "./casa";
import { bloqueDeArriba } from "@/lib/casa-arriba";
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

/**
 * Dashboard v2 — contrato `assets-export/mockup-dashboard.html`.
 *
 * Antes: `select("*")` traía los jsonb `results` + `input_data` de las 229 filas
 * del usuario para pintar una lista plana sin búsqueda, sin orden y sin
 * paginación. Ahora la página consulta la vista `analisis_dashboard`, que ya
 * viene aplanada, y el filtro/búsqueda/orden viajan en la URL (`?q=&mod=&v=
 * &sort=&dir=&page=`) para que el trabajo lo haga Postgres.
 *
 * Server Component puro: el único cliente son el input de búsqueda (debounce) y
 * los botones de acción de fila.
 *
 * UNA SOLA PÁGINA PARA LA SELECCIÓN (21-oct-2026, recorrido real de Fabrizio por la puerta B): la selección se dibuja
 * acá como tarjetas (seleccion-en-casa.tsx). El enlace del correo semanal y del correo del día entra con su token
 * (`?t=&a=`, por /api/semanal/clic, que sigue midiendo el clic) y aterriza en la selección con el depto clicado arriba;
 * /semanal redirige acá. Al volver del informe la página se pide de nuevo sola (fresco-al-volver.tsx).
 */

// La lista depende de searchParams y de datos por usuario: nada que cachear.
export const dynamic = "force-dynamic";

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

  // El regalo al registrarse (16-oct-2026, regalo-alta.ts), como red: la cuenta que llegó hasta acá sin pasar por el
  // código ni por el enlace (contraseña). Antes de la bienvenida: el correo lo dice.
  await asegurarRegaloDeAlta(createServiceClient(), {
    userId: user.id, creadaAt: user.created_at, huella: huellaDeCabeceras(headers(), cookies().get(COOKIE_DISPOSITIVO)?.value ?? null),
  });
  // La invitación (16-oct-2026, la puerta C), también como red: la cuenta que llegó hasta acá con la cookie de un «/i/CÓDIGO»
  // sin que ningún registro la cobrara (contraseña). Si ya se cobró, no hace nada.
  const cookieInv = cookies().get(COOKIE_INVITACION)?.value ?? null;
  if (cookieInv) {
    await vincularInvitacion(createServiceClient(), {
      userId: user.id, creadaAt: user.created_at, cookie: cookieInv, huella: huellaDeCabeceras(headers(), cookies().get(COOKIE_DISPOSITIVO)?.value ?? null),
    });
  }
  // Welcome email server-side e idempotente, antes del branch de onboarding.
  await ensureWelcomeEmail(user.id, user.email, fullName);

  const [{ data: creditsRow }, { count: analisisCount }, { data: perfilRow }] = await Promise.all([
    supabase.from("user_credits").select("onboarding_completed, welcome_credit_used").eq("user_id", user.id).single(),
    supabase
      .from("analisis")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("pending_payment", false),
    // El perfil más reciente, para «Franco busca para ti:» del dashboard vacío (lo editado manda).
    supabase
      .from("perfiles_inversion")
      .select("analysis_id, tipologia, comuna, modalidad, pref_tipologia, pref_comuna, pref_modalidad")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const gratis = primerAnalisisGratis(creditsRow);
  // El saldo o el plan, visible arriba para cualquier cuenta (14-oct-2026): también en el dashboard vacío.
  const admin = createServiceClient();
  const [datosSaldo, sel] = await Promise.all([leerSaldo(admin, user.id), cargarSeleccionPagina(admin, user, { t: tSel, a: aSel })]);
  const saldo = estadoSaldo(datosSaldo);
  const resumenSel = resumenDePagina(sel);
  // El ticket de la cuenta nueva (21-oct-2026, compra-desde-depto.ts): menos de 24 horas y sin el pack pagado. CON O SIN
  // SALDO (22-oct-2026, decisión de Fabrizio: una compra suelta no lo apaga): la tarjeta y la línea del saldo lo ofrecen
  // mientras viva; con saldo dicen «3 más por $14.990» y hasta cuándo (`ticketConSaldo`).
  const ticket = sel?.ticket ?? await ticketDeCuentaDisponible(admin, user);
  const ticketConSaldo = ticket && saldo.tipo !== "sin" && user.created_at ? { cuentaCreadaAt: user.created_at } : null;
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

  // LA CUENTA SIN INFORMES CON SU PERFIL A MANO (16-oct-2026, la puerta B): nació en /deptos. Ve su selección del día, su
  // regalo y su perfil, no la bienvenida de quien todavía no dijo qué busca. Desde el 21-oct-2026, también quien llega
  // por el enlace de un correo con deptos.
  if ((analisisCount ?? 0) === 0) {
    const pp = await leerPerfilBusqueda(admin, user.id);
    if ((pp.soloManual && (pp.perfilLtr ?? pp.perfilStr ?? pp.perfil).completo) || hayDeptos(sel)) {
      const pb0 = pp.perfilLtr ?? pp.perfilStr ?? pp.perfil;
      // La casa que vende (17-oct-2026): una jerarquía. Arriba, el banner según el estado; debajo, «Invita a alguien»;
      // después, plano, el saldo, su selección como tarjetas (21-oct-2026) y el perfil.
      const arriba0 = bloqueDeArriba({ seleccion: resumenSel, saldo, regaloRestante: datosSaldo.regaloRestante, regaloVence: datosSaldo.regaloVence, ticket });
      return (
        <div className="min-h-screen bg-[var(--franco-bg)]">
          <ChipVeredictoTokens />
          <FrescoAlVolver dibujadoAt={dibujadoAt} />
          <HeaderFranco activo="mis" sesion={{ email: user.email ?? "" }} />
          <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-5 sm:px-6" data-casa="sin-informes" style={{ fontFamily: "var(--font-ui), Inter, 'Helvetica Neue', Arial, sans-serif" }}>
            <p className="ca-hola">{CASA.saludo(firstName || null)}</p>
            <BloqueArribaCasa bloque={arriba0} informes={0} ticketConSaldo={ticketConSaldo} ticket={ticket} />
            {/* Invita a alguien (16-oct-2026, la puerta C), el segundo nivel: los dos reciben un análisis. */}
            <div className="mt-4">
              <InvitaAlguien />
            </div>
            <div className="ca-plano">
              <SaldoPlano estado={saldo} arriba={arriba0.tipo} ticketConSaldo={ticketConSaldo} ticket={ticket} />
              <SeleccionEnCasa sel={sel} autoAnalizar={autoAnalizar} primera />
              <PerfilBusquedaCasa
                comprador={false}
                inicial={{ dormitorios: pb0.dormitorios, comunas: pb0.comunas, precioMaxUf: pb0.precioMaxUf, precioMinUf: pb0.editado.includes("precioMin") ? pb0.precioMinUf : null, modalidad: pb0.modalidad, piePct: pb0.piePct, plazoAnios: pb0.plazoAnios, horizonte: pb0.horizonte }}
              />
            </div>
          </div>
          <AppFooter variant="informe" />
        </div>
      );
    }
  }

  // Un usuario con ≥1 análisis está onboardeado de facto, aunque la flag no se
  // haya seteado (ej: entró por /analisis/nuevo-v4 sin pasar por el dashboard).
  if (!creditsRow?.onboarding_completed && (analisisCount ?? 0) === 0) {
    return (
      <>
        <ChipVeredictoTokens />
        <Bienvenida nombre={firstName || null} gratis={gratis} perfil={perfil} onboarding saldo={lineaSaldo(saldo)} />
      </>
    );
  }

  const params = parseParams(searchParams);

  // «Cargar 25 más» acumula: la página N pide (N+1)×25 filas desde el inicio en
  // vez de saltar a un offset. Con 215 unidades el costo es irrelevante y la URL
  // sigue describiendo exactamente lo que se ve — un `?page=3` compartido
  // muestra las mismas 100 filas al que lo abre.
  const filtros = {
    userId: user.id,
    q: params.q || undefined,
    modalidad: params.mod,
    veredicto: params.v,
    origen: params.origen,
  };

  const tope = (params.page + 1) * PAGE_SIZE;

  // En modo agrupado hay que ver el conjunto completo: dos análisis de la misma
  // dirección pueden caer en páginas distintas y el grupo saldría partido.
  const [stats, plano, todas] = await Promise.all([
    fetchDashboardStats(supabase, user.id),
    params.group
      ? Promise.resolve(null)
      // Una sola lista, por fecha, el más reciente arriba (17-oct-2026): sin orden por columna.
      : queryDashboardRows(supabase, { ...filtros, sort: "fecha", dir: "desc", page: 0, pageSize: tope }),
    params.group ? fetchAllUnits(supabase, filtros) : Promise.resolve(null),
  ]);

  // Agrupado: se agrupa y ordena en TS (la normalización de direcciones —
  // tildes, abreviaturas de vía — es mucho más mantenible acá que en SQL) y
  // recién después se pagina, esta vez por PROPIEDAD y no por fila.
  const agrupacion = todas ? agruparPorPropiedad(todas, params.sort, params.dir) : null;
  const itemsVisibles = agrupacion ? agrupacion.slice(0, tope) : undefined;

  const filasPagina = plano?.rows ?? [];
  const totalArchivo = todas ? todas.length : (plano?.total ?? 0);
  const hayMas = agrupacion
    ? (itemsVisibles?.length ?? 0) < agrupacion.length
    : (plano?.hasMore ?? false);
  const unidadesVisibles = itemsVisibles ? contarUnidades(itemsVisibles) : filasPagina.length;

  if (stats.total === 0) {
    return (
      <div className="min-h-screen bg-[var(--franco-bg)]">
        <ChipVeredictoTokens />
        <HeaderFranco activo="mis" sesion={{ email: user.email ?? "" }} />
        <Bienvenida nombre={firstName || null} gratis={gratis} perfil={perfil} onboarding={false} saldo={lineaSaldo(saldo)} />
      </div>
    );
  }

  // «Continuar» y la tira de cifras salieron el 17-oct-2026 (decisión de Fabrizio): «Tus informes» es una sola lista.
  // Los hermanos `str` de los pares AMBAS de la lista, en una sola consulta.
  const groupIds = (todas ?? filasPagina)
    .map((r) => r.ambas_group_id)
    .filter((g): g is string => Boolean(g));

  // La casa (02-oct-2026): el saldo, la selección del pack (si compró y le quedan) y el perfil de búsqueda. Desde el
  // 14-oct-2026 también «Tu selección de esta semana»; desde el 17-oct-2026, de los informes de Franco a la vista, de
  // dónde salieron (el título de la marca «Franco»).
  const francoIds = (todas ?? filasPagina).filter((r) => r.de_franco).map((r) => r.id);
  const [siblings, perfilPersona, { data: pack }, origenes] = await Promise.all([
    fetchAmbasSiblings(supabase, user.id, groupIds),
    leerPerfilBusqueda(admin, user.id),
    admin.from("payments").select("analysis_id").eq("user_id", user.id).eq("product", "pack3").eq("status", "paid").not("analysis_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    origenDeInformes(admin, user.id, francoIds),
  ]);
  const resumen = resumenSel ?? [];
  const packOrigenId = (pack?.analysis_id as string | null | undefined) ?? null;
  const { data: packPerfil } = packOrigenId && saldo.tipo === "con"
    ? await admin.from("perfiles_inversion").select("modalidad, veredicto").eq("analysis_id", packOrigenId).eq("user_id", user.id).maybeSingle()
    : { data: null };
  const guiaCasa = packOrigenId && packPerfil && hayGuia(packPerfil.modalidad === "str" ? "str" : "ltr")
    ? { analysisId: packOrigenId, veredicto: String(packPerfil.veredicto ?? "") }
    : null;
  const pb = perfilPersona.perfil;
  // La casa que vende (17-oct-2026): el bloque de arriba según el estado (casa-arriba.ts).
  const arriba = bloqueDeArriba({ seleccion: resumen, saldo, regaloRestante: datosSaldo.regaloRestante, regaloVence: datosSaldo.regaloVence, ticket });

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      <ChipVeredictoTokens />
      <FrescoAlVolver dibujadoAt={dibujadoAt} />
      <HeaderFranco activo="mis" sesion={{ email: user.email ?? "" }} />

      {/* Todo el dashboard en Inter (02-oct-2026): «Tus informes» pasó al sistema nuevo, como la casa y la guía. */}
      <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-5 sm:px-6" data-casa="pagina" style={{ fontFamily: "var(--font-ui), Inter, 'Helvetica Neue', Arial, sans-serif" }}>
        {/* ── La casa que vende (17-oct-2026): una sola jerarquía. Arriba, el banner con lo más importante según el
             estado y un botón; debajo, «Invita a alguien» con su color; después, plano, el saldo, la guía del pack, el
             perfil y sus informes. ── */}
        <p className="ca-hola">{CASA.saludo(firstName || null)}</p>
        <BloqueArribaCasa bloque={arriba} informes={stats.total} ticketConSaldo={ticketConSaldo} ticket={ticket} />
        {/* Invita a alguien (16-oct-2026, la puerta C), el segundo nivel: los dos reciben un análisis. */}
        <div className="mt-4">
          <InvitaAlguien />
        </div>
        <div className="ca-plano">
          <SaldoPlano estado={saldo} arriba={arriba.tipo} ticketConSaldo={ticketConSaldo} ticket={ticket} />
          {/* La selección como tarjetas, no solo como banner (21-oct-2026). */}
          <SeleccionEnCasa sel={sel} autoAnalizar={autoAnalizar} primera={false} />
          {guiaCasa && (
            <div className="ca-plano-sec" data-casa="guia">
              <GuiaBusqueda analysisId={guiaCasa.analysisId} veredicto={guiaCasa.veredicto} conSesion saldo={saldo.tipo === "con" ? saldo.n : null} estado={saldo} enCasa={{ titulo: CASA.guiaTitulo }} />
            </div>
          )}
          <PerfilBusquedaCasa
            comprador={!!guiaCasa}
            inicial={{ dormitorios: pb.dormitorios, comunas: pb.comunas, precioMaxUf: pb.precioMaxUf, precioMinUf: pb.editado.includes("precioMin") ? pb.precioMinUf : null, modalidad: pb.modalidad, piePct: pb.piePct, plazoAnios: pb.plazoAnios, horizonte: pb.horizonte }}
          />
        </div>

        {/* ── Tus informes + total, planos. Sin botón propio: el principal es «Nuevo análisis» del header único
             (27-sep-2026, un solo botón principal por pantalla). ── */}
        <div className="ca-informes flex flex-wrap items-baseline justify-between gap-3 pb-3.5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="ca-plano-t text-[var(--franco-text)]">
              {CASA.informes}
            </h2>
            <span className="text-[14px] text-[var(--franco-text-secondary)]">
              {stats.total} {stats.total === 1 ? "análisis" : "análisis"}
            </span>
          </div>
          {/* Comparar (30-sep-2026): con dos o más informes, lado a lado. Enlace, no botón: el
              principal de la pantalla sigue siendo «Nuevo análisis» del header. */}
          {stats.total >= 2 && (
            <EnlaceCarga href="/comparar" className="text-[14px] font-semibold text-[var(--franco-text)] underline underline-offset-4" data-lqs="comparar-entrada">
              {COMPARAR.boton}
            </EnlaceCarga>
          )}
        </div>

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
      <AppFooter variant="informe" />
    </div>
  );
}
