import { readFileSync } from "node:fs";

import { db } from "@/db";
import { cardStatements, teamMembers, teams } from "@/db/schema";
import { extractPdfText } from "@/lib/pdf";
import {
  looksLikeStatement,
  parseCardStatement,
  statementLabel,
} from "@/lib/card-statement";
import { matchStatement } from "@/lib/card-statement-match";
import { getActiveCategories } from "@/lib/queries";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

// Ruta de test SOLO en dev. ?save=1 inserta el resumen en el equipo `?team=` (o el primero).
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("nope", { status: 404 });
  }
  const url = new URL(req.url);
  const path =
    url.searchParams.get("f") ||
    "C:/Users/mauri/Downloads/Resumen - Agosto 2026.pdf";
  const save = url.searchParams.get("save") === "1";

  const buf = readFileSync(path);
  const text = await extractPdfText(new Uint8Array(buf));
  const isStatement = looksLikeStatement(text);

  // elegir equipo
  let teamId = url.searchParams.get("team") ?? "";
  if (!teamId) {
    const [t] = await db.select({ id: teams.id }).from(teams).limit(1);
    teamId = t?.id ?? "";
  }
  const cats = teamId ? await getActiveCategories(teamId, "expense") : [];

  let parsed = null;
  let err = null;
  try {
    parsed = await parseCardStatement(text, {
      expenseCategories: cats.map((c) => ({
        name: c.name,
        subcategories: c.subcategories.map((s) => ({ name: s.name })),
      })),
      today: new Date().toISOString().slice(0, 10),
    });
  } catch (e) {
    err = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }

  let insertedId: string | null = null;
  if (save && parsed && parsed.dueDate && teamId) {
    const [member] = await db
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId))
      .limit(1);
    const [row] = await db
      .insert(cardStatements)
      .values({
        teamId,
        createdByUserId: member.userId,
        bank: parsed.bank || null,
        brand: parsed.brand || null,
        last4: parsed.last4 || null,
        label: statementLabel(parsed),
        closingDate: parsed.closingDate,
        dueDate: parsed.dueDate,
        totalArsCents: parsed.totalArsCents,
        totalUsdCents: parsed.totalUsdCents,
        minPaymentArsCents: parsed.minPaymentArsCents,
        status: "pending",
        raw: parsed,
      })
      .returning({ id: cardStatements.id });
    insertedId = row.id;
  }

  let match = null;
  if (url.searchParams.get("match") === "1" && parsed && teamId) {
    try {
      const m = await matchStatement(teamId, parsed);
      match = {
        counts: m.counts,
        nuevos: m.nuevos.map((l) => `${l.description} ${l.currency} ${l.amountCents / 100}`),
        previos: m.previos.map((l) => `${l.description} ${l.date}`),
        yaCargados: m.yaCargados.map(
          (y) =>
            `${y.line.description} → ${y.expense.description ?? y.expense.categoryName} (fix:${y.needsFix})`,
        ),
        dudosos: m.dudosos.map(
          (d) => `${d.line.description} ? ${d.candidatos.map((c) => c.description).join(", ")}`,
        ),
        cargos: m.cargos.totalCents / 100,
      };
    } catch (e) {
      match = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  return Response.json({
    textLen: text.length,
    isStatement,
    err,
    teamId,
    insertedId,
    reviewUrl: insertedId ? `/tarjetas/${insertedId}/revisar` : null,
    match,
    label: parsed ? statementLabel(parsed) : null,
    header: parsed && {
      bank: parsed.bank,
      brand: parsed.brand,
      last4: parsed.last4,
      closingDate: parsed.closingDate,
      dueDate: parsed.dueDate,
      totalArsCents: parsed.totalArsCents,
      totalUsdCents: parsed.totalUsdCents,
      minPaymentArsCents: parsed.minPaymentArsCents,
    },
    lines: parsed?.lines ?? null,
  });
}
