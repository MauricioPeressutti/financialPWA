/**
 * FakeDb: doble en memoria del cliente Drizzle (`@/db`) para tests de Server
 * Actions. Implementa el subconjunto del query builder "core" que usan las
 * actions del repo:
 *
 *   db.select(fields?).from(t).innerJoin|leftJoin(t, on).where(c).orderBy(..).limit(n)
 *   db.insert(t).values(v | v[]).onConflictDoNothing().returning(fields?)
 *   db.update(t).set(v).where(c).returning(fields?)
 *   db.delete(t).where(c).returning(fields?)
 *   db.batch([q1, q2, ...])            -> atómico (como neon-http)
 *   db.transaction(...)                -> TIRA, igual que neon-http
 *
 * Las condiciones `where`/`on` se renderizan con el PgDialect real de Drizzle y
 * se evalúan en memoria. Soporta: =, <>, <, <=, >, >=, is [not] null, in (...),
 * not in (...), between, and, or, not. Cualquier otra cosa (lower(), ilike,
 * subqueries, exists, sql crudo raro) tira "FakeDb: condición no soportada" a
 * propósito, para no dar falsos verdes. `orderBy` se ignora.
 *
 * También emula las restricciones de la DB que importan para gastos fijos:
 *   - UNIQUE(bill_id, period)           -> fixed_bill_payments_bill_period_idx
 *   - UNIQUE(expense_id) parcial        -> fixed_bill_payments_expense_idx
 *   - FK bill_id   ON DELETE CASCADE    (fixed_bills -> fixed_bill_payments)
 *   - FK expense_id ON DELETE SET NULL  (expenses   -> fixed_bill_payments)
 *   - NOT NULL sin default              -> error 23502
 * Las violaciones se tiran como en producción: `DrizzleQueryError` con
 * `cause = { code: "23505", constraint: "<nombre del índice>" }`.
 *
 * El relational API (`db.query.*`) y `db.execute` NO están soportados.
 */
import { randomUUID } from "node:crypto";

import {
  Column,
  DrizzleQueryError,
  SQL,
  Table,
  getTableColumns,
  getTableName,
  is,
} from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

/* eslint-disable @typescript-eslint/no-explicit-any */

type SqlRow = Record<string, unknown>; // keyed por nombre de columna SQL
type Combined = Record<string, unknown>; // keyed por "tabla.columna"
type AnyTable = Table;

const dialect = new PgDialect();

const UNIQUES: Record<
  string,
  { name: string; cols: string[]; partialNotNull?: boolean }[]
> = {
  fixed_bill_payments: [
    { name: "fixed_bill_payments_bill_period_idx", cols: ["bill_id", "period"] },
    {
      name: "fixed_bill_payments_expense_idx",
      cols: ["expense_id"],
      partialNotNull: true,
    },
  ],
};

const ON_DELETE: Record<
  string,
  { table: string; col: string; action: "cascade" | "set null" }[]
> = {
  fixed_bills: [{ table: "fixed_bill_payments", col: "bill_id", action: "cascade" }],
  expenses: [
    { table: "fixed_bill_payments", col: "expense_id", action: "set null" },
  ],
};

export type FakeOp = {
  op: "select" | "insert" | "update" | "delete";
  table: string;
  count: number;
};

function assertTable(t: unknown, where: string): asserts t is AnyTable {
  if (!t || !is(t as any, Table)) {
    throw new Error(
      `FakeDb: ${where} recibió una tabla indefinida (¿falta definirla en src/db/schema.ts?)`,
    );
  }
}

function tname(t: AnyTable): string {
  return getTableName(t);
}

function columnsOf(t: AnyTable): Record<string, Column> {
  return getTableColumns(t) as Record<string, Column>;
}

function uniqueError(table: string, constraint: string): DrizzleQueryError {
  const cause = Object.assign(
    new Error(`duplicate key value violates unique constraint "${constraint}"`),
    { code: "23505", constraint, table },
  );
  return new DrizzleQueryError(`insert into "${table}"`, [], cause);
}

