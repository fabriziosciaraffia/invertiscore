"use client";

// ─────────────────────────────────────────────────────────────────────────────
// La pantalla de compra (19-oct-2026; ver page.tsx). Tres estados, una sola pantalla:
//   · con sesión — el correo puesto (solo lectura) y «Pagar $19.990», que va directo a Flow;
//   · sin sesión — el correo, «Pagar $19.990» (manda el código) y «o con Google»;
//   · el código — en la misma pantalla; «Pagar $19.990» lo confirma y va directo a Flow.
// El enlace del correo y Google vuelven acá con `pagar=1`: con la sesión puesta, la pantalla sigue sola a Flow. La lógica
// del código es la de /entrar (useEntradaPorCodigo): la cuenta nace o entra igual, y se reclama lo anónimo.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type FormEvent } from "react";
import { botonOcupado, claveActual, iniciarCarga } from "@/lib/carga-global";
import { usePostHog } from "@/lib/posthog-react";
import { createClient } from "@/lib/supabase/client";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { IconoGoogle } from "@/components/entrar/IconoGoogle";
import { useEntradaPorCodigo } from "@/components/entrar/useEntradaPorCodigo";
import { PLANO } from "@/components/plano/plano";
import { metaTrack } from "@/lib/meta/pixel";
import { CODIGO_MAX } from "@/lib/lo-que-sigue/codigo";
import { cuandoVenceCorto, VENTANA_PACK_MS } from "@/lib/lo-que-sigue/oferta-pack";
import { fmtCLP } from "@/lib/pricing";
import { CHECKOUT_PACK } from "@/lib/lo-que-sigue/copy";
import { COMPRA, urlCompra, type ResumenCompra } from "@/lib/compra/compra";
import { COMPRA_DEPTO } from "@/lib/guia/compra-desde-depto";
import { TRES_PRECIO_CLP } from "@/lib/tres-analisis";

