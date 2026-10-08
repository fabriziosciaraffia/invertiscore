"use client";

// ─────────────────────────────────────────────────────────────────────────────
// El registro en un paso (28-sep-2026, ajuste 4): un correo → Franco manda un CÓDIGO de 6 dígitos
// (y el enlace, como alternativa) con `signInWithOtp`; el código se escribe en el mismo formulario,
// sin salir del informe (`verifyOtp`), y al entrar el análisis anónimo se reclama y queda ligado.
// SUPABASE MANDA DOS PLANTILLAS con el mismo llamado (confirmado 29-sep-2026): «Confirm signup» si el
// correo es nuevo (shouldCreateUser lo crea) y «Magic Link» si ya existe. El código se verifica igual
// en los dos casos: `verifyOtp({ type: "email" })` cubre signup y magiclink (los tipos 'signup' y
// 'magiclink' quedaron obsoletos en auth-js). Las dos plantillas llevan el mismo HTML.
// Si se usa el enlace, vuelve por /auth/callback al mismo informe con la cuenta ligada. Google va
// por OAuth y vuelve igual. Eventos: registro_iniciado {via}; registro_completado {via} al entrar
// (por código, acá mismo; por enlace o Google, la sonda al volver).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { PostHog } from "posthog-js";
import { createClient } from "@/lib/supabase/client";
import { usePostHog } from "@/lib/posthog-react";
import { emitirAuthCompletada, marcarOAuthPendiente, reclamarAnalisisAnonimos } from "@/lib/auth-analytics";
import { REGISTRO_UN_PASO } from "@/lib/lo-que-sigue/copy";
import { CODIGO_MAX, codigoValido, limpiarCodigo } from "@/lib/lo-que-sigue/codigo";
import { capturarLqs, consumirRegistroPendiente, EVENTOS_LQS, marcarRegistroPendiente, type ContextoLqs } from "@/lib/lo-que-sigue/eventos";
import { usoBanner } from "@/lib/lo-que-sigue/uso-banner";

const CORREO_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function IconoGoogle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" />
      <path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z" />
      <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5L6.4 10c.8-2.3 3-4.1 5.6-4.1z" />
    </svg>
  );
}

