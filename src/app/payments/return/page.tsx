"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { PAGO_OTRA_CUENTA, PAGO_PACK_NO_PASO, RETORNO_SIN_SESION } from "@/lib/lo-que-sigue/copy";
import { leerRetornoPack, leerRetornoPackDelPago, PRODUCTO_PACK, type RetornoPack } from "@/lib/lo-que-sigue/oferta-pack";
import { leerDeptoDelPago, type DeptoDelPago } from "@/lib/guia/compra-desde-depto";
import { estadoDelPago, type LlavePago } from "@/lib/lo-que-sigue/retorno-pago";
import { DespuesDePagar } from "@/components/lo-que-sigue/DespuesDePagar";
import { HorizontePostPago } from "@/components/lo-que-sigue/HorizontePostPago";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { botonOcupado, claveActual, iniciarCarga } from "@/lib/carga-global";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { AppFooter } from "@/components/chrome/AppFooter";
import { metaTrack } from "@/lib/meta/pixel";
import { espejarMeta, type EventoEspejo } from "@/lib/meta/espejo";
import { EVENTOS_META, idCompraPlan } from "@/lib/meta/ids";
import { GuiaBusqueda } from "@/components/guia/GuiaBusqueda";
import { hayGuia } from "@/lib/guia/activa";
import { hrefEntrar } from "@/lib/entrar/entrada";
import { PRODUCTO_TRES, TRES_COPY, volverSeguro } from "@/lib/tres-analisis";
import { PLANO, UI_PLANO } from "@/components/plano/plano";
import { RETORNO, botonTrasPagar, rutaReintentar } from "@/lib/compra/compra";
import { CONFIRMANDO_TOPE_MS, DEMORA_PAGO, PAGO_SIN_CONFIRMAR, RETORNO_SUSCRIPCION, estadoRetornoSuscripcion } from "@/lib/subscriptions/suscripcion";
import { ABRIR_INFORME_TRAS_MS, INFORME_COPY, informeFallo, informeGenerando, informeListo, type MotivoFallo, type PasoInforme } from "@/lib/guia/informe-en-camino";
import { InformeEnLaVuelta } from "@/components/guia/InformeEnCamino";

/** Generando el informe del depto pagado: cuánto se espera entre intentos y cuántas veces se espera el crédito. */
const ESPERA_GENERAR_MS = 2500;
const REINTENTOS_CREDITO_RETORNO = 5;

function PaymentReturnContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const type = searchParams.get("type");
  const statusParam = searchParams.get("status");
  const order = searchParams.get("order");
  // «Lo que sigue» (30-sep-2026): la vuelta del pack. Desde el 22-oct-2026 la URL trae solo su marca y la firma
  // (lib/compra/retorno-flow.ts: Flow corta a 200 caracteres); el informe, su veredicto y su modalidad llegan con el
  // estado del pago (`packInfo`).
  const retornoPack = leerRetornoPack(searchParams);
  // La llave del pago (02-oct-2026): la firma que el servidor puso en la URL de retorno. Sin sesión deja
  // leer el estado de ESTE pago, el saldo y la guía; sin ella, la pantalla no sabe nada y pide entrar.
  const llavePago: LlavePago | null = retornoPack?.firma && order ? { order, firma: retornoPack.firma } : null;
  // `suscripcion`: la vuelta de registrar la tarjeta, con lo que register-callback comprobó (05-nov-2026). `sin_confirmar`: la
  // consulta del pago falló; no se sabe si se cobró y no se dice «No se hizo ningún cargo».
  const [paymentStatus, setPaymentStatus] = useState<"loading" | "paid" | "pending" | "error" | "sin_sesion" | "otra_cuenta" | "suscripcion" | "sin_confirmar">("loading");
  const estadoSuscripcion = type === "subscription" ? estadoRetornoSuscripcion(statusParam) : null;
  // EL TOPE DE «CONFIRMANDO TU PAGO…» (05-nov-2026, auditoría de promesas parte 2): a los 90 segundos la pantalla dice qué
  // pasa y ofrece volver. Si después llega el pago, igual cambia a «Pago confirmado» (la consulta sigue).
  const [demora, setDemora] = useState(false);
  useEffect(() => {
    if (type === "subscription") return;
    const t = window.setTimeout(() => setDemora(true), CONFIRMANDO_TOPE_MS);
    return () => window.clearTimeout(t);
  }, [type]);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [packInfo, setPackInfo] = useState<RetornoPack | null>(null);
  // El pack de tres (13-oct-2026): dice lo que compró y vuelve adonde estaba (el aviso, la semana, la guía).
  const [producto, setProducto] = useState<string | null>(null);
  // Lo que la compra traía (origen, variante, el par AMBAS): «Reintentar» vuelve a la misma compra.
  const [datosPago, setDatosPago] = useState<{ origen?: string; variante?: string; companion_str_id?: string } | null>(null);
  // ADÓNDE VUELVE: del pago guardado (`payment_data.volver`), nunca de la URL (22-oct-2026; a Flow viaja lo mínimo).
  const [volver, setVolver] = useState<string | null>(null);
  // El saldo real de la cuenta dueña del pago (`null` = no se sabe; la pantalla no inventa un número).
  const [saldo, setSaldo] = useState<number | null>(null);
  const [conSesion, setConSesion] = useState(true);
  // Estado puente: tras detectar paid de un single con análisis, mostramos
  // "abriendo tu análisis…" mientras se hace el push (evita flash de la pantalla
  // genérica antes de la navegación).
  const [redirecting, setRedirecting] = useState(false);
  // LA COMPRA SALIÓ DE UN DEPTO DE LA SELECCIÓN (22-oct-2026, decisión de Fabrizio; compra-desde-depto.ts): pagada, esta
  // pantalla genera el informe de ese depto sola —«Pago confirmado. Franco está analizando Providencia · 2D2B · 59 m² ·
  // UF 3.500…»— y lo abre. Desde el 03-nov-2026 con la regla del informe en camino (lib/guia/informe-en-camino.ts,
  // InformeEnLaVuelta): la barra avanza, a los 10 s «Abrir informe», el veredicto distinto se dice antes de abrirlo y, si no
  // sale, lo dice ahí mismo con qué hacer —ya no vuelve al dashboard en silencio a intentarlo otra vez—.
  const [alDepto, setAlDepto] = useState<DeptoDelPago | null>(null);
  const [informe, setInforme] = useState<PasoInforme | null>(null);
  // Un informe ya hecho (el suelto, el desbloqueo): adónde se fue, para ofrecer «Abrir informe» si a los 10 s sigue acá.
  const [destino, setDestino] = useState<string | null>(null);
  const [conAbrir, setConAbrir] = useState(false);
  // Guard para que el push al análisis ocurra UNA sola vez: el polling puede
  // re-ejecutar checkStatus en re-renders y no queremos re-push ni loop.
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (!destino) return;
    const t = window.setTimeout(() => setConAbrir(true), ABRIR_INFORME_TRAS_MS);
    return () => window.clearTimeout(t);
  }, [destino]);
  const abrirDestino = (href: string) => { setDestino(href); router.push(href); };

  async function generarDepto(depto: DeptoDelPago) {
    const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
    const paso0 = informeGenerando(depto.nombre, depto.esperado);
    setInforme(paso0);
    // No salió (no se cobró): se dice acá, con qué hacer.
    const fallar = (motivo: MotivoFallo) => setInforme(informeFallo(paso0, motivo));
    // El crédito del pago puede llegar unos segundos después del «pagado» (el webhook lo otorga aparte): «sin créditos»
    // se espera unas veces, como en la selección (semanal-lista.tsx › REINTENTOS_CREDITO); «en curso» (409) también.
    let sinCredito = 0;
    for (let intento = 0; intento < 12; intento++) {
      try {
        const res = await fetch("/api/lo-que-sigue/guia/analizar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origenId: depto.origenId, avisoId: depto.avisoId, semanal: depto.token }),
        });
        if (res.status === 409) { await esperar(ESPERA_GENERAR_MS); continue; }
        const d = (await res.json().catch(() => ({}))) as { id?: string; error?: string; veredicto?: string | null; score?: number | null };
        // Listo: InformeEnLaVuelta lo abre en su lugar; si con los datos de hoy salió otro veredicto, lo dice primero.
        if (res.ok && d.id) { setInforme(informeListo(paso0, { id: d.id, ruta: `/analisis/${d.id}`, veredicto: d.veredicto ?? null, score: d.score ?? null })); return; }
        if (d.error === "sin-creditos" && sinCredito++ < REINTENTOS_CREDITO_RETORNO) { await esperar(ESPERA_GENERAR_MS); continue; }
        if (res.status === 410 && d.error === "despublicado") { fallar("despublicado"); return; }
        if (d.error === "combinacion") { fallar("fuera"); return; }
        fallar("error");
        return;
      } catch {
        fallar("error");
        return;
      }
    }
    // Doce vueltas ocupadas o sin el crédito: no salió.
    fallar("error");
  }

  useEffect(() => {
    if (type === "subscription") {
      // Registrar la tarjeta no es pagar (05-nov-2026): la pantalla dice lo que register-callback comprobó
      // (lib/subscriptions/suscripcion.ts › estadoRetornoSuscripcion), nunca «Pago confirmado».
      const success = estadoRetornoSuscripcion(statusParam) === "registrada";
      setPaymentStatus("suscripcion");
      // Meta Pixel: Subscribe browser-side. event_id sub-<subscriptionId> → dedup con
      // el Subscribe server-side (payment-callback / cron reconciler, solo primer
      // cobro). sub/val vienen del redirect de register-callback.
      //
      // OJO con el `value`: acá es el PRECIO DE CATÁLOGO del plan, no el monto que
      // cobró Flow. No es un descuido — este evento se dispara en el ALTA, cuando
      // todavía no ocurrió ningún cargo, así que el monto real no existe aún. El
      // server manda el monto real cuando llega el primer cobro. Meta se queda con el
      // PRIMER evento que recibe para un event_id dado y el browser casi siempre gana
      // la carrera (el redirect es inmediato; el cargo llega después) → en la práctica
      // Meta registra el precio de catálogo. Hoy coinciden.
      //
      // REAPERTURA: si aparece prorrateo, cupón o descuento, el fix es que
      // register-callback deje de mandar `val` y el server quede como única fuente de
      // value — no que el browser intente adivinarlo. Ver la nota gemela allá.
      if (success) {
        const sub = searchParams.get("sub");
        const val = searchParams.get("val");
        if (sub) {
          const value = val ? Number(val) : undefined;
          // Desde el 15-oct-2026 también Purchase (la campaña se optimiza hacia compra), los dos con el id del
          // servidor (`idCompraPlan`). La cola del pixel los guarda hasta que cargue: antes, este Subscribe se perdía
          // siempre (el pixel carga con la página quieta y esto corre al montar).
          for (const evento of [EVENTOS_META.compra, EVENTOS_META.suscripcion]) {
            metaTrack(evento, Number.isFinite(value) ? { value, currency: "CLP" } : undefined, idCompraPlan(sub));
          }
        }
      }
      return;
    }

    // Check payment status
    const checkStatus = async () => {
      try {
        // Con order → identifica la compra exacta. Sin order (fallback legacy o
        // compras viejas sin el param) → status cae al "último pago del user".
        const firma = llavePago ? `&t=${encodeURIComponent(llavePago.firma)}` : "";
        const res = await fetch(order ? `/api/payments/status?order=${encodeURIComponent(order)}${firma}` : "/api/payments/status");
        // «Lo que sigue» (28-sep-2026): el pack se paga desde el ticket SIN sesión (la cuenta se crea con
        // el correo). Flow vuelve acá sin sesión. Con la firma del pago (02-oct-2026) el servidor responde
        // igual; sin ella, 401: la pantalla no sabe si el pago pasó y pide entrar, sin afirmar nada.
        if (res.status === 401) {
          setPaymentStatus("sin_sesion");
          return;
        }
        const data = await res.json();
        // Con la sesión de OTRA cuenta (02-oct-2026): se dice, en vez de quedarse cargando.
        if (data.otraCuenta) {
          setPaymentStatus("otra_cuenta");
          return;
        }
        if (data.payment) {
          setAnalysisId(data.payment.analysis_id);
          setProducto(typeof data.payment.product === "string" ? data.payment.product : null);
          setDatosPago((data.payment.payment_data as { origen?: string; variante?: string; companion_str_id?: string } | null) ?? null);
          const vuelta = volverSeguro((data.payment.payment_data as { volver?: unknown } | null)?.volver);
          setVolver(vuelta);
          setPackInfo(leerRetornoPackDelPago(data.retornoPack));
          setConSesion(!data.sinSesion);
          setSaldo(typeof data.saldo === "number" && !data.ilimitado ? data.saldo : null);
          const estado = estadoDelPago(data.payment.status);
          if (estado === "paid") {
            // `pro_purchased` se retiró (28-sep-2026): el pago se mide desde el servidor con
            // `pago_confirmado` (medicion-pago.ts), que no depende de que esta página lo vea.
            // Meta Pixel: Purchase browser-side, el ESPEJO del servidor (15-oct-2026): mismo evento y mismo id
            // (commerce_order) que manda payments/confirm; sin espejo si la cuenta es de prueba o no cobró.
            espejarMeta(data.metaCompra ? [data.metaCompra as EventoEspejo] : []);
            setPaymentStatus("paid");
            // Single con análisis atado → llevar directo a la vista del análisis
            // comprado (la ruta auto-redirige a renta-corta si es STR). El push
            // va DENTRO de la rama paid: nunca antes de la confirmación, para no
            // aterrizar en un análisis aún bloqueado. Otros productos (pack
            // suelto, sin analysis_id) caen a la pantalla genérica con CTA.
            //
            // AMBAS pre-pago: si el pago trae un STR companion en payment_data,
            // el analysis_id es el LTR → ruteamos a la comparativa con ambos ids.
            const companionStrId = (data.payment.payment_data as { companion_str_id?: string } | null)?.companion_str_id;
            // Fase D unlock: analysis_id es el hijo que se abrió → volvemos ahí
            // (ya desbloqueado; la ruta auto-redirige a renta-corta si es STR).
            if (
              !redirectedRef.current &&
              data.payment.analysis_id &&
              (data.payment.product === "single" || data.payment.product === "unlock")
            ) {
              redirectedRef.current = true;
              setRedirecting(true);
              if (data.payment.product === "single" && companionStrId) {
                abrirDestino(`/analisis/comparativa?ltr=${data.payment.analysis_id}&str=${companionStrId}`);
              } else if (data.payment.product === "unlock") {
                // Fase D (decisión B): el unlock desbloqueó los DOS informes →
                // volvemos a la comparativa. Resolvemos ltr/str por ambas_group_id
                // (fuente canónica: filas `analisis` por ambas_role). Fallback
                // EXACTO al hijo abierto si falta cualquier id (o falla la query).
                let target = `/analisis/${data.payment.analysis_id}`;
                try {
                  const supa = createClient();
                  const { data: child } = await supa
                    .from("analisis")
                    .select("ambas_group_id")
                    .eq("id", data.payment.analysis_id)
                    .maybeSingle();
                  const groupId = (child as { ambas_group_id?: string } | null)?.ambas_group_id;
                  if (groupId) {
                    const { data: rows } = await supa
                      .from("analisis")
                      .select("id, ambas_role")
                      .eq("ambas_group_id", groupId);
                    const ltrId = rows?.find((r) => r.ambas_role === "ltr")?.id;
                    const strId = rows?.find((r) => r.ambas_role === "str")?.id;
                    if (ltrId && strId) target = `/analisis/comparativa?ltr=${ltrId}&str=${strId}`;
                  }
                } catch {
                  /* fallback al hijo abierto (comportamiento previo) */
                }
                abrirDestino(target);
              } else {
                abrirDestino(`/analisis/${data.payment.analysis_id}`);
              }
            } else {
              const depto = leerDeptoDelPago(data.depto);
              if (!redirectedRef.current && !data.payment.analysis_id && depto) {
                redirectedRef.current = true;
                setRedirecting(true);
                setAlDepto(depto);
                void generarDepto(depto);
              }
            }
          } else if (estado === "error") {
            setPaymentStatus("error");
          } else {
            setPaymentStatus("pending");
            // Retry after 3 seconds
            setTimeout(checkStatus, 3000);
          }
        } else {
          setPaymentStatus("pending");
          setTimeout(checkStatus, 3000);
        }
      } catch {
        // La consulta falló: no se sabe si se cobró (05-nov-2026). Antes caía en «El pago no pasó. … No se hizo ningún cargo.»
        setPaymentStatus("sin_confirmar");
      }
    };

    checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, statusParam, order, router, searchParams]);

  // Adónde vuelve quien entra con su correo: a esta misma pantalla si es el pack (verá su saldo y la guía);
  // si no, al dashboard.
  const volverAca = typeof window === "undefined" ? "/dashboard" : window.location.pathname + window.location.search;
  const nextEntrar = hrefEntrar(retornoPack ? volverAca : "/dashboard", "pack");
  const [saliendo, setSaliendo] = useState(false);
  async function entrarConOtroCorreo() {
    setSaliendo(true);
    try { await createClient().auth.signOut(); } catch { /* sin sesión: igual a entrar */ }
    iniciarCarga(claveActual());
    window.location.assign(hrefEntrar(volverAca, "pack"));
  }

  // EL BOTÓN DE LA VUELTA (19-oct-2026, decisión de Fabrizio): uno solo. Si pagó, «Ver mis análisis» (o de vuelta a los
  // deptos si la compra salió de la página semanal); con un análisis atado, ese análisis. Si no pasó, «Reintentar»: la
  // misma pantalla de compra, con lo que la compra traía (lib/compra/compra.ts).
  // La vuelta (`volver`) solo la traen el pack de tres y, desde el 21-oct-2026, el pack y el suelto comprados desde un depto.
  const tras = analysisId && producto !== PRODUCTO_TRES
    ? { texto: "Ver mi análisis", href: `/analisis/${analysisId}` }
    : botonTrasPagar(volver);
  const reintentar = rutaReintentar({
    suscripcion: type === "subscription",
    producto,
    analysisId,
    companionStrId: datosPago?.companion_str_id ?? null,
    origen: datosPago?.origen ?? null,
    variante: datosPago?.variante ?? null,
    volver,
  });
  const girando = <div className="mb-5 h-8 w-8 animate-spin rounded-full border-2 border-[var(--franco-border)] border-t-[var(--franco-text)]" aria-hidden="true" />;
  // El pack pagado, con lo que el estado del pago dijo de su informe.
  const packPagado = retornoPack && paymentStatus === "paid" ? packInfo : null;
  // La guía después de pagar el pack del informe necesita ancho; todo lo demás va en la columna de la casa.
  const ancha = !!retornoPack && paymentStatus === "paid";

  return (
    <div className="flex min-h-screen flex-col bg-[var(--franco-bg)] text-[var(--franco-text)]">
      <HeaderFranco />
      <main className={ancha ? "mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-8" : PLANO.main} style={{ fontFamily: UI_PLANO }} data-retorno={paymentStatus}>
        {(paymentStatus === "loading" || paymentStatus === "pending") && !redirecting && !demora && (
          <div>
            {girando}
            <h1 className={PLANO.titulo}>{RETORNO.procesando.titulo}</h1>
            <p className={PLANO.bajada}>{RETORNO.procesando.cuerpo}</p>
          </div>
        )}
        {(paymentStatus === "loading" || paymentStatus === "pending") && !redirecting && demora && (
          <div data-retorno-estado="demora">
            <h1 className={PLANO.titulo}>{DEMORA_PAGO.titulo}</h1>
            <p className={PLANO.bajada}>{DEMORA_PAGO.cuerpo}</p>
            <div className={PLANO.seccion}>
              <EnlaceCarga href={tras.href} className={PLANO.principal} data-retorno-boton="volver">{DEMORA_PAGO.volver}</EnlaceCarga>
            </div>
          </div>
        )}
        {paymentStatus === "sin_confirmar" && (
          <div data-retorno-estado="sin-confirmar">
            <h1 className={PLANO.titulo}>{PAGO_SIN_CONFIRMAR.titulo}</h1>
            <p className={PLANO.bajada}>{PAGO_SIN_CONFIRMAR.cuerpo}</p>
            <div className={PLANO.seccion}>
              <EnlaceCarga href={tras.href} className={PLANO.principal} data-retorno-boton="volver">{PAGO_SIN_CONFIRMAR.volver}</EnlaceCarga>
            </div>
          </div>
        )}
        {paymentStatus === "suscripcion" && estadoSuscripcion && (
          <div data-retorno-suscripcion={estadoSuscripcion}>
            <h1 className={PLANO.titulo}>{RETORNO_SUSCRIPCION[estadoSuscripcion].titulo}</h1>
            <p className={PLANO.bajada}>{RETORNO_SUSCRIPCION[estadoSuscripcion].cuerpo}</p>
            <div className={PLANO.seccion}>
              {estadoSuscripcion === "noRegistrada" || estadoSuscripcion === "sinPlan" ? (
                <EnlaceCarga href={reintentar} className={PLANO.principal} data-retorno-boton="reintentar">{RETORNO.reintentar}</EnlaceCarga>
              ) : (
                <EnlaceCarga href="/cuenta" className={PLANO.principal} data-retorno-boton="cuenta">{RETORNO_SUSCRIPCION.boton}</EnlaceCarga>
              )}
            </div>
          </div>
        )}

        {redirecting && (
          <div>
            {!alDepto && girando}
            <h1 className={PLANO.titulo}>{RETORNO.abriendo.titulo}</h1>
            {alDepto && informe ? (
              // PAGO CONFIRMADO DESDE UN DEPTO (24-oct-2026, mockup C; 03-nov-2026, el informe en camino): el depto en negrita, la
              // barra y cuántos le quedan; y lo que pase con el informe, acá mismo.
              <InformeEnLaVuelta paso={informe} saldo={saldo} alReintentar={() => void generarDepto(alDepto)} />
            ) : (
              <>
                <p className={PLANO.bajada}>{RETORNO.abriendo.cuerpo}</p>
                {destino && conAbrir && (
                  <div className={PLANO.seccion}>
                    <a href={destino} className={PLANO.principal} data-informe="abrir">{INFORME_COPY.abrir}</a>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Después de pagar el pack, UNA idea (01-oct-2026): donde hay guía (renta larga, el mismo predicado
            que la línea del ticket que la promete), «Tienes 3 análisis. Empieza por estos.» con la guía; si
            el informe no tiene guía, o en renta corta, «Tienes 3 análisis.» con el próximo análisis. */}
        {/* 02-oct-2026: solo con el pago VERIFICADO (con sesión, o sin ella con la firma), y con el saldo
            real. Sin sesión ni firma, la pantalla de entrar (abajo), sin «Tienes 3 análisis». */}
        {/* 22-oct-2026: el informe, el veredicto y la modalidad del pack vienen con el estado del pago (`packPagado`). */}
        {packPagado && (
          hayGuia(packPagado.modalidad) ? (
            <GuiaBusqueda
              analysisId={packPagado.analysisId}
              veredicto={packPagado.veredicto}
              conSesion={conSesion}
              saldo={saldo}
              pago={llavePago}
              sinGuia={<DespuesDePagar analysisId={packPagado.analysisId} veredicto={packPagado.veredicto} modalidad={packPagado.modalidad} conSesion={conSesion} saldo={saldo} />}
            />
          ) : (
            <DespuesDePagar analysisId={packPagado.analysisId} veredicto={packPagado.veredicto} modalidad={packPagado.modalidad} conSesion={conSesion} saldo={saldo} />
          )
        )}
        {/* «¿Cuándo piensas comprar?», discreto, debajo (02-oct-2026): con sesión o con la firma del pago. */}
        {packPagado && (conSesion || llavePago) && (
          <HorizontePostPago ctx={{ analysisId: packPagado.analysisId, veredicto: packPagado.veredicto, modalidad: packPagado.modalidad }} pago={llavePago} />
        )}

        {!retornoPack && paymentStatus === "paid" && !redirecting && (
          <div data-retorno-estado="pagado">
            <h1 className={PLANO.titulo}>{RETORNO.pagado.titulo}</h1>
            <p className={PLANO.bajada}>
              {/* La suscripción ya no llega acá (05-nov-2026): registrar la tarjeta no es pagar; su vuelta es el bloque de arriba. */}
              {producto === PRODUCTO_TRES || producto === PRODUCTO_PACK
                ? TRES_COPY.listo
                : analysisId ? "Tu análisis está desbloqueado." : RETORNO.pagado.uno
              }
            </p>
            <div className={PLANO.seccion}>
              <EnlaceCarga href={tras.href} className={PLANO.principal} data-tres={producto === PRODUCTO_TRES ? "seguir" : undefined} data-retorno-boton="pagado">
                {tras.texto}
              </EnlaceCarga>
            </div>
          </div>
        )}

        {paymentStatus === "sin_sesion" && (
          <div data-lqs="retorno-sin-sesion">
            <h1 className={PLANO.titulo}>{RETORNO_SIN_SESION.titulo}</h1>
            <p className={PLANO.bajada}>{RETORNO_SIN_SESION.cuerpo}</p>
            <div className={PLANO.seccion}>
              <EnlaceCarga href={nextEntrar} className={PLANO.principal}>{RETORNO_SIN_SESION.boton}</EnlaceCarga>
            </div>
          </div>
        )}
        {paymentStatus === "otra_cuenta" && (
          <div data-lqs="retorno-otra-cuenta">
            <h1 className={PLANO.titulo}>{PAGO_OTRA_CUENTA.titulo}</h1>
            <p className={PLANO.bajada}>{PAGO_OTRA_CUENTA.cuerpo}</p>
            <div className={PLANO.seccion}>
              <button type="button" onClick={entrarConOtroCorreo} disabled={saliendo} {...botonOcupado(saliendo)} className={PLANO.principal}>{PAGO_OTRA_CUENTA.boton}</button>
            </div>
          </div>
        )}
        {paymentStatus === "error" && retornoPack && (
          <div data-lqs="retorno-pack-no-paso">
            <h1 className={PLANO.titulo}>{PAGO_PACK_NO_PASO.titulo}</h1>
            <p className={PLANO.bajada}>{PAGO_PACK_NO_PASO.cuerpo}</p>
            <div className={PLANO.seccion}>
              <EnlaceCarga href={!packInfo ? "/dashboard" : packInfo.modalidad === "str" ? `/analisis/renta-corta/${packInfo.analysisId}` : `/analisis/${packInfo.analysisId}`} className={PLANO.principal}>
                {PAGO_PACK_NO_PASO.volver}
              </EnlaceCarga>
            </div>
          </div>
        )}
        {paymentStatus === "error" && !retornoPack && (
          <div data-retorno-estado="rechazado">
            <h1 className={PLANO.titulo}>{RETORNO.rechazado.titulo}</h1>
            <p className={PLANO.bajada}>{RETORNO.rechazado.cuerpo}</p>
            <div className={PLANO.seccion}>
              <EnlaceCarga href={reintentar} className={PLANO.principal} data-retorno-boton="reintentar">{RETORNO.reintentar}</EnlaceCarga>
            </div>
          </div>
        )}

        {!ancha && <p className={`mt-6 ${PLANO.nota}`}>{RETORNO.pie}</p>}
      </main>
      <AppFooter variant="informe" />
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[var(--franco-bg)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--franco-border)] border-t-[var(--franco-text)]" />
      </div>
    }>
      <PaymentReturnContent />
    </Suspense>
  );
}
