import { redirect } from "next/navigation";

import { GoalForm } from "@/components/goals/goal-form";
import { requireTeam } from "@/lib/auth";

export default async function NewGoalPage() {
  const { team } = await requireTeam();
  if (!team.goalsEnabled) redirect("/team");

  const currencies = team.currencies.length
    ? team.currencies
    : [team.primaryCurrency];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Nuevo objetivo</h1>
      <GoalForm currencies={currencies} />
    </div>
  );
}
