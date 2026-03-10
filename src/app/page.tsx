"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Check,
  Menu,
  X as XIcon,
  LogOut,
  ShieldCheck,
  Database,
  Bot,
  ChevronDown,
  LayoutDashboard,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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
      className={`transition-gpu ${className}`}
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
        className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-gray-300 text-[10px] font-medium leading-none text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-600"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        ?
      </span>
      {show && (
        <span
          className={`absolute z-50 w-[220px] sm:w-[250px] rounded-lg bg-gray-900 px-3 py-2 text-xs leading-relaxed text-white shadow-lg ${
            pos === "above" ? "bottom-full mb-2" : "top-full mt-2"
          } left-1/2 -translate-x-1/2`}
        >
          {text}
          <span className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
            pos === "above" ? "top-full border-t-gray-900" : "bottom-full border-b-gray-900"
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
  const [scrolled, setScrolled] = useState(false);
  const [showChevron, setShowChevron] = useState(true);
  const [analysisCount, setAnalysisCount] = useState<number | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  const handleScroll = useCallback(() => {
    setScrolled(window.scrollY > window.innerHeight * 0.8);
    setShowChevron(window.scrollY < 100);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

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
    <div className="overflow-x-hidden bg-white text-[#1a1a1a]">
      <style jsx global>{`
        @keyframes scoreGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(217,119,6,0.2), 0 0 40px rgba(217,119,6,0.1); }
          50% { box-shadow: 0 0 30px rgba(217,119,6,0.35), 0 0 60px rgba(217,119,6,0.15); }
        }
        @keyframes bounceDown {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(8px); }
        }
        @media (max-width: 767px) {
          .transition-gpu { transition-duration: 0.4s !important; }
        }
      `}</style>

      {/* ============ NAVBAR ============ */}
      <nav
        className={`fixed top-0 z-50 w-full transition-all duration-300 ${
          scrolled
            ? "bg-white/95 shadow-sm backdrop-blur-md"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="font-serif text-xl font-bold text-[#1a1a1a]">
            InvertiScore
          </Link>
          <div className="hidden items-center gap-6 sm:flex">
            <Link href="/pricing" className="text-sm text-[#6b7280] transition-colors duration-200 hover:text-[#1a1a1a]">
              Pricing
            </Link>
            {user ? (
              <>
                <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-[#6b7280] transition-colors duration-200 hover:text-[#1a1a1a]">
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </Link>
                <button
                  onClick={async () => {
                    const supabase = createClient();
                    await supabase.auth.signOut();
                    setUser(null);
                    router.refresh();
                  }}
                  className="flex items-center gap-1.5 text-sm text-[#6b7280] transition-colors duration-200 hover:text-[#1a1a1a]"
                >
                  <LogOut className="h-4 w-4" /> Cerrar Sesión
                </button>
              </>
            ) : (
              <Link href="/login" className="text-sm text-[#6b7280] transition-colors duration-200 hover:text-[#1a1a1a]">
                Iniciar Sesión
              </Link>
            )}
            <Link href="/analisis/nuevo">
              <Button size="sm" className="rounded-xl bg-[#059669] text-white transition-all duration-200 hover:bg-[#047857] hover:shadow-md hover:shadow-[#059669]/20">
                Analizar gratis
              </Button>
            </Link>
          </div>
          <button className="p-2 text-[#6b7280] sm:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menu">
            {mobileMenuOpen ? <XIcon className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="border-t border-[#e5e7eb] bg-white px-4 py-4 sm:hidden">
            <div className="flex flex-col gap-3">
              <Link href="/pricing" onClick={() => setMobileMenuOpen(false)} className="text-sm text-[#6b7280]">Pricing</Link>
              {user ? (
                <>
                  <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-1.5 text-sm text-[#6b7280]">
                    <LayoutDashboard className="h-4 w-4" /> Dashboard
                  </Link>
                  <button
                    onClick={async () => {
                      const supabase = createClient();
                      await supabase.auth.signOut();
                      setUser(null);
                      setMobileMenuOpen(false);
                      router.refresh();
                    }}
                    className="flex items-center gap-1.5 text-sm text-[#6b7280]"
                  >
                    <LogOut className="h-4 w-4" /> Cerrar Sesión
                  </button>
                </>
              ) : (
                <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="text-sm text-[#6b7280]">Iniciar Sesión</Link>
              )}
              <Link href="/analisis/nuevo" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full rounded-xl bg-[#059669] text-white hover:bg-[#047857]">Analizar gratis</Button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ============ 1. HERO — 100vh ============ */}
      <section className="relative flex min-h-[80vh] flex-col items-center justify-center px-4 sm:min-h-screen sm:px-6" style={{ background: "linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%)" }}>
        <div className="mx-auto grid max-w-5xl items-center gap-8 lg:gap-12 lg:grid-cols-[3fr,2fr]">
          <div className="text-center lg:text-left">
            <FadeIn>
              <h1 className="font-serif text-[26px] font-bold leading-tight tracking-tight text-[#111827] sm:text-4xl lg:text-[48px] lg:leading-[1.15]">
                La mayoría de los deptos de inversión en Santiago pierden plata cada mes.
              </h1>
            </FadeIn>
            <FadeIn delay={100}>
              <p className="mx-auto mt-8 max-w-xl text-lg text-[#6b7280] lg:mx-0 lg:text-xl">
                Eso no aparece en la cotización. Nosotros te lo mostramos.
              </p>
            </FadeIn>
            <FadeIn delay={200}>
              <p className="mx-auto mt-4 max-w-2xl text-base text-[#9ca3af] lg:mx-0 lg:text-lg">
                InvertiScore analiza cualquier propiedad en Chile y te dice la verdad en 30 segundos. Sin sesgos, sin comisiones, sin letra chica.
              </p>
            </FadeIn>
            <FadeIn delay={300}>
              <div className="mt-10">
                <Link href="/analisis/nuevo">
                  <Button size="lg" className="w-full gap-2 rounded-xl bg-[#059669] px-8 py-6 text-base text-white shadow-lg shadow-[#059669]/25 transition-all duration-200 hover:bg-[#047857] hover:shadow-xl hover:shadow-[#059669]/30 sm:w-auto">
                    Analiza gratis tu próxima inversión <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <p className="mt-4 text-sm text-[#9ca3af]">Sin tarjeta de crédito · Tu primer análisis en 30 segundos</p>
              </div>
            </FadeIn>
          </div>
          <FadeIn delay={400}>
            <div className="flex justify-center lg:justify-end">
              <div className="inline-flex max-w-[280px] flex-row items-center gap-3 rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 shadow-xl shadow-black/5 sm:max-w-none sm:flex-col sm:gap-5 sm:px-8 sm:py-7">
                <div
                  className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full border-[3px] border-[#d97706] sm:h-24 sm:w-24"
                  style={{ animation: "scoreGlow 3s ease-in-out infinite" }}
                >
                  <div className="text-center">
                    <div className="text-xl font-bold text-[#d97706] sm:text-3xl">54</div>
                    <div className="text-[7px] text-[#9ca3af] sm:text-[9px]">SCORE</div>
                  </div>
                </div>
                <div className="min-w-0 sm:text-center">
                  <div className="text-sm font-semibold text-[#111827] sm:text-base">Regular</div>
                  <div className="text-xs text-[#9ca3af] sm:text-sm">Depto 2D1B · Providencia</div>
                  <div className="mt-2 flex gap-3 text-xs sm:hidden">
                    <span className="text-[#6b7280] font-semibold">4.0%</span>
                    <span className="text-red-500 font-semibold">-$359K</span>
                    <span className="text-[#059669] font-semibold">3.3x</span>
                  </div>
                </div>
                <div className="hidden w-full space-y-2 border-t border-[#f3f4f6] pt-4 sm:block">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6b7280]">Rent. Bruta</span>
                    <span className="font-semibold text-[#6b7280]">4.0%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6b7280]">Flujo mensual</span>
                    <span className="font-semibold text-red-500">-$359.000</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6b7280]">Retorno 10 años</span>
                    <span className="font-semibold text-[#059669]">3.3x</span>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 transition-opacity duration-500"
          style={{ opacity: showChevron ? 0.5 : 0, animation: "bounceDown 2s ease-in-out infinite" }}
        >
          <ChevronDown className="h-6 w-6 text-[#9ca3af]" />
        </div>
      </section>

      {/* ============ 2. EJEMPLO REAL ============ */}
      <section className="bg-white px-4 py-12 sm:px-6 md:py-[100px]">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <h2 className="text-center font-serif text-2xl font-bold text-[#111827] sm:text-3xl md:text-4xl">
              Lo que tu corredor te muestra vs lo que no te dice
            </h2>
          </FadeIn>
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {/* Card IZQUIERDA — Lo que tu corredor te dice */}
            <SlideIn delay={100} direction="left">
              <div className="group h-full rounded-2xl border border-[#e5e7eb] bg-white p-4 transition-all duration-200 hover:shadow-md sm:p-6">
                <div className="mb-5 text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Lo que tu corredor te dice</div>
                <h3 className="text-lg font-bold text-[#1a1a1a]">Depto 2D1B en Providencia</h3>
                <div className="my-4 h-px bg-[#e5e7eb]" />
                <div className="space-y-0">
                  <div className="flex items-center justify-between border-b border-gray-100 py-3">
                    <span className="text-sm text-gray-600">Precio</span>
                    <span className="text-sm font-semibold text-[#1a1a1a]">UF 3.200</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-gray-100 py-3">
                    <span className="text-sm text-gray-600">Arriendo</span>
                    <span className="text-sm font-semibold text-[#1a1a1a]">$420.000/mes</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-gray-100 py-3">
                    <span className="flex items-center text-sm text-gray-600">Rent. Bruta<TooltipIcon text="Rentabilidad anual bruta: arriendo anual dividido por el precio. No descuenta ningún gasto." /></span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-600">4.0%</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-gray-100 py-3">
                    <span className="text-sm text-gray-600">Flujo mensual</span>
                    <span className="text-sm italic text-gray-400">No informado</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-sm text-gray-600">Conclusión</span>
                    <span className="text-sm font-semibold italic text-emerald-600">&ldquo;Excelente oportunidad!&rdquo;</span>
                  </div>
                </div>
              </div>
            </SlideIn>
            {/* Card DERECHA — Lo que InvertiScore te muestra */}
            <SlideIn delay={200} direction="right">
              <div
                className="group h-full rounded-2xl border-2 border-[#059669] p-4 transition-all duration-200 hover:shadow-lg sm:p-6"
                style={{ background: "linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)", boxShadow: "0 4px 20px rgba(5,150,105,0.15)" }}
              >
                <div className="mb-5 text-xs font-semibold uppercase tracking-wider text-[#059669]">Lo que InvertiScore te muestra</div>
                <h3 className="text-lg font-bold text-[#1a1a1a]">Depto 2D1B en Providencia</h3>
                <div className="my-4 h-px bg-[#d1fae5]" />
                <div className="space-y-0">
                  <div className="flex items-center justify-between border-b border-gray-100 py-3">
                    <span className="flex items-center text-sm text-gray-600">Flujo mensual<TooltipIcon text="Ingreso por arriendo menos todos los gastos: dividendo, GGCC, contribuciones, seguro, mantención y vacancia" /></span>
                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-sm font-semibold text-red-600">-$359.000</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-gray-100 py-3">
                    <span className="flex items-center text-sm text-gray-600">Cash-on-Cash<TooltipIcon text="Retorno anual sobre el capital que pusiste de tu bolsillo (pie + gastos)" /></span>
                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-sm font-semibold text-red-600">-17.8%</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-gray-100 py-3">
                    <span className="flex items-center text-sm text-gray-600">Rent. Neta<TooltipIcon text="Rentabilidad después de TODOS los gastos: operativos, vacancia, corretaje y recambio de arrendatario." /></span>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-sm font-semibold text-amber-600">2.07%</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="flex items-center text-sm text-gray-600">Plusvalía 10 años<TooltipIcon text="Cuántas veces se multiplica tu inversión inicial en 10 años considerando plusvalía del sector" /></span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-600">3.3x</span>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-3 rounded-xl bg-white/80 p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#d97706] bg-amber-50">
                    <span className="text-sm font-bold text-[#d97706]">54</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#1a1a1a]">Score: 54 <span className="text-[#d97706]">&ldquo;Regular&rdquo;</span></div>
                  </div>
                </div>
                <p className="mt-3 text-sm font-medium text-red-500">Pones $4.3M al año de tu bolsillo</p>
              </div>
            </SlideIn>
          </div>
          <FadeIn delay={300}>
            <p className="mt-10 text-center text-base text-[#6b7280]">
              El mismo departamento. Los mismos datos. La diferencia es quién te los muestra — y qué gana con eso.
            </p>
            <div className="mt-6 text-center">
              <Link href="/analisis/nuevo" className="inline-flex items-center gap-1 font-medium text-[#059669] transition-colors duration-200 hover:text-[#047857] hover:underline">
                Pruébalo con tu propiedad <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============ SOCIAL PROOF ============ */}
      <section className="bg-[#f5f5f5] px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn>
            <p className="text-base font-bold text-[#111827] sm:text-lg">
              Análisis respaldado por datos públicos oficiales
            </p>
            <div className="mt-4 flex items-center justify-center gap-6 sm:gap-10">
              {/* Banco Central */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e5e7eb]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/><path d="M9 10h1"/><path d="M14 10h1"/><path d="M9 14h1"/><path d="M14 14h1"/></svg>
                </div>
                <span className="text-[11px] font-medium text-[#374151] sm:text-xs">Banco Central</span>
              </div>
              {/* SII */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e5e7eb]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <span className="text-[11px] font-medium text-[#374151] sm:text-xs">SII</span>
              </div>
              {/* CMF */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e5e7eb]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
                </div>
                <span className="text-[11px] font-medium text-[#374151] sm:text-xs">CMF</span>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============ 3. POR QUE PASA ESTO ============ */}
      <section className="px-4 py-12 sm:px-6 md:py-[100px]" style={{ background: "linear-gradient(180deg, #fafafa 0%, #ffffff 100%)" }}>
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <h2 className="text-center font-serif text-2xl font-bold text-[#111827] sm:text-3xl md:text-4xl">
              ¿Por qué tu corredor no te muestra estos números?
            </h2>
          </FadeIn>
          <div className="mt-10 grid items-stretch gap-6 lg:grid-cols-3">
            {[
              { emoji: "💰", bg: "bg-red-50", title: "Su comisión: $3.5M. Tu riesgo: $359.000 al mes.", desc: "Un corredor gana entre 1% y 2% del precio de venta. En un depto de 3.200 UF, eso son $2.5 a $5 millones. Los cobra el día que firmas. Si el depto pierde plata, ese ya es tu problema — él ya cobró." },
              { emoji: "📊", bg: "bg-amber-50", title: "Te muestra rent. bruta de 4%. No te dice que el flujo es -$359.000.", desc: "La rentabilidad bruta no descuenta nada: ni dividendo, ni gastos comunes, ni contribuciones, ni vacancia. El flujo real — cuánto sale de tu bolsillo cada mes — es lo que importa. Y nunca aparece en la cotización." },
              { emoji: "🛡️", bg: "bg-emerald-50", title: "Si la inversión sale mal, el corredor no devuelve la comisión.", desc: "Tú asumes todo el riesgo por 25 años. El corredor desaparece después de la firma. InvertiScore no te vende propiedades ni cobra comisiones de venta. Nuestro único incentivo es que tengas la información completa antes de decidir." },
            ].map((item, i) => (
              <FadeIn key={item.title} delay={i * 150}>
                <div className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md">
                  <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${item.bg}`}>
                    <span className="text-2xl">{item.emoji}</span>
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-gray-900">{item.title}</h3>
                  <p className="flex-1 text-sm leading-relaxed text-gray-500">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 4. PRODUCT SHOWCASE ============ */}
      <section className="px-4 py-12 sm:px-6 md:py-[100px]" style={{ background: "#f0fdf4" }}>
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <h2 className="text-center font-serif text-2xl font-bold text-[#111827] sm:text-3xl md:text-4xl">
              Esto es lo que vas a ver
            </h2>
            <p className="mt-4 text-center text-[#6b7280]">
              No una lista de features. El análisis real de un depto en Providencia.
            </p>
          </FadeIn>

          {/* FILA 1 — 3 cards */}
          <div className="mt-10 grid grid-cols-1 gap-4 sm:mt-14 lg:grid-cols-3 lg:items-stretch">
            {/* CARD 1 — Cascada de costos */}
            <FadeIn delay={100}>
              <div className="h-full rounded-xl border border-[#e5e7eb] bg-white p-4 sm:p-5">
                <h3 className="mb-3 text-sm font-semibold text-[#111827] sm:text-base">A dónde va tu plata cada mes</h3>
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
                        <span className="w-28 shrink-0 text-xs text-[#6b7280]">{item.label}</span>
                        <div className="flex-1 overflow-hidden">
                          <div
                            className={`min-h-[10px] rounded-sm lg:min-h-[12px] ${item.positive ? "bg-[#059669]/70" : "bg-red-400/60"}`}
                            style={{ width: `${Math.max(pct, 5)}%` }}
                          />
                        </div>
                        <span className={`w-24 shrink-0 text-right text-xs font-medium ${item.positive ? "text-[#059669]" : "text-red-500"}`}>
                          {item.positive ? "+" : ""}{item.value < 0 ? "-" : ""}${Math.abs(item.value).toLocaleString("es-CL")}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 border-t border-[#e5e7eb] pt-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#111827]">Flujo neto</span>
                  <span className="text-base font-bold text-red-500 lg:text-lg">-$359.000</span>
                </div>
              </div>
            </FadeIn>

            {/* CARD 2 — Escenarios */}
            <FadeIn delay={200}>
              <div className="h-full rounded-xl border border-[#e5e7eb] bg-white p-4 sm:p-5">
                <h3 className="mb-3 text-sm font-semibold text-[#111827] sm:text-base">¿Qué pasa si el mercado cambia?</h3>
                {/* Header */}
                <div className="flex items-center pb-2 text-[10px] text-[#9ca3af]">
                  <div className="w-[100px] shrink-0 sm:w-[110px]" />
                  <div className="flex-1 text-center">Flujo/mes</div>
                  <div className="flex-1 text-center">Utilidad 10a</div>
                  <div className="w-[52px] shrink-0 text-right sm:w-[60px]">Retorno</div>
                </div>
                {/* Rows */}
                <div>
                  {[
                    { icon: "🌧", label: "Pesimista", flujo: "-$485K", utilidad: "$20M", retorno: "1.8x", retornoColor: "text-[#d97706]", highlight: false },
                    { icon: "📊", label: "Base", flujo: "-$359K", utilidad: "$59M", retorno: "3.3x", retornoColor: "text-[#059669]", highlight: true },
                    { icon: "☀️", label: "Optimista", flujo: "-$249K", utilidad: "$104M", retorno: "5.1x", retornoColor: "text-[#059669]", highlight: false },
                  ].map((s, i, arr) => (
                    <div
                      key={s.label}
                      className={`flex items-center px-3 py-2.5 ${i < arr.length - 1 ? "border-b border-[#f3f4f6]" : ""} ${s.highlight ? "rounded-lg bg-emerald-50/50" : ""}`}
                    >
                      <div className="flex w-[100px] shrink-0 items-center gap-1.5 sm:w-[110px]">
                        <span className="text-sm">{s.icon}</span>
                        <span className="text-xs font-medium text-[#111827] sm:text-sm">{s.label}</span>
                      </div>
                      <div className="flex-1 text-center text-xs font-semibold text-red-500 sm:text-sm">{s.flujo}</div>
                      <div className="flex-1 text-center text-xs font-semibold text-[#059669] sm:text-sm">{s.utilidad}</div>
                      <div className={`w-[52px] shrink-0 text-right text-base font-bold sm:w-[60px] sm:text-lg ${s.retornoColor}`}>{s.retorno}</div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>

            {/* CARD 3 — Patrimonio en el tiempo */}
            <FadeIn delay={300}>
              <div className="h-full rounded-xl border border-[#e5e7eb] bg-white p-4 sm:p-5">
                <h3 className="mb-3 text-sm font-semibold text-[#111827] sm:text-base">Tu patrimonio en el tiempo</h3>
                <div className="relative">
                  <svg viewBox="0 0 400 140" className="w-full" preserveAspectRatio="xMidYMid meet">
                    <defs>
                      <linearGradient id="patrimonioFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#059669" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#059669" stopOpacity="0.03" />
                      </linearGradient>
                    </defs>
                    <line x1="40" y1="15" x2="40" y2="110" stroke="#e5e7eb" strokeWidth="1" />
                    <line x1="40" y1="110" x2="380" y2="110" stroke="#e5e7eb" strokeWidth="1" />
                    <line x1="40" y1="62" x2="380" y2="62" stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="4 4" />
                    <path d="M40,100 C100,96 160,84 210,68 C260,52 320,30 380,18 L380,110 L40,110 Z" fill="url(#patrimonioFill)" />
                    <path d="M40,100 C100,96 160,84 210,68 C260,52 320,30 380,18" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" />
                    <circle cx="210" cy="68" r="4" fill="#059669" />
                    <circle cx="210" cy="68" r="7" fill="none" stroke="#059669" strokeWidth="1.5" opacity="0.4" />
                    <line x1="210" y1="74" x2="210" y2="110" stroke="#059669" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.4" />
                    <text x="40" y="125" fontSize="10" fill="#9ca3af" textAnchor="middle">Hoy</text>
                    <text x="125" y="125" fontSize="10" fill="#9ca3af" textAnchor="middle">5 años</text>
                    <text x="210" y="125" fontSize="10" fill="#059669" fontWeight="600" textAnchor="middle">10 años</text>
                    <text x="380" y="125" fontSize="10" fill="#9ca3af" textAnchor="middle">20 años</text>
                  </svg>
                  <div className="mt-2 flex items-center justify-center gap-4 text-center sm:gap-6">
                    <div>
                      <div className="text-base font-bold text-[#059669] lg:text-lg">$114M</div>
                      <div className="text-[10px] text-[#6b7280]">patrimonio año 10</div>
                    </div>
                    <div className="h-8 w-px bg-[#e5e7eb]" />
                    <div>
                      <div className="text-base font-bold text-[#6b7280] lg:text-lg">$43M</div>
                      <div className="text-[10px] text-[#6b7280]">de tu bolsillo</div>
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>

          {/* FILA 2 — Card IA full width */}
          <FadeIn delay={400}>
            <div className="mt-4 rounded-xl border border-[#e5e7eb] bg-white p-4 sm:p-5 lg:p-6">
              <h3 className="mb-3 text-sm font-semibold text-[#111827] sm:text-base">Análisis IA — Sin jerga, con veredicto</h3>
              <div className="rounded-lg bg-[#f9fafb] p-4 lg:flex lg:gap-6">
                <div className="lg:flex-1">
                  <p className="font-serif text-[13px] leading-relaxed text-[#374151] sm:text-sm">
                    &ldquo;Este departamento tiene flujo negativo de $359.000 mensuales. El arriendo cubre el 54% de los costos totales. Sin embargo, la plusvalía proyectada de Providencia y el retorno de 3.3x en 10 años lo hacen viable como inversión patrimonial de largo plazo — si puedes mantener el aporte mensual.&rdquo;
                  </p>
                </div>
                <div className="relative mt-3 border-t border-[#e5e7eb] pt-3 lg:mt-0 lg:w-[280px] lg:shrink-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
                  <div className="space-y-1.5 select-none" style={{ filter: "blur(3px)" }}>
                    <p className="text-[13px] text-[#374151]">Precio sugerido de negociación: UF 2.950 (-7.8%)</p>
                    <p className="text-[13px] text-[#374151]">Comparación vs depósito a plazo: retorno 1.4x mayor en 10 años</p>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="rounded-full bg-[#059669] px-3 py-1 text-xs font-semibold text-white shadow-md">PRO</span>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* CTA */}
          <FadeIn delay={500}>
            <div className="mt-10 text-center sm:mt-14">
              <Link href="/analisis/6db7a9ac-f030-4ccf-b5a8-5232ae997fb1" className="inline-flex items-center gap-1.5 text-base font-semibold text-[#059669] transition-colors duration-200 hover:text-[#047857] hover:underline">
                Ver un análisis real completo <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-2 text-sm text-[#9ca3af]">Es gratis. No necesitas registrarte para verlo.</p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============ 5. NO TODOS LOS DEPTOS SON IGUALES ============ */}
      <section className="bg-[#fafafa] px-4 py-12 sm:px-6 md:py-[100px]">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <h2 className="text-center font-serif text-2xl font-bold text-[#111827] sm:text-3xl md:text-4xl">
              No todos los deptos son iguales
            </h2>
            <p className="mt-4 text-center text-[#6b7280]">
              El mismo presupuesto, tres resultados muy distintos. El score te dice cuáles valen la pena.
            </p>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="mt-10 flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory sm:gap-6 md:grid md:grid-cols-3 md:overflow-visible md:pb-0 md:snap-none">
              {[
                {
                  score: 45, color: "#ef4444", label: "Inversión Débil",
                  title: "Depto 1D1B", comuna: "Santiago Centro",
                  yield: "3.2%", yieldColor: "text-red-500",
                  flujo: "-$380.000", flujoColor: "text-red-500",
                  borderColor: "border-red-300", bgScore: "bg-red-50",
                },
                {
                  score: 54, color: "#f59e0b", label: "Regular",
                  title: "Depto 2D1B", comuna: "Providencia",
                  yield: "4.0%", yieldColor: "text-orange-500",
                  flujo: "-$359.000", flujoColor: "text-red-500",
                  borderColor: "border-amber-300", bgScore: "bg-amber-50",
                },
                {
                  score: 78, color: "#059669", label: "Inversión Buena",
                  title: "Depto 2D2B", comuna: "La Florida",
                  yield: "5.8%", yieldColor: "text-[#059669]",
                  flujo: "+$45.000", flujoColor: "text-[#059669]",
                  borderColor: "border-[#059669]/40", bgScore: "bg-emerald-50",
                },
              ].map((card) => (
                <div
                  key={card.score}
                  className={`min-w-[220px] shrink-0 snap-center rounded-2xl border ${card.borderColor} bg-white p-4 transition-all duration-200 hover:shadow-lg sm:min-w-[240px] sm:p-6 md:min-w-0 md:shrink`}
                  style={card.score === 78 ? { boxShadow: "0 4px 20px rgba(5,150,105,0.1)" } : {}}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 ${card.bgScore}`} style={{ borderColor: card.color }}>
                      <div className="text-center">
                        <div className="text-lg font-bold" style={{ color: card.color }}>{card.score}</div>
                        <div className="text-[7px] text-[#9ca3af]">SCORE</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-[13px] font-medium" style={{ color: card.color }}>{card.label}</div>
                      <div className="text-[15px] font-semibold text-[#111827]">{card.title}</div>
                      <div className="text-[13px] text-[#9ca3af]">{card.comuna}</div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#6b7280]">Rent. Bruta</span>
                      <span className={`font-semibold ${card.yieldColor}`}>{card.yield}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#6b7280]">Flujo mensual</span>
                      <span className={`font-semibold ${card.flujoColor}`}>{card.flujo}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============ 7. CHECKLIST ============ */}
      <section className="px-4 py-12 sm:px-6 md:py-[100px]" style={{ background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)" }}>
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <h2 className="text-center font-serif text-2xl font-bold text-[#111827] sm:text-3xl md:text-4xl">
              Toda la información que tu corredor no te va a dar
            </h2>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="mt-10 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {[
                "Flujo real: cuánto vas a poner de tu bolsillo cada mes, con todos los costos",
                "Punto de equilibrio: a qué tasa de interés tu flujo se hace cero",
                "Precio de mercado: si estás pagando más o menos que el promedio de la zona",
                "Comparación: cómo rinde vs depósito a plazo u otras alternativas",
                "Escenarios: qué pasa con tu inversión si suben las tasas o baja el arriendo",
                "Proyección real: cuánto vale tu patrimonio en 5, 10 y 20 años",
              ].map((text) => (
                <div key={text} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" />
                  <span className="text-sm text-[#374151] sm:text-base">{text}</span>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center text-sm text-[#9ca3af]">
              Todo basado en datos públicos del Banco Central, SII y CMF. Sin supuestos mágicos.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ============ 8. PRICING COMPACTO ============ */}
      <section className="bg-white px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <h2 className="text-center font-serif text-2xl font-bold text-[#111827] sm:text-3xl">
              Gratis. En serio.
            </h2>
          </FadeIn>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <FadeIn delay={100}>
              <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 transition-all duration-200 hover:shadow-md">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-base font-semibold text-[#1a1a1a]">Gratis</h3>
                  <span className="text-xl font-bold text-[#1a1a1a]">$0</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[#6b7280]">
                  Score de inversión + métricas de rentabilidad + análisis de sensibilidad + comparación con la zona.
                </p>
                <Link href="/register" className="mt-4 block">
                  <Button variant="outline" className="w-full rounded-xl border-[#e5e7eb] text-[#1a1a1a] transition-all duration-200 hover:bg-[#fafafa] hover:shadow-sm">
                    Comenzar gratis
                  </Button>
                </Link>
              </div>
            </FadeIn>
            <FadeIn delay={200}>
              <div className="relative rounded-xl border-2 border-[#059669] p-5 transition-all duration-200 hover:shadow-md" style={{ background: "linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)" }}>
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-[#059669] px-3 py-0.5 text-[11px] font-semibold text-white">
                  Popular
                </div>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-base font-semibold text-[#1a1a1a]">Informe Pro</h3>
                  <span className="text-xl font-bold text-[#1a1a1a]">$4.990</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[#6b7280]">
                  Todo lo gratis + análisis IA completo + proyecciones a 20 años + escenarios de salida y refinanciamiento.
                </p>
                <Link href={user ? "/analisis/nuevo" : "/register"} className="mt-4 block">
                  <Button className="w-full rounded-xl bg-[#059669] text-white shadow-md shadow-[#059669]/20 transition-all duration-200 hover:bg-[#047857] hover:shadow-lg hover:shadow-[#059669]/25">
                    Obtener informe <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ============ 9. CIERRE ============ */}
      <section className="bg-[#fafafa] px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn>
            <h2 className="font-serif text-2xl font-bold text-[#111827] sm:text-3xl">
              Solo datos. Cero comisiones.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[#6b7280]">
              InvertiScore no vende propiedades. No cobra comisiones. No trabaja para inmobiliarias. Analizamos datos públicos para que tú tengas la información completa antes de decidir.
            </p>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              {[
                { icon: ShieldCheck, text: "Sin comisiones" },
                { icon: Database, text: "Datos públicos" },
                { icon: Bot, text: "IA independiente" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-3 py-2 sm:px-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ecfdf5]">
                    <item.icon className="h-3 w-3 text-[#059669]" strokeWidth={1.5} />
                  </div>
                  <span className="text-xs font-medium text-[#374151] sm:text-sm">{item.text}</span>
                </div>
              ))}
            </div>
          </FadeIn>
          <FadeIn delay={200}>
            <p className="mx-auto mt-8 max-w-xl text-sm text-[#9ca3af]">
              ¿Y ChatGPT? Puedes usarlo, pero inventa datos de arriendo, te da un resultado distinto cada vez, y no guarda nada. InvertiScore usa datos reales, metodología consistente, y gráficos claros.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ============ 10. CTA FINAL ============ */}
      <section className="px-4 py-12 sm:px-6 sm:py-16" style={{ background: "#047857" }}>
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn>
            <h2 className="font-serif text-2xl font-bold leading-tight text-white sm:text-3xl md:text-4xl">
              Antes de firmar, conoce los números reales.
            </h2>
            <div className="mt-8">
              <Link href="/analisis/nuevo">
                <Button size="lg" className="w-full gap-2 rounded-xl bg-white px-8 py-6 text-base font-semibold text-[#047857] shadow-lg transition-all duration-200 hover:bg-[#f0fdf4] hover:shadow-xl sm:w-auto">
                  Empieza ahora — es gratis <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-white/70">Tu primer análisis en 30 segundos</p>
            {analysisCount !== null && analysisCount >= 50 && (
              <p className="mt-3 text-xs text-white/40">
                Ya analizaron {analysisCount.toLocaleString("es-CL")} propiedades con InvertiScore
              </p>
            )}
          </FadeIn>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="bg-[#111] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
          <span className="font-serif text-lg font-bold text-white">InvertiScore</span>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-[#6b7280]">
            <Link href="/" className="transition-colors duration-200 hover:text-white">Inicio</Link>
            <span className="text-[#333]">·</span>
            <Link href="/pricing" className="transition-colors duration-200 hover:text-white">Pricing</Link>
            <span className="text-[#333]">·</span>
            <Link href="/dashboard" className="transition-colors duration-200 hover:text-white">Dashboard</Link>
            <span className="text-[#333]">·</span>
            <Link href="/login" className="transition-colors duration-200 hover:text-white">Iniciar Sesión</Link>
          </div>
        </div>
        <div className="mx-auto mt-6 max-w-5xl text-center text-xs text-[#444]">
          &copy; 2026 InvertiScore · Datos de Banco Central, SII, CMF
        </div>
      </footer>
    </div>
  );
}
