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
import { claveActual, iniciarCarga } from "@/lib/carga-global";
import { usePostHog } from "@/lib/posthog-react";
import { createClient } from "@/lib/supabase/client";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { IconoGoogle } from "@/components/entrar/IconoGoogle";
import { useEntradaPorCodigo } from "@/components/entrar/useEntradaPorCodigo";
import { PLANO } from "@/components/plano/plano";
import { metaTrack } from "@/lib/meta/pixel";
import { CODIGO_MAX } from "@/lib/lo-que-sigue/codigo";
import { diaVencimiento, horaVencimiento, VENTANA_PACK_MS } from "@/lib/lo-que-sigue/oferta-pack";
import { CHECKOUT_PACK } from "@/lib/lo-que-sigue/copy";
import { COMPRA, urlCompra, type ResumenCompra } from "@/lib/compra/compra";

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

  // El pack de 24 horas: la vigencia la dice el servidor. null = todavía no se sabe.
  const [oferta, setOferta] = useState<{ vigente: boolean; venceAt: string } | null>(null);
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

  async function otraCuenta() {
    try { await createClient().auth.signOut(); } catch { /* sin sesión: igual */ }
    window.location.assign(urlCompra(estaCompra));
  }

  const botonPagar = loading ? COMPRA.yendo : COMPRA.pagar(product.precio);
  const errorVisible = error ?? entrada.error;

  return (
    <div data-compra={productKey}>
      <EnlaceCarga href={props.volverHref} className={`${PLANO.nota} no-underline hover:text-[var(--franco-text)]`} data-compra="volver">
        ← {props.volverHref === "/pricing" ? COMPRA.volverPlanes : COMPRA.volver}
      </EnlaceCarga>
      <h1 className={`mt-5 ${PLANO.titulo}`} data-compra="producto">{product.nombre}</h1>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2" data-compra="precio">
        <span className="text-[34px] font-bold leading-none tracking-[-0.02em] tabular-nums text-[var(--franco-text)]">{product.precio}</span>
        <span className="text-[14px] text-[var(--franco-text-secondary)]">{product.unidad}</span>
      </p>
      <p className={PLANO.bajada} data-compra="incluye">{product.incluye}</p>
      {esPack && packCreadoAt && (
        <p className={`mt-2 text-[14px] ${packVencido ? "text-[var(--signal-red)]" : "text-[var(--franco-text)]"}`} data-lqs="checkout-vence">
          {packVencido ? CHECKOUT_PACK.vencido : CHECKOUT_PACK.vence(diaVencimiento(packCreadoAt), horaVencimiento(packCreadoAt))}
        </p>
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
              data-presionado={loading ? "1" : undefined}
              className={PLANO.principal}
              data-compra="pagar"
            >
              {botonPagar}
            </button>
            {error && <p className={PLANO.error} role="alert">{error}</p>}
            <p className={PLANO.nota}>
              {COMPRA.noEsTuCorreo}{" "}
              <button type="button" className={PLANO.enlace} onClick={otraCuenta}>{COMPRA.otroCorreo}</button>
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
            <button type="submit" className={PLANO.principal} disabled={entrada.ocupado || loading || packVencido} data-presionado={loading ? "1" : undefined} data-compra="pagar">
              {botonPagar}
            </button>
            {errorVisible && <p className={PLANO.error} role="alert">{errorVisible}</p>}
            {entrada.reenviado && !errorVisible && <p className={PLANO.nota} role="status">{COMPRA.reenviado}</p>}
            <p className={PLANO.nota}>
              {COMPRA.noLlego}{" "}
              <button type="button" className={PLANO.enlace} onClick={entrada.mandarDeNuevo} disabled={entrada.ocupado}>{COMPRA.mandarDeNuevo}</button>
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
            <button type="submit" className={PLANO.principal} disabled={entrada.ocupado || packVencido} data-compra="pagar">
              {COMPRA.pagar(product.precio)}
            </button>
            {entrada.error && <p className={PLANO.error} role="alert">{entrada.error}</p>}
            <button type="button" onClick={entrada.conGoogle} className={PLANO.secundario} disabled={packVencido} data-compra="google">
              <span className={PLANO.iconoGoogle}><IconoGoogle /></span> {COMPRA.google}
            </button>
          </form>
        )}
      </div>

      <p className={`mt-6 ${PLANO.nota}`} data-compra="pie">{COMPRA.pie}</p>
    </div>
  );
}
