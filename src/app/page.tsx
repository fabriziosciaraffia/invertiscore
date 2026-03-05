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
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">InvertiScore</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Iniciar Sesión
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Registrarse</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(217_91%_60%/0.12),transparent_60%)]" />
        <div className="container relative mx-auto px-4 py-24 text-center md:py-36">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary">
            <Brain className="h-4 w-4" />
            Análisis potenciado por IA
          </div>
          <h1 className="mx-auto max-w-4xl text-balance text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl">
            No vendemos deptos.
            <br />
            <span className="text-primary">Te decimos si deberías comprarlos.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground md:text-xl">
            InvertiScore analiza propiedades en Chile con inteligencia artificial
            y te entrega un score objetivo de inversión. Sin sesgos. Sin conflictos
            de interés. Solo datos.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/register">
              <Button size="lg" className="gap-2 text-base">
                Analiza gratis tu próxima inversión
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Sin tarjeta de crédito. Primer análisis gratis.
          </p>
        </div>
      </section>

      {/* El Problema */}
      <section className="border-t border-border/50 bg-secondary/30">
        <div className="container mx-auto px-4 py-20 md:py-28">
          <div className="mx-auto mb-4 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">
              El problema
            </p>
            <h2 className="text-3xl font-bold md:text-4xl">
              Tu corredor no es tu asesor financiero
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Los corredores ganan comisión cuando vendes o compras. Su incentivo
              es cerrar la operación, no proteger tu inversión.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                  <ShieldAlert className="h-5 w-5 text-destructive" />
                </div>
                <CardTitle className="text-lg">Sesgo de venta</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Un corredor gana su comisión solo si se cierra la venta.
                  Nunca te va a decir &quot;no compres&quot;, aunque sea la
                  decisión correcta.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                  <Scale className="h-5 w-5 text-destructive" />
                </div>
                <CardTitle className="text-lg">Sin accountability</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Si la inversión sale mal, el corredor ya cobró su comisión.
                  No tiene ninguna responsabilidad sobre el rendimiento de tu
                  inversión.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                  <EyeOff className="h-5 w-5 text-destructive" />
                </div>
                <CardTitle className="text-lg">
                  Asimetría de información
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  El corredor conoce el mercado mejor que tú y usa esa ventaja
                  para presionarte. Tú necesitas tus propios datos para negociar
                  en igualdad de condiciones.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Cómo Funciona */}
      <section className="border-t border-border/50">
        <div className="container mx-auto px-4 py-20 md:py-28">
          <div className="mx-auto mb-4 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">
              Cómo funciona
            </p>
            <h2 className="text-3xl font-bold md:text-4xl">
              De datos a decisión en 30 segundos
            </h2>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ClipboardPaste className="h-6 w-6" />
              </div>
              <div className="mb-1 text-xs font-bold uppercase tracking-wider text-primary">
                Paso 1
              </div>
              <h3 className="mb-2 text-lg font-semibold">Ingresa los datos</h3>
              <p className="text-sm text-muted-foreground">
                Pega el link de la publicación o ingresa manualmente precio,
                arriendo, ubicación y características.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Brain className="h-6 w-6" />
              </div>
              <div className="mb-1 text-xs font-bold uppercase tracking-wider text-primary">
                Paso 2
              </div>
              <h3 className="mb-2 text-lg font-semibold">IA analiza todo</h3>
              <p className="text-sm text-muted-foreground">
                Nuestra inteligencia artificial evalúa rentabilidad, plusvalía,
                riesgo y ubicación contra datos reales del mercado.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div className="mb-1 text-xs font-bold uppercase tracking-wider text-primary">
                Paso 3
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                Obtén tu InvertiScore
              </h3>
              <p className="text-sm text-muted-foreground">
                Recibe un score de 1 a 100 con desglose detallado. Toma
                decisiones de inversión con confianza.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-border/50 bg-secondary/30">
        <div className="container mx-auto px-4 py-20 md:py-28">
          <div className="mx-auto mb-4 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">
              Planes
            </p>
            <h2 className="text-3xl font-bold md:text-4xl">
              Elige tu nivel de análisis
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Desde un score rápido hasta un sistema completo de gestión de
              portafolio.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {/* Gratis */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="text-lg">Gratis</CardTitle>
                <div className="mt-2">
                  <span className="text-3xl font-bold">$0</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>InvertiScore (1-100)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>3 métricas básicas</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>1 análisis por mes</span>
                  </li>
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <X className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Reporte completo con IA</span>
                  </li>
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <X className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Flujo de caja proyectado</span>
                  </li>
                </ul>
                <Link href="/register" className="block">
                  <Button variant="outline" className="w-full">
                    Comenzar gratis
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Premium */}
            <Card className="relative border-primary/50 bg-card shadow-lg shadow-primary/5">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                Popular
              </div>
              <CardHeader>
                <CardTitle className="text-lg">Premium</CardTitle>
                <div className="mt-2">
                  <span className="text-3xl font-bold">$4.990</span>
                  <span className="text-sm text-muted-foreground">
                    {" "}/ reporte
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>Todo lo del plan Gratis</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>Reporte completo con IA</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>Pros y contras detallados</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>Flujo de caja proyectado a 10 años</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>Comparación con mercado local</span>
                  </li>
                </ul>
                <Link href="/register" className="block">
                  <Button className="w-full">Obtener reporte</Button>
                </Link>
              </CardContent>
            </Card>

            {/* Inversionista */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="text-lg">Plan Inversionista</CardTitle>
                <div className="mt-2">
                  <span className="text-3xl font-bold">$14.990</span>
                  <span className="text-sm text-muted-foreground"> / mes</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>Todo lo del plan Premium</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>Reportes ilimitados</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>Alertas de oportunidades</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>Seguimiento de portafolio</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>Soporte prioritario</span>
                  </li>
                </ul>
                <Link href="/register" className="block">
                  <Button variant="outline" className="w-full">
                    Suscribirme
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Ejemplo de Reporte */}
      <section className="border-t border-border/50">
        <div className="container mx-auto px-4 py-20 md:py-28">
          <div className="mx-auto mb-4 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">
              Ejemplo
            </p>
            <h2 className="text-3xl font-bold md:text-4xl">
              Así se ve un InvertiScore
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Reporte real generado para un departamento en Ñuñoa, Santiago.
            </p>
          </div>
          <div className="mx-auto mt-12 max-w-4xl">
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-6 md:p-8">
                {/* Header */}
                <div className="mb-8 flex flex-col items-center gap-6 md:flex-row md:items-start">
                  <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-4 border-primary bg-primary/5">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-primary">72</div>
                      <div className="text-[10px] text-muted-foreground">
                        InvertiScore
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">
                      Depto 2D1B Ñuñoa
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Ñuñoa, Santiago · Departamento · 52 m² · 8 años
                    </p>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm">
                      <span className="rounded bg-secondary px-2 py-0.5">
                        Precio: 3.200 UF
                      </span>
                      <span className="rounded bg-secondary px-2 py-0.5">
                        Arriendo: $420.000/mes
                      </span>
                      <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">
                        Yield: 5.2%
                      </span>
                    </div>
                  </div>
                </div>
                {/* Metrics */}
                <div className="mb-6 grid gap-4 sm:grid-cols-4">
                  <div className="rounded-lg border border-border/50 bg-secondary/50 p-4">
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5 text-primary" />
                      Rentabilidad
                    </div>
                    <div className="text-xl font-bold">68</div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: "68%" }}
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-secondary/50 p-4">
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <TrendingUp className="h-3.5 w-3.5 text-primary" />
                      Plusvalía
                    </div>
                    <div className="text-xl font-bold">78</div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: "78%" }}
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-secondary/50 p-4">
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Shield className="h-3.5 w-3.5 text-primary" />
                      Bajo Riesgo
                    </div>
                    <div className="text-xl font-bold">65</div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: "65%" }}
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-secondary/50 p-4">
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      Ubicación
                    </div>
                    <div className="text-xl font-bold">80</div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: "80%" }}
                      />
                    </div>
                  </div>
                </div>
                {/* AI Summary */}
                <div className="rounded-lg border border-border/50 bg-secondary/30 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                    Análisis IA
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Propiedad con yield bruto de 5.2%, por sobre el promedio de
                    Ñuñoa (4.1%). El CAP rate neto estimado de 3.8% es aceptable
                    considerando la antigüedad del edificio. La zona presenta
                    demanda estable de arriendo por cercanía a metro y servicios.
                    Se recomienda verificar gastos comunes históricos y estado de
                    la administración antes de ofertar.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="border-t border-border/50 bg-secondary/30">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center">
            <div className="mb-6 flex items-center justify-center gap-2 text-muted-foreground">
              <Database className="h-4 w-4" />
              <p className="text-sm font-medium">
                Basado en datos públicos y verificables
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm font-medium text-muted-foreground">
              <span className="text-foreground/60">Portal Inmobiliario</span>
              <span className="text-foreground/30">|</span>
              <span className="text-foreground/60">TocToc</span>
              <span className="text-foreground/30">|</span>
              <span className="text-foreground/60">Banco Central</span>
              <span className="text-foreground/30">|</span>
              <span className="text-foreground/60">SII</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="border-t border-border/50">
        <div className="container mx-auto px-4 py-20 text-center md:py-28">
          <h2 className="text-3xl font-bold md:text-4xl">
            Obtén tu InvertiScore gratis
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
            Deja de confiar en corredores. Empieza a tomar decisiones de
            inversión basadas en datos.
          </p>
          <div className="mt-8">
            <Link href="/register">
              <Button size="lg" className="gap-2 text-base">
                Analiza gratis tu próxima inversión
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 text-center text-sm text-muted-foreground">
        <p>&copy; 2026 InvertiScore. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
