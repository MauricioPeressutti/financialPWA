"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  completeGoogleRedirect,
  shouldUseRedirect,
  signInWithGooglePopup,
  signInWithGoogleRedirect,
} from "@/lib/firebase/client";

const NEXT_KEY = "postLoginNext";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);

  async function exchangeAndGo(idToken: string) {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) throw new Error("No se pudo iniciar sesión");
    let next = params.get("next");
    try {
      next = next || sessionStorage.getItem(NEXT_KEY);
      sessionStorage.removeItem(NEXT_KEY);
    } catch {}
    router.replace(next || "/");
    router.refresh();
  }

  // Al volver del redirect de Google
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const idToken = await completeGoogleRedirect();
        if (!idToken || cancelled) return;
        setLoading(true);
        await exchangeAndGo(idToken);
      } catch (err) {
        console.error(err);
        toast.error("No se pudo completar el ingreso");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignIn() {
    setLoading(true);
    try {
      if (shouldUseRedirect()) {
        try {
          sessionStorage.setItem(NEXT_KEY, params.get("next") || "/");
        } catch {}
        await signInWithGoogleRedirect(); // la página navega a Google
        return;
      }
      const idToken = await signInWithGooglePopup();
      await exchangeAndGo(idToken);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      console.error("sign-in error:", code, err);
      if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
        // fallback a redirect si el popup fue bloqueado
        try {
          sessionStorage.setItem(NEXT_KEY, params.get("next") || "/");
          await signInWithGoogleRedirect();
          return;
        } catch {}
      }
      toast.error(
        code ? `No se pudo iniciar sesión (${code})` : "No se pudo iniciar sesión con Google",
      );
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
