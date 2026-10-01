"use client";

// ─────────────────────────────────────────────────────────────────────────────
// La entrada por código (01-oct-2026): UNA SOLA ENTRADA a Franco. Correo → `signInWithOtp` manda el
// código (y el enlace, que vuelve por /auth/callback al mismo `next`) → el código se escribe acá mismo
// → `verifyOtp({ type: "email" })` (cubre «Confirm signup» y «Magic Link»: la cuenta nace o entra
// igual) → se reclama lo anónimo de este navegador y sale la bienvenida (`porCodigo`, una sola vez
// por persona) → vuelve a `next` validado (solo rutas internas; si no, /dashboard).
//
// El código acepta de 6 a 8 dígitos (lib/lo-que-sigue/codigo.ts: el largo lo fija el panel de
// Supabase); el copy dice 6, con el mismo criterio que el registro del informe.
// Sin mono ni mayúsculas: Inter (--font-ui) en el cuerpo, Source Serif en el título, tokens --franco-*.
// El copy vive en lib/entrar/entrada.ts (lo fija el tier ENTRADA-CÓDIGO).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usePostHog } from "@/lib/posthog-react";
import { emitirAuthCompletada, marcarOAuthPendiente, reclamarAnalisisAnonimos } from "@/lib/auth-analytics";
import { REGISTRO_UN_PASO } from "@/lib/lo-que-sigue/copy";
import { CODIGO_MAX, codigoValido, limpiarCodigo } from "@/lib/lo-que-sigue/codigo";
import { ENTRAR, ENTRAR_CONTEXTO, destinoTrasEntrar, esCuentaNueva, hrefConContrasena, type ContextoEntrada } from "@/lib/entrar/entrada";

const CORREO_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UI = "var(--font-ui), Inter, 'Helvetica Neue', Arial, sans-serif";

const CAMPO =
  "w-full rounded-[10px] border border-[var(--franco-border)] bg-[var(--franco-card)] px-3.5 py-3 text-[15px] text-[var(--franco-text)] placeholder:text-[var(--franco-text-muted)] focus:border-[var(--franco-text)] focus:outline-none";
const PRINCIPAL =
  "w-full rounded-[10px] bg-[var(--franco-text)] px-5 py-3 text-[15px] font-semibold text-[var(--franco-bg)] transition-opacity hover:opacity-90 disabled:opacity-60";
const ENLACE = "font-semibold text-[var(--franco-text)] underline underline-offset-2";

function IconoGoogle() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" />
      <path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z" />
      <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5L6.4 10c.8-2.3 3-4.1 5.6-4.1z" />
    </svg>
  );
}

