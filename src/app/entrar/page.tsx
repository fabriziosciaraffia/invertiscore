"use client";

// ─────────────────────────────────────────────────────────────────────────────
// /entrar (01-oct-2026): UNA SOLA ENTRADA A FRANCO, EL CÓDIGO. «Entrar» del header lleva acá con
// `?next=<ruta actual>`; `?ctx=` elige el copy (pack · informe · semanal; si no, el genérico). /registro
// redirige acá conservando la query. /login (contraseña) queda para las cuentas viejas, enlazado chico
// desde abajo. Con sesión, el middleware manda directo al `next`.
// ─────────────────────────────────────────────────────────────────────────────
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { AppFooter } from "@/components/chrome/AppFooter";
import { EntrarConCodigo } from "@/components/entrar/EntrarConCodigo";
import { contextoEntrada, destinoTrasEntrar } from "@/lib/entrar/entrada";

export default function EntrarPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--franco-bg)]">
      <HeaderFranco contexto="auth" />
      <div className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:py-14">
        <Suspense fallback={null}>
          <EntrarContenido />
        </Suspense>
      </div>
      <AppFooter variant="minimal" />
    </div>
  );
}

function EntrarContenido() {
  const sp = useSearchParams();
  const next = destinoTrasEntrar(sp.get("next"));
  const ctx = contextoEntrada(sp.get("ctx"), next);
  return <EntrarConCodigo next={next} ctx={ctx} />;
}
