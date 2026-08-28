import Link from "next/link";
import { redirect } from "next/navigation";

import { CurrencyTabs } from "@/components/currency-tabs";
import { IncomeRow } from "@/components/effort/income-row";
import { QuickCalc } from "@/components/effort/quick-calc";
import { SettleButton } from "@/components/effort/settle-button";
import { requireTeam } from "@/lib/auth";
import { getTeamBalance } from "@/lib/balance";
import { effortPercents } from "@/lib/effort";
import { formatMoney } from "@/lib/money";
import { fmtDay } from "@/lib/datetime";
import { getSplitMembers, getTeamCurrencies } from "@/lib/queries";

const AV = ["#3987e5", "#d55181", "#199e70", "#c98500", "#9085e9", "#d95926"];
const colorFor = (id: string) =>
  AV[
    Math.abs(
      [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0),
    ) % AV.length
  ];

export default async function EsfuerzoPage({
  searchParams,
}: PageProps<"/esfuerzo">) {
  const { user, team } = await requireTeam();
  if (!team.effortEnabled) redirect("/team");
  const sp = await searchParams;

  const [members, teamCurrencies] = await Promise.all([
    getSplitMembers(team.id),
    getTeamCurrencies(team.id),
  ]);
  const currencies = teamCurrencies.length
    ? teamCurrencies
    : [team.primaryCurrency];
  const cur =
    typeof sp.cur === "string" && currencies.includes(sp.cur)
      ? sp.cur
      : currencies[0];

  const balance = await getTeamBalance(team.id, cur);

  const colors = Object.fromEntries(
    members.map((m) => [m.userId, colorFor(m.userId)]),
  );
  const calcMembers = members.map((m) => ({
    userId: m.userId,
    name: m.name,
    incomeCents: m.incomeCents,
  }));
  const pcts = effortPercents(calcMembers);
  const anyIncome = members.some((m) => m.incomeCents > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Calculadora de esfuerzo</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Repartí los gastos compartidos en proporción a lo que gana cada uno.
        </p>
      </div>

      <CurrencyTabs currencies={currencies} value={cur} />

      {/* Ingresos */}
      <section className="cosmic-panel rounded-2xl border p-4">
        <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
          Ingreso mensual de cada uno
        </p>
        <p className="mb-2 text-xs text-muted-foreground">
          Cada uno edita solo el suyo.
        </p>
        <div className="divide-y">
          {members.map((m) => (
            <IncomeRow
              key={m.userId}
              name={m.name}
              incomeCents={m.incomeCents}
              currency={m.incomeCurrency}
              editable={m.userId === user.id}
              color={colors[m.userId]}
            />
          ))}
        </div>
        {anyIncome && members.length >= 2 && (
          <>
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full">
              {members.map((m) => (
                <span
                  key={m.userId}
                  style={{
                    width: `${pcts[m.userId] ?? 0}%`,
                    background: colors[m.userId],
                  }}
                />
              ))}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
              {members.map((m) => (
                <span key={m.userId}>
                  {m.name} <b className="text-foreground">{(pcts[m.userId] ?? 0).toFixed(0)}%</b>
                </span>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Calculadora rápida */}
      {members.length >= 2 && (
        <section className="cosmic-panel rounded-2xl border p-4">
          <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Calculadora rápida
          </p>
          <QuickCalc members={calcMembers} currency={cur} colors={colors} />
        </section>
      )}

      {/* Balance */}
      <section className="cosmic-panel rounded-2xl border p-4">
        <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
          Balance del equipo
        </p>

        {balance.suggestion ? (
          <>
            <div className="rounded-xl border bg-card/40 py-4 text-center">
              <p className="text-lg font-bold text-emerald-600">
                {balance.suggestion.fromName} le debe a {balance.suggestion.toName}
              </p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums">
                {formatMoney(balance.suggestion.amountCents, cur)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                de {balance.perExpense.length} gastos compartidos
              </p>
            </div>

            {balance.perExpense.length > 0 && (
              <div className="mt-3 divide-y text-sm">
                {balance.perExpense.slice(0, 10).map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {e.label} · pagó {e.paidByName} · {fmtDay(e.spentOn)}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatMoney(e.amountCents, cur)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3">
              <SettleButton
                currency={cur}
                label={`${balance.suggestion.fromName} le paga ${formatMoney(balance.suggestion.amountCents, cur)} a ${balance.suggestion.toName} y el balance vuelve a cero.`}
              />
            </div>
          </>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {balance.hasShared
              ? "Están a mano — no hay nada para saldar."
              : "Todavía no hay gastos compartidos. Marcá un gasto como compartido al cargarlo."}
          </p>
        )}

        {balance.settlements.length > 0 && (
          <div className="mt-4">
            <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Pagos registrados
            </p>
            <div className="mt-1 divide-y text-xs text-muted-foreground">
              {balance.settlements.map((s) => (
                <div key={s.id} className="flex justify-between py-1.5">
                  <span>
                    {s.fromName} → {s.toName} · {fmtDay(s.settledOn)}
                    {s.note ? ` · ${s.note}` : ""}
                  </span>
                  <span className="tabular-nums">{formatMoney(s.amountCents, cur)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Para marcar un gasto como compartido, usá el switch{" "}
        <Link href="/expenses/new" className="text-primary">
          al cargarlo
        </Link>
        .
      </p>
    </div>
  );
}
