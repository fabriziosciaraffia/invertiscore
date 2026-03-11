"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Check,
  Menu,
  X as XIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import FrancoLogo from "@/components/franco-logo";
import type { User } from "@supabase/supabase-js";

// ============================================================
// FadeIn — standard slide-up, 30px, 0.6s desktop / 0.4s mobile
// ============================================================
function FadeIn({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(30px)",
        transition: `opacity 0.6s ease-out ${delay}ms, transform 0.6s ease-out ${delay}ms`,
        willChange: "transform, opacity",
      }}
    >
      {children}
    </div>
  );
}

// ============================================================
// SlideIn — horizontal slide for desktop, fallback to slide-up on mobile
// ============================================================
function SlideIn({ children, className = "", delay = 0, direction = "left" }: { children: React.ReactNode; className?: string; delay?: number; direction?: "left" | "right" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const hiddenTransform = isMobile
    ? "translateY(30px)"
    : direction === "left" ? "translateX(-40px)" : "translateX(40px)";
  const duration = isMobile ? "0.4s" : "0.6s";

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translate(0)" : hiddenTransform,
        transition: `opacity ${duration} ease-out ${delay}ms, transform ${duration} ease-out ${delay}ms`,
        willChange: "transform, opacity",
      }}
    >
      {children}
    </div>
  );
}

