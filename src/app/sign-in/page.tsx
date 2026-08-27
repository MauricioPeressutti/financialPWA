import { Suspense } from "react";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/sign-in-form";
import { getCurrentUser } from "@/lib/auth";

export default async function SignInPage() {
  // Sólo redirige si la sesión es válida de verdad (no sólo por la cookie).
  if (await getCurrentUser()) redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Suspense>
        <SignInForm />
      </Suspense>
    </main>
  );
}