export function RegistroUnPaso({ next, ctx, alEntrar }: {
  /** Adónde vuelve el enlace o Google (el informe, o el checkout). Con código no se sale de la página. */
  next: string;
  ctx: ContextoLqs;
  /** Con código: qué hacer al entrar (recibe el correo con que entró). Sin él, se refresca la página
   *  (el informe pasa a ser propio). */
  alEntrar?: (correo: string) => void;
}) {
  const posthog = usePostHog();
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);
  const campoCodigo = useRef<HTMLInputElement>(null);

  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  useEffect(() => {
    if (enviado) campoCodigo.current?.focus();
  }, [enviado]);

  // Abrir el paso del código cuenta como actividad en el banner: el ticket del pack espera un minuto desde
  // ahí y después sale aunque el paso siga abierto (08-oct-2026, tercera pasada, `uso-banner.ts`).
  useEffect(() => {
    usoBanner.codigoAbierto(!!enviado);
    return () => {
      usoBanner.codigoAbierto(false);
      usoBanner.correoConFoco(false);
    };
  }, [enviado]);

  async function enviarCodigo(e: FormEvent) {
    e.preventDefault();
    const c = correo.trim().toLowerCase();
    if (!CORREO_OK.test(c)) {
      setError(REGISTRO_UN_PASO.errorCorreo);
      return;
    }
    setError(null);
    setEnviando(true);
    capturarLqs(posthog, EVENTOS_LQS.registroIniciado, ctx, { via: "correo" });
    marcarRegistroPendiente("correo", ctx);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: c,
      options: { emailRedirectTo: callback(), shouldCreateUser: true },
    });
    setEnviando(false);
    if (err) {
      setError(REGISTRO_UN_PASO.errorEnvio);
      return;
    }
    setEnviado(c);
  }

  async function entrarConCodigo(e: FormEvent) {
    e.preventDefault();
    const t = codigo.replace(/\D/g, "");
    if (!codigoValido(t) || !enviado) {
      setError(REGISTRO_UN_PASO.errorCodigo);
      return;
    }
    setError(null);
    setEntrando(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.verifyOtp({ email: enviado, token: t, type: "email" });
    if (err) {
      setEntrando(false);
      setError(REGISTRO_UN_PASO.errorCodigoMal);
      return;
    }
    // Con sesión: el análisis anónimo pasa a la cuenta (claim) y queda ligado su perfil; sale la
    // bienvenida (porCodigo: una sola vez por persona).
    await reclamarAnalisisAnonimos(posthog, "register", { porCodigo: true });
    emitirAuthCompletada(posthog, "signup", "email");
    consumirRegistroPendiente();
    capturarLqs(posthog, EVENTOS_LQS.registroCompletado, ctx, { via: "correo", como: "codigo" });
    if (alEntrar) alEntrar(enviado);
    else router.refresh();
  }

  async function conGoogle() {
    capturarLqs(posthog, EVENTOS_LQS.registroIniciado, ctx, { via: "google" });
    marcarRegistroPendiente("google", ctx);
    marcarOAuthPendiente("signup");
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } });
  }

  if (enviado) {
    return (
      <form className="lqs-reg" onSubmit={entrarConCodigo} noValidate data-lqs="registro-codigo">
        <p className="lqs-ojo">{REGISTRO_UN_PASO.ojo}</p>
        <h3 className="lqs-h3">{REGISTRO_UN_PASO.enviadoTitular} <mark>{REGISTRO_UN_PASO.enviadoPlumon}</mark></h3>
        <p className="lqs-enviado">{REGISTRO_UN_PASO.enviadoCuerpo(enviado)}</p>
        <div className="lqs-campo">
          <input
            ref={campoCodigo}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={CODIGO_MAX}
            placeholder={REGISTRO_UN_PASO.placeholderCodigo}
            aria-label="Código de 6 dígitos"
            className="lqs-codigo"
            value={codigo}
            onChange={(e) => setCodigo(limpiarCodigo(e.target.value))}
          />
          <button type="submit" className="lqs-btn" disabled={entrando} data-presionado={entrando ? "1" : undefined}>{REGISTRO_UN_PASO.entrar}</button>
        </div>
        {error && <p className="lqs-error" role="alert">{error}</p>}
        <p className="lqs-legal">{REGISTRO_UN_PASO.enlaceAlternativa}</p>
      </form>
    );
  }

  return (
    <div>
      <p className="lqs-ojo">{REGISTRO_UN_PASO.ojo}</p>
      <h3 className="lqs-h3">{REGISTRO_UN_PASO.titular} <mark>{REGISTRO_UN_PASO.plumon}</mark></h3>
      <form className="lqs-reg" onSubmit={enviarCodigo} noValidate data-lqs="registro-correo">
        <div className="lqs-campo">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={REGISTRO_UN_PASO.placeholder}
            aria-label="Tu correo"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            onFocus={() => usoBanner.correoConFoco(true)}
            onBlur={() => usoBanner.correoConFoco(false)}
          />
          <button type="submit" className="lqs-btn" disabled={enviando} data-presionado={enviando ? "1" : undefined}>{REGISTRO_UN_PASO.mandarCodigo}</button>
        </div>
        {error && <p className="lqs-error" role="alert">{error}</p>}
        <div className="lqs-o">{REGISTRO_UN_PASO.o}</div>
        <button type="button" className="lqs-btn lqs-ghost lqs-google" onClick={conGoogle}><IconoGoogle /> {REGISTRO_UN_PASO.google}</button>
        <p className="lqs-legal">{REGISTRO_UN_PASO.pie}</p>
      </form>
    </div>
  );
}

/** Al volver con sesión (enlace o Google): si había un registro en curso, emite el completado con su vía. */
export function RegistroCompletadoSonda({ activa }: { activa: boolean }) {
  const posthog = usePostHog();
  useSondaRegistro(activa, posthog);
  return null;
}

function useSondaRegistro(activa: boolean, posthog: PostHog | null | undefined) {
  useEffect(() => {
    if (!activa) return;
    const m = consumirRegistroPendiente();
    if (m) capturarLqs(posthog, EVENTOS_LQS.registroCompletado, m.ctx, { via: m.via, como: "enlace" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activa]);
}
