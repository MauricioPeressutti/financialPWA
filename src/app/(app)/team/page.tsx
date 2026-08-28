import { TeamManager } from "@/components/team-manager";
import { requireTeam } from "@/lib/auth";
import { getFxContext } from "@/lib/fx";
import {
  getPendingInvitations,
  getTeamMembers,
  getTelegramLink,
} from "@/lib/queries";

export default async function TeamPage() {
  const { user, team } = await requireTeam();
  const isOwner = team.role === "owner";

  const [members, invites, telegram, fx] = await Promise.all([
    getTeamMembers(team.id),
    isOwner ? getPendingInvitations(team.id) : Promise.resolve([]),
    getTelegramLink(user.id),
    getFxContext(team),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Equipo</h1>
      <TeamManager
        isOwner={isOwner}
        currentUserId={user.id}
        team={{ name: team.name }}
        telegramLinked={telegram.linked}
        effortEnabled={team.effortEnabled}
        goalsEnabled={team.goalsEnabled}
        currency={{
          primary: team.primaryCurrency,
          active: team.currencies,
          reference: team.fxReference,
          usdArsRate: fx.usdArsRate,
        }}
        members={members.map((m) => ({
          userId: m.userId,
          name: m.displayName,
          email: m.email,
          photoUrl: m.photoUrl,
          role: m.role,
          telegramLinked: m.telegramLinked,
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
