"use client";

import { useEffect, useState } from "react";
import { usePostHog } from "@/lib/posthog-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { emitirAuthCompletada, marcarOAuthPendiente, reclamarAnalisisAnonimos } from "@/lib/auth-analytics";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { AppFooter } from "@/components/chrome/AppFooter";
import { PLANO, UI_PLANO } from "@/components/plano/plano";
import { LinkAuth } from "@/components/auth/LinkAuth";
import { esDestinoSeguro } from "@/lib/auth-next";

export default function LoginPage() {
  const router = useRouter();
  const posthog = usePostHog();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Mensaje cuando el link de confirmación de Supabase falló (expirado / ya
  // usado). El callback redirige acá con ?confirm_error=1. Se lee de
  // window.location para evitar useSearchParams (que exigiría Suspense boundary).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("confirm_error")) {
      setError(
        "El enlace de confirmación expiró o ya se usó. Inicia sesión con tu correo o pide uno nuevo.",
      );
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Email no confirmado: Supabase ya no crea sesión hasta confirmar.
      // No mostramos el error genérico — guiamos al usuario a confirmar.
      if (
        error.code === "email_not_confirmed" ||
        /email not confirmed|not confirmed|confirm/i.test(error.message)
      ) {
        setError(
          "Tu cuenta aún no está confirmada. Revisa el correo que te enviamos (y la carpeta de spam) para activarla.",
        );
      } else if (
        error.code === "invalid_credentials" ||
        /invalid login credentials/i.test(error.message)
      ) {
        setError("Email o contraseña incorrectos. Revísalos e intenta de nuevo.");
      } else {
        setError(error.message);
      }
      setLoading(false);
      return;
    }

    // Espejo de `signup_completed`: sin este evento, el usuario que ya tiene
    // cuenta y vuelve al gate del wizard a loguearse era invisible en el funnel
    // — se veía la salida (`wizard4_analysis_created`) sin la entrada.
    emitirAuthCompletada(posthog, "login", "email");

    // Claim de análisis anónimos (F2-2): ANTES del push — el destino (dashboard
    // o el análisis vía ?next=) debe nacer con la fila ya adoptada. Fail-soft:
    // un claim caído no frena el login.
    await reclamarAnalisisAnonimos(posthog, "login");

    // Destino tras login: ?next= (intención de compra, ej /checkout?product=X, o
    // el round-trip del wizard) o dashboard.
    //
    // `esDestinoSeguro` NO es decorativo acá: `router.push` navega a lo que le
    // den, así que un `?next=//evil.cl` —protocolo-relativa, que el navegador
    // resuelve a otro dominio— sacaba al usuario del sitio con solo loguearse
    // normal. No hacía falta ningún code ni token.
    const next = new URLSearchParams(window.location.search).get("next");
    router.push(esDestinoSeguro(next) ? next : "/dashboard");
    router.refresh();
  };

  const handleGoogle = async () => {
    const next = new URLSearchParams(window.location.search).get("next");
    const callbackUrl = next
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
      : `${window.location.origin}/auth/callback`;
    // La vuelta de OAuth entra por un route handler: no hay componente cliente
    // donde capturar el éxito. Se marca la intención y el provider global la
    // consume cuando ya existe sesión.
    marcarOAuthPendiente("login");
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl },
    });
  };

  // PLANA (19-oct-2026, decisión de Fabrizio): las pantallas de entrar en el diseño actual (components/plano), sin tarjeta
  // ni logo repetido; la lógica de arriba no cambia. La contraseña primero: a esta pantalla se llega desde «Entra con
  // contraseña» de /entrar, las cuentas de antes.
  return (
    <div className="flex min-h-screen flex-col bg-[var(--franco-bg)] text-[var(--franco-text)]">
      <HeaderFranco contexto="auth" />
      <main className={PLANO.main} style={{ fontFamily: UI_PLANO }}>
        <h1 className={PLANO.titulo}>Bienvenido de vuelta</h1>
        <p className={PLANO.bajada}>Continúa analizando tus inversiones</p>

        <div className={`${PLANO.seccion} flex flex-col gap-3`}>
          {error && <p className={PLANO.error} role="alert">{error}</p>}
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <div>
              <label htmlFor="email" className={PLANO.label}>Email</label>
              <input id="email" type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={PLANO.campo} />
            </div>
            <div>
              <label htmlFor="password" className={PLANO.label}>Contraseña</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={PLANO.campo} />
            </div>
            <button type="submit" disabled={loading} className={PLANO.principal}>
              {loading ? "Ingresando..." : "Iniciar sesión"}
            </button>
          </form>
          <p className={PLANO.nota}>
            <Link href="/recuperar" className="text-[var(--franco-text)] underline underline-offset-2">¿Olvidaste tu contraseña?</Link>
          </p>
          <div className="my-1 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-[var(--franco-border)]" />
            <span className="text-[13px] text-[var(--franco-text-muted)]">o</span>
            <span className="h-px flex-1 bg-[var(--franco-border)]" />
          </div>
          <button type="button" onClick={handleGoogle} className={PLANO.secundario}>
            <GoogleIcon />
            Continuar con Google
          </button>
        </div>

        <p className={`mt-6 ${PLANO.nota}`}>
          ¿No tienes cuenta?{" "}
          <LinkAuth destino="/register" className={PLANO.enlace}>Regístrate</LinkAuth>
        </p>
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
