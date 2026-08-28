import { notFound, redirect } from "next/navigation";

import { AddContribution } from "@/components/goals/add-contribution";
import { DeleteContribution } from "@/components/goals/delete-contribution";
import { GoalActions } from "@/components/goals/goal-actions";
import { GoalRing } from "@/components/goals/goal-ring";
import { requireTeam } from "@/lib/auth";
import { getGoal } from "@/lib/goals";
import { formatMoney } from "@/lib/money";
import { fmtDay } from "@/lib/datetime";

export default async function GoalDetailPage({
  params,
}: PageProps<"/objetivos/[id]">) {
  const { user, team } = await requireTeam();
  if (!team.goalsEnabled) redirect("/team");
  const { id } = await params;

  const data = await getGoal(team.id, id, user.id);
  if (!data) notFound();

  const { goal, contribs, savedCents, remainingCents, pct, reached } = data;
  const fm = (c: number) => formatMoney(c, goal.currency);
  const archived = goal.status === "archived";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-gradient-to-br from-[#6fffe9]/25 to-[#5bc0be]/15 text-2xl">
            {goal.emoji}
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-tight">{goal.name}</h1>
            <p className="text-xs text-muted-foreground">
              {goal.scope === "personal" ? "Personal" : "Compartido"}
              {archived ? " · archivado" : ""}
            </p>
          </div>
        </div>
        <GoalActions id={goal.id} name={goal.name} archived={archived} />
      </div>

      {/* Anillo de progreso */}
      <div className="flex flex-col items-center gap-3">
        <GoalRing pct={pct} reached={reached} />
        <div className="text-center">
          <p className="text-lg font-bold tabular-nums">{fm(savedCents)}</p>
          <p className="text-xs text-muted-foreground">
            de {fm(goal.targetCents)}
            {reached ? " · ¡completo!" : ` · faltan ${fm(remainingCents)}`}
          </p>
        </div>
      </div>

      {/* Ritmo / proyección */}
      {!reached && (
        <div className="grid grid-cols-2 gap-3">
          <Box
            label="Ritmo (últimos 90 días)"
            value={data.monthlyRateCents > 0 ? `${fm(data.monthlyRateCents)}/mes` : "—"}
          />
          <Box
            label="A este ritmo, listo"
            value={data.etaLabel ?? "sin datos"}
          />
          {goal.targetDate && (
            <>
              <Box label="Fecha objetivo" value={fmtDay(goal.targetDate)} />
              <Box
                label="Habría que poner"
                value={
                  data.neededPerMonthCents != null
                    ? `${fm(data.neededPerMonthCents)}/mes`
                    : "—"
                }
                tone={data.onTrack === false ? "warn" : undefined}
              />
            </>
          )}
        </div>
      )}

      {goal.targetDate && data.onTrack === false && !reached && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          Al ritmo actual llegás después de la fecha objetivo. Subí el aporte
          mensual para llegar a tiempo.
        </p>
      )}

      {/* Aportar */}
      {!archived && (
        <AddContribution goalId={goal.id} currency={goal.currency} />
      )}

      {/* Historial */}
      <section className="space-y-2">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
          Aportes · {contribs.length}
        </p>
        {contribs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no cargaste ningún aporte.
          </p>
        ) : (
          <div className="divide-y">
            {contribs.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="tabular-nums font-medium text-emerald-600">
                    + {fm(c.amountCents)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {fmtDay(c.contributedOn)} · {c.by}
                    {c.note ? ` · ${c.note}` : ""}
                  </p>
                </div>
                <DeleteContribution id={c.id} goalId={goal.id} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Box({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <div className="cosmic-panel rounded-xl border p-3">
      <p className="text-[0.62rem] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-sm font-semibold tabular-nums ${
          tone === "warn" ? "text-amber-600 dark:text-amber-400" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
