"use client";

// ─────────────────────────────────────────────────────────────────────────────
// El registro en un paso, dentro de una tarjeta de la guía (01-oct-2026): quien pagó el pack SIN cuenta
// toca «Analizar este» y escribe acá mismo el correo del pago y el código que le llega; al entrar, el
// informe se genera sin salir de la pantalla. Las mismas llamadas y los mismos eventos que el registro
// en un paso del informe (RegistroUnPaso): `signInWithOtp` → `verifyOtp({ type: "email" })` → reclamar lo
// anónimo → registro_completado {via: correo, como: codigo}. En papel (tokens del chrome), no sobre el
// material.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePostHog } from "@/lib/posthog-react";
import { emitirAuthCompletada, reclamarAnalisisAnonimos } from "@/lib/auth-analytics";
import { REGISTRO_UN_PASO } from "@/lib/lo-que-sigue/copy";
import { CODIGO_MAX, codigoValido, limpiarCodigo } from "@/lib/lo-que-sigue/codigo";
import { capturarLqs, consumirRegistroPendiente, EVENTOS_LQS, marcarRegistroPendiente, type ContextoLqs } from "@/lib/lo-que-sigue/eventos";
import { GUIA } from "@/lib/guia/copy";

const CORREO_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function RegistroEnTarjeta({ ctx, next, alEntrar }: { ctx: ContextoLqs; next: string; alEntrar: () => void }) {
  const posthog = usePostHog();
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviado, setEnviado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => { campo.current?.focus(); }, [enviado]);

  async function enviarCodigo(e: FormEvent) {
    e.preventDefault();
    const c = correo.trim().toLowerCase();
    if (!CORREO_OK.test(c)) { setError(REGISTRO_UN_PASO.errorCorreo); return; }
    setError(null);
    setOcupado(true);
    capturarLqs(posthog, EVENTOS_LQS.registroIniciado, ctx, { via: "correo", donde: "guia" });
    marcarRegistroPendiente("correo", ctx);
    const { error: err } = await createClient().auth.signInWithOtp({
      email: c,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
    });
    setOcupado(false);
    if (err) { setError(REGISTRO_UN_PASO.errorEnvio); return; }
    setEnviado(c);
  }

  async function entrar(e: FormEvent) {
    e.preventDefault();
    const t = codigo.replace(/\D/g, "");
    if (!codigoValido(t) || !enviado) { setError(REGISTRO_UN_PASO.errorCodigo); return; }
    setError(null);
    setOcupado(true);
    const { error: err } = await createClient().auth.verifyOtp({ email: enviado, token: t, type: "email" });
    if (err) { setOcupado(false); setError(REGISTRO_UN_PASO.errorCodigoMal); return; }
    await reclamarAnalisisAnonimos(posthog, "register");
    emitirAuthCompletada(posthog, "signup", "email");
    consumirRegistroPendiente();
    capturarLqs(posthog, EVENTOS_LQS.registroCompletado, ctx, { via: "correo", como: "codigo", donde: "guia" });
    alEntrar();
  }

  return enviado ? (
    <form className="guia-reg" onSubmit={entrar} noValidate data-guia="registro-codigo">
      <p className="guia-reg-t">{GUIA.registroEnviado(enviado)}</p>
      <div className="guia-reg-fila">
        <input ref={campo} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={CODIGO_MAX}
          placeholder={REGISTRO_UN_PASO.placeholderCodigo} aria-label="Código" value={codigo} onChange={(e) => setCodigo(limpiarCodigo(e.target.value))} />
        <button type="submit" disabled={ocupado} data-presionado={ocupado ? "1" : undefined}>{GUIA.entrarYAnalizar}</button>
      </div>
      {error && <p className="guia-error" role="alert">{error}</p>}
    </form>
  ) : (
    <form className="guia-reg" onSubmit={enviarCodigo} noValidate data-guia="registro-correo">
      <p className="guia-reg-t">{GUIA.registroTitulo}</p>
      <div className="guia-reg-fila">
        <input ref={campo} type="email" inputMode="email" autoComplete="email" placeholder={REGISTRO_UN_PASO.placeholder}
          aria-label="Tu correo" value={correo} onChange={(e) => setCorreo(e.target.value)} />
        <button type="submit" disabled={ocupado} data-presionado={ocupado ? "1" : undefined}>{REGISTRO_UN_PASO.mandarCodigo}</button>
      </div>
      {error && <p className="guia-error" role="alert">{error}</p>}
    </form>
  );
}
