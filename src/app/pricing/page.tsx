import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Check,
  X,
  ArrowLeft,
  Clock,
} from "lucide-react";
import FrancoLogo from "@/components/franco-logo";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-franco-border bg-white">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <FrancoLogo size="header" href="/" />
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Iniciar Sesi&oacute;n
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                Registrarse
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto max-w-5xl px-4 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold md:text-4xl">
            Elige tu nivel de an&aacute;lisis
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Desde un score r&aacute;pido hasta un sistema completo de an&aacute;lisis de inversiones.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Gratis */}
          <Card className="border-border/50">
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
                  <span>Franco Score (1-100)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>3 m&eacute;tricas b&aacute;sicas (yield, flujo, precio/m&sup2;)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>Radar de dimensiones</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>8 m&eacute;tricas de inversi&oacute;n</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>Sensibilidad y comparaci&oacute;n zona</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>Puntos cr&iacute;ticos y an&aacute;lisis detallado</span>
                </li>
                <li className="flex items-start gap-2 text-muted-foreground">
                  <X className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Flujo de caja proyectado</span>
                </li>
                <li className="flex items-start gap-2 text-muted-foreground">
                  <X className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Patrimonio y escenarios de salida</span>
                </li>
              </ul>
              <Link href="/register" className="block">
                <Button variant="outline" className="w-full">
                  Comenzar gratis
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Informe Pro */}
          <Card className="relative border-primary/30 shadow-lg shadow-primary/10">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground shadow-md">
              Popular
            </div>
            <CardHeader>
              <CardTitle className="text-lg">Informe Pro</CardTitle>
              <div className="mt-2">
                <span className="text-3xl font-bold">$4.990</span>
                <span className="text-sm text-muted-foreground">
                  {" "}/ an&aacute;lisis
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
                  <span className="font-medium">Cascada de costos mensual</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="font-medium">Flujo de caja proyectado</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="font-medium">Proyecci&oacute;n de patrimonio</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="font-medium">Escenarios de salida (venta + refi)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="font-medium">Horizonte ajustable 1-20 a&ntilde;os</span>
                </li>
              </ul>
              <Link href="/register" className="block">
                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  Obtener informe
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Plan Monitor */}
          <Card className="relative border-border/50">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-muted px-3 py-0.5 text-xs font-semibold text-muted-foreground shadow-md">
              Pr&oacute;ximamente
            </div>
            <CardHeader>
              <CardTitle className="text-lg">Plan Monitor</CardTitle>
              <div className="mt-2">
                <span className="text-3xl font-bold">$7.990</span>
                <span className="text-sm text-muted-foreground"> / mes</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>Todo lo del Informe Pro</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>Informes ilimitados</span>
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
              <Button variant="outline" className="w-full" disabled>
                <Clock className="mr-2 h-4 w-4" />
                Pr&oacute;ximamente
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 text-center">
          <Link href="/">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Volver al inicio
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
