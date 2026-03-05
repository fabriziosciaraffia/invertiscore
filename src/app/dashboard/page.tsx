import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, Plus, BarChart3 } from "lucide-react";

// Datos de ejemplo (placeholder)
const analisisEjemplo = [
  {
    id: "1",
    nombre: "Depto 2D1B Providencia",
    fecha: "2026-02-15",
    score: 78,
  },
  {
    id: "2",
    nombre: "Casa 3D2B La Florida",
    fecha: "2026-02-20",
    score: 62,
  },
  {
    id: "3",
    nombre: "Depto 1D1B Santiago Centro",
    fecha: "2026-03-01",
    score: 85,
  },
];

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">InvertiScore</span>
          </div>
          <Button variant="ghost" size="sm">
            Cerrar Sesión
          </Button>
        </div>
      </nav>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Mis Análisis</h1>
            <p className="text-muted-foreground">
              Revisa y gestiona tus análisis de inversión
            </p>
          </div>
          <Link href="/analisis/nuevo">
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Nuevo Análisis
            </Button>
          </Link>
        </div>

        {/* Lista de análisis */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {analisisEjemplo.map((analisis) => (
            <Link key={analisis.id} href={`/analisis/${analisis.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {analisis.nombre}
                      </CardTitle>
                      <CardDescription>{analisis.fecha}</CardDescription>
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <span className="text-sm font-bold text-primary">
                        {analisis.score}
                      </span>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
