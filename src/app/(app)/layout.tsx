import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getActiveTeam, getCurrentUser, getUserTeams } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const teamsList = await getUserTeams(user.id);
  // Primer ingreso sin equipo: elegís crear uno o unirte a otro.
  if (teamsList.length === 0) redirect("/bienvenida");

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
