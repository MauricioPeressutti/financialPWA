import { redirect } from "next/navigation";

import { WelcomeForm } from "@/components/welcome-form";
import { getCurrentUser, getUserTeams } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BienvenidaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/bienvenida");

  const teams = await getUserTeams(user.id);
  if (teams.length > 0) redirect("/");

  const firstName = user.displayName?.trim().split(/\s+/)[0] || "👋";

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm py-8">
        <p className="mb-4 text-center text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-primary">
          Finanzas
        </p>
        <WelcomeForm firstName={firstName} />
      </div>
    </main>
  );
}
