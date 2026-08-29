import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getActiveTeam, getCurrentUser, getUserTeams } from "@/lib/auth";
import { ensureTeam } from "@/lib/users";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const teamsList = await getUserTeams(user.id);
  // Primer ingreso sin equipo (y sin invitación que resolver): recién acá se
  // crea el "Casa" por defecto, y recargamos para leerlo sin cache viejo.
  if (teamsList.length === 0) {
    await ensureTeam(user.id);
    redirect("/");
  }

  const team = await getActiveTeam();
  if (!team) redirect("/sign-in");

  return (
    <AppShell
      user={{ name: user.displayName, email: user.email, photoUrl: user.photoUrl }}
      team={{
        id: team.id,
        name: team.name,
        role: team.role,
        effortEnabled: team.effortEnabled,
        goalsEnabled: team.goalsEnabled,
      }}
      teams={teamsList.map((t) => ({ id: t.id, name: t.name }))}
    >
      {children}
    </AppShell>
  );
}
