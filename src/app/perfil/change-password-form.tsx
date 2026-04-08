"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (password.length < 6) {
      setMessage({ type: "error", text: "La contraseña debe tener al menos 6 caracteres" });
      return;
    }
    if (password !== confirm) {
      setMessage({ type: "error", text: "Las contraseñas no coinciden" });
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: "Contraseña actualizada correctamente" });
      setPassword("");
      setConfirm("");
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="new-password" className="text-[#FAFAF8]/80 font-body text-sm font-medium">Nueva contraseña</Label>
          <Input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password" className="text-[#FAFAF8]/80 font-body text-sm font-medium">Confirmar contraseña</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
      </div>
      {message && (
        <div className={`rounded-md p-3 text-sm ${message.type === "success" ? "bg-[#B0BEC5]/10 text-[#B0BEC5]" : "bg-destructive/10 text-destructive"}`}>
          {message.text}
        </div>
      )}
      <Button type="submit" disabled={loading}>
        {loading ? "Actualizando..." : "Cambiar Contraseña"}
      </Button>
    </form>
  );
}
