import { notFound } from "next/navigation";

import { requireTeam } from "@/lib/auth";
import type { ParsedStatement } from "@/lib/card-statement";
import { matchStatement } from "@/lib/card-statement-match";
import { getStatement } from "@/lib/card-statements";
import { getActiveCategories } from "@/lib/queries";
import { StatementReview } from "@/components/tarjetas/statement-review";

export const dynamic = "force-dynamic";

export default async function RevisarPage({
  params,
}: PageProps<"/tarjetas/[id]/revisar">) {
  const { team } = await requireTeam();
  const { id } = await params;

  const st = await getStatement(team.id, id);
  if (!st) notFound();

  const parsed = st.raw as ParsedStatement | null;
  if (!parsed) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        Este resumen no tiene datos para revisar.
      </div>
    );
  }

  const [match, cats] = await Promise.all([
    matchStatement(team.id, parsed),
    getActiveCategories(team.id, "expense"),
  ]);

  return (
    <StatementReview
      statementId={st.id}
      status={st.status}
      label={st.label}
      closingDate={parsed.closingDate}
      dueDate={parsed.dueDate}
      totalArsCents={parsed.totalArsCents}
      totalUsdCents={parsed.totalUsdCents}
      match={match}
      categories={cats.map((c) => c.name)}
    />
  );
}
