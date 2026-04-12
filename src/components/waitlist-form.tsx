"use client";

import { useState } from "react";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) return;

    setState("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setState("success");
        setEmail("");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="rounded-xl border border-[#B0BEC5]/20 bg-[#B0BEC5]/[0.06] px-6 py-4 text-center">
        <p className="font-body text-sm font-medium text-[#B0BEC5]">
          ¡Listo! Te avisaremos cuando Franco esté disponible.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:gap-2">
      <input
        type="email"
        placeholder="tu@email.com"
        value={email}
        onChange={(e) => { setEmail(e.target.value); if (state === "error") setState("idle"); }}
        required
        className="flex-1 rounded-lg border bg-transparent px-4 py-3 font-body text-sm text-[#FAFAF8] placeholder:text-white/[0.35] focus:border-[#C8323C] focus:outline-none focus:ring-1 focus:ring-[#C8323C]/20"
        style={{ borderColor: state === "error" ? "#C8323C" : "rgba(250,250,248,0.1)" }}
      />
      <button
        type="submit"
        disabled={state === "loading"}
        className="rounded-lg bg-[#C8323C] px-6 py-3 font-body text-sm font-bold text-white transition-colors hover:bg-[#b02a33] disabled:opacity-50"
      >
        {state === "loading" ? "Enviando..." : "Avisarme"}
      </button>
      {state === "error" && (
        <p className="text-xs text-[#C8323C] sm:hidden">Error al registrar. Intenta de nuevo.</p>
      )}
    </form>
  );
}
