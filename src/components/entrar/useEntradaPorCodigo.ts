"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LA ENTRADA POR CÓDIGO, COMO HOOK (19-oct-2026): la misma lógica que tenía EntrarConCodigo, sacada para que la usen dos
// pantallas sin copiarla —/entrar y la pantalla de compra (/checkout), que pide el correo y el código y paga sin pasar
// por /entrar—. Correo → `signInWithOtp` manda el código (y el enlace, que vuelve por /auth/callback a `destino`) → el
// código se escribe en la misma pantalla → `verifyOtp({ type: "email" })` (cubre «Confirm signup» y «Magic Link»: la
// cuenta nace o entra igual) → se reclama lo anónimo de este navegador y sale la bienvenida (`porCodigo`, una sola vez
// por persona). Qué pasa DESPUÉS de entrar lo decide cada pantalla: /entrar vuelve a `next`; la compra va a Flow.
//
// El código acepta de 6 a 8 dígitos (lib/lo-que-sigue/codigo.ts: el largo lo fija el panel de Supabase).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePostHog } from "@/lib/posthog-react";
import { emitirAuthCompletada, marcarOAuthPendiente, reclamarAnalisisAnonimos } from "@/lib/auth-analytics";
import { REGISTRO_UN_PASO } from "@/lib/lo-que-sigue/copy";
import { codigoValido, limpiarCodigo } from "@/lib/lo-que-sigue/codigo";
import { destinoTrasEntrar, esCuentaNueva } from "@/lib/entrar/entrada";

const CORREO_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** `destino`: adónde vuelve el enlace del correo y Google (validado: solo rutas internas). */
export function useEntradaPorCodigo(destinoPedido: string) {
  const posthog = usePostHog();
  const destino = destinoTrasEntrar(destinoPedido);
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigoCrudo] = useState("");
  const [enviado, setEnviado] = useState<string | null>(null);
  // QUÉ ESTÁ ESPERANDO (22-oct-2026, regla de carga): el botón que lo pidió gira; los demás solo se deshabilitan.
  const [ocupadoEn, setOcupadoEn] = useState<"enviar" | "reenviar" | "verificar" | "google" | null>(null);
  const ocupado = ocupadoEn !== null;
  const setOcupado = (v: boolean) => setOcupadoEn(v ? "verificar" : null);
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

  async function enviarCodigo(e?: FormEvent) {
    e?.preventDefault();
    const c = correo.trim().toLowerCase();
    if (!CORREO_OK.test(c)) {
      setError(REGISTRO_UN_PASO.errorCorreo);
      return;
    }
    setError(null);
    setOcupadoEn("enviar");
    const ok = await mandar(c);
    setOcupadoEn(null);
    if (!ok) {
      setError(REGISTRO_UN_PASO.errorEnvio);
      return;
    }
    setEnviado(c);
  }

  async function mandarDeNuevo() {
    if (!enviado || ocupado) return;
    setError(null);
    setOcupadoEn("reenviar");
    const ok = await mandar(enviado);
    setOcupadoEn(null);
    if (ok) setReenviado(true);
    else setError(REGISTRO_UN_PASO.errorEnvio);
  }

  function usarOtroCorreo() {
    setEnviado(null);
    setCodigoCrudo("");
    setReenviado(false);
    setError(null);
  }

  /** Verifica el código. `true` = ya hay sesión (y `ocupado` queda prendido: la pantalla sigue a su destino). */
  async function verificar(e?: FormEvent): Promise<boolean> {
    e?.preventDefault();
    const t = codigo.replace(/\D/g, "");
    if (!codigoValido(t) || !enviado) {
      setError(REGISTRO_UN_PASO.errorCodigo);
      return false;
    }
    setError(null);
    setOcupadoEn("verificar");
    const { data, error: err } = await createClient().auth.verifyOtp({ email: enviado, token: t, type: "email" });
    if (err) {
      setOcupadoEn(null);
      setError(REGISTRO_UN_PASO.errorCodigoMal);
      return false;
    }
    const nueva = esCuentaNueva(data.user?.created_at);
    // Con sesión: lo anónimo de este navegador pasa a la cuenta y sale la bienvenida (una vez).
    await reclamarAnalisisAnonimos(posthog, nueva ? "register" : "login", { porCodigo: true });
    emitirAuthCompletada(posthog, nueva ? "signup" : "login", "email");
    return true;
  }

  async function conGoogle() {
    setOcupadoEn("google");
    marcarOAuthPendiente("login");
    const { error: err } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } });
    // Si no redirige (falló), el botón vuelve a estar libre.
    if (err) { setOcupadoEn(null); setError(REGISTRO_UN_PASO.errorEnvio); }
  }

  return {
    destino, correo, setCorreo, codigo, setCodigo: (v: string) => setCodigoCrudo(limpiarCodigo(v)),
    enviado, ocupado, ocupadoEn, setOcupado, reenviado, error, setError, campoCodigo,
    enviarCodigo, mandarDeNuevo, usarOtroCorreo, verificar, conGoogle,
  };
}
