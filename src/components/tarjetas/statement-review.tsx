"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  importStatement,
  undoStatementImport,
  type ImportPayload,
} from "@/lib/actions/card-statements";
import type { MatchResult, LineView } from "@/lib/card-statement-match";
import { fmtDay } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";

type Props = {
  statementId: string;
  status: string;
  label: string;
  closingDate: string | null;
  dueDate: string | null;
  totalArsCents: number;
  totalUsdCents: number;
  match: MatchResult;
  categories: string[];
};

type DateMode = "real" | "period" | "skip";

const money = (l: LineView) => formatMoney(l.amountCents, l.currency);

export function StatementReview(props: Props) {
  const { match } = props;
  const router = useRouter();
  const [pending, start] = useTransition();

  // selección de nuevos (por idx de línea)
  const [newSel, setNewSel] = useState<Set<number>>(
    () => new Set(match.nuevos.map((l) => l.idx)),
  );
  // categoría elegida por línea (idx → nombre)
  const [cat, setCat] = useState<Record<number, string>>(() => {
    const m: Record<number, string> = {};
    for (const l of [...match.nuevos, ...match.previos])
      m[l.idx] = l.category || "Otros";
    for (const d of match.dudosos) m[d.line.idx] = d.line.category || "Otros";
    return m;
  });
  // previos: modo de fecha por línea
  const [prevMode, setPrevMode] = useState<Record<number, DateMode>>(() => {
    const m: Record<number, DateMode> = {};
    for (const l of match.previos) m[l.idx] = "real";
    return m;
  });
  // dudosos: "new" o el id del gasto elegido
  const [dudoso, setDudoso] = useState<Record<number, string>>(() => {
    const m: Record<number, string> = {};
    for (const d of match.dudosos) m[d.line.idx] = "new";
    return m;
  });
  // ya cargados: ajustar monto real
  const [fix, setFix] = useState<Record<number, boolean>>(() => {
    const m: Record<number, boolean> = {};
    for (const y of match.yaCargados) m[y.line.idx] = y.needsFix;
    return m;
  });
  const [cargos, setCargos] = useState(match.cargos.totalCents > 0);

  const toggleNew = (idx: number) =>
    setNewSel((s) => {
      const n = new Set(s);
      if (n.has(idx)) n.delete(idx);
      else n.add(idx);
      return n;
    });

  const setCatFor = (idx: number, v: string) =>
    setCat((c) => ({ ...c, [idx]: v }));

  const { toImport, toLink, fixCount } = useMemo(() => {
    const imports: ImportPayload["imports"] = [];
    const links: ImportPayload["links"] = [];

    for (const l of match.nuevos) {
      if (newSel.has(l.idx))
        imports.push({ idx: l.idx, categoryName: cat[l.idx] ?? "Otros" });
    }
    for (const l of match.previos) {
      const mode = prevMode[l.idx] ?? "real";
      if (mode === "skip") continue;
      imports.push({
        idx: l.idx,
        categoryName: cat[l.idx] ?? "Otros",
        dateMode: mode,
      });
    }
    for (const d of match.dudosos) {
      const r = dudoso[d.line.idx] ?? "new";
      if (r === "new")
        imports.push({ idx: d.line.idx, categoryName: cat[d.line.idx] ?? "Otros" });
      else links.push({ idx: d.line.idx, expenseId: r, applyFix: false });
    }
    let fc = 0;
    for (const y of match.yaCargados) {
      const doFix = !!fix[y.line.idx];
      if (doFix && y.needsFix) fc++;
      links.push({
        idx: y.line.idx,
        expenseId: y.expense.id,
        applyFix: doFix,
      });
    }
    return { toImport: imports, toLink: links, fixCount: fc };
  }, [match, newSel, cat, prevMode, dudoso, fix]);

  const run = () =>
    start(async () => {
      const r = await importStatement({
        statementId: props.statementId,
        imports: toImport,
        links: toLink,
        importCargos: cargos,
      });
      if (!r.ok) {
        toast.error(r.error ?? "Error");
        return;
      }
      toast.success(`Cargados ${r.created} · atados ${r.linked}`);
      router.push("/tarjetas");
      router.refresh();
    });

  const undo = () =>
    start(async () => {
      const r = await undoStatementImport(props.statementId);
      if (!r.ok) {
        toast.error(r.error ?? "Error");
        return;
      }
      toast.success("Importación deshecha");
      router.refresh();
    });

  // ── ya importado ──
  if (props.status === "imported") {
    return (
      <div className="space-y-4">
        <Head {...props} />
        <div className="cosmic-panel rounded-2xl border p-5 text-center">
          <p className="text-2xl">✅</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Ya cargaste los consumos de este resumen. Los gastos importados
            quedaron atados a este resumen.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            disabled={pending}
            onClick={undo}
          >
            ↩️ Deshacer importación
          </Button>
        </div>
      </div>
    );
  }

  const nothing =
    toImport.length === 0 && toLink.length === 0 && !cargos;

  return (
    <div className="space-y-4 pb-28">
      <Head {...props} />

      <div className="flex flex-wrap gap-1.5 text-[0.66rem]">
        <Pill tone="info">{match.counts.nuevos} nuevos</Pill>
        <Pill>{match.counts.yaCargados} ya cargados</Pill>
        {match.counts.dudosos > 0 && (
          <Pill tone="warn">{match.counts.dudosos} dudosos</Pill>
        )}
        {match.counts.previos > 0 && <Pill>{match.counts.previos} previos</Pill>}
      </div>

      {/* NUEVOS */}
      {match.nuevos.length > 0 && (
        <Section title="Nuevos" hint={`${newSel.size} se cargan`}>
          {match.nuevos.map((l) => (
            <div
              key={l.idx}
              className={`flex gap-2.5 rounded-xl border p-2.5 ${
                newSel.has(l.idx) ? "border-border" : "border-border opacity-45"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleNew(l.idx)}
                aria-pressed={newSel.has(l.idx)}
                className={`mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-[5px] border text-[11px] ${
                  newSel.has(l.idx)
                    ? "border-[#6fffe9] bg-[#6fffe9] text-[#0b132b]"
                    : "border-muted-foreground"
                }`}
              >
                {newSel.has(l.idx) ? "✓" : ""}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.83rem] font-medium">
                  {l.description}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[0.7rem] text-muted-foreground">
                  {fmtDay(l.date)}
                  {l.installment && <Cuota>{l.installment}</Cuota>}
                  {l.currency === "USD" && <Cuota>USD</Cuota>}
                </p>
                <CatSelect
                  value={cat[l.idx] ?? "Otros"}
                  onChange={(v) => setCatFor(l.idx, v)}
                  options={props.categories}
                />
              </div>
              <span className="shrink-0 text-[0.9rem] font-semibold tabular-nums">
                {money(l)}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* YA CARGADOS */}
      {match.yaCargados.length > 0 && (
        <Section
          title="Ya cargados"
          hint={`${match.yaCargados.length} no se duplican`}
        >
          {match.yaCargados.map((y) => (
            <div key={y.line.idx} className="rounded-xl border p-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[0.83rem] font-medium">{y.line.description}</p>
                <span className="text-[0.9rem] font-semibold tabular-nums">
                  {money(y.line)}
                </span>
              </div>
              <div className="mt-1.5 border-t border-dashed pt-1.5 text-[0.72rem] text-muted-foreground">
                atado a tu gasto{" "}
                <b className="text-foreground">
                  {y.expense.description || y.expense.categoryName}
                </b>{" "}
                · {formatMoney(y.expense.amountCents, y.line.currency)} ·{" "}
                {fmtDay(y.expense.spentOn)}
                {y.needsFix ? (
                  <label className="mt-1.5 flex cursor-pointer items-center gap-2 font-semibold text-cyan-500">
                    <Switch
                      on={!!fix[y.line.idx]}
                      onClick={() =>
                        setFix((f) => ({
                          ...f,
                          [y.line.idx]: !f[y.line.idx],
                        }))
                      }
                    />
                    ajustar a {money(y.line)} (valor real)
                  </label>
                ) : (
                  <span className="text-emerald-500"> · monto exacto</span>
                )}
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* DUDOSOS */}
      {match.dudosos.length > 0 && (
        <Section title="Dudosos" hint="decidí vos">
          {match.dudosos.map((d) => (
            <div key={d.line.idx} className="rounded-xl border p-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[0.83rem] font-medium">{d.line.description}</p>
                <span className="text-[0.9rem] font-semibold tabular-nums">
                  {money(d.line)}
                </span>
              </div>
              <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
                {fmtDay(d.line.date)} · {d.line.kind}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {d.candidatos.map((c) => (
                  <MiniBtn
                    key={c.id}
                    active={dudoso[d.line.idx] === c.id}
                    onClick={() =>
                      setDudoso((s) => ({ ...s, [d.line.idx]: c.id }))
                    }
                  >
                    es {c.description || c.categoryName} ·{" "}
                    {formatMoney(c.amountCents, d.line.currency)}
                  </MiniBtn>
                ))}
                <MiniBtn
                  alt
                  active={dudoso[d.line.idx] === "new" || !dudoso[d.line.idx]}
                  onClick={() =>
                    setDudoso((s) => ({ ...s, [d.line.idx]: "new" }))
                  }
                >
                  ninguno, es nuevo
                </MiniBtn>
              </div>
              {(dudoso[d.line.idx] === "new" || !dudoso[d.line.idx]) && (
                <CatSelect
                  value={cat[d.line.idx] ?? "Otros"}
                  onChange={(v) => setCatFor(d.line.idx, v)}
                  options={props.categories}
                />
              )}
            </div>
          ))}
        </Section>
      )}

      {/* PREVIOS AL ALTA */}
      {match.previos.length > 0 && (
        <Section
          title="Previos a tu alta en Finanzas"
          hint={`desde antes del ${fmtDay(match.teamCreatedOn)}`}
        >
          {match.previos.map((l) => (
            <div key={l.idx} className="rounded-xl border p-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[0.83rem] font-medium">{l.description}</p>
                <span className="text-[0.9rem] font-semibold tabular-nums">
                  {money(l)}
                </span>
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
                {fmtDay(l.date)}
                {l.installment && <Cuota>{l.installment}</Cuota>}
              </p>
              <div className="mt-2 flex gap-1.5">
                {(["real", "period", "skip"] as DateMode[]).map((m) => (
                  <MiniBtn
                    key={m}
                    className="flex-1"
                    active={(prevMode[l.idx] ?? "real") === m}
                    onClick={() =>
                      setPrevMode((s) => ({ ...s, [l.idx]: m }))
                    }
                  >
                    {m === "real"
                      ? "fecha real"
                      : m === "period"
                        ? "del período"
                        : "saltar"}
                  </MiniBtn>
                ))}
              </div>
              {(prevMode[l.idx] ?? "real") !== "skip" && (
                <CatSelect
                  value={cat[l.idx] ?? "Otros"}
                  onChange={(v) => setCatFor(l.idx, v)}
                  options={props.categories}
                />
              )}
            </div>
          ))}
        </Section>
      )}

      {/* CARGOS */}
      {match.cargos.totalCents > 0 && (
        <Section title="Cargos e impuestos">
          <div className="flex items-center justify-between gap-2 rounded-xl border p-2.5">
            <div className="min-w-0">
              <p className="text-[0.8rem] font-medium">
                Cargos e impuestos — {props.label}
              </p>
              <p className="mt-0.5 truncate text-[0.66rem] text-muted-foreground">
                {match.cargos.breakdown
                  .map((b) => `${b.description} ${formatMoney(b.amountCents, "ARS")}`)
                  .join(" · ")}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="text-[0.9rem] font-semibold tabular-nums">
                {formatMoney(match.cargos.totalCents, "ARS")}
              </span>
              <Switch on={cargos} onClick={() => setCargos((v) => !v)} />
            </div>
          </div>
        </Section>
      )}

      {/* FOOTER */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-lg bg-gradient-to-t from-background via-background to-transparent px-4 pb-2 pt-3">
        {fixCount > 0 && (
          <p className="mb-1.5 text-center text-[0.72rem] font-semibold text-cyan-500">
            ↕ Se ajustan {fixCount} monto{fixCount === 1 ? "" : "s"} redondeado
            {fixCount === 1 ? "" : "s"} al valor real
          </p>
        )}
        <Button className="w-full" disabled={pending || nothing} onClick={run}>
          {nothing
            ? "Nada para cargar"
            : `Cargar ${toImport.length} consumo${
                toImport.length === 1 ? "" : "s"
              }${cargos ? " + cargos" : ""}`}
        </Button>
      </div>
    </div>
  );
}

/* ── piezas ── */

function Head(p: Props) {
  return (
    <div>
      <h1 className="text-lg font-semibold">{p.label}</h1>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {p.closingDate ? `cierre ${fmtDay(p.closingDate)} · ` : ""}
        {p.dueDate ? `vence ${fmtDay(p.dueDate)}` : ""} ·{" "}
        <b className="text-foreground tabular-nums">
          {formatMoney(p.totalArsCents, "ARS")}
        </b>
        {p.totalUsdCents
          ? ` + ${formatMoney(p.totalUsdCents, "USD")}`
          : ""}
      </p>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-baseline justify-between px-0.5">
        <h2 className="text-[0.82rem] font-semibold">{title}</h2>
        {hint && (
          <span className="text-[0.7rem] text-muted-foreground">{hint}</span>
        )}
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "info" | "warn";
}) {
  const cls =
    tone === "info"
      ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-500"
      : tone === "warn"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
        : "border-border text-muted-foreground";
  return (
    <span className={`rounded-full border px-2 py-0.5 font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function Cuota({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[4px] border border-cyan-500/40 px-1 text-[0.6rem] font-bold text-cyan-500">
      {children}
    </span>
  );
}

function CatSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const opts = options.includes(value) ? options : [value, ...options];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1.5 max-w-full rounded-md border border-border bg-card/60 px-1.5 py-1 text-[0.72rem]"
    >
      {opts.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors ${
        on ? "bg-emerald-500" : "bg-border"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 size-[14px] rounded-full bg-white transition-transform ${
          on ? "translate-x-3" : ""
        }`}
      />
    </button>
  );
}

function MiniBtn({
  children,
  active,
  alt,
  onClick,
  className,
}: {
  children: React.ReactNode;
  active?: boolean;
  alt?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1.5 text-[0.7rem] font-semibold transition-colors ${
        active
          ? alt
            ? "border-primary/50 bg-primary/20 text-foreground"
            : "border-emerald-500/50 bg-emerald-500/15 text-foreground"
          : "border-border bg-card/50 text-muted-foreground"
      } ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
