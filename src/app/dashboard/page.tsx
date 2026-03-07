import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, Plus, BarChart3, User } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { DashboardDeleteButton } from "./delete-button";
import type { Analisis } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: analisisList } = await supabase
    .from("analisis")
    .select("*")
    .order("created_at", { ascending: false });

  const analisis = (analisisList || []) as Analisis[];

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">InvertiScore</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/perfil">
              <Button variant="ghost" size="sm" className="gap-2">
                <User className="h-4 w-4" /> Mi Perfil
              </Button>
            </Link>
            <LogoutButton />
          </div>
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

        {analisis.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
            <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Sin análisis aún</h2>
            <p className="mb-4 text-muted-foreground">
              Crea tu primer análisis de inversión inmobiliaria
            </p>
            <Link href="/analisis/nuevo">
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Nuevo Análisis
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {analisis.map((item) => (
              <Card key={item.id} className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <Link href={`/analisis/${item.id}`} className="flex-1">
                      <CardTitle className="text-lg">
                        {item.nombre}
                      </CardTitle>
                      <CardDescription>
                        {item.comuna} &middot; {new Date(item.created_at).toLocaleDateString("es-CL")}
                      </CardDescription>
                    </Link>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        <span className="text-sm font-bold text-primary">
                          {item.score}
                        </span>
                      </div>
                      <DashboardDeleteButton id={item.id} />
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