export function EntrarConCodigo({ next, ctx }: { next: string; ctx: ContextoEntrada }) {
  const router = useRouter();
  const posthog = usePostHog();
  const destino = destinoTrasEntrar(next);
  const textos = ENTRAR_CONTEXTO[ctx];
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviado, setEnviado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [reenviado, setReenviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const campoCodigo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (enviado) campoCodigo.current?.focus();
  }, [enviado]);

  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(destino)}`;

  async function mandar(c: string): Promise<boolean> {
    const { error: err } = await createClient().auth.signInWithOtp({
      email: c,
      options: { emailRedirectTo: callback(), shouldCreateUser: true },
    });
    return !err;
  }

  async function enviarCodigo(e: FormEvent) {
    e.preventDefault();
    const c = correo.trim().toLowerCase();
    if (!CORREO_OK.test(c)) {
      setError(REGISTRO_UN_PASO.errorCorreo);
      return;
    }
    setError(null);
    setOcupado(true);
    const ok = await mandar(c);
    setOcupado(false);
    if (!ok) {
      setError(REGISTRO_UN_PASO.errorEnvio);
      return;
    }
    setEnviado(c);
  }

  async function mandarDeNuevo() {
    if (!enviado || ocupado) return;
    setError(null);
    setOcupado(true);
    const ok = await mandar(enviado);
    setOcupado(false);
    if (ok) setReenviado(true);
    else setError(REGISTRO_UN_PASO.errorEnvio);
  }

  function usarOtroCorreo() {
    setEnviado(null);
    setCodigo("");
    setReenviado(false);
    setError(null);
  }

  async function entrar(e: FormEvent) {
    e.preventDefault();
    const t = codigo.replace(/\D/g, "");
    if (!codigoValido(t) || !enviado) {
      setError(REGISTRO_UN_PASO.errorCodigo);
      return;
    }
    setError(null);
    setOcupado(true);
    const { data, error: err } = await createClient().auth.verifyOtp({ email: enviado, token: t, type: "email" });
    if (err) {
      setOcupado(false);
      setError(REGISTRO_UN_PASO.errorCodigoMal);
      return;
    }
    const nueva = esCuentaNueva(data.user?.created_at);
    // Con sesión: lo anónimo de este navegador pasa a la cuenta y sale la bienvenida (una vez).
    await reclamarAnalisisAnonimos(posthog, nueva ? "register" : "login", { porCodigo: true });
    emitirAuthCompletada(posthog, nueva ? "signup" : "login", "email");
    router.push(destino);
    router.refresh();
  }

  async function conGoogle() {
    marcarOAuthPendiente("login");
    await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } });
  }

  return (
    <div className="w-full max-w-[420px]" style={{ fontFamily: UI }} data-entrar={ctx}>
      <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] px-6 py-8 shadow-sm sm:px-8">
        {enviado ? (
          <form onSubmit={entrar} noValidate data-entrar-paso="codigo">
            <h1 className="font-heading text-[26px] font-bold leading-[1.15] text-[var(--franco-text)]">{ENTRAR.enviadoTitulo}</h1>
            <p className="mt-2 text-[15px] leading-[1.5] text-[var(--franco-text-secondary)]">{ENTRAR.enviadoCuerpo(enviado)}</p>
            <div className="mt-6 flex flex-col gap-3">
              <input
                ref={campoCodigo}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={CODIGO_MAX}
                placeholder={ENTRAR.placeholderCodigo}
                aria-label="Código"
                className={`${CAMPO} text-[18px] tracking-[0.2em] placeholder:tracking-normal`}
                value={codigo}
                onChange={(e) => setCodigo(limpiarCodigo(e.target.value))}
              />
              <button type="submit" className={PRINCIPAL} disabled={ocupado}>{ENTRAR.entrar}</button>
            </div>
            {error && <p className="mt-3 text-[14px] text-[var(--signal-red)]" role="alert">{error}</p>}
            {reenviado && !error && <p className="mt-3 text-[14px] text-[var(--franco-text-secondary)]" role="status">{ENTRAR.reenviado}</p>}
            <p className="mt-5 text-[13px] leading-[1.5] text-[var(--franco-text-secondary)]">
              {ENTRAR.noLlego}{" "}
              <button type="button" className={ENLACE} onClick={mandarDeNuevo} disabled={ocupado}>{ENTRAR.mandarDeNuevo}</button>
              {" · "}
              <button type="button" className={ENLACE} onClick={usarOtroCorreo}>{ENTRAR.otroCorreo}</button>
            </p>
          </form>
        ) : (
          <>
            <h1 className="font-heading text-[26px] font-bold leading-[1.15] text-[var(--franco-text)]">{textos.titulo}</h1>
            <p className="mt-2 text-[15px] leading-[1.5] text-[var(--franco-text-secondary)]">{textos.bajada}</p>
            <form className="mt-6 flex flex-col gap-3" onSubmit={enviarCodigo} noValidate data-entrar-paso="correo">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={ENTRAR.placeholderCorreo}
                aria-label="Tu correo"
                className={CAMPO}
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
              />
              <button type="submit" className={PRINCIPAL} disabled={ocupado}>{ENTRAR.mandarCodigo}</button>
              {error && <p className="text-[14px] text-[var(--signal-red)]" role="alert">{error}</p>}
            </form>
            <div className="my-5 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-[var(--franco-border)]" />
              <span className="text-[13px] text-[var(--franco-text-muted)]">{ENTRAR.o}</span>
              <span className="h-px flex-1 bg-[var(--franco-border)]" />
            </div>
            <button
              type="button"
              onClick={conGoogle}
              className="flex w-full items-center justify-center gap-2.5 rounded-[10px] border border-[var(--franco-border)] bg-[var(--franco-card)] px-5 py-3 text-[15px] font-semibold text-[var(--franco-text)] transition-colors hover:bg-[var(--franco-elevated)]"
            >
              <IconoGoogle /> {ENTRAR.google}
            </button>
          </>
        )}
      </div>
      {!enviado && (
        <p className="mt-5 text-center text-[13px] leading-[1.5] text-[var(--franco-text-secondary)]" data-entrar="con-contrasena">
          {ENTRAR.conContrasenaPregunta}{" "}
          <a href={hrefConContrasena(destino)} className="text-[var(--franco-text)] underline underline-offset-2">{ENTRAR.conContrasenaEnlace}</a>
        </p>
      )}
    </div>
  );
}