// ============================================================
// Tooltip icon (?) for fields with extra info
// ============================================================
function TooltipIcon({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<"above" | "below">("above");

  useEffect(() => {
    if (show && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos(rect.top < 120 ? "below" : "above");
    }
  }, [show]);

  return (
    <span ref={ref} className="relative ml-1 inline-flex">
      <span
        className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-[#E6E6E2] text-[10px] font-medium leading-none text-[#71717A] transition-colors hover:border-[#0F0F0F] hover:text-[#0F0F0F]"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        ?
      </span>
      {show && (
        <span
          className={`absolute z-50 w-[220px] sm:w-[250px] rounded-lg bg-[#0F0F0F] px-3 py-2 text-xs leading-relaxed text-white shadow-lg ${
            pos === "above" ? "bottom-full mb-2" : "top-full mt-2"
          } left-1/2 -translate-x-1/2`}
        >
          {text}
          <span className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
            pos === "above" ? "top-full border-t-[#0F0F0F]" : "bottom-full border-b-[#0F0F0F]"
          }`} />
        </span>
      )}
    </span>
  );
}


// ============================================================
// Main Page
// ============================================================
export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [analysisCount, setAnalysisCount] = useState<number | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const fetchData = async () => {
      try {
        const [{ data: { user: currentUser } }, { count }] = await Promise.all([
          supabase.auth.getUser(),
          supabase.from("analisis").select("*", { count: "exact", head: true }),
        ]);
        if (currentUser) setUser(currentUser);
        if (count !== null) setAnalysisCount(count);
      } catch {
        // silently fail
      }
    };
    fetchData();
  }, []);

  return (
    <div className="overflow-x-hidden bg-white text-[#0F0F0F]">
      <style jsx global>{`
        @media (max-width: 767px) {
          .transition-gpu { transition-duration: 0.4s !important; }
        }
      `}</style>

      {/* ============ 1. HEADER / NAVBAR ============ */}
      <nav className="sticky top-0 z-50 border-b border-[#E6E6E2] bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <FrancoLogo size="sm" href="/" />
          <div className="hidden items-center gap-6 sm:flex">
            {user ? (
              <>
                <Link href="/dashboard" className="font-body text-sm text-[#71717A] transition-colors hover:text-[#0F0F0F]">
                  Dashboard
                </Link>
                <Link href="/analisis/nuevo" className="font-body text-sm text-[#71717A] transition-colors hover:text-[#0F0F0F]">
                  Nuevo análisis
                </Link>
                <Link href="/pricing">
                  <span className="rounded-md bg-[#C8323C] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#C8323C]/90">Premium</span>
                </Link>
                <button
                  onClick={async () => {
                    const supabase = createClient();
                    await supabase.auth.signOut();
                    setUser(null);
                    router.refresh();
                  }}
                  className="font-body text-sm text-[#71717A] transition-colors hover:text-[#0F0F0F]"
                >
                  Cerrar Sesión
                </button>
              </>
            ) : (
              <>
                <Link href="/pricing" className="font-body text-sm text-[#71717A] transition-colors hover:text-[#0F0F0F]">
                  Pricing
                </Link>
                <Link href="/login" className="font-body text-sm text-[#71717A] transition-colors hover:text-[#0F0F0F]">
                  Iniciar Sesión
                </Link>
                <Link href="/analisis/nuevo">
                  <Button size="sm" className="rounded-lg bg-[#0F0F0F] text-white transition-colors hover:bg-[#0F0F0F]/90">
                    Analizar gratis
                  </Button>
                </Link>
              </>
            )}
          </div>
          <button className="p-2 text-[#71717A] sm:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menu">
            {mobileMenuOpen ? <XIcon className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="border-t border-[#E6E6E2] bg-white px-6 py-4 sm:hidden">
            <div className="flex flex-col gap-3">
              {user ? (
                <>
                  <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="font-body text-sm text-[#71717A]">Dashboard</Link>
                  <Link href="/analisis/nuevo" onClick={() => setMobileMenuOpen(false)} className="font-body text-sm text-[#71717A]">Nuevo análisis</Link>
                  <Link href="/pricing" onClick={() => setMobileMenuOpen(false)} className="inline-flex w-fit rounded-md bg-[#C8323C] px-3 py-1.5 text-xs font-bold text-white">Premium</Link>
                  <button
                    onClick={async () => {
                      const supabase = createClient();
                      await supabase.auth.signOut();
                      setUser(null);
                      setMobileMenuOpen(false);
                      router.refresh();
                    }}
                    className="text-left font-body text-sm text-[#71717A]"
                  >
                    Cerrar Sesión
                  </button>
                </>
              ) : (
                <>
                  <Link href="/pricing" onClick={() => setMobileMenuOpen(false)} className="font-body text-sm text-[#71717A]">Pricing</Link>
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="font-body text-sm text-[#71717A]">Iniciar Sesión</Link>
                  <Link href="/analisis/nuevo" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full rounded-lg bg-[#0F0F0F] text-white hover:bg-[#0F0F0F]/90">Analizar gratis</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ============ 2. HERO SECTION ============ */}
      <section className="bg-[#0F0F0F] px-6 py-20 md:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[3fr_2fr]">
          {/* Texto (columna izquierda) */}
          <div className="text-center lg:text-left">
            <FadeIn>
              <h1 className="font-heading text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-[3.5rem]">
                La mayoría de los deptos de inversión en Santiago pierden plata cada mes.
              </h1>
            </FadeIn>
            <FadeIn delay={100}>
              <p className="mx-auto mt-6 max-w-lg font-body text-lg leading-relaxed text-white/60 lg:mx-0">
                Eso no aparece en la cotización. Franco te muestra la rentabilidad real, el flujo verdadero, y te dice si vale la pena — sin conflictos de interés.
              </p>
            </FadeIn>
            <FadeIn delay={200}>
              <div className="mt-8">
                <Link href="/analisis/nuevo">
                  <Button className="rounded-lg bg-[#C8323C] px-7 py-3.5 font-body text-base font-semibold text-white transition-colors hover:bg-[#C8323C]/90">
                    Analizar propiedad gratis <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
                <p className="mt-3 font-body text-xs text-white/40">Sin tarjeta de crédito. Tu corredor gana si compras. Franco gana si decides bien.</p>
              </div>
            </FadeIn>
          </div>

          {/* Score Preview Card (columna derecha) */}
          <FadeIn delay={300}>
            <div className="mx-auto max-w-[300px] rounded-2xl border border-white/10 bg-white p-6 shadow-2xl">
              <div className="font-body text-[10px] uppercase tracking-[0.1em] text-[#71717A] mb-1">Franco Score</div>
              <div className="font-heading text-5xl font-bold leading-none text-[#0F0F0F]">54</div>
              <div className="mt-2 font-body text-sm font-bold text-[#C8323C]">No compres — negocia primero</div>

              <div className="mt-5 flex gap-3">
                {[
                  { label: "Rent.", value: "3.9%", w: "39%" },
                  { label: "Flujo", value: "-$378K", w: "25%" },
                  { label: "Plusv.", value: "Alta", w: "80%" },
                  { label: "Riesgo", value: "Medio", w: "50%" },
                ].map((m) => (
                  <div key={m.label} className="flex-1">
                    <div className="mb-1 font-body text-[8px] text-[#71717A]">{m.label}</div>
                    <div className="h-1 overflow-hidden rounded-full bg-[#F0F0EC]">
                      <div className={`h-full rounded-full ${parseInt(m.w) < 30 ? "bg-[#C8323C]" : "bg-[#0F0F0F]/30"}`} style={{ width: m.w }} />
                    </div>
                    <div className="mt-1 font-mono text-[9px] font-medium text-[#0F0F0F]">{m.value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 inline-flex items-center rounded-md border border-[#C8323C]/30 bg-[#C8323C]/10 px-3 py-1">
                <span className="font-mono text-[10px] font-bold tracking-wide text-[#C8323C]">NEGOCIAR</span>
              </div>

              <div className="mt-4 border-t border-[#E6E6E2] pt-3 font-body text-[11px] leading-relaxed text-[#0F0F0F]">
                <span className="font-semibold">Siendo franco:</span> este depto te cuesta $378K de tu bolsillo cada mes.
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============ 2b. STATS CON ACTITUD ============ */}
      <section className="bg-white px-6 py-12 md:py-16">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-0 md:divide-x md:divide-[#E6E6E2]">
              <div className="text-center md:px-8">
                <div className="font-heading text-4xl font-bold leading-none text-[#C8323C]">73%</div>
                <div className="mt-2 font-body text-sm leading-snug text-[#71717A]">de los deptos que analizamos tienen flujo negativo</div>
              </div>
              <div className="text-center md:px-8">
                <div className="font-heading text-4xl font-bold leading-none text-[#C8323C]">-$412K</div>
                <div className="mt-2 font-body text-sm leading-snug text-[#71717A]">flujo mensual promedio en Santiago Centro</div>
              </div>
              <div className="text-center md:px-8">
                <div className="font-heading text-4xl font-bold leading-none text-[#C8323C]">0</div>
                <div className="mt-2 font-body text-sm leading-snug text-[#71717A]">corredores que te muestran estos números</div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============ 3. COMPARADOR — Corredor vs Franco ============ */}
      <section className="bg-[#FAFAF8] px-6 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <h2 className="text-center font-heading text-3xl font-bold tracking-tight text-[#0F0F0F] md:text-4xl">
              Lo que tu corredor te muestra vs lo que Franco te muestra
            </h2>
          </FadeIn>
          <div className="mt-14 grid gap-4 md:grid-cols-2 md:gap-6">
            {/* Card IZQUIERDA — Corredor */}
            <SlideIn delay={100} direction="left">
              <div className="h-full rounded-xl border border-[#E6E6E2] bg-white/80 p-6 opacity-50">
                <div className="mb-5 font-mono text-[10px] uppercase tracking-wider text-[#71717A]">Lo que te muestra el corredor</div>
                <h3 className="font-body text-lg font-bold text-[#0F0F0F]">Depto 2D1B en Providencia</h3>
                <div className="my-4 h-px bg-[#E6E6E2]" />
                <div className="space-y-0">
                  <div className="flex items-center justify-between border-b border-[#E6E6E2]/50 py-3">
                    <span className="font-body text-sm text-[#71717A]">Precio</span>
                    <span className="font-mono text-sm font-medium text-[#0F0F0F]">UF 3.200</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#E6E6E2]/50 py-3">
                    <span className="font-body text-sm text-[#71717A]">Arriendo</span>
                    <span className="font-mono text-sm font-medium text-[#0F0F0F]">$420.000/mes</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#E6E6E2]/50 py-3">
                    <span className="flex items-center font-body text-sm text-[#71717A]">Rent. Bruta<TooltipIcon text="Rentabilidad anual bruta: arriendo anual dividido por el precio. No descuenta ningún gasto." /></span>
                    <span className="font-mono text-sm font-medium text-[#0F0F0F]">4.0%</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#E6E6E2]/50 py-3">
                    <span className="font-body text-sm text-[#71717A]">Flujo mensual</span>
                    <span className="font-body text-sm italic text-[#71717A]/60">No informado</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="font-body text-sm text-[#71717A]">Conclusión</span>
                    <span className="font-body text-sm font-semibold italic text-[#0F0F0F]">&ldquo;Excelente oportunidad!&rdquo;</span>
                  </div>
                </div>
              </div>
            </SlideIn>

            {/* Card DERECHA — Franco */}
            <SlideIn delay={200} direction="right">
              <div className="relative h-full rounded-xl border-2 border-[#C8323C] bg-white p-6" style={{ boxShadow: "0 0 20px rgba(200,50,60,0.08)" }}>
                <div className="absolute -top-2.5 right-4 rounded bg-[#C8323C] px-2 py-0.5 font-mono text-[9px] font-bold text-white">LA VERDAD</div>
                <div className="mb-5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#0F0F0F]">Lo que Franco te muestra</div>
                <h3 className="font-body text-lg font-bold text-[#0F0F0F]">Depto 2D1B en Providencia</h3>
                <div className="my-4 h-px bg-[#E6E6E2]" />
                <div className="space-y-0">
                  <div className="flex items-center justify-between border-b border-[#E6E6E2]/50 py-3">
                    <span className="flex items-center font-body text-sm text-[#71717A]">Flujo mensual<TooltipIcon text="Ingreso por arriendo menos todos los gastos: dividendo, GGCC, contribuciones, seguro, mantención y vacancia" /></span>
                    <span className="font-heading text-lg font-bold text-[#C8323C]">-$359.000</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#E6E6E2]/50 py-3">
                    <span className="flex items-center font-body text-sm text-[#71717A]">Cash-on-Cash<TooltipIcon text="Retorno anual sobre el capital que pusiste de tu bolsillo (pie + gastos)" /></span>
                    <span className="font-mono text-sm font-medium text-[#C8323C]">-17.8%</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#E6E6E2]/50 py-3">
                    <span className="flex items-center font-body text-sm text-[#71717A]">Rent. Neta<TooltipIcon text="Rentabilidad después de TODOS los gastos: operativos, vacancia, corretaje y recambio de arrendatario." /></span>
                    <span className="font-mono text-sm font-medium text-[#71717A]">2.07%</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="flex items-center font-body text-sm text-[#71717A]">Plusvalía 10 años<TooltipIcon text="Cuántas veces se multiplica tu inversión inicial en 10 años considerando plusvalía del sector" /></span>
                    <span className="font-mono text-sm font-medium text-[#0F0F0F]">3.3x</span>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#FAFAF8] p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#C8323C]">
                    <span className="font-heading text-sm font-bold text-[#C8323C]">54</span>
                  </div>
                  <div>
                    <div className="font-body text-sm font-semibold text-[#0F0F0F]">Score: 54 <span className="text-[#C8323C]">&ldquo;No compres — negocia primero&rdquo;</span></div>
                  </div>
                </div>
                <p className="mt-3 font-body text-sm font-medium text-[#C8323C]">Pones $4.3M al año de tu bolsillo</p>
              </div>
            </SlideIn>
          </div>
          <FadeIn delay={300}>
            <p className="mt-10 text-center font-body text-base text-[#71717A]">
              El mismo departamento. Los mismos datos. La diferencia es quién te los muestra — y qué gana con eso.
            </p>
            <div className="mt-6 text-center">
              <Link href="/analisis/nuevo" className="inline-flex items-center gap-1 font-body font-medium text-[#0F0F0F] transition-colors hover:text-[#0F0F0F]/80 hover:underline">
                Pruébalo con tu propiedad <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============ 4. ¿POR QUÉ TU CORREDOR NO TE MUESTRA ESTOS NÚMEROS? ============ */}
      <section className="bg-[#0F0F0F] px-6 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <h2 className="text-center font-heading text-3xl font-bold tracking-tight text-white md:text-4xl">
              ¿Por qué tu corredor no te muestra estos números?
            </h2>
          </FadeIn>
          <div className="mt-10 grid items-stretch gap-6 lg:grid-cols-3">
            {[
              { title: "Su comisión: $3.5M. Tu riesgo: $359.000 al mes.", desc: "Un corredor gana entre 1% y 2% del precio de venta. En un depto de 3.200 UF, eso son $2.5 a $5 millones. Los cobra el día que firmas. Si el depto pierde plata, ese ya es tu problema — él ya cobró." },
              { title: "Te muestra rent. bruta de 4%. No te dice que el flujo es -$359.000.", desc: "La rentabilidad bruta no descuenta nada: ni dividendo, ni gastos comunes, ni contribuciones, ni vacancia. El flujo real — cuánto sale de tu bolsillo cada mes — es lo que importa. Y nunca aparece en la cotización." },
              { title: "Si la inversión sale mal, el corredor no devuelve la comisión.", desc: "Tú asumes todo el riesgo por 25 años. El corredor desaparece después de la firma. Franco no te vende propiedades ni cobra comisiones de venta. Nuestro único incentivo es que tengas la información completa antes de decidir." },
            ].map((item, i) => (
              <FadeIn key={item.title} delay={i * 150}>
                <div className="flex h-full flex-col rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                  <h3 className="mb-2 font-body text-base font-bold text-white">{item.title}</h3>
                  <p className="flex-1 font-body text-sm leading-relaxed text-white/60">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 5. ESTO ES LO QUE VAS A VER (análisis demo) ============ */}
      <section className="bg-white px-6 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <h2 className="text-center font-heading text-3xl font-bold tracking-tight text-[#0F0F0F]">
              Esto es lo que vas a ver
            </h2>
            <p className="mt-4 text-center font-body text-[#71717A]">
              No una lista de features. El análisis real de un depto en Providencia.
            </p>
          </FadeIn>

          {/* FILA 1 — 3 cards */}
          <div className="mt-10 grid grid-cols-1 gap-4 sm:mt-14 lg:grid-cols-3 lg:items-stretch">
            {/* CARD 1 — Cascada de costos */}
            <FadeIn delay={100}>
              <div className="h-full rounded-xl border border-[#E6E6E2] bg-white p-5 shadow-sm">
                <h3 className="mb-3 font-body text-sm font-bold text-[#0F0F0F] sm:text-base">A dónde va tu plata cada mes</h3>
                <div className="space-y-1">
                  {[
                    { label: "Arriendo", value: 420000, positive: true },
                    { label: "Dividendo", value: -579000, positive: false },
                    { label: "Contribuciones", value: -60000, positive: false },
                    { label: "Mantención", value: -53000, positive: false },
                    { label: "Vacancia", value: -35000, positive: false },
                    { label: "Administración", value: -29000, positive: false },
                    { label: "Otros", value: -23000, positive: false },
                  ].map((item) => {
                    const maxVal = 579000;
                    const pct = Math.round((Math.abs(item.value) / maxVal) * 100);
                    return (
                      <div key={item.label} className="flex items-center gap-1.5">
                        <span className="w-28 shrink-0 font-body text-xs text-[#71717A]">{item.label}</span>
                        <div className="flex-1 overflow-hidden">
                          <div
                            className={`min-h-[10px] rounded-sm lg:min-h-[12px] ${item.positive ? "bg-[#0F0F0F]/70" : "bg-[#C8323C]/40"}`}
                            style={{ width: `${Math.max(pct, 5)}%` }}
                          />
                        </div>
                        <span className={`w-24 shrink-0 text-right font-mono text-xs font-medium ${item.positive ? "text-[#0F0F0F]" : "text-[#C8323C]"}`}>
                          {item.positive ? "+" : ""}{item.value < 0 ? "-" : ""}${Math.abs(item.value).toLocaleString("es-CL")}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-[#E6E6E2] pt-2">
                  <span className="font-body text-sm font-semibold text-[#0F0F0F]">Flujo neto</span>
                  <span className="font-mono text-base font-bold text-[#C8323C] lg:text-lg">-$359.000</span>
                </div>
              </div>
            </FadeIn>

            {/* CARD 2 — Escenarios */}
            <FadeIn delay={200}>
              <div className="h-full rounded-xl border border-[#E6E6E2] bg-white p-5 shadow-sm">
                <h3 className="mb-3 font-body text-sm font-bold text-[#0F0F0F] sm:text-base">¿Qué pasa si el mercado cambia?</h3>
                <div className="flex items-center pb-2 text-[10px] text-[#71717A]">
                  <div className="w-[100px] shrink-0 sm:w-[110px]" />
                  <div className="flex-1 text-center">Flujo/mes</div>
                  <div className="flex-1 text-center">Utilidad 10a</div>
                  <div className="w-[52px] shrink-0 text-right sm:w-[60px]">Retorno</div>
                </div>
                <div>
                  {[
                    { icon: "🌧", label: "Pesimista", flujo: "-$485K", utilidad: "$20M", retorno: "1.8x", retornoColor: "text-[#71717A]", highlight: false },
                    { icon: "📊", label: "Base", flujo: "-$359K", utilidad: "$59M", retorno: "3.3x", retornoColor: "text-[#0F0F0F]", highlight: true },
                    { icon: "☀️", label: "Optimista", flujo: "-$249K", utilidad: "$104M", retorno: "5.1x", retornoColor: "text-[#0F0F0F]", highlight: false },
                  ].map((s, i, arr) => (
                    <div
                      key={s.label}
                      className={`flex items-center px-3 py-2.5 ${i < arr.length - 1 ? "border-b border-[#E6E6E2]/50" : ""} ${s.highlight ? "rounded-lg bg-[#FAFAF8]" : ""}`}
                    >
                      <div className="flex w-[100px] shrink-0 items-center gap-1.5 sm:w-[110px]">
                        <span className="text-sm">{s.icon}</span>
                        <span className="font-body text-xs font-medium text-[#0F0F0F] sm:text-sm">{s.label}</span>
                      </div>
                      <div className="flex-1 text-center font-mono text-xs font-medium text-[#C8323C] sm:text-sm">{s.flujo}</div>
                      <div className="flex-1 text-center font-mono text-xs font-medium text-[#0F0F0F] sm:text-sm">{s.utilidad}</div>
                      <div className={`w-[52px] shrink-0 text-right font-mono text-base font-bold sm:w-[60px] sm:text-lg ${s.retornoColor}`}>{s.retorno}</div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>

            {/* CARD 3 — Patrimonio en el tiempo */}
            <FadeIn delay={300}>
              <div className="h-full rounded-xl border border-[#E6E6E2] bg-white p-5 shadow-sm">
                <h3 className="mb-3 font-body text-sm font-bold text-[#0F0F0F] sm:text-base">Tu patrimonio en el tiempo</h3>
                <div className="relative">
                  <svg viewBox="0 0 400 140" className="w-full" preserveAspectRatio="xMidYMid meet">
                    <defs>
                      <linearGradient id="patrimonioFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0F0F0F" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#0F0F0F" stopOpacity="0.03" />
                      </linearGradient>
                    </defs>
                    <line x1="40" y1="15" x2="40" y2="110" stroke="#E6E6E2" strokeWidth="1" />
                    <line x1="40" y1="110" x2="380" y2="110" stroke="#E6E6E2" strokeWidth="1" />
                    <line x1="40" y1="62" x2="380" y2="62" stroke="#E6E6E2" strokeWidth="0.5" strokeDasharray="4 4" />
                    <path d="M40,100 C100,96 160,84 210,68 C260,52 320,30 380,18 L380,110 L40,110 Z" fill="url(#patrimonioFill)" />
                    <path d="M40,100 C100,96 160,84 210,68 C260,52 320,30 380,18" fill="none" stroke="#0F0F0F" strokeWidth="2.5" strokeLinecap="round" />
                    <circle cx="210" cy="68" r="4" fill="#0F0F0F" />
                    <circle cx="210" cy="68" r="7" fill="none" stroke="#0F0F0F" strokeWidth="1.5" opacity="0.4" />
                    <line x1="210" y1="74" x2="210" y2="110" stroke="#0F0F0F" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.4" />
                    <text x="40" y="125" fontSize="10" fill="#71717A" textAnchor="middle">Hoy</text>
                    <text x="125" y="125" fontSize="10" fill="#71717A" textAnchor="middle">5 años</text>
                    <text x="210" y="125" fontSize="10" fill="#0F0F0F" fontWeight="600" textAnchor="middle">10 años</text>
                    <text x="380" y="125" fontSize="10" fill="#71717A" textAnchor="middle">20 años</text>
                  </svg>
                  <div className="mt-2 flex items-center justify-center gap-4 text-center sm:gap-6">
                    <div>
                      <div className="font-mono text-base font-bold text-[#0F0F0F] lg:text-lg">$114M</div>
                      <div className="font-body text-[10px] text-[#71717A]">patrimonio año 10</div>
                    </div>
                    <div className="h-8 w-px bg-[#E6E6E2]" />
                    <div>
                      <div className="font-mono text-base font-bold text-[#71717A] lg:text-lg">$43M</div>
                      <div className="font-body text-[10px] text-[#71717A]">de tu bolsillo</div>
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>

          {/* FILA 2 — Card IA full width */}
          <FadeIn delay={400}>
            <div className="mt-4 rounded-xl border border-[#E6E6E2] bg-white p-5 shadow-lg lg:p-6">
              <h3 className="mb-3 font-body text-sm font-bold text-[#0F0F0F] sm:text-base">Análisis IA — Sin jerga, con veredicto</h3>
              <div className="rounded-lg bg-[#FAFAF8] p-4 lg:flex lg:gap-6">
                <div className="lg:flex-1">
                  <p className="font-heading text-[13px] leading-relaxed text-[#0F0F0F]/70 sm:text-sm">
                    &ldquo;Este departamento tiene flujo negativo de $359.000 mensuales. El arriendo cubre el 54% de los costos totales. Sin embargo, la plusvalía proyectada de Providencia y el retorno de 3.3x en 10 años lo hacen viable como inversión patrimonial de largo plazo — si puedes mantener el aporte mensual.&rdquo;
                  </p>
                </div>
                <div className="relative mt-3 border-t border-[#E6E6E2] pt-3 lg:mt-0 lg:w-[280px] lg:shrink-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
                  <div className="space-y-1.5 select-none" style={{ filter: "blur(3px)" }}>
                    <p className="font-body text-[13px] text-[#0F0F0F]/70">Precio sugerido de negociación: UF 2.950 (-7.8%)</p>
                    <p className="font-body text-[13px] text-[#0F0F0F]/70">Comparación vs depósito a plazo: retorno 1.4x mayor en 10 años</p>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="rounded-full bg-[#C8323C] px-3 py-1 font-mono text-xs font-bold text-white shadow-md">PRO</span>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* CTA */}
          <FadeIn delay={500}>
            <div className="mt-10 text-center sm:mt-14">
              <Link href="/analisis/6db7a9ac-f030-4ccf-b5a8-5232ae997fb1" className="inline-flex items-center gap-1.5 font-body text-base font-semibold text-[#C8323C] transition-colors hover:text-[#C8323C]/80 hover:underline">
                Ver un análisis real completo <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-2 font-body text-sm text-[#71717A]">Es gratis. No necesitas registrarte para verlo.</p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============ 6. NO TODOS LOS DEPTOS SON IGUALES ============ */}
      <section className="bg-[#FAFAF8] px-6 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <h2 className="text-center font-heading text-3xl font-bold tracking-tight text-[#0F0F0F] md:text-4xl">
              No todos los deptos son iguales
            </h2>
            <p className="mt-4 text-center font-body text-[#71717A]">
              El mismo presupuesto, tres resultados muy distintos. El score te dice cuáles valen la pena.
            </p>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="mt-10 flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory sm:gap-6 md:grid md:grid-cols-3 md:overflow-visible md:pb-0 md:snap-none">
              {[
                {
                  score: 45, label: "BUSCAR OTRA",
                  labelColor: "text-[#DC2626]",
                  borderBottom: "border-b-[#DC2626]",
                  title: "Depto 1D1B", comuna: "Santiago Centro",
                  yield: "3.2%", flujo: "-$380.000", flujoColor: "text-[#C8323C]",
                },
                {
                  score: 54, label: "NEGOCIAR",
                  labelColor: "text-[#C8323C]",
                  borderBottom: "border-b-[#C8323C]",
                  title: "Depto 2D1B", comuna: "Providencia",
                  yield: "4.0%", flujo: "-$359.000", flujoColor: "text-[#C8323C]",
                },
                {
                  score: 78, label: "COMPRAR",
                  labelColor: "text-[#16A34A]",
                  borderBottom: "border-b-[#16A34A]",
                  title: "Depto 2D2B", comuna: "La Florida",
                  yield: "5.8%", flujo: "+$45.000", flujoColor: "text-[#16A34A]",
                },
              ].map((card) => (
                <div
                  key={card.score}
                  className={`min-w-[220px] shrink-0 snap-center rounded-xl border border-[#E6E6E2] border-b-2 ${card.borderBottom} bg-white p-5 transition-all duration-200 hover:shadow-md sm:min-w-[240px] md:min-w-0 md:shrink`}
                >
                  <div className="flex items-center gap-3">
                    <div className="font-heading text-3xl font-bold text-[#0F0F0F]">{card.score}</div>
                    <div>
                      <div className={`font-mono text-xs font-bold ${card.labelColor}`}>{card.label}</div>
                      <div className="font-body text-[15px] font-semibold text-[#0F0F0F]">{card.title}</div>
                      <div className="font-body text-[13px] text-[#71717A]">{card.comuna}</div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-body text-sm text-[#71717A]">Rent. Bruta</span>
                      <span className="font-mono text-sm font-medium text-[#0F0F0F]">{card.yield}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-body text-sm text-[#71717A]">Flujo mensual</span>
                      <span className={`font-mono text-sm font-medium ${card.flujoColor}`}>{card.flujo}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============ 7. CHECKLIST ============ */}
      <section className="bg-white px-6 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <h2 className="text-center font-heading text-3xl font-bold tracking-tight text-[#0F0F0F] md:text-4xl">
              Toda la información que tu corredor no te va a dar
            </h2>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-3 lg:grid-cols-2">
              {[
                "Flujo real: cuánto vas a poner de tu bolsillo cada mes, con todos los costos",
                "Punto de equilibrio: a qué tasa de interés tu flujo se hace cero",
                "Precio de mercado: si estás pagando más o menos que el promedio de la zona",
                "Comparación: cómo rinde vs depósito a plazo u otras alternativas",
                "Escenarios: qué pasa con tu inversión si suben las tasas o baja el arriendo",
                "Proyección real: cuánto vale tu patrimonio en 5, 10 y 20 años",
              ].map((text) => (
                <div key={text} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0F0F0F]" />
                  <span className="font-body text-sm text-[#71717A] sm:text-base">{text}</span>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center font-body text-sm text-[#71717A]">
              Todo basado en datos públicos del Banco Central, SII y CMF. Sin supuestos mágicos.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ============ 8. PRICING COMPACTO ============ */}
      <section className="bg-[#FAFAF8] px-6 py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <h2 className="text-center font-heading text-3xl font-bold tracking-tight text-[#0F0F0F]">
              Gratis. En serio.
            </h2>
            <p className="mt-3 text-center font-body text-[#71717A]">
              Tu primer análisis completo sin pagar nada. El informe Pro va más profundo.
            </p>
          </FadeIn>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <FadeIn delay={100}>
              <div className="rounded-xl border border-[#E6E6E2] bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-body text-lg font-bold text-[#0F0F0F]">Gratis</h3>
                  <span className="font-heading text-3xl font-bold text-[#0F0F0F]">$0</span>
                </div>
                <p className="mt-3 font-body text-sm leading-relaxed text-[#71717A]">
                  Score de inversión + métricas de rentabilidad + análisis de sensibilidad + comparación con la zona.
                </p>
                <div className="mt-4 space-y-2">
                  {["Franco Score (1-100)", "Rentabilidad bruta y neta", "Flujo mensual real", "Sensibilidad a tasas", "Comparación zona"].map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-[#0F0F0F]" />
                      <span className="font-body text-sm text-[#71717A]">{f}</span>
                    </div>
                  ))}
                </div>
                <Link href="/register" className="mt-5 block">
                  <Button className="w-full rounded-lg bg-[#0F0F0F] text-white transition-colors hover:bg-[#0F0F0F]/90">
                    Comenzar gratis
                  </Button>
                </Link>
              </div>
            </FadeIn>
            <FadeIn delay={200}>
              <div className="relative rounded-xl border-2 border-[#C8323C] bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md">
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded bg-[#C8323C] px-3 py-0.5 font-mono text-[11px] font-bold text-white">
                  Completo
                </div>
                <div className="flex items-baseline justify-between">
                  <h3 className="font-body text-lg font-bold text-[#0F0F0F]">Informe Pro</h3>
                  <span className="font-heading text-3xl font-bold text-[#0F0F0F]">$4.990</span>
                </div>
                <p className="mt-3 font-body text-sm leading-relaxed text-[#71717A]">
                  Todo lo gratis + análisis IA completo + proyecciones a 20 años + escenarios de salida y refinanciamiento.
                </p>
                <div className="mt-4 space-y-2">
                  {["Todo lo del plan gratis", "Análisis IA personalizado", "Proyección patrimonio 20 años", "Escenarios de salida", "Precio sugerido de negociación"].map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-[#0F0F0F]" />
                      <span className="font-body text-sm text-[#71717A]">{f}</span>
                    </div>
                  ))}
                </div>
                <Link href={user ? "/analisis/nuevo" : "/register"} className="mt-5 block">
                  <Button className="w-full rounded-lg bg-[#C8323C] font-bold text-white transition-colors hover:bg-[#C8323C]/90">
                    Desbloquear la verdad <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ============ 8b. SOLO DATOS. CERO COMISIONES. ============ */}
      <section className="bg-white px-6 py-16 md:py-24">
        <div className="mx-auto max-w-6xl text-center">
          <FadeIn>
            <h2 className="font-heading text-3xl font-bold tracking-tight text-[#0F0F0F] md:text-4xl">
              Solo datos. Cero comisiones.
            </h2>
            <p className="mx-auto mt-4 max-w-xl font-body text-[#71717A]">
              Franco no vende propiedades. No cobra comisiones. No trabaja para inmobiliarias. Analizamos datos públicos para que tú tengas la información completa antes de decidir.
            </p>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="mt-8 flex items-center justify-center gap-6 sm:gap-10">
              {[
                {
                  label: "Banco Central",
                  icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#71717A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/><path d="M9 10h1"/><path d="M14 10h1"/><path d="M9 14h1"/><path d="M14 14h1"/></svg>,
                },
                {
                  label: "SII",
                  icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#71717A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
                },
                {
                  label: "CMF",
                  icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#71717A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>,
                },
              ].map((source) => (
                <div key={source.label} className="flex flex-col items-center gap-1.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F0F0EC]">
                    {source.icon}
                  </div>
                  <span className="font-body text-[11px] font-medium text-[#71717A] sm:text-xs">{source.label}</span>
                </div>
              ))}
            </div>
          </FadeIn>
          <FadeIn delay={200}>
            <p className="mx-auto mt-8 max-w-xl font-body text-sm text-[#71717A]">
              ¿Y ChatGPT? Puedes usarlo, pero inventa datos de arriendo, te da un resultado distinto cada vez, y no guarda nada. Franco usa datos reales, metodología consistente, y gráficos claros.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ============ 9. CTA FINAL ============ */}
      <section className="bg-[#0F0F0F] px-6 py-20 md:py-24">
        <div className="mx-auto max-w-6xl text-center">
          <FadeIn>
            <h2 className="font-heading text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">
              Antes de firmar, sé franco.
            </h2>
            <p className="mx-auto mt-3 max-w-xl font-body text-white/60">
              Tu corredor gana si compras. Franco gana si decides bien.
            </p>
            <div className="mt-6">
              <Link href="/analisis/nuevo">
                <Button className="rounded-lg bg-[#C8323C] px-8 py-4 font-body text-base font-bold text-white transition-colors hover:bg-[#C8323C]/90">
                  Analizar propiedad gratis <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <p className="mt-4 font-body text-sm text-white/40">Tu primer análisis en 30 segundos</p>
            {analysisCount !== null && analysisCount >= 50 && (
              <p className="mt-3 font-body text-xs text-white/30">
                Ya analizaron {analysisCount.toLocaleString("es-CL")} propiedades con Franco
              </p>
            )}
          </FadeIn>
        </div>
      </section>

      {/* ============ 10. FOOTER ============ */}
      <footer className="bg-[#0F0F0F] px-6 py-10 sm:py-14">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-10 md:flex-row md:justify-between">
            <div className="shrink-0">
              <FrancoLogo size="md" inverted showTagline />
            </div>
            <div className="grid grid-cols-3 gap-8 text-sm">
              <div>
                <h4 className="font-body text-xs uppercase tracking-wider text-white/40">Producto</h4>
                <div className="mt-3 flex flex-col gap-2">
                  <Link href="/analisis/nuevo" className="font-body text-white/60 transition-colors hover:text-white/80">Nuevo análisis</Link>
                  <Link href="/dashboard" className="font-body text-white/60 transition-colors hover:text-white/80">Dashboard</Link>
                  <Link href="/pricing" className="font-body text-white/60 transition-colors hover:text-white/80">Pricing</Link>
                </div>
              </div>
              <div>
                <h4 className="font-body text-xs uppercase tracking-wider text-white/40">Empresa</h4>
                <div className="mt-3 flex flex-col gap-2">
                  <Link href="/" className="font-body text-white/60 transition-colors hover:text-white/80">Inicio</Link>
                  <Link href="/login" className="font-body text-white/60 transition-colors hover:text-white/80">Iniciar sesión</Link>
                  <Link href="/register" className="font-body text-white/60 transition-colors hover:text-white/80">Registrarse</Link>
                </div>
              </div>
              <div>
                <h4 className="font-body text-xs uppercase tracking-wider text-white/40">Legal</h4>
                <div className="mt-3 flex flex-col gap-2">
                  <span className="font-body text-white/60">Datos: Banco Central, SII, CMF</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 border-t border-white/10 pt-6 text-center">
            <p className="font-body text-xs text-white/30">
              &copy; 2026 refranco.ai — No somos asesores financieros. Somos francos.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
