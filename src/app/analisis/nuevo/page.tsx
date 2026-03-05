import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ArrowLeft } from "lucide-react";

export default function NuevoAnalisisPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">InvertiScore</span>
          </div>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Volver al Dashboard
            </Button>
          </Link>
        </div>
      </nav>

      {/* Form */}
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Nuevo Análisis</h1>
          <p className="text-muted-foreground">
            Ingresa los datos de la propiedad para obtener tu InvertiScore
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Datos de la Propiedad</CardTitle>
            <CardDescription>
              Completa la información para generar el análisis con IA
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Ubicación */}
            <div className="space-y-4">
              <h3 className="font-semibold">Ubicación</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="comuna">Comuna</Label>
                  <Input id="comuna" placeholder="Ej: Providencia" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ciudad">Ciudad</Label>
                  <Input id="ciudad" placeholder="Ej: Santiago" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="direccion">Dirección (opcional)</Label>
                <Input id="direccion" placeholder="Ej: Av. Providencia 1234" />
              </div>
            </div>

            {/* Características */}
            <div className="space-y-4">
              <h3 className="font-semibold">Características</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo de propiedad</Label>
                  <Input id="tipo" placeholder="Ej: Departamento" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dormitorios">Dormitorios</Label>
                  <Input id="dormitorios" type="number" placeholder="2" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="banos">Baños</Label>
                  <Input id="banos" type="number" placeholder="1" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="superficie">Superficie útil (m²)</Label>
                  <Input id="superficie" type="number" placeholder="55" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="antiguedad">Antigüedad (años)</Label>
                  <Input id="antiguedad" type="number" placeholder="5" />
                </div>
              </div>
            </div>

            {/* Financiero */}
            <div className="space-y-4">
              <h3 className="font-semibold">Datos Financieros</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="precio">Precio de venta (UF)</Label>
                  <Input id="precio" type="number" placeholder="3500" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="arriendo">
                    Arriendo mensual esperado (CLP)
                  </Label>
                  <Input id="arriendo" type="number" placeholder="450000" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="gastos">Gastos comunes (CLP)</Label>
                  <Input id="gastos" type="number" placeholder="80000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contribuciones">
                    Contribuciones trimestrales (CLP)
                  </Label>
                  <Input id="contribuciones" type="number" placeholder="150000" />
                </div>
              </div>
            </div>

            <Button className="w-full" size="lg">
              Generar InvertiScore
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
