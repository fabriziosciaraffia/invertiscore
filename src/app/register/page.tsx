"use client";

import { useState } from "react";
import { usePostHog } from "@/lib/posthog-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { AppFooter } from "@/components/chrome/AppFooter";
import { PLANO, UI_PLANO } from "@/components/plano/plano";
import { LinkAuth } from "@/components/auth/LinkAuth";
import { esDestinoSeguro } from "@/lib/auth-next";
import { emitirAuthCompletada, marcarOAuthPendiente, reclamarAnalisisAnonimos } from "@/lib/auth-analytics";

export default function RegisterPage() {
  const router = useRouter();
  const posthog = usePostHog();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Estado "te enviamos un correo de confirmación" tras signUp sin sesión
  // activa (Confirm email activado en Supabase).
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);

    // Intención de compra: ?next= (destino tras autenticar, ej /checkout?product=X).
    // Se lee de window.location para evitar useSearchParams (que exigiría Suspense).
    const next = new URLSearchParams(window.location.search).get("next");
    const callbackUrl = next
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
      : `${window.location.origin}/auth/callback`;

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre: name },
        emailRedirectTo: callbackUrl,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    emitirAuthCompletada(posthog, "signup", "email");

    // Con "Confirm email" activado, signUp NO crea sesión: data.session es
    // null hasta que el usuario confirme desde el correo. En ese caso NO
    // redirigimos al dashboard — mostramos el estado "revisa tu correo".
    if (!data.session) {
      setPendingEmail(email);
      setLoading(false);
      return;
    }

    // Caso con confirmación desactivada (o usuario ya confirmado): sesión
    // directa al destino solicitado (intención de compra) o al dashboard.
    // Validado igual que en login: `router.push` navega a donde le digan.
    // Claim de análisis anónimos (F2-2) ANTES del push — mismo criterio que
    // login. El camino CON confirmación de email no pasa por acá: su claim
    // vive en /auth/callback.
    await reclamarAnalisisAnonimos(posthog, "register");
    router.push(esDestinoSeguro(next) ? next : "/dashboard");
    router.refresh();
  };

  const handleGoogle = async () => {
    const next = new URLSearchParams(window.location.search).get("next");
    const callbackUrl = next
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
      : `${window.location.origin}/auth/callback`;
    // El `capture` de más arriba cuelga del signUp por email; este camino se va
    // en redirect antes de llegar ahí, así que el alta con Google no emitía
    // NADA. Se marca la intención y el provider global emite al volver.
    marcarOAuthPendiente("signup");
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl },
    });
  };

  // PLANA (19-oct-2026, decisión de Fabrizio): en el diseño actual (components/plano), sin tarjeta ni logo repetido; la
  // lógica de arriba no cambia.
  return (
    <div className="flex min-h-screen flex-col bg-[var(--franco-bg)] text-[var(--franco-text)]">
      <HeaderFranco contexto="auth" />
      <main className={PLANO.main} style={{ fontFamily: UI_PLANO }}>
        {pendingEmail ? (
          /* Estado: confirmación enviada */
          <div>
            <h1 className={PLANO.titulo}>Revisa tu correo</h1>
            <p className={PLANO.bajada}>
              Te enviamos un correo a <span className="font-semibold text-[var(--franco-text)]">{pendingEmail}</span> para
              confirmar tu cuenta. Revisa tu bandeja de entrada (y la carpeta de spam) y haz clic en el enlace para activarla.
            </p>
            <p className={`${PLANO.seccion} ${PLANO.nota}`}>
              ¿No llega? Espera un minuto y vuelve a mirar el spam. El enlace abre Franco y te deja adentro.
            </p>
            <p className={`mt-6 ${PLANO.nota}`}>
              <LinkAuth destino="/login" className={PLANO.enlace}>Volver a iniciar sesión</LinkAuth>
            </p>
          </div>
        ) : (
          <>
            <h1 className={PLANO.titulo}>Crea tu cuenta gratis</h1>
            <p className={PLANO.bajada}>Análisis de cualquier departamento en 30 segundos.</p>

            <div className={`${PLANO.seccion} flex flex-col gap-3`}>
              <button type="button" onClick={handleGoogle} className={PLANO.principal}>
                <span className="mr-2.5 inline-flex"><GoogleIcon /></span>
                Continuar con Google
              </button>
              <div className="my-1 flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-[var(--franco-border)]" />
                <span className="text-[13px] text-[var(--franco-text-muted)]">o continúa con tu correo</span>
                <span className="h-px flex-1 bg-[var(--franco-border)]" />
              </div>
              {error && <p className={PLANO.error} role="alert">{error}</p>}
              <form onSubmit={handleRegister} className="flex flex-col gap-3">
                <div>
                  <label htmlFor="name" className={PLANO.label}>Nombre completo</label>
                  <input id="name" type="text" placeholder="Juan Pérez" value={name} onChange={(e) => setName(e.target.value)} required className={PLANO.campo} />
                </div>
                <div>
                  <label htmlFor="email" className={PLANO.label}>Email</label>
                  <input id="email" type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={PLANO.campo} />
                </div>
                <div>
                  <label htmlFor="password" className={PLANO.label}>Contraseña</label>
                  <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={PLANO.campo} />
                </div>
                <div>
                  <label htmlFor="confirm-password" className={PLANO.label}>Confirmar contraseña</label>
                  <input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className={PLANO.campo} />
                </div>
                <button type="submit" disabled={loading} className={PLANO.secundario}>
                  {loading ? "Creando cuenta..." : "Crear cuenta gratis"}
                </button>
              </form>
            </div>

            <p className={`mt-6 ${PLANO.nota}`}>
              ¿Ya tienes cuenta?{" "}
              <LinkAuth destino="/login" className={PLANO.enlace}>Inicia sesión</LinkAuth>
            </p>
          </>
        )}
      </main>
      <AppFooter variant="informe" />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
