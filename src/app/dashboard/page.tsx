import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { asegurarRegaloDeAlta, huellaDeCabeceras } from "@/lib/regalo-alta-servidor";
import { COOKIE_DISPOSITIVO } from "@/lib/dispositivo";
import { COOKIE_INVITACION } from "@/lib/referido";
import { vincularInvitacion } from "@/lib/referido-servidor";
import { InvitaAlguien } from "@/components/invitacion/InvitaAlguien";
import { primerosDeLaCuenta } from "@/lib/deptos/primeros-servidor";
import { PrimerosDeptos } from "@/components/deptos/PrimerosDeptos";
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
import { origenDeInformes, seleccionDeEstaSemana } from "@/lib/guia/semanal-servidor";
import { resumenSeleccion } from "@/lib/guia/seleccion-casa";
import { ensureWelcomeEmail, nombreReal, resolveDisplayName } from "@/lib/welcome";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { COMPARAR } from "@/lib/lo-que-sigue/copy";
import {
  queryDashboardRows,
  fetchAllUnits,
  fetchAmbasSiblings,
  fetchDashboardStats,
  type AnalisisDashboardRow,
} from "@/lib/dashboard-query";
import { agruparPorPropiedad, contarUnidades } from "./agrupar";
import { Bienvenida, type PerfilBienvenida } from "./bienvenida";
import { primerAnalisisGratis } from "./bienvenida-copy";
import { Continuar } from "./continuar";
import { StatsStrip } from "./stats-strip";
import { Archive } from "./archive";
import { parseParams, primeraFrase, PAGE_SIZE, sinDireccion } from "./dashboard-helpers";
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
  if (!user) redirect("/login");

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
  const datosSaldo = await leerSaldo(admin, user.id);
  const saldo = estadoSaldo(datosSaldo);
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
  // regalo y su perfil, no la bienvenida de quien todavía no dijo qué busca.
  if ((analisisCount ?? 0) === 0) {
    const pp = await leerPerfilBusqueda(admin, user.id);
    if (pp.soloManual && (pp.perfilLtr ?? pp.perfilStr ?? pp.perfil).completo) {
      const pb0 = pp.perfilLtr ?? pp.perfilStr ?? pp.perfil;
      const [primeros, seleccion0] = await Promise.all([primerosDeLaCuenta(admin, user.id), seleccionDeEstaSemana(admin, user.id)]);
      // La casa que vende (17-oct-2026): una jerarquía. Arriba, el banner según el estado; debajo, «Invita a alguien»;
      // después, plano, el saldo, sus primeros deptos y el perfil.
      const arriba0 = bloqueDeArriba({ seleccion: seleccion0 ? resumenSeleccion(seleccion0) : null, saldo, regaloRestante: datosSaldo.regaloRestante, regaloVence: datosSaldo.regaloVence });
      return (
        <div className="min-h-screen bg-[var(--franco-bg)]">
          <ChipVeredictoTokens />
          <HeaderFranco activo="mis" sesion={{ email: user.email ?? "" }} />
          <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-5 sm:px-6" data-casa="sin-informes" style={{ fontFamily: "var(--font-ui), Inter, 'Helvetica Neue', Arial, sans-serif" }}>
            <p className="ca-hola">{CASA.saludo(firstName || null)}</p>
            <BloqueArribaCasa bloque={arriba0} informes={0} />
            {/* Invita a alguien (16-oct-2026, la puerta C), el segundo nivel: los dos reciben un análisis. */}
            <div className="mt-4">
              <InvitaAlguien />
            </div>
            <div className="ca-plano">
              <SaldoPlano estado={saldo} arriba={arriba0.tipo} />
              <div className="ca-plano-sec" data-casa="primeros">
                <PrimerosDeptos items={primeros.items} token={primeros.token} revisando={primeros.revisando} contexto="casa" vecinas={primeros.vecinas} />
              </div>
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
  };

  const tope = (params.page + 1) * PAGE_SIZE;

  // En modo agrupado hay que ver el conjunto completo: dos análisis de la misma
  // dirección pueden caer en páginas distintas y el grupo saldría partido.
  const [stats, plano, todas] = await Promise.all([
    fetchDashboardStats(supabase, user.id),
    params.group
      ? Promise.resolve(null)
      : queryDashboardRows(supabase, { ...filtros, sort: params.sort, dir: params.dir, page: 0, pageSize: tope }),
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

  // CONTINUAR ignora los filtros del archivo: son los 4 más recientes, siempre.
  const recientes = await queryDashboardRows(supabase, {
    userId: user.id,
    sort: "fecha",
    dir: "desc",
    page: 0,
    pageSize: 4,
  });

  // Los hermanos `str` de los pares AMBAS de ambas zonas, en una sola consulta,
  // y el «Siendo franco:» de la card hero — en paralelo, no encadenados.
  const groupIds = [...(todas ?? filasPagina), ...recientes.rows]
    .map((r) => r.ambas_group_id)
    .filter((g): g is string => Boolean(g));
  const hero: AnalisisDashboardRow | undefined = recientes.rows[0];

  const [siblings, resumenRow] = await Promise.all([
    fetchAmbasSiblings(supabase, user.id, groupIds),
    // `resumen` es texto largo y no vive en la vista: se pide para UNA fila.
    hero
      ? supabase.from("analisis").select("resumen").eq("id", hero.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const heroResumen = primeraFrase(resumenRow?.data?.resumen);

  // La casa (02-oct-2026): el saldo, la selección del pack (si compró y le quedan) y el perfil de búsqueda. Desde el
  // 14-oct-2026 también «Tu selección de esta semana» y, en el archivo, los informes que salieron de ella.
  const sinDirIds = [...(todas ?? filasPagina)].filter(sinDireccion).map((r) => r.id);
  const [perfilPersona, { data: pack }, seleccion, origenes] = await Promise.all([
    leerPerfilBusqueda(admin, user.id),
    admin.from("payments").select("analysis_id").eq("user_id", user.id).eq("product", "pack3").eq("status", "paid").not("analysis_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    seleccionDeEstaSemana(admin, user.id),
    origenDeInformes(admin, user.id, sinDirIds),
  ]);
  const resumen = seleccion ? resumenSeleccion(seleccion) : [];
  const packOrigenId = (pack?.analysis_id as string | null | undefined) ?? null;
  const { data: packPerfil } = packOrigenId && saldo.tipo === "con"
    ? await admin.from("perfiles_inversion").select("modalidad, veredicto").eq("analysis_id", packOrigenId).eq("user_id", user.id).maybeSingle()
    : { data: null };
  const guiaCasa = packOrigenId && packPerfil && hayGuia(packPerfil.modalidad === "str" ? "str" : "ltr")
    ? { analysisId: packOrigenId, veredicto: String(packPerfil.veredicto ?? "") }
    : null;
  const pb = perfilPersona.perfil;
  // La casa que vende (17-oct-2026): el bloque de arriba según el estado (casa-arriba.ts).
  const arriba = bloqueDeArriba({ seleccion: resumen, saldo, regaloRestante: datosSaldo.regaloRestante, regaloVence: datosSaldo.regaloVence });

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      <ChipVeredictoTokens />
      <HeaderFranco activo="mis" sesion={{ email: user.email ?? "" }} />

      {/* Todo el dashboard en Inter (02-oct-2026): «Tus informes» pasó al sistema nuevo, como la casa y la guía. */}
      <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-5 sm:px-6" data-casa="pagina" style={{ fontFamily: "var(--font-ui), Inter, 'Helvetica Neue', Arial, sans-serif" }}>
        {/* ── La casa que vende (17-oct-2026): una sola jerarquía. Arriba, el banner con lo más importante según el
             estado y un botón; debajo, «Invita a alguien» con su color; después, plano, el saldo, la guía del pack, el
             perfil y sus informes. ── */}
        <p className="ca-hola">{CASA.saludo(firstName || null)}</p>
        <BloqueArribaCasa bloque={arriba} informes={stats.total} />
        {/* Invita a alguien (16-oct-2026, la puerta C), el segundo nivel: los dos reciben un análisis. */}
        <div className="mt-4">
          <InvitaAlguien />
        </div>
        <div className="ca-plano">
          <SaldoPlano estado={saldo} arriba={arriba.tipo} />
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

        <Continuar rows={recientes.rows} siblings={siblings} heroResumen={heroResumen} />

        <StatsStrip stats={stats} params={params} />

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
