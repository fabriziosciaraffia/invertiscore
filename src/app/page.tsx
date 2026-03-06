"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Building2,
  ArrowRight,
  ShieldAlert,
  EyeOff,
  Scale,
  ClipboardPaste,
  Brain,
  BarChart3,
  Check,
  X,
  TrendingUp,
  Shield,
  DollarSign,
  MapPin,
  Database,
  Menu,
  X as XIcon,
} from "lucide-react";

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);

  return (
    <div className="snap-container bg-white text-[#1a1a1a]">
      {/* Navbar */}
      <nav className="fixed top-0 z-50 w-full border-b border-[#e5e5e5]/80 bg-white/80 shadow-sm backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-[#059669]" />
            <span className="font-serif text-xl font-bold text-[#1a1a1a]">
              InvertiScore
            </span>
          </div>
          {/* Desktop nav */}
          <div className="hidden items-center gap-3 sm:flex">
            <Link href="/pricing">
              <Button
                variant="ghost"
                size="sm"
                className="text-[#6b7280] hover:text-[#1a1a1a]"
              >
                Planes
              </Button>
            </Link>
            <Link href="/login">
              <Button
                variant="ghost"
                size="sm"
                className="text-[#6b7280] hover:text-[#1a1a1a]"
              >
                Iniciar Sesi&oacute;n
              </Button>
            </Link>
            <Link href="/register">
              <Button
                size="sm"
                className="rounded-lg bg-[#059669] text-white shadow-md shadow-[#059669]/25 hover:bg-[#047857]"
              >
                Registrarse
              </Button>
            </Link>
          </div>
          {/* Mobile hamburger */}
          <button
            className="p-2 text-[#6b7280] sm:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            {mobileMenuOpen ? (
              <XIcon className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="border-t border-[#e5e5e5] bg-white px-4 py-4 sm:hidden">
            <div className="flex flex-col gap-3">
              <Link
                href="/pricing"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Button
                  variant="ghost"
                  className="w-full justify-start text-[#6b7280]"
                >
                  Planes
                </Button>
              </Link>
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Button
                  variant="ghost"
                  className="w-full justify-start text-[#6b7280]"
                >
                  Iniciar Sesi&oacute;n
                </Button>
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Button className="w-full rounded-lg bg-[#059669] text-white hover:bg-[#047857]">
                  Registrarse
                </Button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="snap-section relative bg-gradient-to-b from-white via-white to-[#ECFDF5]/60 pt-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(5,150,105,0.06),transparent_60%)]" />
        <div className="container relative mx-auto px-4 py-12 text-center md:py-16">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-[#059669]/20 bg-[#059669]/5 px-4 py-1.5 text-sm text-[#059669]">
            <Brain className="h-4 w-4" />
            An&aacute;lisis potenciado por IA
          </div>
          <h1 className="mx-auto max-w-4xl text-balance font-serif text-4xl font-bold tracking-tight text-[#1a1a1a] md:text-6xl lg:text-7xl">
            No vendemos deptos.
            <br />
            <span className="text-[#059669]">
              Te decimos si deber&iacute;as comprarlos.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-[#6b7280] md:text-xl">
            InvertiScore analiza propiedades en Chile con inteligencia artificial
            y te entrega un score objetivo de inversi&oacute;n. Sin sesgos. Sin conflictos
            de inter&eacute;s. Solo datos.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/register">
              <Button
                size="lg"
                className="gap-2 rounded-lg bg-[#059669] text-base text-white shadow-lg shadow-[#059669]/25 hover:bg-[#047857]"
              >
                Analiza gratis tu pr&oacute;xima inversi&oacute;n
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-[#6b7280]">
            Sin tarjeta de cr&eacute;dito. Primer an&aacute;lisis gratis.
          </p>
        </div>
      </section>

      {/* El Problema */}
      <section className="snap-section bg-gradient-to-b from-[#F5F5F4] to-white">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="mx-auto mb-4 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#059669]">
              El problema
            </p>
            <h2 className="font-serif text-3xl font-bold text-[#1a1a1a] md:text-4xl">
              Tu corredor no es tu asesor financiero
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-[#6b7280]">
              Los corredores ganan comisi&oacute;n cuando vendes o compras. Su incentivo
              es cerrar la operaci&oacute;n, no proteger tu inversi&oacute;n.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <Card className="border-[#e5e5e5] bg-white shadow-md transition-shadow hover:shadow-lg">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
                  <ShieldAlert className="h-5 w-5 text-red-500" />
                </div>
                <CardTitle className="text-lg text-[#1a1a1a]">
                  Sesgo de venta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#6b7280]">
                  Un corredor gana su comisi&oacute;n solo si se cierra la venta.
                  Nunca te va a decir &quot;no compres&quot;, aunque sea la
                  decisi&oacute;n correcta.
                </p>
              </CardContent>
            </Card>
            <Card className="border-[#e5e5e5] bg-white shadow-md transition-shadow hover:shadow-lg">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
                  <Scale className="h-5 w-5 text-red-500" />
                </div>
                <CardTitle className="text-lg text-[#1a1a1a]">
                  Sin accountability
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#6b7280]">
                  Si la inversi&oacute;n sale mal, el corredor ya cobr&oacute; su comisi&oacute;n.
                  No tiene ninguna responsabilidad sobre el rendimiento de tu
                  inversi&oacute;n.
                </p>
              </CardContent>
            </Card>
            <Card className="border-[#e5e5e5] bg-white shadow-md transition-shadow hover:shadow-lg">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
                  <EyeOff className="h-5 w-5 text-red-500" />
                </div>
                <CardTitle className="text-lg text-[#1a1a1a]">
                  Asimetr&iacute;a de informaci&oacute;n
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#6b7280]">
                  El corredor conoce el mercado mejor que t&uacute; y usa esa ventaja
                  para presionarte. T&uacute; necesitas tus propios datos para negociar
                  en igualdad de condiciones.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* C&oacute;mo Funciona */}
      <section className="snap-section bg-gradient-to-b from-white to-[#F5F5F4]/50">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="mx-auto mb-4 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#059669]">
              C&oacute;mo funciona
            </p>
            <h2 className="font-serif text-3xl font-bold text-[#1a1a1a] md:text-4xl">
              De datos a decisi&oacute;n en 30 segundos
            </h2>
          </div>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#059669]/10 text-[#059669] shadow-sm">
                <ClipboardPaste className="h-6 w-6" />
              </div>
              <div className="mb-1 text-xs font-bold uppercase tracking-wider text-[#059669]">
                Paso 1
              </div>
              <h3 className="mb-2 text-lg font-semibold text-[#1a1a1a]">
                Ingresa los datos
              </h3>
              <p className="text-sm text-[#6b7280]">
                Pega el link de la publicaci&oacute;n o ingresa manualmente precio,
                arriendo, ubicaci&oacute;n y caracter&iacute;sticas.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#059669]/10 text-[#059669] shadow-sm">
                <Brain className="h-6 w-6" />
              </div>
              <div className="mb-1 text-xs font-bold uppercase tracking-wider text-[#059669]">
                Paso 2
              </div>
              <h3 className="mb-2 text-lg font-semibold text-[#1a1a1a]">
                IA analiza todo
              </h3>
              <p className="text-sm text-[#6b7280]">
                Nuestra inteligencia artificial eval&uacute;a rentabilidad, plusval&iacute;a,
                riesgo y ubicaci&oacute;n contra datos reales del mercado.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#059669]/10 text-[#059669] shadow-sm">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div className="mb-1 text-xs font-bold uppercase tracking-wider text-[#059669]">
                Paso 3
              </div>
              <h3 className="mb-2 text-lg font-semibold text-[#1a1a1a]">
                Obt&eacute;n tu InvertiScore
              </h3>
              <p className="text-sm text-[#6b7280]">
                Recibe un score de 1 a 100 con desglose detallado. Toma
                decisiones de inversi&oacute;n con confianza.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="snap-section bg-gradient-to-b from-[#F5F5F4] to-[#ECFDF5]/30">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="mx-auto mb-4 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#059669]">
              Planes
            </p>
            <h2 className="font-serif text-3xl font-bold text-[#1a1a1a] md:text-4xl">
              Elige tu nivel de an&aacute;lisis
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[#6b7280]">
              Desde un score r&aacute;pido hasta un sistema completo de gesti&oacute;n de
              portafolio.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {/* Gratis */}
            <Card className="border-[#e5e5e5] bg-white shadow-md">
              <CardHeader>
                <CardTitle className="text-lg text-[#1a1a1a]">Gratis</CardTitle>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-[#1a1a1a]">$0</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" />
                    <span className="text-[#1a1a1a]">InvertiScore (1-100)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" />
                    <span className="text-[#1a1a1a]">3 m&eacute;tricas b&aacute;sicas</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" />
                    <span className="text-[#1a1a1a]">1 an&aacute;lisis por mes</span>
                  </li>
                  <li className="flex items-start gap-2 text-[#9ca3af]">
                    <X className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Reporte completo con IA</span>
                  </li>
                  <li className="flex items-start gap-2 text-[#9ca3af]">
                    <X className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Flujo de caja proyectado</span>
                  </li>
                </ul>
                <Link href="/register" className="block">
                  <Button
                    variant="outline"
                    className="w-full rounded-lg border-[#d1d5db] text-[#1a1a1a] hover:bg-[#F5F5F4]"
                  >
                    Comenzar gratis
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Premium */}
            <Card className="relative border-[#059669]/30 bg-white shadow-lg shadow-[#059669]/10">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#059669] px-3 py-0.5 text-xs font-semibold text-white shadow-md">
                Popular
              </div>
              <CardHeader>
                <CardTitle className="text-lg text-[#1a1a1a]">Premium</CardTitle>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-[#1a1a1a]">$4.990</span>
                  <span className="text-sm text-[#6b7280]">
                    {" "}/ reporte
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" />
                    <span className="text-[#1a1a1a]">Todo lo del plan Gratis</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" />
                    <span className="text-[#1a1a1a]">Reporte completo con IA</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" />
                    <span className="text-[#1a1a1a]">Pros y contras detallados</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" />
                    <span className="text-[#1a1a1a]">Flujo de caja proyectado a 10 a&ntilde;os</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" />
                    <span className="text-[#1a1a1a]">Comparaci&oacute;n con mercado local</span>
                  </li>
                </ul>
                <Link href="/register" className="block">
                  <Button className="w-full rounded-lg bg-[#059669] text-white shadow-md shadow-[#059669]/25 hover:bg-[#047857]">
                    Obtener reporte
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Inversionista */}
            <Card className="border-[#e5e5e5] bg-white shadow-md">
              <CardHeader>
                <CardTitle className="text-lg text-[#1a1a1a]">
                  Plan Inversionista
                </CardTitle>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-[#1a1a1a]">$14.990</span>
                  <span className="text-sm text-[#6b7280]"> / mes</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" />
                    <span className="text-[#1a1a1a]">Todo lo del plan Premium</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" />
                    <span className="text-[#1a1a1a]">Reportes ilimitados</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" />
                    <span className="text-[#1a1a1a]">Alertas de oportunidades</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" />
                    <span className="text-[#1a1a1a]">Seguimiento de portafolio</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" />
                    <span className="text-[#1a1a1a]">Soporte prioritario</span>
                  </li>
                </ul>
                <Link href="/register" className="block">
                  <Button
                    variant="outline"
                    className="w-full rounded-lg border-[#d1d5db] text-[#1a1a1a] hover:bg-[#F5F5F4]"
                  >
                    Suscribirme
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Ejemplo de Reporte - Dark contrast section */}
      <section className="snap-section bg-[#1E293B]">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="mx-auto mb-4 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#34D399]">
              Ejemplo
            </p>
            <h2 className="font-serif text-3xl font-bold text-white md:text-4xl">
              As&iacute; se ve un InvertiScore
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[#94A3B8]">
              Reporte real generado para un departamento en &Ntilde;u&ntilde;oa, Santiago.
            </p>
          </div>
          <div className="mx-auto mt-10 max-w-4xl">
            <Card className="border-[#334155] bg-[#0F172A] shadow-2xl">
              <CardContent className="p-6 md:p-8">
                {/* Header */}
                <div className="mb-8 flex flex-col items-center gap-6 md:flex-row md:items-start">
                  <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-4 border-[#059669] bg-[#059669]/10">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-[#34D399]">72</div>
                      <div className="text-[10px] text-[#94A3B8]">
                        InvertiScore
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      Depto 2D1B &Ntilde;u&ntilde;oa
                    </h3>
                    <p className="text-sm text-[#94A3B8]">
                      &Ntilde;u&ntilde;oa, Santiago &middot; Departamento &middot; 52 m&sup2; &middot; 8 a&ntilde;os
                    </p>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm">
                      <span className="rounded bg-[#1E293B] px-2 py-0.5 text-[#CBD5E1]">
                        Precio: 3.200 UF
                      </span>
                      <span className="rounded bg-[#1E293B] px-2 py-0.5 text-[#CBD5E1]">
                        Arriendo: $420.000/mes
                      </span>
                      <span className="rounded bg-[#059669]/15 px-2 py-0.5 font-medium text-[#34D399]">
                        Yield: 5.2%
                      </span>
                    </div>
                  </div>
                </div>
                {/* Metrics - 2x2 on mobile, 4 cols on desktop */}
                <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-lg border border-[#334155] bg-[#1E293B] p-4">
                    <div className="mb-1 flex items-center gap-2 text-xs text-[#94A3B8]">
                      <DollarSign className="h-3.5 w-3.5 text-[#34D399]" />
                      Rentabilidad
                    </div>
                    <div className="text-xl font-bold text-white">68</div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-[#334155]">
                      <div
                        className="h-full rounded-full bg-[#059669]"
                        style={{ width: "68%" }}
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#334155] bg-[#1E293B] p-4">
                    <div className="mb-1 flex items-center gap-2 text-xs text-[#94A3B8]">
                      <TrendingUp className="h-3.5 w-3.5 text-[#34D399]" />
                      Plusval&iacute;a
                    </div>
                    <div className="text-xl font-bold text-white">78</div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-[#334155]">
                      <div
                        className="h-full rounded-full bg-[#059669]"
                        style={{ width: "78%" }}
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#334155] bg-[#1E293B] p-4">
                    <div className="mb-1 flex items-center gap-2 text-xs text-[#94A3B8]">
                      <Shield className="h-3.5 w-3.5 text-[#34D399]" />
                      Bajo Riesgo
                    </div>
                    <div className="text-xl font-bold text-white">65</div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-[#334155]">
                      <div
                        className="h-full rounded-full bg-[#059669]"
                        style={{ width: "65%" }}
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#334155] bg-[#1E293B] p-4">
                    <div className="mb-1 flex items-center gap-2 text-xs text-[#94A3B8]">
                      <MapPin className="h-3.5 w-3.5 text-[#34D399]" />
                      Ubicaci&oacute;n
                    </div>
                    <div className="text-xl font-bold text-white">80</div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-[#334155]">
                      <div
                        className="h-full rounded-full bg-[#059669]"
                        style={{ width: "80%" }}
                      />
                    </div>
                  </div>
                </div>
                {/* AI Summary with truncation on mobile */}
                <div className="rounded-lg border border-[#334155] bg-[#1E293B] p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#34D399]">
                    An&aacute;lisis IA
                  </p>
                  <div className="relative">
                    <p
                      className={`text-sm leading-relaxed text-[#94A3B8] ${
                        !aiExpanded ? "line-clamp-2 sm:line-clamp-none" : ""
                      }`}
                    >
                      Propiedad con yield bruto de 5.2%, por sobre el promedio de
                      &Ntilde;u&ntilde;oa (4.1%). El CAP rate neto estimado de 3.8% es aceptable
                      considerando la antig&uuml;edad del edificio. La zona presenta
                      demanda estable de arriendo por cercan&iacute;a a metro y servicios.
                      Se recomienda verificar gastos comunes hist&oacute;ricos y estado de
                      la administraci&oacute;n antes de ofertar.
                    </p>
                    {!aiExpanded && (
                      <button
                        onClick={() => setAiExpanded(true)}
                        className="mt-1 text-sm font-medium text-[#34D399] hover:underline sm:hidden"
                      >
                        Ver m&aacute;s...
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Social Proof + CTA Final */}
      <section className="snap-section bg-gradient-to-b from-white to-[#ECFDF5]/40">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="mb-6 flex items-center justify-center gap-2 text-[#6b7280]">
              <Database className="h-4 w-4" />
              <p className="text-sm font-medium">
                Basado en datos p&uacute;blicos y verificables
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm font-medium text-[#9ca3af]">
              <span>Portal Inmobiliario</span>
              <span className="text-[#d1d5db]">|</span>
              <span>TocToc</span>
              <span className="text-[#d1d5db]">|</span>
              <span>Banco Central</span>
              <span className="text-[#d1d5db]">|</span>
              <span>SII</span>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 pb-12 pt-6 text-center">
          <h2 className="font-serif text-3xl font-bold text-[#1a1a1a] md:text-4xl">
            Obt&eacute;n tu InvertiScore gratis
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[#6b7280]">
            Deja de confiar en corredores. Empieza a tomar decisiones de
            inversi&oacute;n basadas en datos.
          </p>
          <div className="mt-8">
            <Link href="/register">
              <Button
                size="lg"
                className="gap-2 rounded-lg bg-[#059669] text-base text-white shadow-lg shadow-[#059669]/25 hover:bg-[#047857]"
              >
                Analiza gratis tu pr&oacute;xima inversi&oacute;n
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-[#e5e5e5] py-8 text-center text-sm text-[#6b7280]">
          <p>&copy; 2026 InvertiScore. Todos los derechos reservados.</p>
        </footer>
      </section>
    </div>
  );
}
