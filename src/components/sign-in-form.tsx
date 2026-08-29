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
  currentFirebaseUser,
  onFirebaseUser,
  shouldUseRedirect,
  signInWithGooglePopup,
  signInWithGoogleRedirect,
} from "@/lib/firebase/client";

const NEXT_KEY = "postLoginNext";
// El canje del token corre una sola vez aunque el efecto se re-monte (StrictMode)
// o el listener de auth dispare más de una vez.
let exchangeStarted = false;

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

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

  async function runExchange(getToken: () => Promise<string>) {
    if (exchangeStarted) return;
    exchangeStarted = true;
    setLoading(true);
    try {
      await exchangeAndGo(await getToken());
    } catch (err) {
      console.error("exchange:", err);
      toast.error("No se pudo completar el ingreso");
      exchangeStarted = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    // Si volvés de un redirect de Google, esto procesa el resultado y dispara
    // el listener de abajo.
    completeGoogleRedirect().catch((e) => console.error("redirect:", e));

    // Cubre los 3 casos: Firebase ya firmado (cookie de app vencida), vuelta de
    // redirect, y popup. En todos hay un User -> canjeamos su token.
    const unsub = onFirebaseUser((user) => {
      if (user) void runExchange(() => user.getIdToken());
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignIn() {
    setLoading(true);

    // Firebase ya te tiene firmado: no hace falta ir a Google, solo la sesión.
    const existing = currentFirebaseUser();
    if (existing) {
      await runExchange(() => existing.getIdToken());
      return;
    }

    try {
      if (shouldUseRedirect()) {
        try {
          sessionStorage.setItem(NEXT_KEY, params.get("next") || "/");
        } catch {}
        await signInWithGoogleRedirect(); // la página navega a Google
        return;
      }
      const idToken = await signInWithGooglePopup();
      await runExchange(() => Promise.resolve(idToken));
    } catch (err) {
      const code = (err as { code?: string })?.code;
      console.error("sign-in error:", code, err);
      if (
        code === "auth/popup-blocked" ||
        code === "auth/cancelled-popup-request"
      ) {
        try {
          sessionStorage.setItem(NEXT_KEY, params.get("next") || "/");
          await signInWithGoogleRedirect();
          return;
        } catch {}
      }
      toast.error(
        code
          ? `No se pudo iniciar sesión (${code})`
          : "No se pudo iniciar sesión con Google",
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
        <Button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full gap-2"
        >
          <GoogleIcon className="size-4" />
          {loading ? "Entrando…" : "Entrar con Google"}
        </Button>
      </CardContent>
    </Card>
  );
}
