import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireTeam } from "@/lib/auth";
import { getGoalsForUser } from "@/lib/goals";
import { formatMoney } from "@/lib/money";
import { fmtDay } from "@/lib/datetime";

export default async function ObjetivosPage() {
  const { user, team } = await requireTeam();
  if (!team.goalsEnabled) redirect("/team");

  const goals = await getGoalsForUser(team.id, user.id);
  const active = goals.filter((g) => g.status !== "archived");
  const archived = goals.filter((g) => g.status === "archived");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Objetivos</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Ahorrá de a poco para algo puntual.
          </p>
        </div>
        <Button size="sm" render={<Link href="/objetivos/nuevo">+ Nuevo</Link>} />
      </div>

      {active.length === 0 && (
        <div className="cosmic-panel rounded-2xl border p-6 text-center">
          <p className="text-3xl">🎯</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Todavía no tenés objetivos. Creá uno (un viaje, un cambio de auto) y
            cargá aportes cada tanto.
          </p>
          <Button
            className="mt-4"
            render={<Link href="/objetivos/nuevo">Crear objetivo</Link>}
          />
        </div>
      )}

      <div className="space-y-3">
        {active.map((g) => (
          <GoalCard key={g.id} g={g} />
        ))}
      </div>

      {archived.length > 0 && (
        <section className="space-y-3">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Archivados
          </p>
          {archived.map((g) => (
            <GoalCard key={g.id} g={g} muted />
          ))}
        </section>
      )}
    </div>
  );
}

type GoalRow = Awaited<ReturnType<typeof getGoalsForUser>>[number];

function GoalCard({ g, muted }: { g: GoalRow; muted?: boolean }) {
  const pct = Math.min(100, Math.round(g.pct));
  return (
    <Link
      href={`/objetivos/${g.id}`}
      className={`cosmic-panel block rounded-2xl border p-4 ${
        muted ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-gradient-to-br from-[#6fffe9]/25 to-[#5bc0be]/15 text-xl">
          {g.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{g.name}</p>
          <p className="text-xs text-muted-foreground">
            {g.scope === "personal" ? "Personal" : "Compartido"}
            {g.targetDate ? ` · para ${fmtDay(g.targetDate)}` : ""}
          </p>
        </div>
        {g.reached && (
          <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-emerald-600">
            ✓ Cumplido
          </span>
        )}
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
        <span
          className="block h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: g.reached ? "#10b981" : "var(--primary)",
          }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs tabular-nums">
        <span className="font-medium">
          {formatMoney(g.savedCents, g.currency)}
        </span>
        <span className="text-muted-foreground">
          {pct}% de {formatMoney(g.targetCents, g.currency)}
        </span>
      </div>
    </Link>
  );
}