export function CompraCliente(props: {
  productKey: string;
  resumen: ResumenCompra;
  analysisId: string | null;
  companionStrId: string | null;
  origen: string | null;
  varianteCorreo: string | null;
  volver: string | null;
  esTres: boolean;
  esPack: boolean;
  /** El ticket de la cuenta nueva (21-oct-2026): el pack sin informe atado, con su vigencia dicha por el servidor. */
  packCuenta?: { vigente: boolean; venceAt: string } | null;
  /** El depto que se compra para analizar, si la compra salió de uno de la selección. */
  depto?: string | null;
  sesionEmail: string | null;
  conPlan: boolean;
  pagarAlEntrar: boolean;
  volverHref: string;
}) {
  const { productKey, resumen: product, analysisId, companionStrId, origen, varianteCorreo, volver, esTres, esPack } = props;
  const posthog = usePostHog();
  const estaCompra = { product: productKey, analysisId, companionStrId, origen, variante: varianteCorreo, volver };
  // El enlace del correo y Google vuelven a esta misma compra, con `pagar=1`.
  const entrada = useEntradaPorCodigo(urlCompra(estaCompra, true));
  const [sesion, setSesion] = useState<string | null>(props.sesionEmail);

  // El pack de 24 horas: la vigencia la dice el servidor. null = todavía no se sabe. El de la cuenta nueva ya llega dicho.
  const [oferta, setOferta] = useState<{ vigente: boolean; venceAt: string } | null>(props.packCuenta ?? null);
  useEffect(() => {
    if (!esPack || !analysisId) return;
    let alive = true;
    fetch(`/api/lo-que-sigue/oferta?analysisId=${encodeURIComponent(analysisId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d && typeof d.vigente === "boolean") setOferta({ vigente: d.vigente, venceAt: d.venceAt }); })
      .catch(() => { /* sin dato, el botón sigue: el servidor rechaza si venció */ });
    return () => { alive = false; };
  }, [esPack, analysisId]);
  const packVencido = esPack && oferta !== null && !oferta.vigente;
  const packCreadoAt = oferta ? new Date(new Date(oferta.venceAt).getTime() - VENTANA_PACK_MS) : null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const yaTienePlan = props.conPlan && !product.unico;

  async function handlePay() {
    setLoading(true);
    setError(null);
    // Lo que tarda se ve cargando: botón presionado y barra del header hasta que Flow responde;
    // si responde con la URL, la página se descarga con la barra encendida.
    const soltar = iniciarCarga(claveActual());
    try {
      const body: Record<string, string> = { product: productKey };
      // analysisId solo aplica al pago único atado a un análisis: desbloquea ese análisis (y su par AMBAS).
      if (analysisId && product.unico && !esTres) {
        body.analysisId = analysisId;
        if (companionStrId) body.companionStrId = companionStrId;
      }
      if (product.unico) body.quantity = "1";
      if (origen) body.origen = origen;
      if (varianteCorreo) body.variante = varianteCorreo;
      if (volver) body.volver = volver;

      const res = await fetch(product.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.url) {
        posthog?.capture("payment_initiated", { product: productKey, amount: product.monto, quantity: 1 });
        // Meta Pixel: InitiateCheckout antes de ir a Flow (browser-only, sin event_id: no requiere dedup con CAPI).
        metaTrack("InitiateCheckout", { value: product.monto, currency: "CLP" });
        window.location.href = data.url;
      } else {
        // Sin sesión (venció entre que cargó y se tocó): vuelve el campo del correo, sin un error que no se entiende.
        if (res.status === 401) setSesion(null);
        else setError(res.status === 410 ? CHECKOUT_PACK.vencido : data?.details || data?.error || COMPRA.errorPago);
        soltar();
        setLoading(false);
      }
    } catch {
      setError(COMPRA.errorConexion);
      soltar();
      setLoading(false);
    }
  }

  // El código confirmado ya es sesión: la pantalla queda «con sesión» y va directo a Flow.
  async function pagarConCodigo(ev: FormEvent) {
    if (!(await entrada.verificar(ev))) return;
    setSesion(entrada.enviado);
    await handlePay();
  }

  // De vuelta del enlace del correo o de Google, con la sesión puesta: sigue sola a Flow, una vez.
  const siguioSola = useRef(false);
  useEffect(() => {
    if (!props.pagarAlEntrar || !sesion || siguioSola.current || yaTienePlan) return;
    if (esPack && (oferta === null || !oferta.vigente)) return;
    siguioSola.current = true;
    window.history.replaceState(null, "", urlCompra(estaCompra));
    void handlePay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.pagarAlEntrar, sesion, oferta, yaTienePlan, esPack]);

  // «¿No es tu correo?» cierra la sesión y recarga la compra: el enlace queda ocupado y la barra encendida (22-oct-2026).
  const [saliendo, setSaliendo] = useState(false);
  async function otraCuenta() {
    setSaliendo(true);
    try { await createClient().auth.signOut(); } catch { /* sin sesión: igual */ }
    iniciarCarga(claveActual());
    window.location.assign(urlCompra(estaCompra));
  }

  const botonPagar = loading ? COMPRA.yendo : COMPRA.pagar(product.precio);
  const errorVisible = error ?? entrada.error;

  return (
    <div data-compra={productKey}>
      <EnlaceCarga href={props.volverHref} className={`${PLANO.nota} no-underline hover:text-[var(--franco-text)]`} data-compra="volver">
        ← {props.volverHref === "/pricing" ? COMPRA.volverPlanes : COMPRA.volver}
      </EnlaceCarga>
      {/* EL TICKET COMO OFERTA (24-oct-2026, mockup B de 4-ticket-y-popups.html): con el pack del ticket vivo, arriba «Solo para
          cuentas nuevas» y «Vence mañana 11:17»; el precio con el de tres tachado; y el depto que se va a analizar en la frase. */}
      {esPack && packCreadoAt && !packVencido && (
        <p className="mt-5 flex items-center justify-between gap-3" data-compra="ticket">
          <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--signal-red)]">{CHECKOUT_PACK.soloNuevas}</span>
          <span className="rounded-full border border-[var(--signal-red)] px-2.5 py-[3px] text-[11px] font-semibold text-[var(--signal-red)]" data-compra="vence">{CHECKOUT_PACK.venceCorto(cuandoVenceCorto(packCreadoAt))}</span>
        </p>
      )}
      <h1 className={`${esPack && packCreadoAt && !packVencido ? "mt-3" : "mt-5"} ${PLANO.titulo}`} data-compra="producto">{product.nombre}</h1>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2" data-compra="precio">
        <span className="text-[34px] font-bold leading-none tracking-[-0.02em] tabular-nums text-[var(--franco-text)]">{product.precio}</span>
        {esPack && packCreadoAt && !packVencido && <span className="text-[15px] text-[var(--franco-text-secondary)] line-through tabular-nums" data-compra="tachado">{fmtCLP(TRES_PRECIO_CLP)}</span>}
        <span className="text-[14px] text-[var(--franco-text-secondary)]">{product.unidad}</span>
      </p>
      <p className={PLANO.bajada} data-compra="incluye">
        {product.incluye}
        {props.depto && (esPack || esTres) && <> {CHECKOUT_PACK.primeroAlPagar.antes}<b className="text-[var(--franco-text)]" data-compra="depto">{props.depto}</b>{CHECKOUT_PACK.primeroAlPagar.despues}</>}
      </p>
      {props.depto && !(esPack || esTres) && (
        <p className="mt-2 text-[14px] text-[var(--franco-text)]" data-compra="depto">
          {COMPRA_DEPTO.paraDepto} <b>{props.depto}</b>
        </p>
      )}
      {esPack && packCreadoAt && packVencido && (
        <p className="mt-2 text-[14px] text-[var(--signal-red)]" data-lqs="checkout-vence">{CHECKOUT_PACK.vencido}</p>
      )}

      <div className={PLANO.seccion}>
        {yaTienePlan ? (
          <div data-compra="ya-plan">
            <p className="m-0 text-[15px] text-[var(--franco-text)]">{COMPRA.yaPlan}</p>
            <EnlaceCarga href="/cuenta" className={`mt-4 ${PLANO.principal}`}>{COMPRA.verCuenta}</EnlaceCarga>
          </div>
        ) : sesion ? (
          <div className="flex flex-col gap-3" data-compra="con-sesion">
            <div>
              <label htmlFor="compra-correo" className={PLANO.label}>{COMPRA.correo}</label>
              <input id="compra-correo" type="email" readOnly value={sesion} className={PLANO.campo} />
            </div>
            <button
              type="button"
              onClick={handlePay}
              disabled={loading || packVencido}
              {...botonOcupado(loading)}
              className={PLANO.principal}
              data-compra="pagar"
            >
              {botonPagar}
            </button>
            {error && <p className={PLANO.error} role="alert">{error}</p>}
            <p className={PLANO.nota}>
              {COMPRA.noEsTuCorreo}{" "}
              <button type="button" className={PLANO.enlace} onClick={otraCuenta} disabled={saliendo} {...botonOcupado(saliendo)}>{COMPRA.otroCorreo}</button>
            </p>
          </div>
        ) : entrada.enviado ? (
          <form className="flex flex-col gap-3" onSubmit={pagarConCodigo} noValidate data-compra="codigo">
            <p className="m-0 text-[15px] leading-[1.5] text-[var(--franco-text-secondary)]">{COMPRA.codigo(entrada.enviado)}</p>
            <input
              ref={entrada.campoCodigo}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={CODIGO_MAX}
              placeholder={COMPRA.placeholderCodigo}
              aria-label="Código"
              className={`${PLANO.campo} text-[18px] tracking-[0.2em] placeholder:tracking-normal`}
              value={entrada.codigo}
              onChange={(x) => entrada.setCodigo(x.target.value)}
            />
            <button type="submit" className={PLANO.principal} disabled={entrada.ocupado || loading || packVencido} {...botonOcupado(loading || entrada.ocupadoEn === "verificar")} data-compra="pagar">
              {botonPagar}
            </button>
            {errorVisible && <p className={PLANO.error} role="alert">{errorVisible}</p>}
            {entrada.reenviado && !errorVisible && <p className={PLANO.nota} role="status">{COMPRA.reenviado}</p>}
            <p className={PLANO.nota}>
              {COMPRA.noLlego}{" "}
              <button type="button" className={PLANO.enlace} onClick={entrada.mandarDeNuevo} disabled={entrada.ocupado} {...botonOcupado(entrada.ocupadoEn === "reenviar")}>{COMPRA.mandarDeNuevo}</button>
              {" · "}
              <button type="button" className={PLANO.enlace} onClick={entrada.usarOtroCorreo}>{COMPRA.otroCorreo}</button>
            </p>
          </form>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={entrada.enviarCodigo} noValidate data-compra="correo">
            <div>
              <label htmlFor="compra-correo" className={PLANO.label}>{COMPRA.correo}</label>
              <input
                id="compra-correo"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={COMPRA.placeholderCorreo}
                className={PLANO.campo}
                value={entrada.correo}
                onChange={(x) => entrada.setCorreo(x.target.value)}
              />
            </div>
            <button type="submit" className={PLANO.principal} disabled={entrada.ocupado || packVencido} {...botonOcupado(entrada.ocupadoEn === "enviar")} data-compra="pagar">
              {COMPRA.pagar(product.precio)}
            </button>
            {entrada.error && <p className={PLANO.error} role="alert">{entrada.error}</p>}
            <button type="button" onClick={entrada.conGoogle} className={PLANO.secundario} disabled={packVencido || entrada.ocupado} {...botonOcupado(entrada.ocupadoEn === "google")} data-compra="google">
              <span className={PLANO.iconoGoogle}><IconoGoogle /></span> {COMPRA.google}
            </button>
          </form>
        )}
      </div>

      <p className={`mt-6 ${PLANO.nota}`} data-compra="pie">{COMPRA.pie}</p>
    </div>
  );
}