function notNullError(table: string, column: string): DrizzleQueryError {
  const cause = Object.assign(
    new Error(
      `null value in column "${column}" of relation "${table}" violates not-null constraint`,
    ),
    { code: "23502", column, table },
  );
  return new DrizzleQueryError(`insert into "${table}"`, [], cause);
}

// ─── Evaluación de condiciones ─────────────────────────
const predicateCache = new Map<string, (r: Combined, p: unknown[]) => boolean>();

function compileCondition(
  cond: unknown,
): (r: Combined) => boolean {
  if (cond === undefined || cond === null) return () => true;
  if (!is(cond as any, SQL)) {
    throw new Error("FakeDb: condición no soportada (no es SQL de drizzle)");
  }
  const q = dialect.sqlToQuery(cond as SQL);
  const params = q.params;
  let fn = predicateCache.get(q.sql);
  if (!fn) {
    fn = translate(q.sql);
    predicateCache.set(q.sql, fn);
  }
  const f = fn;
  return (r) => f(r, params);
}

function translate(sqlText: string): (r: Combined, p: unknown[]) => boolean {
  let s = ` ${sqlText} `;
  s = s.replace(/"([A-Za-z0-9_]+)"\."([A-Za-z0-9_]+)"/g, (_m, t, c) => `__r["${t}.${c}"]`);
  s = s.replace(/\$(\d+)/g, (_m, n) => `__p[${Number(n) - 1}]`);
  s = s.replace(/ is not null/gi, " != null");
  s = s.replace(/ is null/gi, " == null");
  s = s.replace(
    /(__r\["[^"]+"\]) not in \(([^()]*)\)/gi,
    (_m, col, list) => `![${list}].includes(${col})`,
  );
  s = s.replace(
    /(__r\["[^"]+"\]) in \(([^()]*)\)/gi,
    (_m, col, list) => `[${list}].includes(${col})`,
  );
  s = s.replace(
    /(__r\["[^"]+"\]) between (__p\[\d+\]) and (__p\[\d+\])/gi,
    (_m, col, a, b) => `(${col} >= ${a} && ${col} <= ${b})`,
  );
  s = s.replace(/<>/g, "!=");
  s = s.replace(/([^<>!=])=([^=])/g, "$1==$2");
  s = s.replace(/ and /gi, " && ");
  s = s.replace(/ or /gi, " || ");
  s = s.replace(/(^|[\s(])not /gi, "$1!");

  const residue = s
    .replace(/__r\["[^"]+"\]/g, "")
    .replace(/__p\[\d+\]/g, "")
    .replace(/\.includes\(/g, "(")
    .replace(/\b(null|true|false)\b/g, "");
  if (!/^[\s()[\],&|!=<>]*$/.test(residue)) {
    throw new Error(`FakeDb: condición no soportada: ${sqlText}`);
  }
  return new Function("__r", "__p", `return (${s});`) as (
    r: Combined,
    p: unknown[],
  ) => boolean;
}

// ─── Store ─────────────────────────────────────────────
export type FakeDb = ReturnType<typeof createFakeDb>;

export function createFakeDb() {
  let store = new Map<string, SqlRow[]>();
  const ops: FakeOp[] = [];
  const failures: { op: FakeOp["op"]; table: string; error: Error }[] = [];
  const tables = new Map<string, AnyTable>();

  function rowsOf(name: string): SqlRow[] {
    let r = store.get(name);
    if (!r) {
      r = [];
      store.set(name, r);
    }
    return r;
  }

  function toSqlRow(t: AnyTable, jsRow: Record<string, unknown>, applyDefaults: boolean) {
    const cols = columnsOf(t);
    const out: SqlRow = {};
    for (const [key, col] of Object.entries(cols)) {
      let v = jsRow[key];
      if (v === undefined && applyDefaults) {
        const c = col as any;
        if (typeof c.defaultFn === "function") v = c.defaultFn();
        else if (c.hasDefault) {
          if (is(c.default, SQL)) {
            v = c.columnType === "PgUUID" ? randomUUID() : new Date();
          } else {
            v = structuredClone(c.default);
          }
        } else v = null;
      }
      if (v !== undefined) {
        if (is(v as any, SQL)) {
          throw new Error(`FakeDb: valor SQL crudo no soportado en ${tname(t)}.${col.name}`);
        }
        if (applyDefaults && v === null && col.notNull) {
          throw notNullError(tname(t), col.name);
        }
        out[col.name] = v;
      }
    }
    return out;
  }

  function toJsRow(t: AnyTable, row: SqlRow): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, col] of Object.entries(columnsOf(t))) {
      out[key] = row[col.name] ?? null;
    }
    return out;
  }

  function combine(t: AnyTable, row: SqlRow | null, into: Combined = {}) {
    const n = tname(t);
    if (row) {
      for (const [k, v] of Object.entries(row)) into[`${n}.${k}`] = v;
      (into as any)[`__present.${n}`] = true;
    }
    return into;
  }

  function project(
    fields: Record<string, unknown> | undefined,
    tablesInQuery: AnyTable[],
    c: Combined,
  ): unknown {
    if (!fields) {
      if (tablesInQuery.length === 1) return extractTable(tablesInQuery[0], c);
      const out: Record<string, unknown> = {};
      for (const t of tablesInQuery) out[tname(t)] = extractTable(t, c);
      return out;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) out[k] = projectField(v, c);
    return out;
  }

  function extractTable(t: AnyTable, c: Combined) {
    const n = tname(t);
    if (!(c as any)[`__present.${n}`]) return null;
    const row: SqlRow = {};
    for (const col of Object.values(columnsOf(t))) row[col.name] = c[`${n}.${col.name}`];
    return toJsRow(t, row);
  }

  function projectField(v: unknown, c: Combined): unknown {
    if (is(v as any, Column)) {
      const col = v as Column;
      return c[`${tname(col.table as AnyTable)}.${col.name}`] ?? null;
    }
    if (is(v as any, Table)) return extractTable(v as AnyTable, c);
    if (is(v as any, SQL) || (v && typeof v === "object" && "sql" in (v as any))) {
      throw new Error("FakeDb: campos SQL calculados en select no soportados");
    }
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      let allNull = true;
      for (const [k, sub] of Object.entries(v)) {
        out[k] = projectField(sub, c);
        if (out[k] !== null) allNull = false;
      }
      return allNull ? null : out;
    }
    throw new Error("FakeDb: campo de select no soportado");
  }

  function checkUniques(name: string, rows: SqlRow[], candidate: SqlRow): string | null {
    for (const u of UNIQUES[name] ?? []) {
      if (u.partialNotNull && u.cols.some((c) => candidate[c] == null)) continue;
      const clash = rows.some((r) => r !== candidate && u.cols.every((c) => r[c] === candidate[c]));
      if (clash) return u.name;
    }
    return null;
  }

  function applyOnDelete(name: string, deleted: SqlRow[]) {
    for (const rule of ON_DELETE[name] ?? []) {
      const ids = new Set(deleted.map((d) => d.id));
      const target = rowsOf(rule.table);
      if (rule.action === "cascade") {
        const gone = target.filter((r) => ids.has(r[rule.col]));
        store.set(rule.table, target.filter((r) => !ids.has(r[rule.col])));
        applyOnDelete(rule.table, gone);
      } else {
        for (const r of target) if (ids.has(r[rule.col])) r[rule.col] = null;
      }
    }
  }

  function takeFailure(op: FakeOp["op"], table: string) {
    const i = failures.findIndex((f) => f.op === op && f.table === table);
    if (i >= 0) {
      const [f] = failures.splice(i, 1);
      throw f.error;
    }
  }

  class Query implements PromiseLike<any> {
    kind: FakeOp["op"];
    table?: AnyTable;
    fields?: Record<string, unknown>;
    joins: { type: "inner" | "left"; table: AnyTable; on: unknown }[] = [];
    cond: unknown;
    limitN?: number;
    setValues?: Record<string, unknown>;
    insertValues?: Record<string, unknown>[];
    returningMode: "none" | "all" | "fields" = "none";
    returningFields?: Record<string, unknown>;
    conflictNothing = false;

    constructor(kind: FakeOp["op"], table?: AnyTable, fields?: Record<string, unknown>) {
      this.kind = kind;
      this.table = table;
      this.fields = fields;
    }
    from(t: AnyTable) {
      assertTable(t, "select().from()");
      this.table = t;
      return this;
    }
    innerJoin(t: AnyTable, on: unknown) {
      assertTable(t, "innerJoin()");
      this.joins.push({ type: "inner", table: t, on });
      return this;
    }
    leftJoin(t: AnyTable, on: unknown) {
      assertTable(t, "leftJoin()");
      this.joins.push({ type: "left", table: t, on });
      return this;
    }
    where(c: unknown) {
      this.cond = c;
      return this;
    }
    orderBy() {
      return this;
    }
    groupBy() {
      throw new Error("FakeDb: groupBy no soportado");
    }
    limit(n: number) {
      this.limitN = n;
      return this;
    }
    values(v: Record<string, unknown> | Record<string, unknown>[]) {
      this.insertValues = Array.isArray(v) ? v : [v];
      return this;
    }
    set(v: Record<string, unknown>) {
      this.setValues = v;
      return this;
    }
    returning(fields?: Record<string, unknown>) {
      this.returningMode = fields ? "fields" : "all";
      this.returningFields = fields;
      return this;
    }
    onConflictDoNothing() {
      this.conflictNothing = true;
      return this;
    }
    onConflictDoUpdate(): never {
      throw new Error("FakeDb: onConflictDoUpdate no soportado");
    }
    then<A = any, B = never>(
      onF?: ((v: any) => A | PromiseLike<A>) | null,
      onR?: ((e: any) => B | PromiseLike<B>) | null,
    ): PromiseLike<A | B> {
      return this.run(true).then(onF, onR);
    }
    async run(withTick: boolean): Promise<any> {
      if (withTick) await new Promise((r) => setTimeout(r, 0));
      const t = this.table;
      assertTable(t, `${this.kind}()`);
      const name = tname(t);
      takeFailure(this.kind, name);
      switch (this.kind) {
        case "select":
          return this.runSelect(t);
        case "insert":
          return this.runInsert(t, name);
        case "update":
          return this.runUpdate(t, name);
        case "delete":
          return this.runDelete(t, name);
      }
    }
    private returned(t: AnyTable, rows: SqlRow[]) {
      if (this.returningMode === "none") return { rowCount: rows.length, rows: [] };
      return rows.map((r) => {
        const c = combine(t, r);
        return this.returningMode === "all"
          ? toJsRow(t, r)
          : project(this.returningFields, [t], c);
      });
    }
    private runSelect(t: AnyTable) {
      let combos: Combined[] = rowsOf(tname(t)).map((r) => combine(t, r));
      const all = [t];
      for (const j of this.joins) {
        const on = compileCondition(j.on);
        const next: Combined[] = [];
        for (const c of combos) {
          const matches = rowsOf(tname(j.table))
            .map((r) => combine(j.table, r, { ...c }))
            .filter(on);
          if (matches.length) next.push(...matches);
          else if (j.type === "left") next.push({ ...c });
        }
        combos = next;
        all.push(j.table);
      }
      const pred = compileCondition(this.cond);
      let out = combos.filter(pred);
      if (this.limitN !== undefined) out = out.slice(0, this.limitN);
      ops.push({ op: "select", table: tname(t), count: out.length });
      return out.map((c) => structuredClone(project(this.fields, all, c)));
    }
    private runInsert(t: AnyTable, name: string) {
      const rows = rowsOf(name);
      const inserted: SqlRow[] = [];
      for (const v of this.insertValues ?? []) {
        const row = toSqlRow(t, v, true);
        const clash = checkUniques(name, [...rows, ...inserted], row);
        if (clash) {
          if (this.conflictNothing) continue;
          throw uniqueError(name, clash);
        }
        inserted.push(row);
      }
      rows.push(...inserted);
      ops.push({ op: "insert", table: name, count: inserted.length });
      return structuredClone(this.returned(t, inserted));
    }
    private runUpdate(t: AnyTable, name: string) {
      const pred = compileCondition(this.cond);
      const patch = toSqlRow(t, this.setValues ?? {}, false);
      const rows = rowsOf(name);
      const matched = rows.filter((r) => pred(combine(t, r)));
      for (const r of matched) {
        const next = { ...r, ...patch };
        const clash = checkUniques(name, rows.filter((x) => x !== r), next);
        if (clash) throw uniqueError(name, clash);
        Object.assign(r, patch);
      }
      ops.push({ op: "update", table: name, count: matched.length });
      return structuredClone(this.returned(t, matched));
    }
    private runDelete(t: AnyTable, name: string) {
      const pred = compileCondition(this.cond);
      const rows = rowsOf(name);
      const gone = rows.filter((r) => pred(combine(t, r)));
      store.set(name, rows.filter((r) => !gone.includes(r)));
      applyOnDelete(name, gone);
      ops.push({ op: "delete", table: name, count: gone.length });
      return structuredClone(this.returned(t, gone));
    }
  }

  const db = {
    select(fields?: Record<string, unknown>) {
      return new Query("select", undefined, fields);
    },
    selectDistinct(fields?: Record<string, unknown>) {
      return new Query("select", undefined, fields);
    },
    insert(t: AnyTable) {
      assertTable(t, "insert()");
      return new Query("insert", t);
    },
    update(t: AnyTable) {
      assertTable(t, "update()");
      return new Query("update", t);
    },
    delete(t: AnyTable) {
      assertTable(t, "delete()");
      return new Query("delete", t);
    },
    async batch(queries: Query[]) {
      await new Promise((r) => setTimeout(r, 0));
      const snap = cloneStore();
      try {
        const results = [];
        for (const q of queries) results.push(await q.run(false));
        return results;
      } catch (e) {
        store = snap;
        throw e;
      }
    },
    async transaction(): Promise<never> {
      // Igual que drizzle-orm/neon-http: sin transacciones interactivas.
      throw new Error("No transactions support in neon-http driver");
    },
    async execute(): Promise<never> {
      throw new Error("FakeDb: db.execute no soportado");
    },
    get query(): never {
      throw new Error("FakeDb: relational queries (db.query.*) no soportadas; usá el query builder core");
    },
  };

  function cloneStore() {
    const m = new Map<string, SqlRow[]>();
    for (const [k, v] of store) m.set(k, structuredClone(v));
    return m;
  }

  return {
    db,
    ops,
    /** Inserta una fila (keys JS, como en drizzle) aplicando defaults. Devuelve la fila JS. */
    seed<T extends Record<string, unknown>>(t: unknown, row: T): Record<string, unknown> {
      assertTable(t, "seed()");
      tables.set(tname(t), t);
      const r = toSqlRow(t, row, true);
      rowsOf(tname(t)).push(r);
      return toJsRow(t, r);
    },
    /** Filas actuales de una tabla (keys JS). */
    rows(t: unknown): Record<string, any>[] {
      assertTable(t, "rows()");
      return structuredClone(rowsOf(tname(t)).map((r) => toJsRow(t, r)));
    },
    /** Hace fallar la próxima operación `op` sobre `table` (nombre de tabla de un Table). */
    failNext(op: FakeOp["op"], t: unknown, error = new Error("FakeDb: fallo inyectado")) {
      assertTable(t, "failNext()");
      failures.push({ op, table: tname(t), error });
    },
    /** Snapshot serializable de todo el store, para comparar "no tocó la DB". */
    snapshot(): Record<string, SqlRow[]> {
      const out: Record<string, SqlRow[]> = {};
      for (const [k, v] of [...store].sort(([a], [b]) => a.localeCompare(b))) {
        if (v.length) out[k] = structuredClone(v);
      }
      return out;
    },
    writes(): FakeOp[] {
      return ops.filter((o) => o.op !== "select" && o.count > 0);
    },
    reset() {
      store = new Map();
      ops.length = 0;
      failures.length = 0;
    },
  };
}

/** Singleton que comparten `vi.mock("@/db")` y los tests. */
export const fake = createFakeDb();
