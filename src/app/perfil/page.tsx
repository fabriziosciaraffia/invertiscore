import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { User, CreditCard, Clock, ArrowLeft } from "lucide-react";
import FrancoLogo from "@/components/franco-logo";
import { LogoutButton } from "@/components/logout-button";
import { ChangePasswordForm } from "./change-password-form";

export default async function PerfilPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const nombre = user.user_metadata?.nombre || user.user_metadata?.full_name || "Usuario";
  const email = user.email || "";
  const createdAt = user.created_at
    ? new Date(user.created_at).toLocaleDateString("es-CL", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  // Fetch premium analyses (payment history)
  const { data: premiumAnalyses } = await supabase
    .from("analisis")
    .select("id, nombre, created_at, is_premium")
    .eq("is_premium", true)
    .order("created_at", { ascending: false });

  const payments = premiumAnalyses || [];

  return (
    <div className="min-h-screen bg-[#0F0F0F]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#0F0F0F]">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <FrancoLogo size="header" href="/" inverted />
          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Dashboard
              </Button>
            </Link>
            <LogoutButton />
          </div>
        </div>
      </nav>

      <div className="container mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-8 text-3xl font-bold text-[#FAFAF8]">Mi Perfil</h1>

        {/* Datos personales */}
        <Card className="mb-6 border-white/[0.08] bg-[#151515]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-[#C8323C]" />
              <CardTitle className="text-[#FAFAF8]">Datos Personales</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs text-[#FAFAF8]/50">Nombre</div>
                <div className="font-medium text-[#FAFAF8]">{nombre}</div>
              </div>
              <div>
                <div className="text-xs text-[#FAFAF8]/50">Email</div>
                <div className="font-medium text-[#FAFAF8]">{email}</div>
              </div>
              <div>
                <div className="text-xs text-[#FAFAF8]/50">Fecha de registro</div>
                <div className="font-medium text-[#FAFAF8]">{createdAt}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plan actual */}
        <Card className="mb-6 border-white/[0.08] bg-[#151515]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[#C8323C]" />
              <CardTitle className="text-[#FAFAF8]">Plan Actual</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-[#FAFAF8]">Gratuito</div>
                <p className="text-sm text-[#FAFAF8]/50">
                  Acceso a análisis básicos. Compra informes Pro individuales por $4.990.
                </p>
              </div>
              <Link href="/pricing">
                <Button variant="outline" size="sm" className="border-white/[0.08] text-[#FAFAF8] hover:bg-[#1A1A1A]">Ver planes</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Historial de pagos */}
        <Card className="mb-6 border-white/[0.08] bg-[#151515]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#C8323C]" />
              <CardTitle className="text-[#FAFAF8]">Historial de Informes Pro</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-sm text-[#FAFAF8]/50">
                Aún no has comprado informes Pro.
              </p>
            ) : (
              <div className="space-y-3">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-white/[0.08] p-3">
                    <div>
                      <Link href={`/analisis/${p.id}`} className="text-sm font-medium text-[#FAFAF8] hover:underline">
                        {p.nombre}
                      </Link>
                      <div className="text-xs text-[#FAFAF8]/50">
                        {new Date(p.created_at).toLocaleDateString("es-CL")}
                      </div>
                    </div>
                    <div className="text-sm font-medium text-[#C8323C]">$4.990</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cambiar contraseña */}
        <Card className="border-white/[0.08] bg-[#151515]">
          <CardHeader>
            <CardTitle className="text-[#FAFAF8]">Cambiar Contraseña</CardTitle>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
