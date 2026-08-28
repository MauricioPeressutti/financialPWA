import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getActiveTeam, getCurrentUser, getUserTeams } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [team, teamsList] = await Promise.all([
    getActiveTeam(),
    getUserTeams(user.id),
  ]);
  if (!team) redirect("/sign-in");

  return (
    <AppShell
      user={{ name: user.displayName, email: user.email, photoUrl: user.photoUrl }}
      team={{
        id: team.id,
        name: team.name,
        role: team.role,
        effortEnabled: team.effortEnabled,
      }}
      teams={teamsList.map((t) => ({ id: t.id, name: t.name }))}
    >
      {children}
    </AppShell>
  );
}
