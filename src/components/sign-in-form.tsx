"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signInWithGoogle } from "@/lib/firebase/client";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    try {
      const idToken = await signInWithGoogle();
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) throw new Error("No se pudo iniciar sesión");
      router.replace(params.get("next") || "/");
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("No se pudo iniciar sesión con Google");
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Finanzas</CardTitle>
        <CardDescription>Gastos compartidos de la familia</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleSignIn} disabled={loading} className="w-full">
          {loading ? "Entrando…" : "Entrar con Google"}
        </Button>
      </CardContent>
    </Card>
  );
}
