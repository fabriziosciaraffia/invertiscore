"use client";

// ─────────────────────────────────────────────────────────────────────────────
// El registro en un paso (28-sep-2026): un correo —Franco manda un enlace para entrar, sin
// contraseña (`signInWithOtp`)— o Google. Vuelve por /auth/callback con `next` al informe (o al
// checkout del pack), y ahí el claim adopta el análisis anónimo y liga su perfil. El evento de
// completado lo emite `RegistroCompletadoSonda` al volver; acá solo sale «iniciado» con su vía.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, type FormEvent } from "react";
import type { PostHog } from "posthog-js";
import { createClient } from "@/lib/supabase/client";
import { usePostHog } from "@/lib/posthog-react";
import { marcarOAuthPendiente } from "@/lib/auth-analytics";
import { REGISTRO_UN_PASO } from "@/lib/lo-que-sigue/copy";
import { capturarLqs, consumirRegistroPendiente, EVENTOS_LQS, marcarRegistroPendiente, type ContextoLqs } from "@/lib/lo-que-sigue/eventos";

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

export function RegistroUnPaso({ next, ctx, onSeguirLeyendo }: {
  /** Adónde vuelve al entrar (el informe, o el checkout del pack). */
  next: string;
  ctx: ContextoLqs;
  /** «Seguir leyendo» tras el enlace enviado: vuelve al informe sin cerrar nada. Opcional. */
  onSeguirLeyendo?: () => void;
}) {
  const posthog = usePostHog();
  const [correo, setCorreo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function enviarEnlace(e: FormEvent) {
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

  async function conGoogle() {
    capturarLqs(posthog, EVENTOS_LQS.registroIniciado, ctx, { via: "google" });
    marcarRegistroPendiente("google", ctx);
    marcarOAuthPendiente("signup");
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } });
  }

  if (enviado) {
    return (
      <div>
        <p className="lqs-ojo">{REGISTRO_UN_PASO.ojo}</p>
        <h3 className="lqs-h3">{REGISTRO_UN_PASO.enviadoTitular} <mark>{REGISTRO_UN_PASO.enviadoPlumon}</mark></h3>
        <p className="lqs-enviado">{REGISTRO_UN_PASO.enviadoCuerpo(enviado)}</p>
        {onSeguirLeyendo && (
          <button type="button" className="lqs-btn lqs-ghost" onClick={onSeguirLeyendo}>{REGISTRO_UN_PASO.seguir}</button>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="lqs-ojo">{REGISTRO_UN_PASO.ojo}</p>
      <h3 className="lqs-h3">{REGISTRO_UN_PASO.titular} <mark>{REGISTRO_UN_PASO.plumon}</mark></h3>
      <form className="lqs-reg" onSubmit={enviarEnlace} noValidate>
        <div className="lqs-campo">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={REGISTRO_UN_PASO.placeholder}
            aria-label="Tu correo"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
          <button type="submit" className="lqs-btn" disabled={enviando} data-presionado={enviando ? "1" : undefined}>{REGISTRO_UN_PASO.entrar}</button>
        </div>
        {error && <p className="lqs-error" role="alert">{error}</p>}
        <div className="lqs-o">{REGISTRO_UN_PASO.o}</div>
        <button type="button" className="lqs-btn lqs-ghost lqs-google" onClick={conGoogle}><IconoGoogle /> {REGISTRO_UN_PASO.google}</button>
        <p className="lqs-legal">{REGISTRO_UN_PASO.pie}</p>
      </form>
    </div>
  );
}

/** Al volver con sesión: si había un registro en curso de «Lo que sigue», emite el completado con su vía. */
export function RegistroCompletadoSonda({ activa }: { activa: boolean }) {
  const posthog = usePostHog();
  useSondaRegistro(activa, posthog);
  return null;
}

function useSondaRegistro(activa: boolean, posthog: PostHog | null | undefined) {
  useEffect(() => {
    if (!activa) return;
    const m = consumirRegistroPendiente();
    if (m) capturarLqs(posthog, EVENTOS_LQS.registroCompletado, m.ctx, { via: m.via });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activa]);
}
