import { TeamManager } from "@/components/team-manager";
import { requireTeam } from "@/lib/auth";
import {
  getPendingInvitations,
  getTeamMembers,
  getTelegramLink,
} from "@/lib/queries";

export default async function TeamPage() {
  const { user, team } = await requireTeam();
  const isOwner = team.role === "owner";

  const [members, invites, telegram] = await Promise.all([
    getTeamMembers(team.id),
    isOwner ? getPendingInvitations(team.id) : Promise.resolve([]),
    getTelegramLink(user.id),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Equipo</h1>
      <TeamManager
        isOwner={isOwner}
        currentUserId={user.id}
        team={{ name: team.name }}
        telegramLinked={telegram.linked}
        members={members.map((m) => ({
          userId: m.userId,
          name: m.displayName,
          email: m.email,
          role: m.role,
        }))}
        invites={invites.map((i) => ({
          id: i.id,
          token: i.token,
          expiresAt: i.expiresAt.toISOString(),
        }))}
      />
    </div>
  );
}
