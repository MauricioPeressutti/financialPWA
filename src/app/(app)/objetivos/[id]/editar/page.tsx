import { notFound, redirect } from "next/navigation";

import { GoalForm } from "@/components/goals/goal-form";
import { requireTeam } from "@/lib/auth";
import { getGoal } from "@/lib/goals";

export default async function EditGoalPage({
  params,
}: PageProps<"/objetivos/[id]/editar">) {
  const { user, team } = await requireTeam();
  if (!team.goalsEnabled) redirect("/team");
  const { id } = await params;

  const data = await getGoal(team.id, id, user.id);
  if (!data) notFound();

  const currencies = team.currencies.length
    ? team.currencies
    : [team.primaryCurrency];
  const { goal } = data;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Editar objetivo</h1>
      <GoalForm
        currencies={currencies}
        goal={{
          id: goal.id,
          name: goal.name,
          emoji: goal.emoji,
          targetAmount: (goal.targetCents / 100).toString(),
          currency: goal.currency,
          scope: goal.scope,
          targetDate: goal.targetDate ?? "",
        }}
      />
    </div>
  );
}
