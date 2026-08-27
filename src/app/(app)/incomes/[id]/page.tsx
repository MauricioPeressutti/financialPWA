import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DeleteIncomeButton } from "@/components/delete-income-button";
import { requireTeam } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { incomeMethodLabels } from "@/lib/income-methods";
import { getIncome } from "@/lib/queries";

export default async function IncomeDetailPage({
  params,
}: PageProps<"/incomes/[id]">) {
  const { team } = await requireTeam();
  const { id } = await params;
  const income = await getIncome(team.id, id);
  if (!income) notFound();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ingreso</h1>
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/incomes/${id}/edit`}>Editar</Link>}
        />
      </div>

      <div className="rounded-lg border p-4">
        <p className="text-3xl font-bold text-emerald-600">
          {formatCents(income.amountCents)}
        </p>
        <dl className="mt-4 space-y-1.5 text-sm">
          <Row k="Fecha" v={income.receivedOn} />
          <Row
            k="Fuente"
            v={`${income.categoryName}${income.subcategoryName ? ` · ${income.subcategoryName}` : ""}`}
          />
          <Row k="Medio" v={incomeMethodLabels[income.method] ?? income.method} />
          {income.description && <Row k="Descripción" v={income.description} />}
          {income.createdBy && <Row k="Cargado por" v={income.createdBy} />}
        </dl>
      </div>

      <DeleteIncomeButton id={id} />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
