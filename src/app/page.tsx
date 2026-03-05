import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Building2, BarChart3, Brain, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">InvertiScore</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Iniciar Sesión</Button>
            </Link>
            <Link href="/register">
              <Button>Registrarse</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight">
          Analiza tu próxima inversión
          <br />
          inmobiliaria con <span className="text-primary">IA</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          InvertiScore evalúa propiedades en Chile usando inteligencia artificial
          para darte un score de inversión claro, rápido y fundamentado.
        </p>
        <div className="mt-10">
          <Link href="/register">
            <Button size="lg" className="gap-2">
              Comenzar gratis <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="rounded-lg border p-6">
            <BarChart3 className="mb-4 h-10 w-10 text-primary" />
            <h3 className="mb-2 text-lg font-semibold">Score de Inversión</h3>
            <p className="text-muted-foreground">
              Obtén un puntaje de 0 a 100 que resume la calidad de la inversión
              basado en múltiples factores.
            </p>
          </div>
          <div className="rounded-lg border p-6">
            <Brain className="mb-4 h-10 w-10 text-primary" />
            <h3 className="mb-2 text-lg font-semibold">Análisis con IA</h3>
            <p className="text-muted-foreground">
              Nuestra IA analiza rentabilidad, plusvalía, riesgo y condiciones de
              mercado para cada propiedad.
            </p>
          </div>
          <div className="rounded-lg border p-6">
            <Building2 className="mb-4 h-10 w-10 text-primary" />
            <h3 className="mb-2 text-lg font-semibold">Enfocado en Chile</h3>
            <p className="text-muted-foreground">
              Datos y métricas ajustadas al mercado inmobiliario chileno: UF,
              CAP rate local, y más.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>© 2026 InvertiScore. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
